# ADR 0021: Workers AI registration assistant behind a small typed adapter

- Status: Accepted (owner decision on the provider, 2026-11-02)
- Date: 2026-11-02
- Owners: `@pisto/assistant`, `@pisto/api`, `@pisto/app`
- Amends: [ADR 0009](0009-provider-neutral-ai-assistant.md) and the provider sections of
  [the AI guide](../ai-assistant.md) and [the voice guide](../voice-architecture.md)
- Research date: 2026-11-02. Recheck when a pinned model is deprecated, the Workers AI JSON mode or
  speech-to-text schema changes, the evaluation set changes, or a second provider is proposed.

## Context

The Phase 2 design (CU01, HU-04, prototypes 11-13) asks for one job: the user says or types one
sentence ("Le vendí a don Carlos tres libras de café, me dio cinco dólares y el resto me lo quedó
debiendo"), Pisto shows how the record would look, the user corrects it and saves it through the
record's normal command. The hosted demo runs on Cloudflare Workers ([ADR 0020](0020-cloudflare-workers-neon-hosting.md)),
and the owner chose Cloudflare Workers AI as the provider.

This job needs one structured extraction and one batch transcription per request. It needs no
streaming, tool loop, approval protocol or conversation state: the draft is never a mutation, and
saving goes through the existing reviewed, idempotent commands.

## Decision

1. **Provider.** Workers AI: the `AI` binding in the Worker (`wrangler.jsonc`, `"remote": true` so
   `wrangler dev` uses the real models) and the REST endpoint
   `POST /client/v4/accounts/{id}/ai/run/{model}` for the local Bun API when
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN` are set. Without either, the assistant
   reports itself off. `ASSISTANT_ENABLED=false` is the kill switch; `ASSISTANT_ENABLED=true` without
   a provider fails at startup. There is no fallback provider and no canned answer.
2. **No AI SDK for this slice.** `packages/assistant` holds a small typed adapter over
   `env.AI.run` and the REST call (one function each), validated with Zod. AI SDK's value
   (streaming, tool calling, approvals, UI transport) is unused by one request-response extraction,
   and its Workers AI provider would add a dependency without removing any code we keep. Revisit
   when the conversational assistant of ADR 0009 (multi-step tools, streaming) is approved.
3. **Model registry.** `packages/assistant/src/models.ts` is the only place that names models:
   - `assistant.extract`: `@cf/zai-org/glm-4.7-flash`, JSON Schema response format (OpenAI shape),
     reasoning off, temperature 0, 1 024 output tokens.
   - `assistant.transcribe`: `@cf/openai/whisper-large-v3-turbo`, `language: "es"`,
     `vad_filter: true` (silence yields empty text instead of an invented phrase).
4. **The model only extracts.** The versioned prompt (`extract-2026-11-02.1`) asks for the record
   kind, the exact fragments that justify each field, names and products as heard, decimal amounts,
   payment method, relative or explicit dates, expense category and invoice number. The sentence is
   delimited untrusted data; the output schema has no identifiers, tenants, prices or totals.
5. **Deterministic post-processing** (`interpret.ts`) locates each fragment in the original text to
   build numbered spans (dropping those not literally present), resolves names only through
   `createAssistantDirectory` (active business, active records, role-gated reads) or the injected
   supplier directory, takes catalog prices, computes totals, received and credit in integer minor
   units, picks the account for the payment method, resolves dates in the business time zone within
   60 days, and reports notices (`missing`, `not_found`, `similar_match`, `exceeds_total`,
   `insufficient_stock`, `not_permitted`).
6. **Audio.** The web client captures PCM with Web Audio and uploads 16 kHz mono 16-bit WAV, the one
   container verified end to end; Cloudflare documents no container list for Whisper and WebM/Opus is
   unverified. `POST /v1/assistant/transcriptions` alone accepts `audio/wav` (RIFF/WAVE checked),
   requires an allowlisted `Origin`, and has its own byte cap (`ASSISTANT_AUDIO_LIMIT_BYTES`,
   default 1.6 MB, about 50 s); the client stops at 45 s. Native builds have no audio module, so they
   offer text only.
7. **Limits and logs.** Both routes authorize `assistant:use` before any model cost, then charge a
   per-user-per-business and a per-business budget in the shared limiter table, and bound the model
   call (20 s extraction, 30 s transcription). Provider failures return `503 SERVICE_UNAVAILABLE`.
   Logs record task, provider, prompt version, outcome and duration, never text, audio or output.

## Consequences

- The assistant drafts sales, expenses, purchases, customer payments and supplier payments; the
  record forms save them through their own commands. Until those forms are composed, the review
  shows a read-only summary that cannot save.
- Workers AI states zero retention and no training on customer content for standard inference
  ([data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/), reviewed
  2026-11-02). That statement is not verified against the account's settings.
- Local `wrangler dev` calls the real models and spends the account's neurons.
- A model change is a release change: rerun `bun ./eval/run.ts <api> <origin>` in
  `packages/assistant` against a running API and record the result here.

## Alternatives considered

- **AI SDK 7 with a Workers AI provider:** consistent with ADR 0009 but adds a dependency for one
  call whose output Pisto validates and post-processes anyway. Deferred, not rejected.
- **Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`):** also scored 16/16, at about twice
  the latency and five times the output price of GLM-4.7-Flash.
- **Sending Chrome's WebM/Opus:** about ten times smaller than WAV, but the accepted formats are
  undocumented; WAV removes the guess at the cost of upload size.
- **Deepgram Nova-3 for Spanish speech:** ten times the per-minute price of Whisper turbo, and its
  Spanish support on the batch HTTP path is unverified.

## Validation (2026-11-02)

Evaluation set `2026-11-02.1` (16 sentences from the prototypes and the demo seed, including an
unsupported question, two records in one sentence and a prompt injection), run end to end through
`wrangler dev` with the remote AI binding and the local seeded database:

| Model | Passed | p50 | p95 |
| --- | --- | --- | --- |
| `@cf/zai-org/glm-4.7-flash` (selected) | 16/16 | 2.5 s | 6.9 s |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 16/16 | 5.3 s | 12.6 s |

Transcription through the same binding: a synthesized 16 kHz WAV of "Pagué sesenta y cuatro
dólares de luz con transferencia" (English text-to-speech voice) returned "Pegues sesenta y cuatro
dolas de luz con transferencia." in about 6 s; three seconds of near silence returned an empty
text. No physical device, real Salvadoran speaker or noisy-shop recording has been evaluated.

## Official sources

- [Workers AI JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [GLM-4.7-Flash](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)
- [Whisper large v3 turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)
- [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [Local development with remote bindings](https://developers.cloudflare.com/workers/local-development/)
- [Workers AI limits](https://developers.cloudflare.com/workers-ai/platform/limits/)
- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
