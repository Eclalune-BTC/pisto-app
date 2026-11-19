# ADR 0024: DeepSeek reads sentences on the hosted demo

- Status: Accepted (owner decision on 2026-11-19: use the paid DeepSeek account instead of the free
  Workers AI allocation)
- Date: 2026-11-19
- Owners: `@pisto/assistant`, `@pisto/api`
- Amends: the provider choice of [ADR 0021](0021-workers-ai-registration-assistant.md) for
  extraction; extends [ADR 0022](0022-contextual-catalog-questions.md)
- Recheck when the DeepSeek model alias, its JSON mode or its data policy changes, when the
  evaluation set changes, or when a speech provider other than Workers AI is proposed.

## Context

The account's Workers AI plan gives 10,000 neurons a day, shared by the hosted demo, `wrangler dev`
and the evaluation runs. On 2026-11-19 an evaluation and a capture session spent it, and every
sentence sent to Coco on the hosted demo failed until the daily reset. Extraction with a 70B model
is what spends that budget; a transcription costs little. The owner already pays for DeepSeek, whose
key is a Worker secret since ADR 0022.

## Decision

1. `ASSISTANT_EXTRACTION_PROVIDER` selects who reads a sentence: `workers-ai` (the default) or
   `deepseek`, which requires `DEEPSEEK_API_KEY` and fails at startup without it. The hosted Worker
   sets `deepseek`.
2. `createDeepSeekProvider` implements the existing `AssistantProvider` port. Extraction sends the
   same versioned prompt and examples to DeepSeek in JSON mode. JSON mode does not enforce a
   schema, so the JSON Schema travels as a second system message and the output goes through the
   same `readExtraction` validation and the same deterministic post-processing as before.
3. Dictation stays on Workers AI Whisper. A provider now states whether it transcribes; without a
   speech model the status reports `transcription: false` and the upload route refuses before
   charging a budget.
4. There is no failover in either direction. A DeepSeek failure is the same 503 and degraded state
   as a Workers AI failure.
5. **Data path.** The whole sentence a member types or confirms after dictation now goes to
   DeepSeek, including the names and amounts it mentions. Audio does not. No identifier, balance,
   catalog record or tenant leaves Pisto. This widens what ADR 0022 sent to that provider (a
   product name and a follow-up) and is the owner's decision for the demo; review the provider's
   retention and training terms before real customer data.

## Consequences

- The hosted demo no longer depends on the free Workers AI allocation to read sentences; it still
  does for dictation.
- The Bun API can run the assistant with only a DeepSeek key, without dictation.
- Two providers can read sentences, so a prompt change is evaluated on the one a deployment
  selects, and the evaluation summary names it.

## Alternatives considered

- **Workers Paid.** Removes the daily cap at a monthly cost and keeps one provider; the owner
  preferred the account already paid for.
- **DeepSeek as a fallback when Workers AI fails.** Rejected: the AI guide forbids silent failover,
  and two providers answering the same prompt differently would hide regressions.
- **OpenAI for extraction or speech.** The owner also has that account, but no key is configured
  and nothing was evaluated; a speech adapter needs its own decision.

## Validation

Unit tests cover the request DeepSeek receives (schema placement, JSON mode, no redirect, key only
in the header), every failure mapping, composition with and without a speech provider, the
configuration rules and the status and upload routes without a speech model. The Spanish
evaluation set runs against the deployment that selects DeepSeek; its result is recorded in
[the AI guide](../ai-assistant.md).

## Official sources

- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [Cloudflare Workers AI pricing and free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/)
