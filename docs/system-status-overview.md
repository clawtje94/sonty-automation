# Sonty — Systeem Status Overzicht

> Per software: wat is er geconfigureerd, wat mist, wat moet gekoppeld
> Laatst bijgewerkt: 2026-03-13

---

## 1. HubSpot (CRM)

### ✅ Geconfigureerd
- Pipeline "Sonty Verkooppijplijn" met 18 stages + Verloren
- 6 workflows (WF-01 t/m WF-06):
  - WF-01: Belpogingen bij nieuwe lead
  - WF-02: Notificaties
  - WF-03: Offerte follow-up
  - WF-04/05/06: Stage-based triggers
- Custom properties: product_categorie, inkoopbedrag, verkoop_excl_btw, inkoop_excl_btw
- Private App "Sonty Automation" (token werkt)
- 7 test-deals in pipeline

### ⚠️ Handmatig nodig (door Daimy)
- **Tijdzone** → Europe/Amsterdam (Settings → Account Defaults → General)
- **Valuta** → EUR (zelfde plek)
- Contact properties dubbelcheck (sommige duplicates verwijderd)

### 🔗 Koppelingen actief
- Zapier OAuth → werkt (ZAP-01, 02, 03, 04, 05, 06, 08)
- Private App API → werkt (property management)

### ❌ Nog te doen
- Niets — HubSpot is volledig ingericht voor Phase 1

---

## 2. Zapier (Automatisering)

### ✅ Actief & gepublished
- **ZAP-01**: Reuzenpanda → HubSpot (lead + deal aanmaken)
- **ZAP-02**: HubSpot → Trengo (WhatsApp follow-up)
- **ZAP-03**: HubSpot → Planado (opmeting inplannen)
- **ZAP-08**: HubSpot → Planado (installatie inplannen)
- **Reuzenpanda → Google Sheets** (bestaande actieve zap, NIET AANRAKEN)

### ⚠️ Draft (moet gepublished door Daimy)
- **ZAP-04**: Planado webhook → HubSpot (opmeting klaar)
  - Webhook URL: `https://hooks.zapier.com/hooks/catch/22982966/uxppbhy/`
  - Actie: skip test → publish
- **ZAP-09**: Planado webhook → HubSpot (installatie klaar)
  - Status: Copilot heeft zap gebouwd, webhook URL wordt opgehaald

### ❌ Nog te bouwen
- **ZAP-05**: HubSpot → Gripp (offerte aanmaken) — **wacht op Gripp API**
- **ZAP-06**: HubSpot → Gripp (aanbetaalfactuur) — **wacht op Gripp API**
- **ZAP-07**: orders@sonty.nl → HubSpot (bestelbevestiging) — **wacht op Outlook koppeling**
- **ZAP-10**: HubSpot → Gripp (eindfactuur) — **wacht op Gripp API**
- **ZAP-11**: HubSpot → Trengo (review verzoek via WhatsApp) — **kan nu gebouwd worden**

### 🔗 Verbonden accounts in Zapier
- Reuzenpanda ✅
- HubSpot ✅
- Planado ✅
- Trengo ✅
- Gripp ❌ (nog niet)
- Microsoft 365/Outlook ❌ (nog niet)

---

## 3. Planado (Buitendienst)

### ✅ Geconfigureerd
- 6 afspraaktypes:
  1. Inmeet afspraak
  2. Montage afspraak
  3. Winkel afspraak
  4. Service afspraak
  5. Reparatie afspraak
  6. Onderhouds afspraak
- Webhook → Zapier (job_finished event)
- API key aangemaakt
- Gekoppeld in Zapier (ZAP-03, ZAP-08)

