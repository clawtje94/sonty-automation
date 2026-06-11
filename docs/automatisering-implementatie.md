# Sonty — Automatisering Implementatie

> Opgesteld: 11 maart 2026
> Pipeline ID: 3623322812
> Status: Implementatie-klaar specificaties

---

## Inhoudsopgave

1. [Speed-to-Lead Automatisering](#1-speed-to-lead-automatisering)
2. [Belpoging Cadans (6 pogingen)](#2-belpoging-cadans-6-pogingen)
3. [Post-Offerte Follow-up Sequence](#3-post-offerte-follow-up-sequence)
4. [Nurture Sequence (niet-reageerders)](#4-nurture-sequence-niet-reageerders)
5. [Review Automatisering](#5-review-automatisering)
6. [Lead Scoring Automatisering](#6-lead-scoring-automatisering)
7. [Overzicht: Wat Nu Bouwen vs. Input Nodig](#7-overzicht-wat-nu-bouwen-vs-input-nodig)

---

## Benodigde HubSpot Custom Properties

Voordat de automations gebouwd worden, moeten de volgende custom properties bestaan in HubSpot (deal-level):

| Property | Type | Opties / Beschrijving |
|----------|------|----------------------|
| `aantal_belpogingen` | Number | 0-6, wordt opgehoogd per poging |
| `laatste_belpoging_datum` | Date | Timestamp van laatste poging |
| `lead_score` | Number | 0-100, berekend door workflow |
| `lead_kwaliteit` | Dropdown | `warm` / `koud` / `budget` |
| `nurture_fase` | Dropdown | `actief` / `nurture` / `verloren` |
| `offerte_verstuurd_datum` | Date | Datum waarop offerte is verstuurd |
| `review_verstuurd` | Checkbox | Of reviewverzoek is verzonden |
| `product_categorie` | Dropdown | Reeds aangemaakt (2026-03-10) |
| `inkoopbedrag` | Number | Reeds aangemaakt (2026-03-10) |

---

## 1. Speed-to-Lead Automatisering

**Doel:** Binnen 1 minuut na leadbinnenkomst: sales team genotificeerd via Telegram + klant ontvangt bevestigings-WhatsApp.

### 1A. Telegram Notificatie aan Sales Team

**Tool:** Zapier (nieuw: ZAP-12)

```
ZAP-12: Speed-to-Lead Telegram Notificatie
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — New Deal
  Filter: Pipeline ID = 3623322812
  Filter: Deal Stage = "Nieuwe Lead" (4998659267)

ACTION 1: Format tekst
  Bericht:
  ──────────────────────
  🚨 NIEUWE LEAD — DIRECT BELLEN!

  Naam: {{contact_firstname}} {{contact_lastname}}
  Telefoon: {{contact_phone}}
  Email: {{contact_email}}
  Product: {{product_categorie}}
  Postcode: {{contact_zip}}
  Prijsindicatie: €{{deal_amount}}

  ➡️ HubSpot: {{deal_url}}

  ⏱ Bel binnen 5 minuten!
  ──────────────────────

ACTION 2: Telegram Bot API — Send Message
  Bot Token: 8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40
  Chat ID: 1700128390
  Parse Mode: HTML
  Message: {{formatted_text van Action 1}}

ACTION 3: HubSpot — Update Deal
  Property: hs_next_activity_date = NOW
  Property: nurture_fase = "actief"
```

**Bouwbaar NU:** Ja, alle componenten beschikbaar.

### 1B. Automatische Bevestigings-WhatsApp aan Klant

**Tool:** Zapier (nieuw: ZAP-13)

```
ZAP-13: Speed-to-Lead WhatsApp Bevestiging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — New Deal
  Filter: Pipeline ID = 3623322812
  Filter: Deal Stage = "Nieuwe Lead" (4998659267)
  Filter: Contact phone is niet leeg

ACTION 1: Delay — 30 seconden
  (Voorkomt dat WhatsApp eerder aankomt dan Telegram notificatie)

ACTION 2: Trengo — Send WhatsApp Template Message
  Channel: [TRENGO WHATSAPP CHANNEL ID — INPUT NODIG VAN DAIMY]
  Recipient: {{contact_phone}}
  Template naam: "lead_bevestiging"
  Template variabelen:
    {{1}} = {{contact_firstname}}

  Template tekst (moet in Trengo aangemaakt worden):
  ──────────────────────
  Hoi {{1}}! Bedankt voor je aanvraag bij Sonty.
  We bellen je zo snel mogelijk — meestal binnen een paar minuten.
  Mocht je ons willen bereiken: bel 085 006 9681 of antwoord hier!
  ──────────────────────

ACTION 3: HubSpot — Create Note
  Body: "Auto-WhatsApp bevestiging verstuurd"
  Associated deal: {{deal_id}}
```

**Bouwbaar NU:** Gedeeltelijk.
- Nodig van Daimy: Trengo WhatsApp Channel ID
- Nodig: WhatsApp template "lead_bevestiging" aanmaken en goedkeuren in Trengo (Meta-goedkeuring duurt 24-48 uur)

### 1C. HubSpot Workflow — Interne Taak Aanmaken

**Tool:** HubSpot Workflow (update van WF-01, ID: 3911097543)

```
WF-01 (UPDATED): Speed-to-Lead + Eerste Belpoging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Deal stage = "Nieuwe Lead" (4998659267)
  AND pipeline = 3623322812

ACTIE 1: (Onmiddellijk)
  Create Task
    Titel: "🔴 BEL DIRECT — {{contact_firstname}} {{contact_lastname}}"
    Type: Call
    Priority: High
    Due date: NOW
    Queue: Sales
    Body: "Nieuwe lead via Reuzenpanda. Product: {{product_categorie}}. BEL BINNEN 5 MINUTEN."
    Owner: Deal eigenaar

ACTIE 2: (Onmiddellijk)
  Set property: aantal_belpogingen = 0
  Set property: nurture_fase = "actief"

ACTIE 3: (Onmiddellijk)
  Move deal to stage: "Belpoging 1" (4999295181)
```

**Bouwbaar NU:** Ja.

---

## 2. Belpoging Cadans (6 pogingen)

**Doel:** 6 belpogingen met optimaal tijdschema, automatisch taak aanmaken per poging, en na poging 6 zonder contact automatisch naar nurture.

### HubSpot Workflow: Belpoging Cadans

**Tool:** HubSpot Workflow (nieuw: WF-05)

```
WF-05: Belpoging Cadans (6 pogingen)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Deal stage = "Belpoging 1" (4999295181)
  AND pipeline = 3623322812
  AND nurture_fase = "actief"

RE-ENROLLMENT: Niet toestaan

━━━ POGING 1 ━━━━━━━━━━━━━━━━━━━━━━

ACTIE 1: (Onmiddellijk — taak is al aangemaakt door WF-01)
  Set property: aantal_belpogingen = 1
  Set property: laatste_belpoging_datum = NOW

ACTIE 2: Wacht 3 uur

━━━ POGING 2 ━━━━━━━━━━━━━━━━━━━━━━

ACTIE 3: IF/THEN Branch
  IF deal stage = "In Contact" (4999295185) OF later → STOP (klant bereikt)
  IF deal stage = "Verloren" (4999295195) → STOP

ACTIE 4: Create Task
  Titel: "Belpoging 2 — {{contact_firstname}} {{contact_lastname}}"
  Type: Call
  Priority: High
  Due date: NOW
  Body: "2e poging. Probeer een ander tijdstip dan de eerste keer."
  Owner: Deal eigenaar

ACTIE 5: Set property: aantal_belpogingen = 2
         Set property: laatste_belpoging_datum = NOW
         Move deal to stage: "Belpoging 2" (4999295182)

ACTIE 6: Wacht tot volgende werkdag 08:30

━━━ POGING 3 ━━━━━━━━━━━━━━━━━━━━━━

ACTIE 7: IF/THEN Branch (zelfde check als Actie 3)

ACTIE 8: Create Task
  Titel: "Belpoging 3 — {{contact_firstname}} (ochtend)"
  Type: Call
  Priority: High
  Due date: NOW
  Body: "3e poging. Ochtend = hoogste bereikbaarheid (28-32% connection rate)."
  Owner: Deal eigenaar

ACTIE 9: Set property: aantal_belpogingen = 3
         Set property: laatste_belpoging_datum = NOW

ACTIE 10: Wacht 2 dagen tot 16:00

━━━ POGING 4 ━━━━━━━━━━━━━━━━━━━━━━

ACTIE 11: IF/THEN Branch (zelfde check)

ACTIE 12: Create Task
  Titel: "Belpoging 4 — {{contact_firstname}} (late middag)"
  Type: Call
  Priority: Medium
  Due date: NOW
  Body: "4e poging. Late middag = hoge conversie. Dag 3 sinds lead."
  Owner: Deal eigenaar

ACTIE 13: Set property: aantal_belpogingen = 4
          Set property: laatste_belpoging_datum = NOW

ACTIE 14: Wacht 2 dagen tot 10:00

━━━ POGING 5 ━━━━━━━━━━━━━━━━━━━━━━

ACTIE 15: IF/THEN Branch (zelfde check)

ACTIE 16: Create Task
  Titel: "Belpoging 5 — {{contact_firstname}} (dag 5)"
  Type: Call
  Priority: Medium
  Due date: NOW
  Body: "5e poging. Nog 1 poging na deze. Probeer eventueel SMS/voicemail."
  Owner: Deal eigenaar

ACTIE 17: Set property: aantal_belpogingen = 5
          Set property: laatste_belpoging_datum = NOW

ACTIE 18: Wacht 2 dagen tot 16:00

━━━ POGING 6 (LAATSTE) ━━━━━━━━━━━━

ACTIE 19: IF/THEN Branch (zelfde check)

ACTIE 20: Create Task
  Titel: "⚠️ LAATSTE Belpoging 6 — {{contact_firstname}}"
  Type: Call
  Priority: High
  Due date: NOW
  Body: "LAATSTE poging. Als geen gehoor: deal gaat automatisch naar nurture sequence."
  Owner: Deal eigenaar

ACTIE 21: Set property: aantal_belpogingen = 6
          Set property: laatste_belpoging_datum = NOW

ACTIE 22: Wacht 24 uur

━━━ GEEN CONTACT NA 6 POGINGEN ━━━━

ACTIE 23: IF/THEN Branch
  IF deal stage is NOG STEEDS "Belpoging 1" OF "Belpoging 2" (niet "In Contact" of later):

  ACTIE 24: Set property: nurture_fase = "nurture"
  ACTIE 25: Move deal to stage: "WhatsApp Verstuurd" (4999295184)
    (Tussenliggende stage voordat ze in nurture gaan)

  ACTIE 26: Create Note
    Body: "Na 6 belpogingen geen contact. Deal verplaatst naar nurture sequence."
```

### WhatsApp na Mislukte Belpogingen

**Tool:** Zapier (update ZAP-02, ID: 353373774)

Na elke belpoging zonder contact wordt een contextspecifiek WhatsApp gestuurd:

```
ZAP-02 (UPDATED): WhatsApp na Belpoging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — Deal property change
  Property: aantal_belpogingen (changed)
  Filter: nurture_fase = "actief"
  Filter: deal stage is NOT "In Contact" of later

ACTION 1: Paths (Zapier branching)

  PATH A: aantal_belpogingen = 1
    Trengo — Send WhatsApp Template: "na_belpoging_1"
    ──────────────────────
    Hoi {{voornaam}}, je spreekt met het team van Sonty!
    We probeerden je net te bellen over je aanvraag voor {{product}}.
    Wanneer komt het je het beste uit om even te bellen?
    Je kunt ook gewoon hier antwoorden!
    ──────────────────────

  PATH B: aantal_belpogingen = 3
    Trengo — Send WhatsApp Template: "na_belpoging_3_social_proof"
    ──────────────────────
    Hoi {{voornaam}}, we hebben je nu een paar keer proberen te bereiken
    over je {{product}} aanvraag.
    Wist je dat we vorige maand meer dan 50 installaties hebben gedaan?
    Onze klanten geven ons een 4.9 op Google (500+ reviews)!
    Zullen we een gratis inmeetafspraak voor je inplannen?
    ──────────────────────

  PATH C: aantal_belpogingen = 6
    Trengo — Send WhatsApp Template: "laatste_poging"
    ──────────────────────
    Hoi {{voornaam}}, we hebben je een paar keer proberen te bereiken
    over je {{product}} aanvraag. We snappen dat het druk is!
    Mocht je in de toekomst nog interesse hebben, je kunt ons altijd
    bereiken via dit nummer. Fijne dag!
    ──────────────────────

ACTION 2: HubSpot — Create Note
  Body: "WhatsApp verstuurd na belpoging {{aantal_belpogingen}}"
```

**Bouwbaar NU:** Gedeeltelijk.
- Nodig van Daimy: Trengo WhatsApp Channel ID
- Nodig: 3 WhatsApp templates aanmaken en laten goedkeuren in Trengo

### Timing Schema Samenvatting

| Poging | Timing | Dag/Tijd | WhatsApp erbij? |
|--------|--------|----------|-----------------|
| 1 | Onmiddellijk na lead | Direct | Ja (bevestiging) |
| 2 | +3 uur | Zelfde dag, ander tijdblok | Nee |
| 3 | Volgende werkdag | 08:30 (ochtend) | Ja (social proof) |
| 4 | Dag 3 | 16:00 (late middag) | Nee |
| 5 | Dag 5 | 10:00 (ochtend) | Nee |
| 6 | Dag 7 | 16:00 (laatste poging) | Ja (friendly close) |

---

## 3. Post-Offerte Follow-up Sequence

**Doel:** Na het versturen van de definitieve offerte een 14-daagse multi-channel follow-up om de deal te sluiten.

### HubSpot Workflow: Post-Offerte Follow-up

**Tool:** HubSpot Workflow (nieuw: WF-06) + Zapier voor WhatsApp stappen

```
WF-06: Post-Offerte Follow-up Sequence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Deal stage = "Definitieve Offerte Verstuurd" (4999295188)
  AND pipeline = 3623322812

RE-ENROLLMENT: Niet toestaan

━━━ DAG 0 — OFFERTE VERSTUURD ━━━━━

ACTIE 1: (Onmiddellijk)
  Set property: offerte_verstuurd_datum = NOW

ACTIE 2: (Onmiddellijk)
  Send Email (HubSpot)
    Template: "offerte_verstuurd"
    Onderwerp: "{{contact_firstname}}, je offerte voor {{product_categorie}} staat klaar"
    Inhoud:
    ──────────────────────
    Hoi {{contact_firstname}},

    Hierbij je definitieve offerte voor {{product_categorie}}.

    Wat je krijgt:
    - {{product beschrijving uit offerte}}
    - Professionele installatie door ons eigen team
    - {{garantie_jaren}} jaar garantie op product en installatie

    Waarom klanten voor Sonty kiezen:
    ✓ Sunmaster Premium Dealer
    ✓ 4.9/5.0 beoordeling (500+ Google reviews)
    ✓ Eigen gecertificeerde monteurs
    ✓ Persoonlijke nazorg en service

    Heb je vragen? Bel, mail, of stuur een WhatsApp!

    Groetjes,
    Team Sonty
    ──────────────────────

  ⚠️ Opmerking: de daadwerkelijke offerte komt uit Gripp (ZAP-05).
  Deze email is de BEGELEIDENDE boodschap.
```

### Zapier: WhatsApp "Offerte Staat Klaar"

```
ZAP-14: Post-Offerte WhatsApp Dag 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — Deal enters stage "Definitieve Offerte Verstuurd" (4999295188)

ACTION 1: Delay — 5 minuten
  (Geeft de offerte-email tijd om aan te komen)

ACTION 2: Trengo — Send WhatsApp Template: "offerte_klaar"
  ──────────────────────
  Hoi {{voornaam}}! We hebben je zojuist de definitieve offerte gestuurd
  voor je {{product}}.
  Heb je vragen? Stuur ze gerust via WhatsApp, dan helpen we je
  direct verder.
  Groetjes, Team Sonty
  ──────────────────────

ACTION 3: HubSpot — Create Note
  Body: "WhatsApp 'offerte klaar' verstuurd"
```

### Dag 2: WhatsApp Follow-up

```
ZAP-15: Post-Offerte WhatsApp Dag 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — Deal enters stage "Definitieve Offerte Verstuurd" (4999295188)

ACTION 1: Delay — 2 dagen

ACTION 2: Filter
  Alleen doorgaan als deal stage NOG STEEDS "Definitieve Offerte Verstuurd" is
  (als klant al heeft gereageerd/akkoord → skip)

ACTION 3: Trengo — Send WhatsApp Template: "offerte_followup_dag2"
  ──────────────────────
  Hoi {{voornaam}}, heb je de offerte kunnen bekijken?
  Ik help graag met eventuele vragen. Je kunt gewoon hier antwoorden
  of ons bellen op 085 006 9681.
  ──────────────────────

ACTION 4: HubSpot — Create Note
  Body: "WhatsApp offerte follow-up dag 2 verstuurd"
```

### Dag 5: Email met Social Proof

```
WF-06 vervolg — Dag 5
━━━━━━━━━━━━━━━━━━━━━

ACTIE 3: Wacht 5 dagen (vanaf enrollment)

ACTIE 4: IF/THEN Branch
  IF deal stage = "Offerte Akkoord" (4999295189) of later → STOP
  IF deal stage = "Verloren" (4999295195) → STOP

ACTIE 5: Send Email (HubSpot)
  Template: "offerte_social_proof_dag5"
  Onderwerp: "Benieuwd hoe het eruitziet? Bekijk dit project in {{contact_city}}"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  We wilden je even inspireren! Hieronder een recent project
  vergelijkbaar met jouw aanvraag:

  [FOTO: Recent {{product_categorie}} project]

  "Heel blij met onze nieuwe {{product}}. Goede service en
  professionele installatie!" — Klant in {{regio}}

  Vragen over je offerte? We staan voor je klaar.

  💡 Tip: Kom gerust langs in onze showroom in Rijswijk
  (Frijdastraat 8F) om de materialen in het echt te zien en te voelen.
  Zo weet je zeker dat je de juiste keuze maakt!

  Groetjes, Team Sonty

  PS: Onze huidige levertijd voor {{product_categorie}} is
  [X] weken. Bestel op tijd voor het zonseizoen!
  ──────────────────────

  ⚠️ SHOWROOM NOTE: Klanten die de showroom bezoeken converteren
  bijna 10x vaker. Deze email is een ideaal moment om twijfelaars
  naar de showroom te trekken.
```

### Dag 7: Beltaak

```
WF-06 vervolg — Dag 7
━━━━━━━━━━━━━━━━━━━━━

ACTIE 6: Wacht tot dag 7

ACTIE 7: IF/THEN Branch (zelfde check als Actie 4)

ACTIE 8: Create Task
  Titel: "Bel over offerte — {{contact_firstname}} {{contact_lastname}}"
  Type: Call
  Priority: Medium
  Due date: NOW
  Body: "Offerte verstuurd op {{offerte_verstuurd_datum}}. 7 dagen geleden.
         Vraag: 'Hoe gaat het met je beslissing? Kan ik ergens bij helpen?'
         TIP: Wees een adviseur, niet een verkoper."
  Owner: Deal eigenaar
```

### Dag 10: WhatsApp Herinnering

```
ZAP-16: Post-Offerte WhatsApp Dag 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — Deal enters stage "Definitieve Offerte Verstuurd"

ACTION 1: Delay — 10 dagen

ACTION 2: Filter
  Deal stage = STILL "Definitieve Offerte Verstuurd"

ACTION 3: Trengo — Send WhatsApp Template: "offerte_herinnering_dag10"
  ──────────────────────
  Hoi {{voornaam}}, even een herinnering over je offerte voor {{product}}.
  De offerte is nog geldig en onze agenda voor installaties raakt
  langzaam vol. Zullen we even bellen om je vragen door te nemen?
  ──────────────────────

ACTION 4: HubSpot — Create Note
```

### Dag 14: Laatste WhatsApp

```
ZAP-17: Post-Offerte Laatste WhatsApp Dag 14
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — Deal enters stage "Definitieve Offerte Verstuurd"

ACTION 1: Delay — 14 dagen

ACTION 2: Filter
  Deal stage = STILL "Definitieve Offerte Verstuurd"

ACTION 3: Trengo — Send WhatsApp Template: "offerte_laatste_dag14"
  ──────────────────────
  Hoi {{voornaam}}, we houden je plek in onze agenda vrij,
  maar we willen je niet onder druk zetten.
  Als je nog vragen hebt of als de timing niet uitkomt,
  laat het ons gerust weten. We staan voor je klaar!
  ──────────────────────

ACTION 4: HubSpot — Create Note

ACTION 5: HubSpot — Create Task
  Titel: "Beslissing: offerte akkoord of nurture? — {{contact_firstname}}"
  Body: "14 dagen na offerte. Geen reactie. Overweeg: deal naar nurture of verloren."
  Owner: Deal eigenaar
```

### Post-Offerte Overzicht

| Dag | Kanaal | Actie | Tool |
|-----|--------|-------|------|
| 0 | Email + WhatsApp | Offerte + "offerte staat klaar" | HubSpot (WF-06) + Zapier (ZAP-14) |
| 2 | WhatsApp | Follow-up "heb je het bekeken?" | Zapier (ZAP-15) |
| 5 | Email | Social proof / case study | HubSpot (WF-06) |
| 7 | Telefoon | Beltaak sales | HubSpot (WF-06) |
| 10 | WhatsApp | Herinnering + urgentie | Zapier (ZAP-16) |
| 14 | WhatsApp | Laatste bericht + beslissingstaak | Zapier (ZAP-17) |

**Bouwbaar NU:** HubSpot workflow-deel (emails + taken) volledig. WhatsApp-deel vereist Trengo Channel ID + template-goedkeuring.

---

## 4. Nurture Sequence (niet-reageerders)

**Doel:** Leads die na 6 belpogingen en/of na 14 dagen offerte niet reageren, warm houden gedurende 120 dagen.

### HubSpot Workflow: Nurture Sequence

**Tool:** HubSpot Workflow (nieuw: WF-07)

```
WF-07: Long-Term Nurture Sequence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Deal property nurture_fase = "nurture"
  AND pipeline = 3623322812

RE-ENROLLMENT: Niet toestaan

EXIT CRITERIA:
  - Deal stage verandert naar "In Contact" (4999295185) of later
  - Deal stage = "Verloren" (4999295195)
  - Contact reageert op email (opens + clicks → re-engagement, zie below)

━━━ DAG 14 — "We staan klaar" email ━━━━━

ACTIE 1: Wacht 14 dagen (vanaf nurture enrollment)

ACTIE 2: Send Email (HubSpot)
  Template: "nurture_dag14_we_staan_klaar"
  Onderwerp: "{{contact_firstname}}, we denken aan je"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  Een tijdje geleden heb je een aanvraag gedaan voor {{product_categorie}}.
  We begrijpen dat zoiets tijd nodig heeft.

  We wilden je even laten weten dat we nog steeds voor je klaar staan.
  Mocht je vragen hebben of alsnog een afspraak willen maken,
  dan helpen we je graag.

  💡 Wist je dat je ook vrijblijvend langs kunt komen in onze showroom
  in Rijswijk? Bekijk en voel de materialen in het echt — geen
  verplichting, gewoon even kijken.
  📍 Frijdastraat 8F, 2288 EX Rijswijk

  Bekijk onze recente projecten: [link naar portfolio]

  Groetjes,
  Team Sonty

  ─────────────────
  Beoordeeld met 4.9/5.0 door 500+ klanten op Google
  ──────────────────────

━━━ DAG 30 — Seizoenstip email ━━━━━

ACTIE 3: Wacht tot dag 30

ACTIE 4: IF/THEN Branch (exit check)

ACTIE 5: Send Email (HubSpot)
  Template: "nurture_dag30_seizoenstip"
  Onderwerp: "Zonweringstip voor dit seizoen"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  [SEIZOENSGEBONDEN CONTENT — dynamisch op basis van maand:]

  Maart-Mei:
    "De zon begint kracht te krijgen! Wist je dat screens tot 90%
    van de warmte tegenhouden? Bestel nu en geniet deze zomer."

  Juni-Augustus:
    "Warmterecord? Met de juiste zonwering is je huis tot 10 graden
    koeler — zonder airco."

  September-November:
    "De herfst is het perfecte moment om rolluiken of screens te
    laten plaatsen. Rustigere agenda = snellere installatie."

  December-Februari:
    "Nieuw jaar, nieuwe plannen? Begin het jaar met een gratis
    adviesgesprek over zonwering."

  [PRODUCTSPECIFIEK advies op basis van {{product_categorie}}]

  Interesse? Antwoord op deze email of bel 085 006 9681.

  Groetjes, Team Sonty
  ──────────────────────

━━━ DAG 60 — Social proof email ━━━━

ACTIE 6: Wacht tot dag 60

ACTIE 7: IF/THEN Branch (exit check)

ACTIE 8: Send Email (HubSpot)
  Template: "nurture_dag60_social_proof"
  Onderwerp: "Zo ziet een {{product_categorie}} installatie eruit bij onze klanten"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  We wilden je even inspireren met een recent project:

  [FOTO: voor/na van een {{product_categorie}} installatie]

  "We twijfelden eerst, maar zijn nu zo blij dat we het hebben laten doen.
  Het huis is veel koeler en het ziet er fantastisch uit!"
  — Familie [Naam], [Plaats]

  Beoordeeld met 4.9 op Google door 500+ klanten.

  Wil je ook zo genieten? Plan een gratis opmeting:
  [CTA knop: Plan je afspraak]

  Groetjes, Team Sonty
  ──────────────────────

━━━ DAG 90 — "Nog steeds interesse?" email ━━━

ACTIE 9: Wacht tot dag 90

ACTIE 10: IF/THEN Branch (exit check)

ACTIE 11: Send Email (HubSpot)
  Template: "nurture_dag90_interesse"
  Onderwerp: "{{contact_firstname}}, nog steeds interesse in {{product_categorie}}?"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  Een paar maanden geleden heb je je verdiept in {{product_categorie}}.
  We vroegen ons af of je nog interesse hebt.

  Wat er misschien veranderd is:
  - Nieuwe modellen beschikbaar
  - Actuele levertijden: [X] weken
  - Seizoensactie: [indien van toepassing]

  Antwoord op deze email of plan direct een afspraak:
  [CTA knop]

  Groetjes, Team Sonty
  ──────────────────────

━━━ DAG 120 — Laatste poging ━━━━━━━

ACTIE 12: Wacht tot dag 120

ACTIE 13: IF/THEN Branch (exit check)

ACTIE 14: Send Email (HubSpot)
  Template: "nurture_dag120_laatste"
  Onderwerp: "Laatste berichtje van ons, {{contact_firstname}}"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  Dit is ons laatste berichtje over je {{product_categorie}} aanvraag.
  We willen je niet lastigvallen, maar de deur staat altijd open.

  Mocht je in de toekomst nog interesse hebben:
  - Bel: 085 006 9681
  - WhatsApp: dit nummer
  - Email: info@sonty.nl

  We wensen je een fijne dag!

  Groetjes, Team Sonty
  ──────────────────────

ACTIE 15: Set property: nurture_fase = "verloren"

ACTIE 16: Create Note
  Body: "Nurture sequence voltooid (120 dagen). Geen reactie. Deal als slapend gemarkeerd."
```

### Re-engagement Trigger

**Tool:** HubSpot Workflow (nieuw: WF-08)

```
WF-08: Nurture Re-engagement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Contact: Marketing email opened = true (in afgelopen 24 uur)
  AND deal property nurture_fase = "nurture"

ACTIE 1: Telegram Notificatie (via Zapier webhook)
  ──────────────────────
  🔔 LEAD TERUG! {{contact_firstname}} {{contact_lastname}}
  heeft een nurture email geopend.
  Product: {{product_categorie}}
  Oorspronkelijke lead: {{deal_create_date}}

  ➡️ Bel deze lead z.s.m.!
  ──────────────────────

ACTIE 2: Create Task
  Titel: "🟡 Nurture lead reageert — Bel! {{contact_firstname}}"
  Priority: High
  Due date: NOW
  Owner: Deal eigenaar

ACTIE 3: Set property: nurture_fase = "actief"
ACTIE 4: Move deal to stage: "In Contact" (4999295185)
```

**Bouwbaar NU:** Ja, volledig in HubSpot + 1 Zapier zap voor Telegram notificatie.

---

## 5. Review Automatisering

**Doel:** 3 dagen na installatie automatisch review vragen via WhatsApp, met email backup na 7 dagen.

### HubSpot Workflow: Review Sequence

**Tool:** HubSpot Workflow (nieuw: WF-09) + Zapier voor WhatsApp

```
WF-09: Review Automatisering
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Deal stage = "Installatie Afgerond" (4999295193)
  AND pipeline = 3623322812
  AND review_verstuurd = false (of niet ingesteld)

RE-ENROLLMENT: Niet toestaan
```

### Stap 1: WhatsApp Review Request (Dag 3)

```
ZAP-18: Review WhatsApp Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: HubSpot — Deal enters stage "Installatie Afgerond" (4999295193)

ACTION 1: Delay — 3 dagen

ACTION 2: Filter
  Deal is NIET in stage "Verloren"

ACTION 3: Trengo — Send WhatsApp Template: "review_request"
  ──────────────────────
  Hoi {{voornaam}}! Hoe bevalt je nieuwe {{product}}?

  We hopen dat je er blij mee bent! Zou je ons willen helpen
  door een korte review achter te laten? Het kost maar 1 minuutje
  en helpt ons enorm:

  {{google_review_link}}

  We worden nu beoordeeld met een 4.9 door 500+ klanten
  en daar zijn we best trots op!

  Alvast bedankt!
  Team Sonty
  ──────────────────────

ACTION 4: HubSpot — Update Deal
  Property: review_verstuurd = true

ACTION 5: HubSpot — Create Note
  Body: "WhatsApp reviewverzoek verstuurd"
```

### Stap 2: Email Review Backup (Dag 10, als geen review)

```
WF-09 vervolg:

ACTIE 1: Wacht 10 dagen (na installatie)

ACTIE 2: IF/THEN Branch
  IF review al ontvangen (handmatig te checken) → Send bedank-WhatsApp
  ELSE → Send email review request

ACTIE 3 (geen review): Send Email (HubSpot)
  Template: "review_request_email"
  Onderwerp: "{{contact_firstname}}, hoe bevalt je nieuwe {{product_categorie}}?"
  Inhoud:
  ──────────────────────
  Hoi {{contact_firstname}},

  Een paar dagen geleden hebben we je {{product_categorie}} geinstalleerd.
  We hopen dat je er elke dag van geniet!

  Zou je 1 minuutje willen nemen om je ervaring te delen?
  Dit helpt andere mensen bij hun keuze.

  [GROTE CTA KNOP: Laat je review achter]
  {{google_review_link}}

  Alvast bedankt!
  Team Sonty

  PS: Is er iets niet naar wens? Laat het ons weten via
  085 006 9681 — we lossen het graag voor je op.
  ──────────────────────
```

### Stap 3: Bedank-WhatsApp (bij ontvangen review)

```
ZAP-19: Review Bedank WhatsApp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: Handmatig / HubSpot property change (review_ontvangen = true)

ACTION 1: Trengo — Send WhatsApp Template: "review_bedankt"
  ──────────────────────
  {{voornaam}}, super bedankt voor je review!
  Fijn om te horen dat je tevreden bent.
  Mocht je in de toekomst ooit iets nodig hebben
  (onderhoud, uitbreiding, of advies), je weet ons te vinden!
  ──────────────────────
```

### Review Automatisering Overzicht

| Dag | Actie | Kanaal | Tool |
|-----|-------|--------|------|
| 0 | Installatie afgerond | - | Planado webhook → HubSpot (ZAP-09) |
| 3 | Review request | WhatsApp | Zapier (ZAP-18) + Trengo |
| 10 | Review reminder (als geen review) | Email | HubSpot (WF-09) |
| Bij review | Bedank-bericht | WhatsApp | Zapier (ZAP-19) + Trengo |

**Bouwbaar NU:** HubSpot email-deel volledig. WhatsApp-deel vereist Trengo Channel ID + template-goedkeuring + Google Review link.

**Input nodig van Daimy:**
- Google Review link (directe link naar review-formulier)
- Trengo WhatsApp Channel ID

---

## 6. Lead Scoring Automatisering

**Doel:** Elke deal automatisch scoren op basis van engagement, response tijd, productcategorie en dealwaarde. Score bepaalt prioriteit en aanpak.

### Scoring Model

| Factor | Punten | Uitleg |
|--------|--------|--------|
| **Engagement** | | |
| Email geopend | +5 per email | Actieve interesse |
| Email link geklikt | +10 per klik | Sterke interesse |
| WhatsApp beantwoord | +15 | Directe reactie |
| Website bezocht (als trackbaar) | +5 | Passieve interesse |
| **Response tijd** | | |
| Reageert binnen 1 uur | +20 | Zeer warm |
| Reageert binnen 24 uur | +10 | Warm |
| Reageert binnen 3 dagen | +5 | Matig |
| Geen reactie na 7 dagen | -10 | Koud |
| **Productcategorie** | | |
| Premium (Knikarm, Pergola, Markies) | +15 | Hoger budget = serieuzer |
| Midden (Uitval, Raamdeco, Screens) | +10 | Standaard |
| Budget (Voorraadscherm) | +5 | Lager commitment |
| Reparatie | +10 | Direct nodig = warm |
| **Dealwaarde** | | |
| Deal > €5.000 | +15 | Groot project |
| Deal €2.000-€5.000 | +10 | Midden |
| Deal < €2.000 | +5 | Klein |
| **Negatieve signalen** | | |
| 3+ belpogingen zonder contact | -15 | Moeilijk bereikbaar |
| 6 belpogingen zonder contact | -25 | Waarschijnlijk niet geinteresseerd |
| Email unsubscribe | -50 | Geen interesse |

### Classificatie

| Score | Label | Aanpak |
|-------|-------|--------|
| > 70 | **Warm** (lead_kwaliteit = "warm") | Maximale aandacht, bel prioriteit, persoonlijke follow-up |
| 30-70 | **Koud** (lead_kwaliteit = "koud") | Standaard flow, automatische nurture |
| < 30 | **Budget** (lead_kwaliteit = "budget") | Minimale handmatige effort, volledig automatisch |

### HubSpot Workflow: Lead Scoring

**Tool:** HubSpot Workflow (nieuw: WF-10)

```
WF-10: Lead Score Berekening
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Contact: ANY activity (email open, form submit, page view)
  OF Deal property change (stage, amount, product_categorie)

RE-ENROLLMENT: Toestaan (herberekent bij elke activiteit)

⚠️ BELANGRIJK: HubSpot Free/Starter heeft beperkte scoring
mogelijkheden. Voor volledige lead scoring is HubSpot
Marketing Hub Professional ($800/maand) of Sales Hub Professional
($450/maand) nodig.

ALTERNATIEF VOOR HUIDIGE HUBSPOT PLAN:
Gebruik een vereenvoudigd model met calculated properties:
```

### Vereenvoudigd Scoring Model (zonder Marketing Hub Pro)

```
WF-10 (Vereenvoudigd): Lead Kwaliteit Toewijzing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENROLLMENT TRIGGER:
  Deal pipeline = 3623322812
  AND deal stage changes

FLOW:

  IF/THEN BRANCH 1: Productcategorie check
    IF product_categorie IN [Knikarmscherm, Pergola, Markiezen, Rolluiken]
    AND deal_amount > 3000
    → Set lead_kwaliteit = "warm" (+20 base)

  IF/THEN BRANCH 2: Response check
    IF deal stage bereikt "In Contact" (4999295185) binnen 24 uur
    → Set lead_kwaliteit = "warm"

  IF/THEN BRANCH 3: Geen contact check
    IF aantal_belpogingen >= 6
    AND deal stage is NIET "In Contact" of later
    → Set lead_kwaliteit = "budget"

  DEFAULT:
    → Set lead_kwaliteit = "koud"

  ACTIE: Telegram notificatie bij "warm" leads
    (via Zapier webhook → Telegram Bot)
    ──────────────────────
    ⭐ WARME LEAD: {{contact_firstname}} {{contact_lastname}}
    Product: {{product_categorie}}
    Bedrag: €{{deal_amount}}
    Reden: [automatisch bepaald]
    ──────────────────────
```

**Bouwbaar NU:** Ja, het vereenvoudigde model werkt met elk HubSpot plan.

**Voor volledig scoring model:** HubSpot Marketing/Sales Hub Professional nodig. Dit is een beslissing voor Daimy (kosten vs. waarde).

---

## 7. Overzicht: Wat Nu Bouwen vs. Input Nodig

### Direct Bouwbaar (geen input nodig)

| # | Wat | Tool | Geschatte bouwtijd |
|---|-----|------|--------------------|
| 1 | WF-01 update: Speed-to-lead taak | HubSpot | 15 min |
| 2 | ZAP-12: Telegram notificatie nieuwe lead | Zapier | 20 min |
| 3 | WF-05: Belpoging cadans (6 pogingen) | HubSpot | 45 min |
| 4 | WF-06: Post-offerte email + taken | HubSpot | 30 min |
| 5 | WF-07: Nurture email sequence | HubSpot | 45 min |
| 6 | WF-08: Re-engagement trigger | HubSpot | 15 min |
| 7 | WF-09: Review email backup | HubSpot | 15 min |
| 8 | WF-10: Lead kwaliteit toewijzing | HubSpot | 20 min |
| 9 | Custom properties aanmaken | HubSpot | 10 min |

**Totaal direct bouwbaar: ~3,5 uur**

### Input Nodig van Daimy

| # | Wat nodig | Waarvoor | Blokkert |
|---|-----------|----------|----------|
| 1 | **Trengo WhatsApp Channel ID** | Alle WhatsApp automations (ZAP-13, 14, 15, 16, 17, 18, 19) | 7 Zapier zaps |
| 2 | **Google Review link** | Review automatisering (ZAP-18, WF-09) | Review flow |
| 3 | **WhatsApp templates goedkeuring** | Alle templates moeten door Meta goedgekeurd worden in Trengo | Alle WhatsApp berichten |
| 4 | **Sonty telefoonnummer** (bevestiging) | In WhatsApp templates | Templates |
| 5 | **Keuze: HubSpot upgrade voor lead scoring?** | Volledig vs. vereenvoudigd scoring model | Lead scoring |
| 6 | **Case study foto's en teksten** | Nurture emails + post-offerte social proof | Email content |
| 7 | **Seizoensgebonden content per kwartaal** | Nurture dag 30 email | Email content |

### Nieuwe Zapier Zaps (totaaloverzicht)

| Zap | Naam | Status |
|-----|------|--------|
| ZAP-12 | Speed-to-Lead Telegram Notificatie | Bouwbaar nu |
| ZAP-13 | Speed-to-Lead WhatsApp Bevestiging | Wacht op Trengo Channel ID |
| ZAP-14 | Post-Offerte WhatsApp Dag 0 | Wacht op Trengo Channel ID |
| ZAP-15 | Post-Offerte WhatsApp Dag 2 | Wacht op Trengo Channel ID |
| ZAP-16 | Post-Offerte WhatsApp Dag 10 | Wacht op Trengo Channel ID |
| ZAP-17 | Post-Offerte WhatsApp Dag 14 | Wacht op Trengo Channel ID |
| ZAP-18 | Review WhatsApp Request | Wacht op Trengo Channel ID + Review link |
| ZAP-19 | Review Bedank WhatsApp | Wacht op Trengo Channel ID |

**Nieuw totaal: 19 Zapier zaps (11 bestaand + 8 nieuw)**

### Nieuwe HubSpot Workflows (totaaloverzicht)

| WF | Naam | Status |
|----|------|--------|
| WF-01 | Speed-to-Lead + Eerste Belpoging (UPDATE) | Bouwbaar nu |
| WF-05 | Belpoging Cadans (6 pogingen) | Bouwbaar nu |
| WF-06 | Post-Offerte Follow-up Sequence | Bouwbaar nu (emails + taken) |
| WF-07 | Long-Term Nurture Sequence | Bouwbaar nu |
| WF-08 | Nurture Re-engagement | Bouwbaar nu |
| WF-09 | Review Automatisering | Bouwbaar nu (email deel) |
| WF-10 | Lead Kwaliteit Toewijzing | Bouwbaar nu (vereenvoudigd) |

**Nieuw totaal: 10 HubSpot workflows (4 bestaand + 6 nieuw)**

### Trengo WhatsApp Templates (aan te maken)

| Template naam | Trigger | Goedkeuring nodig |
|---------------|---------|-------------------|
| `lead_bevestiging` | Nieuwe lead | Ja (Meta) |
| `na_belpoging_1` | Na 1e belpoging | Ja (Meta) |
| `na_belpoging_3_social_proof` | Na 3e belpoging | Ja (Meta) |
| `laatste_poging` | Na 6e belpoging | Ja (Meta) |
| `offerte_klaar` | Offerte verstuurd | Ja (Meta) |
| `offerte_followup_dag2` | 2 dagen na offerte | Ja (Meta) |
| `offerte_herinnering_dag10` | 10 dagen na offerte | Ja (Meta) |
| `offerte_laatste_dag14` | 14 dagen na offerte | Ja (Meta) |
| `review_request` | 3 dagen na installatie | Ja (Meta) |
| `review_bedankt` | Na ontvangst review | Ja (Meta) |

**Totaal: 10 WhatsApp templates** (moeten in Trengo aangemaakt en door Meta goedgekeurd worden, doorlooptijd 24-48 uur per template)

---

## Implementatie Volgorde

```
FASE 1 — Direct (dag 1-2)
  ✅ Custom properties aanmaken in HubSpot
  ✅ WF-01 updaten (speed-to-lead taak)
  ✅ ZAP-12 bouwen (Telegram notificatie)
  ✅ WF-05 bouwen (belpoging cadans)
  ✅ WF-10 bouwen (lead kwaliteit)

FASE 2 — Na Trengo Channel ID (dag 3-5)
  ⏳ WhatsApp templates aanmaken in Trengo (10 stuks)
  ⏳ Templates laten goedkeuren door Meta
  ⏳ ZAP-13 bouwen (speed-to-lead WhatsApp)
  ⏳ ZAP-02 updaten (WhatsApp na belpogingen)

FASE 3 — Post-offerte flow (dag 5-7)
  ⏳ WF-06 bouwen (post-offerte emails + taken)
  ⏳ ZAP-14 t/m ZAP-17 bouwen (post-offerte WhatsApp)
  ⏳ Email templates ontwerpen in HubSpot

FASE 4 — Nurture + Review (dag 7-10)
  ⏳ WF-07 bouwen (nurture sequence)
  ⏳ WF-08 bouwen (re-engagement)
  ⏳ WF-09 bouwen (review emails)
  ⏳ ZAP-18 + ZAP-19 bouwen (review WhatsApp)

FASE 5 — Testen (dag 10-14)
  🧪 Test met synthetische lead door hele pipeline
  🧪 Timing van alle delays verifiëren
  🧪 WhatsApp templates controleren op variabelen
  🧪 Telegram notificaties testen
  🧪 Edge cases: wat als deal handmatig verplaatst wordt?
```

---

## Zapier Task Budget Check

Huidig verbruik: ~858 tasks/maand van 10.000 limiet.

Geschatte extra tasks per lead door nieuwe zaps:
- ZAP-12: 1 task (Telegram)
- ZAP-13: 2 tasks (delay + WhatsApp)
- ZAP-02 update: 2 tasks per WhatsApp (3 berichten = 6 tasks max)
- ZAP-14 t/m 17: 3 tasks per zap x 4 = 12 tasks max
- ZAP-18: 3 tasks (delay + WhatsApp + note)
- ZAP-19: 2 tasks

**Worst case per lead: ~25 extra Zapier tasks**

Bij 100 leads/maand: 2.500 extra tasks → totaal ~3.358/maand.
Ruim binnen de 10.000 limiet van het Professional plan.
