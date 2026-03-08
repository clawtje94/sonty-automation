# Sonty — System Architecture

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08
> Author: Lead Systems Architect

---

## Active Direction

**Phase 1 uses HubSpot + Zapier — no self-hosted infrastructure.**

See [`docs/architecture-phase1.md`](architecture-phase1.md) for the active
implementation plan, Zapier workflow designs, cost comparison, and the
conditions under which a VPS becomes justified.

The documents below describe the **full target architecture** (HubSpot + n8n
on VPS) which represents the phase 2 / scale-up path. It is documented and
ready, but not the starting point.

---

## 1. Design Principles

| Principle | Description |
|---|---|
| **HubSpot as source of truth** | All lead, contact, deal, and pipeline data lives in HubSpot |
| **n8n as automation brain** | All cross-system workflows are orchestrated by n8n on a dedicated VPS |
| **Postgres as reporting layer** | Normalized snapshots of operational data are written to Postgres for dashboards |
| **Modular connectors** | Each external system has an isolated connector module — changes to one system don't break others |
| **Config-driven** | All credentials and endpoints live in `configs/` and environment variables, never hardcoded |
| **Staging-first** | All integrations are developed and validated in staging before touching live data |
| **Audit trail** | Every automated action is logged with timestamp, trigger, system, and outcome |

---

## 2. System Roles

| System | Role | Owns |
|---|---|---|
| **HubSpot** | Central CRM | Contacts, Deals, Pipeline stages, Activities, Notes |
| **Reuzenpanda** | Product configurator | Product specs, first-quote PDF |
| **Microsoft Bookings** | Appointment scheduling | Measurement appointments |
| **Gripp** | Financial admin | Final quotes, invoices, payment status |
| **Outlook** | Email communication | Inbound/outbound emails linked to HubSpot |
| **WhatsApp (via API)** | Messaging | Follow-up messages linked to HubSpot contact |
| **n8n** | Automation orchestrator | Workflow logic, triggers, cross-system routing |
| **Postgres** | Reporting database | Normalized KPI data, funnel snapshots |
| **Dashboard layer** | Business intelligence | Owner dashboards, conversion metrics, revenue |
| **Meta / Google / Pinterest** | Lead acquisition | Ad campaigns, lead form submissions |

---

## 3. Layered Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        LEAD ACQUISITION LAYER                        │
│            Meta Ads · Google Ads · Pinterest Ads · Organic           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Lead form submissions / webhooks
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        HubSpot CRM (Core)                            │
│   Contacts · Deals · Pipeline · Activities · Notes · Sequences       │
└───┬───────────────┬────────────────┬────────────────┬────────────────┘
    │               │                │                │
    ▼               ▼                ▼                ▼
┌───────┐     ┌──────────┐    ┌──────────┐    ┌──────────┐
│Outlook│     │WhatsApp  │    │Bookings  │    │Reuzen-   │
│ Email │     │(Business)│    │(Appts)   │    │ panda    │
└───┬───┘     └────┬─────┘    └────┬─────┘    └────┬─────┘
    │              │               │                │
    └──────────────┴───────────────┴────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        n8n AUTOMATION LAYER                          │
│        Workflow Engine · Triggers · Logic · Cross-system Routing     │
│                         (Self-hosted on VPS)                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Normalized data writes
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Gripp (Quotes & Invoices)                         │
│         Final Quote · Deposit Invoice · Final Invoice                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Postgres REPORTING DATABASE                        │
│         Funnel snapshots · KPI events · Revenue · Lead source        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       DASHBOARD LAYER                                │
│         Owner KPI Dashboard · Conversion Funnel · Revenue Tracker    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. VPS Architecture (n8n host)

```
VPS (Ubuntu 22.04 LTS)
├── n8n                  (Docker container, port 5678)
├── Postgres             (Docker container, port 5432)
├── Nginx                (Reverse proxy, SSL termination)
├── Certbot              (Let's Encrypt SSL)
└── Docker Compose       (Orchestrates all containers)
```

All services run behind Nginx. n8n is accessible via `https://automation.sonty.nl` (staging: `https://staging.automation.sonty.nl`). Postgres is not exposed externally — only accessible within the Docker network or via SSH tunnel.

---

## 5. Security Model

- All API keys stored as n8n credentials (encrypted at rest)
- Postgres credentials never leave the VPS
- Nginx enforces HTTPS — no HTTP traffic
- n8n webhooks protected by HMAC signature validation where supported
- Separate staging and production credential sets — never shared
- No credentials committed to version control
- `.gitignore` excludes all `*.env` and `configs/secrets/` paths

---

## 6. Related Documents

| Document | Path |
|---|---|
| System Diagram | `docs/system-diagram.md` |
| Data Flow | `docs/data-flow.md` |
| CRM Data Model | `docs/crm-data-model.md` |
| Automation Flow Map | `docs/automation-flow-map.md` |
| Staging Environment | `docs/staging-environment.md` |
| Testing Strategy | `docs/testing-strategy.md` |
| Integrations Reference | `docs/integrations.md` |
