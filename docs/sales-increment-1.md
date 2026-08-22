# Sales Increment 1

## Status

Implemented and locally validated on 2026-08-22. It is not deployed or production-released.

This increment delivers a manual total-only sale, visible review, idempotent confirmation, canonical
result, and previous-calendar-month summary. It deliberately does not complete the approved
conversational sales milestone because void/replacement correction is still absent.

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

The navigation exposes the stable jobs `Operar` and `Cuenta`; it does not add an Assistant, Reports,
Inventory, or per-module tab before those jobs exist.

## HTTP contract

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/businesses` | List explicit business memberships and the active selector |
| `POST` | `/v1/businesses` | Create or safely replay the account's one business |
| `POST` | `/v1/sales` | Confirm or replay one total-only sale |
| `GET` | `/v1/sales/:saleId` | Read one canonical sale scoped to the active business |
| `GET` | `/v1/sales/summary/previous-month` | Calculate the previous business-local calendar month |

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
`bigint` range. CI starts PostgreSQL 18, applies migrations, and runs this integration test after the
normal checks.

The local pre-release database was also upgraded in place from migration `0001` to `0002`; its
existing USD sale retained one canonical instant and received the expected currency and wall-clock
snapshots. The migration fails closed instead of guessing an exponent for pre-existing non-USD data.

The locally exercised browser flow created a disposable account/business, confirmed one prior-month
sale, opened its canonical result, and observed the summary change from zero to the exact amount and
count. That is local evidence, not deployment evidence.

## Explicitly incomplete

- void/replacement correction and correction UX;
- AI SDK installation, typed draft proposal, Spanish evaluation set, and provider selection;
- recording, transcription, TTS, or realtime voice;
- line items, catalog, inventory, purchases, expenses, cash, customers, suppliers, tax, invoice,
  payment method, cost, or profit;
- invitations, permission administration, and domain-specific cashier/accountant roles;
- email verification delivery and password recovery;
- cross-instance product-route rate limits and a server kill switch;
- offline writes and conflict synchronization;
- crash/reload recovery for an uncertain confirmation (no financial draft is persisted to plaintext
  web storage in this increment);
- configured Polar products, native store purchases, provisioned Cloud Run/Cloud SQL, deployment,
  and production release.

The next sales increment should add transactional void/replacement correction before any session
claims that the approved first sales milestone is complete. Use the copy-ready
[next Codex session prompt](prompts/pisto-next-codex-session.md).

## Sources

- [Approved Pisto product brief](product-briefs/pisto-ai-business-assistant.md)
- [ADR 0010: organization-backed tenancy](adrs/0010-organization-backed-business-tenancy.md)
- [ADR 0011: modular capability composition](adrs/0011-modular-capabilities-and-app-owned-composition.md)
- [ADR 0012: total-only sales increment](adrs/0012-total-only-sales-increment.md)
- [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
