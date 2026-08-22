# Auth package

Better Auth 1.7.1 is configured with its Drizzle adapter, the official Expo
server plugin, and the organization plugin. Polar's Better Auth plugin is added
only when Polar billing is explicitly enabled.

Rate limits are always enabled and stored in PostgreSQL so counters are shared
across Cloud Run instances. The checked-in auth schema therefore includes the
Better Auth `rateLimit` model as well as the core and organization models.

In production, `BETTER_AUTH_URL` and every web entry in `TRUSTED_ORIGINS` must
be an exact HTTPS origin. Wildcard environment entries are rejected. The only
wildcard added by the configuration is the scheme-scoped Expo deep-link pattern
derived from the validated `EXPO_SCHEME` value.

`BETTER_AUTH_SECRET` is the legacy/current single-secret fallback.
`BETTER_AUTH_SECRETS` enables versioned rotation using the Better Auth format
`2:current-value,1:previous-value`. At least one form must be configured, and
every value must contain at least 32 characters.

Run the non-network schema audit after dependency upgrades:

```sh
bun run --filter @pisto/auth auth:schema:check
```

To inspect the exact official CLI output, provide the normal API environment
variables and run:

```sh
bun run --filter @pisto/auth auth:schema:generate
```

The current Better Auth CLI is published as `auth` and is pinned to 1.7.1 so it
uses the same Better Auth schema version as the server. It writes to the ignored
`packages/auth/.generated/better-auth-schema.ts`. The in-process audit remains
the required drift check. Review CLI output against `packages/db/src/schema/auth.ts`;
do not replace application constraints or indexes without a migration review.
The CLI renders the logical `rateLimit` model as a physical `rate_limit` table;
the checked-in adapter schema retains its migrated `rateLimit` physical name
while using the required `rateLimit` schema key. It also deliberately adds
timezone-aware timestamps, foreign keys, uniqueness rules, and query indexes.
