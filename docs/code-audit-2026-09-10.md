# Code audit follow-up — September 10, 2026

This review follows the component design work at `fc1b2d4`. It examines the existing implementation
and fixes reproducible defects. All work and runtime verification are local. No cloud deployment,
provider activation, repository push, new database service, or production purchase is part of this
audit.

## Coverage

Three parallel Astra reviewers covered the client, persistence/contracts, and API/auth/billing.
The integration owner reviewed repository tooling, configuration, dependencies, and the combined
changes. Review included existing tests and installed library source; a passing baseline suite did
not substitute for reproducing missing cases.

| Area | Reviewed behavior |
| --- | --- |
| Expo application | Routes and shared components; authentication; account/session transitions; Query caches; manual command confirmation; offline, stale, denied and retry states; theme selection |
| Hono API | Route composition; session/business authorization; input limits, origins, errors and logging; rate budgets; billing state and webhook boundaries |
| Persistence | Catalog/inventory, cash/expenses, customers/receivables, sales/corrections, reports; authorization locks, idempotency receipts, money, pagination, snapshots and concurrency |
| Contracts and schema | Transport validation, tenant foreign keys, canonical integer amounts, constraints, migration ownership and historical record meaning |
| Authentication and billing | Better Auth error handling and session recovery; provider projections, timestamp encoding, event ordering and entitlement lifecycle |
| Tooling | Local Compose bindings, Turbo build inputs/environment, setup/doctor, local smoke scripts, CI gates, Docker and retained infrastructure references |

This is a bounded code review with targeted automated and local runtime evidence. It does not prove
that every possible failure is absent or replace physical-device and provider-sandbox acceptance.

## Confirmed findings and corrections

| Finding | Observable effect | Correction |
| --- | --- | --- |
| Receivable payment FK lock upgrade | Concurrent payments or reversals for different charges sharing an account could deadlock with SQLSTATE `40P01` | Use PostgreSQL `FOR NO KEY UPDATE` for immutable account identity; preserve serialized balance changes |
| Invalid cursor calendar values | February 30 passed cursor syntax checks and failed inside PostgreSQL with a server error | Reuse the calendar contract and validate clock fields before casting; retain exact microseconds |
| Inventory unit editing after history | Changing kilograms to grams reinterpreted existing quantities without a conversion | Freeze unit kind after the first inventory movement, alongside precision and tracking safeguards |
| Sale detail snapshot mismatch | A concurrent correction could combine a posted status with a void correction | Read the sale and correction in one SQL statement |
| Sale posting replay omitted correction | Replaying an original confirmation after a correction returned incomplete canonical history | Include the persisted correction on replay |
| Cache ownership across account changes | A new session could inherit another user's Query cache; a late unauthorized response could sign out a newer session | Create caches per user identity, remount the account subtree, retire old callbacks and refresh the session with cookie caching bypassed |
| Implicit offline mutations | TanStack's default mode queued commands and could execute them after reconnect, even after the screen unmounted | Explicit `networkMode: "always"` and no automatic retries; failure and same-command recovery remain visible |
| Duplicate keyboard authentication submission | Repeated Enter could submit authentication while another request was pending | Synchronous submission guard shared by button and keyboard callbacks |
| Authentication navigation raced session refresh | A successful sign-in could navigate before Better Auth's delayed session signal, then bounce back to an empty sign-in form | Wait for the settled session atom to match the user returned by authentication; keep the submit lock and report refresh failures |
| Cached cash detail bypassed denial | A selected movement branch ignored an authoritative access denial; stale reversal controls remained available | Pass current remote state through the detail boundary and gate reversal controls on current permissions/freshness |
| Paused membership queries | Cached permissions could appear fresh while a refresh was paused | Include paused queries in cash and report freshness policy |
| Refreshed lists discarded financial reviews | A removed/renamed account or a movement pushed off a page could discard pending/uncertain review context | Preserve account and selected-movement snapshots within their business/account scope; retain the original command and block edits while reconciling |
| Deep-link source substituted during pagination | A source account beyond the first loaded page was replaced by the first account | Fetch the requested account through the existing detail query and show missing/archived source states explicitly |
| Theme sources disagreed | Manual Uniwind selection could disagree with navigation/status-bar appearance | Use the resolved Uniwind theme for navigation and the status bar |
| Inline sales history headings | A section rendered as another page heading and repeated its own warning styling | Reuse shared Heading levels and Alert |
| Raw webhook date parameters | Real PostgreSQL processing failed because raw SQL Date values bypassed the column encoder | Use Drizzle's table-aware comparison predicates; run webhook regressions against PostgreSQL |
| Provider error privacy | Auth framework and plugin paths could expose private driver/provider details in logs or server-error responses | Sanitize both auth error paths, preserve response cookies, and use the owned SDK state reader with safe errors |
| Polar product rollover and event ordering | Old product grants stayed active or stale events recreated old keys | Serialize projection by subscription, retire obsolete source grants and reject older projection updates |
| Polar immediate cancellation | A canceled provider status with a future period end could retain revoked access | Distinguish scheduled cancellation from immediate canceled/revoked state |
| RevenueCat lifecycle intervals | Scheduled pause, billing issues, companion cancellation and early renewal could prematurely hide paid/grace access | Respect verified expiry/grace intervals, make the billing-error companion receipt-only and preserve continuous same-user renewal intervals |
| Turbo ignored app build configuration | An app-variant change kept the same build hash; ignored `.env.local` changes did not invalidate exports | Declare app environment variables and `.env*` inputs in the package build configuration |
| Local database published on all interfaces | Default local credentials were exposed through a host-wide PostgreSQL port | Bind Compose PostgreSQL to `127.0.0.1`; devices still reach the API through its configured address |
| Doctor's custom dotenv parser | Valid inline comments or quoted hashes produced incorrect diagnostic values | Use the runtime's `node:util.parseEnv` with a regression for comments and multiline values |

