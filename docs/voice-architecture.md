# Voice architecture and ElevenLabs evaluation

- Status: **researched direction; no provider selected and no voice implementation approved**
- Research date: **2026-08-22**
- Recheck: before a voice brief, provider/account selection, dependency install, privacy approval, or
  mobile release

Pisto can add voice without turning the product into a provider-owned agent or a second financial
execution path. Text and structured UI come first. Voice produces or presents text around the same
authorized commands, queries, confirmation, idempotency, transaction, and audit rules.

No AI SDK, `expo-audio`, ElevenLabs package, assistant route, audio upload, model, voice, or realtime
session is installed or selected today.

## Decision summary

- The first possible voice slice is bounded push-to-talk transcription that returns editable text to
  the existing assistant composer. It never submits or executes automatically.
- Pisto owns separate provider-neutral aliases/ports for batch transcription, speech output, and any
  later realtime conversation. One `voiceEnabled` flag must not collapse these risk levels.
- ElevenLabs is a credible candidate. If a voice brief is approved, evaluate first whether AI SDK
  7's stable transcription/speech API with the direct `@ai-sdk/elevenlabs` provider fits the Pisto
  server boundary. This is evaluation order, not provider selection. Pin exact versions only after
  the Bun/Hono/Cloud Run and Expo data-path spike passes.
- A small raw ElevenLabs REST adapter is an allowed escape hatch only if a measured requirement, such
  as keyterm prompting for product names, is absent from the AI SDK adapter. It must implement the
  same Pisto port.
- Do not use Vercel AI Gateway, the full ElevenLabs server SDK, ElevenAgents, LiveKit, TTS, or
  realtime voice for the first push-to-talk slice.
- There is no automatic provider or account fallback. Voice failure is explicit and leaves the typed
  and structured product usable.

This refines, but does not replace, [ADR 0009](adrs/0009-provider-neutral-ai-assistant.md).
A provider selection, Gateway data path, or realtime/ElevenAgents topology requires its own decision
after evaluation.

## Escalation ladder

| Stage | Product and system boundary | Gate to advance |
| --- | --- | --- |
| 1. Text | Typed composer to bounded assistant tools, drafts, confirmation, and exact queries | Spanish sale/report quality, authorization, money, privacy, cost, and failure evaluations pass |
| 2. Push-to-talk | Visible record/stop/cancel, authenticated batch upload, server transcription, editable transcript | Separate approved brief; exact device formats/limits; physical web/iOS/Android; Salvadoran Spanish and financial-entity evaluation; provider-account privacy/cost approval |
| 2b. Streaming transcription | Partial live transcript only; still the same text composer and no agent conversation | Measured batch latency prevents successful use; WebSocket auth, abort, reconnect, cost, and device evidence |
| 3. Optional TTS | Explicit Listen control for already-rendered canonical text; source text remains visible | Proven user benefit, pronunciation and financial normalization, accessibility, latency, and cost evidence; no autoplay |
| 4. Realtime conversation | New `RealtimeVoicePort`, short-lived session credential, interruption/turn/reconnect state machine | Measured hands-free/latency job that prior stages cannot solve; new brief, ADR, privacy/legal review, and physical-device evaluation |

Batch STT, streaming STT, TTS, and full-duplex conversation have different data paths, failure states,
privacy duties, native dependencies, and costs. Implement and release them separately.

## First push-to-talk target

```text
Expo push-to-talk recorder
  -> narrow authenticated raw-binary upload
  -> byte, type, duration, rate, concurrency, and cost controls
  -> Pisto TranscriptionPort / transcription.primary
  -> evaluated server provider adapter
  -> editable transcript in the existing text composer
  -> normal typed draft, authorization, confirmation, and domain flow
```

The current generic app client serializes JSON only. Keep it that way. A voice slice adds a narrow
authenticated raw-binary upload adapter that reuses the platform's existing session-cookie behavior;
it does not make the whole API client accept arbitrary bodies.

The current API default body limit is 1 MiB and is configurable only up to 10 MiB. A 30-second clip
at the 16 kHz mono 32 kbps preset recommended below is roughly 120 KB, comfortably under the existing
default. Expo's documented 128 kbps stereo high-quality preset would be roughly 480 KB for the same
clip; it is the wrong basis to plan around, because bitrate is the largest single lever on perceived
upload latency for a user on a slow mobile network. The voice brief must still settle the exact time,
byte, and cost budgets from device/provider evidence.

### Transport and recording constraints

- Use `expo-audio` only after the voice brief. Request permission in context and keep background
  recording disabled.
- Record in Expo's cache, not durable document storage. Delete after successful transcription,
  discard, expiry, or best-effort cancellation and clean orphan cache files on a later launch.
