// Reads and edits .env.local for the owner scripts without ever printing a value.
import fs from "node:fs";
import path from "node:path";

export const ENV_LOCAL = path.resolve(import.meta.dirname, "..", ".env.local");
export const ENV_EXAMPLE = path.resolve(import.meta.dirname, "..", ".env.example");

/** Parses KEY=VALUE lines. Values are returned to the caller, never printed by this module. */
export function readEnvFile(file = ENV_LOCAL) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** .env.example's public defaults (RPC URLs), overridden by any non-empty value in .env.local. */
export function loadEnv() {
  const merged = { ...readEnvFile(ENV_EXAMPLE) };
  for (const [k, v] of Object.entries(readEnvFile())) if (v) merged[k] = v;
  return merged;
}

/** Sets or appends KEY=VALUE lines in .env.local, keeping every other line as it was. */
export function writeEnvValues(values, file = ENV_LOCAL) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const done = new Set();
  const next = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in values) {
      done.add(m[1]);
      return `${m[1]}=${values[m[1]]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(values)) if (!done.has(k)) next.push(`${k}=${v}`);
  fs.writeFileSync(file, next.join("\n").replace(/\n*$/, "\n"));
}
