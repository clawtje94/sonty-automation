# Sonty — Automation Flow Map

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Automation Principles

- Every automation is triggered by a **specific event** (not a schedule where possible)
- Every automation has a **fallback** if an API call fails (log error, create HubSpot task for manual action)
- Every automation is **idempotent** — running it twice produces the same result
- All automations are built in **n8n** and documented below before implementation begins

---

## Workflow Index

| ID | Name | Trigger | Systems Involved |
|---|---|---|---|
| WF-01 | Lead Intake | Ad platform webhook | Meta/Google/Pinterest → HubSpot → Postgres |
| WF-02 | Call Attempt 1 | Timer after lead created | n8n → HubSpot (task) |
| WF-03 | Call Attempt 2 | Timer after WF-02 | n8n → HubSpot (task) |
| WF-04 | First Quote Send | No contact after 2 attempts | Reuzenpanda → Outlook → HubSpot |
| WF-05 | Quote Follow-up | No response after 3 days | WhatsApp → HubSpot |
| WF-06 | Measurement Booking | Quote accepted | Bookings → Outlook → WhatsApp → HubSpot |
| WF-07 | Post-Measurement Alert | Appointment completed | Bookings → HubSpot (task) |
| WF-08 | Final Quote Send | Measurements entered | Gripp → Outlook → HubSpot |
| WF-09 | Deal Won + Deposit Invoice | Quote approved | Gripp → Outlook → HubSpot |
| WF-10 | Deposit Confirmed | Invoice paid | Gripp → HubSpot (task) → WhatsApp |
| WF-11 | Installation Scheduling | Products arrived | Bookings → Outlook → HubSpot |
| WF-12 | Post-Installation Wrap-up | Installation completed | Gripp → Outlook → WhatsApp → HubSpot |
| WF-13 | Reporting ETL | Scheduled (hourly) | All systems → Postgres |
| WF-14 | KPI Snapshot | Scheduled (daily) | Postgres → kpi_snapshots |

---

## WF-01: Lead Intake

```
TRIGGER: Webhook from Meta / Google / Pinterest (lead form submission)

STEPS:
  1. Receive webhook payload
  2. Map fields to HubSpot contact schema
  3. Check for duplicate (by email, then phone)
     ├── Duplicate found → update existing contact, log note
     └── No duplicate → create new contact
  4. Create HubSpot Deal
     · Name: "{Lastname} – {Product interest}"
     · Stage: "New Lead"
     · Source: lead platform + UTM data
  5. Write to Postgres: leads table + funnel_event (new_lead)
  6. Trigger WF-02 (schedule call attempt 1)

ERROR HANDLING:
  · If HubSpot API fails → retry 3x with backoff → alert via email
  · If duplicate detection ambiguous → create contact, flag sonty_possible_duplicate
```

---

## WF-02: Call Attempt 1

```
TRIGGER: 1 hour after lead created (or next business hour if outside 08:30–18:00)

STEPS:
  1. Check deal is still in stage "New Lead"
     └── If stage has advanced → abort (already contacted)
  2. Create HubSpot Task:
     · Title: "Bel {Firstname} – Poging 1"
     · Due: now
     · Assign to: deal owner
  3. Update deal stage: "Call Attempt 1"
  4. Set sonty_call_attempt_1_date = now
  5. Schedule WF-03 for 24 hours later

ERROR HANDLING:
  · If HubSpot API fails → log, retry, alert
```

---

## WF-03: Call Attempt 2

```
TRIGGER: 24 hours after WF-02 (business hours only)

STEPS:
  1. Check deal stage
     └── If stage has advanced past "Call Attempt 1" → abort
  2. Create HubSpot Task:
     · Title: "Bel {Firstname} – Poging 2"
     · Due: now
  3. Update deal stage: "Call Attempt 2"
  4. Set sonty_call_attempt_2_date = now
  5. Schedule WF-04 for 4 hours later (send first quote if still no contact)
```

---

## WF-04: First Quote Send (Reuzenpanda)

```
TRIGGER:
  Option A: 4 hours after WF-03, if stage is still "Call Attempt 2"
  Option B: Manual trigger by sales rep from HubSpot

STEPS:
  1. Check deal stage — abort if already past "Call Attempt 2"
  2. Call Reuzenpanda API:
     · Input: product_interest, postal_code
     · Output: quote PDF URL + first quote amount
  3. Store quote PDF link on HubSpot deal
  4. Set sonty_first_quote_amount + sonty_first_quote_date
  5. Send email via Outlook:
     · Template: first_quote_email
     · Attach: Reuzenpanda PDF
     · Log email activity in HubSpot
  6. Update deal stage: "First Quote Sent"
  7. Write to Postgres: funnel_event
  8. Schedule WF-05 for 3 days later

ERROR HANDLING:
  · If Reuzenpanda API fails → create HubSpot task "Stuur eerste offerte handmatig"
  · If email fails → retry, then alert
```

---

## WF-05: Quote Follow-up (WhatsApp)

```
TRIGGER: 3 days after WF-04, if stage is still "First Quote Sent"

STEPS:
  1. Check deal stage — abort if advanced
  2. Check sonty_whatsapp_opt_in = true
     └── If false → send follow-up email instead via Outlook
  3. Send WhatsApp message:
     · Template: quote_followup_whatsapp
     · Variables: firstname, product_interest
  4. Log WhatsApp message as note in HubSpot
  5. Update deal stage: "Quote Follow-up"
  6. Create HubSpot task: "Opvolgen als geen reactie binnen 48u"
```

---

## WF-06: Measurement Booking

