import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyMessage } from "viem";

const script = fileURLToPath(new URL("./smoke-worker.mjs", import.meta.url));
function run(args) {
  return new Promise((resolve) =>
    execFile(process.execPath, [script, ...args], { timeout: 20000 }, (error, stdout, stderr) =>
      resolve({ code: error?.code ?? 0, stdout, stderr }),
    ),
  );
}

async function worker(work, options = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push({ path: request.url, method: request.method, headers: request.headers, body });
      if (request.url === "/health") {
        response.writeHead(options.healthStatus ?? 200, {
          "content-type": "application/json",
          ...(options.redirect ? { location: "/topup" } : {}),
        });
        response.end(JSON.stringify({ ok: true, detail: "PRIVATE_UPSTREAM_BODY" }));
        return;
      }
      assert.equal(request.url, "/address/rank");
      if (request.method === "OPTIONS") {
        const allowed = ["http://localhost:3000", "https://pata.pata-ggr.workers.dev"].includes(
          request.headers.origin,
        );
        response.writeHead(
          allowed ? 204 : 403,
          allowed ? { "access-control-allow-origin": options.badCors ? "*" : request.headers.origin } : {},
        );
        response.end();
        return;
      }
      const signature = request.headers["x-pata-signature"];
      const timestamp = Number(request.headers["x-pata-timestamp"]);
      const valid =
        signature &&
        Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= 120 &&
        (await verifyMessage({
          address: request.headers["x-pata-address"],
          signature,
          message: `pata:v1:/address/rank:${timestamp}:${createHash("sha256").update(body).digest("hex")}`,
        }));
      if (valid && options.rank) {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          /* Deliberately invalid smoke bodies. */
        }
        if (parsed?.locality && parsed.wayToTheDoor && Array.isArray(parsed.landmarkPhrases)) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify(options.rank));
          return;
        }
      }
      response.writeHead(valid ? (options.signedStatus ?? 400) : 401);
      response.end();
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await work(`http://127.0.0.1:${server.address().port}`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("default checks verify authentication/CORS with no valid model request or relay route", async () => {
  await worker(async (url, requests) => {
    const result = await run(["--url", url]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, 7);
    assert.ok(lines.every((line) => line.startsWith("PASS ")));
    assert.equal(requests.length, 7);
    const posts = requests.filter((request) => request.method === "POST");
    assert.deepEqual(
      posts.map((request) => request.body),
      ["{", "{", "{}"],
    );
    assert.equal(posts[1].headers["x-pata-signature"], posts[2].headers["x-pata-signature"]);
    assert.notEqual(posts[1].body, posts[2].body);
    assert.ok(requests.every((request) => ["/health", "/address/rank"].includes(request.path)));
    assert.ok(!result.stdout.includes(posts[1].headers["x-pata-signature"]));
  });
});

test("501 passes signature acceptance with a note that rank is not deployed", async () => {
  await worker(
    async (url) => {
      const result = await run(["--url", url]);
      assert.equal(result.code, 0, result.stdout + result.stderr);
      const lines = result.stdout.trim().split("\n");
      assert.equal(lines.length, 7);
      assert.ok(lines.every((line) => line.startsWith("PASS ")));
      assert.equal(lines[5], "PASS signed invalid body: signature accepted; /address/rank not deployed yet");
    },
    { signedStatus: 501 },
  );
});

test("other signed-invalid-body statuses still fail, including auth and shutdown errors", async () => {
  for (const status of [200, 401, 403, 503]) {
    await worker(
      async (url) => {
        const result = await run(["--url", url]);
        assert.equal(result.code, 1);
        const lines = result.stdout.trim().split("\n");
        assert.equal(lines.length, 7);
        assert.equal(lines[5], `FAIL signed invalid body: expected HTTP 400, got ${status}`);
      },
      { signedStatus: status },
    );
  }
});

test("rank is opt-in, signed, and prints only candidate count, landmark names and timing", async () => {
  await worker(
    async (url, requests) => {
      const result = await run(["--url", url, "--rank", "Dharavi|400017|Walk past the school"]);
      assert.equal(result.code, 0, result.stdout + result.stderr);
      const lines = result.stdout.trim().split("\n");
      assert.equal(lines.length, 8);
      assert.match(lines[7], /^PASS rank: 2 candidates; landmarks=\["School","Temple"\]; \d+ ms$/);
      assert.equal(requests.length, 8);
      assert.deepEqual(JSON.parse(requests[7].body), {
        locality: { name: "Dharavi", pinCode: "400017" },
        wayToTheDoor: "Walk past the school",
        landmarkPhrases: [],
      });
      assert.ok(!result.stdout.includes("Walk past the school"));
    },
    { rank: { candidates: [{ landmark: { name: "School" } }, { landmark: { name: "Temple" } }] } },
  );
});

test("a failed check exits nonzero, reports every other check and hides upstream details", async () => {
  await worker(
    async (url) => {
      const result = await run(["--url", url]);
      assert.equal(result.code, 1);
      const lines = result.stdout.trim().split("\n");
      assert.equal(lines.length, 7);
      assert.match(lines[0], /^FAIL health: expected HTTP 200, got 503$/);
      assert.equal(lines.filter((line) => line.startsWith("PASS ")).length, 6);
      assert.ok(!result.stdout.includes("PRIVATE_UPSTREAM_BODY"));
      assert.equal(result.stderr, "");
    },
    { healthStatus: 503 },
  );
});

test("CORS requires the exact requested origin", async () => {
  await worker(
    async (url) => {
      const result = await run(["--url", url]);
      assert.equal(result.code, 1);
      assert.equal(result.stdout.split("\n").filter((line) => line.startsWith("FAIL CORS ")).length, 2);
    },
    { badCors: true },
  );
});

test("redirects cannot send smoke requests to a relay route", async () => {
  await worker(
    async (url, requests) => {
      const result = await run(["--url", url]);
      assert.equal(result.code, 1);
      assert.match(result.stdout, /^FAIL health:/);
      assert.equal(requests.length, 7);
      assert.ok(requests.every((request) => ["/health", "/address/rank"].includes(request.path)));
    },
    { healthStatus: 302, redirect: true },
  );
});

test("invalid flags, server URLs and rank input fail before any HTTP request", async () => {
  await worker(async (url, requests) => {
    for (const args of [
      ["--url", `${url}/register`],
      ["--url", "file:///private"],
      ["--url", url, "--rank", "Dharavi|BAD_PIN|PRIVATE_WAY"],
      ["--url", url, "--rank"],
      ["--url", url, "--unknown"],
    ]) {
      const result = await run(args);
      assert.equal(result.code, 1);
      assert.match(result.stdout, /^FAIL setup:/);
      assert.equal(result.stdout.trim().split("\n").length, 1);
      assert.ok(!result.stdout.includes("PRIVATE_WAY"));
      assert.equal(result.stderr, "");
    }
    assert.equal(requests.length, 0);
  });
});

test("invalid rank replies fail without dumping the response", async () => {
  await worker(
    async (url) => {
      const result = await run(["--url", url, "--rank", "Dharavi|400017|Walk past the school"]);
      assert.equal(result.code, 1);
      assert.match(result.stdout, /FAIL rank: invalid candidate response/);
      assert.ok(!result.stdout.includes("PRIVATE_UPSTREAM_BODY"));
    },
    { rank: { candidates: "PRIVATE_UPSTREAM_BODY" } },
  );
});
