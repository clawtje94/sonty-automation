# Sonty Conversie-Optimalisatie Plan

> Opgesteld: 11 maart 2026
> Op basis van: wetenschappelijk onderzoek, industrie-benchmarks en best practices voor woningverbetering/zonwering

---

## Samenvatting Belangrijkste Inzichten

| Inzicht | Data |
|---------|------|
| Bellen binnen 5 min | 391% hogere conversie vs. 30+ min wachten |
| 78% koopt bij eerste respondent | Snelheid = vertrouwen |
| WhatsApp open rate | 98% (vs. 20% email) |
| WhatsApp click rate | Tot 60% |
| Reviews impact | 15-20% hogere conversie |
| 6x belpogingen | 90% kans op contact (vs. 10% bij 1 poging) |
| Beste beltijden | 08:00-09:00 en 16:00-17:00 |
| Beste beldagen | Dinsdag, woensdag, donderdag |

---

## QUICK WINS (Deze Week Implementeren)

### QW-1: Speed-to-Lead Versnellen (HOOGSTE PRIORITEIT)

**Probleem:** Elke 10 minuten vertraging verlaagt de conversiekans met 400%. 78% van de klanten kiest het bedrijf dat het eerst reageert.

**Actie:** Zorg dat nieuwe leads binnen 5 minuten worden gebeld.

**Implementatie (automatiseerbaar):**
- HubSpot workflow: zodra een deal in stage "Nieuwe Lead" komt, stuur direct een **push-notificatie** naar het sales team via Telegram
- Voeg een automatisch SMS/WhatsApp bericht toe dat direct na leadbinnenkomst verstuurd wordt:

```
Hoi [voornaam]! Bedankt voor je aanvraag bij Sonty.
We bellen je zo snel mogelijk - meestal binnen een paar minuten.
Mocht je ons willen bereiken: 📞 [telefoonnummer]
```

- **Waarom:** Dit bericht bevestigt de aanvraag, geeft de klant vertrouwen, en zorgt dat ze niet ondertussen bij de concurrent gaan kijken
- **Timing:** Binnen 1 minuut na leadbinnenkomst (Zapier trigger)

### QW-2: Belpoging-cadans Uitbreiden

**Probleem:** Met slechts 2 belpogingen bereik je statistisch gezien maar 10-20% van de leads. Bij 6 pogingen stijgt dit naar 90%.

**Actie:** Verhoog van 2 naar 6 belpogingen met het volgende schema:

| Poging | Wanneer | Dag/Tijd |
|--------|---------|----------|
| 1 | Binnen 5 min na lead | Direct |
| 2 | 2-3 uur later | Zelfde dag, ander tijdblok |
| 3 | Volgende werkdag | 08:30-09:00 (ochtend) |
| 4 | Dag 3 | 16:00-17:00 (late middag) |
| 5 | Dag 5 | 10:00-11:00 (ochtend) |
| 6 | Dag 7 | 16:00-17:00 (laatste poging) |

**Optimale tijden (onderzoek):**
- Ochtend: 08:00-09:00 (28-32% connection rate)
- Late middag: 16:00-17:00 (hoogste conversie)
- Beste dagen: dinsdag t/m donderdag
- Vermijd: maandagochtend en vrijdagmiddag

**Implementatie:** HubSpot taak-sequences met automatische herinneringen per poging.

### QW-3: WhatsApp Templates Verbeteren

**Huidige situatie:** 3 gerandomiseerde templates via Trengo (ZAP-02).

**Verbetering:** Maak de templates persoonlijker en voeg waarde toe. Niet alleen "hoi, heb je onze offerte gezien?" maar context-specifiek.

**Nieuwe template-set (6 stuks, roteren per situatie):**

**Template 1 — Na eerste belpoging (geen gehoor):**
```
Hoi [voornaam], je spreekt met [naam] van Sonty! 👋
Ik probeerde je net te bellen over je aanvraag voor [product].
Wanneer komt het je het beste uit om even te bellen?
Je kunt ook gewoon hier antwoorden!
```

**Template 2 — Na prijsindicatie email:**
```
Hoi [voornaam]! We hebben je zojuist de prijsindicatie gestuurd voor je [product].
Heb je vragen? Stuur ze gerust via WhatsApp, dan helpen we je direct verder.
Groetjes, Team Sonty
```

**Template 3 — Social proof (na 2e belpoging geen gehoor):**
```
Hoi [voornaam], we wilden je even laten weten dat we vorige maand
[X] [product-type] installaties hebben gedaan in [regio].
Onze klanten geven ons een 4.9 op Google (500+ reviews)! ⭐
Zullen we een gratis inmeetafspraak voor je inplannen?
```

**Template 4 — Urgentie/seizoen:**
```
Hoi [voornaam]! Het zonseizoen komt eraan en onze agenda raakt snel vol.
Wil je er zeker van zijn dat je [product] op tijd geplaatst wordt?
Plan dan nu je gratis inmeetafspraak: [link] of antwoord hier!
```