## Library decisions

| Need | Decision and reason |
| --- | --- |
| Server state and mutation lifecycle | Keep TanStack Query. Its cache ownership and mutation network mode need explicit product policy; a second state manager would duplicate ownership |
| HTTP transport | Keep Axios and the existing typed API boundary; use its established cancellation/error behavior |
| Validation and exact amounts | Keep Zod contracts and canonical integer strings/BigInt. Calendar validation already exists; no floating-point money or date package is required for cursor validation |
| Database transactions | Keep Drizzle/PostgreSQL. Table-aware predicates encode dates correctly, and native row locks cover the concurrency invariant |
| Authentication and provider verification | Keep Better Auth and official provider SDKs; contain unsafe diagnostics at their actual error boundaries |
| UI consistency | Keep shared React Native components, CVA variants and Uniwind tokens. The shadcn ownership/composition approach fits; web-only DOM primitives cannot replace universal native components directly |
| Configuration parsing | Use the built-in `node:util.parseEnv`; remove the hand-written parsing loop |

No new production dependency is required for the confirmed findings. Existing package versions and
the lockfile remain unchanged. The dependency audit retains its four already-documented exceptions;
see [security](security.md).

## Validation and independent review

- `bun run check`: exit 0. Lint, documentation links, script tests, package typechecks/tests and
  web export passed. Counts: 36 script, 66 contract, 47 database, 10 auth, 24 billing, 65 API and
  229 app tests: 477 total. Log: `.cache/code-audit-check.log`.
- `bun run test:integration`: exit 0. All 46 database tests and 8 billing webhook tests passed
  against local PostgreSQL, with 371 assertions. Billing fixtures roll back; database fixtures
  clean themselves. Log: `.cache/code-audit-integration.log`. The root integration command now
  includes billing so the existing CI integration step executes these cases too.
