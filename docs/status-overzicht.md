# Sonty — Status Overzicht

> Laatst bijgewerkt: 2026-03-10
> Door: Claude (automatisch bijgehouden)

---

## Samenvatting

| Onderdeel | Status |
|---|---|
| HubSpot CRM | ✅ Compleet |
| HubSpot Workflows | ✅ WF-01 t/m WF-06 actief |
| HubSpot Properties | ✅ Alle aangemaakt |
| Planado Templates | ✅ 8 templates in het Nederlands |
| Dashboard | ✅ Draait op localhost:3456 |
| Zapier Zaps | ⏳ 2/11 in draft, 9 nog te bouwen |

---

## Wat is AF

### HubSpot
- [x] Pipeline met 18 stappen (ID: 3623322812)
- [x] Alle custom properties (deal + contact)
- [x] Workflows WF-01 t/m WF-06
- [x] Private App "Sonty Automation" (ID: 33327041)

### Planado
- [x] 8 templates hernoemd naar Nederlands
- [x] Job types gekoppeld aan templates
- [x] Duur ingesteld per type (Opmeting 2u, Installatie 4u, etc.)

### Dashboard
- [x] KPI overzicht (12 kaarten)
- [x] Advertentiekosten invoer (Google/Meta per maand)
- [x] 7 grafieken (omzet, pipeline, conversie, producten, bronnen, leads/week, verliesredenen)
- [x] Prestaties per Bron tabel
- [x] Deals tabel met filters en export
- [x] Ideeën & Verbeteringen board (apart tabblad)
- [x] Sonty dark theme styling

---

## Wat moet NOG gedaan worden

### Prioriteit HOOG (blokkers voor go-live)

| # | Taak | Wie | Opmerking |
|---|---|---|---|
| 1 | **HubSpot tracking code op sonty.nl** | Daimy | Script toevoegen in website header. Zonder dit werkt lead source tracking niet. |
| 2 | **Google Ads koppelen aan HubSpot** | Daimy | Account 777-367-3700, via HubSpot > Instellingen > Advertenties |
| 3 | **Meta Ads koppelen aan HubSpot** | Daimy | Account 1633352477464320, via HubSpot > Instellingen > Advertenties |
| 4 | **UTM parameters op alle ads** | Daimy | utm_source, utm_medium, utm_campaign op elke advertentie URL |
| 5 | **Planado Pro plan activeren** | Daimy | Nodig voor API/webhooks (ZAP-04, ZAP-09). ~€29/user/maand |
| 6 | **Trengo Channel ID opvragen** | Daimy | Nodig voor ZAP-02 (WhatsApp). Uit Trengo admin halen |
| 7 | **ZAP-03 + ZAP-08 afronden** | Claude | Contact data stap testen met echte test-deal |

### Prioriteit NORMAAL (nodig voor volledige flow)

| # | Taak | Wie | Opmerking |
|---|---|---|---|
| 8 | **ZAP-02 bouwen** | Claude | WhatsApp follow-up via Trengo (wacht op Channel ID) |
| 9 | **ZAP-04 bouwen** | Claude | Planado webhook → HubSpot (opmeting afgerond). Wacht op Planado Pro |
| 10 | **ZAP-05 bouwen** | Claude | Definitieve offerte via Gripp |
| 11 | **ZAP-06 bouwen** | Claude | Aanbetaling factuur via Gripp |
| 12 | **ZAP-07 bouwen** | Claude | Order bevestiging email parsing |
| 13 | **ZAP-08 afronden** | Claude | Installatie job in Planado |
| 14 | **ZAP-09 bouwen** | Claude | Planado webhook → HubSpot (installatie afgerond). Wacht op Planado Pro |
| 15 | **ZAP-10 bouwen** | Claude | Eindfactuur via Gripp |
| 16 | **ZAP-11 bouwen** | Claude | Review request via Trengo |

### Prioriteit LAAG (nice to have)

| # | Taak | Wie | Opmerking |
|---|---|---|---|
| 17 | **Dashboard online zetten** | Claude | Nu alleen localhost:3456. Via VPS of Cloudflare Tunnel |
| 18 | **WF-03 vertakking configureren** | Daimy | Handmatig: eigenschap selecteren → Stadium deal → Eerste Offerte Verstuurd |
| 19 | **Full pipeline test** | Samen | Synthetische lead door hele flow heen |

---

## Zapier Zaps Status

| Zap | Naam | Status | Blokkeer |
|---|---|---|---|
| ZAP-01 | Lead intake Reuzenpanda | ✅ Live | - |
| ZAP-02 | WhatsApp follow-up | ❌ Niet gestart | Trengo Channel ID |
| ZAP-03 | Opmeting inplannen (Planado) | 🔶 Draft (353373774) | Test data voor contact mapping |
| ZAP-04 | Opmeting afgerond | ❌ Niet gestart | Planado Pro plan (webhooks) |
| ZAP-05 | Definitieve offerte (Gripp) | ❌ Niet gestart | Gripp API credentials |
| ZAP-06 | Aanbetaling factuur (Gripp) | ❌ Niet gestart | Gripp API credentials |
| ZAP-07 | Orderbevestiging email | ❌ Niet gestart | - |
| ZAP-08 | Installatie inplannen (Planado) | 🔶 Draft (353424667) | Test data voor contact mapping |
| ZAP-09 | Installatie afgerond | ❌ Niet gestart | Planado Pro plan (webhooks) |
| ZAP-10 | Eindfactuur (Gripp) | ❌ Niet gestart | Gripp API credentials |
| ZAP-11 | Review request (Trengo) | ❌ Niet gestart | Trengo Channel ID |

---

## Acties voor Daimy (handmatig)

1. **sonty.nl** → HubSpot tracking code in `<head>` plaatsen
2. **HubSpot** → Instellingen > Advertenties > Google Ads + Meta Ads koppelen
3. **Google/Meta Ads** → UTM parameters toevoegen aan alle campagne URLs
4. **Planado** → Upgraden naar Pro plan voor API/webhook toegang
5. **Trengo** → Channel ID opzoeken en aan Claude doorgeven
6. **Gripp** → API credentials opzoeken en aan Claude doorgeven
7. **HubSpot** → WF-03 vertakking handmatig configureren

---

## Acties voor Claude (automatisch)

1. ZAP-03/08 contact mapping testen zodra er test-deals zijn
2. ZAP-04/09 bouwen zodra Planado Pro actief is
3. ZAP-02/11 bouwen zodra Trengo Channel ID bekend is
4. ZAP-05/06/10 bouwen zodra Gripp credentials bekend zijn
5. ZAP-07 bouwen (email parsing, geen blokkeer)
6. Dashboard online zetten wanneer gewenst
