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

Apply migrations before deploying a Worker built from the same commit. Migration
`0012_account_provider_identity` drops `account.issuer` (required by Better Auth 1.7.0-1.7.2, unused
from 1.7.3) and cannot be reverted, so create a Neon branch first and confirm no account would
violate the new unique index:

```sql
SELECT provider_id, account_id, count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;
```

A Worker running Better Auth 1.7.18 against a database that still has the `NOT NULL` `issuer`
column fails every sign-up.

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
EXPO_ANDROID_PACKAGE=com.eclalune.pisto bunx expo export --platform web --clear --max-workers 1
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

## Films and range requests

Workers static assets answer a `Range` request with the whole file and status 200, so a video
served by them cannot seek (Cloudflare documents the limitation and the workaround in
[cloudflare-docs#34856](https://github.com/cloudflare/cloudflare-docs/pull/34856), read on
2026-11-19). `/media/*` therefore runs the Worker first, and `apps/api/src/media-range.ts` builds
the 206 response from the `ASSETS` binding. It reads the whole file for each range, which suits a
few short films; move larger media to object storage instead. After a deployment, check it:

```sh
curl -s -D - -o /dev/null -H "Range: bytes=0-999" https://pisto.contact-862.workers.dev/media/recorrido-pisto.mp4
```

The response must be `206` with `Content-Range: bytes 0-999/<size>`. `wrangler dev` routes the same
path through the Worker, so chapters can be checked locally too.

## Workers AI

The registration assistant uses the `AI` binding declared in `wrangler.jsonc`; it needs no secret.
On the free plan the account has 10,000 neurons a day, shared by the hosted demo's dictation,
`wrangler dev` and any evaluation run against Workers AI; on 2026-11-19 one evaluation of the 31 cases, the film capture sessions
and the earlier checks of that day spent all of it. When it
runs out the binding fails at once and dictation answers 503 until 00:00 UTC; sentences keep
working on the hosted demo because DeepSeek reads them. Run local evaluations and capture sessions
with that budget in mind.
Set `ASSISTANT_ENABLED=false` as a variable to turn the assistant off without a code change. Models
are pinned in `packages/assistant/src/models.ts` ([ADR 0021](adrs/0021-workers-ai-registration-assistant.md)).

DeepSeek reads every sentence sent to Coco (`ASSISTANT_EXTRACTION_PROVIDER=deepseek` in
`wrangler.jsonc`, [ADR 0024](adrs/0024-deepseek-sentence-extraction.md)) and the product-specific
follow-ups; Workers AI keeps dictation. Run `bunx --no-install wrangler secret put DEEPSEEK_API_KEY`
from `apps/api` and enter the key at the prompt; the Worker refuses to start without it. To
evaluate the deployed provider, run
`bun ./eval/run.ts https://pisto.contact-862.workers.dev https://pisto.contact-862.workers.dev deepseek-flash`
from `packages/assistant`: it signs in as the demo owner and only reads. Authenticated clients request
`GET /v1/assistant/status?include=catalog` to check `catalogConversation`. For a deployment check,
ask the price of the demo ground coffee, ask how much three cost and accept the quote. The sale
editor should open with three units at the current catalog price. End the check before saving.

Type “¿Cuánto vendí el mes pasado?” in Coco's field on the home. The answer must state the
month's gross sales and the number of sales, and `GET /v1/assistant/answers` must return 200. Then
ask “¿Quiénes me quedaron debiendo?” to exercise the model's classification.

Sign in with the demo owner and open **Nuevo registro**. The authenticated
`GET /v1/assistant/status` should return `enabled: true` and `transcription: true`. Dictate
“Pagué 64 dólares de luz con transferencia”, check the transcription, then choose **Usar este texto**.
Confirm the $64 amount on **Revisar gasto** and end the check before saving.

## Local Worker

Run `bunx --no-install wrangler dev --port 8787 --ip 127.0.0.1` in `apps/api` to use the
repository's pinned Wrangler and the same AI binding on the local Worker. Put local overrides in
`apps/api/.dev.vars` (ignored by Git), for example `NODE_ENV=development`,
`BETTER_AUTH_URL=http://localhost:8787`, `CORS_ORIGINS=http://localhost:8787`, a local
`BETTER_AUTH_SECRET` and a `DATABASE_URL` (use `127.0.0.1`, not `localhost`, for a local
PostgreSQL). `wrangler.jsonc` selects DeepSeek for sentences, so the local Worker needs either
`DEEPSEEK_API_KEY` or `ASSISTANT_EXTRACTION_PROVIDER=workers-ai` in `.dev.vars`; without one of
them it refuses to start. With `workers-ai` it calls the account's Workers AI allocation.
The standalone Bun API shows the assistant as unavailable unless its Workers AI REST credentials
are configured.

To use the web app against the local Worker, export it with `EXPO_PUBLIC_API_URL=http://localhost:8787`
and without `APP_VARIANT=production` (the production variant refuses a non-HTTPS API origin), then
restart `wrangler dev`: it keeps serving the previous `dist` and answers 404 for the new assets. A
stale `workerd` process from an earlier run can still hold port 8787. Export again with the
production command above before any `wrangler deploy`.
