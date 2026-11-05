// Small response helpers. Never put request bodies, viem errors or keys into a response or a log.
import type { ErrorResponse } from "../../shared/api";

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
