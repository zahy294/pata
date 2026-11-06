import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { MODELS } from "../../../shared/constants";

/** Fractional US cents; route forwards this to the owner's spend counter. */
export type ChargeUsage = (cents: number) => Promise<void>;

export async function structuredAddress<T>(
  apiKey: string,
  schema: z.ZodType<T>,
  model: typeof MODELS.extract | typeof MODELS.rank,
  system: string,
  input: unknown,
  charge?: ChargeUsage,
): Promise<T> {
  const message =
    model === MODELS.extract ? "Address extraction unavailable" : "Landmark ranking unavailable";
  try {
    // One SDK retry (429, 5xx, 529 overloaded, connection errors, with backoff): a ~2-minute Anthropic
    // outage on 2026-11-06 failed setup outright. 45 s per attempt keeps the worst case at the old 90 s.
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000, logLevel: "off" });
    const format = zodOutputFormat(schema);
    // A complete reply can still be unusable (not end_turn, or output failing the schema): about 1 call
    // in 5 on 2026-11-06, which the SDK's HTTP retry doesn't cover. Ask once more; each attempt is charged.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client.messages.parse({
        model,
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
      const usage = response.usage;
      // No prompt caching requested. Conservatively count any cache writes at 2x input
      // and cache reads at full input rate rather than dropping their usage.
      const inputTokens =
        usage.input_tokens +
        2 * (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
      const [inputRate, outputRate] = model === MODELS.extract ? [0.1, 0.5] : [2, 10];
      await charge?.((inputTokens * inputRate + usage.output_tokens * outputRate) / 10_000);
      if (response.stop_reason === "end_turn" && response.parsed_output !== null)
        return response.parsed_output;
    }
    throw new Error();
  } catch {
    // SDK errors can contain provider/request details. Never expose or log them.
    throw new Error(message);
  }
}
