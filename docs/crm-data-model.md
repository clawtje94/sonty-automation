# Sonty — CRM Data Model

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Overview

HubSpot is the authoritative CRM. This document defines:
- The HubSpot object model (standard + custom properties)
- The Postgres reporting schema (normalized mirror)
- The relationships between objects

---

## HubSpot Object Model

### Contact

Standard HubSpot properties used:

| Property | HubSpot Field | Notes |
|---|---|---|
| First name | `firstname` | |
| Last name | `lastname` | |
| Email | `email` | Primary dedup key |
| Phone | `phone` | Primary dedup key (fallback) |
| City | `city` | |
| Postal code | `zip` | Used for region routing |
| Lead source | `hs_lead_status` + `lead_source` | Platform of origin |
| Owner | `hubspot_owner_id` | Assigned sales rep |
| Created date | `createdate` | Auto |
| Last activity | `notes_last_updated` | Auto |

Custom properties to create on Contact:

| Property | Type | Description |
|---|---|---|
| `sonty_product_interest` | Dropdown | e.g. zonnescherm, pergola, screens, rolluiken |
| `sonty_lead_platform` | Dropdown | meta, google, pinterest, organic, referral |
| `sonty_utm_campaign` | Text | UTM campaign from ad |
| `sonty_utm_adset` | Text | UTM ad set from ad |
| `sonty_whatsapp_opt_in` | Boolean | Customer consented to WhatsApp |

---

### Deal

Standard HubSpot properties used:

| Property | HubSpot Field | Notes |
|---|---|---|
| Deal name | `dealname` | Auto-generated: "{Lastname} – {Product}" |
| Deal stage | `dealstage` | See pipeline below |
| Deal amount | `amount` | Set when quote is approved |
| Close date | `closedate` | Expected or actual close |
| Owner | `hubspot_owner_id` | Assigned sales rep |
| Associated contact | Association | One-to-one |

Custom properties to create on Deal:

| Property | Type | Description |
|---|---|---|
| `sonty_first_quote_date` | Date | When Reuzenpanda quote was sent |
| `sonty_first_quote_amount` | Number | Amount on first quote |
| `sonty_measurement_date` | Date | Date of measurement appointment |
| `sonty_final_quote_date` | Date | When Gripp final quote was sent |
| `sonty_final_quote_amount` | Number | Amount on final quote |
| `sonty_gripp_quote_id` | Text | Gripp quote reference |
| `sonty_gripp_invoice_id_deposit` | Text | Gripp deposit invoice ID |
| `sonty_gripp_invoice_id_final` | Text | Gripp final invoice ID |
| `sonty_deposit_amount` | Number | Deposit invoice amount |
| `sonty_deposit_paid_date` | Date | When deposit was received |
| `sonty_installation_date` | Date | Scheduled installation date |
| `sonty_products_arrived_date` | Date | When products were received from supplier |
| `sonty_final_invoice_date` | Date | When final invoice was sent |
| `sonty_review_requested` | Boolean | Whether review request was sent |
| `sonty_call_attempt_1_date` | Date | First call attempt timestamp |
| `sonty_call_attempt_2_date` | Date | Second call attempt timestamp |
| `sonty_call_outcome` | Dropdown | connected, voicemail, no_answer, wrong_number |

---

### HubSpot Pipeline: Sonty Sales Pipeline

| Stage | Stage ID (slug) | Description |
|---|---|---|
| New Lead | `new_lead` | Lead just entered system |
| Call Attempt 1 | `call_attempt_1` | First call attempted, no contact yet |
| Call Attempt 2 | `call_attempt_2` | Second call attempted, no contact yet |
| In Contact | `in_contact` | Live contact established |
| First Quote Sent | `first_quote_sent` | Reuzenpanda quote emailed |
| Quote Follow-up | `quote_followup` | No response to first quote — following up |
| Measurement Scheduled | `measurement_scheduled` | Appointment booked |
| Measurement Done | `measurement_done` | Visit completed, awaiting final quote |
| Final Quote Sent | `final_quote_sent` | Gripp final quote emailed |
| Won | `won` | Quote approved, deposit invoice sent |
| Deposit Received | `deposit_received` | Payment confirmed |
| Products Ordered | `products_ordered` | Order placed with supplier |
| Installation Scheduled | `installation_scheduled` | Installation appointment booked |
| Installation Done | `installation_done` | Work completed on site |
| Completed | `completed` | Final invoice sent and paid |
| Lost | `lost` | Deal closed without sale |