**Template 5 — Waarde bieden:**
```
Hoi [voornaam], nog even over je [product] aanvraag.
Wist je dat [product] gemiddeld [X]% energiebesparing oplevert?
Zullen we vrijblijvend langskomen om de mogelijkheden te bekijken?
```

**Template 6 — Laatste poging (friendly close):**
```
Hoi [voornaam], we hebben je een paar keer proberen te bereiken
over je [product] aanvraag. We snappen dat het druk is!
Mocht je in de toekomst nog interesse hebben, je kunt ons altijd
bereiken via dit nummer. Fijne dag! 😊
```

### QW-4: Sociale Bewijskracht Maximaliseren

**Jullie hebben goud in handen:** 4.9/5.0 met 500+ reviews. Dit moet OVERAL zichtbaar zijn.

**Directe acties:**
1. Voeg Google Reviews widget toe aan de Reuzenpanda configurator pagina
2. Voeg in ELKE email een footer toe: "Beoordeeld met 4.9/5.0 door 500+ klanten op Google ⭐"
3. Voeg in WhatsApp templates social proof toe (zie Template 3 hierboven)
4. Voeg aan de prijsindicatie email 2-3 relevante klantreviews toe (productspecifiek)

---

## MEDIUM-TERM VERBETERINGEN (1-2 Weken)

### MT-1: Geautomatiseerde Nurture Sequence voor Niet-Reagerende Leads

**Probleem:** Na 6 belpogingen en WhatsApp berichten vallen leads nu uit het systeem. Maar 60-70% van de leads koopt uiteindelijk wel - alleen niet NU.

**Oplossing:** Bouw een geautomatiseerde long-term nurture flow in HubSpot.

**Nurture Flow (na uitval uit actieve sales):**