- `bun run audit:ci`: exit 0, 752 packages, four existing documented exceptions; no new exception.
- `bun run doctor`: exit 0 with no warnings; `bun run auth:schema:check`: exit 0.
- `bun run smoke:local` against `localhost:3015` and web origin `localhost:8090`: exit 0. It
  validates the real HTTP/auth/business/sale/correction/report path and revoked-session denial;
  its synthetic sale is voided and the QA session is signed out.
- Direct Node Expo export for all three platforms: exit 0, artifacts in ignored
  `.cache/code-audit-platform-export`, log `.cache/code-audit-platform-export.log`. These are
  web assets and native Hermes bundles, not signed binaries or device tests.
- Chrome local UI: reproduced the successful-login bounce before the final fix; verified the
  corrected sign-in reaches business selection, continues to Operate, and signs out. Inspected
  both theme choices and restored System. Sales exposes one level-1 page heading and a level-2
  history heading. No additional browser environment override was left behind.
- Compose inspection confirms the existing `pisto-audit` volume remains attached and the published
  database endpoint is `127.0.0.1:55438`; API and Expo remain on the workspace's existing local ports.
- Independent cross-review resolved the paired RevenueCat grace case, paused membership refresh,
  and selected-movement page churn. Final auth/cash/session review found no remaining blocker in
  the changed paths; 33 focused review tests also passed.

All commits created in this audit use English messages. Historical commits were not rewritten.

## Remaining product limits

Full reload/unmount recovery for an uncertain financial confirmation remains incomplete. The app
does not yet provide email verification/recovery delivery, AI/voice, native store purchases,
invitations/team administration, or catalog-linked sales. Native bundles are not signed application
builds or physical-device acceptance. These limits remain in
[product requirements](product-requirements.md) and [production capabilities](production-capabilities.md).
Provider sandbox acceptance and complete native transfer/product-change reconciliation remain
unverified; local webhook fixtures establish the tested projection cases only.

The component system and restrained screen hierarchy are documented in
[the design review](component-design-review.md). No unrelated visual restyling is part of this audit.

## Primary references

The repository cleanup below supplements the earlier audit evidence; its dependency changes and
validation apply to the later working tree.

