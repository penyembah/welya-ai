#!/usr/bin/env bash
# Nightly Postgres dump + uploads archive, kept for 14 days. Install with:
#   (crontab -l; echo "30 2 * * * $HOME/welya/deploy/backup.sh >> $HOME/welya-backups/backup.log 2>&1") | crontab -
set -euo pipefail
cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-$HOME/welya-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

set -a; . ./.env.docker; set +a
docker exec welya-db-prod pg_dump -U "${POSTGRES_USER:-welya}" -d "${POSTGRES_DB:-welya}" --no-owner | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
docker run --rm -v welya-v2_welya-uploads:/data:ro -v "$BACKUP_DIR":/out alpine tar czf "/out/uploads-$STAMP.tgz" -C /data . 2>/dev/null || true

find "$BACKUP_DIR" -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tgz' \) -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: db-$STAMP.sql.gz"
