# Sonty — Integrations Reference

> Status: Design phase
> Last updated: 2026-03-10

---

## Integration Status

| System | Role | Auth Method | Status |
|---|---|---|---|
| Reuzenpanda | Product configurator + first price indication | Zapier native (Invite Only) | Connected in Zapier |
| HubSpot | Central CRM | Private App Token / Zapier OAuth | OAuth in progress |
| Zapier | Automation layer | — | Active |
| Planado | Field operations | API Key + Webhooks | Design |
| Gripp | Quotes and invoices | API Key | Design |
| Trengo | WhatsApp messaging | Zapier native | Design |
| Outlook | Email (incl. orders@sonty.nl) | Microsoft 365 | Design |
| Meta Ads | Lead acquisition → Reuzenpanda | Zapier native | Design |
| Google Ads | Lead acquisition → Reuzenpanda | Zapier native | Design |
| Pinterest Ads | Lead acquisition → Reuzenpanda | Zapier native | Design |

---

## Reuzenpanda

- **Purpose**: Product configurator — customer configures product, gets first price indication. Entry point for all leads.
- **Auth**: Zapier native integration (Invite Only)
- **Already connected**: Yes (3 zaps in Zapier, including active "Reuzenpanda Offerte → Google Sheets")
- **Used by**: ZAP-01

---

## HubSpot

- **Purpose**: Central CRM — contacts, deals, pipeline, tasks, notes
- **Auth**: Private App Token (pat-eu1-ba8f1c56-...) + Zapier OAuth
- **Portal ID**: 147970649
- **Private App**: Sonty Automation (ID: 33327041)
- **Used by**: ZAP-01 through ZAP-11, WF-01 through WF-04

---

## Planado

- **Purpose**: Field operations — measurement and installation jobs
- **Auth**: API Key (Bearer token); Webhooks via `X-Planado-Secret`
- **API base**: `https://api.planadoapp.com/v2`
- **Zapier**: Native integration — "Create Job" action, "Job Event" trigger
- **Required plan**: Pro (for API + webhooks)
- **Job types**: Opmeting (60 min), Installatie (variable)
- **Webhook event**: `job_finished` (used by ZAP-04, ZAP-09)
- **Used by**: ZAP-03, ZAP-04, ZAP-08, ZAP-09

---

## Gripp

- **Purpose**: Final quotes, deposit invoices, final invoices
- **Auth**: API Key
- **Docs**: https://developers.gripp.nl/
- **Used by**: ZAP-05, ZAP-06, ZAP-10

---

## Trengo

- **Purpose**: WhatsApp messaging — follow-up after price indication + review requests
- **Auth**: Zapier native integration
- **Already connected**: Yes (in Zapier, 1 existing zap)
- **Templates**: Randomized WhatsApp templates for follow-up (step 5)
- **Used by**: ZAP-02, ZAP-11

---

## Outlook / Email

- **Purpose**: Transactional emails + orders@sonty.nl for supplier order confirmations
- **Auth**: Microsoft 365
- **Key mailbox**: orders@sonty.nl (monitored for supplier order confirmations → ZAP-07)
- **Used by**: ZAP-07

---

## Meta Ads / Google Ads / Pinterest Ads

- **Purpose**: Lead acquisition — ads link to Reuzenpanda configurator
- **Auth**: Via Zapier native integrations
- **Flow**: Ad click → Reuzenpanda configurator → lead data → Zapier → HubSpot
- **Note**: Ads drive traffic to Reuzenpanda, not directly to HubSpot

---

## Zapier Account Details

- **Email**: daimy@sonty.nl
- **Plan**: Professional (tasks limit ~10,000/month, currently using ~858)
- **Connected apps**: Trengo, Google Sheets (x2), Reuzenpanda (Invite Only)
- **Active zap (DO NOT TOUCH)**: "Reuzenpanda Offerte → Google Sheets"
- **In progress**: ZAP-02 draft (ID 353373774)