- Use a raw binary request body with a non-simple `Content-Type` such as `audio/mp4`. Not base64
  JSON, and **not** `multipart/form-data`: multipart is a CORS-simple content type, so a cross-origin
  multipart POST triggers no preflight. `apps/api/src/app.ts` requires `application/json` on unsafe
  `/v1` methods precisely as its CSRF control, and `docs/security.md` is explicit that CORS response
  headers are not that control. Allow `audio/mp4` on the transcription path only, and on that path
  require an allowlisted `Origin` rather than accepting a missing one.
- Do not use `RecordingPresets.LOW_QUALITY` on Android: it silently selects AMR-NB, an 8 kHz
  narrowband telephony codec, which is the worst available input for accented Spanish carrying
  numbers in a noisy room. Use a custom preset instead — M4A, mpeg4/AAC, 16 kHz, mono, ~32 kbps —
  since speech models are trained at 16 kHz and 44.1 kHz stereo is wasted uplink.
- On-device speech recognition is closed for this stack today. `@react-native-voice/voice` is
  deprecated on npm in favour of `expo-speech-recognition`, and `expo-speech-recognition` has no
  SDK 57 release. Revisit only if that changes and offline `es` models are confirmed on target
  hardware.
- Accept only container/MIME combinations observed in the target matrix. Expo's documented high
  quality preset uses native M4A/AAC and web `audio/webm`; do not enable a provider's entire format
  catalog by default.
- Web microphone use requires a secure context. Chrome WebM may omit duration metadata and browser
  `MediaRecorder` options differ; do not add a polyfill until the supported-browser matrix proves it
  necessary.
- A byte limit does not prove duration. Before claiming a server duration cap, add a reviewed media
  inspection path or explicitly combine the client timer with authenticated rate limits,
  per-business minute budgets, concurrency limits, and provider credit quotas.
- Propagate cancellation through upload and provider calls. Do not automatically retry ambiguous
  client failures that can duplicate provider cost.
- Treat every transcript as untrusted user input. It re-enters exactly the same parser, draft,
  authorization, deterministic validation, confirmation, idempotency, transaction, and audit path as
  typed text.

## Provider boundary

Use Pisto-owned aliases:

- `transcription.primary` for batch STT;
- `speech.primary` for later TTS; and
- `realtimeVoice.primary` only after a separate realtime decision.

Provider model names, voice IDs, agent IDs, signed URLs, ephemeral tokens, SDK response types, and
raw events do not enter public contracts or canonical product records. Store validated Pisto
messages/transcripts and narrowly redacted operational metadata.

| Option | Evaluation order and current non-selection |
| --- | --- |
| AI SDK 7 plus direct `@ai-sdk/elevenlabs` | First candidate to evaluate if a voice brief is approved; stable batch `transcribe` and later `generateSpeech` would preserve the accepted boundary without adding Vercel hosting/Gateway to the Cloud Run data path |
| Tiny raw ElevenLabs REST adapter | Conditional only for an evaluated capability missing from the AI SDK provider; same Pisto port and tests |
| Full ElevenLabs server SDK | Not justified for batch STT/TTS while the smaller boundary works |
| Vercel AI Gateway | Not selected; it introduces another credential/data/routing boundary and requires its own fail-closed, retention, billing, and provider-routing review |
| ElevenAgents/Speech Engine | Future realtime candidate only; it adds provider-owned turn/session/retention behavior even when Pisto supplies the LLM and tools |

Provider neutrality is an exit path, not a promise that providers have equivalent Spanish accuracy,
voice quality, latency, or price. Evaluate every replacement against the same versioned corpus before
promotion.

## Credentials and session tokens

- Batch STT/TTS clients call Pisto only. The Cloud Run service uses a server-only provider key from
  Secret Manager with the narrowest available permissions and a provider credit quota.
- Never return a server API key to Expo, persist it in the app, or include it in logs/errors.
- If a later realtime client connects directly to ElevenLabs, Pisto authenticates the user,
  authorizes the business, checks consent/quota, and then mints one credential per session.
- ElevenLabs documents frontend single-use tokens for realtime Scribe, batch Scribe, and TTS
  WebSocket. They expire after 15 minutes and are consumed on use. Never persist or reuse them.
- A provider token or signed URL authenticates the provider session; it does not replace Pisto
  business authorization, financial confirmation, or entitlement policy.

## Privacy, retention, and disclosure

Audio and transcripts are sensitive business data. Pisto's deletion of its client/cache/API copy
does not prove deletion by the provider.

ElevenLabs documents default retention. Its Zero Retention Mode is limited to selected Enterprise
customers and eligible API traffic; without it, deleting generation history can leave moderation or
debugging logs and backups can retain deleted database items for up to 30 days. Standard storage is
in the United States. Isolated EU, India, and Singapore environments are Enterprise features, and
processing can still differ from storage location depending on configuration and subprocessors.

