# Sonty Migratie Game Plan — Van A tot Z

> Doel: Volledig werkend automatiseringssysteem
> Datum: 18 mei 2026

---

## Wat al WERKT ✅

| # | Onderdeel | Status |
|---|-----------|--------|
| 1 | HubSpot CRM + pipeline (19 stages, 903+ deals) | ✅ Live |
| 2 | ZAP-01: Reuzenpanda → HubSpot (leads auto-import) | ✅ Live |
| 3 | RP→HubSpot offerte sync (elke 15 min) | ✅ Live |
| 4 | Trengo WhatsApp (gedeelde inbox, alle medewerkers) | ✅ Live |
| 5 | Trengo teams + rollen (Klantenservice team) | ✅ Live |
| 6 | Planado (10 medewerkers, individuele planning) | ✅ Live |
| 7 | Planado sjablonen (8 afspraaktypes) | ✅ Live |
| 8 | Telegram bot (communicatie Claude ↔ Daimy) | ✅ Live |
| 9 | Google/Meta/Pinterest Ads → Reuzenpanda | ✅ Live |
| 10 | HubSpot custom properties (RP, inkoop, referral) | ✅ Live |

---

## Fase 1 — Basis werkend (week 1-2)
*Focus: de dagelijkse dingen die nu handmatig gaan*

### 1.1 Fireflies.ai opzetten
- [ ] Account aanmaken (fireflies.ai)
- [ ] HubSpot koppeling activeren
- [ ] Alle sales mensen uitnodigen
- [ ] Test-call doen en checken of transcript + highlights in HubSpot komen
- **Wie**: Daimy (10 min)
- **Effect**: Elk telefoongesprek wordt automatisch getranscribeerd en samengevat in HubSpot

### 1.2 HubSpot automation scope
- [ ] Ga naar HubSpot → Settings → Integrations → Private Apps → "Sonty Automation"
- [ ] Voeg `automation` scope toe
- [ ] Opslaan
- **Wie**: Daimy (2 min)
- **Effect**: Dan kan Claude WF-01 t/m WF-04 bouwen (belpogingen, escalatie)

### 1.3 Trengo email kanalen
- [ ] M365 admin consent geven voor Trengo (eenmalig)
- [ ] 5 mailboxen koppelen: aanvragen@, facturen@, orders@, scans@, werkbon@
- **Wie**: Daimy (admin consent) + Claude (koppelen)
- **Effect**: Alle email in Trengo, niet meer los in Outlook

### 1.4 Planado API key vernieuwen
- [ ] Planado → Instellingen → Integraties → API → Nieuwe key genereren
- [ ] Key delen met Claude
- **Wie**: Daimy (1 min)
- **Effect**: Automatische koppeling Planado ↔ Zapier/HubSpot werkt weer

### 1.5 Planado veld "Vervolg van opdracht #"
- [ ] Per sjabloon: + Opdrachtveld toevoegen → Tekst → "Vervolg van opdracht #"
- [ ] 8 sjablonen (1 min per stuk)
- **Wie**: Daimy of Nanny (8 min)

---

## Fase 2 — Zapier zaps bouwen (week 2-3)
*Focus: automatische doorstroom van de pipeline*

### 2.1 Zapier toegang regelen
- [ ] Optie A: Daimy logt handmatig in op Zapier en bouwt zaps via instructiedoc
- [ ] Optie B: Daimy geeft Claude Zapier sessie-toegang (via cookie/token)
- **Wie**: Daimy
- **Blocker**: CAPTCHA blokkeert headless login

### 2.2 ZAP-02: WhatsApp follow-up
- Trigger: HubSpot deal stage = "Prijsindicatie Verstuurd"
- Action: Trengo WhatsApp sturen met template
- **Effect**: Automatische WhatsApp na prijsindicatie

### 2.3 ZAP-03: Inmeting inplannen
- Trigger: HubSpot deal stage = "Opmeting Ingepland"
- Action: Planado job aanmaken (type: Inmeet afspraak)
- **Effect**: Inmeting automatisch in Planado

### 2.4 ZAP-04: Inmeting afgerond
- Trigger: Planado webhook (job_finished, type: Inmeet)
- Action: HubSpot deal stage → "Opmeting Afgerond"
- **Effect**: Pipeline update automatisch na inmeting

