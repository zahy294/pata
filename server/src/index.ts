// Pata's Worker. One router, one guard, one file per route.
// Owner of this file: chain ops (P0-6). Route files are owned per docs/team/*.md.
import { ROUTES } from "../../shared/api";
import type { Env, RouteHandler } from "./env";
import { guard } from "./guard";
import { cors, error, json } from "./http";
import { topup } from "./routes/topup";
import { register } from "./routes/register";
import { addressExtract } from "./routes/address-extract";
import { addressRank } from "./routes/address-rank";
import { addressDirections } from "./routes/address-directions";
import { speechIn } from "./routes/speech-in";
import { speechOut } from "./routes/speech-out";

const routes: Record<string, RouteHandler> = {
  [ROUTES.topup]: topup,
  [ROUTES.register]: register,
  [ROUTES.addressExtract]: addressExtract,
  [ROUTES.addressRank]: addressRank,
  [ROUTES.addressDirections]: addressDirections,
  [ROUTES.speechIn]: speechIn,
  [ROUTES.speechOut]: speechOut,
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const respond = (response: Response) => cors(request, env, response);
    const url = new URL(request.url);
    if (url.pathname === "/health") return respond(json({ ok: true, killSwitch: env.KILL_SWITCH }));

    const handler = routes[url.pathname];
    try {
      const checked = await guard(request, env, (p) => ctx.waitUntil(p));
      if (!checked.ok) return respond(checked.response);
      if (!handler || request.method !== "POST") return respond(error(404, "not_found", "No such route"));
      return respond(await handler(checked.ctx));
    } catch {
      // Deliberately drop the error: it may carry the body, a viem request or a key.
      return respond(error(500, "internal", "Something went wrong"));
    }
  },
} satisfies ExportedHandler<Env>;