```
TRIGGER: Sales rep marks deal stage "Quote Accepted" in HubSpot

STEPS:
  1. Create appointment in Microsoft Bookings:
     · Service: "Opmeting"
     · Duration: 60 minutes
     · Customer: contact name + email + phone
  2. Store appointment ID on HubSpot deal (sonty_measurement_date)
  3. Send confirmation email via Outlook:
     · Template: measurement_confirmation_email
     · Include: date, time, address confirmation
  4. If WhatsApp opt-in: send WhatsApp confirmation
  5. Update deal stage: "Measurement Scheduled"
  6. Write to Postgres: funnel_event

ERROR HANDLING:
  · If no slots available → create task "Plan opmeting handmatig"
```

---

## WF-07: Post-Measurement Alert

```
TRIGGER: Microsoft Bookings marks appointment as completed

STEPS:
  1. Update deal stage: "Measurement Done"
  2. Create HubSpot task: "Verwerk opmeting en maak definitieve offerte in Gripp"
     · Assign to: deal owner
     · Due: same day
  3. Write to Postgres: funnel_event (measurement_done)
```

---

## WF-08: Final Quote Send (Gripp)

```
TRIGGER: Sales rep triggers via HubSpot (after entering measurements in Gripp)

STEPS:
  1. Call Gripp API:
     · Input: deal details, product specs, measured dimensions
     · Creates quote in Gripp
     · Returns: quote_id, PDF URL, total amount
  2. Store gripp_quote_id + sonty_final_quote_amount on HubSpot deal
  3. Send email via Outlook:
     · Template: final_quote_email
     · Attach: Gripp quote PDF
     · Log in HubSpot
  4. Update deal stage: "Final Quote Sent"
  5. Set sonty_final_quote_date
  6. Write to Postgres: funnel_event
```

---

## WF-09: Deal Won + Deposit Invoice

```
TRIGGER: Gripp quote status changes to "Accepted"
         (n8n polls Gripp every 30 min, or webhook if available)

STEPS:
  1. Update HubSpot deal:
     · Stage: "Won"
     · Amount: final_quote_amount
     · Close date: today
  2. Create deposit invoice in Gripp:
     · Amount: 50% of final quote
     · Due: 14 days
  3. Store gripp_invoice_id_deposit on HubSpot deal
  4. Send deposit invoice email via Outlook:
     · Template: deposit_invoice_email
     · Attach: Gripp invoice PDF
  5. Write to Postgres: funnel_event (won) + revenue_event (deposit, invoiced)
```

---

## WF-10: Deposit Confirmed → Product Order

```
TRIGGER: Gripp deposit invoice status changes to "Paid"

STEPS:
  1. Update HubSpot deal stage: "Deposit Received"
  2. Set sonty_deposit_paid_date
  3. Create HubSpot task: "Bestel producten bij leverancier"
     · Assign to: operations
     · Due: today
  4. Send internal notification (email or WhatsApp to operations team)
  5. Write to Postgres: funnel_event (deposit_paid) + revenue_event (deposit, paid)
```

---

## WF-11: Installation Scheduling

```
TRIGGER: Sales rep marks deal "Products Arrived" in HubSpot

STEPS:
  1. Set sonty_products_arrived_date
  2. Update deal stage: "Products Ordered"
  3. Create appointment in Microsoft Bookings:
     · Service: "Installatie"
     · Duration: depends on product (stored on deal)
  4. Store installation_date on deal
  5. Send installation confirmation email + WhatsApp to customer
  6. Update deal stage: "Installation Scheduled"
  7. Write to Postgres: funnel_event
```

---

## WF-12: Post-Installation Wrap-up

```
TRIGGER: Microsoft Bookings installation appointment marked completed

STEPS:
  1. Update deal stage: "Installation Done"
  2. Create final invoice in Gripp:
     · Amount: 50% remaining balance
     · Due: 14 days
  3. Store gripp_invoice_id_final
  4. Send final invoice email via Outlook
  5. Wait 24 hours → send review request via WhatsApp (if opt-in)
     Fallback: send review request via email
  6. Update deal stage: "Completed"
  7. Write to Postgres: funnel_event (completed) + revenue_event (final, invoiced)
```

---

## WF-13: Reporting ETL

```
TRIGGER: Scheduled — every hour

STEPS:
  1. Pull from HubSpot: all updated contacts + deals since last run
  2. Pull from Gripp: invoice + payment status for open deals
  3. Pull from Microsoft Bookings: appointment status changes
  4. Pull from Meta / Google / Pinterest: daily ad spend + lead counts
  5. Transform to Postgres schema
  6. UPSERT into: leads, deals, funnel_events, revenue_events, ad_performance
  7. Log ETL run result (rows updated, errors)

ERROR HANDLING:
  · Log failed pulls per system
  · Continue with available data — do not abort full ETL for one failing source
  · Alert if same source fails 3+ consecutive runs
```

---

## WF-14: Daily KPI Snapshot

```
TRIGGER: Scheduled — daily at 06:00

STEPS:
  1. Query Postgres for previous day's data
  2. Calculate:
     · leads_total (count by date)
     · leads_contacted (deals past "New Lead")
     · first_quotes_sent
     · measurements_done
     · deals_won
     · deals_completed
     · revenue_invoiced (sum of all invoices created)
     · revenue_collected (sum of paid invoices)
     · conversion_rate (won / leads_total)
     · avg_deal_value (revenue / won)
  3. INSERT into kpi_snapshots (period=daily)
  4. Rollup: weekly snapshot on Mondays, monthly on 1st of month
```

---

## Business Hours Definition

All time-based triggers respect business hours:
- **Monday–Friday: 08:30–18:00**
- **Saturday: 09:00–13:00**
- **Sunday + public holidays: no automated outreach**

Triggers that fall outside business hours are queued and fire at the next business hour open.
