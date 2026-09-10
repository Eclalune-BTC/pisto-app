# Release evidence

Date: 2026-09-10. Local release validation is complete; hosted acceptance is recorded separately below.

## Provisioned infrastructure

- Neon project `wispy-violet-09001133` (`pisto-app`), PostgreSQL 18, AWS us-east-1.
- Separate `pisto_migrator` and `pisto_app` database roles; runtime connects with TLS verify-full.
- Vercel project `pisto-app-eclalune`, with the shared Bun/Hono runtime and Expo artifact.
- Railway provisioning was rejected because the existing trial expired; no paid plan was selected.

## Validation status

- Integrated `bun run check`: passed (lint, documentation, scripts, package types/tests, web build).
- PostgreSQL integration: 44 passed, 327 assertions, seven files.
- `bun run audit:ci`: passed with the four previously documented build-tool exceptions; no new exceptions.
- Production-configured Expo export: web, iOS and Android bundles built successfully. This is not a signed native binary or device test.
- Portable Docker image built, bundled migrations ran, `/ready` and `/health` returned 200,
  unauthenticated `/v1/me` returned 401, runtime user is `bun`, graceful shutdown exited 0.
- Standard PostgreSQL 18.6 dump from read-only Neon connection restored into isolated local PostgreSQL:
  29 public tables plus migration table, six migrations, 474 validated constraints, no invalid indexes.
  Source and restored schema counts match. This proves portability, not a measured recovery SLA.
- Local Chrome at 390 CSS px: sign-up, business creation, sale review/save and history succeeded.
  Accessibility review found and fixed checked-state mapping on web confirmation/radio controls.

## Hosted acceptance

The configured target is `https://pisto-app-eclalune.vercel.app`. A published URL and authenticated
smoke results are not yet claimed by this predeployment record. No physical-device, store-release,
email-delivery, AI/voice, purchase or production-SLA claim follows from successful builds.
