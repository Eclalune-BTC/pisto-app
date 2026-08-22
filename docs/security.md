# Security baseline

Security controls are part of the architecture, not a deployment afterthought. This baseline applies
to local design, CI, staging, and production; production adds stricter identity, network, logging,
backup, and monitoring controls.

## Trust boundaries

Treat all of these as untrusted until verified at their boundary:

- browser, native app, URL parameters, headers, cookies, and uploaded files;
- data returned from local device storage;
- Polar and RevenueCat webhook requests before signature/authentication checks;
- task requests before Cloud Run/IAM OIDC validation;
- provider metadata and raw JSON before normalization;
- model output, tool arguments, retrieved content, uploads, audio, and transcripts;
- database content when rendered into HTML, logs, filenames, redirects, or provider requests;
- package install scripts, container bases, and CI artifacts.

The API, not the client, makes authorization and entitlement decisions.

## Data and configuration classes

| Class | Examples | Handling |
| --- | --- | --- |
| Public | API origin, app scheme, store product display data, RevenueCat public SDK key | May be in Expo/build config; still validate |
| Internal | Request IDs, non-sensitive feature configuration, internal product slug | Do not expose unnecessarily |
| Sensitive personal | Email, account/provider identifiers, support history | Minimize, authorize, redact, retain deliberately |
| Sensitive business | Sales, prices, inventory, expenses, customer/supplier data, prompts, transcripts, and tool inputs/results | Tenant-scope, minimize, encrypt in transit/at rest, redact telemetry, retain/delete deliberately |
| Secret | Better Auth secret, DB password, Polar token/webhook secret, RevenueCat webhook auth/HMAC secret, model/transcription provider credential | Server only; Secret Manager in production |
| High impact | Migration/deployer credentials, signing keys, service-account impersonation | Separate identity, least privilege, audit, rotation |

`EXPO_PUBLIC_*` is always public. A misleading variable name does not make client-bundled data
secret.

## Authentication and sessions

- Generate `BETTER_AUTH_SECRET` from a cryptographic random source with at least 32 bytes of entropy.
- Use HTTPS, secure HTTP-only cookies, exact trusted origins, and CSRF/origin checks.
- Never set wildcard credentialed CORS.
- Store native session material through the official Better Auth Expo/SecureStore integration.
- Rate-limit abuse-prone auth routes and use enumeration-resistant public errors.
- Better Auth deliberately refuses an untrusted comma-separated forwarded-IP chain; when no client
  address resolves, all clients share one per-path rate-limit bucket. This prevents trivial
  leftmost-IP spoofing but can cause collateral throttling.
- Before production traffic, verify the exact Cloud Run/client-IP header shape and spoofing behavior.
  If deployment needs `advanced.ipAddress.ipAddressHeaders` or `trustedProxies`, add and test that
  explicit code configuration only for a header/proxy the edge overwrites or sanitizes.
- Do not confuse `AUTH_TRUSTED_PROXY_HEADERS` (forwarded host/protocol URL inference) with a trusted
  rate-limit client-IP contract.
- Revoke sessions after password/security changes and expose device/session revocation as appropriate.
- Keep development `exp://` wildcard origins strictly out of production.
- Rotate using Better Auth's documented secret set so supported encrypted data can transition safely.
- Treat active organization as a workspace selector, not authorization proof. Reload membership and
  Pisto action policy before every protected business operation.
- Disable or intercept organization deletion before financial records exist; no auth endpoint may
  cascade-delete canonical business history without an approved retention/export/audit policy.
- Restrict organization creation to the approved onboarding rule, and deny invitation/member
  operations until their verification, delivery, permission, rate-limit, and audit flows exist.

## API controls

- Validate every external field with bounded schemas; reject unsafe unknown fields on mutations.
- Limit body size, upload size, pagination, string length, and collection cardinality.
- Use parameterized Drizzle queries; do not concatenate SQL identifiers/input.
- Use stable public error envelopes without stacks, SQL, environment, or provider payloads.
- Generate a request ID and log structured fields with redaction.
- Add secure headers and a narrow CORS origin function before routes.
- Protect redirects: only server-created or allowlisted HTTPS URLs can leave the trusted origin.
- Use explicit outbound timeouts; retry mutations only with idempotency.
- Distinguish authentication (`401`) from authorization (`403`) without disclosing hidden resources.

## AI and financial-operation controls when introduced

No assistant or sales implementation exists in the baseline. The following controls are mandatory
for the approved first slice:

- Keep provider credentials, prompts, tool implementations, and provider-specific options on the
  server. The client receives only Pisto-owned contracts and safe stream events.
- Resolve the authenticated subject and business on the server. Never let a client, model, prompt,
  retrieved document, or tool argument choose an arbitrary tenant.
- Expose a small static allowlist of schema-bounded Pisto tools. Do not expose arbitrary SQL, shell,
  filesystem, generic HTTP, secrets, billing, role administration, or unrestricted record search.
- Treat a model proposal as untrusted draft data. Recompute money in deterministic domain code using
  integer minor units and explicit currency and business time zone.
