# Sonty — VPS Architecture

> Status: Design phase. Not yet provisioned.
> Last updated: 2026-03-08
> Provider: Hetzner Cloud

---

## Server Specification

| Property | Value |
|---|---|
| Provider | Hetzner Cloud |
| Type | CPX21 (or CX32) |
| vCPU | 4 |
| RAM | 8 GB |
| Disk | 80 GB SSD |
| OS | Ubuntu 22.04 LTS |
| Region | Falkenstein (EU) — `fsn1` |
| Networking | Public IPv4 + IPv6 |
| Firewall | Hetzner Cloud Firewall (hardware-level) |
| Backups | Hetzner automated snapshots enabled |

Two identical servers are provisioned:

| Server | Hostname | Purpose |
|---|---|---|
| Staging | `sonty-staging` | Pre-production validation |
| Production | `sonty-prod` | Live system (provisioned after staging is validated) |

---

## Service Stack

```
┌─────────────────────────────────────────────────┐
│                   Hetzner VPS                   │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │              Nginx (host)                │   │
│  │   Reverse proxy · SSL termination        │   │
│  │   Ports: 80 (redirect) · 443             │   │
│  └──────────────┬───────────────────────────┘   │
│                 │ Docker network: sonty-net      │
│  ┌──────────────┴───────────────────────────┐   │
│  │           Docker Compose                 │   │
│  │                                          │   │
│  │  ┌─────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │   n8n   │  │ Postgres │  │ Redis  │  │   │
│  │  │  :5678  │  │  :5432   │  │  :6379 │  │   │
│  │  └─────────┘  └──────────┘  └────────┘  │   │
│  │                                          │   │
│  │  ┌──────────────────────────────────┐    │   │
│  │  │  Prometheus + Grafana (optional) │    │   │
│  │  │        :9090         :3000       │    │   │
│  │  └──────────────────────────────────┘    │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Volumes (persistent, on host):                 │
│  /opt/sonty/data/n8n                            │
│  /opt/sonty/data/postgres                       │
│  /opt/sonty/data/redis                          │
│  /opt/sonty/backups                             │
└─────────────────────────────────────────────────┘
```

---

## Network Architecture

```
Internet
    │
    │  443 (HTTPS) + 80 (redirect to HTTPS)
    ▼
Hetzner Cloud Firewall
    │  Allow: 22 (SSH from allowlist only), 80, 443
    │  Deny: everything else
    ▼
Nginx (host process)
    │
    ├── automation.sonty.nl  →  n8n :5678
    ├── grafana.sonty.nl     →  Grafana :3000  (IP-restricted)
    └── (webhook paths)      →  n8n webhook receiver
```

Staging domains:
- `staging.automation.sonty.nl` → n8n
- `staging.grafana.sonty.nl` → Grafana

Production domains:
- `automation.sonty.nl` → n8n
- `grafana.sonty.nl` → Grafana

---

## Port Exposure Summary

| Port | Service | Exposed externally? | Access |
|---|---|---|---|
| 22 | SSH | Yes | Hetzner firewall allowlist (your IP only) |
| 80 | Nginx | Yes | Public — redirects to 443 |
| 443 | Nginx | Yes | Public — reverse proxy to n8n |
| 5678 | n8n | No | Internal Docker network only |
| 5432 | Postgres | No | Internal Docker network only |
| 6379 | Redis | No | Internal Docker network only |
| 9090 | Prometheus | No | Internal — accessible via SSH tunnel |
| 3000 | Grafana | Yes (restricted) | IP allowlist via Nginx |

---

## DNS Configuration

| Record | Type | Value |
|---|---|---|
| `automation.sonty.nl` | A | Production VPS IP |
| `staging.automation.sonty.nl` | A | Staging VPS IP |
| `grafana.sonty.nl` | A | Production VPS IP |
| `staging.grafana.sonty.nl` | A | Staging VPS IP |

---

## Related Documents

| Document | Path |
|---|---|
| Docker Setup | `docs/docker-setup.md` |
| Directory Structure | `docs/directory-structure.md` |
| Security Configuration | `docs/security-config.md` |
| Staging vs Production | `docs/staging-environment.md` |
| Backup Strategy | `docs/vps-architecture.md#backup-strategy` (below) |
| Deployment Scripts | `scripts/deploy/` |

---

## Backup Strategy

### What is backed up

| Data | Method | Frequency | Retention |
|---|---|---|---|
| Postgres database | `pg_dump` → compressed file | Daily at 03:00 | 30 days |
| n8n data directory | `tar.gz` of `/opt/sonty/data/n8n` | Daily at 03:30 | 14 days |
| Hetzner snapshot | Full server snapshot via Hetzner API | Weekly | 4 snapshots |
| n8n workflow JSON | Exported to GitHub via script | On change | Git history |

### Backup storage

- Primary: `/opt/sonty/backups/` on the VPS
- Secondary: Hetzner Object Storage (S3-compatible) bucket `sonty-backups`
- Backups are encrypted before upload using `age` encryption

### Restore procedure

Documented in `scripts/deploy/restore.sh`. Key steps:
1. Provision new VPS from Hetzner snapshot (fastest path)
2. Or: fresh VPS + deploy script + restore `pg_dump` + restore n8n data volume

### Monitoring

- Backup script exits non-zero on failure
- Failure triggers alert via email (configured in `scripts/deploy/backup.sh`)
- Weekly backup verification: restore to temp container and run integrity check

---

## Monitoring Stack

| Tool | Purpose |
|---|---|
| **Prometheus** | Metrics collection (n8n, Postgres, Redis, host) |
| **Grafana** | Dashboard for metrics visualization |
| **Loki** (optional phase 2) | Log aggregation |
| **Uptime Kuma** (optional) | External uptime monitoring for webhook endpoints |

Key alerts configured:
- n8n container down
- Postgres container down
- Disk usage > 80%
- Backup job failed
- SSL certificate expiry < 14 days

---

## Scaling Path

Current spec (4 vCPU / 8 GB) handles:
- ~1,000 leads/month
- ~14 active workflows
- Hourly ETL jobs
- Dashboard queries

If volume grows > 5,000 leads/month:
- Upgrade to CPX31 (8 vCPU / 16 GB) — no data migration needed, Hetzner resize
- Separate Postgres to its own VPS if query load increases
- Add read replica for dashboard queries