Before selecting any voice provider/account, verify and record:

- retention, deletion, training/model-improvement, request-history, and support/debugging behavior;
- whether Zero Retention Mode is contractually available and verifiably enabled;
- storage and processing regions, subprocessors, DPA, and provider dashboard defaults;
- quota, rate/concurrency limits, price, alerting, and data-export/deletion paths; and
- the exact notice/consent obligations for recording or an AI conversation.

Do not send raw audio, transcript text, ephemeral credentials, provider bodies, or full tool
arguments to request logs, traces, analytics, crash reports, or default telemetry.

## TTS and realtime gates

TTS is not part of push-to-talk. If later approved, keep text visible and canonical; offer explicit
Listen/Pause/Stop/Replay controls and never autoplay. Deterministically format canonical money,
dates, and quantities before speech. ElevenLabs currently warns that Flash v2.5 does not normalize
numbers, dates, and currencies as users may expect by default and points to Multilingual v2 when
number normalization matters. Model choice therefore requires a financial pronunciation evaluation,
not an LLM rewrite of authoritative values.

Realtime conversation is a new subsystem, not a configuration switch. A future ADR must resolve
WebSocket versus WebRTC, sample formats/resampling, echo cancellation, barge-in, silence and turn
timeouts, reconnect/duplicate turns, disclosure/consent, retention, connection-duration cost, and
what happens to in-flight drafts during interruption.

No provider-hosted agent, webhook, client tool, or spoken confirmation may directly commit a
financial mutation. At most it requests a Pisto-owned draft. The user reviews and approves that draft
in Pisto, and the server repeats authorization, deterministic validation, idempotency, transaction,
and audit. There is no voice-only financial approval.

## Product state and accessibility contract

The push-to-talk brief must design applicable states explicitly:

- permission not requested, requesting, denied, and permanently denied;
- ready, recording with elapsed/max time, stopped, cancelled/discarded;
- uploading, transcribing, silence/empty, unsupported format, too large/long;
- offline, timeout, rate-limited, provider unavailable, aborted, retry available; and
- transcript ready and editable.

Later TTS adds generating/playing/paused/stopped/playback-failure states. Realtime adds
connecting/listening/thinking/speaking/interrupted/reconnecting/disconnected/ended states.

The microphone control has a text label, keyboard and assistive-technology activation, non-color-only
state, and a complete typed fallback. A waveform is useful only when it communicates recording
level/status and has an accessible alternative. Audio output never hides the source text.

## Evaluation and release gates

Use a versioned corpus containing Salvadoran Spanish, other target accents, noisy shops,
code-switching, product names, corrections, overlapping speech, quantities, decimal money,
currencies, dates, and adversarial spoken instructions.

Measure entity/financial exact match and end-to-end draft correctness—not word error rate alone—plus
p50/p95 capture-to-transcript latency, cancellation/outage behavior, physical web/iOS/Android
compatibility, cost per successful task/business, deletion evidence, and absence of sensitive logs.

Release requires per-user/business rate limits, concurrency limits, daily/monthly minute budgets,
provider credit quota/alerts, a server kill switch, and typed/manual fallback. Recheck official
pricing immediately before approval; never encode a researched price snapshot as a durable budget.

## Non-goals until separately approved

- TTS, streaming STT, realtime/ElevenAgents, Gateway, LiveKit, always-on/background recording;
- automatic transcript submission, voice-only approval, or autonomous tools;
- provider credentials in Expo, automatic provider/account fallback, or provider IDs in contracts;
- long-term raw-audio/object-storage pipeline;
- cloned/custom voices, speaker identification/biometrics, telephony, provider knowledge bases, RAG,
  or graph retrieval; and
- any dependency or environment variable before implementation consumes it.

## Primary sources

- [Expo Audio SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [AI SDK transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription)
- [AI SDK speech](https://ai-sdk.dev/docs/ai-sdk-core/speech)
- [AI SDK ElevenLabs provider](https://ai-sdk.dev/providers/ai-sdk-providers/elevenlabs)
- [AI SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime)
- [ElevenLabs speech-to-text capabilities](https://elevenlabs.io/docs/overview/capabilities/speech-to-text/)
- [ElevenLabs batch speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)
- [ElevenLabs realtime speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
- [ElevenLabs single-use token](https://elevenlabs.io/docs/api-reference/tokens/create)
- [ElevenLabs Speech Engine](https://elevenlabs.io/docs/overview/capabilities/speech-engine)
- [ElevenLabs Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode)
- [ElevenLabs data residency](https://elevenlabs.io/docs/overview/administration/data-residency)
- [ElevenLabs models](https://elevenlabs.io/docs/overview/models)
- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- [Hono request parsing](https://hono.dev/docs/api/request)
- [Hono body limit](https://hono.dev/docs/middleware/builtin/body-limit)
