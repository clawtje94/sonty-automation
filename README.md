# Sonty Business Automation System

> Staging architecture — no live systems connected.

## Overview

Sonty is a modular business automation platform that integrates key operational tools into unified workflows and dashboards.

## Integrated Systems (Planned)

| System | Category | Status |
|---|---|---|
| HubSpot CRM | CRM / Sales | Staging |
| Reuzenpanda | Operations | Staging |
| Planning Software | Scheduling / Projects | Staging |
| Gripp | Invoicing / Admin | Staging |
| Advertising Platforms | Marketing | Staging |
| Dashboards | Reporting / BI | Staging |

## Repository Structure

```
sonty/
├── integrations/       # Connectors for each external system
│   ├── hubspot/        # HubSpot CRM integration
│   ├── reuzenpanda/    # Reuzenpanda integration
│   ├── planning/       # Planning software integration
│   ├── gripp/          # Gripp integration
│   └── ads/            # Advertising platforms integration
├── dashboards/         # Dashboard definitions and data pipelines
├── scripts/            # Utility and automation scripts
├── tests/              # Unit and integration tests
├── docs/               # Architecture and API documentation
└── configs/            # Environment and system configuration files
```

## Getting Started

See [docs/getting-started.md](docs/getting-started.md).

## Architecture

See [docs/architecture.md](docs/architecture.md).

---

_This is a staging repository. No credentials or live connections are configured._
