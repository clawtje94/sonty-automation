# Sonty Referral Program — Plan

> Datum: 16 maart 2026

---

## Hoe het werkt

1. Klant krijgt na installatie een persoonlijke doorverwijslink via WhatsApp
2. Nieuwe klant klikt op de link → komt op de Reuzenpanda configurator
3. Zodra de nieuwe klant bestelt en aanbetalingsfactuur voldoet:
   - **Verwijzer**: €75 cashback
   - **Nieuwe klant**: €50 korting

Geen limiet op doorverwijzingen.

---

## Beloningsstructuur

| Optie | Verwijzer | Nieuwe klant | Aanbeveling |
|-------|-----------|-------------|-------------|
| **Cash (aanbevolen)** | €75 cashback | €50 korting | Beste conversie |
| Staffelmodel | €50/€75/€100 | €50 korting | Stimuleert meerdere |
| Cadeaubon | €75 bol.com | €50 korting | Populair maar minder direct |

### Voorwaarden
- Uitbetaling na aanbetaling door nieuwe klant
- Minimale orderwaarde: €500
- Uitbetaling binnen 14 dagen via bankoverschrijving
- Reparaties uitgesloten

---

## Timing — Wanneer vragen

### Moment 1: Direct na installatie (PRIMAIR)
- 30 min na Planado "installatie voltooid" webhook
- Monteur overhandigt fysieke kaart
- Verwachte response: 15-25%

### Moment 2: Na positieve Google review
- 24 uur na review
- Verwachte response: 20-30%

### Moment 3: Seizoenscampagne (maart)
- Jaarlijkse WhatsApp naar klanten van afgelopen 2 jaar
- Verwachte response: 3-5% (groot bereik)

### Moment 4: Na service/onderhoudsbezoek
- 24 uur na servicebezoek
- Verwachte response: 5-10%

---

## Integratie

### HubSpot — Nieuwe properties

**Contact:**
- `referral_code` — unieke code (bijv. SONTY-JANSEN-7X)
- `referral_link` — persoonlijke doorverwijslink
- `referral_count` — aantal geslaagde verwijzingen
- `referral_earnings` — totaal verdiend
- `referred_by` — referral_code van verwijzer

**Deal:**
- `is_referral` — boolean
- `referral_source_contact` — contact ID van verwijzer

### HubSpot Workflows (2 nieuw)

**WF-REF-01**: Referral code genereren na installatie
**WF-REF-02**: Beloning toekennen na aanbetaling referral-deal

### Zapier (3 nieuwe zaps)

**ZAP-REF-01**: Referral uitnodiging → Trengo WhatsApp
**ZAP-REF-02**: Beloning bevestiging → Trengo + Telegram notificatie
**ZAP-REF-03**: Seizoenscampagne (jaarlijks maart)

### Trengo — WhatsApp Templates

5 templates:
1. Eerste referral uitnodiging (na installatie)
2. Referral herinnering (na review)
3. Beloningsbevestiging
4. Seizoenscampagne
5. Buren-specifiek

---

## Tracking

```
Klant krijgt link: sonty.nl/doorverwijzen?ref=SONTY-JANSEN-7X
  → Redirect naar Reuzenpanda met UTM params
  → ZAP-01 pakt ref parameter op
  → HubSpot deal: is_referral=true, referred_by=code
  → Bij aanbetaling: WF-REF-02 triggert beloning
```

**Simpele start**: sales vult handmatig `referred_by` in → later automatiseren

---

## Unieke zonwerings-angles

### Het buren-effect
Zonwering is ZICHTBAAR. Buren zien het dagelijks. Monteur geeft 2-3 kaartjes mee.

### Straatkorting
3+ huizen in dezelfde straat = extra korting (ook logistiek voordeel).

### Seizoensgebonden
- Maart-mei: referral campagne
- Juni-aug: hittegolf triggers
- KNMI code oranje → extra herinnering

### Sonty Ambassadeur (3+ verwijzingen)
- Gratis jaarlijks onderhoud
- €100 per verwijzing (i.p.v. €75)
- VIP-status

### Per product
- Screens: "geen insecten + koel"
- Knikarmscherm: zichtbaar, "terras-jaloers"
- Pergola: grote investering, grote zichtbaarheid
- Rolluiken: beveiliging → buren willen hetzelfde
- Raamdeco: bezoekers zien het binnen

---

## Verwachte ROI

| Metric | Conservatief | Realistisch | Optimistisch |
|--------|-------------|-------------|-------------|
| Klanten die link delen | 8% | 15% | 25% |
| Referral leads die converteren | 15% | 25% | 35% |
| Gem. orderwaarde | €2.000 | €2.500 | €3.000 |
| CAC via referral | €125 | €125 | €125 |
| CAC via ads (vergelijking) | €150-300 | €200-400 | €250-500 |

### Realistisch per jaar
- ~47 nieuwe deals via referral
- Bruto omzet: ~€117.500
- Kosten beloningen: ~€5.875
- **ROI: ~20:1**
- **CAC 40-60% lager dan via ads**

---

## Implementatie

| Fase | Wanneer | Wat |
|------|---------|-----|
| MVP | Week 1-2 | HubSpot properties, WhatsApp templates, kaartjes ontwerpen |
| Automatisering | Week 3-4 | ZAP-REF-01/02 bouwen, HubSpot workflows |
| Launch | Week 5 | Soft launch bij laatste 50 klanten, monteurs briefen |
| Scale | Week 6+ | Seizoenscampagne, dashboard KPIs, Ambassadeur evaluatie |
