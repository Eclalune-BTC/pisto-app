# Release evidence

This page summarizes what has been validated and how. Current feature status lives in
[the capability matrix](production-capabilities.md); run instructions live in
[getting started](getting-started.md). CI validates every pushed commit; inspect the run for the
exact commit before asserting its result.

## Validation

- `bun run check` runs lint, documentation links, CLI tests, workspace typechecks and tests, and the
  workspace builds including the Expo web export.
- PostgreSQL 18 integration suites (`bun run test:integration`) run against a disposable database and
  cover sales, purchases, the ledger, cash, receivables, the assistant directory, business members
  and billing projections.
- The [Postman collection](postman/pisto.postman_collection.json) runs with Newman against the local
  API, the local Worker (`wrangler dev`) and the hosted Worker. Each run creates its own account and
  business; concurrent runs hit the shared sign-up/sign-in rate limit.
- `bun run smoke:local` signs up a throwaway account, creates a business and a sale, checks the
  report, voids the sale and signs out.
- The portable Docker image replays bundled migrations, serves health and readiness, denies
  anonymous requests and exits cleanly on SIGTERM.
- Billing adapters are covered by signed fixtures (secret encodings, raw-body tampering, stale and
  future timestamps, retries, unknown events). These are local fixtures, not provider sandbox
  purchases.

## Hosted demo

The hosted demo runs under [ADR 0020](adrs/0020-cloudflare-workers-neon-hosting.md). The Neon
schema is built by the committed migrations as `pisto_migrator`; the runtime role `pisto_app` can
read, insert and update, delete only Better Auth rows, and cannot run DDL or delete sales. The demo
business is loaded by `db:seed`. A realtime probe received `business.changed` for a sale recorded by
another request, a foreign-origin handshake was refused, and the seeded member account was refused
cash and reports (403). Production web exports are built with `--clear` so Metro cannot embed a
cached local API origin.

## Browser evidence

Rendered checks sampled 320, 390, 768, 1024 and 1440 CSS-pixel widths in light and dark themes
across the home, sales, cash, expenses, catalog, inventory, customers, receivables, payables,
reports, the assistant review and account navigation. They covered horizontal overflow, keyboard
focus and Escape dismissal, compact navigation, wrapped Spanish filter labels and real validation
messages. Successful empty reads stay distinct from loading and errors; unit tests separately cover
stale, denied, offline and failed-query compositions.

A prepared sale review survives a reload with the same key and amount, including when the
confirmation response is dropped after HTTP 201; history then holds exactly one additional sale.

These checks establish bounded rendered behavior, not complete accessibility conformance,
physical-device behavior or performance targets.

## Remaining acceptance limits

New-sale reviews have [server-owned recovery](adrs/0018-durable-sale-review.md). Unreviewed inputs and
correction, cash, expense, inventory and receivable editors retain their separate recovery limits.
Physical Android/iOS, Expo Go sessions, complete accessibility, email delivery and recovery,
invitations, real provider purchases and signed store releases remain unaccepted or unimplemented as
specified in [the matrix](production-capabilities.md). Availability and performance objectives have
not been measured.
