# Sonty — Directory Structure

> Status: Design phase.
> Last updated: 2026-03-08

---

## Repository Structure (GitHub)

```
sonty-automation/                  # GitHub repository root
│
├── docker/                        # Docker Compose files
│   ├── docker-compose.staging.yml
│   ├── docker-compose.prod.yml
│   └── docker-compose.local.yml   # Local development
│
├── nginx/                         # Nginx configuration
│   ├── staging/
│   │   └── automation.conf        # staging.automation.sonty.nl
│   └── production/
│       ├── automation.conf        # automation.sonty.nl
│       └── grafana.conf           # grafana.sonty.nl
│
├── scripts/
│   ├── deploy/
│   │   ├── provision.sh           # One-time server setup
│   │   ├── deploy.sh              # Deploy / update services
│   │   ├── backup.sh              # Database + data backup
│   │   ├── restore.sh             # Restore from backup
│   │   └── rotate-logs.sh         # Log rotation helper
│   ├── db/
│   │   ├── migrate.sh             # Run Postgres migrations
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql
│   │       ├── 002_add_indexes.sql
│   │       └── ...
│   └── n8n-workflows/
│       ├── staging/               # Workflow JSON exports (staging)
│       └── production/            # Workflow JSON exports (production)
│
├── configs/
│   ├── example.env                # Template — committed to repo
│   └── prometheus/
│       └── prometheus.yml         # Prometheus scrape config
│
├── integrations/
│   ├── hubspot/
│   ├── reuzenpanda/
│   ├── planning/
│   ├── gripp/
│   └── ads/
│
├── dashboards/
│   └── README.md
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── workflows/
│   └── fixtures/
│
└── docs/                          # Architecture documentation
    ├── architecture.md
    ├── vps-architecture.md
    ├── docker-setup.md
    ├── directory-structure.md     # This file
    ├── security-config.md
    ├── system-diagram.md
    ├── data-flow.md
    ├── crm-data-model.md
    ├── automation-flow-map.md
    ├── staging-environment.md
    ├── testing-strategy.md
    ├── integrations.md
    └── getting-started.md
```

---

## VPS Directory Structure (Server)

```
/opt/sonty/                        # Application root
│
├── config/                        # Environment files (never in git)
│   ├── .env.staging
│   └── .env.production
│
├── data/                          # Persistent container volumes
│   ├── n8n/                       # n8n workflows, credentials, history
│   ├── postgres/                  # Postgres data directory
│   └── redis/                     # Redis persistence (RDB/AOF)
│
├── backups/                       # Backup output
│   ├── postgres/                  # pg_dump files (date-stamped)
│   │   └── YYYY-MM-DD/
│   │       └── sonty_staging_YYYYMMDD_HHMMSS.sql.gz
│   └── n8n/                       # n8n data directory archives
│       └── YYYY-MM-DD/
│           └── n8n_YYYYMMDD_HHMMSS.tar.gz
│
├── docker/                        # Docker Compose files (deployed from repo)
│   └── docker-compose.staging.yml (or .prod.yml)
│
├── nginx/                         # Nginx configs (deployed from repo)
│   └── automation.conf
│
└── logs/                          # Application log archives
    └── YYYY-MM/
```

```
/etc/nginx/
└── sites-enabled/
    ├── automation.conf            # Symlinked from /opt/sonty/nginx/
    └── grafana.conf

/etc/letsencrypt/                  # Certbot SSL certificates
└── live/
    ├── staging.automation.sonty.nl/
    └── automation.sonty.nl/
```

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Docker Compose files | `docker-compose.{env}.yml` | `docker-compose.staging.yml` |
| Nginx config files | `{service}.conf` | `automation.conf` |
| Backup files | `{db}_{date}_{time}.sql.gz` | `sonty_staging_20260308_030000.sql.gz` |
| Migration files | `{NNN}_{description}.sql` | `001_initial_schema.sql` |
| n8n workflow exports | `{WF-ID}_{name}.json` | `WF-01_lead-intake.json` |
| Environment files | `.env.{environment}` | `.env.staging` |
