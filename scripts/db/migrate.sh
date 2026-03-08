#!/usr/bin/env bash
# =============================================================================
# Sonty — Database Migration Script
# Applies SQL migration files in order to the Postgres database.
#
# Usage:
#   ./migrate.sh [staging|production]
#
# Migrations are applied in filename order (001_, 002_, etc.).
# Already-applied migrations are tracked in the 'schema_migrations' table.
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
APP_DIR="/opt/sonty"
CONFIG_FILE="$APP_DIR/config/.env.$ENVIRONMENT"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# ─── Load config ────────────────────────────────────────────────────────────
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Config file not found: $CONFIG_FILE"
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

echo "==> Running migrations on $ENVIRONMENT ($POSTGRES_DB)..."

# ─── Ensure migrations tracking table exists ────────────────────────────────
docker exec "sonty-postgres-$ENVIRONMENT" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );
" > /dev/null

# ─── Apply pending migrations ───────────────────────────────────────────────
APPLIED=0
SKIPPED=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
  [[ -f "$migration_file" ]] || continue
  version=$(basename "$migration_file" .sql)

  # Check if already applied
  ALREADY_APPLIED=$(docker exec "sonty-postgres-$ENVIRONMENT" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")

  if [[ "$ALREADY_APPLIED" -gt 0 ]]; then
    echo "  SKIP: $version (already applied)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  APPLY: $version"
  # Apply migration
  docker exec -i "sonty-postgres-$ENVIRONMENT" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$migration_file"

  # Record as applied
  docker exec "sonty-postgres-$ENVIRONMENT" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "INSERT INTO schema_migrations (version) VALUES ('$version');" > /dev/null

  APPLIED=$((APPLIED + 1))
done

echo "==> Migrations complete: $APPLIED applied, $SKIPPED skipped."
