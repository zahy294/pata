// Reads and edits .env.local for the owner scripts without ever printing a value.
import fs from "node:fs";
import path from "node:path";

// PATA_ENV_FILE points the scripts at a test file instead of the real .env.local.
export const ENV_LOCAL = process.env.PATA_ENV_FILE ?? path.resolve(import.meta.dirname, "..", ".env.local");
export const ENV_EXAMPLE = path.resolve(import.meta.dirname, "..", ".env.example");

/** Parses KEY=VALUE lines (tolerates "export ", quotes, spaces, CRLF, a BOM and trailing # comments). */
export function readEnvFile(file = ENV_LOCAL) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    const quoted = value.match(/^(["'])(.*)\1$/);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, "");
    out[m[1]] = value.trim();
  }
  return out;
}

/** .env.example's public defaults (RPC URLs), overridden by any non-empty value in .env.local. */
export function loadEnv() {
  const merged = { ...readEnvFile(ENV_EXAMPLE) };
  for (const [k, v] of Object.entries(readEnvFile())) if (v) merged[k] = v;
  return merged;
}

/**
 * Normalizes a private key to 0x + 64 hex. Throws an Error whose message names the variable and the
 * problem, never the value.
 */
export function toPrivateKey(name, value) {
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    const why = /[^0-9a-fA-F]/.test(hex)
      ? "it contains characters that aren't hex"
      : `it has ${hex.length} hex characters, not 64`;
    throw new Error(`${name} in .env.local isn't a valid private key: ${why}.`);
  }
  return `0x${hex.toLowerCase()}`;
}

/** A short, safe description of an RPC error: no URL (it can carry the Arkiv key), no request body. */
export function safeRpcError(err) {
  return err?.shortMessage ?? err?.name ?? "unknown error";
}

/** Sets or appends KEY=VALUE lines in .env.local, keeping every other line as it was. */
export function writeEnvValues(values, file = ENV_LOCAL) {
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/^﻿/, "") : "";
  const lines = raw ? raw.split(/\r?\n/) : [];
  const done = new Set();
  const next = lines.map((line) => {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=/);
    if (m && m[1] in values) {
      done.add(m[1]);
      return `${m[1]}=${values[m[1]]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(values)) if (!done.has(k)) next.push(`${k}=${v}`);
  fs.writeFileSync(file, next.join("\n").replace(/\n*$/, "\n"));
}
