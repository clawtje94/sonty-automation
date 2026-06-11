# Zapier Setup Instructies — Stap voor stap

> Status: ZAP-01 LIVE, rest nog in te richten
> Laatste update: 2026-03-26

## Overzicht

| Zap | Status | Prioriteit |
|-----|--------|-----------|
| ZAP-01: Reuzenpanda → HubSpot | ✅ LIVE | - |
| ZAP-02: WhatsApp Follow-up | 🟡 DRAFT | Hoog |
| ZAP-03: Planado Opmeting | 🟡 DRAFT | Hoog |
| ZAP-04: Opmeting Done → HubSpot | 🟡 Webhook bestaat | Hoog |
| ZAP-05: Definitieve Offerte → Gripp | 🟡 DRAFT | Medium |
| ZAP-06: Offerte Akkoord → Gripp Invoice | 🟡 DRAFT | Medium |
| ZAP-07: Order Confirmation Email | ❌ Niet gebouwd | Medium |
| ZAP-08: Installatie → Planado | 🟡 DRAFT | Hoog |
| ZAP-09: Installatie Done → HubSpot | ❌ Niet gebouwd | Medium |
| ZAP-10: Eindfactuur → Gripp | ❌ Niet gebouwd | Laag |
| ZAP-11: Review Request → Trengo | ❌ Niet gebouwd | Laag |

---

## ZAP-01: Reuzenpanda Lead Intake ✅ LIVE

**ID:** 353405789
**Trigger:** Reuzenpanda → Lead Created
**Actions:**
1. HubSpot → Create/Update Contact (email, phone)
2. HubSpot → Create Deal (Summary als naam, Sonty pipeline, Nieuwe Lead)
3. HubSpot → Associate Deal ↔ Contact

**Verbeterpunten (later):**
- Description meesturen naar deal (sonty_reuzenpanda_description)
- Product interest parsen uit description → sonty_product_interest
- Lead platform parsen uit "Hoe komt u bij ons terecht" → sonty_lead_platform
- Voornaam/achternaam parsen uit Description

---

## ZAP-01 Verbeteren — Extra stappen toevoegen

Open: `zapier.com/editor/353405789`

### Stap 2 uitbreiden (Create/Update Contact):
Voeg toe in Configure:
- **First Name**: + → "1. Description" → gebruik Formatter (Text) → Extract Pattern: `Voornaam: (.+)`
  - OF: voeg een Formatter stap toe vóór stap 2
- **Last Name**: zelfde met `Achternaam: (.+)`

### Nieuwe stap 2b: Formatter (optioneel)
Voeg toe tussen stap 1 en 2:
- App: Formatter by Zapier → Text → Extract Pattern
- Input: "1. Description"
- Pattern: `Voornaam: (.+)`
- Dit geeft de voornaam als output

### Stap 3 uitbreiden (Create Deal):
Voeg toe in Configure, scroll naar beneden:
- **Reuzenpanda omschrijving**: + → "1. Description"
- **Eerste prijsindicatie**: + → "1. Parsed Free Fields Cf Lead Value Amount"

---

## ZAP-02: WhatsApp Follow-up via Trengo

**ID:** 353406808
**Trigger:** HubSpot → Deal stage changed to "Prijsindicatie Verstuurd" (ID: 4999295183)

### Configuratie:

**Stap 1 — Trigger:**
- App: HubSpot
- Event: Deal stage changed
- Pipeline: Sonty Verkooppijplijn (3623322812)
- Stage: Prijsindicatie Verstuurd (4999295183)

**Stap 2 — Action: Trengo → Send WhatsApp:**
- Channel: WhatsApp Business (+31 85 006 9681) — ID 1359857
- Phone: contact phone van stap 1
- Template: gebruik goedgekeurde WA template

**Stap 3 — Action: HubSpot → Update Deal:**
- Stage: WhatsApp Verstuurd (4999295184)

**⚠️ LET OP:** Test dit NIET met echte klantdata! Gebruik een test-nummer.

---

## ZAP-03: Planado Opmeting Aanmaken

**ID:** 353373774
**Trigger:** HubSpot → Deal stage changed to "Opmeting Ingepland" (ID: 4999295186)

### Configuratie:

**Stap 1 — Trigger:**
- App: HubSpot
- Deal stage: Opmeting Ingepland (4999295186)

**Stap 2 — Action: Planado → Create Job:**
- Type: Opmeting
- Description: contact naam + deal info
- Address: contact adres
- Duration: 60 min
- Skills: Relevante skill op basis van product

**Stap 3 — Action: HubSpot → Update Deal:**
- sonty_planado_job_id_measurement: Planado job ID van stap 2

---

## ZAP-05: Definitieve Offerte → Gripp

**ID:** 353424308
**Trigger:** HubSpot → Deal stage "Definitieve Offerte Verstuurd" (4999295188)

**⚠️ Gripp API limiet = 0.** Daimy moet eerst API Request Pack kopen in Gripp.

---

## ZAP-08: Installatie → Planado

**ID:** 353424667
**Trigger:** HubSpot → Deal stage "Installatie Ingepland" (4999295192)

Zelfde structuur als ZAP-03 maar met type Installatie.

---

## HubSpot Workflows (handmatig aanmaken)

De Private App heeft geen `automation` scope. Workflows moeten via HubSpot UI:

### WF-01: Belpoging Taken
- **Trigger:** Deal stage = Nieuwe Lead
- **Action 1:** Create Task "Belpoging 1 — {dealname}" (direct)
- **Action 2:** Delay 24h → Create Task "Belpoging 2 — {dealname}"
- **Tip:** Assign aan deal owner

### WF-02: Interne Notificaties
- **Trigger:** Any deal stage change
- **Action:** Email notification to deal owner

### WF-03: Stale Deal Alert
- **Trigger:** No activity on deal for 7 days
- **Action:** Create task + notification

### WF-04: Lost Deal Cleanup
- **Trigger:** Deal stage = Verloren
- **Action:** Set close date + log reason

---

## Private App Scope Uitbreiden

Om workflows via API te kunnen maken:
1. Ga naar: HubSpot → Settings → Integrations → Private Apps
2. Klik op "Sonty Automation"
3. Ga naar Scopes
4. Voeg toe: `automation` scope
5. Save

---

## HubSpot Pipeline Stage IDs (referentie)

| Stage | ID |
|-------|----|
| Nieuwe Lead | 4998659267 |
| Belpoging 1 | 4999295181 |
| Belpoging 2 | 4999295182 |
| Prijsindicatie Verstuurd | 4999295183 |
| WhatsApp Verstuurd | 4999295184 |
| In Contact | 4999295185 |
| Opmeting Ingepland | 4999295186 |
| Opmeting Afgerond | 4999295187 |
| Definitieve Offerte Verstuurd | 4999295188 |
| Offerte Akkoord | 4999295189 |
| Aanbetaling Verstuurd | 5002974448 |
| Aanbetaling Ontvangen | 4999295190 |
| Producten Besteld | 4999295191 |
| Orderbevestiging Ontvangen | 5002974449 |
| Installatie Ingepland | 4999295192 |
| Installatie Afgerond | 4999295193 |
| Eindfactuur Verstuurd | 5003032771 |
| Afgerond | 4999295194 |
| Verloren | 4999295195 |
