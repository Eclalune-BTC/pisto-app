# Sales

## Current scope

The manual sales flow includes business onboarding, itemized counter sales, total-only entry with
server-owned review recovery, explicit confirmation, canonical detail, bounded history, previous-month
summary, and transactional void/replacement correction. AI entry is a separate capability; see
[the capability matrix](production-capabilities.md).

A sale has one of two entry modes. A **total-only** sale records revenue only: it does not deduct
inventory, move cash or create a receivable. An **itemized** sale (user stories HU-07 to HU-09)
records product lines and, in the same transaction, takes tracked stock out, records the amount
received in one cash account and opens any balance as a receivable for the named customer. Neither
mode calculates tax or profit.

## User flow

1. Sign in and create or select a business with an explicit currency and IANA time zone.
2. Open `/operate/sales/new`. "Con productos" (the default) takes an optional customer, the local
   date/minute, product lines found by name or SKU with quantity and price, an optional note, the
   amount received with its payment method and account, and for any balance the agreed payment date.
   "Solo el total" keeps the total-only entry below.
3. A total-only entry is reviewed first: preparation stores a working review, not a posted sale, and
   only an explicit confirmation posts it. An itemized sale is posted by "Guardar venta" with its own
   idempotency key; an unknown outcome keeps the form locked until the same command is resent.
4. Open the canonical server result at `/operate/sales/:saleId`: product lines, settlement and a link
   to the receivable of an itemized sale.
5. Find older records in `/operate/sales`; open their detail for a permitted void or replacement.

`ItemizedSaleForm` (`apps/app/src/features/sales/itemized/itemized-sale-form.tsx`) reads the active
business itself and accepts an assistant sale draft, so the assistant review can render it: every
field the draft resolved is pre-filled and unmatched products are named for the person to add.

## HTTP contract

