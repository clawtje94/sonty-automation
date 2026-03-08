# Sonty — Getting Started

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Current Phase

This repository is in the **architecture and design phase**.

No integrations are connected. No automation workflows are running.

The documents in `docs/` define the full planned architecture. Implementation begins only after the architecture is reviewed and approved.

---

## Repository Structure

```
sonty/
├── integrations/        # Connector modules per external system
│   ├── hubspot/         # HubSpot CRM connector
│   ├── reuzenpanda/     # Reuzenpanda product configurator connector
│   ├── planning/        # Microsoft Bookings connector
│   ├── gripp/           # Gripp quotes + invoices connector
│   └── ads/             # Meta, Google, Pinterest ad connectors
├── dashboards/          # Dashboard definitions and queries
├── scripts/
│   └── n8n-workflows/   # n8n workflow JSON exports (staging + production)
├── tests/
│   ├── unit/            # Unit tests for data transforms + logic
│   ├── integration/     # Per-system integration tests
│   ├── workflows/       # End-to-end workflow tests
│   └── fixtures/        # Seed + teardown scripts for test data
├── docs/                # Architecture and design documentation
└── configs/             # Environment config files (never committed)
```

---

## Architecture Documents

Read these in order to understand the full design:

1. [System Architecture](architecture.md) — layers, roles, design principles
2. [System Diagram](system-diagram.md) — visual map of all systems and connections
3. [Data Flow](data-flow.md) — how data moves between systems per business event
4. [CRM Data Model](crm-data-model.md) — HubSpot objects, custom properties, Postgres schema
5. [Automation Flow Map](automation-flow-map.md) — all 14 n8n workflows, step by step
6. [Integrations Reference](integrations.md) — API details for every connected system
7. [Staging Environment](staging-environment.md) — how to set up and use staging
8. [Testing Strategy](testing-strategy.md) — unit, integration, workflow, and QA tests

---

## Implementation Sequence (Planned)

When implementation begins, follow this order:

```
Phase 1: Foundation
  1. Provision staging VPS
  2. Deploy n8n + Postgres via Docker Compose
  3. Configure Nginx + SSL
  4. Set up sandbox accounts for all external systems
  5. Implement Postgres schema migrations

Phase 2: Core Connectors
  6. HubSpot connector (contacts, deals, activities)
  7. Gripp connector (quotes, invoices, payment status)
  8. Reuzenpanda connector (product config, quote generation)
  9. Microsoft Bookings + Outlook connector

Phase 3: Automation Workflows
  10. WF-01: Lead Intake
  11. WF-02 / WF-03: Call attempt tasks
  12. WF-04 / WF-05: First quote + follow-up
  13. WF-06 / WF-07: Measurement booking
  14. WF-08: Final quote
  15. WF-09 / WF-10: Won + deposit
  16. WF-11: Installation scheduling
  17. WF-12: Post-installation wrap-up
  18. WF-13 / WF-14: ETL + KPI snapshots

Phase 4: Dashboards
  19. Connect dashboard tool to Postgres
  20. Build conversion funnel view
  21. Build revenue tracker
  22. Build lead source report

Phase 5: Production
  23. Full QA against staging
  24. Provision production VPS
  25. Migrate HubSpot portal to production config
  26. Go-live with monitoring
```

---

## Local Development Setup (Planned)

```bash
# Clone repository
git clone https://github.com/clawtje94/sonty-automation.git
cd sonty-automation

# Copy environment template
cp configs/example.env configs/.env.local

# Fill in sandbox credentials in .env.local

# Start local services
docker-compose -f docker-compose.local.yml up -d

# Run tests
pytest tests/unit/
```

Full setup instructions will be added when implementation begins.