### ⚠️ In uitvoering
- **Werkbon sjablonen** (templates) inrichten:
  - Inmeet: Nederlandse velden (metingen, foto's, opmerkingen montage team)
  - Montage: Nederlandse velden (voor/na foto's, materialen, nabestellingen, handtekening)
- Interne vs klant versie van werkbon

### ❌ Nog te doen
- Monteurs uitnodigen als gebruikers
- Werkbon foto's → WhatsApp groepsapp (via Zapier/Trengo)
- **Trial verloopt over ~9 dagen** → betaald plan nodig

### 🔗 Koppelingen
- Zapier ✅ (Create Job + Job Finished webhook)
- HubSpot (via Zapier) ✅

---

## 4. Gripp (Offertes & Facturen)

### ✅ Geconfigureerd
- API key aangemaakt (read-only werkt)
- Endpoint bekend: https://api.gripp.com/public/api3.php

### ❌ Geblokkeerd
- **API Request Pack moet gekocht worden** door Daimy in Gripp
  - Zonder dit: API call limiet = 0 (geen calls mogelijk)
  - Blokkeert: ZAP-05, ZAP-06, ZAP-10

### ❌ Nog te doen (na API Pack)
- Gripp verbinden in Zapier
- ZAP-05: Offerte aanmaken vanuit HubSpot
- ZAP-06: Aanbetaalfactuur aanmaken
- ZAP-10: Eindfactuur aanmaken
- Product templates in Gripp klaarzetten

---

## 5. Trengo (WhatsApp)

### ✅ Geconfigureerd
- Account actief
- Verbonden in Zapier
- ZAP-02 actief (WhatsApp follow-up)
- 5 WhatsApp templates ontworpen

### ⚠️ In uitvoering
- Gebruikers uitgenodigd (jorren@sonty.nl, sjoerd@sonty.nl) — Daimy deed dit zelf

### ❌ Nog te doen
- WhatsApp Business profiel koppelen (als nog niet gedaan)
- ZAP-11: Review request na installatie
- WhatsApp groepsapp voor montage foto's
- Templates goedkeuren bij WhatsApp Business

---

## 6. Outlook / Email

### ✅ Geconfigureerd
- 9 email templates ontworpen (Sonty branding)
- orders@sonty.nl mailbox bestaat

### ❌ Nog te doen
- Microsoft 365 koppelen in Zapier
- ZAP-07: orders@sonty.nl monitoren → HubSpot update bij bestelbevestiging
- Email templates importeren in HubSpot

---

## 7. Reuzenpanda (Configurator)

### ✅ Volledig werkend
- Configurator live
- Gekoppeld aan Zapier (ZAP-01)
- Koppeling naar Google Sheets (bestaande zap)
- Geen verdere actie nodig

---

## 8. Nmbrs (Salarisadministratie)

### ❌ Nog niet gestart
- Credentials komen vandaag (13 maart) van Daimy
- Nog geen integratie ontworpen
- Mogelijke koppeling: urenregistratie vanuit Planado

---

## 9. Ads (Meta / Google / Pinterest)

### ✅ Geconfigureerd
- Google Ads: Account 777-367-3700
- Meta Ads: Account 1633352477464320
- Pinterest: actief
- Alle ads → Reuzenpanda configurator (entry point)

### ❌ Nog te doen
- Conversion tracking verbeteren (HubSpot deal stages → ad platforms)
- ROAS rapportage koppelen aan dashboard

---

## 10. Aircall (AI Call Tracking) — LATER

### ❌ Gepland voor later
- Daimy heeft goedkeuring gegeven
- VoIP + opnames + HubSpot integratie + Nederlands
- Implementatie uitgesteld

---

## Prioriteiten Roadmap

### Nu direct te doen
1. ✅ ZAP-09 afmaken (webhook URL + publiceren)
2. ✅ Planado werkbon sjablonen inrichten
3. 🔧 ZAP-04 publiceren (Daimy)
4. 🔧 ZAP-11 bouwen (review request)

### Wacht op Daimy
5. Gripp API Request Pack kopen → dan ZAP-05/06/10
6. HubSpot tijdzone + valuta
7. Nmbrs credentials
8. Outlook/M365 koppeling → dan ZAP-07

### Later
9. Aircall integratie
10. Conversion tracking ads
11. Dashboard live data (nu mock data)
