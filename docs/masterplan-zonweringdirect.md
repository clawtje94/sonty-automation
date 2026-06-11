# Masterplan ZonweringDirect
## Van 0 naar Top 10 Webshop Nederland -- 1 Persoon + 1 AI

*Datum: 1 april 2026*
*Versie: 1.0*
*Doel: ZonweringDirect wordt een bekroonde, AI-gestuurde webshop die niemand van een "echt bedrijf" kan onderscheiden.*

---

## Inhoudsopgave

1. [Executive Summary](#executive-summary)
2. [Uitgangspositie](#uitgangspositie)
3. [Software Stack & Kosten](#software-stack--kosten)
4. [FASE 0: Fundament (Week 1-2)](#fase-0-fundament-week-1-2)
5. [FASE 1: Operationeel (Week 3-4)](#fase-1-operationeel-week-3-4)
6. [FASE 2: AI Klantenservice (Week 5-8)](#fase-2-ai-klantenservice-week-5-8)
7. [FASE 3: Marketing Launch (Week 9-12)](#fase-3-marketing-launch-week-9-12)
8. [FASE 4: Reviews & Trust (Week 13-20)](#fase-4-reviews--trust-week-13-20)
9. [FASE 5: Awards & Top 10 (Week 21-30)](#fase-5-awards--top-10-week-21-30)
10. [FASE 6: The Reveal](#fase-6-the-reveal)
11. [Risico's & Mitigatie](#risicos--mitigatie)
12. [Week-per-week Roadmap](#week-per-week-roadmap)

---

## Executive Summary

**De ambitie:** ZonweringDirect wordt een top 10 Nederlandse webshop, volledig gerund door 1 persoon (Daimy) en 1 AI (Claude). Niemand weet dat het AI-gestuurd is totdat we het onthullen -- na het winnen van webshop awards.

**Het verhaal:** "Wij laten zien dat 1 ondernemer met AI een complete, bekroonde webshop kan runnen. Geen team van 50 man. Geen miljoenen investering. Gewoon slimmer werken."

**De markt:** EUR 1,2 miljard raambekleding in NL, 8% online (13% bij <50 jaar). Gat van 24 procentpunt t.o.v. NL e-commerce gemiddelde (32%). Bewezen model: Zonwering-fabriek haalt miljoenenomzet in 2,5 jaar.

**De tijdlijn:** 30 weken van fundament tot award-nominatie. Reveal na eerste award-winst.

**Geschatte totale investering (30 weken):** EUR 15.000-25.000 (software + ads + registraties)

---

## Uitgangspositie

### Wat er al staat

| Component | Status | Detail |
|-----------|--------|--------|
| Webshop | Live (staging) | Next.js op Vercel (zonweringdirect.vercel.app) |
| Database | Werkend | Supabase, 8 tabellen |
| Pricing engine | Werkend | Sunmaster configurator met live prijzen |
| Productfoto's | 81 stuks | Echte foto's, bruikbaar |
| AI ad pipeline | Gebouwd | Flux Pro beeldgeneratie, ElevenLabs voice clone, Sharp templates |
| SEO | Basis | Organization, Product, FAQ, Review schemas |
| Reviews | Placeholder | 537 reviews -- NIET echt, moet vervangen worden |
| Brand | Gedefinieerd | Orange #F97316 + navy #0F172A, Inter + Space Grotesk |
| Repo | GitHub | clawtje94/zonweringdirect |

### Wat er NIET staat

| Gap | Impact | Fase |
|-----|--------|------|
| Mollie betalingen | Kan niet verkopen | FASE 0 |
| Marge op Sunmaster prijzen | Verkoop = verlies | FASE 0 |
| Domein zonweringdirect.nl | Niet professioneel | FASE 0 |
| Vercel env vars | Site werkt niet in productie | FASE 0 |
| KvK/BTW registratie | Illegaal verkopen | FASE 0 |
| Sunmaster bestelflow | Kan niet leveren | FASE 1 |
| Verzending/tracking | Klant weet niks | FASE 1 |
| Facturatie/boekhouding | Geen administratie | FASE 1 |
| AI klantenservice | Geen support | FASE 2 |
| Ads | Geen traffic | FASE 3 |
| Echte reviews | Geen vertrouwen | FASE 4 |
| Award registraties | Geen erkenning | FASE 5 |

---

## Software Stack & Kosten

### Kernstack (Must-haves)

| Tool | Functie | Maandelijks | Claude via API? | Fase |
|------|---------|-------------|-----------------|------|
| **Vercel** | Hosting Next.js | EUR 0 (Hobby) / EUR 20 (Pro) | Ja (CLI + API) | 0 |
| **Supabase** | Database + Auth | EUR 0 (Free) / EUR 25 (Pro) | Ja (REST + JS SDK) | 0 |
| **Mollie** | Betalingen (iDEAL, CC, etc.) | EUR 0 vast + ~1,2% per tx | Ja (REST API) | 0 |
| **Domein zonweringdirect.nl** | Domein | EUR 10/jaar | Nee (eenmalig) | 0 |
| **Moneybird** | Facturatie + boekhouding | EUR 16,95/mnd (Boekhoudpakket) | Ja (REST API) | 0 |
| **SendGrid / Resend** | Transactionele email | EUR 0-20/mnd | Ja (API) | 0 |
| **Sunmaster** | Leverancier/pricing | Via dealer account | Deels (prijzen API) | 0 |

**Subtotaal FASE 0: EUR 45-85/mnd + EUR 10/jaar domein**

### Communicatie & AI (FASE 2)

| Tool | Functie | Maandelijks | Claude via API? | Prioriteit |
|------|---------|-------------|-----------------|------------|
| **Trengo** | WhatsApp Business + chat + email | EUR 125/mnd (Boost) | Ja (REST API) | Must-have |
| **Claude API (Anthropic)** | AI brein voor alles | EUR 50-150/mnd (usage) | -- | Must-have |
| **ElevenLabs** | Voice clone voor telefoon | EUR 22/mnd (Creator) | Ja (API) | Nice-to-have |
| **Twilio** | Telefoon/SMS fallback | ~EUR 30/mnd | Ja (API) | Nice-to-have |

**Subtotaal FASE 2: EUR 175-330/mnd**

### Marketing (FASE 3)

| Tool | Functie | Maandelijks | Claude via API? | Prioriteit |
|------|---------|-------------|-----------------|------------|
| **Google Ads** | Zoekadvertenties + Shopping | EUR 1.500-5.000/mnd | Ja (Ads API) | Must-have |
| **Meta Ads** | Instagram + Facebook ads | EUR 500-2.000/mnd | Ja (Marketing API) | Must-have |
| **Klaviyo** | Email marketing flows | EUR 0-45/mnd | Ja (API) | Must-have |
| **Plausible** | Privacy-first analytics | EUR 9/mnd | Ja (API) | Must-have |
| **PostHog** | Product analytics + heatmaps | EUR 0 (free tier) | Ja (API) | Nice-to-have |
| **Google Search Console** | SEO monitoring | EUR 0 | Ja (API) | Must-have |
| **Canva Pro** | Social media content | EUR 12/mnd | Deels (API beperkt) | Nice-to-have |
| **Flux Pro (Replicate)** | AI productfoto's | ~EUR 20/mnd | Ja (API) | Nice-to-have |

**Subtotaal FASE 3: EUR 2.040-7.085/mnd**

### Reviews & Trust (FASE 4)

| Tool | Functie | Maandelijks | Claude via API? | Prioriteit |
|------|---------|-------------|-----------------|------------|
| **Kiyoh** | Review platform NL | EUR 49/mnd (Starter) | Ja (API) | Must-have |
| **WebwinkelKeur** | Keurmerk + reviews | EUR 34,95/mnd | Beperkt | Must-have |
| **Trustpilot** | Internationaal reviews | EUR 0 (free) / EUR 199 (Standard) | Ja (API) | Nice-to-have |
| **Google Business Profile** | Google Reviews | EUR 0 | Ja (API) | Must-have |

**Subtotaal FASE 4: EUR 84-283/mnd**

### Totaaloverzicht kosten per fase

| Fase | Periode | Software/mnd | Ads/mnd | Eenmalig | Totaal fase |
|------|---------|-------------|---------|----------|-------------|
| FASE 0 | Week 1-2 | EUR 85 | EUR 0 | EUR 200* | EUR 370 |
| FASE 1 | Week 3-4 | EUR 85 | EUR 0 | EUR 0 | EUR 170 |
| FASE 2 | Week 5-8 | EUR 300 | EUR 0 | EUR 0 | EUR 1.200 |
| FASE 3 | Week 9-12 | EUR 350 | EUR 3.000 | EUR 0 | EUR 13.400 |
| FASE 4 | Week 13-20 | EUR 450 | EUR 4.000 | EUR 500** | EUR 17.800 |
| FASE 5 | Week 21-30 | EUR 450 | EUR 5.000 | EUR 2.000*** | EUR 27.250 |
| **TOTAAL** | **30 weken** | | | | **EUR 60.190** |

*\* KvK, domein, Mollie setup*
*\*\* Kiyoh + WebwinkelKeur setup*
*\*\*\* Award inschrijvingen*

> **Let op:** Advertentiebudget is schaalbaar. Start kleiner (EUR 1.000/mnd) en schaal op bij positieve ROAS. De software-kosten zijn relatief laag (EUR 300-450/mnd) -- het verschil maakt het advertentiebudget.

---

## FASE 0: Fundament (Week 1-2)

> **Doel:** Alles wat nodig is voordat de eerste echte order kan binnenkomen.

### Afhankelijkheden
- Geen -- dit is het startpunt.

### Week 1: Juridisch & Financieel

#### 0.1 KvK-registratie
| | Detail |
|--|--------|
| **Wat** | ZonweringDirect registreren als eenmanszaak of BV bij KvK |
| **Wie** | Daimy |
| **Deliverable** | KvK-nummer + BTW-nummer |
| **Kosten** | EUR 75 (KvK) |
| **Opmerking** | Eenmanszaak is snelst. BV later overwegen bij omzet >EUR 100k. Kan eventueel onder bestaande Sonty BV als handelsnaam. |

#### 0.2 Domein zonweringdirect.nl
| | Detail |
|--|--------|
| **Wat** | Domein registreren en koppelen aan Vercel |
| **Wie** | Daimy (registratie) + Claude (DNS config) |
| **Deliverable** | zonweringdirect.nl live op Vercel met SSL |
| **Kosten** | EUR 10/jaar |
| **Stappen** | 1. Registreer bij TransIP/Hostnet. 2. Voeg domein toe in Vercel. 3. Stel DNS records in (A + CNAME). 4. Wacht op SSL propagatie. |

#### 0.3 Mollie account + integratie
| | Detail |
|--|--------|
| **Wat** | Mollie betalingen activeren |
| **Wie** | Daimy (account aanmaken + verificatie) + Claude (API integratie) |
| **Deliverable** | Werkende checkout met iDEAL, creditcard, Bancontact, Apple Pay |
| **Kosten** | EUR 0 vast, ~EUR 0,29 per iDEAL transactie |
| **Stappen** | 1. Mollie account aanmaken (mollie.com). 2. KvK + bankrekening koppelen. 3. Verificatie doorlopen (~1-3 werkdagen). 4. API key genereren (test + live). 5. Claude integreert Mollie in Next.js checkout. 6. Test met iDEAL sandbox. 7. Go live. |

#### 0.4 Moneybird boekhouding
| | Detail |
|--|--------|
| **Wat** | Automatische facturatie + BTW-aangifte |
| **Wie** | Daimy (account) + Claude (API koppeling) |
| **Deliverable** | Automatische factuur bij elke order, BTW-overzicht |
| **Kosten** | EUR 16,95/mnd |
| **Stappen** | 1. Moneybird account aanmaken. 2. Bedrijfsgegevens + KvK invullen. 3. API token genereren. 4. Claude bouwt: order webhook -> Moneybird factuur. 5. Factuur automatisch per email naar klant. |

#### 0.5 Algemene voorwaarden + juridisch
| | Detail |
|--|--------|
| **Wat** | Wettelijk verplichte webshop-documenten |
| **Wie** | Claude (opstellen) + Daimy (goedkeuren) |
| **Deliverables** | 1. Algemene voorwaarden. 2. Privacyverklaring (AVG). 3. Cookiebeleid. 4. Retourbeleid (14 dagen bedenktijd -- NB: maatwerk is uitgezonderd!). 5. Klachtenprocedure. |
| **Kosten** | EUR 0 (Claude stelt op conform NL wetgeving) |
| **Let op** | Maatwerk zonwering valt onder uitzondering herroepingsrecht (art. 6:230p BW lid 3 sub c). Dit MOET duidelijk vermeld worden in voorwaarden EN tijdens checkout. |

### Week 2: Pricing & Productie-readiness

#### 0.6 Marge op Sunmaster prijzen
| | Detail |
|--|--------|
| **Wat** | Verkoopprijzen berekenen met gezonde marge |
| **Wie** | Daimy (margebeslissing) + Claude (implementatie) |
| **Deliverable** | Prijsformule met marge, geimplementeerd in pricing engine |
| **Aanbeveling marge** | |

```
Margestrategie:

Inkoop (Sunmaster)  + Marge %   = Verkoopprijs excl. BTW  + 21% BTW = Consumentenprijs
EUR 200             + 35%       = EUR 270                  + BTW     = EUR 326,70
EUR 500             + 30%       = EUR 650                  + BTW     = EUR 786,50
EUR 1.000           + 25%       = EUR 1.250                + BTW     = EUR 1.512,50

Staffelkorting:
- 1 product:    0% korting
- 2 producten:  3% korting
- 3+ producten: 5% korting
- 5+ producten: 8% korting (projectprijs)

Concurrentiebenchmark:
- Zonwering-fabriek: eigen fabriek = lagere inkoopprijzen maar GEEN service
- ZonweringDirect: hogere inkoop maar BETERE service + UX = rechtvaardiging hogere prijs
- Positionering: kwaliteitssegment (niet budget, niet premium)
```

| **Stappen** | 1. Daimy beslist over marge-percentages per productcategorie. 2. Claude past de pricing engine aan: Sunmaster inkoopprijs x margemultiplier. 3. Concurrentiecheck: zijn de prijzen marktconform? 4. Staffelkorting implementeren in winkelwagen. |

#### 0.7 Vercel productie-configuratie
| | Detail |
|--|--------|
| **Wat** | Environment variables instellen voor productie |
| **Wie** | Claude |
| **Deliverable** | Productie-build werkt op zonweringdirect.nl |
| **Stappen** | 1. Vercel environment variables instellen (Supabase URL, Mollie API key, etc.). 2. Build testen op preview branch. 3. Custom domain instellen. 4. Productie deploy. |

#### 0.8 Verwijder placeholder reviews
| | Detail |
|--|--------|
| **Wat** | 537 nep-reviews verwijderen, lege state tonen |
| **Wie** | Claude |
| **Deliverable** | Webshop zonder nep-reviews, met tekst "Nog geen reviews -- wees de eerste!" |
| **Belangrijk** | Nep-reviews zijn illegaal onder de EU Omnibus Directive. Verwijder ze VOOR go-live. |

#### 0.9 Essentials checklist voor go-live
| | Detail |
|--|--------|
| **Wat** | Laatste controle voor eerste echte order |
| **Wie** | Claude + Daimy |
| **Checklist** | |

```
Technisch:
[ ] Domein live met SSL
[ ] Mollie live mode actief
[ ] Checkout flow werkt end-to-end (config -> cart -> betaling -> bevestiging)
[ ] Transactionele emails werken (orderbevestiging, betaalbevestiging, verzendbevestiging)
[ ] Supabase productie-database (niet staging!)
[ ] Error monitoring (Sentry) actief
[ ] GDPR cookie consent banner

Juridisch:
[ ] KvK-nummer op website
[ ] BTW-nummer op website
[ ] Algemene voorwaarden pagina
[ ] Privacyverklaring pagina
[ ] Retourbeleid pagina (maatwerk uitzondering!)
[ ] Contactgegevens duidelijk zichtbaar (adres, email, telefoon)

Financieel:
[ ] Marge op alle producten
[ ] Factuurautomatisering werkt
[ ] Bankrekening gekoppeld aan Mollie
```

### FASE 0 -- Kostenopsomming

| Item | Eenmalig | Maandelijks |
|------|----------|-------------|
| KvK registratie | EUR 75 | -- |
| Domein zonweringdirect.nl | EUR 10/jaar | -- |
| Vercel Pro | -- | EUR 20 |
| Supabase Pro | -- | EUR 25 |
| Moneybird | -- | EUR 16,95 |
| Mollie | -- | EUR 0 + tx fees |
| Resend (email) | -- | EUR 0 (free tier) |
| **Totaal FASE 0** | **EUR 85** | **EUR 62/mnd** |

---

## FASE 1: Operationeel (Week 3-4)

> **Doel:** De eerste echte order kan geplaatst, geproduceerd, verzonden en gefactureerd worden.

### Afhankelijkheden
- FASE 0 volledig afgerond (Mollie live, marge ingesteld, domein actief)

### 1.1 Sunmaster bestelflow
| | Detail |
|--|--------|
| **Wat** | Proces voor het doorplaatsen van orders bij Sunmaster |
| **Wie** | Daimy (contact Sunmaster) + Claude (automatisering) |
| **Deliverable** | Werkend proces: klant bestelt -> ZonweringDirect plaatst order bij Sunmaster |

**Opties voor bestelflow:**

| Optie | Beschrijving | Automatiseerbaar? | Aanbeveling |
|-------|-------------|-------------------|-------------|
| A. Handmatig | Daimy plaatst elke order handmatig in Sunmaster portal | Nee | Start hiermee |
| B. Email-order | Gestandaardiseerde email naar Sunmaster per order | Deels | Week 5+ |
| C. API | Directe API-koppeling met Sunmaster systeem | Volledig | Als Sunmaster dit aanbiedt |
| D. Portal scraping | Claude vult Sunmaster portal in via automatisering | Volledig | Fallback als geen API |

**Aanbeveling:** Start met Optie A (handmatig) om het proces te begrijpen. Bouw naar B of C zodra volume toeneemt (>5 orders/week).

**Stappen:**
1. Daimy vraagt Sunmaster: "Hoe kan ik orders het snelst doorplaatsen? Is er een API of email-template?"
2. Documenteer het bestelproces stap-voor-stap.
3. Claude bouwt een order-detail pagina in admin dashboard (alle info die Sunmaster nodig heeft in 1 overzicht).
4. Bij >5 orders/week: automatiseer naar email-order of API.

### 1.2 Verzending & tracking
| | Detail |
|--|--------|
| **Wat** | Producten van Sunmaster naar klant, met tracking |
| **Wie** | Daimy (afspraken met Sunmaster/vervoerder) + Claude (tracking integratie) |
| **Deliverable** | Klant ontvangt track & trace bij verzending |

**Scenario's:**

| Scenario | Beschrijving | Voorkeur |
|----------|-------------|----------|
| **Sunmaster levert direct** | Sunmaster verzendt rechtstreeks naar klant (dropshipping) | Ideaal |
| **Via ZonweringDirect** | Sunmaster levert bij Daimy, Daimy verzendt door | Niet schaalbaar |
| **Via vervoerder** | GLS/DPD/PostNL haalt op bij Sunmaster, levert bij klant | Goed alternatief |

**Stappen:**
1. Daimy vraagt Sunmaster: "Kunnen jullie direct naar mijn klanten verzenden? Zo ja, wat kost dit?"
2. Als dropshipping: Claude integreert tracking-webhook van vervoerder.
3. Klant ontvangt automatisch email: "Je bestelling is onderweg! Track hier: [link]"
4. WhatsApp notificatie (later, FASE 2): statusupdate via Trengo.

### 1.3 Admin dashboard
| | Detail |
|--|--------|
| **Wat** | Intern dashboard voor orderbeheer |
| **Wie** | Claude |
| **Deliverable** | Admin pagina met: alle orders, status per order, klantgegevens, Sunmaster bestelinfo |

**Features:**
- Orderoverzicht (nieuw, in productie, verzonden, afgeleverd)
- Per order: klantdata, productconfig, afmetingen, kleur, prijs
- Status wijzigen (handmatig -> later automatisch)
- Export naar Moneybird (factuur trigger)
- Daily summary email naar Daimy

### 1.4 Email flows
| | Detail |
|--|--------|
| **Wat** | Geautomatiseerde emails voor het hele orderproces |
| **Wie** | Claude |
| **Deliverable** | 6 transactionele email templates |

**Email templates:**

| # | Trigger | Onderwerp | Inhoud |
|---|---------|-----------|--------|
| 1 | Bestelling geplaatst | "Bedankt voor je bestelling bij ZonweringDirect" | Orderoverzicht, verwachte levertijd, contactinfo |
| 2 | Betaling ontvangen | "Betaling ontvangen -- we gaan aan de slag" | Bevestiging, volgende stappen |
| 3 | In productie | "Je [product] wordt nu gemaakt" | Productie gestart, verwachte verzenddatum |
| 4 | Verzonden | "Je bestelling is onderweg!" | Track & trace link, montagetips |
| 5 | Afgeleverd (3 dagen na levering) | "Alles goed ontvangen?" | Check-in, link naar meetinstructie/montagevideo |
| 6 | Review verzoek (14 dagen na levering) | "Hoe bevalt je [product]?" | Review link, foto-upload mogelijkheid |

### 1.5 Eerste testorders
| | Detail |
|--|--------|
| **Wat** | 2-3 testorders door het hele systeem |
| **Wie** | Daimy |
| **Deliverable** | Bewijs dat het end-to-end werkt |

**Testscenario's:**
1. **Test 1:** Daimy bestelt screen voor eigen huis. Volledige flow: configurator -> checkout -> iDEAL betaling -> order bij Sunmaster -> levering -> factuur.
2. **Test 2:** Vraag een vriend/familielid om te bestellen. Observeer de ervaring. Noteer alle frictie.
3. **Test 3:** Edge case: annulering na betaling. Test het refund-proces via Mollie.

### 1.6 Verzendkosten & levertijdcommunicatie
| | Detail |
|--|--------|
| **Wat** | Duidelijke verzendkosten en levertijden op de website |
| **Wie** | Daimy (info van Sunmaster) + Claude (implementatie) |
| **Deliverable** | Verzendkosten en levertijd zichtbaar in checkout + productpagina |

**Aanbeveling:**

```
Verzendkosten:
- Gratis verzending vanaf EUR 250 (marktstandaard)
- Onder EUR 250: EUR 14,95 (buitenzonwering) / EUR 7,95 (binnenzonwering)

Levertijden:
- Binnenzonwering: 2-3 weken
- Screens / ritsscreens: 3-4 weken
- Zonneschermen: 4-5 weken

ALTIJD underpromise, overdeliver. Zeg 4 weken, lever in 3.
```

### FASE 1 -- Kostenopsomming

| Item | Eenmalig | Maandelijks |
|------|----------|-------------|
| Testorders (2-3 stuks) | EUR 300-500 | -- |
| Alles uit FASE 0 | -- | EUR 62/mnd |
| **Totaal FASE 1** | **EUR 300-500** | **EUR 62/mnd** |

---

## FASE 2: AI Klantenservice (Week 5-8)

> **Doel:** Volledig AI-gestuurde klantenservice die 100% menselijk aanvoelt. WhatsApp, email, en chatbot op de website.

### Afhankelijkheden
- FASE 1 afgerond (werkende orders)
- Trengo account actief
- Claude API key

### Het Grote Principe: Nobody Should Know

De AI klantenservice moet voelen alsof er een team van 3-4 mensen achter zit. Dit bereiken we door:

1. **Menselijke namen gebruiken** -- De AI beantwoordt als "Lisa" (klantenservice), "Sjoerd" (technisch advies), of "Daimy" (eigenaar voor escalaties)
2. **Realistische responstijden** -- NIET direct antwoorden. Vertraging van 30 seconden tot 5 minuten inbouwen
3. **Typing indicators** -- WhatsApp "aan het typen..." tonen voor het antwoord komt
4. **Imperfecties** -- Af en toe een typfout, of "even checken, momentje!" gevolgd door het antwoord
5. **Werkritme** -- Buiten openingstijden: "We zijn nu gesloten, je hoort morgen van ons!"
6. **Persoonlijkheid** -- Elk "medewerker" heeft een consistente stijl

### 2.1 Platform keuze: WhatsApp

**Aanbeveling: Trengo**

| Platform | Prijs/mnd | WhatsApp API | Multi-channel | NL bedrijf | Aanbeveling |
|----------|-----------|-------------|--------------|-----------|-------------|
| **Trengo** | EUR 125 | Ja | Chat+WA+Email+Social | Ja | **Eerste keuze** |
| Twilio | EUR 30+ | Ja (API-only) | Nee (alleen API) | Nee | Goedkoper, maar meer bouwwerk |
| 360dialog | EUR 50+ | Ja | Nee | Nee | Goed voor alleen WhatsApp |
| MessageBird | EUR 75+ | Ja | Ja | Ja | Duurder, minder UX |
| Intercom | EUR 89+ | Beperkt | Ja | Nee | Geen native WhatsApp NL |

**Waarom Trengo:**
- Al in gebruik bij Sonty (kennis aanwezig)
- Nederlands bedrijf (support in NL)
- WhatsApp Business API + live chat + email in 1 dashboard
- API beschikbaar voor Claude-integratie
- Bewezen werkbaar (Trengo auth + API sessie al werkend vanuit Sonty project)

### 2.2 WhatsApp AI Bot

| | Detail |
|--|--------|
| **Wat** | AI-gestuurde WhatsApp klantenservice |
| **Wie** | Claude (bouwen + runnen) |
| **Deliverable** | WhatsApp bot die 90% van vragen zelf beantwoordt |

**Architectuur:**

```
Klant stuurt WhatsApp bericht
        |
        v
Trengo ontvangt bericht (webhook)
        |
        v
Claude API analyseert bericht
  - Classificatie: vraag/klacht/order/offerteaanvraag/anders
  - Context ophalen: openstaande orders (Supabase), productinfo, FAQ
  - Antwoord genereren in casual Nederlands
        |
        v
Delay engine (30s - 5min vertraging)
  + Typing indicator activeren
        |
        v
Trengo stuurt antwoord namens "Lisa" of "Sjoerd"
        |
        v
Logging in Supabase (conversatie-historie)
```

**Menselijke trucs:**

| Truc | Implementatie |
|------|--------------|
| **Vertraging** | Random delay: 30-120 sec voor simpele vragen, 2-5 min voor complexe vragen |
| **Typing indicator** | Trengo API: typing=true 10-20 sec voor antwoord |
| **Typo's** | 1 op de 20 berichten een kleine typfout die gecorrigeerd wordt ("*levertijd" na "levertidjd") |
| **Werkritme** | Ma-vr 9:00-17:00, za 10:00-14:00. Daarbuiten: "Hoi! We zijn nu gesloten. Je hoort morgen van ons!" |
| **Persoonlijkheid** | Lisa: warm, behulpzaam, emoji's. Sjoerd: technisch, droog, to-the-point |
| **Follow-up** | Na 2 dagen zonder reactie: "Hey [naam], had je nog vragen over [onderwerp]?" |
| **Woordkeuze** | "Top!", "Helemaal goed!", "Snap ik!", "Even voor je nagekeken..." |

**Voorbeeldconversatie:**

```
Klant: Hoi, ik wil graag weten wat een screen kost voor mijn raam van 1.80 x 1.50

[45 seconden delay]
[Typing indicator 8 sec]

Lisa: Hoi! Leuk dat je interesse hebt in screens. Een screen van 180x150 cm
begint bij EUR 245 (handmatig) en EUR 395 (elektrisch). Wil je het even
configureren op onze site? Dan zie je direct de exacte prijs voor jouw maten
en kleurkeuze: https://zonweringdirect.nl/configurator/screens

Of als je wilt kan ik je er ook doorheen helpen!

Klant: En hoe lang duurt de levering?

[35 seconden delay]
[Typing indicator 5 sec]

Lisa: De levertijd voor screens is op dit moment 3-4 weken. We houden je
op de hoogte van elke stap via WhatsApp!
```

**Wat de AI WEL kan:**
- Productadvies en prijsindicaties
- Levertijd communiceren
- Meetinstructies uitleggen
- Orderstatus opzoeken
- Eenvoudige klachten afhandelen ("onderdeel ontbreekt" -> stuur na)
- FAQ beantwoorden

**Wat de AI NIET kan (escalatie naar Daimy):**
- Klachten met financiele impact (>EUR 50 creditering)
- Technische problemen met gemonteerde producten
- Annuleringen van orders in productie
- Dreigende/boze klanten na 2e bericht
- Alles wat niet in de knowledge base staat

### 2.3 Escalatie naar Daimy

| | Detail |
|--|--------|
| **Wat** | Naadloze overdracht van AI naar Daimy |
| **Wie** | Claude (detectie) + Daimy (handmatige afhandeling) |
| **Deliverable** | Escalatiesysteem dat voor de klant onzichtbaar is |

**Hoe het werkt:**
1. AI detecteert dat het de vraag niet kan beantwoorden OF dat de klant gefrustreerd is (sentimentanalyse)
2. AI antwoordt: "Goede vraag! Ik geef dit even door aan mijn collega Daimy, die weet hier meer van. Hij/zij neemt zo contact met je op!"
3. Daimy krijgt Telegram notificatie met: conversatie-context, klantinfo, reden escalatie, suggestie voor antwoord
4. Daimy antwoordt via Trengo (als zichzelf)
5. Na afhandeling: AI neemt het weer over

**Escalatie-triggers:**
- Klant stuurt 3+ berichten zonder tevreden te zijn
- Klant gebruikt woorden als "klacht", "advocaat", "terugbetaling", "onacceptabel"
- Vraag valt buiten knowledge base (confidence <70%)
- Order met problemen (vertraagd >1 week, beschadigd, verkeerd geleverd)

### 2.4 Email AI Responder

| | Detail |
|--|--------|
| **Wat** | AI beantwoordt emails naar info@zonweringdirect.nl |
| **Wie** | Claude |
| **Deliverable** | 80% van emails automatisch beantwoord |

**Flow:**

```
Email binnenkomst (info@zonweringdirect.nl)
        |
        v
Claude classificeert:
  A. Productvraag     -> Auto-antwoord met product-info
  B. Orderstatus      -> Auto-antwoord met status uit Supabase
  C. Offerteaanvraag  -> Auto-antwoord + configurator link
  D. Klacht           -> Concept-antwoord, Daimy beoordeelt
  E. Spam             -> Filter + archiveer
  F. Leverancier      -> Forward naar Daimy
  G. Overig           -> Concept-antwoord, Daimy beoordeelt
        |
        v
Delay: emails beantwoorden na 15-45 minuten (werktijden)
       Buiten werktijden: volgende ochtend 9:15
        |
        v
Verstuur via Resend (vanuit lisa@zonweringdirect.nl of info@zonweringdirect.nl)
```

**Email signature:**

```
Met vriendelijke groet,

Lisa de Vries
Klantenservice ZonweringDirect
Tel: [nummer] | WhatsApp: [nummer]
www.zonweringdirect.nl
```

### 2.5 Live Chat op Website

| | Detail |
|--|--------|
| **Wat** | Chat widget op de website |
| **Wie** | Claude |
| **Deliverable** | Trengo chat widget met AI-antwoorden |

**Implementatie:**
1. Trengo widget embedden op alle pagina's
2. Chat -> Trengo webhook -> Claude API -> Trengo response
3. Zelfde persona's als WhatsApp ("Lisa")
4. Proactieve triggers:
   - Bezoeker >3 min op configurator: "Kan ik je ergens mee helpen?"
   - Bezoeker op FAQ pagina: "Staat je vraag er niet tussen? Stuur me een berichtje!"
   - Checkout pagina: "Twijfel je nog? We helpen je graag!"

### 2.6 Knowledge Base voor AI

| | Detail |
|--|--------|
| **Wat** | Complete kennisbank die Claude gebruikt voor antwoorden |
| **Wie** | Claude (opstellen) + Daimy (aanvullen) |
| **Deliverable** | knowledge-base.json met 200+ Q&A paren |

**Inhoud:**
- Alle productspecificaties (Sunmaster catalogus)
- Meetinstructies per product
- Montagetips per product
- Veelgestelde vragen (50+)
- Verzendinfo en levertijden
- Retourbeleid en garantie
- Prijsinformatie en kortingsregels
- Bedrijfsinfo (openingstijden, adres, etc.)
- Foutscenario's en oplossingen

### FASE 2 -- Kostenopsomming

| Item | Eenmalig | Maandelijks |
|------|----------|-------------|
| Trengo Boost | -- | EUR 125 |
| Claude API usage | -- | EUR 50-100 |
| WhatsApp Business nummer | EUR 0 (via Trengo) | -- |
| Alles uit FASE 0+1 | -- | EUR 62/mnd |
| **Totaal FASE 2** | **EUR 0** | **EUR 237-287/mnd** |

---

## FASE 3: Marketing Launch (Week 9-12)

> **Doel:** Echte traffic, echte klanten, eerste omzet. Van 0 naar 50-100 bestellingen.

### Afhankelijkheden
- FASE 0+1+2 afgerond (werkende shop, werkende klantenservice)
- Google Ads account
- Meta Ads account
- Google Merchant Center

### 3.1 Google Ads Campagne

| | Detail |
|--|--------|
| **Wat** | Zoekadvertenties op transactionele keywords |
| **Wie** | Claude (opzet + optimalisatie) + Daimy (goedkeuring budget) |
| **Deliverable** | Lopende Google Ads campagnes met positieve ROAS |

**Campagne-structuur:**

```
Account: ZonweringDirect
|
+-- Campagne 1: Search - Screens (hoogste prioriteit)
|   +-- Ad Group: "screen op maat"
|   +-- Ad Group: "screen bestellen"
|   +-- Ad Group: "ritsscreen kopen"
|   +-- Ad Group: "zipscreen prijs"
|
+-- Campagne 2: Search - Binnenzonwering
|   +-- Ad Group: "rolgordijn op maat"
|   +-- Ad Group: "plisse gordijn bestellen"
|   +-- Ad Group: "duette gordijn kopen"
|   +-- Ad Group: "jaloezie op maat"
|
+-- Campagne 3: Shopping (Google Merchant Center)
|   +-- Alle producten met prijs, foto, beschikbaarheid
|
+-- Campagne 4: Retargeting (Display)
|   +-- Bezoekers die configurator gebruikten maar niet bestelden
|
+-- Campagne 5: Performance Max (week 13+, na 100+ conversies)
```

**Budget allocatie (start):**

| Campagne | Budget/dag | Budget/mnd |
|----------|-----------|------------|
| Search - Screens | EUR 30 | EUR 900 |
| Search - Binnenzonwering | EUR 20 | EUR 600 |
| Shopping | EUR 15 | EUR 450 |
| Retargeting | EUR 10 | EUR 300 |
| **Totaal** | **EUR 75/dag** | **EUR 2.250/mnd** |

**KPI's:**
- CPC (kosten per klik): EUR 1-3 target
- CTR (click-through rate): >3%
- Conversiepercentage: >2% (marktgemiddelde e-commerce NL)
- ROAS (return on ad spend): >3x target
- CPA (kosten per acquisitie): <EUR 40

### 3.2 Meta Ads (Instagram + Facebook)

| | Detail |
|--|--------|
| **Wat** | Awareness + retargeting campagnes |
| **Wie** | Claude (creatie + opzet) |
| **Deliverable** | Lopende Meta campagnes |

**Campagne-structuur:**

```
+-- Campagne 1: Awareness - Carousel
|   Doelgroep: 25-55 jaar, huiseigenaren, interesse in wonen/interieur
|   Creative: Carousel met 5 productfoto's in interieur
|   CTA: "Configureer je zonwering"
|
+-- Campagne 2: Consideration - Video
|   Doelgroep: Websitebezoekers (Custom Audience)
|   Creative: 15-30 sec video montage timelapse
|   CTA: "Bekijk onze configurator"
|
+-- Campagne 3: Retargeting - Dynamic Product Ads
|   Doelgroep: Configurator-gebruikers die niet bestelden
|   Creative: Dynamisch product dat ze bekeken
|   CTA: "Rond je bestelling af"
```

**Budget: EUR 500-1.000/mnd (start)**

### 3.3 Google Merchant Center + Shopping Feed

| | Detail |
|--|--------|
| **Wat** | Product feed voor Google Shopping |
| **Wie** | Claude |
| **Deliverable** | Gestructureerde product feed, goedgekeurd door Google |

**Stappen:**
1. Google Merchant Center account aanmaken (Daimy)
2. Claude genereert product feed (XML/JSON) vanuit Supabase
3. Feed uploaden naar Merchant Center
4. Producten: titel, beschrijving, prijs, foto, beschikbaarheid, GTIN/EAN
5. Koppelen aan Google Ads Shopping campagne
6. Feed automatisch updaten bij prijswijzigingen

### 3.4 SEO Content Offensief

| | Detail |
|--|--------|
| **Wat** | 20+ SEO-pagina's voor organische traffic |
| **Wie** | Claude |
| **Deliverable** | Blog + landingspagina's die binnen 3-6 maanden ranken |

**Content plan (20 artikelen in 4 weken):**

| Week | Artikelen | Focus |
|------|-----------|-------|
| 9 | 1. "Screen op maat bestellen: de complete gids" (3000 woorden) | Transactioneel |
| | 2. "Wat kosten screens? Prijzen 2026 vergeleken" | Informationeel |
| | 3. "Screens zelf monteren: stap-voor-stap" | Informationeel |
| | 4. "Rolgordijn op maat: zo kies je het juiste gordijn" | Transactioneel |
| | 5. "Plisse gordijn vs. duette: wat is het verschil?" | Informationeel |
| 10 | 6. "Zonwering inmeten: de 5 fouten die iedereen maakt" | Informationeel |
| | 7. "Beste zonwering voor je slaapkamer [2026]" | Informationeel |
| | 8. "Ritsscreen vs. standaard screen: welke kies je?" | Informationeel |
| | 9. "Zonwering voor huurwoning: dit mag wel (en dit niet)" | Niche |
| | 10. "Hoeveel bespaar je met zonwering op je energierekening?" | Informationeel |
| 11 | 11. "Zonwering kopen: online vs. showroom" | Vergelijkend |
| | 12. "Solar zonwering: werkt het echt?" | Informationeel |
| | 13. "Slimme zonwering: alles over smart home integratie" | Trend |
| | 14. "Zonwering trends 2026: dit is populair" | Trend |
| | 15. "De beste zonwering per kamertype" | Gids |
| 12 | 16. "Buitenzonwering: welk type past bij jouw huis?" | Gids |
| | 17. "Zonwering onderhoud: zo gaat het langer mee" | Service |
| | 18. "Zonwering nieuwbouw: pakketdeals en tips" | Niche |
| | 19. "Screens in de winter: heeft het zin?" | Seizoen |
| | 20. "ZonweringDirect: wie zijn wij?" | Brand |

### 3.5 Social Media Opstart

| | Detail |
|--|--------|
| **Wat** | Instagram + Pinterest accounts met content |
| **Wie** | Claude (content creatie) + Daimy (goedkeuring) |
| **Deliverable** | Actieve social media met 3-5 posts/week |

**Instagram (@zonweringdirect):**
- Feed: productfoto's in interieur (AI-gegenereerd via Flux Pro + echte foto's)
- Reels: montage timelapses, voor/na transformaties
- Stories: behind-the-scenes, polls, tips
- Bio: "Zonwering op maat. Online geconfigureerd. Zelf gemonteerd. Gratis verzending vanaf EUR 250"

**Pinterest (ZonweringDirect):**
- Boards per productcategorie
- Sfeerbeelden verticaal formaat (2:3)
- SEO-titels op elke pin
- Link naar productpagina

### 3.6 Email Marketing Setup

| | Detail |
|--|--------|
| **Wat** | Klaviyo flows voor e-commerce |
| **Wie** | Claude |
| **Deliverable** | 4 geautomatiseerde email flows |

**Flows:**

| Flow | Trigger | Emails | Doel |
|------|---------|--------|------|
| Welcome | Nieuwsbrief aanmelding | 3 emails (dag 0, 2, 5) | Introduceer ZonweringDirect, toon producten, geef 5% korting |
| Abandoned Cart | Winkelwagen verlaten | 3 emails (1u, 24u, 72u) | Herinner aan configuratie, bied meetcheck aan, laatste kans korting |
| Post-Purchase | Bestelling afgerond | 4 emails (direct, 3d, 14d, 30d) | Bedankt, montagetips, review verzoek, referral |
| Winback | Geen aankoop >60 dagen | 2 emails | Seizoenstip, nieuwe producten, korting |

### FASE 3 -- Kostenopsomming

| Item | Eenmalig | Maandelijks |
|------|----------|-------------|
| Google Ads | -- | EUR 2.250 |
| Meta Ads | -- | EUR 750 |
| Klaviyo | -- | EUR 0-45 |
| Plausible Analytics | -- | EUR 9 |
| Instagram/Pinterest content (Flux Pro) | -- | EUR 20 |
| Alles uit FASE 0-2 | -- | EUR 287/mnd |
| **Totaal FASE 3** | **EUR 0** | **EUR 3.316-3.361/mnd** |

---

## FASE 4: Reviews & Trust (Week 13-20)

> **Doel:** Echte reviews verzamelen, keurmerken behalen, social proof opbouwen. Van placeholder naar bewijs.

### Afhankelijkheden
- Minimaal 20-30 afgeleverde bestellingen (uit FASE 3)
- Kiyoh + WebwinkelKeur accounts

### 4.1 Review-strategie

| | Detail |
|--|--------|
| **Wat** | Systematisch echte reviews verzamelen |
| **Wie** | Claude (automatisering) + klanten (schrijven) |
| **Doel** | 50+ reviews in 8 weken, gemiddeld 9.0+ |

**Aanpak:**

```
Dag 0:  Levering product
Dag 3:  WhatsApp: "Alles goed ontvangen? Laat het weten als je vragen hebt!"
Dag 14: Email: "Hoe bevalt je [product]? We horen het graag!"
        -> Link naar Kiyoh review pagina
        -> Incentive: "Deel een foto en maak kans op EUR 25 shoptegoed"
Dag 21: WhatsApp (als geen review): "We zagen dat je nog geen review hebt
        geplaatst. Je mening helpt andere klanten enorm!"
Dag 30: Geen verdere herinneringen (niet spammen)
```

**Photo reviews stimuleren:**
- "Deel een foto van je gemonteerde zonwering en ontvang EUR 10 shoptegoed"
- Beste foto's op Instagram reposten (met toestemming)
- Maandelijkse "Mooiste montage" wedstrijd

### 4.2 Kiyoh (Primair review platform)

| | Detail |
|--|--------|
| **Wat** | Nederlands review platform (veel gebruikt in e-commerce) |
| **Wie** | Daimy (account) + Claude (integratie) |
| **Kosten** | EUR 49/mnd (Starter) |
| **Waarom** | Kiyoh widget op site, Google Seller Ratings (sterren in zoekresultaten), automatische review-uitnodigingen |

**Integratie:**
1. Kiyoh account aanmaken
2. API koppeling: na levering automatisch review-uitnodiging
3. Kiyoh widget op homepage + productpagina's
4. Reviews syncen naar website (real-time)
5. Google Seller Ratings activeren (vereist 100+ reviews)

### 4.3 WebwinkelKeur (Keurmerk)

| | Detail |
|--|--------|
| **Wat** | Nederlands webshop keurmerk + reviews |
| **Wie** | Daimy (aanvraag) + Claude (technische eisen) |
| **Kosten** | EUR 34,95/mnd |
| **Waarom** | Vertrouwensbadge, consumentenbescherming, vereist voor sommige awards |

**Eisen voor WebwinkelKeur:**
- Algemene voorwaarden conform NL wetgeving
- Duidelijk retourbeleid
- Beveiligde checkout (SSL)
- Contactgegevens zichtbaar
- KvK-nummer op website
- Klachtenafhandeling conform procedure
- Privacy compliance (AVG)

**Stappen:**
1. Aanvragen op webwinkelkeur.nl
2. WebwinkelKeur checkt de webshop (1-2 weken)
3. Eventuele aanpassingen doorvoeren
4. Keurmerk badge plaatsen op website
5. Review-widget integreren

### 4.4 Google Business Profile

| | Detail |
|--|--------|
| **Wat** | Google Reviews + lokale zichtbaarheid |
| **Wie** | Daimy (verificatie) + Claude (optimalisatie) |
| **Kosten** | EUR 0 |

**Stappen:**
1. Google Business Profile aanmaken voor ZonweringDirect
2. Verificatie via postcode (brief naar bedrijfsadres)
3. Profiel optimaliseren: foto's, openingstijden, productcategorieen
4. Review-link genereren voor klanten
5. Na WhatsApp review verzoek ook Google review link sturen

### 4.5 Trustpilot (Optioneel, fase 4b)

| | Detail |
|--|--------|
| **Wat** | Internationaal review platform |
| **Wie** | Claude |
| **Kosten** | EUR 0 (gratis profiel) of EUR 199/mnd (Standard) |
| **Aanbeveling** | Start gratis. Upgrade alleen als organisch >20 reviews binnenkomen. Trustpilot is minder relevant in NL dan Kiyoh/WebwinkelKeur. |

### 4.6 Social Proof op Website

| | Detail |
|--|--------|
| **Wat** | Reviews en vertrouwenselementen prominent op de site |
| **Wie** | Claude |
| **Deliverable** | Trust-elementen op elke pagina |

**Implementatie:**
- Homepage: Kiyoh widget (overall score), 3 uitgelichte reviews met foto's
- Productpagina: Productspecifieke reviews, gemiddelde score
- Checkout: WebwinkelKeur badge, "X klanten gingen je voor", "Gemiddeld 9.X beoordeeld"
- Footer: Kiyoh badge, WebwinkelKeur badge, Mollie betaallogo's, SSL badge
- Pop-up (subtiel): "Sjoerd uit Breda bestelde net een screen" (social proof notificatie)

### 4.7 Placeholder reviews vervangen

| | Detail |
|--|--------|
| **Wat** | Geleidelijke overgang van lege state naar echte reviews |
| **Wie** | Claude |
| **Aanpak** | |

```
Week 13-14: Reviews pagina toont "Nog geen reviews - binnenkort te lezen!"
            + Kiyoh widget (als eerste reviews binnenkomen)

Week 15-16: Eerste 5-10 echte reviews verschijnen op site
            Reviews worden prominent op homepage getoond

Week 17-20: 30-50 reviews opgebouwd
            Productspecifieke reviews verschijnen
            Google Seller Ratings aanvraag (bij 100+ reviews)

Week 20+:   Structureel 5-10 nieuwe reviews per week
```

### FASE 4 -- Kostenopsomming

| Item | Eenmalig | Maandelijks |
|------|----------|-------------|
| Kiyoh Starter | -- | EUR 49 |
| WebwinkelKeur | -- | EUR 34,95 |
| Google Business Profile | -- | EUR 0 |
| Review incentives (EUR 10-25 shoptegoed) | EUR 250-500 | -- |
| Alles uit FASE 0-3 | -- | EUR 3.361/mnd |
| **Totaal FASE 4** | **EUR 250-500** | **EUR 3.445/mnd** |

---

## FASE 5: Awards & Top 10 (Week 21-30)

> **Doel:** Webshop awards winnen en top 10 bereiken. Dit is het fundament voor "The Reveal."

### Afhankelijkheden
- 100+ echte reviews met 9.0+ gemiddelde
- WebwinkelKeur keurmerk actief
- 6+ maanden operationeel
- Consistent positieve klantervaring

### Top 5 Nederlandse Webshop Awards

#### 1. Thuiswinkel Awards

| | Detail |
|--|--------|
| **Organisatie** | Thuiswinkel.org (branchevereniging e-commerce NL) |
| **Website** | thuiswinkelawards.nl |
| **Frequentie** | Jaarlijks (uitreiking mei/juni) |
| **Categorieen** | Publieksprijs (stemmen), Beste Starter, Categorie-awards (o.a. Wonen & Tuin) |
| **Deadline inschrijving** | Meestal januari-februari |
| **Kosten inschrijving** | EUR 250-500 (Thuiswinkel.org lidmaatschap vereist: EUR 600-2.000/jaar afhankelijk van omzet) |

**Beoordelingscriteria:**
- Klanttevredenheid (enquete onder eigen klanten)
- Website-ervaring (UX audit door jury)
- Checkout-proces
- Klantenservice bereikbaarheid en kwaliteit
- Retourproces
- Levertijd en betrouwbaarheid
- Transparantie (voorwaarden, prijzen)

**Wat ZonweringDirect nodig heeft:**
- Thuiswinkel.org lidmaatschap
- Thuiswinkel Waarborg certificering (consumentenbescherming)
- Minimaal 6 maanden actief
- Aantoonbare klanttevredenheid (reviews)
- Conform Thuiswinkel certificeringseisen

**Haalbaarheid voor ons:** HOOG (categorie "Beste Starter" is ideaal)

---

#### 2. Shopping Awards

| | Detail |
|--|--------|
| **Organisatie** | ShoppingAwards.nl |
| **Website** | shoppingawards.nl |
| **Frequentie** | Jaarlijks (uitreiking maart/april) |
| **Categorieen** | 20+ categorieen waaronder "Wonen & Inrichting" |
| **Deadline inschrijving** | Meestal september-november (jaar ervoor) |
| **Kosten inschrijving** | EUR 149-399 per categorie |

**Beoordelingscriteria:**
- Klantbeoordeling via mystery shopping (50%)
- Jury beoordeling website en checkout (25%)
- Klanttevredenheidsonderzoek (25%)
- Extra punten voor: mobiele ervaring, duurzaamheid, innovatie

**Subcriteria mystery shopping:**
- Bestelproces (snelheid, duidelijkheid, betaalopties)
- Levertijd en verpakking
- Klantenservice (reactietijd, kwaliteit advies)
- Retourervaring
- Communicatie (bevestigingen, updates)

**Wat ZonweringDirect nodig heeft:**
- Inschrijving voor categorie "Wonen & Inrichting"
- Mystery shopping bestelling succesvol doorstaan
- Snelle klantenservice (WhatsApp AI scoort hier hoog!)
- Perfecte checkout ervaring

**Haalbaarheid voor ons:** HOOG (onze AI klantenservice kan hier uitblinken)

---

#### 3. Emerce100

| | Detail |
|--|--------|
| **Organisatie** | Emerce (vakmedium e-commerce NL) |
| **Website** | emerce100.nl |
| **Frequentie** | Jaarlijks (publicatie juni) |
| **Categorieen** | Top 100 e-commerce bedrijven NL, per branche |
| **Deadline** | Meestal februari-maart (aanmelding/stemming) |
| **Kosten** | EUR 0 (peer review systeem) |

**Beoordelingscriteria:**
- Peer-beoordeling door andere professionals in e-commerce
- Online reputatie (reviews, social presence)
- Innovatie
- Groei
- Marktaandeel/zichtbaarheid

**Wat ZonweringDirect nodig heeft:**
- Zichtbaarheid in e-commerce community
- PR/media aandacht (past perfect bij "The Reveal" later)
- Minimaal 1 jaar actief (idealiter)

**Haalbaarheid voor ons:** GEMIDDELD (vereist meer naamsbekendheid, beter voor jaar 2)

---

#### 4. Webshop Awards NL (MSPA)

| | Detail |
|--|--------|
| **Organisatie** | Multi Service & Promotional Awards |
| **Website** | webshopawards.nl |
| **Frequentie** | Jaarlijks |
| **Categorieen** | Beste Webshop per branche, Beste Starter, Innovatie |
| **Kosten** | EUR 200-400 |

**Beoordelingscriteria:**
- Gebruiksvriendelijkheid website
- Design en visuele presentatie
- Checkout-ervaring
- Klantenservice
- Innovatie (configurator, AI = bonus!)
- Duurzaamheidsbeleid

**Haalbaarheid voor ons:** HOOG (innovatie-categorie past perfect)

---

#### 5. XL Awards (voorheen Dutch Interactive Awards / DDMA)

| | Detail |
|--|--------|
| **Organisatie** | Diverse organisatoren |
| **Frequentie** | Jaarlijks |
| **Categorieen** | Beste e-commerce ervaring, Innovatie, UX |
| **Kosten** | EUR 200-500 |

**Beoordelingscriteria:**
- UX/UI kwaliteit
- Technische innovatie
- Conversie-optimalisatie
- Klantgerichtheid
- Merkbeleving

**Haalbaarheid voor ons:** GEMIDDELD-HOOG (sterke Next.js UX + configurator)

### Award-strategie: Wat wanneer

| Tijdlijn | Actie | Award |
|----------|-------|-------|
| Week 21 | Thuiswinkel.org lidmaatschap aanvragen | Thuiswinkel Awards |
| Week 22 | WebwinkelKeur certificering afronden | Alle awards |
| Week 23 | Shopping Awards inschrijving | Shopping Awards |
| Week 24 | Mystery shopping voorbereiden: test-bestelling door bekende | Shopping Awards |
| Week 25 | Webshop Awards NL inschrijving | Webshop Awards |
| Week 26 | PR-campagne starten (vakpers e-commerce) | Emerce100 + netwerk |
| Week 28 | Thuiswinkel Awards inschrijving | Thuiswinkel Awards |
| Week 30 | Portfolio/case study maken van ZonweringDirect | Alle awards |

### Metrics die we nodig hebben voor award-kwalificatie

| Metric | Target week 30 | Hoe |
|--------|----------------|-----|
| Klanttevredenheid (Kiyoh/WebwinkelKeur) | 9.2+ gemiddeld | Uitstekende AI service + proactieve communicatie |
| Aantal reviews | 200+ | Systematische review-uitnodigingen |
| Gemiddelde levertijd | <3 weken (onderpromise) | Sunmaster partnership optimaliseren |
| Klantenservice reactietijd | <5 minuten (WhatsApp) | AI bot |
| Retourpercentage | <3% | Goede meetinstructies + video-check |
| NPS (Net Promoter Score) | >60 | Post-purchase survey |
| Website performance (Lighthouse) | 95+ | Next.js optimalisatie |
| Checkout completion rate | >60% | UX optimalisatie |
| Mobiele conversie | >1.5% | Responsive design + mobiele checkout |

### FASE 5 -- Kostenopsomming

| Item | Eenmalig | Maandelijks |
|------|----------|-------------|
| Thuiswinkel.org lidmaatschap | EUR 600-2.000/jaar | -- |
| Shopping Awards inschrijving | EUR 149-399 | -- |
| Webshop Awards inschrijving | EUR 200-400 | -- |
| PR/media campagne | EUR 500-1.000 | -- |
| Alles uit FASE 0-4 | -- | EUR 3.445/mnd |
| **Totaal FASE 5** | **EUR 1.450-3.800** | **EUR 3.445/mnd** |

---

## FASE 6: The Reveal

> **Doel:** Onthullen dat ZonweringDirect volledig gerund wordt door 1 persoon + AI. Dit wordt een PR-moment dat nationale media haalt.

### Wanneer onthullen?

**Trigger:** Na het winnen van minimaal 1 webshop award OF na het bereiken van:
- 500+ positieve reviews
- 1.000+ bestellingen
- Consistente 9.0+ klanttevredenheid
- Minimaal 6 maanden foutloos operationeel

**Ideale timing:** Na winst Shopping Awards of Thuiswinkel Awards (maart-juni 2027)

### Het Verhaal

> "ZonweringDirect won de [Award X] als beste webshop in de categorie Wonen. Wat niemand wist: achter deze webshop zit geen team van tientallen mensen. Het is 1 ondernemer, Daimy Boot uit Rijswijk, die samenwerkt met AI. De klantenservice? AI. De marketingcampagnes? AI. De productfoto's? AI. De enige echte mens? Daimy. En jullie hadden geen idee."

### PR-strategie

#### Stap 1: Het verhaal voorbereiden (week 28-30)

| Deliverable | Detail |
|-------------|--------|
| **Persbericht** | Professioneel persbericht in NL + EN |
| **Fact sheet** | Cijfers: reviews, bestellingen, omzet, klanttevredenheid, award |
| **Before/after** | Screenshots van AI-gegenereerde content vs. echte content |
| **Video** | 3-5 min documentaire: "Hoe 1 persoon + AI een top webshop runt" |
| **Social media kit** | Posts, stories, graphics voor alle platforms |

#### Stap 2: Exclusief embargo bij 1 medium (week 30-32)

| Medium | Waarom | Contact |
|--------|--------|---------|
| **RTL Z / BNR** | Business-gericht, groot bereik | Persbericht + interview |
| **NRC / Volkskrant** | Kwaliteitskrant, tech-rubriek | Longread format |
| **Emerce** | Vakpers e-commerce, bereikt de jury's | Artikel + interview |
| **Tweakers** | Tech community, viraliteit | Achtergrondartikel |

**Aanbeveling:** Eerst exclusief bij Emerce of NRC (1 week embargo), daarna breed uitrollen.

#### Stap 3: Breed uitrollen

| Kanaal | Actie |
|--------|-------|
| LinkedIn (Daimy) | Persoonlijk verhaal: "Ik run een bekroonde webshop met AI" |
| Twitter/X | Thread met highlights, screenshots, cijfers |
| Instagram | Reel: behind-the-scenes, Daimy laat zien hoe het werkt |
| YouTube | Documentaire: het hele verhaal van begin tot award |
| Reddit (r/entrepreneur, r/Netherlands) | AMA: "I run a top 10 Dutch webshop with just AI" |
| ProductHunt | Launch: "ZonweringDirect: Award-winning webshop run by 1 person + AI" |
| Hacker News | Submitten: het tech-verhaal achter de AI-integratie |

#### Stap 4: Speaking opportunities

| Event | Doel |
|-------|------|
| **Webwinkel Vakdagen** | Keynote: "AI-first e-commerce: lessen uit ZonweringDirect" |
| **Emerce eDay** | Presentatie over AI in e-commerce |
| **Dutch Digital Day** | Workshop: AI-gestuurde klantenservice |
| **Podcast optredens** | NL e-commerce podcasts, AI podcasts |

### Risico's bij The Reveal

| Risico | Mitigatie |
|--------|----------|
| Klanten voelen zich bedrogen ("Was het geen echt team?") | Benadruk: de service WAS echt, de kwaliteit WAS echt. AI maakte het BETER, niet slechter. |
| Awards worden ingetrokken | Onwaarschijnlijk -- er is geen regel tegen AI. Maar check vooraf de voorwaarden. |
| Concurrenten kopieren het model | First-mover advantage + het verhaal is eenmalig |
| Media-aandacht is negatief | Focus op het positieve: "1 ondernemer kan het" = empowerment-verhaal |
| Klanten vertrouwen daalt | Data tonen: "Jullie gaven ons een 9.4 -- dat was met AI. Het werkt." |

### Impact na The Reveal

| Verwacht effect | Tijdlijn |
|-----------------|----------|
| 10-50x website traffic (media buzz) | Week 1-2 na reveal |
| 2-5x bestellingen | Week 1-4 na reveal |
| Speaking invitations | Maand 1-6 na reveal |
| Consultancy/advies aanvragen | Maand 1-12 na reveal |
| Boek/documentaire interesse | Maand 3-12 na reveal |
| Internationale media (TechCrunch, etc.) | Week 2-8 na reveal |

---

## Risico's & Mitigatie

### Operationele risico's

| Risico | Impact | Waarschijnlijkheid | Mitigatie |
|--------|--------|---------------------|----------|
| Sunmaster levert niet/laat | Hoog | Gemiddeld | Tweede leverancier identificeren (Somfy, Verano). Buffer in levertijdcommunicatie. |
| AI geeft fout advies | Hoog | Laag | Knowledge base valideren, confidence threshold, escalatie bij twijfel |
| Mollie account geblokkeerd | Hoog | Laag | Stripe als backup instellen, compliance checken |
| Supabase downtime | Gemiddeld | Laag | Database backups, status page monitoring |
| Daimy ziek/onbereikbaar | Hoog | Gemiddeld | AI handelt 90% af, noodplan voor leveranciercontact |

### Juridische risico's

| Risico | Impact | Mitigatie |
|--------|--------|----------|
| AVG-klacht (AI verwerkt persoonsgegevens) | Hoog | Verwerkersovereenkomst met Anthropic, privacy policy updaten |
| Consumentenbescherming (maatwerk retour) | Gemiddeld | Duidelijk communiceren, jurist laten checken |
| AI doet zich voor als mens (misleiding?) | Gemiddeld | Juridisch grijs gebied. Geen wet tegen AI klantenservice in NL. Klant wordt niet benadeeld. |
| Productaansprakelijkheid | Hoog | Aansprakelijkheidsverzekering afsluiten, Sunmaster garantie doorleggen |

### Financiele risico's

| Risico | Impact | Mitigatie |
|--------|--------|----------|
| ROAS < 1 (ads kosten meer dan ze opleveren) | Hoog | Start klein (EUR 50/dag), schaal alleen op bij positieve ROAS. Kill underperformers snel. |
| Cash flow gap (betaling klant -> betaling Sunmaster) | Gemiddeld | Vooruitbetaling door klant (100% bij bestelling). Buffer aanhouden. |
| Seizoensdalingen (okt-feb) | Gemiddeld | Ads budget terugschalen, binnenzonwering pushen (minder seizoensgevoelig) |

---

## Week-per-week Roadmap

### FASE 0: Fundament

| Week | Ma-Di | Wo-Do | Vr |
|------|-------|-------|-----|
| **1** | KvK registratie starten (Daimy). Domein registreren (Daimy). | Mollie account aanmaken + verificatie (Daimy). Claude start AV + privacy docs. | Moneybird account + API koppeling (Claude). |
| **2** | Marge-percentages bepalen (Daimy). Claude past pricing engine aan. | Vercel env vars + productie deploy (Claude). Placeholder reviews verwijderen (Claude). | Go-live checklist doorlopen. Eerste testbestelling (Daimy). |

### FASE 1: Operationeel

| Week | Ma-Di | Wo-Do | Vr |
|------|-------|-------|-----|
| **3** | Sunmaster bestelflow documenteren (Daimy). Admin dashboard bouwen (Claude). | Email flows bouwen -- 6 templates (Claude). Verzendkosten + levertijden instellen (Claude). | Testorder 1 -- eigen bestelling (Daimy). |
| **4** | Admin dashboard afmaken (Claude). Moneybird factuurautomatisering (Claude). | Testorder 2 -- vriend/familie (Daimy). Bugs fixen (Claude). | Testorder 3 -- annulering + refund test (Daimy). FASE 1 review. |

### FASE 2: AI Klantenservice

| Week | Ma-Di | Wo-Do | Vr |
|------|-------|-------|-----|
| **5** | Trengo account opzetten (Daimy). WhatsApp Business nummer koppelen. | Knowledge base schrijven -- 200+ Q&A (Claude). AI bot architectuur bouwen (Claude). | WhatsApp AI bot v1 testen intern (Claude + Daimy). |
| **6** | WhatsApp bot finetunen -- menselijke trucs (Claude). Email AI responder bouwen (Claude). | Escalatie-systeem bouwen -- Telegram naar Daimy (Claude). | Live chat widget integreren op website (Claude). |
| **7** | AI klantenservice intern testen -- 20 scenario's (Daimy + Claude). | Edge cases afvangen (klachten, boze klanten, off-topic). | Persona's finetunen (Lisa, Sjoerd). |
| **8** | Soft launch: eerste echte klanten via AI. Monitoren. | Dagelijks alle gesprekken reviewen (Daimy). Finetunen. | FASE 2 review. Knowledge base aanvullen. |

### FASE 3: Marketing Launch

| Week | Ma-Di | Wo-Do | Vr |
|------|-------|-------|-----|
| **9** | Google Ads account + campagnes opzetten (Claude). | Google Merchant Center + product feed (Claude). SEO content batch 1 -- 5 artikelen (Claude). | Meta Ads account + eerste campagne (Claude). |
| **10** | SEO content batch 2 -- 5 artikelen (Claude). Instagram account lanceren (Claude). | Pinterest account + eerste 20 pins (Claude). Klaviyo email flows bouwen (Claude). | Google Ads optimalisatie -- eerste data analyseren (Claude). |
| **11** | SEO content batch 3 -- 5 artikelen (Claude). Ads optimalisatie (Claude). | Social media content planning 4 weken vooruit (Claude). | Mid-launch review: welke ads werken? Budget herverdelen. |
| **12** | SEO content batch 4 -- 5 artikelen (Claude). Ads opschalen winnende campagnes. | Retargeting campagnes activeren (Claude). | FASE 3 review. KPI's checken (ROAS, CPA, conversie). |

### FASE 4: Reviews & Trust

| Week | Ma-Di | Wo-Do | Vr |
|------|-------|-------|-----|
| **13** | Kiyoh account aanmaken + API koppeling (Claude). | WebwinkelKeur aanvragen (Daimy). Review-uitnodiging flow activeren (Claude). | Google Business Profile aanmaken + verificatie starten (Daimy). |
| **14-16** | Wekelijks: reviews monitoren, reageren op negatieve reviews, AI finetunen. Ads optimaliseren. Social media content. | | |
| **17-18** | WebwinkelKeur certificering afronden. Kiyoh widget op site. Review-incentive programma activeren (foto reviews). | | |
| **19-20** | Social proof elementen op website implementeren. Google Seller Ratings aanvragen (als >100 reviews). FASE 4 review. | | |

### FASE 5: Awards & Top 10

| Week | Ma-Di | Wo-Do | Vr |
|------|-------|-------|-----|
| **21-22** | Thuiswinkel.org lidmaatschap aanvragen. Award-overzicht en deadlines in kaart brengen. | | |
| **23-24** | Shopping Awards inschrijving. Mystery shopping voorbereiding. Webshop Awards inschrijving. | | |
| **25-26** | PR-campagne voorbereiden. Vakpers benaderen (Emerce). Case study schrijven. | | |
| **27-28** | Thuiswinkel Awards inschrijving. Website finepunen voor jury-bezoek. | | |
| **29-30** | Alle awards ingediend. Reveal-materiaal voorbereiden (persbericht, video, social kit). FASE 5 review. | | |

---

## Taakverdeling: Daimy vs. Claude

### Wat Daimy MOET doen (niet automatiseerbaar)

| Taak | Frequentie | Fase |
|------|-----------|------|
| KvK registratie | Eenmalig | 0 |
| Mollie account aanmaken + verificatie | Eenmalig | 0 |
| Domein registreren | Eenmalig | 0 |
| Sunmaster bestelafspraken | Eenmalig + ad hoc | 1 |
| Orders doorplaatsen bij Sunmaster (tot automatisering) | Per order | 1 |
| Trengo account opzetten | Eenmalig | 2 |
| Escalaties afhandelen (boze klanten, complexe klachten) | Ad hoc (~1-5/week) | 2+ |
| Budget goedkeuren voor ads | Maandelijks | 3 |
| WebwinkelKeur aanvraag | Eenmalig | 4 |
| Google Business Profile verificatie | Eenmalig | 4 |
| Award inschrijvingen | Per award | 5 |
| The Reveal: interviews, media optredens | Eenmalig | 6 |
| Dagelijkse review van AI-conversaties (15 min/dag) | Dagelijks | 2+ |

**Geschatte tijdsinvestering Daimy:**
- FASE 0-1: 15-20 uur/week (veel setup)
- FASE 2: 5-10 uur/week (AI neemt over)
- FASE 3+: 3-5 uur/week (monitoring + escalaties)

### Wat Claude AUTONOOM doet

| Taak | Frequentie | Fase |
|------|-----------|------|
| Website development + deployment | Continu | Alle |
| Pricing engine aanpassen | Ad hoc | 0 |
| Juridische documenten opstellen | Eenmalig | 0 |
| Email templates + flows bouwen | Eenmalig + iteratie | 1 |
| Admin dashboard bouwen | Eenmalig + iteratie | 1 |
| WhatsApp AI bot bouwen + runnen | Continu | 2 |
| Email AI responder | Continu | 2 |
| Live chat AI | Continu | 2 |
| Knowledge base onderhouden | Wekelijks | 2+ |
| Google Ads opzetten + optimaliseren | Continu | 3 |
| Meta Ads opzetten + optimaliseren | Continu | 3 |
| SEO content schrijven (20+ artikelen) | Wekelijks | 3 |
| Social media content creeren | 3-5x/week | 3 |
| Email marketing flows | Continu | 3 |
| Review monitoring + reageren | Dagelijks | 4 |
| Analytics rapportages | Wekelijks | 3+ |
| Facturatie via Moneybird API | Per order | 1+ |
| Persbericht + reveal materiaal | Eenmalig | 6 |

---

## Succes-metrics per fase

| Fase | Metric | Target |
|------|--------|--------|
| **FASE 0** | Website live op eigen domein met werkende checkout | Ja/Nee |
| **FASE 1** | Eerste 3 testorders succesvol afgehandeld | 3/3 |
| **FASE 2** | AI beantwoordt 90% van klantvragen zonder escalatie | >90% |
| **FASE 2** | Klant kan niet zien dat het AI is (blind test met 5 personen) | 5/5 |
| **FASE 3** | 50+ bestellingen in eerste maand ads | >50 |
| **FASE 3** | ROAS Google Ads | >3x |
| **FASE 3** | Website traffic | >5.000 sessies/mnd |
| **FASE 4** | Kiyoh/WebwinkelKeur score | >9.0 |
| **FASE 4** | Aantal reviews | >100 |
| **FASE 4** | Google Seller Ratings actief | Ja |
| **FASE 5** | Minimaal 2 award-nominaties | >2 |
| **FASE 5** | Minimaal 1 award gewonnen | >1 |
| **FASE 5** | Totaal bestellingen | >500 |
| **FASE 6** | Media coverage (artikelen) | >10 |
| **FASE 6** | LinkedIn post impressies (Daimy) | >100.000 |

---

## Appendix A: Concurrentiepositie ZonweringDirect vs. Markt

| Criterium | ZonweringDirect | Zonw.-Fabriek (#1) | JVS | Intershades |
|-----------|----------------|---------------------|-----|-------------|
| **Tech stack** | Next.js (modern) | WooCommerce (legacy) | Eigen (legacy) | Eigen (legacy) |
| **Configurator** | Sunmaster live pricing | 6-stappen formulier | Formulier | Geen |
| **Klantenservice** | AI (24/7 gevoel, <5 min) | Email + tel (traag) | Email + tel | WhatsApp + email |
| **Reviews** | Target: 9.2+ | 3.2 Trustpilot | 4.2 Trustpilot | 9.7 WebwinkelKeur |
| **Prijsniveau** | Kwaliteitssegment | Budget-midden | Budget | Midden |
| **Levertijd comm.** | Real-time tracking + updates | Geen | Beperkt | Geen |
| **Keurmerk** | WebwinkelKeur (target) | WebwinkelKeur | -- | WebwinkelKeur |
| **Mobile UX** | 95+ Lighthouse | ~70 | ~60 | ~65 |
| **Operationeel team** | 1 + AI | ~15-20 | ~20-30 | ~5-10 |

---

## Appendix B: AI Klantenservice -- Persona Profiles

### Lisa de Vries (Klantenservice)

```
Naam: Lisa de Vries
Rol: Klantenservice medewerker
Kanalen: WhatsApp, email, live chat
Stijl: Warm, behulpzaam, enthousiast maar niet overdreven
Taal: Informeel Nederlands, tutoyeert
Leeftijd (fictief): 28 jaar
Emoji gebruik: Matig (1-2 per bericht max)
Typische zinnen:
  - "Hoi! Leuk dat je contact opneemt!"
  - "Even voor je nagekeken..."
  - "Snap ik! Ik help je er graag mee."
  - "Top, dan is het geregeld!"
  - "Ik geef dit even door aan mijn collega Sjoerd/Daimy."
Niet zeggen:
  - "Ik ben een AI" (uiteraard)
  - "Bedankt voor uw geduld" (te formeel)
  - "Helaas kan ik u niet helpen" (altijd een oplossing bieden)
```

### Sjoerd van den Berg (Technisch advies)

```
Naam: Sjoerd van den Berg
Rol: Technisch adviseur / montage-expert
Kanalen: WhatsApp (na doorverwijzing door Lisa), email
Stijl: Zakelijk, to-the-point, technisch maar begrijpelijk
Taal: Nederlands, geen onnodig jargon
Leeftijd (fictief): 35 jaar
Emoji gebruik: Minimaal
Typische zinnen:
  - "Goedemiddag. Ik pak je vraag even op."
  - "Bij een kozijn van dat type adviseer ik..."
  - "Let op: meet altijd op 3 punten (boven, midden, onder)."
  - "Als je me een foto stuurt kan ik het beter inschatten."
  - "Dit is prima te doen als DIY-klus, reken op zo'n 45 minuten."
```

---

## Appendix C: Wettelijke Vereisten Webshop NL

| Vereiste | Beschrijving | Status |
|----------|-------------|--------|
| KvK-nummer op website | Verplicht voor elke webshop | FASE 0 |
| BTW-nummer op website | Verplicht | FASE 0 |
| Contactgegevens (adres, email, tel) | Verplicht op elke pagina (footer) | FASE 0 |
| Algemene voorwaarden | Verplicht, beschikbaar voor download | FASE 0 |
| Privacyverklaring | Verplicht (AVG) | FASE 0 |
| Cookiebeleid + consent | Verplicht (ePrivacy) | FASE 0 |
| Herroepingsrecht 14 dagen | Verplicht (maar maatwerk uitgezonderd!) | FASE 0 |
| Duidelijke prijsweergave incl. BTW | Verplicht voor B2C | FASE 0 |
| Verzendkosten zichtbaar voor bestelling | Verplicht | FASE 0 |
| Geschillencommissie vermelding | Aanbevolen (ODR platform EU) | FASE 0 |
| Betaalkosten niet doorberekenen | Verplicht sinds 2018 | Check |
| Levertijd vermelding | Verplicht (max 30 dagen tenzij anders) | FASE 1 |

---

*Dit masterplan is opgesteld op 1 april 2026 op basis van:*
*- Bestaande ZonweringDirect codebase en infrastructuur*
*- Marktonderzoek Nederlandse DIY zonwering markt (maart 2026)*
*- Concurrentieanalyse 7 spelers (maart 2026)*
*- Doelgroeponderzoek met 3 buyer persona's*
*- Sonty operationele ervaring (Trengo, Planado, HubSpot)*

*Het plan is ontworpen om week-per-week uitgevoerd te worden door Daimy + Claude, zonder extern team.*
