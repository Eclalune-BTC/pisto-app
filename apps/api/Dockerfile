FROM oven/bun:1.4.0 AS build

WORKDIR /workspace

COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/app/package.json ./apps/app/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/billing/package.json ./packages/billing/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/db/package.json ./packages/db/package.json

RUN bun install --frozen-lockfile --production

COPY apps/api/src ./apps/api/src
COPY packages/auth/src ./packages/auth/src
COPY packages/billing/src ./packages/billing/src
COPY packages/contracts/src ./packages/contracts/src
COPY packages/db/src ./packages/db/src
COPY packages/db/migrations ./packages/db/migrations

RUN bun build apps/api/src/index.ts \
      --outfile apps/api/dist/bundled-index.js \
      --target bun \
    && bun build packages/db/src/migrate.ts \
      --outfile packages/db/dist/bundled-migrate.js \
      --target bun

FROM oven/bun:1.4.0-slim AS release

WORKDIR /workspace
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0

COPY --from=build --chown=bun:bun \
  /workspace/apps/api/dist/bundled-index.js \
  ./apps/api/dist/bundled-index.js
COPY --from=build --chown=bun:bun \
  /workspace/packages/db/dist/bundled-migrate.js \
  ./packages/db/dist/bundled-migrate.js
COPY --from=build --chown=bun:bun \
  /workspace/packages/db/migrations \
  ./packages/db/migrations

USER bun
EXPOSE 3001/tcp

ENTRYPOINT ["bun", "apps/api/dist/bundled-index.js"]