- Approval is not authorization. Bind a financial approval to the subject, business, exact canonical
  draft, expiry, and idempotency key; then repeat authorization, validation, current-state checks, and
  deterministic calculation immediately before the short audited transaction.
- Design for prompt injection in user text, stored notes, uploads, retrieval results, and provider
  output. Instructions inside business content cannot expand tool capabilities or override policy.
- Bound model steps, tokens, input/audio size, duration, concurrency, rate, cost, timeout, retry, and
  cancellation. Keep a server kill switch that preserves structured access to canonical data.
- Never silently switch providers or replay a mutation after a provider/stream failure. Expose a
  truthful degraded state and require a fresh valid continuation when recovery is safe.
- Separate conversation/audio/transcript retention from canonical financial records. Delete Pisto's
  raw-audio copy after the documented retry window by default, define export/deletion before
  production, and verify the exact provider account's retention/deletion instead of treating local
  deletion as provider evidence.
- A direct-client realtime credential is short-lived, single-session, minted only after Pisto auth,
  business authorization, consent, and quota checks, and never logged or persisted. It does not
  authorize a financial action.
- Log safe metadata such as opaque request/business IDs, model alias, prompt version, tool name,
  approval outcome, latency, token counts, estimated cost, finish reason, and bounded error code—not
  raw prompts, transcripts, outputs, tool payloads, or business records by default.

See [AI assistant architecture](ai-assistant.md),
[Voice architecture](voice-architecture.md), and the
[approved product brief](product-briefs/pisto-ai-business-assistant.md) for the complete policy.

## Billing and webhook controls

- Accept an internal allowlisted product slug, not client-supplied amount, price, currency, or arbitrary
  provider ID.
- Bind checkout/customer state to the authenticated subject on the server.
- Deny direct external access to provider checkout/customer adapter routes; expose only the
  scope-checked `/v1` wrappers and the verified webhook route.
- Never treat a success return URL, client `CustomerInfo`, or screenshot/receipt string as server proof.
- Verify Polar Standard Webhooks signatures against the exact raw body and headers.
- For RevenueCat, configure a high-entropy Authorization header and, when enabled, verify the official
  `X-RevenueCat-Webhook-Signature` HMAC over the raw body. Rotate without accepting unsigned fallback
  indefinitely.
- Deduplicate before effects and compare provider effective time/version for ordering.
- Entitlement rows fail closed unless active and within their server-evaluated validity interval.
- A provider revocation updates only that provider/source grant.
- The current Polar entitlement projector accepts subscription lifecycle events only. Treat one-time
  order products as unsupported, not as paid access, until their separate grant/reversal model is
  implemented and tested.
- Separate sandbox and production credentials, product IDs, webhook URLs, and evidence.

See [Billing and entitlements](billing-entitlements.md) for the full model.

## Database controls

- Use a dedicated application role with only runtime permissions and a separate migration role.
- Prefer private Cloud SQL connectivity and enforce the selected TLS/connector security model.
- Keep pools bounded and timeouts finite.
- Enforce subject, uniqueness, and foreign-key invariants in PostgreSQL.
- Encrypt backups through the managed platform baseline and enable appropriate PITR/backups.
- Test restore. A backup that has never restored is not recovery evidence.
- Restrict and audit production human access; do not use shared database accounts.
- Minimize raw webhook payload retention and never store full payment credentials.

## Cloud Tasks controls when introduced

No queue or handler is implemented in the baseline. These controls become mandatory with that seam:

- Keep the handler private and require an OIDC token whose audience is the exact service URL.
- Give the invoker service account only `run.invoker` on the intended service.
- Use an application-level idempotency key because delivery is at least once.
- Validate payload schema and resolve current authorization/state from durable storage.
- Do not place credentials or large personal payloads in task bodies.
- Cap retries and alert on exhausted/permanent failures.

## Cloud Storage and upload controls when introduced

No bucket adapter or user-file feature is implemented in the baseline. These controls become
mandatory with that seam:

- Private buckets, uniform bucket-level access, least-privilege service accounts.
- Server-generated object names and short-lived method/object-specific signed URLs.
- Treat a signed URL as a bearer credential: do not log or persist it beyond its purpose.
- Enforce size and content restrictions both at issuance and after upload.
- Keep new objects quarantined until required validation/scanning completes.
- Set lifecycle and deletion behavior from documented retention requirements.
- Never render a user filename as a response header without safe encoding.

## Cloud and supply-chain controls

- Use dedicated single-purpose service accounts; avoid default Editor/Owner identities.
- Use Workload Identity Federation for CI instead of downloadable service-account keys.
- Pin Bun and direct dependencies, commit `bun.lock`, and use frozen installs in CI.
- Review lockfile changes, package lifecycle scripts, maintainer/source changes, and advisories.
- Use trusted small container bases, multi-stage builds, non-root runtime, image scanning, and immutable
  deployed digests.
- Never copy repository-wide local files into the runtime image without a restrictive `.dockerignore`.
- Produce/retain build provenance or an SBOM when the delivery platform supports it.

## Dependency audit snapshot

`bun audit` was rerun against the committed lockfile on 2026-08-22. It reports four unresolved
advisories in three transitive development/build-tool packages; it does not report a direct
application-runtime dependency finding.

