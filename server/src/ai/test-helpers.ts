/** HTTP fixtures only; tests run the real SDK and production adapter code. */
export function modelReply(
  output: unknown,
  options: { stopReason?: string; input?: number; output?: number } = {},
) {
  return Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "test-model",
    content: [{ type: "text", text: JSON.stringify(output) }],
    stop_reason: options.stopReason ?? "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: options.input ?? 1000,
      output_tokens: options.output ?? 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  });
}
