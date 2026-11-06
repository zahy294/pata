import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { MODELS } from "../../../shared/constants";

/** Fractional US cents; route forwards this to the owner's spend counter. */
export type ChargeUsage = (cents: number) => Promise<void>;

type Model = typeof MODELS.extract | typeof MODELS.rank;

/**
 * One line per failed attempt for a live `wrangler tail` (Workers Logs stay off, so nothing is stored).
 * Only the model, HTTP status, Anthropic's error type or the stop reason: never the request, the
 * transcript, the reply or an error message, which can carry request details.
 */
function logFailure(model: Model, failure: unknown, stopReason?: string | null): void {
  if (failure instanceof Anthropic.APIError) {
    const body = failure.error as { error?: { type?: unknown } } | undefined;
    const type = typeof body?.error?.type === "string" ? body.error.type : "unknown";
    console.log(JSON.stringify({ event: "model_call_failed", model, status: failure.status ?? null, type }));
  } else if (stopReason !== undefined) {
    console.log(JSON.stringify({ event: "model_output_unusable", model, stopReason }));
  } else {
    console.log(
      JSON.stringify({ event: "model_call_failed", model, status: null, type: "connection_or_timeout" }),
    );
  }
}

export async function structuredAddress<T>(
  apiKey: string,
  schema: z.ZodType<T>,
  model: Model,
  system: string,
  input: unknown,
  charge?: ChargeUsage,
): Promise<T> {
  const message =
    model === MODELS.extract ? "Address extraction unavailable" : "Landmark ranking unavailable";
  // One SDK retry per attempt (429, 5xx, 529 overloaded, dropped connections, with backoff). On
  // 2026-11-06 about 1 extraction in 4 still failed fast, so a failed or unusable Haiku attempt falls back
  // to Sonnet (~$0.008 an extraction); ranking and directions retry on the same model. Each attempt is
  // charged; a spend-cap refusal stops at once.
  const attempts: Model[] = model === MODELS.extract ? [MODELS.extract, MODELS.rank] : [model, model];
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000, logLevel: "off" });
  const format = zodOutputFormat(schema);
  for (const attemptModel of attempts) {
    let response;
    try {
      response = await client.messages.parse({
        model: attemptModel,
        max_tokens: 2048,
        output_config: {
          effort: "low",
          format: {
            ...format,
            parse(content: string) {
              // Keep usage available on invalid output; validate before returning any result.
              try {
                return format.parse(content);
              } catch {
                return null;
              }
            },
          },
        },
        system,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      });
    } catch (failure) {
      logFailure(attemptModel, failure);
      continue;
    }
    const usage = response.usage;
    // No prompt caching requested. Conservatively count any cache writes at 2x input
    // and cache reads at full input rate rather than dropping their usage.
    const inputTokens =
      usage.input_tokens +
      2 * (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0);
    const [inputRate, outputRate] = attemptModel === MODELS.extract ? [0.1, 0.5] : [2, 10];
    try {
      await charge?.((inputTokens * inputRate + usage.output_tokens * outputRate) / 10_000);
    } catch {
      throw new Error(message);
    }
    if (response.stop_reason === "end_turn" && response.parsed_output !== null) return response.parsed_output;
    logFailure(attemptModel, undefined, response.stop_reason);
  }
  throw new Error(message);
}
