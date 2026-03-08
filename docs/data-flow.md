# Sonty — Data Flow

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Overview

Data flows through three conceptual layers:

1. **Inbound** — external systems push or expose data to HubSpot / n8n
2. **Orchestration** — n8n reads, transforms, and routes data between systems
3. **Reporting** — n8n writes normalized snapshots to Postgres for dashboards

---

## Flow 1: Lead Enters System

```
Ad Platform (Meta / Google / Pinterest)
  │
  │  Lead form submission (name, phone, email, product interest, postal code)
  │
  ▼
n8n webhook receiver
  │
  │  Map fields → HubSpot contact schema
  │  Deduplicate by email / phone
  │
  ▼
HubSpot
  │  Creates Contact
  │  Creates Deal → Stage: "New Lead"
  │  Logs lead source (UTM / platform)
  │
  ▼
Postgres  ←── n8n writes: lead_created event
```

**Key data captured at lead entry:**
- First name, last name
- Email address
- Phone number
- Product interest (e.g. zonnescherm, pergola, screens)
- Postal code / region
- Lead source (platform + campaign + ad set)
- Timestamp
- UTM parameters where available

---

## Flow 2: Call Attempts

```
HubSpot
  │  Deal stage: "New Lead"
  │  n8n scheduled trigger fires (e.g. 1 hour after lead created)
  │
  ▼
n8n
  │  Creates HubSpot Task: "Call attempt 1"
  │  Assigns to sales rep
  │  Starts 24-hour timer for attempt 2
  │
  ▼
Staff calls lead manually, logs outcome in HubSpot
  │
  ├── Connected → Deal moves to "In Contact"
  └── Not connected → 24h later: n8n creates Task "Call attempt 2"
                          │
                          ├── Connected → Deal moves to "In Contact"
                          └── Not connected → n8n triggers Flow 3 (first quote)
```

**Data written:**
- HubSpot tasks (call_attempt_1, call_attempt_2)
- Call outcome notes
- Postgres: funnel_event (stage=call_attempted, outcome)

---

## Flow 3: First Quote (Reuzenpanda)

```
n8n
  │  Triggered by: 2 failed call attempts OR sales rep manual trigger
  │
  ▼
Reuzenpanda API
  │  Fetches product configuration for lead's interest
  │  Generates first quote PDF
  │
  ▼
n8n
  │  Attaches PDF to HubSpot deal
  │  Sends email via Outlook with quote attached
  │  Logs activity in HubSpot
  │  Updates deal stage: "First Quote Sent"
  │
  ▼
Postgres  ←── n8n writes: funnel_event (stage=first_quote_sent)
```

---

## Flow 4: Quote Accepted → Measurement Scheduling

```
HubSpot
  │  Sales rep marks deal: "Quote Accepted"
  │  (or inbound email/WhatsApp reply triggers n8n via keyword detection)
  │
  ▼
n8n
  │  Creates appointment in Microsoft Bookings (measurement visit)
  │  Sends confirmation email via Outlook
  │  Sends WhatsApp confirmation message
  │  Updates HubSpot deal stage: "Measurement Scheduled"
  │
  ▼
Postgres  ←── funnel_event (stage=measurement_scheduled, appointment_id)
```

---

## Flow 5: After Measurement → Final Quote (Gripp)

```
Microsoft Bookings
  │  Appointment status: Completed
  │  n8n polls or receives webhook
  │
  ▼
n8n
  │  Notifies sales rep to enter measurements in Gripp
  │  (or reads measurement data if entered digitally)
  │
  ▼
Gripp API
  │  Creates final quote with measured dimensions + product specs
  │  Returns quote ID + PDF URL
  │
  ▼
n8n
  │  Sends final quote email via Outlook
  │  Attaches Gripp quote PDF
  │  Updates HubSpot deal stage: "Final Quote Sent"
  │  Logs quote_id on HubSpot deal
  │
  ▼
Postgres  ←── funnel_event (stage=final_quote_sent, gripp_quote_id)
```

---

## Flow 6: Quote Approved → Deposit Invoice

```
Gripp
  │  Quote status: Accepted
  │  n8n polls Gripp API (or webhook if supported)
  │
  ▼
n8n
  │  Updates HubSpot deal stage: "Won"
  │  Creates deposit invoice in Gripp (e.g. 50% upfront)
  │  Sends invoice email via Outlook
  │
  ▼
Postgres  ←── funnel_event (stage=won, gripp_invoice_id, amount)
              revenue event (type=deposit, amount, deal_id)
```

---

## Flow 7: Deposit Received → Product Order

```
Gripp
  │  Invoice status: Paid
  │  n8n polls payment status
  │
  ▼
n8n
  │  Updates HubSpot deal: "Deposit Received"
  │  Creates HubSpot task: "Order products from supplier"
  │  Notifies operations team via email/WhatsApp
  │
  ▼
Postgres  ←── funnel_event (stage=deposit_paid)
```

---

## Flow 8: Products Arrived → Installation Scheduling

```
Staff marks deal in HubSpot: "Products Arrived"
  │
  ▼
n8n
  │  Creates installation appointment in Microsoft Bookings
  │  Sends installation confirmation to customer
  │  Updates HubSpot deal stage: "Installation Scheduled"
  │
  ▼
Postgres  ←── funnel_event (stage=installation_scheduled)
```

---

## Flow 9: After Installation → Final Invoice + Review

```
Microsoft Bookings
  │  Installation appointment: Completed
  │
  ▼
n8n
  │  Creates final invoice in Gripp (remaining balance)
  │  Sends final invoice email via Outlook
  │  Sends review request via WhatsApp (24h delay)
  │  Updates HubSpot deal stage: "Completed"
  │
  ▼
Postgres  ←── funnel_event (stage=completed)
              revenue event (type=final_payment, amount, deal_id)
```

---

## Reporting Data Flow (Postgres ETL)

```
n8n scheduled job (every 15 min / hourly)
  │
  ├── HubSpot API  →  pull all deals + contacts + activities
  ├── Gripp API    →  pull invoice + payment status
  ├── Bookings     →  pull appointment status
  └── Ads APIs     →  pull campaign spend + lead counts
          │
          ▼
  n8n transforms to normalized schema
          │
          ▼
  Postgres: INSERT / UPSERT into reporting tables
          │
          ▼
  Dashboard layer reads from Postgres
```

---

## Data Ownership Summary

| Data Type | Authoritative Source | Synced To |
|---|---|---|
| Contact details | HubSpot | Postgres (snapshot) |
| Deal & pipeline state | HubSpot | Postgres (snapshot) |
| Product configuration | Reuzenpanda | HubSpot deal (as attachment) |
| Appointment data | Microsoft Bookings | HubSpot (activity), Postgres |
| Quote documents | Gripp | HubSpot deal (linked), Postgres |
| Invoice & payment | Gripp | HubSpot deal (linked), Postgres |
| Email correspondence | Outlook / HubSpot | HubSpot (logged) |
| WhatsApp messages | WhatsApp Business | HubSpot (logged as note) |
| Ad spend + lead source | Meta / Google / Pinterest | Postgres (ETL) |
