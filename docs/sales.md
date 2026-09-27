# Sales

## Current scope

The manual sales flow includes business onboarding, total-only entry, server-owned review recovery,
explicit confirmation, canonical detail, bounded history, previous-month summary, and transactional
void/replacement correction. It is implemented, not a future task. AI entry and itemized sales are
separate, unimplemented capabilities; see [the capability matrix](production-capabilities.md).

A sale records revenue only. It does not deduct inventory, move cash, create a receivable, calculate
tax, or establish profit. Product UI and future assistant tools must preserve that distinction.

## User flow

1. Sign in and create or select a business with an explicit currency and IANA time zone.
2. Open `/operate/sales/new`, enter the positive total, local date/minute and optional description.
3. Review the interpreted values. Preparation stores a working review, not a posted sale.
4. Explicitly confirm, then open the canonical server result at `/operate/sales/:saleId`.
5. Find older records in `/operate/sales`; open their detail for a permitted void or replacement.

## HTTP contract

All routes below are relative to `/v1`. Implementation lives in `apps/api/src/routes/product.ts`;
request/response schemas live in `packages/contracts/src/index.ts`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/businesses` | List authorized memberships and the active selector |
| POST | `/businesses` | Create or safely replay the account's business onboarding |
| GET | `/sales` | Status-filtered keyset history; cursor and limit, default 25 and maximum 50 |
| POST | `/sales` | Direct total-only confirmation/replay; remains supported, not a recovery fallback |
| GET | `/sales/review` | Read the current actor/business's open review, or null |
| POST | `/sales/review` | Prepare the strict command with its original UUID idempotency key |
| POST | `/sales/review/:reviewId/confirm` | Confirm the stored review; body is a strict empty object |
| POST | `/sales/review/:reviewId/dismiss` | Dismiss or acknowledge using `acknowledgedSaleId` |
| GET | `/sales/:saleId` | Read the canonical sale and correction relationship |
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
`packages/db/src/sales-posting.ts`; review lifecycle is in `sale-reviews.ts`, correction in
`sales-correction.ts`, and repository composition in `product.ts`.

Permissions come from [ADR 0014](adrs/0014-static-current-operation-permissions.md). Owner, admin and
member policies permit normal sales operations; correction requires `sales:correct`, granted only to
owner/admin. Onboarding currently creates owners only; tested roles do not establish a team UI.

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
Itemized sales, automatic stock/cash effects, AI/voice, invitations, email recovery delivery and native
purchases remain separately scoped work; do not recreate the history, reports or review recovery.