---

### Activity Types (logged on Contact/Deal)

| Type | Trigger | Logged by |
|---|---|---|
| Email sent | Quote send, invoice send | n8n → HubSpot API |
| Email received | Customer reply | Outlook → HubSpot (native sync) |
| Call logged | Call attempt outcome | Staff in HubSpot |
| WhatsApp message | Follow-up sent | n8n → HubSpot note |
| Appointment created | Booking confirmed | n8n → HubSpot activity |
| Note | Manual or automated observation | Staff / n8n |
| Task | Next action for sales rep | n8n / manual |

---

## Postgres Reporting Schema

### Table: `leads`

```sql
CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_contact_id  TEXT UNIQUE NOT NULL,
    first_name      TEXT,
    last_name       TEXT,
    email           TEXT,
    phone           TEXT,
    postal_code     TEXT,
    product_interest TEXT,
    lead_platform   TEXT,         -- meta, google, pinterest, organic
    utm_campaign    TEXT,
    utm_adset       TEXT,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ
);
```

### Table: `deals`

```sql
CREATE TABLE deals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_deal_id         TEXT UNIQUE NOT NULL,
    hubspot_contact_id      TEXT REFERENCES leads(hubspot_contact_id),
    stage                   TEXT NOT NULL,
    first_quote_amount      NUMERIC(10,2),
    final_quote_amount      NUMERIC(10,2),
    deposit_amount          NUMERIC(10,2),
    final_invoice_amount    NUMERIC(10,2),
    gripp_quote_id          TEXT,
    gripp_invoice_deposit   TEXT,
    gripp_invoice_final     TEXT,
    created_at              TIMESTAMPTZ NOT NULL,
    won_at                  TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    lost_at                 TIMESTAMPTZ,
    loss_reason             TEXT,
    updated_at              TIMESTAMPTZ
);
```

### Table: `funnel_events`

```sql
CREATE TABLE funnel_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         TEXT NOT NULL,   -- hubspot_deal_id
    contact_id      TEXT NOT NULL,   -- hubspot_contact_id
    stage           TEXT NOT NULL,   -- pipeline stage slug
    event_type      TEXT NOT NULL,   -- entered, exited, action
    metadata        JSONB,           -- additional context
    occurred_at     TIMESTAMPTZ NOT NULL,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `revenue_events`

```sql
CREATE TABLE revenue_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         TEXT NOT NULL,
    invoice_type    TEXT NOT NULL,   -- deposit, final
    amount          NUMERIC(10,2) NOT NULL,
    gripp_invoice_id TEXT,
    paid_at         TIMESTAMPTZ,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `ad_performance`

```sql
CREATE TABLE ad_performance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,   -- meta, google, pinterest
    campaign_id     TEXT,
    campaign_name   TEXT,
    date            DATE NOT NULL,
    impressions     INTEGER,
    clicks          INTEGER,
    leads           INTEGER,
    spend           NUMERIC(10,2),
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `kpi_snapshots`

```sql
CREATE TABLE kpi_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date       DATE NOT NULL,
    period              TEXT NOT NULL,       -- daily, weekly, monthly
    leads_total         INTEGER,
    leads_contacted     INTEGER,
    first_quotes_sent   INTEGER,
    measurements_done   INTEGER,
    deals_won           INTEGER,
    deals_completed     INTEGER,
    revenue_invoiced    NUMERIC(10,2),
    revenue_collected   NUMERIC(10,2),
    conversion_rate     NUMERIC(5,4),        -- e.g. 0.1000 = 10%
    avg_deal_value      NUMERIC(10,2),
    recorded_at         TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Relationships

```
leads (1) ──── (many) deals
deals (1) ──── (many) funnel_events
deals (1) ──── (many) revenue_events
ad_performance (many) ──── (aggregated into) kpi_snapshots
```

---

## Deduplication Rules

| Scenario | Rule |
|---|---|
| Same email exists | Update existing contact, do not create duplicate |
| Same phone, different email | Flag for manual review — create task in HubSpot |
| Same name + postal code, no email/phone match | Create new contact, tag `sonty_possible_duplicate` |
