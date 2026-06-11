# Sonty AI Sales Bot — WhatsApp

## Het probleem
- Verkopers reageren te laat (uren/dagen ipv minuten)
- Geen follow-up als klant niet reageert
- Geen consistente sales flow
- Bezwaren worden niet goed afgehandeld
- Leads worden koud omdat niemand opvolgt

## De oplossing
Een AI sales agent die via WhatsApp:
1. Binnen **2 minuten** reageert na offerte
2. Vragen beantwoordt als een expert
3. Bezwaren afhandelt
4. De offerte aanpast als nodig
5. De klant naar akkoord begeleidt
6. Zichzelf verbetert op basis van resultaten

---

## Sales Flow — De 7 Stappen

### Stap 1: Eerste Contact (0-2 min na offerte)
**Doel:** Warm maken, vertrouwen opbouwen

> Hi [naam]! 👋 Jaimy hier van Sonty.
>
> Ik zag dat je een [product] hebt geconfigureerd voor je woning.
> Super keuze! Hierbij je prijsindicatie:
> [offerte link]
>
> Even kort: dit is een eerste indicatie. Na het inmeten maken
> we een definitief voorstel — vaak valt de prijs dan nog mee
> omdat we alles precies op maat maken.
>
> Heb je vragen over het product of de prijs? Ik help je graag!

**Waarom dit werkt:**
- Snel (binnen minuten)
- Persoonlijk (naam + specifiek product)
- Verwachtingen managen (indicatie, niet definitief)
- Positief frame (prijs valt vaak mee)
- Open uitnodiging voor vragen

### Stap 2: Engagement (als klant reageert)
**Doel:** Behoeften ontdekken, expertise tonen

De bot beantwoordt vragen over:
- Producten (specs, kleuren, materialen)
- Prijzen (wat zit erin, wat niet)
- Installatie (hoe lang, wat is nodig)
- Vergelijking met concurrenten

**Verkoop-tactiek:** SPIN selling
- **S**ituatie: "Welke kant is je terras op?" "Hoeveel zon krijg je?"
- **P**robleem: "Last van de hitte? Of meer privacy?"
- **I**mplicatie: "Zonder zonwering wordt het binnen al snel 35+ graden"
- **N**eed-payoff: "Met een knikarmscherm heb je direct 8-10 graden verschil"

### Stap 3: Bezwaar Afhandeling
**Doel:** Twijfels wegnemen

| Bezwaar | Antwoord |
|---------|----------|
| "Te duur" | "Begrijpelijk. Onze prijzen zijn inclusief inmeting + montage. Bij veel concurrenten komt dat er nog bij. Wil je dat ik een vergelijking maak?" |
| "Moet overleggen" | "Natuurlijk! Zal ik je een samenvatting sturen die je kunt delen? En wanneer kan ik even terugkomen?" |
| "Nog vergelijken" | "Slim! Waar let je op bij het vergelijken? Dan kan ik je helpen de juiste keuze te maken." |
| "Twijfel over product" | "Snap ik. Wil je langskomen in onze showroom? Dan kun je alles zien en voelen. Of ik kom bij je langs met stalen." |
| "Later" | "Prima! Wanneer past het je? Dan plan ik een herinnering in zodat ik je niet vergeet 😊" |

### Stap 4: Showroom/Inmeting Push
**Doel:** Fysiek contact → conversie verhoging (10x!)

> Wist je dat je welkom bent in onze showroom in Rijswijk?
> Daar kun je alle materialen zien en voelen.
> 90% van de klanten die langskomen gaan over tot bestelling.
>
> [booking link]
>
> Of als je liever niet rijdt: we komen gratis bij je langs
> voor een inmeting. Dan nemen we alle stalen mee.

### Stap 5: Offerte Aanpassing (als nodig)
**Doel:** Klant krijgt precies wat ze willen

Als klant wijzigingen wil:
- Bot past offerte aan via RP API
- Stuurt nieuwe offerte link
- "Ik heb de aanpassing doorgevoerd. Bekijk je nieuwe voorstel:"

### Stap 6: Closing
**Doel:** Akkoord krijgen

> Fijn dat alles duidelijk is! Om verder te gaan:
>
> 1. Klik op "Akkoord" in je offerte
> 2. We plannen dan een gratis inmeetafspraak
> 3. Na inmeting krijg je het definitieve voorstel
> 4. Bij akkoord plannen we de montage in
>
> Heb je nog vragen voor je akkoord gaat?

### Stap 7: Follow-up (als geen reactie)
**Doel:** Lead warm houden

- **Na 1 dag:** "Hi [naam], heb je de offerte kunnen bekijken?"
- **Na 3 dagen:** "Even een update: we hebben momenteel [X weken] levertijd. Wil je er nog even over praten?"
- **Na 7 dagen:** "Ik wilde even checken of je nog interesse hebt. Geen druk — als je vragen hebt ben ik er!"
- **Na 14 dagen:** Laatste poging + seizoenskorting als relevant

---

## Technische Architectuur

