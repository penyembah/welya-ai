#!/usr/bin/env bash
# Pull the latest code, rebuild images, and roll the stack with zero manual steps.
# Migrations run automatically inside the api container on start.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.docker ] || { echo "Missing .env.docker — copy .env.docker.example and fill it in first."; exit 1; }
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.docker"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building images"
$COMPOSE build --pull

echo "==> Starting / updating containers"
$COMPOSE up -d --remove-orphans

echo "==> Waiting for API health"
for i in $(seq 1 30); do
  status=$($COMPOSE ps --format json api 2>/dev/null | grep -o '"Health":"[a-z]*"' | head -1 || true)
  if echo "$status" | grep -q healthy; then echo "API healthy"; break; fi
  sleep 2
  [ "$i" = 30 ] && { echo "API did not become healthy; recent logs:"; $COMPOSE logs --tail=50 api; exit 1; }
done

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo "==> Done"
$COMPOSE ps
