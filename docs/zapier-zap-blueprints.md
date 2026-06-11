# Sonty — Zapier Zap Blueprints

> 11 zaps voor de volledige 18-stappen klantflow
> Bouw deze in volgorde in zapier.com

---

## ZAP-01: Lead Intake van Reuzenpanda

**Trigger:** Reuzenpanda → New Lead/Configuration Completed
**Actions:**
1. HubSpot → Search Contact by email (duplicate check)
2. HubSpot → Create or Update Contact
   - Email: {{email}}
   - Firstname: {{voornaam}}
   - Lastname: {{achternaam}}
   - Phone: {{telefoon}}
3. HubSpot → Create Deal
   - Deal name: "{{voornaam}} {{achternaam}} – {{product}}"
   - Pipeline: Sonty Pipeline (ID: 3623322812)
   - Stage: Nieuwe Lead (ID: 4998659267)
   - Product categorie: {{product_type}}
   - Amount: {{prijsindicatie}}
   - Associate with contact

**Status:** Reuzenpanda al connected in Zapier ✅

---

## ZAP-02: WhatsApp Follow-up via Trengo

**Trigger:** HubSpot → Deal Stage Changed to "Prijsindicatie Verstuurd"
**Filter:** Only continue if deal stage = Prijsindicatie Verstuurd
**Actions:**
1. Formatter → Random Number (1-5) — voor template variatie
2. Trengo → Send WhatsApp Message
   - Channel: WhatsApp Business (+31 85 006 9681) (ID: 1359857)
   - Contact phone: {{contact_phone}}
   - Template: variatie op basis van random number
3. HubSpot → Update Deal Stage → "WhatsApp Verstuurd"
4. HubSpot → Create Note
   - Body: "WhatsApp follow-up verstuurd via Trengo"

**Templates (kies random):**
1. "Goedendag {{naam}}! Heeft u de prijsindicatie ontvangen? Ik help u graag verder!"
2. "Hallo {{naam}}! Fijn dat u interesse heeft in Sonty. Heeft u vragen over de prijsindicatie?"
3. "Beste {{naam}}, bedankt voor uw aanvraag. Zullen we een afspraak maken om alles te bespreken?"
4. "Goedendag! Ik zag dat u een prijsindicatie heeft ontvangen. Kan ik u ergens mee helpen?"
5. "Hi {{naam}}! Wist u dat u ook langs kunt komen in onze showroom? We laten u graag alles zien!"

---

## ZAP-03: Opmeting Inplannen in Planado

**Trigger:** HubSpot → Deal Stage Changed to "Opmeting Ingepland"
**Actions:**
1. Planado → Create Job (API Request)
   - URL: POST https://api.planadoapp.com/v2/jobs
   - Auth: Bearer b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef
   - Headers: X-Planado-Notify-Assignees: false
   - Body:
     ```json
     {
       "external_id": "hubspot-{{deal_id}}",
       "description": "Opmeting - {{contact_name}}\n{{deal_name}}",
       "scheduled_at": "{{opmeting_datum}}",
       "scheduled_duration": {"hours": 1, "minutes": 0},
       "address": {"formatted": "{{contact_address}}"}
     }
     ```
2. HubSpot → Update Deal
   - planado_job_id: {{planado_job_uuid}}
3. HubSpot → Send Email (bevestiging aan klant)
   - Template: Opmeting Bevestiging

---

## ZAP-04: Opmeting Afgerond (Planado → HubSpot)

**Trigger:** Planado → Webhook (job_finished, type: Opmeting)
- Webhook URL: Zapier webhook URL
- Planado: Settings → Integrations → Webhooks → Add → job_finished
**Actions:**
1. HubSpot → Search Deal by planado_job_id or external_id
2. HubSpot → Update Deal Stage → "Opmeting Afgerond"
3. HubSpot → Create Task
   - Title: "Maak definitieve offerte in Gripp"
   - Due: +1 business day

---

## ZAP-05: Definitieve Offerte via Gripp

**Trigger:** HubSpot → Deal Stage Changed to "Definitieve Offerte Verstuurd"
**Actions:**
1. Gripp → Create Quote (API Request)
   - ⚠️ VEREIST: Gripp API Request Pack kopen (limiet = 0)
   - URL: POST https://api.gripp.com/public/api3.php
   - Auth: Bearer WZvM6r0bAGGONGRhrkWTxVrydXq9H2
2. HubSpot → Update Deal
   - gripp_offerte_id: {{gripp_quote_id}}
   - definitief_offertebedrag: {{bedrag}}
3. HubSpot → Send Email (offerte aan klant)

---

## ZAP-06: Aanbetaling Factuur

