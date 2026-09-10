# Production capabilities matrix

This matrix prevents architecture diagrams from being mistaken for shipped operations. “Included”
means code/config exists in this repository. “Seam” means boundaries and documentation identify
where a capability belongs, but external configuration or implementation is still required.
“Not chosen” means no provider/product is silently assumed.

The owner's latest instruction requires local Expo, Bun/Hono, and PostgreSQL 18 only. Hosting is
undecided and publication is not authorized; Neon is an optional future database preference.
[ADR 0017](adrs/0017-portable-postgres-and-hosting.md) records the corrected scope.
[Release evidence](release-evidence.md) owns local validation and the withdrawal status of the
earlier unwanted publication; this matrix does not establish hosted acceptance.

| Capability | Included now | Integration seam / release gate | Intentionally not chosen |
| --- | --- | --- | --- |
| Email/password sign-up and sign-in | Better Auth email/password switch, PostgreSQL-backed schema/rate limiting, sign-in/up UI, and session-backed account summary | Run PostgreSQL-backed lifecycle/denial tests and complete the release checks in [Authentication](authentication.md) before claiming production readiness | No social login, passkeys, or MFA is implied by the base account schema |
| Email verification and password recovery | Verification schema and reset-route rate rule only | Select a transactional email provider; implement verification and `sendResetPassword`, templates, enumeration-safe UX, session-revocation policy, bounce/domain/DKIM/DMARC, and delivery tests | No email vendor, verification flow, or working recovery delivery is bundled |
| Organizations, roles, and permissions | Better Auth server/client organization plugins, owner business onboarding/settings, exact static `owner`/`admin`/`member` current-operation permissions, active selector, fresh membership checks, and Hono guards that deny raw organization management routes | `admin` and `member` have no reachable actor: business onboarding is the only code path that writes a membership row and it hardcodes `role: "owner"`, and every Better Auth organization mutation route returns `404` except the active-organization selector. Add verified invitation delivery/acceptance and separately brief domain-specific team roles before exposing role administration | No invitation flow, custom/dynamic roles, team-management UI, admin/support role, or impersonation is claimed. A passing `admin`/`member` policy test is not evidence that multi-user access works |
| Sales and business records | Total-only sale schema/API/universal UI, frozen currency exponent, IANA/wall-clock snapshots, fresh session/action authorization, transactional idempotency/audit receipt, canonical result, previous-month summary, atomic void/replacement correction, and bounded status-filtered sale history; PostgreSQL request budgets and a business-write switch | Record hosted end-to-end, recovery, responsive-web, and required native evidence; the approved conversational slice remains absent | Inventory deduction, profit, taxes, invoices, multi-currency, crash recovery, AI/voice entry, and later modules are not implied by Increment 1 |
| Catalog and inventory | Categories and products with case-insensitive business-unique names/SKUs, bounded units, quantity precision 0-3, archive-not-delete, append-only `inventory_movement` with derived on-hand and one-time reversal, `/v1/catalog/*` and `/v1/inventory/*` routes, `/operate/catalog` and `/operate/inventory` screens, and a PostgreSQL 18 integration suite | Record rendered responsive-web and physical-device evidence; no sale line deducts stock, so inventory only reflects manual movements | No variants, bundles, barcodes, suppliers, purchase orders, cost layers, or automatic sale stock deduction |
| Expenses and cash | Cash accounts with derived balances and an explicit negative-balance policy, paid expenses posted and voided atomically with their cash movement, adjustments, one-time reversals, paired transfers, `/v1/cash/*` and `/v1/expenses/*` routes, `/operate/cash` and `/operate/expenses` screens, and a PostgreSQL 18 integration suite | Record rendered responsive-web and physical-device evidence | No bank synchronization, chart of accounts, bank-reconciled balance, tax, payroll, accounts payable, or FX conversion |
| Customers and receivables | Customers with archive-not-delete, receivable charges, payments and one-time payment reversals that commit atomically with their cash movement through the cash owner port, derived open/paid/overdue state, `/v1/customers/*` and `/v1/receivables/*` routes, `/operate/customers` and `/operate/receivables` screens, and a PostgreSQL 18 integration suite | Record rendered responsive-web and physical-device evidence | No credit scoring, interest, collection messaging, fiscal invoices, suppliers, payables, or write-offs |
| Operating reports | `packages/db/src/reports.ts`, `GET /v1/reports/operating`, and `/operate/reports`; `reports:read` authorization; bounded inclusive date range; exact period flows and separately labeled current positions in one read-only repeatable-read transaction; PostgreSQL integration and client state coverage | Record hosted, responsive-web, and required device evidence in the release record | No CSV export, daily-series response, tax report, forecast, inferred trend, or model-computed figure. Revenue minus recorded expenses is never called profit |
| Text AI assistant | Accepted AI architecture and provider-neutral boundary only; no AI dependency, provider, model, route, prompt, tool, UI, schema, or credential exists | Pin AI SDK 7 and one provider only after approved Bun/Hono and Expo streaming spikes; any future host needs separate validation; pass Spanish semantic, authorization, approval, cost, privacy, and failure evaluations | No Vercel AI Gateway requirement, automatic provider failover, autonomous finance, arbitrary SQL/HTTP tool, durable agent, or long-term memory |
| Voice input | No microphone UI, audio dependency, upload, transcription provider, or retention implementation; ElevenLabs is researched but not selected | After text is proven and a separate brief is approved, add visible push-to-talk, narrow multipart upload, server transcription, editable transcript, local/provider retention evidence, accessibility, cost/failure controls, and physical-device evaluation from [Voice architecture](voice-architecture.md) | No TTS, streaming/realtime, ElevenAgents/Gateway, always-listening/background recording, silent submission, voice-only approval, or automatic provider fallback baseline |
| Retrieval and graph | PostgreSQL is selected for exact relational product queries; no retrieval subsystem is installed | Use full-text search first; require a labeled corpus evaluation and ADR before pgvector, and a representative multi-hop benchmark plus second-datastore operations/security plan before Neo4j or GraphRAG | No RAG, embeddings, vector database, Neo4j, GraphRAG, or web search for the approved first slice |
| Billing and entitlement projection | Polar web subscription catalog/checkout/portal, verified subscription lifecycle projection, provider-neutral entitlements, and an optional authenticated RevenueCat subscription webhook | Provision/test provider dashboards and sandbox products; install the RevenueCat native SDK for mobile; add a separate verified order/refund model before offering Polar one-time products | No Polar one-time-order entitlement projection and no local Apple/Google receipt verification |
| Expo push notifications | No push delivery | Add `expo-notifications`, permission UX, device-token ownership/rotation, server send path, receipts, opt-out, and physical-device testing | No push provider/config/credentials or campaign system |
| Jobs and tasks | API remains request-driven; billing webhook receipt is synchronous/durable; the alternative Cloud Build reference configures and waits for a one-task, zero-retry Cloud Run migration job | Execute migrations once with a separate role and direct database URL; select a bounded queue/worker adapter only when a real background job requires one; Google OIDC/Cloud Tasks remains one reference option | No background loop inside API instances; no general job/queue resource or successful cloud-job execution is claimed |
| File/object storage | No user file feature | Select a private object adapter with signed URLs, ownership/size/type validation, quarantine/scanning, lifecycle, and least privilege; Cloud Storage is a reference option | No selected user-file vendor, public bucket, or host-local disk as durable storage |
| Observability and error reporting | Local request IDs and structured logs to stdout/stderr; health/readiness | Any future hosted service needs an approved logging/alerting owner, SLOs, traces, retention, and runbooks, verified in that environment | No Sentry/Datadog vendor or production alert coverage claimed |
| Product analytics and privacy | No behavioral analytics SDK | Define event taxonomy, lawful purpose/consent, minimization, retention/deletion, environment separation, identity policy, and platform privacy declarations before selecting a tool | No analytics/advertising tracker and no fabricated consent posture |
| Distributed rate limiting and cache | Better Auth auth budgets plus atomic per-user product read/write budgets share PostgreSQL `rateLimit` with distinct key namespaces; default product counts are 300 reads/60 writes per 60 seconds; budget-store failure denies the product request | Verify the deployed auth client-IP/proxy contract, spoofing behavior, product concurrency, and returned `Retry-After`; retain the shared 60-second cleanup invariant documented below | No verified deployed client-IP contract, Redis/Memorystore dependency, or entitlement cache |
| Feature flags | Auth/Polar/RevenueCat switches and `PRODUCT_WRITES_ENABLED`; false pauses business mutations while reads, auth, account, and billing/provider endpoints retain separate policy | Exercise pause/resume against the deployed artifact; add owned, expiring, audited flags only if experimentation or staged rollout needs them | No remote flag vendor; env switches are not a full experimentation platform |
| Admin and support tooling | Stable opaque references, organization/auth schema, and a reserved `manual` entitlement source | Build least-privilege audited support actions, session revoke, entitlement reconciliation, and reasoned manual-grant creation/revocation before using that source | No Better Auth admin plugin/UI, impersonation, supported manual-grant command, or unrestricted database console for support |
| Local runtime and portability | Local Expo and Bun/Hono, Docker PostgreSQL 18, postgres-js/Drizzle migrations, portable API container, and Expo `web.output: single` export | Hosting requires a new explicit decision; any future deployment must validate origins, deep links, assets, pool limits, migration identity, TLS, rollback, and hosted behavior | No active cloud runtime/database dependency or provider-specific publishing adapter; Neon is an optional future preference and Cloud SQL an optional reference |
| Backups and disaster recovery | Local persistent volume, migration artifacts, normalized data model, and standard PostgreSQL export/restore proof recorded in release evidence | Keep private local backups and isolate restore tests; a future hosted environment needs its own verified retention, backups/PITR, RPO/RTO, and owner | No production recovery acceptance is claimed; a volume or prior provider configuration is not a backup/restore policy |

