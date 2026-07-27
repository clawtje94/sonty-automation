# Masterplan mailflows Sonty

Opgesteld 27 juli 2026. Opdracht Daimy: "de dikste mailflows die je kan hebben, die mensen ook
gewoon leuk vinden, en op de juiste momenten met zon of thema's verstuurd."

Er wordt niets verstuurd tot Daimy dat zegt. Alles komt als concept klaar te staan.

---

## 1. Het idee erachter

Zonwering verkoop je niet met een nieuwsbrief. Je verkoopt het op het moment dat iemand er last
van heeft: de eerste warme dag, de week dat het 32 graden wordt, de avond dat de zon in het
televisiescherm staat. Datzelfde geldt omgekeerd voor binnen: raamdecoratie verkoopt in het
najaar, als het vroeg donker wordt en het huis kouder aanvoelt.

Daarom staan er drie soorten mails in dit plan, en die drie samen maken het verschil:

1. **Reisflows.** Volgen de klant vanaf zijn aanvraag. Vast ritme, altijd persoonlijk.
2. **Weerflows.** Kijken naar de weersverwachting en slaan toe als het weer de verkoop doet.
3. **Seizoensflows.** Volgen de kalender, met per periode een ander verhaal.

Wat ze gemeen hebben: elke mail gaat over deze klant, met zijn product, zijn bedrag en zijn
offerte. Geen algemene reclame; dat was precies waar de campagne van maart op stukliep (46,8%
opende hem, 1,5% klikte, 4,4% meldde zich af).

## 2. Waarom weer werkt, met onze eigen cijfers

De weersverwachting is gratis en veertien dagen vooruit op te vragen (Open-Meteo, geen sleutel
nodig). Op het moment van schrijven staat er over twee dagen 32,2 graden in Rijswijk.

Wat dat waard is: er liggen 5.320 koude offertes en 1.860 lopende. Een mail die precies op de dag
vóór een hittegolf binnenkomt bij iemand die al een offerte voor zonwering heeft liggen, is geen
reclame maar een gunst. Dat is het verschil tussen "koop nu" en "let op, het wordt warm".

**De drempels** (Rijswijk als middelpunt van het werkgebied):

| Trigger | Voorwaarde | Naar wie | Hoe vaak |
|---|---|---|---|
| Hitte op komst | max ≥ 29 °C binnen 3 dagen | koud + lopend, buitenzonwering | max 1× per 21 dagen |
| Warme week | 3 dagen op rij ≥ 25 °C | koud, buitenzonwering | max 1× per 30 dagen |
| Eerste lentedag | eerste dag ≥ 20 °C na 1 maart | koud + zeer koud, buiten | 1× per jaar |
| Donkere dagen | zonuren < 4 en het is oktober of later | koud, binnen | max 1× per 30 dagen |

Harde grenzen, want dit is precies het soort automatisme dat kan ontsporen: nooit meer dan één
weermail per klant per 21 dagen, nooit meer dan 400 ontvangers per dag, en alleen binnen bot-uren.

## 3. Alle flows

### Reisflows

**A. Offerte-opvolging** (5 mails, dag 2 tot 45) — al beschreven in
[gameplan-mails-klaviyo.md](gameplan-mails-klaviyo.md). Dit is het grootste gat: er gaat nu geen
enkele opvolgmail uit.

**B. Showroombezoek** (4 mails) — de sterkste hefboom, want daar gaat ongeveer 75% akkoord.

**C. Reactivering** (4 mails) — 5.320 koude en 3.209 zeer koude offertes.

**D. Cross-sell** (3 mails) — 792 klanten, wie buiten kocht heeft binnen nog niets.

**E. Service en nazorg** (4 mails) — houdt de lijst gezond en levert Google-reviews op.

### Weerflows (nieuw)

**F1. Het wordt warm.**
Trigger: 29 graden of meer binnen drie dagen. Aan: openstaande offerte voor buitenzonwering.
Toon: behulpzaam, niet opdringerig. "Even een seintje: donderdag wordt het 32 graden."
De ene actie: bekijk je offerte. Onderaan eerlijk vermelden dat levertijd meespeelt, want niemand
heeft zonwering vóór donderdag.