| Locked path | Advisory | Current reachability and required control |
| --- | --- | --- |
| `drizzle-kit@0.31.10 -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild@0.18.20` | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), moderate | The advisory concerns esbuild's development `serve` feature. This repository uses Drizzle Kit as a schema tool and does not invoke `esbuild.serve`; do not expose an esbuild development server. |
| Expo/React Native Metro toolchain -> `image-size@1.2.1` | [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), high | Metro can parse image assets during development/build. Only process trusted repository assets; do not add an untrusted-image build or preview pipeline. The registry's latest `image-size` was `2.0.2`, and the advisories still marked every version through `2.0.2` affected. |
| Expo Xcode project tooling -> `xcode@3.0.1 -> uuid@7.0.3` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate | The advisory affects UUID v3/v5/v6 calls supplied a caller buffer. The installed Xcode tool calls only `uuid.v4()` without a buffer, so that affected path is not currently reached. Recheck this call site whenever Expo/Xcode tooling changes. |

`bun audit fix --dry-run` fixed zero findings on that date. The current `xcode@3.0.1` still declared
`uuid ^7.0.3`, and the current `drizzle-kit@0.31.10` still included its legacy esbuild loader. No
out-of-range override was forced: Bun supports only top-level overrides, not dependency-path-specific
nested overrides, so an override would replace the package across the graph and could violate the
tested Expo/Vite/Drizzle dependency ranges. Prefer a compatible upstream parent-package update and
rerun the full validation matrix.

CI runs `bun run audit:ci`, which ignores exactly the four GHSA identifiers in this table. That
targeted exception makes any additional advisory fail the CI step; it is not a claim that the graph
is vulnerability-free. Keep raw, unignored `bun audit` as the manual full view and update the script,
this register, owner, and review date together whenever an exception changes.

Before every release and dependency update, run `bun run audit:ci`, `bun audit`,
`bun audit fix --dry-run`, and `bun pm why <package>`. Review the live advisory and registry state,
record an owner and review date for any continuing exception, and remove this snapshot when an
upstream compatible fix lands. A new runtime-reachable finding, untrusted image ingestion, exposed
build server, or changed call path must block release until it is patched or separately mitigated
and reviewed.

## Logging and privacy

Allowed structured fields include timestamp, severity, service/revision, route template, method,
status, latency, request ID, and opaque subject/provider references when operationally necessary.

Do not log:

- Authorization/Cookie/Set-Cookie headers;
- password/reset/verification tokens or Better Auth secret;
- database URLs or process environment dumps;
- Polar/RevenueCat credentials, webhook signature material, checkout/portal/signed Storage URLs;
- full webhook bodies by default;
- raw prompts, model output, retrieved passages, tool arguments/results, audio, or transcripts by
  default;
- payment details or unnecessary email/IP/device identifiers.

Define retention and access by environment/data class. Cloud logs are a data store and need access
control.

## Security review checklist

- [ ] Threat/trust boundaries changed? Update this document and an ADR when architectural.
- [ ] New environment keys classified public/server-secret and added to the right example.
- [ ] New route has schema, auth rule, size/rate limit, error mapping, and tests.
- [ ] AI tool is narrow, tenant-scoped, injection-resistant, bounded, and tested for denial/failure.
- [ ] Financial mutation binds confirmation, authorization, deterministic money, idempotency,
  transaction, audit, and correction behavior.
- [ ] Model/transcription data path, retention, deletion, provider terms, telemetry redaction, and kill
  switch are reviewed against the exact configured account.
- [ ] New redirect/outbound URL is allowlisted or server-generated.
- [ ] Webhook uses raw-body verification, replay/deduplication, and ordering tests.
- [ ] Entitlement decision remains provider-neutral and server authoritative.
- [ ] Migration constraints, privileges, data retention, and rollback are reviewed.
- [ ] Logs and analytics are tested for secret/personal-data leakage.
- [ ] Dependency/container changes are audited and locked.
- [ ] Production IAM and Secret Manager access remain least privilege.

## Incident response minimum

1. Preserve relevant audit evidence without copying secrets into tickets/chat.
2. Disable or scope the affected feature/credential; do not delete evidence first.
3. Rotate compromised provider/auth/database secrets using a service-specific plan.
4. Revoke sessions/grants only when the incident scope requires it.
5. Reconcile provider and entitlement state after containment.
6. Restore/forward-fix, validate, communicate impact, and record a blameless corrective action.

## Official sources

- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Hono secure headers](https://hono.dev/docs/middleware/builtin/secure-headers)
- [Hono CORS](https://hono.dev/docs/middleware/builtin/cors)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Polar webhook validation](https://polar.sh/docs/integrate/webhooks/delivery)
- [RevenueCat webhook authentication and signing](https://www.revenuecat.com/docs/integrations/webhooks)
- [Secret Manager best practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [Google service-account security](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [Bun audit](https://bun.sh/docs/pm/cli/audit)
- [Bun overrides and resolutions](https://bun.sh/docs/pm/overrides)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [Vercel AI SDK tool approvals](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
