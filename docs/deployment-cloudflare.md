# Cloudflare deployment runbook

The architecture and its reasons are in [ADR 0020](adrs/0020-cloudflare-workers-neon-hosting.md).
This page is the procedure. Run commands from the repository root unless noted.

## Prerequisites

- `npx wrangler login` with access to the Eclalune Cloudflare account. When the login can see more
  than one account, export `CLOUDFLARE_ACCOUNT_ID` for that account before running wrangler.
- The Neon connection strings for `pisto_migrator` (migrations) and `pisto_app` (runtime). Use the
  direct endpoint (host without `-pooler`) and `sslmode=require`.

## Database

```sh
# Apply committed migrations with the migration role.
DATABASE_URL='postgresql://pisto_migrator:...@<neon-host>/pisto?sslmode=require' \
DATABASE_SSL=require bun run --cwd packages/db src/migrate.ts

# Load the demo users and business once (safe to repeat).
DATABASE_URL='postgresql://pisto_app:...@<neon-host>/pisto?sslmode=require' DATABASE_SSL=require \
NODE_ENV=production BETTER_AUTH_URL=https://pisto.contact-862.workers.dev \
CORS_ORIGINS=https://pisto.contact-862.workers.dev TRUSTED_ORIGINS=https://pisto.contact-862.workers.dev,pisto:// \
EXPO_SCHEME=pisto BETTER_AUTH_SECRET='...' bun run scripts/seed.ts
```

A new database also needs the runtime grants, executed once as `pisto_migrator`:

```sql
GRANT USAGE ON SCHEMA public TO pisto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pisto_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO pisto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pisto_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pisto_app;
-- after migrating:
GRANT DELETE ON "user", session, account, verification, organization, member, invitation,
  "rateLimit" TO pisto_app;
```

## Secrets

Set once per Worker, or again to rotate. Values never go into `wrangler.jsonc` or Git.

```sh
cd apps/api
npx wrangler secret put DATABASE_URL        # pisto_app connection string
npx wrangler secret put BETTER_AUTH_SECRET  # at least 32 random characters
```

## Build and deploy

```sh
cd apps/app
APP_VARIANT=production EXPO_PUBLIC_API_URL=https://pisto.contact-862.workers.dev \
EXPO_PUBLIC_APP_SCHEME=pisto EXPO_IOS_BUNDLE_IDENTIFIER=com.eclalune.pisto \
EXPO_ANDROID_PACKAGE=com.eclalune.pisto bunx expo export --platform web --clear
cd ../api
npx wrangler deploy
```

`wrangler.jsonc` holds the non-secret variables (origins, SSL mode, pool size). The web export is
embedded with its API origin. Always export with `--clear`: Metro otherwise reuses cached modules
that inlined the local `apps/app/.env.local` origin.

## Verify

```sh
curl https://pisto.contact-862.workers.dev/ready
npx newman run docs/postman/pisto.postman_collection.json \
  -e docs/postman/pisto-production.postman_environment.json
```

`/ready` must report `"database":"ok"`. A deployment restarts the Durable Object; for a minute after
a deploy, a request can still reach the previous version.

## Workers AI

The registration assistant uses the `AI` binding declared in `wrangler.jsonc`; it needs no secret.
Set `ASSISTANT_ENABLED=false` as a variable to turn the assistant off without a code change. Models
are pinned in `packages/assistant/src/models.ts` ([ADR 0021](adrs/0021-workers-ai-registration-assistant.md)).

## Local Worker

`npx wrangler dev` in `apps/api` runs the same Worker in workerd. Put local overrides in
`apps/api/.dev.vars` (ignored by Git), for example `NODE_ENV=development`,
`BETTER_AUTH_URL=http://localhost:8787`, `CORS_ORIGINS=http://localhost:8787`, a local
`BETTER_AUTH_SECRET` and a `DATABASE_URL` (use `127.0.0.1`, not `localhost`, for a local
PostgreSQL). The AI binding is always remote: `wrangler dev` calls the real models and spends the
account's Workers AI allocation. The pinned compatibility date needs a current wrangler (4.81 is
too old), so run `npx -y wrangler@latest dev --port 8787 --ip 127.0.0.1`.

To use the web app against the local Worker, export it with `EXPO_PUBLIC_API_URL=http://localhost:8787`
and without `APP_VARIANT=production` (the production variant refuses a non-HTTPS API origin), then
restart `wrangler dev`: it keeps serving the previous `dist` and answers 404 for the new assets. A
stale `workerd` process from an earlier run can still hold port 8787. Export again with the
production command above before any `wrangler deploy`.
