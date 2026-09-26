# ADR 0018: Server-owned recovery of a reviewed sale

- Status: Accepted
- Date: 2026-09-26
- Owners: Sales, API, and universal application
- Scope: New total-only sales; not corrections or other financial operations

## User outcome and contract

An authenticated actor with `sales:create` can resume the same reviewed sale after navigation,
reload, or signing back into the same account. Opening the screen only reads. Preparing a review
does not post a sale. A separate explicit confirmation posts through the existing sale transaction,
idempotency key, money/time validation, authorization, and audit record.

PostgreSQL owns one open review per actor and business. Its bounded strict command snapshot is
working data, not a financial record. The review freezes currency, exponent, and time zone.
Unconfirmed reviews cannot silently adopt changed business settings. A confirmed review retains the
canonical sale reference until acknowledged; a lost response therefore does not require a new sale.

Preparing, confirming, and dismissing acquire authorization locks, then the command-key lock,
then review rows. Confirm and dismiss serialize: dismissing a saved sale returns its reference,
never a claim that it was cancelled. A dismissed review cannot be confirmed or recreated by a
delayed request. The normal direct sale command remains supported, with the same review-key guard;
the client does not fall back to that endpoint when recovery fails.

A dismissal only closes a confirmed review when the request explicitly acknowledges that exact
sale ID. If confirmation won a race with an edit/cancel request, the review stays open and returns
the saved sale reference. Losing that response cannot hide the committed sale on the next reload.

## Persistence, privacy, and failure behavior

The client keeps unreviewed fields in memory only. No financial payload, token, or session is added
to localStorage, sessionStorage, IndexedDB, or a native store. Server reads require fresh session,
membership, and permission checks; the existing account-scoped query cache is not persisted.

Acknowledgement or dismissal clears the review command, including its amount and free-text note.
Minimal closed-key metadata remains to reject delayed retries and preserve the saved-sale reference.
There is at most one open payload per actor/business. An uncertain review does not expire silently.
Deleting an account/business or pruning closed keys requires a separately reviewed retention rule;
ordinary application code cannot cascade away financial records or reopen an old key.

Loading, offline, denied, failed-read, failed-prepare, uncertain-confirmation, and failed-dismissal
states must remain distinguishable. Recovery never creates an automatic replay queue. API write
pauses, request limits, origin checks, JSON validation, and no-store policy also cover these routes.

## Alternatives

Plaintext browser persistence exposes financial drafts independently of server authorization.
Client encryption with a key stored alongside the payload does not fix that boundary. A generic
durable outbox would add unrelated job and retry semantics. Existing PostgreSQL transactions,
Drizzle, Zod, and TanStack Query suffice; no dependency or platform adapter is added.

## Acceptance and exclusions

Test lost prepare/confirm/dismiss responses; remount and explicit recovery; double confirmation;
confirm/dismiss ordering; delayed preparation after dismissal; same-key changed payload; concurrent
tabs; different accounts/businesses; expired sessions; changed time zone; and ledger rollback.
The migration is additive and must be exercised on an isolated PostgreSQL database. Compile the
universal client and inspect web behavior; do not infer physical-device acceptance from unit tests.

No AI, voice, sale lines, inventory deduction, automatic cash posting, offline writes, new team
roles, hosting, or recovery for other financial modules is included.

## Primary sources

Reviewed 2026-09-26; recheck on storage, authorization, PostgreSQL, or transaction-boundary changes.

- [OWASP HTML5 storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis)
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
