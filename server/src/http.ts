// Small response helpers. Never put request bodies, viem errors or keys into a response or a log.
import type { ErrorResponse } from "../../shared/api";
import { SIGNATURE_HEADERS } from "../../shared/api";
import type { Env } from "./env";

export function allowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  return (
    !origin ||
    env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .includes(origin)
  );
}

export function cors(request: Request, env: Env, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append("vary", "Origin");
  const origin = request.headers.get("origin");
  if (origin && allowedOrigin(request, env)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set(
      "access-control-allow-headers",
      ["content-type", ...Object.values(SIGNATURE_HEADERS)].join(", "),
    );
  }
  return new Response(response.body, { status: response.status, headers });
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function error(status: number, code: string, message: string): Response {
  const body: ErrorResponse = { error: message, code };
  return json(body, status);
}

export function notImplemented(route: string): Response {
  return error(501, "not_implemented", `${route} is not built yet`);
}
