# Sonty — Docker Setup

> Status: Design phase. Not yet deployed.
> Last updated: 2026-03-08

---

## Overview

All services run as Docker containers managed by Docker Compose. Nginx runs as a host process (not containerized) to handle SSL termination via Certbot without container restarts.

| Service | Image | Version |
|---|---|---|
| n8n | `n8nio/n8n` | `latest` (pin to specific tag before production) |
| Postgres | `postgres` | `16` |
| Redis | `redis` | `7-alpine` |
| Prometheus | `prom/prometheus` | `latest` |
| Grafana | `grafana/grafana` | `latest` |

---

## Docker Compose — Staging

File: `docker/docker-compose.staging.yml`

See `docker/` directory for full file. Key differences from production:
- `N8N_HOST=staging.automation.sonty.nl`
- `POSTGRES_DB=sonty_staging`
- Grafana not exposed publicly
- Resource limits are more relaxed for debugging

---

## Docker Compose — Production

File: `docker/docker-compose.prod.yml`

Key differences from staging:
- `N8N_HOST=automation.sonty.nl`
- `POSTGRES_DB=sonty_production`
- Grafana IP-restricted via Nginx
- Restart policies: `always`
- Log rotation configured

---

## Docker Network

All containers communicate on an internal bridge network `sonty-net`. No container ports are bound to the host except where explicitly needed. Nginx on the host proxies to containers via `127.0.0.1`.

```yaml
networks:
  sonty-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
```

---

## Volume Strategy

| Volume | Host path | Container path | Purpose |
|---|---|---|---|
| n8n data | `/opt/sonty/data/n8n` | `/home/node/.n8n` | Workflows, credentials, execution history |
| Postgres data | `/opt/sonty/data/postgres` | `/var/lib/postgresql/data` | Database files |
| Redis data | `/opt/sonty/data/redis` | `/data` | Queue persistence |
| Backups | `/opt/sonty/backups` | — | Backup output directory |

All host paths are created by the deploy script before containers start. Permissions are set correctly per service.

---

## Environment Variable Strategy

n8n and Postgres receive their configuration via `.env` files, never baked into images.

| File | Purpose |
|---|---|
| `/opt/sonty/config/.env.staging` | Staging environment variables |
| `/opt/sonty/config/.env.production` | Production environment variables |

Docker Compose reads the appropriate file via `env_file:` directive. Files are deployed to the server via the deploy script and never stored in the repository.

---

## Container Health Checks

Each service has a `healthcheck` defined:

**n8n:**
```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost:5678/healthz"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

**Postgres:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Redis:**
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 3s
  retries: 3
```

---

## Log Management

Docker logging driver: `json-file` with rotation.

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

Logs accessible via:
```bash
docker compose logs -f n8n
docker compose logs -f postgres
```

---

## Updating Containers

```bash
# Pull latest images
docker compose pull

# Recreate containers with new images (zero-downtime for n8n is not guaranteed)
docker compose up -d --force-recreate

# Verify all containers healthy
docker compose ps
```

Before updating production:
1. Test updated images in staging
2. Take Hetzner snapshot
3. Run update during off-peak hours
