# Sonty — Staging Environment Design

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Purpose

The staging environment mirrors production in structure but uses:
- Sandbox / developer accounts for all external systems
- A separate VPS or Docker environment
- Isolated credentials that can never reach real customers
- Synthetic test data only

**Rule: No real customer data enters staging. No staging automation reaches real customers.**

---

## Environment Tiers

| Tier | Purpose | Data | External APIs |
|---|---|---|---|
| **local** | Developer machine | Synthetic only | Mocked or sandbox |
| **staging** | Pre-production validation | Synthetic only | Sandbox accounts |
| **production** | Live system | Real | Live accounts |

---

## Staging Infrastructure

```
Staging VPS  (separate from production)
├── n8n-staging          (Docker, port 5678)
│     └── URL: https://staging.automation.sonty.nl
├── postgres-staging     (Docker, port 5432)
│     └── Database: sonty_staging
├── Nginx                (Reverse proxy + SSL)
└── Docker Compose       (docker-compose.staging.yml)
```

**Alternatively:** For cost efficiency during design phase, staging can run locally via Docker Compose using `docker-compose.staging.yml` before a dedicated VPS is provisioned.

---

## Sandbox Accounts Required per System

| System | Sandbox / Test Account Method |
|---|---|
| **HubSpot** | HubSpot Developer Sandbox (free, isolated from production portal) |
| **Gripp** | Gripp test environment — confirm availability with Gripp support |
| **Microsoft Bookings** | Separate Microsoft 365 dev tenant or test calendar |
| **Outlook** | Test mailbox in dev tenant (e.g. `test@sonty-staging.onmicrosoft.com`) |
| **WhatsApp Business** | Meta Developer account with test phone number |
| **Meta Ads** | Meta Business test ad account + test lead form |
| **Google Ads** | Google Ads test account |
| **Reuzenpanda** | Confirm test/sandbox mode with Reuzenpanda |
| **Postgres** | `sonty_staging` database on staging VPS |
| **n8n** | Staging n8n instance with staging credentials only |

---

## Configuration Isolation

All credentials are environment-specific. The `.env` files are never committed.

```
configs/
├── .env.local       # Local development — mocked/sandbox APIs
├── .env.staging     # Staging — sandbox API accounts
└── .env.production  # Production — live API accounts (provisioned last)
```

n8n credentials are stored per environment instance. Staging n8n has zero access to production API keys.

---

## Synthetic Test Data

Test scenarios to cover:

| Scenario ID | Description |
|---|---|
| TD-01 | Lead from Meta with all fields present |
| TD-02 | Lead from Google with minimal fields (no UTM) |
| TD-03 | Duplicate lead (same email, different name) |
| TD-04 | Lead that goes through full pipeline (new → completed) |
| TD-05 | Lead that reaches "First Quote Sent" and goes cold (no response) |
| TD-06 | Lead that reaches "Won" then cancels (Lost) |
| TD-07 | Lead with no WhatsApp opt-in |
| TD-08 | Lead where Reuzenpanda quote API fails |
| TD-09 | Lead where Gripp invoice creation fails |
| TD-10 | Lead arriving outside business hours |

Each test scenario has a defined expected outcome across all systems (HubSpot stage, emails sent, Postgres rows written).

---

## Staging Deployment Process

```
1. Developer makes changes in local environment
2. Push to GitHub feature branch
3. Pull request reviewed and approved
4. Merge to `staging` branch
5. Automated deploy to staging VPS (GitHub Actions, later)
6. Run automated test suite against staging
7. Manual QA sign-off on test scenarios
8. Merge to `main` branch
9. Deploy to production
```

For the initial design phase, step 5–9 will be manual. CI/CD pipelines are added once core integrations are validated.

---

## Staging n8n Workflow Management

- Staging n8n instance has its own workflow set
- Workflows are exported as JSON and stored in `scripts/n8n-workflows/staging/`
- Production workflows stored in `scripts/n8n-workflows/production/`
- Workflow JSON files are version-controlled in GitHub

---

## Promotion Checklist (Staging → Production)

Before any workflow or integration goes live:

- [ ] All test scenarios pass in staging
- [ ] No real customer data was used in testing
- [ ] All error paths tested (API failures, missing data, edge cases)
- [ ] Credentials rotated — staging keys not reused in production
- [ ] n8n workflows exported and committed to GitHub
- [ ] Rollback plan documented
- [ ] Owner sign-off obtained
