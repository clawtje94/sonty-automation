#!/usr/bin/env bash
# =============================================================================
# Sonty — Deployment Script
# Deploys or updates the Sonty automation stack on the VPS.
#
# Usage:
#   ./deploy.sh [staging|production]
#
# Requires:
#   - provision.sh has been run on this server
#   - /opt/sonty/config/.env.[environment] exists
#   - Docker and Docker Compose are installed
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="/opt/sonty"
CONFIG_FILE="$APP_DIR/config/.env.$ENVIRONMENT"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: $0 [staging|production]"
  exit 1
fi

echo "==> Deploying Sonty [$ENVIRONMENT]..."

# ─── Pre-flight checks ─────────────────────────────────────────────────────
echo "==> Running pre-flight checks..."

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Config file not found: $CONFIG_FILE"
  echo "Copy configs/example.env to $CONFIG_FILE and fill in values."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not installed. Run provision.sh first."
  exit 1
fi

# ─── Ensure data directories exist ─────────────────────────────────────────
echo "==> Ensuring data directories exist..."
mkdir -p "$APP_DIR/data/n8n"
mkdir -p "$APP_DIR/data/postgres"
mkdir -p "$APP_DIR/data/redis"
mkdir -p "$APP_DIR/backups/postgres"
mkdir -p "$APP_DIR/backups/n8n"
mkdir -p "$APP_DIR/logs"

# Fix n8n directory permissions (n8n runs as UID 1000)
chown -R 1000:1000 "$APP_DIR/data/n8n" 2>/dev/null || true

# ─── Deploy Docker Compose ─────────────────────────────────────────────────
echo "==> Deploying Docker Compose stack..."
COMPOSE_PATH="$REPO_DIR/docker/$COMPOSE_FILE"

if [[ ! -f "$COMPOSE_PATH" ]]; then
  echo "ERROR: Compose file not found: $COMPOSE_PATH"
  exit 1
fi

# Copy compose file to app dir
cp "$COMPOSE_PATH" "$APP_DIR/docker/$COMPOSE_FILE"

cd "$APP_DIR/docker"

# Pull latest images
echo "==> Pulling Docker images..."
docker compose -f "$COMPOSE_FILE" --env-file "$CONFIG_FILE" pull

# Start or update services
echo "==> Starting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$CONFIG_FILE" up -d --force-recreate

# ─── Deploy Nginx config ────────────────────────────────────────────────────
echo "==> Deploying Nginx configuration..."
NGINX_SRC="$REPO_DIR/nginx/$ENVIRONMENT"

if [[ -d "$NGINX_SRC" ]]; then
  cp "$NGINX_SRC"/*.conf /etc/nginx/sites-available/

  for conf_file in "$NGINX_SRC"/*.conf; do
    filename=$(basename "$conf_file")
    ln -sf "/etc/nginx/sites-available/$filename" "/etc/nginx/sites-enabled/$filename"
  done

  nginx -t && systemctl reload nginx
  echo "Nginx config deployed and reloaded."
else
  echo "WARNING: No Nginx config found for $ENVIRONMENT at $NGINX_SRC"
fi

# ─── Copy scripts to server ─────────────────────────────────────────────────
echo "==> Deploying scripts..."
cp "$REPO_DIR/scripts/deploy/backup.sh" "$APP_DIR/scripts/backup.sh"
cp "$REPO_DIR/scripts/deploy/restore.sh" "$APP_DIR/scripts/restore.sh"
chmod +x "$APP_DIR/scripts/"*.sh

# ─── Run database migrations ───────────────────────────────────────────────
echo "==> Running database migrations..."
"$REPO_DIR/scripts/db/migrate.sh" "$ENVIRONMENT"

# ─── Health check ──────────────────────────────────────────────────────────
echo "==> Waiting for services to be healthy..."
sleep 10

UNHEALTHY=0
for service in n8n postgres redis; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "sonty-$service-$ENVIRONMENT" 2>/dev/null || echo "not found")
  if [[ "$STATUS" == "healthy" ]]; then
    echo "  ✓ $service: healthy"
  else
    echo "  ✗ $service: $STATUS"
    UNHEALTHY=$((UNHEALTHY + 1))
  fi
done

if [[ $UNHEALTHY -gt 0 ]]; then
  echo ""
  echo "WARNING: $UNHEALTHY service(s) not healthy. Check logs:"
  echo "  docker compose -f $APP_DIR/docker/$COMPOSE_FILE logs"
  exit 1
fi

# ─── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " Deployment complete: $ENVIRONMENT"
echo "============================================================"
if [[ "$ENVIRONMENT" == "staging" ]]; then
  echo " n8n:    https://staging.automation.sonty.nl"
  echo " Grafana: https://staging.grafana.sonty.nl"
else
  echo " n8n:    https://automation.sonty.nl"
  echo " Grafana: https://grafana.sonty.nl"
fi
echo ""
