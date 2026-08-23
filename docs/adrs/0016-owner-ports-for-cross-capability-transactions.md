# ADR 0016: Owner ports for cross-capability transactions

- Status: Accepted
- Date: 2026-08-22
- Owners: product domains, `@pisto/db`, `@pisto/api`
- Supersedes: none
- Research recheck: extraction of either capability into another service or database

## Context

Some Pisto actions have one user-visible outcome but affect records owned by different capabilities.
Applying a receivable payment is the first concrete case: receivables owns the charge and payment,
while cash owns account validity, balance policy, and the append-only cash movement ledger.

Letting receivables write `cash_movement` ad hoc would bypass the cash capability's invariants.
Committing the payment and movement in separate requests or through an asynchronous event would allow
one to succeed without the other. A generic event bus, workflow engine, or service split would add
failure modes without a current independent scaling or ownership need.

## Decision

Pisto keeps cross-capability financial invariants inside the modular monolith and one PostgreSQL
transaction.

- The capability that owns the user command coordinates the transaction. For receivable settlement,
  receivables owns command validation, replay identity, charge locking, overpayment policy, payment
  insertion, and the final operation receipt.
- The affected capability exposes a narrow internal owner port. Cash owns
  `cash/receivable-ledger.ts`, which validates and locks the selected active account, enforces the
  business currency snapshot, appends the incoming movement, and applies cash-balance policy to its
  reversal.
- The port accepts the existing transaction executor and a purpose-specific typed input. It is not a
  generic repository, table gateway, event registry, or public API.
- The server resolves one fresh session, active organization, membership, and all required named
  permissions. A payment requires both `receivables:manage` and `cash:manage`; the client and model
  cannot choose the business or assert either permission.
- Composite foreign keys bind the payment to a same-business cash account and the cash movement to a
  same-business payment. Immutable currency snapshots and reversal links remain database constrained.
- Exact replay returns the recorded payment result without creating another movement. Any account,
  balance, FK, movement, payment, or operation-receipt failure rolls back the complete command.

This pattern is used only for a synchronous invariant that must commit together. Independent external
side effects may use an outbox later, but an outbox does not replace the authoritative transaction.

## Consequences

- A user never receives a successful receivable payment without the matching cash fact.
- Each capability retains one owner for its write rules while avoiding a generic service layer.
- Reversal can fail truthfully when the original cash is no longer available in a protected account;
  the receivable history is unchanged when that happens.
- The port and transaction executor are in-process boundaries. Extracting either capability into a
  different service or database requires a new ADR and a different consistency model.

## Alternatives considered

- **Receivables writes the cash table directly:** rejected because cash invariants would have multiple
  owners and would drift as new cash rules are added.
- **Two sequential API calls:** rejected because partial success is possible and retries cannot prove
  one financial outcome.
- **Publish an event after payment:** rejected for this invariant because asynchronous delivery allows
  a visible receivable settlement before cash is authoritative.
- **Generic unit of work or event bus:** rejected because it hides ownership and creates abstraction
  before a second justified use case exists.
- **Separate services with distributed transactions:** rejected because Pisto has no measured runtime
  boundary that justifies the operational and consistency cost.

## Validation

- Fresh PostgreSQL 18 migrations create all composite targets before their foreign keys.
- Integration tests prove concurrent overpayment protection, exact replay without duplicate cash,
  same-business account enforcement, one payment reversal, the opposite cash movement, permission
  denial, stale-session denial, and full rollback.
- Schema checks prove both cross-capability foreign keys remain represented in Drizzle metadata.

## Official sources

- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Drizzle ORM transactions](https://orm.drizzle.team/docs/transactions)
- [Drizzle ORM indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
