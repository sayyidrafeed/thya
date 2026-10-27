# syntax=docker/dockerfile:1.7
# Build from the repo root so the workspace lockfile is in context: docker build -f apps/web/Dockerfile .

FROM oven/bun:1.4.4 AS builder
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg is required" >&2 && exit 1)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=thya-web-bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter web

COPY apps/web apps/web
WORKDIR /app/apps/web
RUN --mount=type=cache,id=thya-web-next,target=/app/apps/web/.next/cache \
    bun run build && \
    find out -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' \
      -o -name '*.json' -o -name '*.txt' -o -name '*.xml' \) -exec gzip -k -9 {} +

# The CSP must allow the API origin, or the demo chat cannot reach the agent.
RUN api_origin="$(bun -e 'console.log(new URL(process.env.NEXT_PUBLIC_API_URL).origin)')" && \
    sed "s|__API_ORIGIN__|${api_origin}|" nginx.conf > /tmp/nginx.conf

FROM nginxinc/nginx-unprivileged:1.31.6-alpine-slim AS runner
COPY --from=builder /tmp/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/web/out /usr/share/nginx/html
EXPOSE 3000