- [PostgreSQL row-level locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
- [Turborepo environment variables and dotenv inputs](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)
- [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)
- [Bun's built-in dotenv parser](https://bun.com/reference/node/util/parseEnv)
- [TanStack Query mutation network modes](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Polar subscription cancellation sequences](https://polar.sh/docs/integrate/webhooks/events)
- [RevenueCat billing-issue event flows](https://www.revenuecat.com/docs/integrations/webhooks/event-flows)
- [RevenueCat event fields and renewal timing](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)

## Repository cleanup follow-up

The owner requested a project-wide cleanup and an installation/architecture review. Three subagents
audited the frontend, dependencies, and backend/tooling. Implementations used isolated Git worktrees;
other agents reviewed the resulting changes. The starting revision was `72f5fdd`.

| Finding | Resolution |
| --- | --- |
| Unused inventory reversal component | Deleted `reversal-review.tsx`; the actual route uses `ReversalEditor`. Import analysis and reference search found no consumer |
| Unreachable customer form mutation UI | Removed idle-only mutation props, unused states, and a no-op retry callback; the review component owns confirmation |
| Shared query predicates owned by individual features | Moved them into `lib/query-state.ts` and removed a wrapper that only renamed the denial predicate |
| Sales screens implemented inside the route tree | Moved create, detail, and correction screens into `features/sales`; route files now expose the screens |
| Failed or paused source refresh could leave financial editors actionable | Block new review/confirmation while source data is stale, preserve drafts and reviewed commands, and expose in-place source retry; uncertain mutation retries retain their original idempotency key |
| Duplicate configuration templates | Removed the CLI's embedded fallback copies; checked-in examples are required before any missing target is created |
| Undeclared/unused dependency | Moved the existing Zod 4.4.3 declaration from auth to database, where runtime codecs import it |
| Invalid TypeScript alias | Removed the Zod alias to an absent app-local installation; normal workspace resolution applies |
| Unused entitlement predicate and status normalization | Removed both; new integration tests exercise actual SQL validity, scope, status, and source filtering |
| CI integration gap and repeated build | CI now runs both database and billing suites; `verify` no longer builds twice |
| Excessive comments | Shortened narration while preserving query semantics, privacy, locking, and other non-obvious invariants |
| Documentation drift | Reconciled report implementation, local-only hosting, ADR supersession, app routes, and styling/query ownership |
| Concurrent limiter response could report 61 seconds for a 60-second window | Calculate the response delay with the database clock after the UPSERT lock wait; retain the original budget accounting |

The limiter regression uses a controlled row lock to reproduce the failure before the fix. The
response now uses `clock_timestamp()` because `statement_timestamp()` precedes lock acquisition.
See [PostgreSQL current-time functions](https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).

### Dependency verification

Tailwind 4.3.3 was already current and correctly integrated with Uniwind 1.11.0 through Metro. The
installation matches the [Uniwind quickstart](https://docs.uniwind.dev/quickstart); this application
does not need a standalone Tailwind CLI or NativeWind setup. TanStack Query remains the server-state
owner, using the [documented native focus/network integration](https://tanstack.com/query/latest/docs/framework/react/react-native).
Newer Query/Uniwind releases alone did not justify changing these working integrations.

Expo CLI identified eight SDK 57 patch mismatches. `expo install --fix --bun` selected Expo 57.0.21,
Router 57.0.20, React Native 0.86.3, and the compatible constants/crypto/linking/secure-store/splash
patches. Manifests and the generated lockfile are committed sources of truth. No new library was
introduced. Two redundant same-version `expo-constants` directories left by the incremental install
were removed from `node_modules`; frozen installation then preserved one native copy and Expo Doctor
passed all 21 checks. See the [Expo upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

The shell initially resolved Bun 1.3.14, which cannot read the committed lockfile format and failed
the existing proxy-environment test. Validation uses the already available official Bun 1.4.0 binary
at `.cache/tooling/bun-1.4.0/bun-windows-x64/bun.exe`, matching the repository pin. The same test passes
under that version without modification. The user's global Bun installation was not changed.

### Follow-up validation and limits

- `bun run check`: exit 0, including 504 unit/component/script tests, workspace typechecks,
  documentation validation, and builds with Expo web export. Log: `.cache/project-audit-check.log`.
- `bun run test:integration`: exit 0 against local PostgreSQL, 47 database and 12 billing tests
  with 384 assertions. Log: `.cache/project-audit-integration.log`.
- `bun run smoke:local`: exit 0, 23 real HTTP requests, synthetic sale voided and session signed
  out. Log: `.cache/project-audit-smoke.log`.
- Expo CLI export for web, iOS, and Android: exit 0. Artifacts are in ignored
  `.cache/project-audit-platform-export`; log: `.cache/project-audit-platform-export.log`.
  These are web assets and native Hermes bundles, not signed applications or device validation.
- Frozen installation, project doctor, Expo Doctor (21/21), `db:check`, and `auth:schema:check`
  passed. `audit:ci` passes with the same four documented transitive advisories. The raw audit still
  reports them; `bun audit fix --dry-run` found no compatible automatic remediation. Logs:
  `.cache/project-audit-expo-doctor.log`, `.cache/project-audit-security.log`, and
  `.cache/project-audit-remediation.log`.
- Independent review caught and resolved the missing in-place source retry, the PostgreSQL
  statistics snapshot in the lock-wait regression, and an incomplete Settings route description.
  Re-review found no remaining blocker in the changed paths.
- This follow-up could not repeat rendered browser acceptance because the available computer-use
  surface exposed no browser. Physical-device acceptance also remains unverified. Earlier browser
  evidence above belongs to the preceding audit and does not validate these later changes.

The task keeps code, comments, tests, and documentation in English. The approved Spanish product
catalog remains unchanged. No hosting, provider activation, push, or release is part of this work.
