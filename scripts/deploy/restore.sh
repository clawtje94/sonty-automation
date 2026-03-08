#!/usr/bin/env bash
# =============================================================================
# Sonty — Restore Script
# Restores Postgres from a pg_dump backup file.
#
# Usage:
#   ./restore.sh [staging|production] /path/to/backup.sql.gz
#
# WARNING: This will DROP and recreate the database. Use with caution.
# Always confirm with the operator before running in production.
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
BACKUP_FILE="${2:-}"
APP_DIR="/opt/sonty"
CONFIG_FILE="$APP_DIR/config/.env.$ENVIRONMENT"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 [staging|production] /path/to/backup.sql.gz"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# ─── Load config ────────────────────────────────────────────────────────────
# shellcheck disable=SC1090
source "$CONFIG_FILE"

echo "============================================================"
echo " Sonty Restore — $ENVIRONMENT"
echo " Backup file: $BACKUP_FILE"
echo " Database: $POSTGRES_DB"
echo "============================================================"
echo ""
echo "WARNING: This will DROP the existing database and restore from backup."
read -rp "Type 'yes' to confirm: " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

# ─── Stop n8n to prevent writes during restore ─────────────────────────────
echo "==> Stopping n8n..."
docker stop "sonty-n8n-$ENVIRONMENT" "sonty-n8n-worker-$ENVIRONMENT" 2>/dev/null || true

# ─── Restore Postgres ──────────────────────────────────────────────────────
echo "==> Restoring Postgres from $BACKUP_FILE..."

# Drop and recreate database
docker exec "sonty-postgres-$ENVIRONMENT" \
  psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
docker exec "sonty-postgres-$ENVIRONMENT" \
  psql -U "$POSTGRES_USER" -c "CREATE DATABASE $POSTGRES_DB;"

# Restore from dump
gunzip -c "$BACKUP_FILE" | docker exec -i "sonty-postgres-$ENVIRONMENT" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "  Postgres restore complete."

# ─── Restart n8n ────────────────────────────────────────────────────────────
echo "==> Restarting n8n..."
docker start "sonty-n8n-$ENVIRONMENT" "sonty-n8n-worker-$ENVIRONMENT"

echo ""
echo "==> Restore complete. Verify the application is healthy:"
echo "  docker compose -f $APP_DIR/docker/docker-compose.$ENVIRONMENT.yml ps"
