# Official source index

Research date: **2026-08-22**.

Only primary sources maintained by the relevant project/vendor/standards body are listed. A link
supports the decision; the repository documentation records how Pisto applies it. Recheck sources on
their review trigger because package behavior, cloud services, and especially store billing policy
can drift.

## Agent and engineering workflow

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Root `AGENTS.md` supplies portable project instructions to Codex | [OpenAI AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | Agent workflow or instruction-layout change |
| Root `CLAUDE.md` imports the shared instructions for Claude Code | [Anthropic Claude Code project memory](https://code.claude.com/docs/en/memory) | Claude Code instruction-loading change |
| Repository-scoped skill lives under `.agents/skills` | [OpenAI skill authoring and locations](https://learn.chatgpt.com/docs/build-skills) | Skill structure or distribution change |
| Independent subagents are used proportionally for bounded read-heavy exploration/review; parallel writing waits for clear ownership and contracts | [OpenAI subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) | Review workflow or Codex capability change |
| Parallel writing agents use isolated worktrees and non-overlapping ownership | [Anthropic Claude Code subagents and worktrees](https://code.claude.com/docs/en/sub-agents) | Multi-agent/write-isolation workflow change |
| Short agent instructions map to versioned repository knowledge and specific agent reviews | [OpenAI harness engineering](https://openai.com/index/harness-engineering/) | Documentation or review-system redesign |
| Secure development and third-party component decisions use a risk-based process | [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) | Security/dependency policy change |
| Dependency changes receive vulnerability, license, and transitive-impact review | [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review), [OpenSSF Scorecard](https://openssf.org/scorecard/) | Every new or changed production dependency |

## Runtime and repository

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Bun 1.4 runtime and TypeScript execution | [Bun runtime](https://bun.sh/docs/runtime) | Bun/toolchain upgrade |
| Retain TypeScript 6.0.3 until the Expo/React Native/tooling matrix validates the new TypeScript 7 compiler | [TypeScript 7.0 announcement and transition guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) | TypeScript/Expo/tooling upgrade |
| Bun workspaces and `workspace:*` | [Bun workspaces](https://bun.sh/docs/pm/workspaces) | Workspace/linker change |
| Hoisted Bun linker prevents duplicate physical Expo native modules | [Bun installation strategies](https://bun.sh/docs/pm/cli/install#installation-strategies), [Expo monorepos](https://docs.expo.dev/guides/monorepos/) | Bun/Expo/linker upgrade |
| Frozen root lockfile | [Bun lockfile](https://bun.sh/docs/pm/lockfile) | Package manager/CI change |
| Environment loading | [Bun environment variables](https://bun.sh/docs/runtime/environment-variables) | Env loader/runtime change |
| Built-in tests and coverage | [Bun test](https://bun.sh/docs/test), [coverage](https://bun.sh/guides/test/coverage) | Test runner upgrade |
| Dependency audit signals and path-scoped override limitation | [Bun outdated](https://bun.sh/docs/pm/cli/outdated), [Bun audit](https://bun.sh/docs/pm/cli/audit), [Bun overrides](https://bun.sh/docs/pm/overrides), [current audited exceptions](security.md#dependency-audit-snapshot) | Every upgrade/release audit |
| Task-oriented monorepo | [Turborepo structure](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository) | Task graph/package boundary change |

## Expo, React Native, and UI

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Expo SDK 57 compatibility and Node 22.13.x floor; repository requires Node `>=24.19.0 <25` and pins 24.19.0 | [Expo SDK matrix](https://docs.expo.dev/versions/latest/), [Node.js releases](https://nodejs.org/en/about/previous-releases) | Every Expo/Node/native upgrade |
| File-based universal navigation with stable JavaScript tabs on native and platform-resolved web shell composition for genuine differences | [Expo Router introduction](https://docs.expo.dev/router/introduction/), [JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/), [platform-specific extensions](https://docs.expo.dev/router/advanced/platform-specific-modules/), [navigation layouts](https://docs.expo.dev/router/basics/navigation-layouts/), [SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/) | Navigation/SDK change |
| Public client env values are bundled | [Expo environment variables](https://docs.expo.dev/guides/environment-variables/) | Client config change |
| Native modules require development builds | [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) | Native module/billing change |
| Safe-area handling | [Expo safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/) | Shell/navigation redesign |
| VoiceOver/TalkBack semantics | [React Native accessibility](https://reactnative.dev/docs/accessibility) | Component system/release |
| Build and submit store binaries | [EAS Build](https://docs.expo.dev/build/introduction/), [distribution](https://docs.expo.dev/distribution/introduction/) | Mobile release workflow |
| Incremental SDK upgrades | [Expo upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) | Expo upgrade |

## Web export and hosting

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Expo static export is a separate deployable artifact | [Expo web publishing/output modes](https://docs.expo.dev/guides/publishing-websites/) | Web output/build change |
| Firebase Hosting is the default static HTTPS/CDN target | [Firebase Hosting use cases](https://firebase.google.com/docs/hosting/use-cases), [rewrites/headers](https://firebase.google.com/docs/hosting/full-config) | Hosting/provider/route change |
| EAS Hosting is the simpler Expo-managed alternative | [Expo web deployment](https://docs.expo.dev/deploy/web/) | Hosting-provider evaluation |
| Cloud Storage custom-domain HTTPS requires a load balancer | [Cloud Storage static website](https://cloud.google.com/storage/docs/hosting-static-website) | Google Cloud static-host design |
| Fingerprinted asset caching is distinct from HTML revalidation | [Cloud CDN caching](https://cloud.google.com/cdn/docs/caching) | Cache/deploy strategy change |

## API and contracts

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Hono on Bun | [Hono Bun guide](https://hono.dev/docs/getting-started/bun) | Runtime/framework upgrade |
| Exact credentialed CORS | [Hono CORS](https://hono.dev/docs/middleware/builtin/cors) | Origin/auth topology change |
| Security response headers | [Hono secure headers](https://hono.dev/docs/middleware/builtin/secure-headers) | Browser/API exposure change |
| Unsafe cookie-authenticated `/v1` requests enforce exact Origin and JSON checks; sensitive responses are not cached | [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [RFC 9111 `no-store`](https://www.rfc-editor.org/rfc/rfc9111.html#name-no-store) | Client origin, cookie, cache, or mutation topology change |
| Boundary validation | [Hono validation](https://hono.dev/docs/guides/validation) | Contract/validator change |
| Cloud Run listener uses `0.0.0.0:$PORT` | [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract) | Container/runtime change |

## AI assistant, voice, retrieval, and product direction

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Target AI SDK 7 as a thin server-side orchestration boundary; pin exact packages only after the compatibility spike | [Vercel AI SDK 7 release](https://vercel.com/changelog/ai-sdk-7) | AI SDK/provider/Bun/Expo/Cloud Run change |
| Central provider registry and stable task aliases isolate provider/model IDs | [AI SDK provider and model management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management) | Provider, model, or gateway change |
| Models receive narrow typed tools and explicit mutation approval rather than database access | [AI SDK tools and tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) | Tool/approval API or financial-action policy change |
| Assistant turns are bounded and provider behavior is tested with mocks plus semantic evaluations | [AI SDK loop control](https://ai-sdk.dev/docs/agents/loop-control), [AI SDK testing](https://ai-sdk.dev/docs/ai-sdk-core/testing) | Orchestration, model, prompt, or evaluation change |
| Conversation persistence stores validated application messages, not provider transport objects | [AI SDK message persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence) | Conversation history/retention change |
| Expo client streaming and Hono server composition require an exact-version spike | [AI SDK Expo quickstart](https://ai-sdk.dev/docs/getting-started/expo), [AI SDK Hono example](https://ai-sdk.dev/cookbook/api-servers/hono), [Expo streaming fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/) | AI SDK, Expo, Hono, or Bun upgrade |
| Voice begins with visible bounded push-to-talk and editable server batch transcription, not always-on/realtime audio | [Expo Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/), [AI SDK transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription), [AI SDK 7 stable transcription and experimental realtime notes](https://vercel.com/changelog/ai-sdk-7) | Voice, transcription, permission, or provider change |
| ElevenLabs remains an evaluated adapter, not the architecture; if a voice brief is approved, assess the direct AI SDK provider first and use raw REST only for a measured missing capability | [AI SDK ElevenLabs provider](https://ai-sdk.dev/providers/ai-sdk-providers/elevenlabs), [ElevenLabs batch speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [Speech Engine](https://elevenlabs.io/docs/overview/capabilities/speech-engine) | Voice-provider selection, adapter capability, realtime voice, or pricing change |
| Direct-client voice credentials are minted by Pisto only after auth/authorization/consent/quota and are single-use, time-bounded, and never persisted | [ElevenLabs single-use token](https://elevenlabs.io/docs/api-reference/tokens/create), [realtime speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) | Direct-client voice or token flow change |
| Local audio deletion does not prove provider deletion; provider selection requires exact-account retention and residency evidence | [ElevenLabs Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode), [data residency](https://elevenlabs.io/docs/overview/administration/data-residency) | Provider account, privacy terms, residency, or production approval change |
| Optional TTS deterministically formats canonical money/date/quantity text and evaluates financial pronunciation before choosing a model | [AI SDK speech](https://ai-sdk.dev/docs/ai-sdk-core/speech), [ElevenLabs models and number normalization](https://elevenlabs.io/docs/overview/models) | TTS brief, provider/model, locale, or pricing change |
| Transactional product questions use relational queries; keyword search escalates from PostgreSQL full-text only with evidence | [PostgreSQL full-text search](https://www.postgresql.org/docs/18/textsearch.html) | Search corpus/job or database upgrade |
| pgvector requires a labeled semantic-retrieval evaluation and target Cloud SQL version check | [pgvector](https://github.com/pgvector/pgvector), [Cloud SQL extensions](https://cloud.google.com/sql/docs/postgres/extensions) | Approved unstructured corpus or retrieval benchmark |
| Neo4j/GraphRAG requires proven variable-depth graph or cross-document questions and a second-datastore operations plan | [Neo4j graph concepts](https://neo4j.com/docs/getting-started/graph-database/), [Neo4j GraphRAG requirements](https://neo4j.com/docs/neo4j-graphrag-python/current/) | Representative graph benchmark or retrieval architecture change |
| Treinta is product-market context for entrepreneur sales, inventory, purchases/suppliers, reports, permissions, barcodes, receipts, and synchronized mobile/web workflows—not implementation evidence | [Treinta reports](https://treinta.co/app-para-reportes-de-ventas-y-estadisticas-de-tu-negocio), [inventory and sales](https://treinta.co/software-inventario-ventas), [current features](https://treinta.co/mx/funcionalidades) | Competitive/product-scope research refresh |

## PostgreSQL and Drizzle

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| PostgreSQL 18 baseline | [PostgreSQL 18](https://www.postgresql.org/docs/18/), [18.6 release](https://www.postgresql.org/docs/release/18.6/), [Cloud SQL versions](https://cloud.google.com/sql/docs/postgres/db-versions), [official image](https://hub.docker.com/_/postgres) | Database/image upgrade |
| PostgreSQL 18+ Compose volume targets `/var/lib/postgresql`, not the legacy data subdirectory | [Official PostgreSQL image](https://hub.docker.com/_/postgres) | Every container-image major upgrade |
| Drizzle PostgreSQL driver | [Drizzle PostgreSQL guide](https://orm.drizzle.team/docs/get-started-postgresql) | Driver/ORM change |
| Code-first, reviewed migrations | [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [generate](https://orm.drizzle.team/docs/drizzle-kit-generate), [migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate) | Every schema change |
| Sales money uses constrained `bigint` minor units and composite tenant foreign keys | [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints), [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html) | Financial schema or amount-range change |
| Currency minor-unit digits are resolved server-side at onboarding and frozen into business/sale contracts | [ECMA-402 `CurrencyDigits`](https://tc39.es/ecma402/#sec-currencydigits), [`Intl.NumberFormat.resolvedOptions`](https://tc39.es/ecma402/#sec-intl.numberformat.prototype.resolvedoptions) | Currency support or formatting-runtime change |
| The universal client uses system/app locale input, a typed `es-SV` catalog, and correct static HTML language metadata | [Expo localization](https://docs.expo.dev/guides/localization/), [Expo Localization SDK](https://docs.expo.dev/versions/latest/sdk/localization/), [Expo Router static rendering](https://docs.expo.dev/router/web/static-rendering/), [i18next TypeScript](https://www.i18next.com/overview/typescript) | Second locale, locale override, RTL, or localization-library change |
| Business-local sale instants and previous-calendar-month bounds are resolved by the server | [PostgreSQL date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html), [date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html) | Time-zone, reporting-period, or occurrence-time change |
| Accepted business time-zone names must exist in both ICU and PostgreSQL and confirmed wall-clock values are snapshotted | [ECMA-402 IANA time-zone use](https://tc39.es/ecma402/#sec-use-of-the-iana-time-zone-database), [PostgreSQL time-zone names](https://www.postgresql.org/docs/current/view-pg-timezone-names.html) | Runtime/tzdb upgrade or time-zone policy change |
| Onboarding and sale plus operation receipt are atomic; same-key writes serialize before replay checks | [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html), [advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) | Mutation, idempotency, or concurrency change |
| Bounded Cloud SQL connections | [Cloud SQL connection management](https://cloud.google.com/sql/docs/postgres/manage-connections) | Pool/scaling change |
| Backup and recovery | [Cloud SQL backups](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups) | Data/recovery change |

## Authentication

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Better Auth 32+ character secret | [Better Auth installation](https://better-auth.com/docs/installation) | Auth setup/rotation change |
| Session, cookie, CSRF, and origin baseline | [Better Auth security](https://better-auth.com/docs/reference/security) | Auth upgrade/exposure change |
| Better Auth organization identity/membership backs Pisto `businessId`; active organization remains only a selector | [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization) | Organization model, product tenancy, roles, or deletion policy change |
| PostgreSQL-backed cross-instance Better Auth limiter and explicit trusted client-IP boundary | [Better Auth rate-limit storage, forwarded chains, and trusted proxies](https://better-auth.com/docs/concepts/rate-limit) | Auth/schema/proxy/scaling change |
| Raw Better Auth handler on Hono | [Better Auth Hono](https://better-auth.com/docs/integrations/hono) | Route/framework change |
| Expo SecureStore/cookie integration | [Better Auth Expo](https://better-auth.com/docs/integrations/expo), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) | Native auth change |
| Drizzle-owned auth schema | [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle) | Auth plugin/schema upgrade |
| Installed `auth` CLI stays aligned with Better Auth and generates reviewable schema output | [Better Auth CLI](https://better-auth.com/docs/concepts/cli), [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide) | Every Better Auth upgrade |
| Polar billing plugin under auth path | [Better Auth Polar plugin](https://better-auth.com/docs/plugins/polar) | Polar/Better Auth upgrade |

## Billing and entitlements

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Polar is the browser checkout | [Polar Checkout Links](https://polar.sh/docs/features/checkout/links), [Checkout API](https://polar.sh/docs/features/checkout/session) | Web checkout design/change |
| Polar webhook signature verification | [Polar endpoints](https://polar.sh/docs/integrate/webhooks/endpoints), [delivery/validation](https://polar.sh/docs/integrate/webhooks/delivery) | Webhook/SDK upgrade |
| RevenueCat wraps native StoreKit/Play Billing | [RevenueCat React Native](https://www.revenuecat.com/docs/getting-started/installation/reactnative), [Expo](https://www.revenuecat.com/docs/getting-started/installation/expo) | Native IAP integration/upgrade |
| Stable non-guessable RevenueCat App User ID | [Identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers) | Identity/restore policy change |
| Native UX checks active entitlement | [CustomerInfo subscription status](https://www.revenuecat.com/docs/customers/customer-info) | Entitlement/SDK change |
| Visible Restore Purchases | [RevenueCat restore](https://www.revenuecat.com/docs/getting-started/restoring-purchases) | Store release/identity change |
| RevenueCat webhook Authorization and optional HMAC over raw body | [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks), [sample events](https://www.revenuecat.com/docs/integrations/webhooks/sample-events) | Webhook setup/SDK change |
| Apple native digital access default | [Apple App Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/#business) | Every iOS submission |
| Google Play native digital access default and program exceptions | [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) | Every Android submission |
| Current US-specific Google Play changes | [Google Play US update](https://support.google.com/googleplay/android-developer/answer/15582165) | Every US Android submission |

Store policy rows are the most drift-prone sources in this index. Do not rely on the 2026-08-22
summary for a later submission; read the live documents and enrolled-program terms.

## Google Cloud and containers

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Multi-stage/minimal/non-root container | [Docker build best practices](https://docs.docker.com/build/building/best-practices/) | Dockerfile/base change |
| Immutable Cloud Run revisions and deployment | [Deploy containers](https://cloud.google.com/run/docs/deploying) | API release workflow |
| Startup/liveness probes | [Cloud Run health checks](https://cloud.google.com/run/docs/configuring/healthchecks) | Health/runtime change |
| Gradual traffic and rollback | [Cloud Run traffic migration](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration) | Every Cloud Run release |
| Included Cloud Build reference configures, executes, and waits for a separate one-task migration job | [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs) | Migration execution/configuration change |
| Cloud Run to Cloud SQL | [Connect from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run) | Network/database change |
| At-least-once private task handler with OIDC | [Cloud Tasks HTTP targets](https://cloud.google.com/tasks/docs/creating-http-target-tasks) | Background-work change |
| Short-lived object/method signed URLs | [Cloud Storage signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) | Upload/download design |
| Runtime secrets from Secret Manager | [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets), [Secret Manager best practices](https://cloud.google.com/secret-manager/docs/best-practices) | Secret/deployment change |
| Dedicated least-privilege service accounts | [Service-account security](https://cloud.google.com/iam/docs/best-practices-service-accounts) | IAM/service change |

## Production capability seams

| Decision | Primary official source | Review trigger |
| --- | --- | --- |
| Password recovery needs an explicit email sender | [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [email provider seam](https://better-auth.com/docs/concepts/email) | Recovery/email implementation |
| Exact static organization roles map through Pisto-owned current-operation permissions; invitations and role administration remain blocked | [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization) | Organization, role, permission, or invitation work |
| Push requires native and server delivery integration | [Expo push overview](https://docs.expo.dev/push-notifications/overview/) | Notification feature |
| Cloud Run logs are collected; production alerts/SLOs still need configuration | [Cloud Run logging](https://cloud.google.com/run/docs/logging), [Error Reporting](https://cloud.google.com/run/docs/error-reporting) | Observability deployment |
| Analytics requires a privacy design before an SDK/vendor | [Expo data and privacy](https://docs.expo.dev/guides/data-and-privacy-protection/) | Analytics/tracking feature |
| PostgreSQL stores included auth rate limits; Redis remains optional for broader API/cache needs | [Better Auth rate-limit storage](https://better-auth.com/docs/concepts/rate-limit), [Memorystore for Redis](https://cloud.google.com/memorystore/docs/redis/memorystore-for-redis-overview) | Auth/schema or measured non-auth workload need |
| Admin operations require a reviewed, audited interface | [Better Auth admin plugin](https://better-auth.com/docs/plugins/admin) | Support/admin feature |
| Backup capability requires configured backups and restore evidence | [Cloud SQL backups](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups) | Environment launch/DR change |

## Triggered reviews evaluated on 2026-08-23

The operating-core work on the current branch fired seven event-based review triggers in the tables
above. Each was evaluated and none changed its decision, so the research date on this index stands
and no re-browsing was required. These are internal architecture decisions whose external facts —
PostgreSQL, Drizzle, Hono, Expo Router, and Better Auth behavior — did not change; a fired trigger
obliges a review, not a ceremonial visit to a source that has not moved.

| Fired trigger | What fired it | Outcome |
| --- | --- | --- |
| Every schema change | Migration `0003_worried_weapon_omega.sql` added 14 tables | Unchanged. The migration is code-first, reviewed, and additive |
| Financial schema or amount-range change | New `bigint` minor-unit money columns in cash, expenses, and receivables | Unchanged. Constrained `bigint` minor units and composite tenant foreign keys were reused verbatim |
| Mutation, idempotency, or concurrency change | Four new capabilities with operation receipts and advisory locks | Unchanged. The same atomic command-plus-receipt and lock-before-replay pattern was extended; the shared primitive is documented in [PostgreSQL and Drizzle](database-drizzle.md#shared-operation-log-primitive) |
| Navigation/SDK change | The `/operate` module hub replaced the sales-only Operate area | Unchanged. Still one typed destination model with two durable shell destinations; no new navigation dependency |
| Organization model, product tenancy, roles, or deletion policy change | `sales:correct` and the operating-core permissions | Unchanged. Better Auth organization identity still backs `businessId` and active organization remains a selector |
| Organization, role, permission, or invitation work | The same permission additions | Unchanged. Invitations and role administration remain blocked; ADR 0014 was amended in place to record the omitted `sales:correct` row |
| Client origin, cookie, cache, or mutation topology change | Roughly forty new `/v1` routes, most of them mutations | Unchanged. Every one inherits the existing exact-Origin, JSON-required, and `Cache-Control: no-store` gate. The absence of a `/v1` rate limit is a recorded gap, not a changed decision |

Record a triggered review this way rather than leaving the trigger silently unevaluated. If a future
review does change a decision, add or supersede an ADR instead of editing the row.

## Repeat the audit

Run the commands and checklist in
[Versioning and upgrades](versioning-upgrades.md#repeatable-upgrade-audit), then update the research
date only after every affected live source has been reviewed. If a source changes the decision, add
or supersede an ADR rather than silently rewriting history.
