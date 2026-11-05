# Claude API

Checked: 2026-11-03 · Version: `@anthropic-ai/sdk` 1.3.0 (npm `latest`, published 2026-10-23; read with `npm view` and `npm pack`), which sends `anthropic-version: 2026-10-21` (`src/client.ts`, `buildHeaders`). Skill bundle: Claude Code's `claude-api` skill 2.1.314 (model tables cached 2026-10-06), checked against the live docs on 2026-11-03 · Status: test at kick-off
Feeds: idea.md "Why this model and architecture?" and "What happens when AI is wrong?" rows; Build → Stack ("Address AI" row) and "Offline demo kit"; the EF CROPS checklist (the **P** line on the model provider); scope ladder P0 "Typed or spoken description → 3 pins → confirm → DIGIPIN" and P1 "The 50 m check and the accuracy test"; `docs/research/hosting.md` (where the AI endpoint runs).

Paths starting `skill:` are inside `C:\Users\ASUS\AppData\Local\Temp\claude\bundled-skills\2.1.314\54e50ed70be498d3a3c075b1198cc202\claude-api\`. Paths starting `sdk:` are inside the `@anthropic-ai/sdk@1.3.0` tarball (`npm pack`). Live pages were fetched as markdown into `docs/research/sources/claude-api-*.md` (git-ignored). Everything was read on 2026-11-03. Where the skill and a live page disagree, the live page wins and the note says so.

## Install and setup

- `npm install @anthropic-ai/sdk` (skill:`typescript/claude-api/README.md` § Installation). 1.3.0 depends on `standardwebhooks`, `json-schema-to-ts` and `@opentelemetry/api`. `zod` is an optional peer, `^3.25.0 || ^4.0.0`. Licence Apache-2.0 (`npm view @anthropic-ai/sdk`).
- The Zod helpers import `zod/v4` (sdk:`src/helpers/zod.ts` line 2), so schemas must be Zod 4: `zod` 4.x (4.6.7 is current on npm), or the `zod/v4` subpath of 3.25+ (inferred from the import).
- Runtimes: Node.js 20 LTS+, Deno, Bun, Cloudflare Workers, Vercel Edge and Nitro. Browsers only with `dangerouslyAllowBrowser` (sdk:`README.md` § Requirements).
- Client: `new Anthropic()` reads `ANTHROPIC_API_KEY`, which is already in `.env.example`. Passing two credentials throws (sdk:`src/client.ts`, the constructor). Defaults: `timeout` is 10 minutes (in milliseconds in TS) and `maxRetries` is 2, retrying 408/409/429/5xx and connection errors (sdk:`src/client.ts` JSDoc; skill:`SKILL.md` § Client config).
- From 1.0.0 the SDK sends the key as `Authorization: Bearer <key>` (sdk:`src/client.ts` `authHeaders`).
- On API version `2026-10-21`, any `temperature`, `top_p` or `top_k` is a 400 on every model, even at its default value (skill:`shared/api-version-migration.md` § 1).
- **Credits:** "New users receive a small amount of free credits to test the API". Paid credits are bought on the Console's Billing page by credit card ([pricing FAQ](https://platform.claude.com/docs/en/about-claude/pricing.md), `sources/claude-api-pricing.md`). The minimum purchase isn't stated on the pricing or rate-limit pages; see Test at kick-off.

## What Pata uses

Everything goes through one endpoint, `POST /v1/messages`; tools and structured outputs are features of it (skill:`SKILL.md` § Architecture). The calls run on Pata's small server (see "Where the key lives" under Gotchas). idea.md fixes the pipeline: Haiku 5.5 extracts, a larger model ranks and writes relations, plain code places the pins. Below are the facts and options for each step; the model choice is the team's.

### The three candidate models

| | Claude Haiku 5.5 | Claude Sonnet 5.5 | Claude Opus 5.5 |
|---|---|---|---|
| Model ID (no date suffix) | `claude-haiku-5-5` | `claude-sonnet-5-5` | `claude-opus-5-5` |
| Context / max output | 1M / 128K | 1M / 128K | 1M / 128K |
| Input / output, $ per million tokens | $0.10 / $0.50 for prompts ≤ 100K tokens; $0.50 / $2.50 above | $2 / $10 | $4 / $20 |
| Cache hit; batch (50% off) | $0.01; $0.05 / $0.25 | **$0.10**; $1 / $5 | $0.20; $2 / $10 |
| Comparative latency (live table) | Fastest | Fast | Moderate |
| Thinking | Adaptive, **on by default**. `{type: "disabled"}` is accepted only at effort `low`, `medium` or `high` (400 at `xhigh` or `max`) | Adaptive, on by default. `{type: "disabled"}` is a **400**. The lowest setting is `{type: "between_tools"}`, allowed only at effort `high` or below and with no other field | **Always on**: `disabled` and `budget_tokens` are 400 at every effort. Effort is the only control |
| `effort` default | `medium` | `high` (levels recalibrated) | `medium` |
| Forced `tool_choice` (`any`, `tool`) | **Accepted** (the reply then opens with the tool call, with no thinking block) | **400** | **400** |
| Tool-use system prompt the API adds | 286 tokens (`auto`/`none`); 406 tokens (`any`/`tool`) | 286 | 286 |
| Server-side `fallbacks` on a refusal | **None**: `"default"` leaves the refusal in place, and an array is a 400 | `"default"` only, Claude API only; retries `cyber` and `frontier_llm` declines only | `"default"` or an array |
| Refusal categories | `cyber`, `bio`, `frontier_llm`, `general_harms` | Those four plus `reasoning_extraction` | `cyber`, `bio`, `reasoning_extraction` (the category set is open) |
| Retirement not before | 2027-10-07 | 2027-09-28 | 2027-09-22 |

Sources: [models overview](https://platform.claude.com/docs/en/about-claude/models/overview.md) (IDs, prices, latency, default effort, thinking and retirement rows; `sources/claude-api-models-overview.md`); [pricing](https://platform.claude.com/docs/en/about-claude/pricing.md) (cache, batch, the Haiku split at 100K, the tool-use system-prompt table; `sources/claude-api-pricing.md`); skill:`shared/model-migration.md` § Migrating to Claude Haiku 5.5, § Migrating to Claude Sonnet 5.5 and § Migrating to Claude Opus 5.5 (thinking, `tool_choice`, fallbacks and safeguards). The SDK types confirm the effort enum `'low' | 'medium' | 'high' | 'xhigh' | 'max'` (sdk:`src/resources/messages/messages.ts` `OutputConfig`) and the thinking union `enabled | disabled | between_tools | adaptive` (`ThinkingConfigParam`). **Discrepancy:** the skill (skill:`shared/models.md`) gives Sonnet 5.5's cache read as $0.20, while the live pricing page gives $0.10 (0.05× of $2); the live figure is used here.

None of the three accepts assistant prefill (400), `budget_tokens` (400) or sampling parameters (400 on `2026-10-21`). Thinking text comes back empty by default (`display: "omitted"`); `display: "summarized"` returns a summary. Thinking is billed as output either way (skill:`SKILL.md` § Thinking display).

### Rough cost per address (inferred; measure at kick-off)

The token counts below are assumptions, not measurements. Prices are from the live pricing page.

- **Step 1, extraction on Haiku 5.5:** about 1,000 input tokens (a 600-token system prompt, a 150-token transcript and the schema) and about 600 output tokens (short thinking at `low` effort plus about 150 tokens of JSON). That's 1,000 × $0.10/M = $0.0001, plus 600 × $0.50/M = $0.0003, so **≈ $0.0004**.
- **Step 2, the ranking tool loop:** assume 4 requests. Each carries about 1,500 fixed tokens (system prompt, the 286-token tool prompt, two tool definitions and the output schema), and Overpass results add about 1,500 tokens per lookup to the history: 4 × 1,500 + (0 + 1,500 + 3,000 + 4,500) = 15,000 input tokens. Output is about 3,000 tokens (thinking, tool calls and the final JSON) at `medium`.
  - Sonnet 5.5: 15,000 × $2/M = $0.030, plus 3,000 × $10/M = $0.030, so **≈ $0.06**.
  - Opus 5.5: $0.060 + $0.060, so **≈ $0.12**.
  - Haiku 5.5: $0.0015 + $0.0015, so ≈ $0.003.
- **Step 3, directions in 3 languages:** about 2,000 input and 1,500 output tokens. That's ≈ $0.019 on Sonnet 5.5, ≈ $0.038 on Opus 5.5 and ≈ $0.001 on Haiku 5.5.
- **Totals per address**, with Haiku extracting: ≈ $0.08 with Sonnet 5.5 for steps 2 and 3, ≈ $0.16 with Opus 5.5, ≈ $0.004 with Haiku throughout. Per 100 addresses: about $8, $16 and $0.40. Three runs of the 20-address accuracy test (60 addresses) come to about $4.80 on Sonnet or $9.60 on Opus. Caching the fixed prefix would lower step 2; this estimate ignores caching.

### Step 1: extract the address parts (idea.md: Haiku 5.5)

- One call with no tools: `client.messages.parse({ model: "claude-haiku-5-5", max_tokens, output_config: { effort: "low", format: zodOutputFormat(AddressParts) }, system, messages })`, then read `response.parsed_output` (skill:`typescript/claude-api/tool-use.md` § Structured Outputs; sdk:`src/resources/messages/messages.ts`, `parse()` JSDoc). `zodOutputFormat` comes from `@anthropic-ai/sdk/helpers/zod`.
- Effort guidance for Haiku 5.5 from the skill: `low` for simple, high-volume requests, `medium` by default, `high` for strict instruction following. Lowering effort cuts thinking; in Anthropic's testing, telling the model to "answer directly" did not (skill:`shared/model-migration.md` § Haiku 5.5 → Choosing an effort level).
- `max_tokens` must leave room for thinking. A cap sized for the JSON alone can end with `stop_reason: "max_tokens"` after a thinking block and before any text (same file, § Thinking is on by default).
- Only the spoken transcript goes in. The typed room number never enters `messages` (CLAUDE.md invariant).
- Send the transcript in Devanagari rather than transliterated: "Submit text in its native script rather than transliteration for optimal results" ([multilingual](https://platform.claude.com/docs/en/build-with-claude/multilingual-support.md) § Best practices). This affects which speech-to-text output format to ask for (see `speech.md`).

### Step 2: rank landmarks and write relations (idea.md: "a larger Claude model")

- A tool loop over two client tools, Nominatim search and Overpass lookup, which run on Pata's server. There are two ways to drive it:
  - **Tool runner** (beta; the skill's recommendation): define each tool with `betaZodTool({ name, description, inputSchema, run })` from `@anthropic-ai/sdk/helpers/beta/zod`, or with `betaTool()` from `@anthropic-ai/sdk/helpers/beta/json-schema` for raw JSON Schema. Then call `await client.beta.messages.toolRunner({ model, max_tokens, tools, messages, max_iterations })` (skill:`typescript/claude-api/tool-use.md` § Tool Runner; sdk:`src/lib/tools/BetaToolRunner.ts` `BetaToolRunnerSettings`). `betaZodTool` checks the model's input with Zod before calling `run`; `betaTool()` does not (skill:`shared/tool-use-concepts.md` § Eager input streaming).
  - **Manual loop:** call `client.messages.create` until `stop_reason` is no longer `tool_use`, appending the full `response.content` each turn (skill:`typescript/claude-api/tool-use.md` § Manual Agentic Loop).
- Tool definition fields in 1.3.0: `name`, `description`, `input_schema`, `strict`, `input_examples`, `cache_control`, `defer_loading`, `eager_input_streaming` and `allowed_callers` (sdk:`messages.ts` `interface Tool`).
- `strict: true` goes on the tool definition, not on `tool_choice`. Its schema needs `additionalProperties: false` and `required`, and it guarantees that `tool_use.input` matches the schema (skill:`SKILL.md` § Tool Use Patterns). At most 20 strict tools per request ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md) § Schema complexity limits).
- **Parallel tool calls** are on by default: one reply can hold several `tool_use` blocks, and all of their `tool_result` blocks go back in a single user message. `disable_parallel_tool_use: true` on `tool_choice` limits the reply to one call (skill:`SKILL.md` § Tool Use Patterns; skill:`shared/tool-use-concepts.md` § Tool Choice Options). The tool runner runs a turn's function tools concurrently with `Promise.all` (sdk:`src/lib/tools/BetaToolRunner.ts`, `generateToolResponse`).
- **`tool_choice`:** Sonnet 5.5 and Opus 5.5 reject `any` and `tool` with a 400 (`tool_choice: type "tool" and "any" are not supported for this model.`), on `count_tokens` and Batches too; `auto` and `none` work. The skill's replacement is `auto`, the tool named in the prompt, `strict: true`, and a check that a `tool_use` block came back (skill:`shared/model-migration.md` § Opus 5.5 → Breaking change 2; § Sonnet 5.5 → Breaking change 2). Haiku 5.5 accepts forced calls (same file, § Haiku 5.5, "Forced tool calls skip thinking").
- **The final answer** (ranked landmarks plus relations such as `opposite`, `behind` or `third lane after`) can come back as structured output on the last turn, since `output_config.format` works alongside tools ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md) § Using both features together). On Haiku 5.5 with thinking **off**, a request that has both a JSON output format and tools may skip a tool call it needs, so keep thinking on (skill:`shared/model-migration.md` § Haiku 5.5 → Behavioral shifts).
- Effort starting points from the skill: on Sonnet 5.5, `medium` for multistep tool use and `low` for extraction; on Opus 5.5, start at `medium` (skill:`shared/model-migration.md`, the "Choosing an effort level" section for each model).
- Clamp every tool input to the locality's bounding box inside the tool's `run`, so code enforces the box rather than the model (inferred; this matches the invariant that the model only proposes candidates).

### Step 3: directions in several languages (idea.md: "written once at setup")

- One call per household after the pin is confirmed, returning structured JSON with one string per language. State the target languages in the system prompt; the docs call that "the most reliable place" to set the response language ([multilingual](https://platform.claude.com/docs/en/build-with-claude/multilingual-support.md) § Set the response language).

### Optional: the gate photo (idea.md's fallback)

- Image blocks are `{ type: "image", source: { type: "base64", media_type, data } }` or `{ type: "url", url }` (skill:`typescript/claude-api/README.md` § Vision).
- Formats are JPEG, PNG, GIF and WebP; for an animation, only the first frame is used. Limits: 10 MB per image (base64-encoded) on the Claude API, 8000×8000 px, and 128 MB per request. The 4.7-and-later models (all three here) take a 2,576 px long edge (4,784 visual tokens), and anything larger is downscaled. Cost is `⌈w/28⌉ × ⌈h/28⌉` tokens, so a 1000×1000 photo is 1,296 tokens, about $0.0001 on Haiku 5.5 ([vision](https://platform.claude.com/docs/en/build-with-claude/vision.md) § Image limits and costs; `sources/claude-api-vision.md`). The skill's 32 MB figure (skill:`SKILL.md` § Document & File Input) is older than the live 128 MB.

### Structured outputs in detail

- Wire shape: `output_config: { format: { type: "json_schema", schema } }` on `messages.create()`. The older `output_format` parameter is deprecated (skill:`SKILL.md` § Architecture).
- TypeScript helpers, exact names:
  - `client.messages.parse(params)` runs `create()` and then parses, adding `parsed_output` (sdk:`messages.ts` line 151).
  - `zodOutputFormat(schema)` from `@anthropic-ai/sdk/helpers/zod`, and `betaZodOutputFormat` for `client.beta.messages` (sdk:`src/helpers/zod.ts`, `src/helpers/beta/zod.ts`).
  - `jsonSchemaOutputFormat(schema, { transform?: boolean })` from `@anthropic-ai/sdk/helpers/json-schema`, typed through `json-schema-to-ts` (sdk:`src/helpers/json-schema.ts`).
  - `client.messages.stream(...)` with the same `output_config` puts `parsed_output` on `await stream.finalMessage()`.
- On failure, `parse()` **throws** `AnthropicError("Failed to parse structured output: …")` when the text isn't valid JSON or fails Zod validation. `parsed_output` is `null` when the reply has no text block, as with a refusal before any output (sdk:`src/lib/parser.ts`).
- Supported: object, array, string, integer, number, boolean and null; `enum`, `const`, `anyOf`, `allOf` and `$ref`/`$defs`; the string formats `date-time`, `time`, `date`, `duration`, `email`, `hostname`, `uri`, `ipv4`, `ipv6` and `uuid`; and `additionalProperties: false`, which every object requires.
- Not supported: recursive schemas, `minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength`, complex array constraints, and any `additionalProperties` other than `false` (skill:`shared/tool-use-concepts.md` § JSON Schema Limitations).
- Complexity limits, summed across all strict schemas in a request: 20 strict tools, 24 optional parameters and 16 union-typed parameters. Past those comes the 400 "Schema is too complex for compilation", and grammar compilation times out at 180 s ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md) § Schema complexity limits).
- Incompatible with citations (a 400) and with prefill. Works with Batches, streaming, token counting and thinking. A new schema pays a one-time compile, then sits in a cache for 24 hours (skill:`shared/tool-use-concepts.md` § Important Notes; live page § Grammar compilation and caching).
- The cached grammar holds the schema itself, including `enum` and `const` values, for up to 24 hours after last use ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md) § Data handling). Never put address data in a schema; schemas hold only field names and fixed relation words.

## Limits

- **Rate limits:** each model has its own row. In the Start tier, Haiku 5.5, Sonnet 5.5 and Opus 5.5 each get 4,000 RPM, 2,000,000 input tokens per minute and 400,000 output tokens per minute. Build gives 10,000 / 5M / 1M, and Scale 13,000 / 10M / 2M. "New organizations … may start in the Evaluation tier, with limits below the standard limits", and the docs give no figures for that tier. Cached reads don't count toward the input-token limit. The monthly spend cap is $500 in Start and $1,000 in Build; at the cap the API returns a 429 with `error_code: "enforced_spend_limit_reached"` and no `retry-after`. You can set a lower spend limit of your own on the Billing page ([rate limits](https://platform.claude.com/docs/en/api/rate-limits.md); `sources/claude-api-rate-limits.md`). Pata's load is a handful of requests a minute, far below even an Evaluation-tier limit (inferred).
- **Latency:** the docs give only relative ranks (Haiku fastest, Sonnet fast, Opus moderate) and say "actual latency depends on prompt length, output length, and thinking effort" ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview.md)). Thinking is on by default on all three and adds to time to first token; at `low` effort, Sonnet 5.5 and Haiku 5.5 skip thinking on most simple requests (skill:`shared/model-migration.md`, the "Choosing an effort level" section for each model). A new schema's first request pays the compile. Priority Tier isn't offered on Opus 5.5 or Sonnet 5.5 (skill:`SKILL.md` § Fast Mode). There are no seconds-per-request figures; measure at kick-off.
- **`refusal`:** a safety-classifier decline returns HTTP 200 with `stop_reason: "refusal"` and `stop_details: { type: "refusal", category, explanation }`. The category is `cyber | bio | frontier_llm | reasoning_extraction | general_harms | null` (sdk:`messages.ts` `RefusalStopDetails`). Content can be empty (declined before output) or partial (declined mid-stream). A refusal before any output still counts against rate limits, and whether it is billed depends on the category (skill:`shared/model-migration.md` § `refusal` stop reason; § Sonnet 5.5 → Safeguards). The full stop-reason set in 1.3.0 is `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal` and `model_context_window_exceeded` (sdk:`messages.ts` `StopReason`).
- **Server-side fallbacks** (beta): `client.beta.messages.create({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", … })` reruns a declined request on Anthropic's recommended model for that category. The array form `fallbacks: [{ model }]` takes the header `server-side-fallback-2026-06-01` instead, and pairing either header with the other form is a 400. Fallbacks trigger on policy declines only, never on rate limits or overloads. The Batches API rejects them, and the fallback model runs without the first model's thinking blocks (skill:`shared/model-migration.md` § Migrating to Claude Opus 5 → New API features; § `refusal` stop reason, pattern 1). Which models support which form is in the table above.
- **Multilingual:** the docs' only language table covers Claude Sonnet 4.5 and Haiku 4.5, scored as a percentage of English on translated MMLU with extended thinking. **Hindi is 96.7% (Sonnet 4.5) and 92.4% (Haiku 4.5). Marathi is not listed.** The table has no figures for the 5.5 models. The page says "Claude is capable in many languages beyond those benchmarked … Test with any languages relevant to your specific use cases", and lists every current model, the three 5.5 models included, as supported ([multilingual](https://platform.claude.com/docs/en/build-with-claude/multilingual-support.md) § Performance data; `sources/claude-api-multilingual.md`).
- **Privacy, for the CROPS section:**
  - **Training:** "Retained data is never used for model training without your express permission" ([API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), `sources/claude-api-zdr.md` line 15). Anthropic's privacy center adds that, on commercial products, data can be used for training if you send feedback (thumbs up or down) or otherwise opt in ([Is my data used for model training?](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training), updated 2026-08-18).
  - **Retention, two first-party statements:** (a) "For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days of receipt or generation", with exceptions for a longer-retention service under your control, enforcement of the Usage Policy, and the law. Flagged requests are kept "for up to 2 years", and trust-and-safety scores "for up to 7 years" ([How long do you store my organization's data?](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), `sources/claude-api-privacy-commercial-retention.html`). (b) The platform docs say "Conversation content (your prompts and Claude's outputs) is not retained by default; the exception is Covered Models", the Fable and Mythos models, which require 30 days (same API and data retention page, line 16). The two read differently. The CROPS README should quote (a), the stricter one, as the upper bound.
  - **ZDR:** zero data retention is per organization, and you request it from Anthropic's sales team. Under ZDR, "Anthropic does not store customer prompts or responses at rest after the API response is returned". Structured outputs and strict tools are eligible, with only the schema cached for 24 hours (same page, lines 23–27; [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md) § Data handling). Haiku 5.5, Sonnet 5.5 and Opus 5.5 are not Covered Models, so ZDR is open to them. A new hackathon account would be on standard retention (inferred).
  - **`inference_geo`:** a top-level Messages parameter, `client.messages.create({ …, inference_geo: "us" })`, which reports back in `response.usage.inference_geo` (skill:`SKILL.md` § Common Pitfalls; sdk:`messages.ts`). The documented values are `"us"` and `"global"`, the default. `"us"` costs 1.1× on every token category ([pricing](https://platform.claude.com/docs/en/about-claude/pricing.md) § Data residency pricing), and both values share one rate-limit pool. There is no India option.

## Gotchas

- **Where the key lives.** The SDK refuses to run in a browser. The constructor throws "It looks like you're running in a browser-like environment … it risks exposing your secret API credentials to attackers" unless `dangerouslyAllowBrowser: true` is set (sdk:`src/client.ts` ~line 964). With that flag it adds the header `anthropic-dangerous-direct-browser-access: true` (sdk:`src/client.ts` `buildHeaders`) and sends the key as `Authorization: Bearer <key>` from the page, so anyone with devtools, or anyone reading the static bundle on IPFS, gets the key (inferred). So the key stays in `.env.local` on Pata's small server, which proxies the calls; CLAUDE.md's Stack line already says this. Set a low spend limit on the Billing page as a backstop.
- **Read blocks by `type`.** A reply can open with `thinking` blocks, whose text is empty by default, so `content[0].text` breaks (skill:`shared/model-migration.md` § Haiku 5.5 → Thinking is on by default).
- **Thinking counts toward `max_tokens`** and is billed as output even when hidden. `usage.output_tokens_details.thinking_tokens` reports it (sdk:`messages.ts` `OutputTokensDetails`).
- **Zod enums may not be enforced by the API.** The SDK's `transformJSONSchema`, applied by `zodOutputFormat` and by default by `jsonSchemaOutputFormat`, keeps only `type`, `properties`, `required`, `items`, `anyOf`/`oneOf`/`allOf`, `$ref`/`$defs`, `description`, `title`, the supported formats, and `minItems` of 0 or 1. Every other keyword moves into the description text as `{key: value}` (sdk:`src/lib/transform-json-schema.ts`, identical on GitHub `main`; the docs describe this for `minimum` and `maxLength` in [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md) § How SDK transformation works). The transform has no case for `enum` or `const`, so a `z.enum([...])` reaches the API as a hint rather than a constraint, and only the SDK's client-side Zod check catches a wrong value, by throwing (inferred from the source). If the relation types must be enforced by the grammar, send a hand-written schema with `jsonSchemaOutputFormat(schema, { transform: false })` or a raw `output_config.format`.
- **`betaZodTool` does not transform its schema:** it calls `z.toJSONSchema` directly (sdk:`src/helpers/beta/zod.ts`). With `strict: true`, an unsupported keyword or a missing `additionalProperties: false` may then be rejected (inferred).
- **No `temperature: 0`.** Sampling parameters are 400s on `2026-10-21`, so consistency has to come from the schema, the prompt and plain code.
- **Keep the tool loop's history append-only.** Accounts created on or after 2026-08-31, which includes Pata's, get a 400 when a replayed thinking block follows any edit to `system`, `tools` or earlier messages. Pass thinking blocks back unchanged (skill:`shared/model-migration.md` § Opus 5.5 → Breaking change 3; § Haiku 5.5 → Breaking change 5).
- **`between_tools` works only on Sonnet 5.5**, and any other model returns a 400 on it, so a retry on another model must drop it. **Haiku 5.5 at `xhigh`** sometimes ends a multi-turn reply with no visible text (skill:`shared/model-migration.md`, the Sonnet 5.5 and Haiku 5.5 sections).
- **Gate photo privacy.** A photo of the gate shows the model provider the exact door, which goes beyond the CLAUDE.md invariant "The model and map search receive only the spoken way to the door". A phone photo can also carry GPS EXIF data, so strip EXIF before sending it (inferred).

## Values to copy

| Name | Value | Source |
|---|---|---|
| npm package | `@anthropic-ai/sdk@1.3.0` | `npm view`, 2026-11-03 |
| API version header (sent by the SDK) | `anthropic-version: 2026-10-21` | sdk:`src/client.ts` |
| Env var | `ANTHROPIC_API_KEY` (server only) | `.env.example`; sdk:`src/client.ts` |
| Model IDs | `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5` | models overview (live) |
| Prices in/out per MTok | Haiku 5.5 $0.10/$0.50 (≤100K prompt); Sonnet 5.5 $2/$10; Opus 5.5 $4/$20 | pricing (live) |
| Zod output helper | `import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"` | skill:`typescript/claude-api/tool-use.md` |
| Raw-schema output helper | `import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema"` | sdk:`src/helpers/json-schema.ts` |
| Zod tool helper | `import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod"` | skill:`typescript/claude-api/tool-use.md` |
| Tool runner | `client.beta.messages.toolRunner({ …, max_iterations })` | sdk:`src/lib/tools/BetaToolRunner.ts` |
| Effort | `output_config: { effort: "low" \| "medium" \| "high" \| "xhigh" \| "max" }` | sdk:`messages.ts` `OutputConfig` |
| Fallback beta (default form) | `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"` (not on Haiku 5.5) | skill:`shared/model-migration.md` |
| Image types and limits | jpeg/png/gif/webp; 10 MB each; 8000×8000 px; long edge 2,576 px before downscaling | vision (live) |
| Start-tier limits, per model | 4,000 RPM; 2M ITPM; 400K OTPM; $500/month cap | rate limits (live) |
| Strict-schema limits | 20 strict tools, 24 optional params, 16 union params per request | structured outputs (live) |
| Browser opt-in header (don't use) | `anthropic-dangerous-direct-browser-access: true` | sdk:`src/client.ts` |

## Contradictions with idea.md

- **Offline demo kit.** idea.md, Build → Stack, says: "only the Sepolia and Arkiv calls need the network". The address AI calls `https://api.anthropic.com` (sdk:`src/client.ts`, the constructor's default `baseURL`), so moment 1 ("speak once") needs the network too, unless the demo uses the pre-built household or a recorded response. idea.md's own "What still worries us" list does name "the model and speech APIs".
- **CROPS P line.** idea.md says: "The model provider and OpenStreetMap's search see the spoken address and its locality once, at setup." Anthropic's privacy center says API "inputs and outputs" are deleted "within 30 days of receipt or generation", and kept "up to 2 years" if flagged ([privacy center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)). So the provider may store the spoken description for up to 30 days, not just see it once. The README should say so, or the team should request ZDR. (The platform docs' "not retained by default" line conflicts with the privacy center; see Limits → Privacy.)
- **Gate photo vs the invariant.** idea.md says: "if the geocoder and the model disagree by more than 50 m, the app asks for a dropped pin or a photo of the gate". Sending the photo to Claude conflicts with CLAUDE.md's "The model and map search receive only the spoken way to the door". This is a conflict between two project documents rather than with a source; the vision docs only confirm that a photo would be accepted.

## Test at kick-off

- [ ] Buy credits, or use the free starting credits. Record the minimum purchase, the account's tier (Evaluation or Start) and its per-model limits from the Console, and set a low spend limit.
- [ ] Log `zodOutputFormat(schema).schema` for the relation schema and check whether `enum` survives. If it doesn't, switch to `jsonSchemaOutputFormat(schema, { transform: false })`.
- [ ] Send one strict tool built with `betaZodTool` and confirm its schema isn't rejected (watch for `additionalProperties`).
- [ ] Measure per-address tokens (`usage.input_tokens`, `output_tokens`, `output_tokens_details.thinking_tokens`) and wall-clock latency for each step at `low` and `medium` effort, and replace the cost estimate above with the measured numbers.
- [ ] Confirm the ranking model (Sonnet 5.5 or Opus 5.5) returns a 400 on `tool_choice: {type: "tool"}`, and that `auto` plus a prompt plus `strict` gets the tool called.
- [ ] Run five Hindi and five Marathi descriptions (Devanagari) through steps 1 and 3, and have a native speaker check the output. The docs publish no Marathi figure.
- [ ] Make one request with `inference_geo` unset and record `usage.inference_geo`.
- [ ] Decide whether to ask Anthropic for ZDR, or to state the 30-day retention in the README's CROPS section.
