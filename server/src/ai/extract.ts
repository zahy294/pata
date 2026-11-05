// Haiku 5.5 extraction. Owner: AI/ML (P0-7). Read docs/research/claude-api.md first.
// client.messages.parse({ model: MODELS.extract, output_config: { effort: "low", format: zodOutputFormat(...) } })
import type { ExtractRequest, ExtractResponse } from "../../../shared/api";

export async function extractAddressParts(
  apiKey: string,
  req: ExtractRequest,
): Promise<ExtractResponse> {
  void apiKey;
  void req;
  throw new Error("extractAddressParts: not implemented (P0-7)");
}
