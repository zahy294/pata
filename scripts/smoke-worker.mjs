// node scripts/smoke-worker.mjs [--url https://worker.example]
// Optional model call: --rank "<locality>|<PIN>|<way to the door>"
// Only /health and /address/rank. No env files, relay transactions or persisted keys.
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const DEFAULT_URL = "https://pata-server.pata-ggr.workers.dev";
const ROUTE = "/address/rank";
const ORIGINS = ["http://localhost:3000", "https://pata.pata-ggr.workers.dev"];
class SmokeFailure extends Error {}

function expectStatus(response, expected) {
  if (response.status !== expected)
    throw new SmokeFailure(`expected HTTP ${expected}, got ${response.status}`);
}

async function main() {
  const { values } = parseArgs({
    options: { url: { type: "string", default: DEFAULT_URL }, rank: { type: "string" } },
    allowPositionals: false,
  });
  const base = new URL(values.url);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new SmokeFailure("--url must be an HTTP(S) server origin");
  }
  let rankBody;
  if (values.rank !== undefined) {
    const parts = values.rank.split("|");
    const [locality, pinCode, wayToTheDoor] = parts.map((part) => part.trim());
    if (
      parts.length !== 3 ||
      !locality ||
      locality.length > 80 ||
      !/^\d{6}$/.test(pinCode) ||
      !wayToTheDoor ||
      wayToTheDoor.length < 3 ||
      wayToTheDoor.length > 2000
    ) {
      throw new SmokeFailure('--rank requires "<locality>|<6-digit PIN>|<way to the door>"');
    }
    rankBody = JSON.stringify({ locality: { name: locality, pinCode }, wayToTheDoor, landmarkPhrases: [] });
  }
  const account = privateKeyToAccount(generatePrivateKey());
  const request = (route, options = {}, timeout = 15000) => {
    if (!["/health", ROUTE].includes(route)) throw new SmokeFailure("unsafe smoke route");
    return fetch(new URL(route, base), {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
  };
  let failed = false;
  async function check(name, work) {
    try {
      const detail = await work();
      console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
    } catch (failure) {
      failed = true;
      console.log(
        `FAIL ${name}: ${failure instanceof SmokeFailure ? failure.message : "request or response failed"}`,
      );
    }
  }

  await check("health", async () => {
    const response = await request("/health");
    expectStatus(response, 200);
    if ((await response.json()).ok !== true) throw new SmokeFailure("health is not ok");
  });
  for (const origin of ORIGINS) {
    await check(`CORS ${origin}`, async () => {
      const response = await request(ROUTE, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,x-pata-address,x-pata-timestamp,x-pata-signature",
        },
      });
      expectStatus(response, 204);
      if (response.headers.get("access-control-allow-origin") !== origin)
        throw new SmokeFailure("origin not allowed");
    });
  }
  await check("evil origin", async () => {
    expectStatus(
      await request(ROUTE, {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
      }),
      403,
    );
  });
  await check("unsigned POST", async () => {
    expectStatus(
      await request(ROUTE, { method: "POST", body: "{", headers: { "content-type": "application/json" } }),
      401,
    );
  });

  // Wire format from shared/api.ts: unprefixed lowercase SHA-256 hex, EIP-191 signing.
  async function signedHeaders(body) {
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHash("sha256").update(body).digest("hex");
    const signature = await account.signMessage({ message: `pata:v1:${ROUTE}:${timestamp}:${digest}` });
    return {
      "content-type": "application/json",
      "x-pata-address": account.address,
      "x-pata-timestamp": String(timestamp),
      "x-pata-signature": signature,
    };
  }
  let headers;
  await check("signed invalid body", async () => {
    headers = await signedHeaders("{");
    expectStatus(await request(ROUTE, { method: "POST", body: "{", headers }), 400);
  });
  await check("changed body with same signature", async () => {
    if (!headers) throw new SmokeFailure("signature unavailable");
    expectStatus(await request(ROUTE, { method: "POST", body: "{}", headers }), 401);
  });
  if (rankBody !== undefined) {
    await check("rank", async () => {
      const start = performance.now();
      const response = await request(
        ROUTE,
        { method: "POST", body: rankBody, headers: await signedHeaders(rankBody) },
        120000,
      );
      expectStatus(response, 200);
      const data = await response.json();
      if (
        !Array.isArray(data.candidates) ||
        data.candidates.length > 3 ||
        data.candidates.some((candidate) => typeof candidate?.landmark?.name !== "string")
      ) {
        throw new SmokeFailure("invalid candidate response");
      }
      const names = data.candidates.map((candidate) => candidate.landmark.name);
      return `${data.candidates.length} candidates; landmarks=${JSON.stringify(names)}; ${Math.round(performance.now() - start)} ms`;
    });
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch((failure) => {
  console.log(
    `FAIL setup: ${failure instanceof SmokeFailure ? failure.message : "invalid arguments or unable to initialize"}`,
  );
  process.exitCode = 1;
});
