# ADR 0015: Business-owned currency and immutable money snapshots

- Status: Accepted
- Date: 2026-08-22
- Owners: Pisto product and platform
- Supersedes: none

## Context

Pisto must work for entrepreneurs in different countries without treating USD, a device locale, or
an environment variable as the application's currency. At the same time, sales, expenses, cash,
receivables, and future accounting records need one stable meaning that does not change when another
user signs in or presentation preferences change.

Money also crosses JavaScript, JSON, PostgreSQL, AI tools, and mobile/web interfaces. A floating-point
amount or an implicit currency would make totals, idempotency fingerprints, historical reporting,
and tool confirmation unreliable.

## Decision

### Ownership and selection

- Operating currency belongs to a business, not to the deployment, device, session, AI provider, or
  individual membership.
- An authorized user chooses one supported ISO 4217 currency while creating the business. The server
  validates the code and resolves its minor-unit exponent. The client never chooses currency on an
  individual financial command.
- Locale is a presentation preference only. `es-SV` can display a business whose operating currency
  is USD, EUR, JPY, or another supported code without changing the underlying records.
- The IANA time zone is a separate business setting. It determines business-local calendar input and
  reporting periods; it does not infer currency.

### Authoritative representation

- Authoritative monetary amounts are canonical base-10 integer strings in JSON and exact PostgreSQL
  integer/numeric values at rest. JavaScript `number` and binary floating-point arithmetic do not own
  financial calculations.
- A monetary record stores `amountMinorUnits`, `currency`, and `currencyMinorUnitDigits` together.
  Financial records also store their confirmed business-local date/minute, IANA zone, and resolved
  instant where time is relevant.
- `business_settings` is the authority used when creating a new V1 record. Every persisted record
  receives an immutable currency/exponent snapshot, so reports read the record's meaning rather than
  today's UI defaults.
- Shared contracts own the currency and money primitives. Each capability owns its records and
  operations; there is no cross-module mutable `currentCurrency` singleton.

### Change policy

- V1 does not permit changing the operating currency after financial records exist. This is an
  explicit product rule, not a hardcoded currency.
- A future currency transition requires a separate ADR and migration: an effective instant,
  immutable before/after settings, explicit reporting behavior, and no automatic conversion or
  history rewrite. Exchange-rate support is a separate capability and cannot be inferred.
- Display-only locale or formatting changes remain safe because they do not mutate canonical money.

### Boundary behavior

- Financial mutation bodies never accept `businessId`, actor, role, authoritative currency, or
  exponent. The API reloads the active business, fresh membership, settings, and named permission.
- The assistant and voice transcript may propose a human-readable amount, but deterministic code
  parses it using the active business exponent. The exact currency and minor units appear in review
  before any normal domain command can commit.
- Imports, foreign-currency transactions, and multi-currency accounts fail as unsupported until an
  approved capability defines their semantics. They do not fall back to USD or silently convert.

## Consequences

- One Pisto deployment can serve businesses with different currencies without configuration forks.
- A new module can depend on shared money primitives and business settings without coupling itself
  to sales or duplicating currency policy.
- Historical records remain interpretable if presentation settings or future business policy change.
- Currency changes and foreign-currency transactions require deliberate future work; this is safer
  than offering a misleading settings toggle.
- Database constraints may bind V1 records to create-once business settings. A future effective-date
  currency model must deliberately replace those constraints while preserving every old snapshot.

## Alternatives considered

- **Deployment-wide currency:** rejected because it prevents one installation from serving businesses
  in different countries and makes reusable templates misleading.
- **Currency per user:** rejected because two members could give the same business ledger conflicting
  meanings.
- **Currency supplied on each command:** rejected because clients and models could mix currencies in
  one ledger without an approved conversion model.
- **Decimal JSON numbers:** rejected because binary floating-point behavior is unsuitable for exact
  authoritative money and unstable fingerprints.
- **Editable current setting that rewrites old rows:** rejected because it destroys historical meaning
  and auditability.

## Validation

- Contract tests reject numeric, fractional-minor-unit, non-canonical, overflow, and untrusted
  currency fields.
- Repository tests cover currencies with zero, two, and three minor-unit digits plus unsupported
  identifiers.
- PostgreSQL integration proves each financial module snapshots the server-resolved business
  currency/exponent and prevents cross-business commands.
- UI tests prove formatting always receives an explicit locale, currency, and exponent; changing the
  UI locale cannot change persisted commands.
- Correction/reversal tests prove old monetary facts are retained and never physically rewritten.

## Official sources

- [ECMA-402 `CurrencyDigits`](https://tc39.es/ecma402/#sec-currencydigits)
- [ECMA-402 `Intl.NumberFormat`](https://tc39.es/ecma402/#numberformat-objects)
- [ISO 4217 currency codes](https://www.iso.org/iso-4217-currency-codes.html)
- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html)
