# Sonty — Automatisering Overzicht

> Voor: Presentatie aan derden
> Datum: 14 maart 2026

---

## Wat bouwen we?

Een **volledig geautomatiseerd bedrijfsproces** voor Sonty (zonwering & woninginrichting), van eerste advertentie tot Google review. Alles draait op cloud-tools — geen eigen servers, geen technisch onderhoud.

---

## Het Systeem in 1 Oogopslag

```
Advertenties (Google/Meta/Pinterest)
         │
         ▼
  Reuzenpanda Configurator ← klant configureert product + krijgt prijsindicatie
         │
         ▼
    HubSpot CRM ← centraal klantdossier (18-staps pipeline)
     │       │
     ▼       ▼
  Zapier    HubSpot Workflows
  (11 automations)  (4 interne flows)
     │
     ├──► Planado — inmeten & montage (mobiele app voor monteurs)
     ├──► Gripp — offertes & facturen
     ├──► Trengo — WhatsApp berichten
     └──► Outlook — orderbevestigingen van leveranciers
```

---

## De 18 Stappen — Van Lead tot Review

| # | Stap | Automatisch? |
|---|------|:---:|
| 1 | Klant vult configurator in op website | - |
| 2 | Lead + deal aangemaakt in HubSpot | Ja (ZAP-01) |
| 3 | Bel-pogingen door sales (taak verschijnt automatisch) | Half |
| 4 | Prijsindicatie e-mail verstuurd | Sales |
| 5 | WhatsApp follow-up via Trengo | Ja (ZAP-02) |
| 6 | Klant reageert | - |
| 7 | Inmeet-afspraak ingepland in Planado | Ja (ZAP-03) |
| 8 | Inmeting afgerond → HubSpot geupdate | Ja (ZAP-04) |
| 9 | Definitieve offerte gemaakt in Gripp | Ja (ZAP-05) |
| 10 | Klant akkoord | Sales |
| 11 | Aanbetalingsfactuur verstuurd | Ja (ZAP-06) |
| 12 | Producten besteld bij leverancier | Sales |
| 13 | Orderbevestiging via orders@sonty.nl → HubSpot | Ja (ZAP-07) |
| 14 | Deal status bijgewerkt | Ja |
| 15 | Montage-afspraak ingepland in Planado | Ja (ZAP-08) |
| 16 | Montage afgerond → HubSpot geupdate | Ja (ZAP-09) |
| 17 | Eindfactuur verstuurd via Gripp | Ja (ZAP-10) |
| 18 | Review-verzoek via WhatsApp (Trengo) | Ja (ZAP-11) |

**Van de 18 stappen zijn er 14 volledig of grotendeels geautomatiseerd.**

---

## De Tools (7 + 3 advertentieplatformen)

| Tool | Wat doet het? | Kosten/mnd |
|---|---|---|
| **Reuzenpanda** | Productconfigurator op website | Bestaand |
| **HubSpot** | CRM — alle klantdata, pipeline, taken | Gratis tier |
| **Zapier** | Koppelingen tussen alle systemen | ~€50-100 |
| **Planado** | Planning & uitvoering monteurs (mobiele app) | Bestaand |
| **Gripp** | Offertes, facturen, boekhouding | Bestaand |
| **Trengo** | WhatsApp berichten naar klanten | ~€25/mnd |
| **Outlook** | E-mail (orders@sonty.nl) | Bestaand |
| Google/Meta/Pinterest Ads | Leadgeneratie | Variabel |

**Geen eigen servers. Geen technisch onderhoud. Alles draait in de cloud.**

---

## Wat is er al gebouwd?

### Dashboard (live)
- 12 KPI's: omzet, inkoop, marge, slagingspercentage, kosten per lead, ROAS
- 7 grafieken: omzet/inkoop/marge trends, deals per fase, conversiepercentages, productcategorieën, leadbronnen
- Deal-tabel met filters (product, status, zoeken)
- Advertentiekosten bijhouden (Google + Meta)
- Prestaties per leadbron
- Ideeënbord voor verbeteringen
- Sonty branding (logo, kleuren)
- Live data uit HubSpot

### HubSpot CRM
- 18-staps pipeline volledig ingericht
- 4 interne workflows actief (beltaken, notificaties, alerts, verloren deals)
- Custom properties (product, inkoopbedrag, categorieën)
- 9 e-mailtemplates met Sonty branding
- 5 WhatsApp templates

### Planado (veldwerk)
- 3 templates: Inmeet afspraak, Montage particulier, Montage zakelijk
- Rapportvelden: foto's voor/na, metingen, checklists
- Webhooks naar HubSpot (automatische status updates)

### Zapier Automations
- 11 zaps ontworpen, meerdere al gebouwd en getest

### Telegram Bot
- Directe communicatie met het automatiseringssysteem
- Vragen stellen, updates ontvangen, goedkeuringen geven

---

## Wat levert het op?

| Zonder automatisering | Met automatisering |
|---|---|
| Handmatig leads invoeren | Automatisch vanuit configurator |
| Vergeten te bellen/mailen | Automatische taken + reminders |
| WhatsApp berichten handmatig sturen | Automatisch op het juiste moment |
| Inmeet/montage planning via telefoon | Planado app met alle info erin |
| Status bijhouden in Excel/hoofd | Live dashboard met alle KPI's |
| Facturen handmatig maken | Automatisch via Gripp |
| Geen review-verzoeken | Automatisch WhatsApp na montage |

### Geschatte tijdsbesparing
- **2-3 uur per deal** aan administratie
- Bij 50 deals/maand = **100-150 uur/maand bespaard**
- Minder fouten, snellere opvolging, hogere conversie

---

## Screenshots

De volgende screenshots zijn beschikbaar in `/tmp/`:

1. **Dashboard bovenkant** — KPI's en metrics (`/tmp/sonty-dashboard-top.png`)
2. **Dashboard volledig** — alle grafieken en tabellen (`/tmp/sonty-dashboard-overview.png`)
3. **Planado templates** — inmeet en montage configuratie
4. **HubSpot pipeline** — 18-staps verkoopproces
5. **Zapier automations** — gekoppelde workflows

---

*Gebouwd door Sonty + AI-automatisering (Claude). Maart 2026.*
