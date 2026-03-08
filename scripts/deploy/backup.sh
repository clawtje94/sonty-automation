#!/usr/bin/env bash
# =============================================================================
# Sonty — Backup Script
# Backs up Postgres and n8n data to local storage and Hetzner Object Storage.
#
# Usage:
#   ./backup.sh [staging|production]
#
# Scheduled via cron: 0 3 * * * /opt/sonty/scripts/backup.sh >> /opt/sonty/logs/backup.log 2>&1
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
APP_DIR="/opt/sonty"
BACKUP_DIR="$APP_DIR/backups"
CONFIG_FILE="$APP_DIR/config/.env.$ENVIRONMENT"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
ALERT_EMAIL="admin@sonty.nl"     # Replace with actual alert recipient

# ─── Load config ────────────────────────────────────────────────────────────
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Config file not found: $CONFIG_FILE"
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

echo "==> Starting backup [$ENVIRONMENT] at $TIMESTAMP"

BACKUP_FAILED=0

# ─── Postgres backup ────────────────────────────────────────────────────────
echo "==> Backing up Postgres..."
PG_BACKUP_DIR="$BACKUP_DIR/postgres/$DATE"
mkdir -p "$PG_BACKUP_DIR"
PG_BACKUP_FILE="$PG_BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

if docker exec "sonty-postgres-$ENVIRONMENT" \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$PG_BACKUP_FILE"; then
  echo "  Postgres backup: $PG_BACKUP_FILE ($(du -sh "$PG_BACKUP_FILE" | cut -f1))"
else
  echo "  ERROR: Postgres backup failed"
  BACKUP_FAILED=1
fi

# ─── n8n data backup ────────────────────────────────────────────────────────
echo "==> Backing up n8n data..."
N8N_BACKUP_DIR="$BACKUP_DIR/n8n/$DATE"
mkdir -p "$N8N_BACKUP_DIR"
N8N_BACKUP_FILE="$N8N_BACKUP_DIR/n8n_${TIMESTAMP}.tar.gz"

if tar -czf "$N8N_BACKUP_FILE" -C "$APP_DIR/data" n8n/ 2>/dev/null; then
  echo "  n8n backup: $N8N_BACKUP_FILE ($(du -sh "$N8N_BACKUP_FILE" | cut -f1))"
else
  echo "  ERROR: n8n backup failed"
  BACKUP_FAILED=1
fi

# ─── Upload to Hetzner Object Storage ──────────────────────────────────────
# Requires s3cmd or aws CLI configured with Hetzner Object Storage credentials
if command -v s3cmd &>/dev/null; then
  echo "==> Uploading to Hetzner Object Storage..."
  BUCKET="s3://sonty-backups/$ENVIRONMENT/$DATE/"

  if [[ -f "$PG_BACKUP_FILE" ]]; then
    s3cmd put "$PG_BACKUP_FILE" "$BUCKET" --quiet && echo "  Uploaded: $PG_BACKUP_FILE"
  fi

  if [[ -f "$N8N_BACKUP_FILE" ]]; then
    s3cmd put "$N8N_BACKUP_FILE" "$BUCKET" --quiet && echo "  Uploaded: $N8N_BACKUP_FILE"
  fi
else
  echo "  SKIP: s3cmd not configured — skipping remote upload"
fi

# ─── Prune old local backups (keep 30 days) ─────────────────────────────────
echo "==> Pruning old local backups..."
find "$BACKUP_DIR/postgres" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
find "$BACKUP_DIR/n8n" -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
echo "  Local pruning complete."

# ─── Alert on failure ───────────────────────────────────────────────────────
if [[ $BACKUP_FAILED -ne 0 ]]; then
  SUBJECT="[Sonty] Backup FAILED on $ENVIRONMENT — $TIMESTAMP"
  BODY="One or more backup jobs failed. Check /opt/sonty/logs/backup.log on the $ENVIRONMENT server."
  if command -v mail &>/dev/null; then
    echo "$BODY" | mail -s "$SUBJECT" "$ALERT_EMAIL"
  fi
  echo "ERROR: Backup completed with errors. Alert sent to $ALERT_EMAIL."
  exit 1
fi

echo "==> Backup complete at $(date +%H:%M:%S)"
