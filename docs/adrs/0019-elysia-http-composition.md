# ADR 0019: Elysia HTTP composition

- Status: Accepted
- Date: 2026-10-03
- Owners: `@pisto/api`
- Supersedes: [ADR 0003](0003-hono-bun-api.md)

## Context

The owner requested replacing Hono with Elysia to reduce repeated HTTP validation and session
resolution. Domain repositories and shared Zod contracts already own the business rules; changing
those boundaries or the Expo client's REST protocol is unnecessary.

## Decision

Use pinned Elysia 1.4.30 and its official CORS plugin 1.4.2 in `apps/api`. Declare request schemas
on routes, resolve the business actor once in the HTTP request context, and retain a single application
error boundary. Repositories continue revalidating session, membership and permission in SQL;
account and billing endpoints keep separate session policies.
Preserve public paths, response envelopes, status codes, strict query semantics, raw provider
payloads, request budgets, body limits, origin checks, logging privacy and transactional authorization.
Keep Bun's existing listener and bounded shutdown. No Eden client, OpenAPI endpoint, new product
capability, database migration or hosting change is included.

Hono with its validator could also reduce repetition with less migration work. Direct `Bun.serve`
would require maintaining routing and validation composition locally. The requested Elysia migration
uses its existing schema/lifecycle features instead of introducing a custom HTTP framework.

## Dependency review

Reviewed on 2026-10-03 against the npm registry, upstream releases and documentation:

- Elysia 1.4.30 is the stable MIT-licensed release, includes security updates and Bun 1.4 test
  updates. Elysia 2 is beta; the 1.4 line receives security fixes rather than new features.
- The owner requested a specific review of Elysia 2 before proceeding. The registry's `next`
  version was 2.0.0-beta.21 (published 2026-10-02), with CORS under `@elysia/cors@2.0.0-beta.1`.
  An isolated Bun 1.4.0 probe passed seven checks: valid/invalid Zod input, an early auth gate,
  credentialed CORS, raw body/cookie preservation, and two mounted Better Auth handler cases.
  Its isolated eight-package audit reported no advisories. This is compatibility evidence only,
  not full Pisto integration, database, deployment or beta stability acceptance. Version 2 changes
  route argument order, lifecycle/error APIs and plugins; adopting it requires a deliberate
  version choice rather than applying 1.4 examples to `elysia@next`.
- Its Standard Schema support accepts the existing Zod contracts; no parallel TypeBox contract
  model is introduced. CORS 1.4.2 is MIT-licensed and declares compatibility with Elysia >=1.4.
- Pin the MIT-licensed `@sinclair/typebox@0.34.52` runtime peer explicitly. Elysia 1.4 imports its
  symbols even when route contracts use Zod; the pre-existing hoisted 0.27 version cannot satisfy
  those imports. This dependency is runtime compatibility, not a second application schema model.
- The official CORS plugin owns credentialed origin, method and header negotiation. Pisto routes
  preflights explicitly so they also receive completion logs. Application limits, error privacy
  and auth/provider route restrictions remain explicit product policies.
- The new dependency graph must be audited and locked; upstream release notes are not a clean
  dependency-audit result. The pre-existing toolchain findings remain separately tracked.
- Exit cost is confined to HTTP composition and its tests. Neutral contracts, repositories,
  authentication configuration and the REST client remain reusable.

## Validation and recheck triggers

Run existing API contracts and failure tests through Elysia, add migration regressions for lifecycle
ordering and stream limits, run `bun run check`, dependency audit and the portable container gates.
Recheck schema/error/lifecycle compatibility and advisories on upgrades, especially before Elysia 2.
Measure removed repetition and total maintenance surface, including compatibility adapters;
make no code-size or throughput claim without measurements.

## Sources

- [Elysia 1.4.30 release](https://github.com/elysiajs/elysia/releases/tag/1.4.30)
- [Elysia 2 beta announcement](https://elysiajs.com/blog/elysia-20)
- [Elysia 2 migration work](https://github.com/elysiajs/elysia/pull/1873)
- [Elysia validation and Standard Schema](https://elysiajs.com/essential/validation)
- [Elysia lifecycle](https://elysiajs.com/essential/life-cycle)
- [Elysia CORS](https://elysiajs.com/plugins/cors)
- [Elysia security advisories](https://github.com/elysiajs/elysia/security/advisories)
- [Elysia Better Auth integration](https://elysiajs.com/integrations/better-auth)