### 2.5 ZAP-05: Offerte naar Gripp
- Trigger: HubSpot deal stage = "Definitieve Offerte"
- Action: Gripp offerte aanmaken
- **Blocker**: Gripp API Request Pack nodig

### 2.6 ZAP-06: Aanbetaling factuur
- Trigger: HubSpot deal stage = "Aanbetaling Verstuurd"
- Action: Gripp factuur aanmaken
- **Blocker**: Gripp API

### 2.7 ZAP-07: Orderbevestiging
- Trigger: Email naar orders@sonty.nl (via Trengo/Outlook)
- Action: HubSpot deal stage → "Orderbevestiging Ontvangen"
- **Effect**: Leveranciersbevestiging triggert pipeline update

### 2.8 ZAP-08: Montage inplannen
- Trigger: HubSpot deal stage = "Installatie Ingepland"
- Action: Planado job aanmaken (type: Montage)
- **Effect**: Montage automatisch in Planado

### 2.9 ZAP-09: Montage afgerond
- Trigger: Planado webhook (job_finished, type: Montage)
- Action: HubSpot deal stage → "Installatie Afgerond"

### 2.10 ZAP-10: Eindfactuur
- Trigger: HubSpot deal stage = "Eindfactuur"
- Action: Gripp factuur aanmaken
- **Blocker**: Gripp API

### 2.11 ZAP-11: Review verzoek
- Trigger: HubSpot deal stage = "Afgerond"
- Action: Trengo WhatsApp review-verzoek
- **Effect**: Automatische Google review vraag na afronding

---

## Fase 3 — HubSpot Workflows (week 3-4)
*Focus: interne automatisering binnen HubSpot*

### 3.1 WF-01: Belpogingen
- Trigger: Nieuwe lead
- 6 belpogingen over 5 dagen met tasks
- **Vereist**: automation scope (#1.2)

### 3.2 WF-02: Escalatie naar eigenaar
- Trigger: 6 belpogingen zonder contact
- Action: Task naar Daimy/Joey

### 3.3 WF-03: Follow-up na offerte
- Trigger: Offerte verstuurd, geen reactie na 3 dagen
- Action: Herinnerings-task + WhatsApp

### 3.4 WF-04: Review na montage
- Trigger: Montage afgerond
- Action: Wacht 3 dagen → trigger ZAP-11

---

## Fase 4 — Gripp koppeling (week 4-5)
*Focus: facturatie automatiseren*

### 4.1 Gripp API activeren
- [ ] Gripp → API Request Pack kopen
- [ ] API key testen
- **Wie**: Daimy
- **Blocker**: Zonder dit werken ZAP-05, ZAP-06, ZAP-10 niet

### 4.2 Gripp offertes + facturen via API
- Claude bouwt de koppeling zodra API werkt

---

## Fase 5 — Optimalisatie (week 5+)
*Focus: finetuning en extra features*

- [ ] Referral programma live zetten
- [ ] Dashboard live zetten (12 KPIs)
- [ ] Nmbrs ↔ Planado beschikbaarheid sync
- [ ] Montage-duur tracking (rapporten)
- [ ] Oplossingen vertalen naar Nederlands in Planado
- [ ] Planado klantportaal activeren (klant ziet afspraak status)

---

## Samenvatting: wat Daimy moet doen

| # | Actie | Tijd | Fase |
|---|-------|------|------|
| 1 | Fireflies.ai account aanmaken + HubSpot koppelen | 10 min | 1 |
| 2 | HubSpot automation scope toevoegen | 2 min | 1 |
| 3 | M365 admin consent voor Trengo | 5 min | 1 |
| 4 | Planado API key vernieuwen | 1 min | 1 |
| 5 | "Vervolg van opdracht #" veld toevoegen (8x) | 8 min | 1 |
| 6 | Zapier toegang regelen | 10 min | 2 |
| 7 | Gripp API Request Pack kopen | 5 min | 4 |
| **Totaal** | | **~40 min** | |

Na deze 40 minuten kan Claude de rest bouwen.

---

## Wat Claude doet (na jouw acties)

1. HubSpot Workflows WF-01 t/m WF-04 bouwen
2. Zapier zaps ZAP-02 t/m ZAP-11 configureren
3. Trengo email kanalen koppelen (5 mailboxen)
4. Gripp API koppeling bouwen
5. Dashboard + referral programma deployen
6. Alles testen end-to-end