All routes below are relative to `/v1`. Implementation lives in `apps/api/src/routes/sales.ts`;
request/response schemas live in `packages/contracts/src/index.ts`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/businesses` | List authorized memberships and the active selector |
| POST | `/businesses` | Create or safely replay the account's business onboarding |
| GET | `/sales` | Status-filtered keyset history; cursor and limit, default 25 and maximum 50 |
| POST | `/sales` | Direct total-only confirmation/replay; remains supported, not a recovery fallback |
| POST | `/sales/itemized` | Post or replay one itemized sale with its stock, payment and receivable |
| GET | `/sales/form-options` | Active payment accounts (id, name, kind) without balances, for sellers |
| GET | `/sales/review` | Read the current actor/business's open review, or null |
| POST | `/sales/review` | Prepare the strict command with its original UUID idempotency key |
| POST | `/sales/review/:reviewId/confirm` | Confirm the stored review; body is a strict empty object |
| POST | `/sales/review/:reviewId/dismiss` | Dismiss or acknowledge using `acknowledgedSaleId` |
| GET | `/sales/:saleId` | Read the canonical sale, correction relationship and itemized `details` |
| GET | `/sales/summary/previous-month` | Calculate the previous business-local calendar month |
| POST | `/sales/:saleId/void` | Void a posted sale once with an explicit reason |
| POST | `/sales/:saleId/replace` | Void the original and post its reviewed replacement atomically |

Financial commands cannot choose their actor, business, currency, role or status. The server resolves
the session/business and validates strict input. Reads are tenant-scoped and authenticated results
are not cacheable by intermediaries. Product budgets and the write-pause switch cover review routes.

## Persistence and authorization

`business_settings` owns currency, the server-frozen minor-unit exponent and time zone. `sale` stores
positive bigint minor units, currency/exponent, confirmed local date/minute/time zone, resolved
instant, actor, description and posted/voided status. Money crosses JSON as canonical integer strings,
not floating-point major units.

`sale_operation` records the command fingerprint and `(business_id, actor_user_id, idempotency_key)`.
An exact replay returns the same sale; changed input conflicts. Composite foreign keys prevent
cross-business links. Restrictive deletion and explicit correction preserve financial history.

Transactions authorize the live session and membership before taking the command-key lock, then lock
the affected records. Never restore the older key-before-authorization order. Posting is shared by
`packages/db/src/sales/posting.ts`; review lifecycle is in `sales/reviews.ts`, correction in
`sales/corrections.ts`, reads in `sales/queries.ts`, and repository composition in `sales.ts`.

Permissions come from [ADR 0014](adrs/0014-static-current-operation-permissions.md). Owner, admin and
member policies permit normal sales operations; correction requires `sales:correct`, granted only to
owner/admin. Onboarding currently creates owners only; tested roles do not establish a team UI.

## Itemized sales

`POST /v1/sales/itemized` requires `sales:create`, so a seller (member) can sell on credit without
cash or receivable permissions. The server validates that every product, the customer and the account
belong to the active business and are active, and computes every amount in bigint: a line's unit
price defaults to the product's selling price (a line with neither is refused), its subtotal is
`quantityMinorUnits × unitPrice / 10^quantityPrecision` rounded half up, and the total is their sum.
The app always sends the price the person saw. Each product appears on one line. The amount received
cannot exceed the total; a balance requires the customer and a due date on or after the sale date, and
a fully paid sale carries no due date.

One transaction locks the customer (`FOR SHARE`), the products (`FOR UPDATE`, identifier order) and
the account (`FOR NO KEY UPDATE`), then inserts the receivable, the `sale` row with its settlement
columns, the `sale_line` rows, one `sale` inventory movement per tracked line (refused with
`CONFLICT` when stock is short), one `sale_payment` cash movement for the amount received and the
`sale_operation` receipt. Catalog, cash and receivables own those writes through internal ports
(`catalog/sale-stock.ts`, `cash/sale-ledger.ts`, `receivables/sale-receivable.ts`) per
[ADR 0016](adrs/0016-owner-ports-for-cross-capability-transactions.md). Replay shares the sales key
space and returns the current sale, including a later void.

The sale owns its receivable link: `sale.receivable_id` references
`receivable(business_id, customer_id, id)`, so the debt always belongs to the customer the sale names,
and a check requires the link exactly when there is a balance. A link on both tables would be a
circular foreign key that PostgreSQL can only satisfy with deferred constraints.

Voiding an itemized sale (`sales:correct`) voids its receivable, reverses each stock movement and
reverses the payment in the same transaction, dated at the sale's occurrence so the period that
showed the sale shows it undone. It refuses with `CONFLICT` when the receivable has net payments or
the account cannot cover the reversal. Replacement stays total-only and refuses an itemized original.
Sale stock movements and sale receivables can only be undone through the sale; the inventory reversal
and receivable void commands refuse them.

## Review recovery

[ADR 0018](adrs/0018-durable-sale-review.md) owns the complete lifecycle and privacy contract.
Migration `0006` adds one open `sale_review` per actor/business. It freezes the reviewed command,
currency, exponent and zone. Confirmation commits the sale, receipt and recoverable result together.

Opening or reloading the screen only reads. It never posts automatically. A saved result remains
recoverable until its exact sale ID is acknowledged. A cancellation racing with confirmation must
return the saved result instead of hiding it. Closing clears the financial command payload but keeps
the closed key so a delayed request cannot recreate the review.

Unreviewed fields remain in memory. No financial draft is persisted in browser/native client storage.
Corrections and other financial editors do not yet have this durable recovery. An HTTP timeout or
malformed success response is an uncertain outcome, not proof that the sale was not saved.

## Correction and reporting

`sale_correction` records a void or replacement, the actor, a 2-to-240-character reason, command
identity and both sale references. Only posted sales without an existing correction relationship can
be corrected. Neither an already corrected original nor its replacement can be corrected again.
The original void, replacement if any, and correction receipt commit in one transaction.

Sale posting and correction guard against reuse of an already committed key for the other action.
Fresh authorization, fingerprint checks, deterministic money/time validation and replay behavior
apply to corrections too. Replacement values use their own explicitly reviewed local date/minute;
the original timestamp is not silently copied.

Previous-month summary uses occurrence time in half-open business-local calendar bounds, not record
creation time. It returns exact gross/count and a rounded average. The broader operating report is
also implemented at `/v1/reports/operating`; it separates selected-period flows from current positions.
Neither report calls revenue profit. Only a successful query may return zero values.

## Validation and limits

Sales/review contracts, API routes and app recovery tests cover invalid payloads, authentication,
recovery states and explicit actions. PostgreSQL integration covers concurrent duplicate confirmation,
tenant/actor isolation, changed settings, confirm/dismiss races, rollback, corrections and exact
history pagination. Run database tests only against a verified isolated target.

Use [testing and release](testing-release.md) for commands and [release evidence](release-evidence.md)
for actual results. Passing unit tests or exporting Hermes bundles is not physical-device acceptance.
AI/voice, invitations, email recovery delivery and native purchases remain separately scoped work;
do not recreate the history, reports or review recovery.
