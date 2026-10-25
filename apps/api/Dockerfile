# syntax=docker/dockerfile:1.7
# Build from the repo root so the workspace lockfile is in context: docker build -f apps/api/Dockerfile .
# Env (NETRA_*, WEB_ORIGINS, ...) comes from Dokploy at runtime, never from the image.

FROM oven/bun:1.4.2 AS deps
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=thya-api-bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --production --filter @thya/api

FROM oven/bun:1.4.2-slim AS runner
ENV NODE_ENV=production PORT=3001
WORKDIR /app

# Isolated installs keep the store in /app/node_modules/.bun and symlink it from apps/api/node_modules.
COPY --from=deps --chown=bun:bun /app ./
COPY --chown=bun:bun apps/api/src apps/api/src
COPY --chown=bun:bun apps/api/tsconfig.json apps/api/

USER bun
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT ?? 3001) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["bun", "src/server.ts"]
