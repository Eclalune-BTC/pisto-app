# Pisto product requirements

Review: 2026-09-10. Actor: an owner operating a small business in Spanish, across web, Android and
iOS. This specification separates the implemented manual operating core from release gates and
future capabilities. Requirements describe acceptance, not proof that production meets every target.

## Delivery contract

The current delivery makes the existing manual core understandable, reliable and deployable. A user
signs in, creates or selects a business, records a reviewed operation, receives its canonical result,
and can find, inspect and correct that record later. PostgreSQL owns business facts; the client owns
drafts and presentation. AI and voice remain additional input channels with separate delivery gates.

Prerequisites are a working account, explicit currency and IANA timezone, an active business and a
fresh server-authorized permission. Sales do not implicitly move cash or stock. A recorded expense
does move cash; a receivable payment does move cash. These differences must remain visible.

## Functional requirements

| ID | Requirement and acceptance | State / owner |
| --- | --- | --- |
| FR-01 | Sign up, sign in and sign out; a wrong password never reveals account data; logout clears account caches. | Implemented; Better Auth / app. Full delivery and device acceptance still required. |
| FR-02 | Confirm business name, currency and timezone before first operation; reload actual session/membership on every command. | Implemented; business repository and onboarding. |
| FR-03 | Enter a positive total-only sale, review date/amount, confirm once and open the persisted result. Identical retries return the same sale. | Implemented; sales. |
| FR-04 | Find older sales with status filters and cursor pagination. Void once or atomically replace with an explicit reason; preserve both records. | Implemented; sales history/corrections. |
| FR-05 | Create and maintain categories/products, unique business names/SKUs, units and optional price. Archive instead of removing history. | Implemented; catalog. |
| FR-06 | Receive/adjust/reverse stock through signed movements; show derived stock and low stock. No sale silently deducts stock. | Implemented; inventory. |
| FR-07 | Create cash accounts, inspect derived balances, adjust and transfer between accounts atomically. Apply each account's negative-balance policy. | Implemented; cash. |
| FR-08 | Review a paid expense and cash account, save expense plus cash effect atomically; void with an auditable reversal. | Implemented; expenses/cash. |
| FR-09 | Search active/archived customers without losing keyboard focus during requests; inspect contact and receivable history. | Implemented; customers. |
| FR-10 | Create charges, record payments, reverse payments and void eligible charges. Never overpay or cross a business boundary. | Implemented; receivables/cash. |
| FR-11 | Show exact period sales/expenses/collections and current stock/cash/debt in distinct sections, with currency, timezone and query timestamp. Do not label revenue minus expenses as profit. | Implemented; reports. |
| FR-12 | Keep search, filters and date controls available while a read loads or fails. Empty, stale, denied and unavailable states remain distinct. | Implemented UX hardening; browser evidence recorded separately. |
| FR-13 | Refresh relevant lists and reports after canonical mutations and when native returns to the foreground. No automatic retry of a financial write. | Implemented; TanStack Query / domain invalidators. |
| FR-14 | Pause all business writes while preserving queries/authentication; enforce a shared per-user read/write request budget across replicas. | Implemented; API middleware / PostgreSQL operational limiter. |
| FR-15 | Deliver verification and password recovery using a selected email provider; include expiry, enumeration resistance and session revocation tests. | Release gap; no email provider or delivery flow is configured. |
| FR-16 | Invite a teammate and administer least-privilege access with verified acceptance and revocation. | Future slice; tested role matrices alone do not make invitations usable. |
| FR-17 | Accept Spanish text, return an editable typed sale draft or clarification, and commit only after explicit approval through the same command. | Future slice; AI is not installed or presented as working. |
| FR-18 | Capture bounded push-to-talk audio, show an editable transcript, and use the same confirmation path. | Future slice after FR-17; physical-device, privacy and provider gates. |
| FR-19 | Paid access uses verified provider-neutral entitlements and tested store flows. | Billing adapters exist but are disabled; native purchases and entitlement migration need evidence. |

## Nonfunctional requirements

Targets below are proposed release criteria. A passing unit test does not establish availability,
performance, device behavior, email delivery or recovery.