Product middleware protects `/v1` by default, including payment reversals and future product routes.
Only the explicit version/account/billing/provider paths use separate policy. The product limiter
uses `pisto:product:<read|write>:<userId>` keys and a fixed 60-second window. Better Auth's installed
database limiter prunes expired rows across the entire table using its longest configured window,
currently also 60 seconds. Keep those windows compatible and recheck cleanup behavior on auth or
rate-policy upgrades; a key namespace alone does not isolate cleanup.

## Promotion rule

Mark implementation as included only with its code, configuration, tests, and updated ownership
record. Promotion to deployed or production-accepted additionally requires:

1. implementation and exact environment schema;
2. threat/privacy review and least-privilege identity;
3. unit/integration/failure tests;
4. provisioning/deployment/runbook/monitoring ownership;
5. production smoke and rollback/recovery evidence;
6. updated docs and ADR when the architecture boundary changes.

## Official sources

- [Better Auth email and password recovery](https://better-auth.com/docs/authentication/email-password)
- [Better Auth email provider seam](https://better-auth.com/docs/concepts/email)
- [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization)
- [Better Auth database-backed rate limits](https://better-auth.com/docs/concepts/rate-limit)
- [Vercel AI SDK 7](https://vercel.com/changelog/ai-sdk-7)
- [Expo Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [PostgreSQL full-text search](https://www.postgresql.org/docs/18/textsearch.html)
- [pgvector](https://github.com/pgvector/pgvector)
- [Neo4j GraphRAG requirements](https://neo4j.com/docs/neo4j-graphrag-python/current/)
- [Expo push notification overview](https://docs.expo.dev/push-notifications/overview/)
- [Cloud Tasks HTTP targets](https://cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Cloud Storage signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Cloud Run logging](https://cloud.google.com/run/docs/logging)
- [Cloud Run Error Reporting](https://cloud.google.com/run/docs/error-reporting)
- [Expo data and privacy protection](https://docs.expo.dev/guides/data-and-privacy-protection/)
- [Memorystore for Redis overview](https://cloud.google.com/memorystore/docs/redis/memorystore-for-redis-overview)
- [Better Auth admin plugin](https://better-auth.com/docs/plugins/admin)
- [Cloud SQL backups](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups)