**Trigger:** HubSpot → Deal Stage Changed to "Offerte Akkoord"
**Actions:**
1. Gripp → Create Invoice (50% van deal bedrag)
   - ⚠️ VEREIST: Gripp API
2. HubSpot → Update Deal
   - gripp_factuur_id_aanbetaling: {{gripp_invoice_id}}
   - aanbetaling_bedrag: {{50% van amount}}
3. HubSpot → Update Deal Stage → "Aanbetaling Verstuurd"
4. HubSpot → Send Email (factuur aan klant)

---

## ZAP-07: Orderbevestiging van Leverancier

**Trigger:** Microsoft Outlook → New Email in orders@sonty.nl
- ⚠️ VEREIST: Outlook koppeling in Zapier (jij moet dit doen)
**Filter:** Subject contains "order" OR "bevestiging" OR "confirmation"
**Actions:**
1. Formatter → Extract deal reference from email body
2. HubSpot → Search Deal by reference
3. HubSpot → Update Deal Stage → "Orderbevestiging Ontvangen"
4. HubSpot → Create Task → "Plan installatie"
5. HubSpot → Update Deal
   - producten_ontvangen_op: {{datum}}

---

## ZAP-08: Installatie Inplannen in Planado

**Trigger:** HubSpot → Deal Stage Changed to "Installatie Ingepland"
**Actions:**
1. Planado → Create Job (API Request)
   - Body:
     ```json
     {
       "external_id": "hubspot-install-{{deal_id}}",
       "description": "Montage - {{contact_name}}\n{{deal_name}}",
       "scheduled_at": "{{installatie_datum}}",
       "address": {"formatted": "{{contact_address}}"}
     }
     ```
2. HubSpot → Update Deal
   - planado_job_id_installatie: {{planado_job_uuid}}
3. HubSpot → Send Email (installatie bevestiging)

---

## ZAP-09: Installatie Afgerond (Planado → HubSpot)

**Trigger:** Planado → Webhook (job_finished, type: Installatie)
**Actions:**
1. HubSpot → Search Deal
2. HubSpot → Update Deal Stage → "Installatie Afgerond"
3. HubSpot → Create Task → "Stuur eindfactuur"

---

## ZAP-10: Eindfactuur via Gripp

**Trigger:** HubSpot → Deal Stage Changed to "Eindfactuur Verstuurd"
**Actions:**
1. Gripp → Create Invoice (remaining 50%)
   - ⚠️ VEREIST: Gripp API
2. HubSpot → Update Deal
   - eindfactuur_bedrag: {{bedrag}}
3. HubSpot → Send Email (eindfactuur)

---

## ZAP-11: Review Request via Trengo

**Trigger:** HubSpot → Deal Stage Changed to "Eindfactuur Verstuurd"
**Delay:** 24 uur
**Actions:**
1. Delay → Wait 24 hours
2. Trengo → Send WhatsApp Message
   - Template: "Goedendag {{naam}}! Wij hopen dat u tevreden bent. Zou u een review willen achterlaten op Google? ⭐ Dat helpt ons enorm!"
3. HubSpot → Update Deal Stage → "Afgerond"
4. HubSpot → Create Note → "Review request verstuurd"

---

## Prioriteit Volgorde

| # | Zap | Kan nu gebouwd? | Blocker |
|---|-----|----------------|---------|
| 1 | ZAP-01 | ✅ Ja | Reuzenpanda al connected |
| 2 | ZAP-03 | ✅ Ja | Planado API werkt |
| 3 | ZAP-04 | ✅ Ja | Planado webhooks nodig |
| 4 | ZAP-08 | ✅ Ja | Planado API werkt |
| 5 | ZAP-09 | ✅ Ja | Planado webhooks nodig |
| 6 | ZAP-02 | ✅ Ja | Trengo WhatsApp connected |
| 7 | ZAP-11 | ✅ Ja | Trengo WhatsApp connected |
| 8 | ZAP-07 | ⚠️ Deels | Outlook koppeling nodig |
| 9 | ZAP-05 | ❌ Nee | Gripp API limiet = 0 |
| 10 | ZAP-06 | ❌ Nee | Gripp API limiet = 0 |
| 11 | ZAP-10 | ❌ Nee | Gripp API limiet = 0 |

## Benodigde API Keys/Connections
- HubSpot: Connected via OAuth ✅
- Reuzenpanda: Connected (Invite Only) ✅
- Planado API: b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef ✅
- Trengo: Connected ✅
- Gripp: API key werkt maar limiet = 0 ❌ (koop API Request Pack)
- Outlook: Nog niet gekoppeld in Zapier ⚠️