| ID | Requirement | Acceptance evidence / target |
| --- | --- | --- |
| NFR-01 | Tenant isolation | Unauthenticated, expired, revoked and cross-business reads/writes fail; API plus real PostgreSQL negative tests. Cached data is hidden after fresh access denial. |
| NFR-02 | Exact financial data | Integer minor units and frozen currency exponent; bounded quantity precision; no floating-point ledger arithmetic. Foreign keys and CHECK constraints reject invalid records. |
| NFR-03 | Atomicity and replay safety | Concurrent duplicate requests create one canonical operation; no half transfer/payment/expense; a consistent row/advisory lock order prevents known cross-module deadlocks. |
| NFR-04 | Complete pagination | Stable ordered keyset cursor preserves PostgreSQL microseconds and unique ID; no skipped records at identical timestamps; page-size limits enforced server-side. |
| NFR-05 | Read consistency | Multi-query financial detail/report uses one repeatable snapshot; a payment committed concurrently cannot make the displayed balance disagree with displayed payments. |
| NFR-06 | Accessible interaction | Target WCAG 2.2 AA on web; labelled controls, visible focus, keyboard operation, meaningful heading/landmarks, busy/disabled/error semantics, non-color-only status and at least 44-point primary hit targets. Manual screen-reader audit remains required. |
| NFR-07 | Responsive layouts | No horizontal page overflow at 390, 768 and 1440 CSS px; short-height navigation remains reachable; native safe areas and keyboard never cover the confirmation action. Record screenshots and actual devices separately. |
| NFR-08 | Performance | Proposed p95 API reads under 800 ms and writes under 1.5 s at an agreed 20 concurrent-user dataset; web p75 LCP under 2.5 s and INP under 200 ms. Measure before claiming these targets. Cold starts are reported separately. |
| NFR-09 | Bounded failure | HTTP timeout 30 s in Axios; one retry only for transient reads; zero automatic mutation retries. Uncertain mutations retain their idempotency key and block edits until resolved. |
| NFR-10 | Availability and recovery | Proposed 99.5% monthly API availability, RPO 24 h and RTO 4 h for beta. Requires monitoring and an actual off-provider backup/restore exercise; Neon free retention alone does not prove these targets. |
| NFR-11 | Privacy and transport | TLS with certificate verification, secure HTTP-only session cookies, exact origins, private credential storage, no tokens/records/raw paths in application logs. No database/provider credential in Expo bundles. |
| NFR-12 | Abuse protection | Default 300 reads and 60 writes per authenticated user per 60 s, shared atomically in PostgreSQL; 429 includes Retry-After; failed limiter storage denies execution. Auth has its own limiter. Edge unauthenticated abuse limits remain an operational gate. |
| NFR-13 | Maintainability | Feature components share semantic primitives; Expo owns screens, Hono HTTP, contracts transport, Drizzle persistence. Tests cover behavior/invariants, not incidental markup. |
| NFR-14 | Portability | Standard PostgreSQL dump/restore and SQL migrations; one Docker API; static Expo artifact; narrow hosting adapter; no Neon/Vercel SDK in domain code. Test the exit path before a provider move. |
| NFR-15 | Supply chain | Exact reviewed dependencies and frozen lockfile; typecheck/tests/lint/build plus dependency audit, migration checks and container smoke before publishing. Exceptions list an advisory, reachability, owner and review date. |
| NFR-16 | Release truth | Record commit, runtime/artifact, migration, host URL and smoke results. Distinguish implemented, built, locally tested, remotely deployed and store released. |

## UI and data specifications

[UX requirements](ux-requirements.md) defines the view inventory, reusable components, states and
responsive wireframes. [Data model](data-model.md) defines the ER model, normalized owners, immutable
snapshots, derived balances, query models, indexes and constraints. Neither turns planned behavior
into an implemented feature.

## Prioritized remaining product work

1. Validate the hosted owner lifecycle and manual financial loop; instrument availability and backup
   recovery, then complete responsive and device acceptance.
2. Deliver verified email/recovery and user-controlled session revocation before broad production use.
3. Decide reversal behavior for archived cash accounts and voided receivables; ship explicit business
   rules plus transactional/UX tests, not silent exceptions.
4. Add the bounded text assistant only with provider configuration, cost limits, Spanish evaluations
   and confirmation/denial tests. Voice follows that proven workflow.
5. Add invitations, catalog-linked sales and inventory deduction as separately coherent slices;
   define their permissions and accounting effects before schema expansion.
6. Enable billing only after product-change entitlement reconciliation, provider sandbox and native
   purchase validation. Publish iOS/Android only with signing, store configuration and device evidence.
