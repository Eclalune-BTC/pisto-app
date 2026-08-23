# Sales Increment 1

## Status

Implemented and locally validated. The work is committed on a local branch only: it is not pushed to
`origin/main`, not deployed, and not production-released.

This file is retained as the Increment 1 delivery record plus the sales-correction work that followed
it on the same branch. It is not the current-state summary of the product. Read
[the documentation map](README.md) and the
[operating core slice records](product-slices/operating-core-v1.md) for that.

This increment delivers a manual total-only sale, visible review, idempotent confirmation, canonical
result, and previous-calendar-month summary. Transactional void and replacement correction landed
afterwards and is recorded in [Sales correction](#sales-correction) below. The approved
conversational sales milestone remains incomplete: no assistant, model, or voice capability exists,
and no `GET /v1/sales` list exists to reach a sale the user has navigated away from.

## Observable flow

1. An authenticated user creates one business at `/business` with a display name, ISO currency, and
   IANA time zone.
2. Pisto creates a Better Auth organization, an exact `owner` membership, business settings, and the
   active organization in one database transaction.
3. `/operate/sales/new` accepts the total, business-local date/minute, and optional description.
4. The client converts the amount to a minor-unit decimal string without floating-point arithmetic
   and shows an explicit review state.
5. Confirmation sends one UUID idempotency key. The API reloads a fresh session and `sales:create` access,
   resolves the local minute, and commits the sale plus operation receipt atomically.
6. `/operate/sales/:saleId` reloads the canonical server record instead of trusting optimistic state.
7. `/operate/sales` queries the previous local calendar month and labels gross revenue as revenue,
   never profit.
8. `/operate/sales/correct/:saleId` reviews a void or a replacement for a sale the client still
   holds, and the confirmed command returns the updated canonical records.

The navigation exposes the stable jobs `Operar` and `Cuenta`. `Operar` opens the `/operate` module
hub, which lists only the modules the current role can read; it does not add an Assistant, Reports,
or per-module tab before those jobs exist.

## HTTP contract

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/businesses` | List explicit business memberships and the active selector |
| `POST` | `/v1/businesses` | Create or safely replay the account's one business |
| `POST` | `/v1/sales` | Confirm or replay one total-only sale |
| `GET` | `/v1/sales/:saleId` | Read one canonical sale scoped to the active business |
| `GET` | `/v1/sales/summary/previous-month` | Calculate the previous business-local calendar month |
| `POST` | `/v1/sales/:saleId/void` | Void or replay one posted sale with an explicit reason |
| `POST` | `/v1/sales/:saleId/replace` | Void the original and post the reviewed replacement atomically |

There is no `GET /v1/sales` list route. The two correction routes are mounted and tested, but a
client can only reach them while it still holds the sale identifier.

Financial commands do not accept a `businessId`, user ID, currency, role, or status from the client.
Strict Zod schemas reject unknown fields.

## Persistence and invariants

- `business_settings` owns create-once currency, server-frozen minor-unit exponent, and time zone for
  an organization-backed business.
- `sale` owns posted/voided status, total-only entry mode, positive `bigint` minor units,
  currency/exponent and confirmed local date/minute/time-zone snapshots, occurrence instant,
  description, actor, and creation time.
- `sale_operation` is the append-only idempotency/audit receipt. Its composite foreign key prevents a
  receipt from binding a sale from another business.
- The unique operation key is `(business_id, actor_user_id, idempotency_key)`. The command fingerprint
  distinguishes a safe replay from reuse with changed input.
- Business deletion, actor deletion, and operation deletion cascade are intentionally not available
  through product APIs; restrictive foreign keys preserve financial history.
- Summary bounds are `[previous local month start, current local month start)` converted to UTC from
  one query timestamp. `occurred_at`, not `created_at`, decides the period.

## Failure and recovery behavior

- Missing or stale authentication returns `UNAUTHORIZED`.
- Missing active business returns `BUSINESS_REQUIRED`; it is not represented as an empty summary.
- Missing membership, an unknown/composite role, or a role without the named action returns `FORBIDDEN`.
- Invalid money, currency, time zone, date, or local minute returns `VALIDATION_ERROR`.
- Reusing an idempotency key with changed input returns `IDEMPOTENCY_CONFLICT`.
- Network or server uncertainty keeps the exact review command and key while the review screen stays
  mounted, including unreadable or contract-invalid `2xx` responses, so an in-place retry is safe.
- Summary query failure is shown as an error. Only a successful query can return a zero/count-empty
  result.

## Sales correction

Correction is implemented in `packages/db/src/sales-correction.ts`, exposed by the two `POST` routes
above, and surfaced at `/operate/sales/correct/:saleId`. It is the only way a posted sale changes.

### Canonical data

`sale_correction` is append-only. Each row stores the business, the original sale, the replacement
sale or `null`, the actor, the caller-created UUID idempotency key, the SHA-256 command fingerprint,
the kind `void` or `replacement`, a 2-to-240-character reason, and the creation time. Database checks
require a `void` row to have no replacement, a `replacement` row to have one, the two sale
identifiers to differ, and the fingerprint to be 64 lowercase hexadecimal characters. Composite
foreign keys bind both the original and the replacement sale to the same business, and restrictive
delete behavior preserves the history.

### Invariants

- One correction per original sale and one per replacement sale, enforced by unique indexes on
  `(business_id, original_sale_id)` and `(business_id, replacement_sale_id)`. A corrected sale
  cannot be corrected again, and a replacement cannot be created from another correction.
- Only a `posted` sale can be corrected. The status update itself is conditional on `posted`, so a
  concurrent correction conflicts rather than voiding a sale twice.
- A replacement snapshots the fresh `business_settings` currency, exponent, and time zone, and
  resolves its own explicit local date and minute. The original occurrence time is never copied
  silently.
- The correction, the void of the original, and any replacement sale commit in one transaction.
- The unique key is `(business_id, actor_user_id, idempotency_key)` across both `sale_operation` and
  `sale_correction`, so a key already used to post a sale cannot be reused to correct one.

### Permission and authorization

Correction requires `sales:correct`, which [ADR 0014](adrs/0014-static-current-operation-permissions.md)
grants to `owner` and `admin` and withholds from `member`. The transaction takes the command-key
advisory lock first, then reloads an unexpired session whose active organization matches the
server-resolved business `for update`, then locks the current membership row and checks the exact
permission. Approval on the client is not authorization; the check runs again inside the transaction
that commits.

### Failure model

- `UNAUTHORIZED` when the session is missing, expired, or no longer bound to the active business.
- `FORBIDDEN` when the membership is gone or the role lacks `sales:correct`.
- `NOT_FOUND` when the sale belongs to another business or does not exist; the two are indistinguishable.
- `VALIDATION_ERROR` for a reason outside 2 to 240 characters, an invalid replacement amount, or an
  ambiguous, nonexistent, or malformed replacement local minute.
- `CONFLICT` when the sale is already corrected, is not `posted`, or was corrected by a concurrent
  operation.
- `IDEMPOTENCY_CONFLICT` when the key was used for a sale posting, for a different correction, or for
  the same correction with changed input. An exact replay returns the original correction, the
  original sale, and any replacement with `replayed: true`.

## Local verification

```sh
bun run db:migrate
bun --env-file=.env run --filter @pisto/db test:integration
bun run check
bun run build
```

The PostgreSQL integration test uses isolated users/businesses and cleans only those records. It
also proves onboarding rollback when the session disappears, safely adopts a sole-owner legacy
organization instead of creating a second one, rejects unapproved member roles, revalidates an
unexpired session inside sale transactions, and sums multiple valid sales beyond one row's signed
`bigint` range. It covers correction directly: `member` is denied `sales:correct`, an exact void
replays, a changed reason on the same key conflicts, a replacement links both sales bidirectionally,
and a replacement cannot itself be corrected. CI starts PostgreSQL 18, applies migrations, and runs
all four repository integration suites — product, catalog, cash, and receivables — after the normal
checks.

The local pre-release database was also upgraded in place from migration `0001` to `0002`; its
existing USD sale retained one canonical instant and received the expected currency and wall-clock
snapshots. The migration fails closed instead of guessing an exponent for pre-existing non-USD data.

The locally exercised browser flow created a disposable account/business, confirmed one prior-month
sale, opened its canonical result, and observed the summary change from zero to the exact amount and
count. That is local evidence, not deployment evidence.

## Explicitly incomplete

This list covers sales specifically. Catalog, inventory, expenses, cash, customers, and receivables
were delivered as their own slices; see [Operating core V1](product-slices/operating-core-v1.md).

- `GET /v1/sales`, so a past sale cannot be rediscovered and correction is unreachable for it;
- exact operating reports beyond the contract in `packages/contracts/src/reports.ts`;
- AI SDK installation, typed draft proposal, Spanish evaluation set, and provider selection;
- recording, transcription, TTS, or realtime voice;
- sale line items, linked catalog products, automatic stock deduction from a sale, purchases,
  suppliers, tax, invoice, payment method, cost, or profit;
- invitations, permission administration, and domain-specific cashier/accountant roles;
- email verification delivery and password recovery;
- entitlement gating of product routes, cross-instance product-route rate limits, and a server kill
  switch;
- offline writes and conflict synchronization;
- crash/reload recovery for an uncertain confirmation (no financial draft is persisted to plaintext
  web storage in this increment);
- configured Polar products, native store purchases, provisioned Cloud Run/Cloud SQL, deployment,
  and production release.

The remaining sales gap is `GET /v1/sales`. Without a tenant-scoped, bounded, cursor-paged sale list
and a screen that uses it, the implemented correction flow is reachable only for a sale the client
still holds in memory, and no session may claim that the approved first sales milestone is complete.
The current copy-ready mission is the
[next Codex session prompt](prompts/pisto-next-codex-session.md).

## Sources

- [Approved Pisto product brief](product-briefs/pisto-ai-business-assistant.md)
- [ADR 0010: organization-backed tenancy](adrs/0010-organization-backed-business-tenancy.md)
- [ADR 0011: modular capability composition](adrs/0011-modular-capabilities-and-app-owned-composition.md)
- [ADR 0012: total-only sales increment](adrs/0012-total-only-sales-increment.md)
- [ADR 0014: static current-operation permissions](adrs/0014-static-current-operation-permissions.md)
- [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