```
Klant stuurt WhatsApp
    ↓
Trengo ontvangt bericht
    ↓ (webhook naar onze server)
    ↓
┌──────────────────────────────┐
│     AI Sales Engine          │
│                              │
│  Input:                      │
│  - Klant bericht             │
│  - Gesprekhistorie           │
│  - Klant's offerte data      │
│  - Product catalog           │
│  - Sales playbook            │
│  - Succesvolle gesprekken    │
│                              │
│  Claude API:                 │
│  - Begrijp intentie          │
│  - Kies strategie            │
│  - Genereer antwoord         │
│  - Bepaal acties             │
│                              │
│  Acties:                     │
│  - Stuur WhatsApp antwoord   │
│  - Pas offerte aan (RP API)  │
│  - Plan follow-up            │
│  - Update HubSpot deal stage │
│  - Escaleer naar mens        │
└──────────────────────────────┘
    ↓
Trengo stuurt antwoord via WhatsApp
```

## Wat de bot WEL doet
- Vragen beantwoorden over producten en prijzen
- Offerte aanpassen (product, hoeveelheid, kleur)
- Showroom/inmeting inplannen
- Follow-up berichten sturen
- Deal stage updaten in HubSpot
- Eenvoudige bezwaren afhandelen

## Wat de bot NIET doet (escalatie naar mens)
- Klachten of problemen
- Complexe technische vragen (maatwerk installatie)
- Onderhandeling over grote kortingen (>10%)
- Klant vraagt expliciet om een mens
- Klant is boos of gefrustreerd

## Zelflerend Systeem

### Data die we verzamelen per gesprek:
- Alle berichten (klant + bot)
- Offerte details
- Uitkomst: akkoord / verloren / nog open
- Tijdstip van reacties
- Aantal berichten tot akkoord
- Welke bezwaren kwamen er
- Welke antwoorden werkten

### Maandelijkse evaluatie:
1. **Win-rate per sales stap** — waar haken mensen af?
2. **Beste antwoorden** — welke reacties leiden tot akkoord?
3. **Gemiddelde tijd tot close** — wordt de bot sneller?
4. **Bezwaar-analyse** — nieuwe bezwaren → nieuwe antwoorden
5. **A/B tests** — twee versies van een bericht, welke werkt beter?

### Hoe het beter wordt:
- Succesvolle gesprekken → voorbeelden voor de AI
- Mislukte gesprekken → analyse waarom + verbeterd antwoord
- Nieuwe bezwaren → automatisch toegevoegd aan playbook
- Seizoenspatronen → timing van follow-ups optimaliseren

---

## Productkennis die de bot nodig heeft

### Producten
- Knikarmscherm (Suneye, etc.)
- Uitvalscherm
- Screens (zip, solar)
- Rolluiken
- Markiezen
- Pergola
- Raamdecoratie (binnen)

### Per product:
- Beschrijving en voordelen
- Prijsrange (van-tot)
- Beschikbare kleuren/materialen
- Installatie tijd
- Levertijd
- Garantie
- Onderhoud
- Veelgestelde vragen

### Sonty USPs:
- 3000+ tevreden klanten
- 4.9/5 Google reviews (500+)
- Sunmaster premium dealer
- Gratis inmeting
- Eigen monteurs (geen onderaannemers)
- Showroom in Rijswijk
- Alles-in-één (zonwering + raamdeco + behang)

---

## Bouwfasen

### Fase 1: Basis Bot (week 1-2)
- [ ] Trengo webhook opzetten (ontvang berichten)
- [ ] Claude API integratie (genereer antwoorden)
- [ ] Basis productkennis laden
- [ ] Antwoord sturen via Trengo API
- [ ] Gesprekhistorie bijhouden
- [ ] Escalatie naar mens

### Fase 2: Sales Intelligence (week 3-4)
- [ ] SPIN selling logica inbouwen
- [ ] Bezwaar herkenning + afhandeling
- [ ] Follow-up scheduler (1, 3, 7, 14 dagen)
- [ ] HubSpot deal stage updates
- [ ] Showroom/inmeting push

### Fase 3: Offerte Aanpassing (week 4-5)
- [ ] RP API: offerte aanmaken/kopiëren
- [ ] Product wijzigingen doorvoeren
- [ ] Nieuwe offerte link sturen
- [ ] Prijs herberekening

### Fase 4: Zelflerend (week 5-6)
- [ ] Gesprek logging + analyse
- [ ] Win/loss tracking per stap
- [ ] A/B testing framework
- [ ] Maandelijkse performance rapportage
- [ ] Automatische playbook updates

---

## Oude Data Gebruiken

### Wat we NIET overnemen:
- Slechte verkooptechnieken
- Te langzame reacties
- Niet-opvolgen van leads

### Wat we WEL gebruiken:
- **Veelgestelde vragen** → FAQ voor de bot
- **Bezwaren die klanten hadden** → betere antwoorden bouwen
- **Succesvolle gesprekken** → als voorbeelden voor de AI
- **Product vragen** → kennis uitbreiden
- **Prijsgevoeligheid** → begrijpen wanneer korting nodig is
