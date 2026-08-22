# Pisto Stack contributor guide

## Architecture boundaries

- apps/app owns the Expo Router user interface and platform adapters.
- apps/api owns HTTP composition, middleware, health checks, and request handling.
- packages/contracts owns transport-neutral schemas and public API types.
- packages/db owns PostgreSQL schema, migrations, and repositories.
- packages/auth owns Better Auth server configuration.
- packages/billing owns provider adapters and entitlement decisions.
- scripts owns the local CLI and must remain safe to run repeatedly.
- docs owns operational decisions and links to primary sources.

## Engineering rules

- Use English for source code, comments, command output, errors, and documentation.
- Follow the product visual language in `docs/frontend-expo-ui.md`; preserve the Pisto palette and
  inspect rendered UI before making visual judgments.
- Do not add decorative glows, floating cards, gradients, pills, shadows, or icon tiles without a
  concrete hierarchy, interaction, state, feedback, or brand purpose.
- Never invent plan data, progress, account activity, saved settings, or success-shaped fallbacks to
  make an incomplete feature appear finished.
- Do not read provider credentials in client-side code.
- Treat billing webhooks as untrusted, retried, and possibly out of order.
- Keep the internal entitlement model provider-neutral.
- Keep web checkout disabled for native digital features by default. Any regional exception
  requires an explicit policy review, enrolled program, release gate, and dedicated ADR.
- Add an environment variable to the relevant .env.example when code requires it.
- Add or update a test for business logic and security-sensitive behavior.
- Run bun run check before handing work off.