**F2. Eerste mooie dag van het jaar.**
Trigger: eerste dag boven de 20 graden na 1 maart. Aan: koude en zeer koude offertes voor buiten.
Dit is het moment waarop mensen weer aan hun terras denken. Eén keer per jaar, dus het mag een
opvallende mail zijn.

**F3. Donkere dagen.**
Trigger: vanaf oktober, dagen met minder dan vier uur zon. Aan: koude offertes voor binnen.
Verhaal: raamdecoratie scheelt tocht en maakt het huis warmer, en het is nu rustiger bij ons dan
in het voorjaar.

### Seizoensflows

Zes momenten per jaar, elk met een eigen verhaal. Altijd op segment, nooit naar de hele lijst.

| Periode | Thema | Doelgroep |
|---|---|---|
| Half februari | Voorjaar plannen, nu nog rustig bij ons | koud, buiten |
| April | Hoogseizoen, levertijden lopen op | koud + lopend, buiten |
| Juni | Vakantie en hitte, laatste kans voor de zomer | koud, buiten |
| September | Naar binnen: raamdecoratie en shutters | klanten + koud, binnen |
| November | Donker en koud: rolluiken isoleren echt | klanten met buiten, koud |
| Januari | Nieuw jaar, plannen voor het voorjaar | alles wat koud is |

### Overige

**G. Welkom** (2 mails) — direct na de aanvraag. Nu doet Reuzenpanda alleen een bedankmail.
**H. Verjaardag van de installatie** (1 mail per jaar) — "een jaar geleden geplaatst, alles nog
naar wens?" Levert service-momenten en reviews op.

Totaal: **32 mails** over dertien flows.

## 4. Hoe we voorkomen dat het te veel wordt

Dit is het echte risico van een plan als dit. Iemand kan in vier flows tegelijk zitten.

1. **Frequentiegrens**: maximaal twee Sonty-mails per klant per veertien dagen, ongeacht de flow.
2. **Voorrangsvolgorde** als er meerdere tegelijk willen: service gaat vóór verkoop, een lopende
   offerte gaat vóór reactivering, en weer gaat vóór seizoen.
3. **Stilte na contact**: heeft de klant in de laatste 48 uur iets van ons gehad via WhatsApp,
   mail of een collega, dan schuift de mail door.
4. **Uitstappen bij succes**: geeft iemand akkoord of boekt hij een afspraak, dan stopt elke
   verkoopflow onmiddellijk.
5. **Opt-out is heilig**: staat iemand op "geen herinnering meer", dan valt hij uit alle
   segmenten. Dat is al ingebouwd en geldt voor 876 adressen.
6. **Sunset**: wie een half jaar lang niets opent, gaat eruit. Een dode lijst verpest de
   afleverbaarheid voor de rest.

## 5. Volgorde van uitvoeren

| Stap | Wat | Status |
|---|---|---|
| 1 | Vier sjablonen in huisstijl, stijlbewaking, segmenten, 15.700 profielen | **af** |
| 2 | Weermotor bouwen en meten wat hij zou doen, zonder te sturen | in uitvoering |
| 3 | Extra sjablonen: weer, seizoen, welkom, verjaardag | volgt |
| 4 | Alle teksten schrijven in Sonty-stijl, langs de stijlcontrole | volgt |
| 5 | Frequentiebewaking bouwen | volgt |
| 6 | Alles als concept in Klaviyo klaarzetten | volgt |
| 7 | Daimy laat één flow los op een kleine groep, met holdout | wacht op akkoord |

## 6. Wat er nooit gebeurt

- Geen mail zonder dat de klant erin voorkomt met zijn eigen gegevens.
- Geen mail buiten werktijd.
- Geen tweede mail als de eerste al vandaag ging.
- Geen enkele verzending zonder dat Daimy het per flow heeft vrijgegeven.
