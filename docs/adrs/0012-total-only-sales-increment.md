# ADR 0012: Total-only manual sales

- Status: Accepted; current permissions and recovery are refined by ADRs 0014 and 0018
- Original decision: 2026-08-22
- Owners: Application, API, contracts, database and authentication

## Decision

Keep the structured total-only sales path independently usable without an AI provider. A sale has
an explicit review/confirmation, canonical result, bounded history, previous-calendar-month summary
and transactional void/replacement correction. Those operations are implemented; their current
contract and source ownership are in [sales](../sales.md).

The Better Auth organization ID backs `businessId`. The server resolves the live actor and active
business and reloads exact permission membership for each operation. Onboarding creates the owner;
[ADR 0014](0014-static-current-operation-permissions.md) owns the owner/admin/member policy. Raw
organization creation/deletion, invitation, member and role mutation remain blocked at the API edge.

Money crosses JSON as canonical integer strings in minor units and is stored as positive PostgreSQL
bigint. Onboarding freezes the server-derived currency exponent. The sale records the confirmed
currency, exponent, local date/minute, IANA zone and resolved instant; ambiguous/nonexistent local
times fail validation. The client does not select a trusted currency, status or authorization scope.

Confirmation and its operation receipt commit atomically. The receipt binds actor, business, UUID
key and command fingerprint: exact replay returns the same result and changed input conflicts.
Session/membership authorization locks precede the command-key lock. New-sale reviews now persist
on the server under [ADR 0018](0018-durable-sale-review.md); reviewing is never authorization and
opening/recovering a review never posts automatically.

The previous-month query derives half-open business-local bounds and queries posted occurrence time
for exact gross/count and rounded average. Query failure is not zero revenue, and revenue is not profit.

## Consequences and exclusions

A total-only sale does not imply product lines, stock deduction, cash posting, credit, tax, fiscal
invoices, profit, multiple currencies or exchange-rate conversion. Those need separate product/data
contracts. AI and voice remain unimplemented interfaces over the same approved commands and queries.

Unreviewed fields remain in memory. Corrections and other financial editors retain their separate
recovery limits; new-sale review recovery is not a generic outbox. Financial payloads are not added
to plaintext client storage. The complete conversational milestone and native-device acceptance
are not established by the manual core.

## Rationale and validation

Keeping exact domain code in existing owners avoids a sales microservice or generic transaction
framework. No signed preparation token replaces fresh server authorization. Currency/time snapshots
preserve reviewed meaning instead of trusting current device formatting. Idempotency and correction
preserve records rather than deleting history.

Contract/API tests cover strict input and denial. PostgreSQL integration covers tenant isolation,
concurrency, replay/conflicts, rollback, exact pagination, reporting periods and review recovery.
Browser and device evidence are separate; see [release evidence](../release-evidence.md).

## Official sources

- [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [ECMA-402 currency digits](https://tc39.es/ecma402/#sec-currencydigits)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization)
