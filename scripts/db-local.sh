#!/usr/bin/env bash
# Local Postgres for apps/api: same image as Dokploy (thya-db) and CI, bound to localhost only.
# Matches DATABASE_URL and TEST_DATABASE_URL in .env.example. The thya/thya login is local-only.
# Capped for a 16 GB laptop shared with other projects: 512 MB, 1 CPU, no auto-restart.
# Usage: scripts/db-local.sh        start (creates the container on first run)
#        scripts/db-local.sh stop   stop it, keeping the data volume
set -euo pipefail

NAME=thya-postgres
IMAGE=pgvector/pgvector:0.8.7-pg17
PORT=5452
LIMITS=(--memory 512m --memory-swap 512m --cpus 1)

if [[ "${1:-}" == "stop" ]]; then
  docker stop "$NAME" >/dev/null && echo "$NAME stopped"
  exit 0
fi

if docker container inspect "$NAME" >/dev/null 2>&1; then
  # Containers made before the caps existed get them on the next start.
  docker update "${LIMITS[@]}" "$NAME" >/dev/null
  docker start "$NAME" >/dev/null
else
  docker run -d --name "$NAME" "${LIMITS[@]}" \
    -e POSTGRES_USER=thya -e POSTGRES_PASSWORD=thya -e POSTGRES_DB=thya \
    -p "127.0.0.1:$PORT:5432" \
    -v thya-pgdata:/var/lib/postgresql/data \
    "$IMAGE" >/dev/null
fi

until docker exec "$NAME" pg_isready -U thya -d thya -q; do sleep 1; done

# Disposable database for RUN_INTEGRATION_TESTS=1 (tests truncate it, never point them at thya).
if [[ -z "$(docker exec "$NAME" psql -U thya -d thya -Atc "SELECT 1 FROM pg_database WHERE datname = 'thya_test'")" ]]; then
  docker exec "$NAME" createdb -U thya thya_test
fi

echo "$NAME ready on localhost:$PORT (databases thya, thya_test). Migrate with: bun run --cwd apps/api db:migrate"
