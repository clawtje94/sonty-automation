# Architecture Overview

> Status: Staging — design phase only.

## Design Principles

- **Modular integrations**: each system has its own isolated connector
- **Central orchestration**: automation workflows coordinate across connectors
- **Config-driven**: all credentials and endpoints live in `configs/` (never hardcoded)
- **Testable**: every integration and workflow has corresponding tests

## System Diagram (Planned)

```
┌─────────────────────────────────────────────────────┐
│                   Automation Layer                  │
│              (scripts / workflows)                  │
└────────┬──────────┬──────────┬──────────┬───────────┘
         │          │          │          │
   ┌─────▼───┐ ┌────▼────┐ ┌──▼────┐ ┌──▼──────┐
   │HubSpot  │ │Reuzen-  │ │Planning│ │  Gripp  │
   │  CRM    │ │ panda   │ │        │ │         │
   └─────────┘ └─────────┘ └────────┘ └─────────┘
         │
   ┌─────▼──────────┐
   │  Ads Platforms │
   │ (Meta, Google) │
   └────────────────┘
         │
   ┌─────▼──────────┐
   │   Dashboards   │
   │  (Reporting)   │
   └────────────────┘
```

## Data Flow

1. Source systems expose data via API
2. Integration connectors fetch and normalize data
3. Automation scripts orchestrate cross-system workflows
4. Dashboards consume normalized data for reporting

## Integration Contracts

Each integration module must expose:

- `connect()` — validate credentials and establish session
- `fetch(resource, params)` — retrieve data from the system
- `push(resource, payload)` — write data to the system
- `disconnect()` — cleanly close the session

## Security

- All secrets stored in `configs/` (excluded from version control via `.gitignore`)
- No credentials hardcoded anywhere in the codebase
- Each integration uses its own scoped API key or OAuth token
