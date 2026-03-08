# Sonty — HubSpot CRM Design

> Status: Design phase. Ready to configure.
> Last updated: 2026-03-08
> HubSpot plan required: Sales Hub Professional (min. 2 users)

---

## Contents

1. [Pipeline Stages](#1-pipeline-stages)
2. [Contact Properties](#2-contact-properties)
3. [Deal Properties](#3-deal-properties)
4. [HubSpot Native Workflows](#4-hubspot-native-workflows)
5. [Zapier Workflows](#5-zapier-workflows)
6. [HubSpot Email Sequences](#6-hubspot-email-sequences)
7. [Configuration Checklist](#7-configuration-checklist)

---

## 1. Pipeline Stages

Pipeline name: **Sonty Verkoop**

Each stage has a probability (used by HubSpot for forecast). Closed-won and
closed-lost are HubSpot system stages — all others are custom.

| # | Stage name | Internal ID | Probability | Owned by | Next trigger |
|---|---|---|---|---|---|
| 1 | Nieuwe lead | `new_lead` | 5% | Auto-assigned | HS-WF-01 fires immediately |
| 2 | Belpoging 1 | `call_attempt_1` | 5% | Sales rep | Rep calls, logs outcome |
| 3 | Belpoging 2 | `call_attempt_2` | 5% | Sales rep | Rep calls, logs outcome |
| 4 | Contact gelegd | `in_contact` | 15% | Sales rep | Rep qualifies interest |
| 5 | Eerste offerte verzonden | `first_quote_sent` | 20% | Zapier | ZAP-02 triggers |
| 6 | Offerte follow-up | `quote_followup` | 20% | Zapier | ZAP-09 sends WhatsApp |
| 7 | Opmeting gepland | `measurement_scheduled` | 35% | Zapier | ZAP-03 creates booking |
| 8 | Opmeting gedaan | `measurement_done` | 45% | Rep / Bookings | HS-WF task to process |
| 9 | Definitieve offerte verzonden | `final_quote_sent` | 55% | Zapier | ZAP-04 triggers |
| 10 | Gewonnen | `won` | 100% | Zapier | ZAP-05 creates deposit invoice |
| 11 | Aanbetaling ontvangen | `deposit_received` | 100% | Zapier | ZAP-06 notifies ops |
| 12 | Producten besteld | `products_ordered` | 100% | Sales rep | Manual update |
| 13 | Installatie gepland | `installation_scheduled` | 100% | Zapier | ZAP-07 creates booking |
| 14 | Installatie gedaan | `installation_done` | 100% | Bookings | ZAP-08 triggers |
| 15 | Afgerond | `completed` | 100% | Zapier | Deal closed |
| — | Verloren | `lost` | 0% | Rep | HS-WF-07 fires |

### Stage transition rules

```
new_lead
  ├── Auto → call_attempt_1        (HS-WF-01: 1 business hour after creation)
  └── Rep marks "Contact gelegd"  → in_contact  (skip attempts if called)

call_attempt_1
  ├── Rep logs: connected          → in_contact
  ├── Rep logs: no answer          → call_attempt_2  (HS-WF-01: next day)
  └── Rep logs: wrong number       → lost

call_attempt_2
  ├── Rep logs: connected          → in_contact
  └── Rep logs: no answer          → first_quote_sent  (HS-WF-01: ZAP-02 trigger)

in_contact
  └── Rep sends first quote        → first_quote_sent  (or ZAP-02 manual trigger)

first_quote_sent
  ├── Customer responds positively  → measurement_scheduled
  ├── No response 3 days           → quote_followup  (HS-WF-04)
  └── Customer declines            → lost

quote_followup
  ├── Customer responds            → measurement_scheduled
  └── No response 7 more days     → lost  (HS-WF stale deal alert)

measurement_scheduled
  └── Appointment completed        → measurement_done  (Bookings → Zapier)

measurement_done
  └── Rep creates quote in Gripp   → final_quote_sent  (ZAP-04)

final_quote_sent
  ├── Gripp quote accepted         → won  (ZAP-05)
  └── No response 5 days           → stale deal alert (HS-WF-06)

won → deposit_received → products_ordered → installation_scheduled
    → installation_done → completed
```

---

## 2. Contact Properties

### Standard HubSpot properties — configure as required fields on forms

| Property | API name | Type | Required | Notes |
|---|---|---|---|---|
| First name | `firstname` | Text | Yes | |
| Last name | `lastname` | Text | Yes | |
| Email | `email` | Text | Yes | Primary dedup key |
| Phone | `phone` | Text | Yes | Secondary dedup key |
| Postal code | `zip` | Text | Yes | Used for region + Reuzenpanda |
| City | `city` | Text | No | Auto-fill from postal code if possible |
| Lead source | `lead_source` | Dropdown | Auto | Set by Zapier on creation |
| Contact owner | `hubspot_owner_id` | Owner | Auto | Assigned on creation |

### Custom contact properties — create in HubSpot Settings → Properties

All custom properties use the group name **"Sonty"**.

| Label | API name | Type | Options | Notes |
|---|---|---|---|---|
| Product interesse | `sonty_product_interest` | Dropdown | Zonnescherm, Pergola, Screens, Rolluiken, Terrasoverkapping, Anders | Set from lead form |
| Lead platform | `sonty_lead_platform` | Dropdown | Meta, Google, Pinterest, Organisch, Verwijzing, Direct | Set by Zapier |
| UTM campagne | `sonty_utm_campaign` | Single-line text | — | From ad URL params |
| UTM advertentiegroep | `sonty_utm_adset` | Single-line text | — | From ad URL params |
| WhatsApp toestemming | `sonty_whatsapp_opt_in` | Boolean (checkbox) | Ja / Nee | Must be true to receive WA messages |
| WhatsApp toestemming datum | `sonty_whatsapp_opt_in_date` | Date | — | Set when opt-in recorded |
| Mogelijke duplicaat | `sonty_possible_duplicate` | Boolean | — | Set by Zapier dedup logic |
| Bron advertentie-ID | `sonty_ad_id` | Single-line text | — | Ad platform ad ID, for attribution |

---

## 3. Deal Properties

### Standard HubSpot deal properties — use as-is

| Property | API name | Type | Notes |
|---|---|---|---|
| Deal name | `dealname` | Text | Auto: "{Achternaam} – {Product}" |
| Pipeline | `pipeline` | Pipeline | Sonty Verkoop |
| Deal stage | `dealstage` | Stage | See section 1 |
| Amount | `amount` | Number | Set when final quote accepted |
| Close date | `closedate` | Date | Set at Won or Lost |
| Deal owner | `hubspot_owner_id` | Owner | Assigned sales rep |
| Lost reason | `closed_lost_reason` | Dropdown | See options below |

Lost reason options (configure in HubSpot):
- Te duur
- Beslissing uitgesteld
- Gekozen voor concurrent
- Niet bereikbaar / geen reactie
- Project afgeblazen
- Verkeerde lead

### Custom deal properties — create in HubSpot Settings → Properties

Group name: **"Sonty – Offerte & Planning"**

#### Call tracking

| Label | API name | Type | Notes |
|---|---|---|---|
| Belpoging 1 datum | `sonty_call_1_date` | Date/time | Set by HS-WF-01 |
| Belpoging 2 datum | `sonty_call_2_date` | Date/time | Set by HS-WF-01 |
| Bel-uitkomst | `sonty_call_outcome` | Dropdown | Verbonden, Geen gehoor, Voicemail, Fout nummer |
| Eerste offerte trigger | `sonty_first_quote_trigger` | Boolean | Set by WF to trigger ZAP-02 |

#### First quote (Reuzenpanda)

| Label | API name | Type | Notes |
|---|---|---|---|
| Eerste offerte datum | `sonty_first_quote_date` | Date | Set by ZAP-02 |
| Eerste offerte bedrag | `sonty_first_quote_amount` | Number | From Reuzenpanda |
| Reuzenpanda offerte-ID | `sonty_reuzenpanda_quote_id` | Single-line text | From Reuzenpanda API |
| Eerste offerte PDF | `sonty_first_quote_pdf_url` | Single-line text | Link to PDF |

#### Measurement

| Label | API name | Type | Notes |
|---|---|---|---|
| Opmeting datum | `sonty_measurement_date` | Date | Set by ZAP-03 |
| Bookings afspraak-ID | `sonty_measurement_booking_id` | Single-line text | From MS Bookings |
| Opmeting uitgevoerd door | `sonty_measurement_rep` | Single-line text | Name of measurer |

#### Final quote (Gripp)

| Label | API name | Type | Notes |
|---|---|---|---|
| Definitieve offerte datum | `sonty_final_quote_date` | Date | Set by ZAP-04 |
| Definitieve offerte bedrag | `sonty_final_quote_amount` | Number | From Gripp — also sets deal Amount |
| Gripp offerte-ID | `sonty_gripp_quote_id` | Single-line text | Gripp reference |
| Gripp offerte status | `sonty_gripp_quote_status` | Dropdown | Concept, Verzonden, Geaccepteerd, Afgewezen |

#### Deposit invoice

| Label | API name | Type | Notes |
|---|---|---|---|
| Aanbetaling bedrag | `sonty_deposit_amount` | Number | 50% of final quote |
| Aanbetaling factuur-ID | `sonty_gripp_invoice_deposit_id` | Single-line text | Gripp invoice ID |
| Aanbetaling vervaldatum | `sonty_deposit_due_date` | Date | Set by ZAP-05 |
| Aanbetaling ontvangen datum | `sonty_deposit_paid_date` | Date | Set by ZAP-06 |

#### Installation

| Label | API name | Type | Notes |
|---|---|---|---|
| Producten ontvangen datum | `sonty_products_arrived_date` | Date | Set manually by rep |
| Installatie datum | `sonty_installation_date` | Date | Set by ZAP-07 |
| Installatie afspraak-ID | `sonty_installation_booking_id` | Single-line text | From MS Bookings |

#### Final invoice

| Label | API name | Type | Notes |
|---|---|---|---|
| Eindfactuur bedrag | `sonty_final_invoice_amount` | Number | Remaining balance |
| Eindfactuur ID | `sonty_gripp_invoice_final_id` | Single-line text | Gripp invoice ID |
| Eindfactuur datum | `sonty_final_invoice_date` | Date | Set by ZAP-08 |
| Review verzocht | `sonty_review_requested` | Boolean | Set by ZAP-08 |

---

## 4. HubSpot Native Workflows

All workflows live in **HubSpot → Automation → Workflows**.
They require **Sales Hub Professional**.

---

### HS-WF-01: Belproces & Eerste Offerte Trigger

**Purpose:** Create call tasks after lead arrives. Trigger first quote send if no contact after two attempts.

```
TRIGGER
  Object: Deal
  Event:  Deal is created
  Filter: Pipeline = "Sonty Verkoop"

DELAY: 1 hour (business hours: Mon–Fri 08:30–18:00, Sat 09:00–13:00)

ACTION 1: Set deal property
  sonty_call_1_date = [today's date]

ACTION 2: Create task
  Title:   "📞 Bel [Contact: Firstname] [Contact: Lastname] – Poging 1"
  Due:     0 days from now
  Assign:  Deal owner
  Notes:   "Telefoon: [Contact: Phone] | Product: [Deal: sonty_product_interest]"
  Type:    Call

DELAY: 1 business day

BRANCH: If/then
  Condition: Deal stage is NOT "Belpoging 1" (i.e. stage has advanced)
  YES → End workflow (rep made contact)
  NO  → Continue

ACTION 3: Move deal to stage: Belpoging 2
ACTION 4: Set deal property
  sonty_call_2_date = [today's date]

ACTION 5: Create task
  Title:   "📞 Bel [Contact: Firstname] [Contact: Lastname] – Poging 2 (laatste)"
  Due:     0 days from now
  Assign:  Deal owner
  Notes:   "Telefoon: [Contact: Phone] | Laatste belpoging voor automatische offerte"
  Type:    Call

DELAY: 4 hours (business hours)

BRANCH: If/then
  Condition: Deal stage is still "Belpoging 2"
  YES → Continue
  NO  → End workflow

ACTION 6: Set deal property
  sonty_first_quote_trigger = true
  (This property change triggers ZAP-02 in Zapier)

ACTION 7: Move deal to stage: Eerste offerte verzonden
```

---

### HS-WF-02: Interne Notificaties bij Stagewijziging

**Purpose:** Alert the deal owner by email whenever a deal moves to a stage that requires action.

```
TRIGGER
  Object: Deal
  Event:  Deal stage is updated
  Filter: Pipeline = "Sonty Verkoop"

ACTION: Send internal email to deal owner
  From:    noreply@sonty.nl
  Subject: "Deal bijgewerkt: [Deal: Dealname] → [Deal: Stage]"
  Body:    Contact name, phone, product interest, new stage, link to deal

  Personalization per stage:
  · Opmeting gedaan      → "Verwerk de opmeting en maak definitieve offerte in Gripp"
  · Aanbetaling ontvangen → "Bestel de producten bij de leverancier"
  · Producten besteld    → "Bevestig wanneer producten zijn ontvangen in HubSpot"
  · Installatie gedaan   → "Controleer eindfactuur in Gripp"
```

---

### HS-WF-03: Offerte Follow-up Timer

**Purpose:** Move deal to "Offerte follow-up" if no stage change 3 days after first quote.

```
TRIGGER
  Object: Deal
  Event:  Deal stage changes to "Eerste offerte verzonden"

DELAY: 3 business days

BRANCH: If/then
  Condition: Deal stage is still "Eerste offerte verzonden"
  YES → Continue
  NO  → End workflow (customer responded)

ACTION 1: Move deal to stage: Offerte follow-up
  (Stage change triggers ZAP-09: WhatsApp follow-up message)

ACTION 2: Create task
  Title:   "📋 Opvolgen: [Contact: Firstname] heeft niet gereageerd op offerte"
  Due:     Today
  Assign:  Deal owner
  Type:    To-do
```

---

### HS-WF-04: Reactie Detectie → Contact Gelegd

**Purpose:** When a lead replies to any email in a sequence, move the deal forward.

```
TRIGGER
  Object: Contact
  Event:  Contact replies to a sequence email

ACTION 1: Find associated deal in pipeline "Sonty Verkoop"

BRANCH: If/then
  Condition: Deal stage is one of:
    Belpoging 1, Belpoging 2, Eerste offerte verzonden, Offerte follow-up
  YES → Continue
  NO  → End workflow

ACTION 2: Move deal to stage: Contact gelegd
ACTION 3: Create task for deal owner
  Title:   "💬 [Contact: Firstname] heeft gereageerd — kwalificeer en plan opmeting"
  Due:     Today
  Type:    To-do
ACTION 4: Send internal notification email to deal owner
```

---

### HS-WF-05: Verlopen Deal Alert

**Purpose:** Flag deals that have not moved in 7 days across any active stage.

```
TRIGGER
  Object: Deal
  Event:  Scheduled (check daily)
  Filter: Pipeline = "Sonty Verkoop"
         Deal stage is NOT one of: Gewonnen, Afgerond, Verloren
         Time in current stage > 7 days

ACTION 1: Create task
  Title:   "⚠️ Deal stilstaand: [Deal: Dealname] — [Deal: Stage] — [X] dagen"
  Due:     Today
  Assign:  Deal owner

ACTION 2: Send internal notification to deal owner
  Subject: "Deal [Dealname] staat al [X] dagen in '[Stage]'"
```

---

### HS-WF-06: Definitieve Offerte Opvolging

**Purpose:** Alert if no response to final quote within 5 days.

```
TRIGGER
  Object: Deal
  Event:  Deal stage changes to "Definitieve offerte verzonden"

DELAY: 5 business days

BRANCH: If/then
  Condition: Deal stage is still "Definitieve offerte verzonden"
  YES → Continue
  NO  → End workflow

ACTION 1: Create task
  Title:   "📋 Opvolgen definitieve offerte: [Contact: Firstname] [Contact: Lastname]"
  Due:     Today
  Assign:  Deal owner

ACTION 2: Send internal notification to deal owner
```

---

### HS-WF-07: Verloren Deal Afhandeling

**Purpose:** Clean up when a deal is marked lost. Schedule re-engagement.

```
TRIGGER
  Object: Deal
  Event:  Deal stage changes to "Verloren"

ACTION 1: Unenroll contact from all active sequences
ACTION 2: Set deal property: closedate = today
ACTION 3: Create task
  Title:   "🔁 Heractiveer [Contact: Firstname] over 90 dagen"
  Due:     90 days from now
  Assign:  Deal owner
  Notes:   "Reden verlies: [Deal: sonty_loss_reason]"
ACTION 4: Send internal summary email to deal owner
  Subject: "Deal verloren: [Dealname] — [Loss reason]"
```

---

### HS-WF-08: Opmeting Gedaan → Actietaak

**Purpose:** When deal reaches "Opmeting gedaan" (set by Zapier after Bookings appointment completes), prompt rep to create the final quote in Gripp.

```
TRIGGER
  Object: Deal
  Event:  Deal stage changes to "Opmeting gedaan"

ACTION 1: Create task
  Title:   "📐 Verwerk opmeting & maak definitieve offerte in Gripp"
  Due:     Same day (urgent)
  Assign:  Deal owner
  Notes:   "Klant: [Contact: Firstname] [Contact: Lastname]
            Telefoon: [Contact: Phone]
            Product: [Deal: sonty_product_interest]
            Opmeting datum: [Deal: sonty_measurement_date]"
  Type:    To-do

ACTION 2: Send internal notification to deal owner
```

---

## 5. Zapier Workflows

All Zaps connect HubSpot to external systems. Use **Zapier Professional** (10,000 tasks/month).

---

### ZAP-01: Lead Intake van Advertentieplatforms

**Trigger:** Meta Lead Ads / Google Lead Form Extensions / Pinterest (separate Zap per platform, same structure)

```
TRIGGER:  New lead in Meta Lead Ads
          (or: New lead in Google Ads)

STEP 1 — Search HubSpot Contact
  App:    HubSpot
  Action: Find Contact by email
  Input:  email from lead form

STEP 2 — Filter: does contact exist?

  Path A: Contact does NOT exist
    ACTION 1: Create HubSpot Contact
      firstname          ← lead form first name
      lastname           ← lead form last name
      email              ← lead form email
      phone              ← lead form phone
      zip                ← lead form postal code
      sonty_product_interest ← lead form product dropdown
      sonty_lead_platform    ← "Meta" (hardcoded per Zap)
      sonty_utm_campaign     ← UTM or campaign name from platform
      sonty_whatsapp_opt_in  ← from opt-in field (if present)
    ACTION 2: Create HubSpot Deal
      dealname           ← "[lastname] – [product_interest]"
      pipeline           ← "Sonty Verkoop"
      dealstage          ← "new_lead"
      hubspot_owner_id   ← default owner (or round-robin if multiple reps)

  Path B: Contact already exists
    ACTION 1: Update HubSpot Contact
      (update any empty fields with new data)
    ACTION 2: Add HubSpot Note to Contact
      "Duplicate lead ontvangen van [platform] op [date]. Bestaand contact bijgewerkt."
    ACTION 3: Set contact property
      sonty_possible_duplicate = true

STEP 3 — Always: Log Zap execution
  App:    HubSpot
  Action: Create note on contact
  Body:   "Lead ontvangen via [platform] | Campagne: [utm_campaign] | [timestamp]"
```

---

### ZAP-02: Eerste Offerte via Reuzenpanda

**Trigger:** Deal property `sonty_first_quote_trigger` set to `true` in HubSpot

```
TRIGGER:  HubSpot — Deal property updated
          Filter: sonty_first_quote_trigger = true
                  Pipeline = "Sonty Verkoop"

STEP 1 — Get full deal + contact details
  App:    HubSpot
  Action: Get deal by ID (with associations)
          Get associated contact

STEP 2 — Call Reuzenpanda API
  App:    Webhooks by Zapier (POST)
  URL:    [Reuzenpanda API endpoint]
  Body:
    product_type:  [deal: sonty_product_interest]
    postal_code:   [contact: zip]
    customer_name: [contact: firstname + lastname]
  Output: quote_id, quote_amount, pdf_url

STEP 3 — Update HubSpot Deal
  App:    HubSpot
  Action: Update deal
    sonty_reuzenpanda_quote_id  ← quote_id from Reuzenpanda
    sonty_first_quote_amount    ← quote_amount
    sonty_first_quote_pdf_url   ← pdf_url
    sonty_first_quote_date      ← today

STEP 4 — Send email via HubSpot
  App:    HubSpot
  Action: Send one-to-one email
  Template: "Eerste offerte [product]"
  To:     [contact email]
  Attach: [pdf_url]

STEP 5 — Log note on HubSpot deal
  "Eerste offerte verzonden via Reuzenpanda.
   Bedrag: €[quote_amount] | Offerte-ID: [quote_id]"

  ERROR PATH (if Reuzenpanda API fails):
    Create HubSpot task:
      "⚠️ Reuzenpanda API mislukt — stuur eerste offerte handmatig"
      Due: today | Assign: deal owner
    Send alert email to deal owner
    Do NOT move deal stage (leave for manual handling)
```

---

### ZAP-03: Opmeting Inplannen via Microsoft Bookings

**Trigger:** Deal stage changes to `measurement_scheduled` in HubSpot

```
TRIGGER:  HubSpot — Deal stage updated to "Opmeting gepland"

STEP 1 — Get deal + contact details
  App:    HubSpot
  Action: Get associated contact for deal

STEP 2 — Create booking via Microsoft Graph API
  App:    Webhooks by Zapier (POST)
  URL:    https://graph.microsoft.com/v1.0/solutions/bookingBusinesses/[id]/appointments
  Headers: Authorization: Bearer [MS_ACCESS_TOKEN]
  Body:
    serviceId:       [opmeting service ID from Bookings]
    customerName:    [contact full name]
    customerEmail:   [contact email]
    customerPhone:   [contact phone]
    customerNotes:   [deal: sonty_product_interest]
    start:           (manual or from a date field set by rep)
  Output: appointment_id, start_time

STEP 3 — Update HubSpot Deal
    sonty_measurement_booking_id  ← appointment_id
    sonty_measurement_date        ← start_time

STEP 4 — Send confirmation email via HubSpot
  Template: "Opmetingsbevestiging"
  Include:  date, time, address confirmation, what to expect

STEP 5 — If sonty_whatsapp_opt_in = true:
  App:    Webhooks by Zapier (POST to 360dialog)
  Template: opmeting_bevestiging
  Variables: naam, datum, tijd

STEP 6 — Log note on deal
  "Opmeting ingepland op [datum] | Bookings ID: [appointment_id]"

  NOTE: If scheduling should be customer-self-service, send a HubSpot Meetings
  link instead of creating the booking directly in this step.
```

---

### ZAP-04: Definitieve Offerte via Gripp

**Trigger:** Deal stage changes to `final_quote_sent` in HubSpot
(rep manually moves stage after entering measurements in Gripp)

```
TRIGGER:  HubSpot — Deal stage updated to "Definitieve offerte verzonden"

STEP 1 — Get deal + contact details from HubSpot

STEP 2 — Create quote in Gripp
  App:    Webhooks by Zapier (POST)
  URL:    https://app.gripp.nl/api/v3/quotes
  Headers: Authorization: Bearer [GRIPP_API_KEY]
  Body:
    company_name:   [contact: company or full name]
    contact_email:  [contact: email]
    lines:          [product, quantity, price — from deal properties]
    reference:      [deal: dealname]
  Output: quote_id, pdf_url, total_amount

STEP 3 — Update HubSpot Deal
    sonty_gripp_quote_id          ← quote_id
    sonty_final_quote_amount      ← total_amount
    sonty_final_quote_date        ← today
    amount                        ← total_amount  (standard deal amount field)
    sonty_gripp_quote_status      ← "Verzonden"

STEP 4 — Send email via HubSpot
  Template: "Definitieve offerte"
  Attach:   [pdf_url from Gripp]

STEP 5 — Log note on deal
  "Definitieve offerte verzonden via Gripp.
   Bedrag: €[total_amount] | Gripp ID: [quote_id]"
```

---

### ZAP-05: Gewonnen → Aanbetalingsfactuur

**Trigger:** Gripp quote status changes to "Accepted"
(Zapier polls Gripp API every 15 minutes for status changes on open quotes)

```
TRIGGER:  Zapier Schedule (every 15 min) + Webhooks by Zapier
  OR:     Gripp webhook → Zapier Catch Hook (if Gripp supports it)

STEP 1 — Find updated Gripp quotes with status "Geaccepteerd"

STEP 2 — Find matching HubSpot deal
  Search by sonty_gripp_quote_id

STEP 3 — Update HubSpot Deal
    dealstage                   ← "won"
    closedate                   ← today
    sonty_gripp_quote_status    ← "Geaccepteerd"

STEP 4 — Create deposit invoice in Gripp
  App:    Webhooks by Zapier (POST)
  Body:
    type:           invoice
    quote_id:       [gripp_quote_id]
    amount:         [50% of total_amount]
    due_date:       [today + 14 days]
    description:    "Aanbetaling 50% — [deal: dealname]"
  Output: invoice_id, invoice_pdf_url

STEP 5 — Update HubSpot Deal
    sonty_deposit_amount              ← 50% amount
    sonty_gripp_invoice_deposit_id    ← invoice_id
    sonty_deposit_due_date            ← today + 14 days

STEP 6 — Send invoice email via HubSpot
  Template: "Aanbetalingsfactuur"
  Attach:   [invoice_pdf_url]

STEP 7 — Log note on deal
  "Deal gewonnen. Aanbetalingsfactuur aangemaakt in Gripp.
   Bedrag: €[deposit_amount] | Factuur-ID: [invoice_id]"
```

---

### ZAP-06: Aanbetaling Ontvangen → Productbestelling

**Trigger:** Gripp invoice status changes to "Paid"
(Zapier polls Gripp API every 15 minutes)

```
TRIGGER:  Zapier Schedule — check Gripp deposit invoices for "Betaald" status

STEP 1 — Find paid deposit invoices in Gripp
  Filter: type = deposit, status = paid, not yet processed

STEP 2 — Find HubSpot deal by sonty_gripp_invoice_deposit_id

STEP 3 — Update HubSpot Deal
    dealstage                  ← "deposit_received"
    sonty_deposit_paid_date    ← today

STEP 4 — Create task in HubSpot
  Title:   "🛒 Bestel producten voor [Contact: Firstname] [Contact: Lastname]"
  Due:     Today
  Assign:  Operations owner (fixed assignee)
  Notes:   "Aanbetaling ontvangen. Product: [sonty_product_interest]
            Bedrag: €[deposit_amount]"

STEP 5 — Send internal notification
  To:     operations@sonty.nl
  Via:    HubSpot internal email OR WhatsApp via 360dialog
  Body:   Deal name, product, deposit confirmed, action: order from supplier
```

---

### ZAP-07: Installatie Inplannen

**Trigger:** Deal stage changes to `installation_scheduled` in HubSpot
(rep manually sets after confirming products have arrived)

```
TRIGGER:  HubSpot — Deal stage updated to "Installatie gepland"

STEP 1 — Get deal + contact details from HubSpot

STEP 2 — Create installation booking via Microsoft Graph API
  App:    Webhooks by Zapier (POST)
  Body:
    serviceId:       [installatie service ID from Bookings]
    customerName:    [contact full name]
    customerEmail:   [contact email]
    customerPhone:   [contact phone]
    customerNotes:   [deal: sonty_product_interest] + [installation details]
  Output: appointment_id, start_time

STEP 3 — Update HubSpot Deal
    sonty_installation_booking_id  ← appointment_id
    sonty_installation_date        ← start_time

STEP 4 — Send installation confirmation email via HubSpot
  Template: "Installatiebevestiging"
  Include:  date, time, what to prepare, contact details installer

STEP 5 — If sonty_whatsapp_opt_in = true:
  Send WhatsApp confirmation via 360dialog
  Template: installatie_bevestiging
```

---

### ZAP-08: Na Installatie → Eindfactuur & Review

**Trigger:** Microsoft Bookings installation appointment marked "Completed"
(Zapier polls Bookings API or receives Graph API webhook)

```
TRIGGER:  Bookings appointment status = "Completed"
          Filter: service type = "Installatie"

STEP 1 — Find HubSpot deal by sonty_installation_booking_id

STEP 2 — Update HubSpot Deal stage to "Installatie gedaan"

STEP 3 — Create final invoice in Gripp
  Amount: 50% remaining balance (= sonty_final_quote_amount – sonty_deposit_amount)
  Due:    Today + 14 days
  Output: invoice_id, pdf_url

STEP 4 — Update HubSpot Deal
    sonty_gripp_invoice_final_id  ← invoice_id
    sonty_final_invoice_amount    ← remaining amount
    sonty_final_invoice_date      ← today

STEP 5 — Send final invoice email via HubSpot
  Template: "Eindfactuur"

STEP 6 — Move deal stage to "Afgerond"

STEP 7 — Delay 24 hours (Zapier Delay step)

STEP 8 — If sonty_whatsapp_opt_in = true:
  Send WhatsApp review request via 360dialog
  Template: review_verzoek
  Variables: naam, review_link
  ELSE: Send review request email via HubSpot

STEP 9 — Update HubSpot Deal
    sonty_review_requested = true

STEP 10 — Log note on deal
  "Installatie voltooid. Eindfactuur verzonden. Review verzocht."
```

---

### ZAP-09: WhatsApp Offerte Follow-up

**Trigger:** Deal stage changes to `quote_followup` in HubSpot
(set by HS-WF-03 after 3 days of no response)

```
TRIGGER:  HubSpot — Deal stage updated to "Offerte follow-up"

STEP 1 — Get contact details + deal details from HubSpot

STEP 2 — Filter: sonty_whatsapp_opt_in = true
  YES → Step 3
  NO  → Step 4 (email fallback)

STEP 3 — Send WhatsApp message via 360dialog
  Template: offerte_followup
  Variables:
    naam:     [contact: firstname]
    product:  [deal: sonty_product_interest]
    pdf_url:  [deal: sonty_first_quote_pdf_url]

STEP 4 (fallback) — Send follow-up email via HubSpot
  Template: "Offerte follow-up e-mail"

STEP 5 — Log note on HubSpot deal
  "Follow-up verzonden via [WhatsApp/e-mail] op [datum]"
```

---

## 6. HubSpot Email Sequences

Sequences send **personal 1:1 emails** from the sales rep's connected mailbox. They stop automatically when the contact replies.

Requires: HubSpot Sales Hub Professional + connected Outlook mailbox per rep.

### Sequence 1: Na eerste offerte (no contact established)

Enroll when: deal moves to `first_quote_sent` via ZAP-02 (no live contact made)

| Step | Delay | Email subject |
|---|---|---|
| Email 1 | Immediately | "Uw offerte voor [product] — [rep firstname]" |
| Email 2 | 4 business days | "Heeft u vragen over uw offerte?" |
| Email 3 | 7 business days | "Laatste herinnering — uw offerte is geldig tot [date]" |

### Sequence 2: Na eerste offerte (contact was established)

Enroll when: deal moves to `first_quote_sent` via rep manually (contact was made)

| Step | Delay | Email subject |
|---|---|---|
| Email 1 | 2 business days | "Leuk dat we gesproken hebben — hier uw offerte nogmaals" |
| Email 2 | 5 business days | "Heeft u vragen? Ik help graag" |

### Sequence 3: Na definitieve offerte

Enroll when: deal moves to `final_quote_sent`

| Step | Delay | Email subject |
|---|---|---|
| Email 1 | 3 business days | "Heeft u de offerte kunnen bekijken?" |
| Email 2 | 6 business days | "Offerte — ik ben beschikbaar voor vragen" |

---

## 7. Configuration Checklist

Complete in this order. Do not skip steps.

### HubSpot setup

- [ ] Create pipeline "Sonty Verkoop" with all 16 stages and correct probabilities
- [ ] Create all custom Contact properties (section 2)
- [ ] Create all custom Deal properties (section 3)
- [ ] Add "Lost reason" dropdown options to standard field
- [ ] Configure deal name template: `[Contact: Lastname] – [sonty_product_interest]`
- [ ] Connect Outlook mailbox for each sales rep (Settings → Email Integrations)
- [ ] Configure HubSpot Meetings link for each rep (optional — for self-serve booking)
- [ ] Build HS-WF-01 (call attempt + quote trigger)
- [ ] Build HS-WF-02 (internal stage notifications)
- [ ] Build HS-WF-03 (follow-up timer)
- [ ] Build HS-WF-04 (reply detection)
- [ ] Build HS-WF-05 (stale deal alert)
- [ ] Build HS-WF-06 (final quote follow-up)
- [ ] Build HS-WF-07 (lost deal cleanup)
- [ ] Build HS-WF-08 (post-measurement task)
- [ ] Build Sequence 1, 2, 3
- [ ] Create email templates: eerste offerte, opmeting bevestiging, definitieve offerte, aanbetalingsfactuur, installatiebevestiging, eindfactuur, review verzoek, offerte follow-up

### Zapier setup

- [ ] Connect HubSpot account to Zapier
- [ ] Connect Gripp account to Zapier (API key)
- [ ] Configure 360dialog WhatsApp account + API key
- [ ] Build ZAP-01 (Meta lead intake) — test with test lead
- [ ] Build ZAP-01b (Google lead intake) — test with test lead
- [ ] Build ZAP-02 (Reuzenpanda first quote)
- [ ] Build ZAP-03 (Bookings measurement)
- [ ] Build ZAP-04 (Gripp final quote)
- [ ] Build ZAP-05 (Gripp won + deposit invoice)
- [ ] Build ZAP-06 (payment confirmed)
- [ ] Build ZAP-07 (installation scheduling)
- [ ] Build ZAP-08 (post-installation wrap-up)
- [ ] Build ZAP-09 (WhatsApp follow-up)

### External systems

- [ ] Set up Microsoft Bookings service: "Opmeting" (60 min)
- [ ] Set up Microsoft Bookings service: "Installatie" (variable)
- [ ] Confirm Reuzenpanda API credentials + test endpoint
- [ ] Confirm Gripp API credentials + test quote creation
- [ ] Register WhatsApp templates in 360dialog:
  - `opmeting_bevestiging`
  - `installatie_bevestiging`
  - `offerte_followup`
  - `review_verzoek`
- [ ] Get Meta WhatsApp template approval (can take 24–48h)

### Testing

- [ ] Send test lead from Meta → verify contact + deal created in HubSpot
- [ ] Manually trigger ZAP-02 → verify Reuzenpanda quote + email sent
- [ ] Manually set stage to "Opmeting gepland" → verify Bookings appointment created
- [ ] Manually set stage to "Definitieve offerte verzonden" → verify Gripp quote created
- [ ] Manually set Gripp quote to "Geaccepteerd" → verify HubSpot moves to "Gewonnen"
- [ ] Verify deposit invoice created in Gripp + emailed
- [ ] Mark Gripp invoice paid → verify HubSpot task + ops notification
- [ ] Verify full pipeline end-to-end with one synthetic deal