| Dag | Kanaal | Inhoud |
|-----|--------|--------|
| Dag 14 | Email | "We denken aan je" + inspiratie-content (foto's van recente projecten in hun regio) |
| Dag 28 | WhatsApp | Seizoensgebonden tip (bijv. "De zon wordt sterker, wist je dat screens tot 90% warmte tegenhouden?") |
| Dag 45 | Email | Klantcase/voor-na foto's van vergelijkbaar project |
| Dag 60 | WhatsApp | "Nog steeds interesse?" + eventuele actie/aanbieding |
| Dag 90 | Email | "We hebben je gemist" + herinnering aan de prijsindicatie |
| Dag 120 | WhatsApp | Seizoensgebonden laatste poging |

**Automatisering:** HubSpot workflow, getriggerd wanneer deal naar stage "Niet Bereikt" of "Geen Reactie" gaat. Bij elke interactie (email open, WhatsApp reply) → direct terug naar actieve sales pipeline.

### MT-2: Prijsindicatie Email Optimaliseren

**De prijsindicatie email is het cruciale conversiemoment.** Na de configurator is dit het eerste "echte" contact.

**Verbeteringen:**

1. **Onderwerpregel personaliseren:**
   - Niet: "Uw prijsindicatie van Sonty"
   - Wel: "[Voornaam], je prijsindicatie voor [product] in [woonplaats]"

2. **Email structuur (boven de vouw):**
   - Persoonlijke aanhef
   - Foto van exact het type product (uit hun configuratie)
   - Prijsindicatie helder weergegeven
   - "Waarom Sonty?" blok met: 4.9 sterren, 500+ reviews, garantie, gratis inmeten

3. **Social proof blok:**
   - 2 korte klantquotes (productspecifiek)
   - Gemiddelde Google rating badge
   - Aantal installaties dit jaar

4. **CTA duidelijk:**
   - Primair: "Plan je gratis inmeetafspraak" (grote knop)
   - Secundair: "Bel ons direct" of "Stuur een WhatsApp"

5. **Urgentie element:**
   - "Onze huidige levertijd voor [product] is [X] weken"
   - Seizoensgebonden: "Plan voor de zomer, bestel voor [datum]"

### MT-3: Post-Inmeting Conversie Verhogen

**Na de inmeetafspraak is de klant "warm" maar moet nog de final quote goedkeuren.**

**Geautomatiseerde sequence na inmeting:**

| Timing | Actie |
|--------|-------|
| Direct na inmeting | WhatsApp: "Bedankt voor je tijd! We werken aan je definitieve offerte." |
| +2 uur | Email: Samenvatting van wat besproken is + foto's van vergelijkbare projecten |
| +24 uur | Final quote email met duidelijke CTA |
| +48 uur | WhatsApp: "Heb je de offerte ontvangen? Vragen? Stuur ze gerust!" |
| +5 dagen | Belpoging door de monteur/adviseur die de inmeting deed (persoonlijk) |
| +7 dagen | WhatsApp: "De offerte is nog [X] dagen geldig. Zullen we een installatiedatum reserveren?" |
| +14 dagen | Laatste follow-up: "We snappen dat het een grote beslissing is. Wil je dat we nog een keer langskomen?" |

### MT-4: Review-strategie Automatiseren

**Jullie rating is 4.9 - dat moet zo blijven en groeien.**

**Geautomatiseerd reviewverzoek (ZAP-11 verbeteren):**

**Timing:** 2-3 dagen na installatie (niet direct - laat de klant eerst genieten)

**Stap 1 — WhatsApp (dag 2 na installatie):**
```
Hoi [voornaam]! Hoe bevalt je nieuwe [product]? 😊
We hopen dat je er blij mee bent!
```

**Stap 2 — WhatsApp (dag 4, als positieve reactie OF geen reactie):**
```
Fijn om te horen! / We hopen dat alles naar wens is!
Zou je ons willen helpen door een korte review achter te laten?
Het kost maar 1 minuutje en helpt ons enorm: [Google Review link]
We worden nu beoordeeld met een 4.9 door 500+ klanten
en daar zijn we best trots op! ⭐
```

**Stap 3 — Als negatieve reactie:**
- GEEN reviewverzoek sturen
- Direct escaleren naar klantenservice/eigenaar
- Probleem oplossen VOOR je om review vraagt

**Extra:** Stuur na 6 maanden een "hoe bevalt het?" bericht. Dit:
- Toont nazorg
- Genereert extra reviews
- Opent cross-sell mogelijkheden (bijv. klant heeft screens, bied rolluiken aan)

### MT-5: Segmentatie op Product en Prijsklasse

**Niet elke lead is hetzelfde.** Een rolluik-klant (hoger budget) heeft een ander traject nodig dan een voorraadscherm-klant.

**Segmentatie in HubSpot:**

| Segment | Producten | Gemiddeld budget | Aanpak |
|---------|-----------|-----------------|--------|
| Budget | Voorraadscherm | < €1.500 | Snelle beslissing, minder follow-ups nodig |
| Midden | Uitvalscherm, Raamdeco, Screens | €1.500-€3.000 | Standaard flow (6 belpogingen + nurture) |
| Premium | Knikarmscherm, Pergola, Markiezen | €3.000-€6.000+ | Meer persoonlijke aandacht, eventueel showroom-uitnodiging |
| Reparatie | Reparatie, Onderhoud | Variabel | Snelste reactie, servicebelofte benadrukken |

**Per segment andere:**
- Email templates
- WhatsApp berichten
- Follow-up frequentie
- Urgentie-boodschap

---

## LONG-TERM STRATEGIEEN (Doorlopend)

### LT-1: Volledige Multi-Channel Nurture Orchestratie

**Doel:** Geen enkele lead valt meer tussen wal en schip.

**Kanaal-mix per fase:**

```
FASE 1: Lead Binnenkomst (Dag 0)
├── Direct: Bevestigings-WhatsApp (automatisch)
├── < 5 min: Eerste belpoging (sales)
├── < 30 min: Prijsindicatie email (als al geconfigureerd)
└── < 2 uur: Tweede belpoging (als geen gehoor)

FASE 2: Activatie (Dag 1-7)
├── Belpogingen 3-6 (schema uit QW-2)
├── WhatsApp templates (roterend, context-specifiek)
├── Email: Extra informatie/inspiratie
└── Trigger: Bij reactie → direct inmeetafspraak plannen

FASE 3: Overweging (Dag 7-30)
├── Nurture emails (wekelijks)
├── WhatsApp check-in (dag 14, 28)
├── Retargeting ads (Google/Meta) ← NIEUW
└── Trigger: Bij engagement → terug naar Fase 2

FASE 4: Heractivatie (Dag 30-120)
├── Maandelijkse inspiratie-email
├── Seizoensgebonden WhatsApp
├── Retargeting ads (aangepaste boodschap)
└── Trigger: Bij engagement → terug naar Fase 2

FASE 5: Slapend (120+ dagen)
├── Kwartaal-nieuwsbrief
├── Seizoensgebonden campagnes (voorjaar/zomer)
└── Trigger: Bij engagement → terug naar Fase 3
```

### LT-2: Retargeting Ads voor Niet-Converterende Leads

**Leads die de configurator hebben gebruikt maar niet converteren = warmste retargeting audience.**

**Implementatie:**
1. Facebook/Meta Pixel op Reuzenpanda configurator
2. Google Ads remarketing tag
3. Custom audiences in Meta en Google:
   - "Configurator gebruikt, geen lead geworden" → Ad: "Nog niet zeker? Vraag gratis advies aan"
   - "Lead geworden, geen inmeetafspraak" → Ad: Social proof + gratis inmeten
   - "Offerte ontvangen, niet geconverteerd" → Ad: Urgentie + klantverhalen
4. Lookalike audiences op basis van geconverteerde klanten

**Budget suggestie:** Start met €10-15/dag retargeting, meet ROAS na 30 dagen.

### LT-3: Content Marketing voor Nurture

**Creeer content die leads warm houdt en expertise toont:**

**Content kalender (1x per 2 weken):**
- Voor-na foto's van projecten (Instagram + email)
- Klant-spotlights met video (30 sec, WhatsApp + social)
- Seizoenstips ("Zo bescherm je je terras tegen de zon", "Energiebesparing met screens")
- Productvergelijkingen ("Screens vs. rolluiken: wat past bij jou?")
- Backstage content (monteur aan het werk, team-intro)

**Gebruik in nurture:**
- Email nurture sequences vullen met deze content
- WhatsApp: deel korte video's/foto's
- Social media: bouwt organisch bereik op

### LT-4: Referral/Doorverwijzingsprogramma

**Jullie hebben 3000+ klanten. Dat is een leger aan ambassadeurs.**

**Geautomatiseerd referral programma:**

**Stap 1 (6 maanden na installatie):** WhatsApp:
```
Hoi [voornaam]! Al een half jaar genieten van je [product]!
Ken je iemand die ook interesse heeft in zonwering?
Voor elke doorverwijzing die tot een installatie leidt,
ontvang je een [beloning: bijv. €50 cadeaukaart / gratis onderhoud].
Stuur gewoon hun naam en nummer via deze chat! 🎁
```

**Stap 2:** Lead komt binnen als "Referral" in HubSpot → hogere prioriteit (referral leads converteren 3-5x beter).

**Stap 3:** Bij succesvolle installatie → bedank zowel de referrer als de nieuwe klant.

### LT-5: Seasonality-Based Campagnes

**Zonwering is seizoensgebonden. Speel hier strategisch op in.**

| Periode | Strategie |
|---------|-----------|
| Januari-Februari | "Early bird" campagne: bestel nu, montage voor de zomer. Lagere druk = snellere levertijden |
| Maart-April | Piek aanvragen. Focus op snelheid en capaciteit communiceren |
| Mei-Juni | Urgentie: "Nog voor de zomervakantie geplaatst!" |
| Juli-Augustus | Lagere vraag. Focus op reparatie/onderhoud + heractivatie oude leads |
| September-Oktober | Rolluiken/screens campagne: "Klaar voor de herfst/winter" + energiebesparing angle |
| November-December | Binnenzonwering / raamdeco / cadeautip campagnes |

### LT-6: Data-Gedreven Optimalisatie

**Meet alles, optimaliseer continu.**

**KPI's om te tracken in HubSpot:**

| KPI | Doel | Hoe meten |
|-----|------|-----------|
| Speed-to-lead | < 5 minuten | HubSpot: tijd tussen deal-creatie en eerste activiteit |
| Lead → Inmeetafspraak rate | > 40% | Deal stage conversie |
| Inmeetafspraak → Offerte rate | > 80% | Deal stage conversie |
| Offerte → Akkoord rate | > 50% | Deal stage conversie |
| Gemiddelde doorlooptijd | < 21 dagen (lead → akkoord) | Deal pipeline rapportage |
| WhatsApp response rate | > 30% | Trengo analytics |
| Review response rate | > 20% | Google Business vs. installaties |
| Kosten per acquisitie | Bijhouden per kanaal | Google/Meta ads + HubSpot |

---

## Implementatie Prioriteitenmatrix

| # | Actie | Impact | Moeite | Prioriteit |
|---|-------|--------|--------|------------|
| QW-1 | Speed-to-lead (5 min) | HOOG | Laag | 1 - DIRECT |
| QW-2 | 6 belpogingen schema | HOOG | Laag | 2 - DIRECT |
| QW-3 | WhatsApp templates verbeteren | HOOG | Laag | 3 - DIRECT |
| QW-4 | Social proof overal tonen | MIDDEN | Laag | 4 - DIRECT |
| MT-2 | Prijsindicatie email optimaliseren | HOOG | Midden | 5 |
| MT-3 | Post-inmeting sequence | HOOG | Midden | 6 |
| MT-1 | Long-term nurture flow | MIDDEN | Midden | 7 |
| MT-4 | Review-strategie automatiseren | MIDDEN | Laag | 8 |
| MT-5 | Segmentatie op product | MIDDEN | Midden | 9 |
| LT-2 | Retargeting ads | HOOG | Midden | 10 |
| LT-4 | Referral programma | MIDDEN | Midden | 11 |
| LT-5 | Seizoenscampagnes | MIDDEN | Hoog | 12 |
| LT-1 | Volledige orchestratie | HOOG | Hoog | 13 |
| LT-3 | Content marketing | MIDDEN | Hoog | 14 |
| LT-6 | Data-gedreven optimalisatie | HOOG | Doorlopend | Continu |

---

## Verwachte Impact

Op basis van de onderzoeksdata:

| Verbetering | Verwachte impact op conversie |
|-------------|-------------------------------|
| Speed-to-lead van 30min → 5min | +200-400% meer bereikte leads |
| 2 → 6 belpogingen | +300% meer contact (10% → 90%) |
| Betere WhatsApp templates | +15-25% hogere response rate |
| Social proof toevoegen | +15-20% hogere conversie |
| Nurture sequence (niet-reageerders) | +10-15% extra conversies (langere termijn) |
| Post-inmeting sequence | +10-20% offerte-acceptatie |
| Review automatisering | Behoud van 4.9 rating + groei naar 750+ reviews |

**Conservatieve schatting:** Als jullie huidige lead-to-klant conversie 15% is, kunnen deze verbeteringen dit naar 25-35% brengen. Bij 100 leads per maand = 10-20 extra klanten per maand.

---

## Technische Implementatie-Overzicht

| Wat | Waar | Hoe |
|-----|------|-----|
| Speed-to-lead notificatie | Zapier + Telegram | Nieuwe zap: HubSpot new deal → Telegram push |
| Auto-bevestiging WhatsApp | Zapier + Trengo | Nieuwe zap: HubSpot new deal → Trengo WhatsApp |
| 6-poging belschema | HubSpot Sequences | Sales sequence met taken + reminders |
| Verbeterde WhatsApp templates | Trengo | Templates updaten in Trengo |
| Nurture email flow | HubSpot Workflows | Workflow op deal stage "Niet Bereikt" |
| Post-inmeting sequence | HubSpot Workflows | Workflow op deal stage na inmeting |
| Review automatisering | Zapier + Trengo | ZAP-11 updaten met 2-staps flow |
| Retargeting | Google Ads + Meta Ads | Custom audiences op basis van HubSpot lijsten |
| Segmentatie | HubSpot | Custom properties + active lists per segment |

---

## Bronnen

- [Speed to Lead Statistics - LeadAngel](https://www.leadangel.com/blog/operations/speed-to-lead-statistics/)
- [Lead Response Time Study - Teamgate](https://www.teamgate.com/blog/lead-response-time-study-speed-impacts-revenue/)
- [Speed to Lead Response Time - Kixie](https://www.kixie.com/sales-blog/speed-to-lead-response-time-statistics-that-drive-conversions/)
- [400% More Conversions - LeadOwl](https://leadowl.com/blog/fast-lead-response-conversions/)
- [Best Time to Make Sales Call - HubSpot](https://blog.hubspot.com/sales/best-time-to-make-a-sales-call)
- [Optimum Time to Follow Up - Sherpa Group](https://www.thesherpagroup.com/blog/the-optimum-time-to-follow-up-leads)
- [Best Times for Cold Calling - UpLead](https://www.uplead.com/best-times-for-cold-calling/)
- [Home Builder Lead Conversion - Builder Lead Converter](https://www.builderleadconverter.com/blog/home-builder-lead-conversion-96-percent-failure/)
- [Lead Conversion for Remodelers](https://remodelersmarketingcrew.com/5-proven-tactics-for-lead-conversion-for-remodelers-turning-prospects-into-paying-clients/)
- [WhatsApp Marketing Guide 2026 - ActiveCampaign](https://www.activecampaign.com/blog/whatsapp-guide)
- [WhatsApp for Customer Service - Rabbit.nl](https://rabbit.nl/messenger/en/why-whatsapp-is-essential-for-customer-service-and-boosting-your-sales/)
- [WhatsApp Marketing Trends - Braze](https://www.braze.com/resources/articles/whatsapp-marketing)
- [WhatsApp Marketing Examples - Chatarmin](https://chatarmin.com/en/blog/whatsapp-marketing-examples)
- [Lead Nurturing Best Practices 2026 - The CMO](https://thecmo.com/managing-performance/lead-nuturing-best-practices/)
- [Lead Nurturing Drip Campaign 2026 - Prospeo](https://prospeo.io/s/lead-nurturing-drip-campaign)
- [Dead Leads Strategy - Repitch](https://repitch.ai/post/dead-leads-strategy)
- [Social Proof Statistics 2026 - WiserNotify](https://wisernotify.com/blog/social-proof-statistics/)
- [Google Reviews & SEO - Search Engine Land](https://searchengineland.com/guide/how-to-win-at-google-reviews)
- [Social Proof to Increase Conversions - StoryChief](https://storychief.io/blog/social-proof-boost-conversions)
- [Zonwering Leads - De Klantenwerving](https://www.deklantenwerving.nl/zonwering/)
- [Leadgeneratie Zonwering - Gigaleads](https://giga-leads.webflow.io/sector/zonwering-en-zon-luiken)

---

## PREMIUM PRICING STRATEGIE (Sonty-specifiek)

> **Kernprobleem:** Sonty verkoopt hogere kwaliteit producten en is daardoor vaak duurder. Klanten vragen tegenwoordig 4-5 offertes online aan. Hoe win je als je niet de goedkoopste bent?

### De realiteit: prijs is NIET de #1 reden waarom mensen kiezen

Uit onderzoek in de woningverbetering-sector:
- **68%** van de klanten kiest NIET de goedkoopste offerte
- **73%** zegt dat vertrouwen belangrijker is dan prijs
- **89%** leest reviews voordat ze een bedrijf kiezen
- De klant die puur op prijs koopt, is vaak de slechtste klant (meer klachten, minder tevreden)

### Strategie 1: EERSTE zijn (Speed-to-Lead)

**Waarom dit cruciaal is bij 4-5 offertes:**
Het bedrijf dat EERST belt, heeft een enorm voordeel:
- 78% van de klanten kiest het eerste bedrijf dat professioneel reageert
- Als jij belt terwijl de concurrent nog moet reageren, heb je al vertrouwen opgebouwd
- De klant vergelijkt de andere 3-4 offertes met JOU als benchmark

**Implementatie:** ZAP-01 trigger → Telegram notificatie → bel binnen 5 minuten

### Strategie 2: WAARDE verkopen, niet prijs

**In elk contactmoment (email, WhatsApp, telefoon) benadrukken:**

1. **Garantie**: "Bij Sonty krijg je X jaar garantie op product EN installatie"
2. **Vakmanschap**: "Onze monteurs zijn gecertificeerd en hebben gem. 10+ jaar ervaring"
3. **Sunmaster Premium Dealer**: Dit is een keurmerk — gebruik het actief!
4. **Eén aanspreekpunt**: "Van advies tot installatie, je hebt altijd dezelfde contactpersoon"
5. **3000+ tevreden klanten, 4.9 Google rating**: Dé ultieme social proof

**Concrete tekst voor de prijsindicatie email:**
```
Waarom klanten voor Sonty kiezen:
✓ Sunmaster Premium Dealer 2022-2024
✓ 4.9/5.0 beoordeling (500+ Google reviews)
✓ Professionele installatie door gecertificeerde monteurs
✓ X jaar garantie op product én installatie
✓ Persoonlijk advies en gratis opmeting bij jou thuis
```

### Strategie 3: De "Appels met Peren" Aanpak

**Probleem:** Klanten vergelijken jouw offerte 1-op-1 met de concurrent, maar het is geen eerlijke vergelijking.

**Oplossing:** Maak in je offerte en gesprekken EXPLICIET duidelijk wat het verschil is:

| | Sonty | Gemiddelde concurrent |
|---|---|---|
| Product | A-merk (Sunmaster) | Huismerk / budget |
| Garantie | X jaar | 1-2 jaar |
| Installatie | Door eigen team | Onderaannemers |
| Opmeting | Gratis, door specialist | Soms extra kosten |
| After-service | Eigen servicedienst | Lastig bereikbaar |
| Reviews | 4.9 / 500+ reviews | Onbekend |

**Automatiseerbaar:** Voeg een "Waarom Sonty?" sectie toe aan de offerte-email (mail 03) en de offerte-herinnering (mail 04).

### Strategie 4: De "Mismatch Filter"

**Niet elke lead is jouw klant.** Budget-leads kosten tijd en converteren niet.

**Implementatie:**
- Reuzenpanda configurator: voeg een vraag toe over budget-verwachting
- In het eerste telefoongesprek: peil de verwachtingen ("Waar zit je qua budget?")
- Score leads in HubSpot: voeg een `lead_kwaliteit` property toe (warm/koud/budget)
- Focus je follow-up energie op warme leads

### Strategie 5: Social Proof op ALLE Touchpoints

Met 4.9/5.0 en 500+ reviews heb je goud in handen. Gebruik het:

| Touchpoint | Social proof element |
|---|---|
| Prijsindicatie email | "Sluit je aan bij 3000+ tevreden klanten" + rating badge |
| WhatsApp berichten | "4.9★ op Google (500+ reviews)" in handtekening |
| Offerte | Reviews/testimonials van vergelijkbaar product |
| Website | Review widget, case studies met foto's |
| Opmeting | Monteur laat tablet zien met reviews |
| Wachtperiode | Stuur klant een relevante case study/foto |

### Strategie 6: Urgentie zonder Druk

**Methoden die werken voor premium:**
- "Onze agenda voor opmetingen loopt snel vol — wil je alvast een datum prikken?"
- "De huidige levertijd voor [product] is X weken. Als je voor [datum] beslist, kan het voor de zomer geïnstalleerd zijn"
- Seizoensgebonden: "Maart-mei is het drukste seizoen voor zonwering. Vroeg beslissen = sneller genieten"
- NOOIT: "Alleen vandaag geldig!" of harde druk — dat past niet bij premium

### Strategie 7: De Follow-up Sequence na Offerte

Dit is waar de meeste deals verloren gaan. De klant heeft 4-5 offertes en moet kiezen.

**Dag 0:** Offerte verstuurd + direct WhatsApp: "Offerte staat klaar! Vragen? App gerust"
**Dag 2:** WhatsApp: "Hoi [naam], heb je de offerte kunnen bekijken? Ik help graag met eventuele vragen"
**Dag 5:** Email met een relevant klantverhaal/case study van hetzelfde product
**Dag 7:** Bel: "Hoe gaat het met je beslissing? Kan ik ergens bij helpen?"
**Dag 10:** WhatsApp herinnering: "De offerte is nog geldig t/m [datum]. Zullen we even bellen?"
**Dag 14:** Laatste WhatsApp: "We houden je plek in de agenda vrij t/m [datum]. Laat je het weten?"

**Automatiseerbaar via HubSpot workflows + Trengo/Zapier**

### Implementatie Prioriteiten

1. **NU:** WhatsApp knop in alle emails (DONE ✅)
2. **NU:** "Waarom Sonty?" sectie in offerte emails
3. **Week 1:** Speed-to-lead < 5 min (Telegram notificatie bij nieuwe lead)
4. **Week 1:** Social proof toevoegen aan alle emails
5. **Week 2:** Post-offerte follow-up sequence bouwen
6. **Week 2:** Lead kwaliteit scoring in HubSpot
7. **Week 3:** Vergelijkingstabel in offerte-template

---

## SALES FILOSOFIE — Overtuigen, Niet Pushen

> **Kernfilosofie (Daimy):** "Het gaat om MEEDENKEN en OVERLEGGEN met de klant. Klanten moeten voor Sonty KIEZEN, niet onder druk gezet worden. We verkopen premium kwaliteit en dat mag iets kosten — maar we moeten het wél uitleggen."

### Het verschil tussen pushen en overtuigen

| Pushen (NIET doen) | Overtuigen (WEL doen) |
|---|---|
| "Deze prijs geldt alleen vandaag" | "Ik wil je graag uitleggen wat je voor dit bedrag krijgt" |
| "Je maakt een fout als je dit niet doet" | "Veel klanten in jouw situatie kozen voor..." |
| Herhaaldelijk bellen zonder waarde toe te voegen | Elk contactmoment geeft nieuwe informatie of hulp |
| Direct korting bieden om de deal te sluiten | Eerst waarde uitleggen, korting alleen als allerlaatste optie |
| De concurrent afkraken | Eerlijk het verschil uitleggen (appels en peren) |
| Druk zetten op een deadline | Informeren over levertijden en planning als service |

**De Sonty-regel:** Als een klant het gevoel heeft dat je pusht, heb je al verloren. Premium klanten willen serieus genomen worden en het gevoel hebben dat ze zelf de keuze maken.

### Concrete gesprekstechnieken voor telefonisch contact

#### Techniek 1: De Adviseur-Positie
Positioneer jezelf als adviseur, niet als verkoper. Je helpt de klant de beste keuze te maken — ook als dat betekent dat Sonty niet de juiste match is.

**Opening van het gesprek:**
```
"Hoi [voornaam], je spreekt met [naam] van Sonty. Je hebt een aanvraag
gedaan voor [product]. Ik wil graag even met je meedenken over wat de
beste oplossing is voor jouw situatie. Heb je daar even tijd voor?"
```

**Waarom dit werkt:** Je vraagt toestemming, je zegt "meedenken" (niet "verkopen"), en je stelt de klant centraal.

#### Techniek 2: Vragen Stellen, Niet Vertellen
Stel eerst vragen voordat je begint over prijs of product. Laat de klant praten.

**Goede vragen:**
- "Wat is de aanleiding dat je nu naar [product] kijkt?"
- "Waar let je op bij het kiezen van een leverancier?"
- "Heb je al eerder zonwering laten plaatsen? Hoe was die ervaring?"
- "Zijn er specifieke dingen waar je tegenaan loopt, bijvoorbeeld warmte of inkijk?"
- "Heb je al een idee van wat je zoekt qua bediening — elektrisch of handmatig?"

**Waarom dit werkt:** Je begrijpt de klant beter, kunt gerichter adviseren, en de klant voelt zich gehoord.

#### Techniek 3: Samenvatten en Bevestigen
Na het luisteren, vat je samen wat je hebt gehoord. Dit bouwt vertrouwen op.

```
"Dus als ik het goed begrijp: jullie hebben last van de warmte aan de
achterkant van het huis, het zijn grote ramen, en je wilt graag iets
dat er strak uitziet en elektrisch bediend wordt. Klopt dat?"
```

#### Techniek 4: Proactief Bezwaren Benoemen
Neem bezwaren weg voordat de klant ze uitspreekt.

```
"Ik weet dat je waarschijnlijk meerdere offertes opvraagt — dat is heel
slim. Wat ik je alvast wil meegeven: er zijn grote kwaliteitsverschillen
in de markt. Niet alle screens zijn hetzelfde. Wij werken uitsluitend
met Sunmaster, dat is het topmerk in Nederland. Dat zie je terug in de
levensduur en garantie."
```

### Hoe je omgaat met "Jullie zijn te duur"

Dit is het vaakst voorkomende bezwaar. De reactie is CRUCIAAL en gaat in fases:

#### Fase 1: Erkennen en doorvragen (NOOIT direct verdedigen)

```
"Dat snap ik, het is een flinke investering. Mag ik vragen: waar
vergelijk je mee? Heb je al een andere offerte ontvangen?"
```

**Waarom:** Je moet weten WAT de klant vergelijkt. Vaak is het appels met peren.

#### Fase 2: Het verschil uitleggen (de kern)

Als de klant een concurrerende offerte heeft:
```
"Ik begrijp dat de prijs hoger lijkt. Laat me even uitleggen wat het
verschil is. Wij gebruiken Sunmaster — dat is het premium merk in
Nederland. Dat betekent:
- [X] jaar garantie in plaats van 1-2 jaar
- Professionele installatie door ons eigen team, geen onderaannemers
- Eigen servicedienst: als er ooit iets is, staan wij voor je klaar
- 500+ klanten geven ons een 4.9 op Google — daar zijn we best trots op

Het is een beetje als het verschil tussen een Volkswagen en een Dacia.
Allebei brengen je van A naar B, maar de ervaring en levensduur zijn
heel anders."
```

#### Fase 3: De "per dag" berekening

```
"Als je kijkt naar de levensduur: dit product gaat 15-20 jaar mee.
Het verschil met een goedkoper alternatief is misschien €500.
Dat is minder dan 10 cent per dag. En dan heb je wel een product
waar je écht tevreden mee bent."
```

#### Fase 4: De €100 korting (ALLEEN als laatste redmiddel)

**Regels voor de korting:**
- NOOIT direct aanbieden bij het eerste "te duur" bezwaar
- NOOIT als openingszet of lokkertje gebruiken
- ALLEEN nadat je de waarde hebt uitgelegd EN de klant nog twijfelt
- Presenteer het als een persoonlijk gebaar, niet als standaardkorting
- Maximaal €100, niet meer

**Script voor het aanbieden:**
```
"Kijk, ik merk dat je echt enthousiast bent over het product maar dat
de prijs je nog tegenhoudt. Ik kan je het volgende aanbieden: ik kan
éénmalig €100 van de prijs afhalen als goodwill. Dat is niet iets wat
we standaard doen, maar ik wil je graag helpen. Dan zitten we op
[nieuw bedrag]. Wat vind je daarvan?"
```

**Als de klant meer korting vraagt:**
```
"Ik begrijp het, maar dit is echt het maximale wat ik kan doen. We
werken met vaste prijzen omdat we bewust kiezen voor kwaliteit. Als we
verder gaan zakken, dan gaat dat ten koste van de kwaliteit of de
service, en dat willen we niet. Niet voor ons, maar ook niet voor jou."
```

### Scripts voor veelvoorkomende situaties

#### Situatie 1: Klant heeft nog geen andere offertes

```
"Top, dan wil ik je graag goed informeren zodat je straks goed kunt
vergelijken. Let bij andere partijen vooral op: welk merk gebruiken ze?
Hoeveel jaar garantie geven ze? Werken ze met eigen monteurs of
onderaannemers? En hoe bereikbaar zijn ze na de installatie?
Dat zijn de dingen die het verschil maken."
```

**Waarom slim:** Je stuurt de klant om op JOUW sterke punten te letten bij de concurrent.

#### Situatie 2: Klant wil "er nog even over nadenken"

```
"Heel begrijpelijk, het is ook een beslissing die je goed wilt maken.
Wat ik je aanraad: neem er rustig de tijd voor. Ik stuur je een
WhatsApp met een samenvatting van wat we besproken hebben. Mocht je
vragen hebben, je kunt me altijd appen of bellen. Wanneer zou het
handig zijn als ik nog even contact met je opneem?"
```

**Waarom slim:** Je geeft ruimte (niet pushen), maar plant WEL een vervolgmoment.

#### Situatie 3: Klant vergelijkt met heel goedkope aanbieder

```
"Ik ken die partij / dat soort aanbiedingen. Kijk, er zijn bedrijven
die voor een lagere prijs kunnen werken — daar zijn redenen voor.
Vaak werken ze met goedkopere materialen of onderaannemers. Wat ik
je aanraad: vraag naar het merk, de garantievoorwaarden, en wie de
installatie doet. En check vooral hun reviews. Dan kun je een eerlijke
vergelijking maken. Ik denk dat je dan ziet waar het verschil zit."
```

#### Situatie 4: Klant zegt "ik ga voor de goedkoopste"

```
"Dat is helemaal je goed recht, en ik snap dat budget belangrijk is.
Ik wil je alleen meegeven: bij zonwering merk je het kwaliteitsverschil
pas na een paar jaar. En dan zit je eraan vast. Onze klanten zeggen
heel vaak achteraf: 'gelukkig dat we niet bezuinigd hebben.' Maar het
is jouw keuze, en welke keuze je ook maakt — ik wens je er veel plezier
mee!"
```

**Waarom slim:** Je bent respectvol, geeft een waarschuwing zonder te dreigen, en laat de deur open.

#### Situatie 5: Klant belt TERUG na eerder "nee"

```
"Leuk dat je terugbelt! Geen probleem dat het even heeft geduurd,
zoiets moet je op je eigen tempo beslissen. Laat me even kijken naar
je aanvraag... [check gegevens]. Is er iets veranderd in je situatie
of heb je nog nieuwe vragen?"
```

### Dagelijkse Sales Mindset

**Voor elk telefoongesprek, onthoud:**
1. Je bent een ADVISEUR, geen verkoper
2. Je doel is de klant HELPEN de juiste keuze te maken
3. Als de klant niet bij Sonty past (puur budget-koper), is dat ook oké
4. Elk "nee" is informatie — vraag WAAROM en leer ervan
5. Je verkoopt geen zonwering, je verkoopt **comfort, gemak en zekerheid**
6. Een tevreden klant stuurt 2-3 mensen door. Een gepushte klant schrijft een slechte review

**Het ultieme doel:** De klant zegt na de installatie: "Ik ben zo blij dat ik voor Sonty gekozen heb."
