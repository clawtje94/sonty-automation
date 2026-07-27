# Gameplan mails in Klaviyo

Opgesteld 27 juli 2026. **Er is nog niets aangemaakt en er wordt niets verstuurd.** Dit is het plan
van de mails zelf: welke, wanneer, aan wie, wat erin staat en hoe ze eruitzien. Pas na akkoord van
Daimy gaan we bouwen.

De infrastructuurkant (subdomein, deliverability, AVG, fasering) staat in
[gameplan-emailmarketing.md](gameplan-emailmarketing.md). Dit document gaat over de inhoud.

---

## 1. Wat het onderzoek zegt, en wat dat voor ons betekent

### Onze eigen cijfers tegen de norm

Twee campagnes is te weinig om een strategie op te bouwen, maar ze wijzen wel scherp in één
richting. Naast de branchecijfers voor 2026 zien ze er zo uit:

| Meting | Sonty maart | Sonty april | Norm 2026 | Oordeel |
|---|---|---|---|---|
| Open rate | 46,8% | 48,5% | 19,2% | **2,4× beter dan gemiddeld** |
| Click rate | 1,5% | 2,3% | 2,4% | onder gemiddeld |
| Afmeldingen | 4,4% | 5,8% | 0,46 tot 0,89% | **5 tot 10× te hoog** |
| Bounces | 2,2% | 0,8% | 2,5% | in orde |
| Spamklachten | 0 | 0 | | goed |

Samen: 6.431 ontvangers, 296 afmeldingen. Bij dat tempo is de lijst na een handvol campagnes op.

**De conclusie is niet "we moeten meer mailen". Het is: mensen openen wél, maar vinden binnen
niets dat over hén gaat, en melden zich daarom af.** Het probleem zit in de inhoud en de
segmentatie, niet in de bereikbaarheid.

### Waarom er niet geklikt werd

Ik heb de twee verstuurde mails opgezocht:

- **"De zon schijnt eindelijk weer ☀️"** bevatte **tien** links: de homepage, vier
  dienstenpagina's, Facebook, Instagram. Geen enkele link ging over de ontvanger zelf.
- **"Vergeet je dit niet?"** bevatte **één** link, naar de homepage. Verstuurd naar mensen die
  al een offerte hadden liggen. Die hadden hun eigen offerte moeten zien.

Het onderzoek is hierover eenduidig: één duidelijke call to action verslaat er consequent drie
die met elkaar concurreren. Tien is geen keuze meer, dat is ruis. En personalisatie moet verder
gaan dan een voornaam: gedrag en dynamische inhoud zijn wat het verschil maken.

Wij hebben precies dat materiaal al klaarliggen, want de WhatsApp-offerte gebruikt al vijf
persoonlijke variabelen: voornaam, waarde vóór korting, bedrag na korting, geldig tot, en de
persoonlijke offertelink. Diezelfde vijf kunnen zo de mail in.

### Wat verder uit het onderzoek komt

| Bevinding | Wat wij ermee doen |
|---|---|
| Segmentatie halveert het afmeldpercentage; ongesegmenteerd stuurt 2× zoveel mensen weg | Nooit meer één mail naar de hele lijst. Alles op segment. |
| 80% van de deals vraagt vijf of meer contactmomenten; 44% stopt na één poging | Onze offerte-opvolging per mail staat nu op nul. Wij plannen er vijf. |
| Vier tot zes contactmomenten is het optimum, bij hoge bedragen een traject van 8 tot 12 weken | Onze mediaan tot akkoord is 24 dagen, 93% valt binnen 60 dagen. Een reeks over 8 weken past exact. |
| Varieer de invalshoek per stap, herhaal niet dezelfde vraag | Elke mail in de reeks heeft een eigen invalshoek: praktisch, bewijs, bezwaar, urgentie. |
| Dark mode is standaard geworden, niet optioneel | Elk sjabloon wordt in licht én donker getest vóór gebruik. |
| Wat er echt toe doet: de grootte van de vraag, dark mode-weergave en lijstkwaliteit | Kleine vraag eerst (kijken mag), niet meteen "koop nu". |

## 2. De uitgangspunten

Zeven regels waar elke mail zich aan houdt. Wijkt een mail hiervan af, dan gaat hij niet live.

1. **Eén doel, één knop.** Meer links mag, maar er is altijd precies één primaire actie.
2. **De mail gaat over de ontvanger.** Zijn product, zijn bedrag, zijn offertenummer, zijn stad.
   Kunnen we die gegevens niet vullen, dan gaat de mail niet uit (dezelfde regel als bij de
   WhatsApp-templates, die vallen bij ontbrekende gegevens ook terug).
3. **Geen mail zonder segment.** Nooit "alles naar iedereen".
4. **Leesbaar zonder afbeeldingen.** Veel clients blokkeren die; de boodschap moet in de tekst staan.
5. **Mobiel eerst en dark mode getest.**
6. **De toon van Jaimy.** Warm en direct, zoals de bot al schrijft. Geen uitroeptekens-marketing.
7. **Afmelden is makkelijk en zichtbaar.** Wie weg wil moet weg kunnen; dat beschermt de rest.

## 3. Het designsysteem in Sonty-stijl

Merk: oranje #FF6B00, zwart #0a0a0a, donkere kaarten #1a1a1a, Figtree als tekstletter.

**Vaste opbouw van elke mail:**

```
  logo, links, klein
  ────────────────────────────────
  KOP            groot, kort, in de taal van de klant
  één alinea     waarom je deze mail krijgt, 2 regels
  ────────────────────────────────
  PERSOONLIJK BLOK   donkere kaart: product, bedrag, offertenummer,
                     geldig tot. Dit is het bewijs dat het over hem gaat.
  [ ORANJE KNOP ]    de enige primaire actie
  ────────────────────────────────
  ondersteuning  1 klantcitaat of 1 concreet feit, geen lijst van 6
  ────────────────────────────────
  afzendblok     Jaimy, foto, telefoonnummer, showroomadres
  afmelden       zichtbaar, niet weggemoffeld
```

**Vier sjablonen**, meer hebben we niet nodig:

| Sjabloon | Waarvoor | Kenmerk |
|---|---|---|
| `offerte` | alles rond een lopende offerte | persoonlijk blok is de kern, één knop naar de eigen offerte |
| `uitnodiging` | showroom en afspraak | grote foto van de showroom, één knop naar de agenda |
| `verhaal` | seizoen, inspiratie, cross-sell | drie producten met beeld, één knop naar één pagina |
| `service` | na montage: review, nazorg, garantie | tekstueel, vriendelijk, geen verkoop |

**Beeld.** Higgsfield gebruiken we voor sfeerbeeld en achtergronden, nooit voor het product zelf.
Dat is een harde regel die we al hebben: een klant moet het échte product zien, geen AI-versie
ervan. Productfoto's komen uit de eigen fotografie en het leveranciersmateriaal.

## 4. De mails

Hieronder per mail: de trigger, het segment, het onderwerp, de ene actie en de inhoud. Onderwerp
en preview staan er telkens in twee varianten in, want die gaan we tegen elkaar testen.

---

### Reeks A — Offerte-opvolging (het grootste gat)

Er gaat nu **geen enkele** automatische opvolgmail uit. De bestaande flow in Reuzenpanda
("Herinnering na 6 en 10 dagen") staat uit. Vijf momenten, verdeeld over acht weken, aansluitend
op de gemeten doorlooptijd: mediaan 24 dagen, 93% binnen 60 dagen.

Elke mail stopt de reeks zodra de klant akkoord geeft, een afspraak boekt of antwoordt. En hij
gaat niet uit als de klant in de laatste 48 uur al iets van ons kreeg via WhatsApp of van een
collega, zodat we nooit dubbel op hetzelfde moment binnenkomen.

| # | Wanneer | Invalshoek | Onderwerp (A / B) | De ene actie |
|---|---|---|---|---|
| A1 | dag 2 | praktisch: is alles duidelijk? | "Je offerte voor {{product}}" / "Even kijken of alles klopt" | Bekijk je offerte |
| A2 | dag 7 | bewijs: hoe het eruitziet bij anderen | "Zo staat het bij {{plaats}}" / "Even laten zien wat het wordt" | Bekijk je offerte |
| A3 | dag 14 | bezwaar wegnemen: zien en voelen | "Wil je het eerst even zien?" / "Even langskomen in de showroom?" | Plan je showroombezoek |
| A4 | dag 28 | keuze makkelijk maken | "Nog twijfel over {{product}}?" / "Zal ik iets voor je uitzoeken?" | Stel je vraag |
| A5 | dag 45 | eerlijke afsluiting | "Zal ik je offerte laten staan?" / "Nog interesse, of zullen we hem sluiten?" | Ja, ik wil verder |

**Waarom A5 zo geformuleerd is.** Een eerlijke afsluitmail ("zal ik hem sluiten?") krijgt vaak de
meeste reacties van de hele reeks, omdat hij de ontvanger een makkelijke uitweg biedt en juist
daardoor een antwoord uitlokt. Hij houdt bovendien de lijst schoon: wie nee zegt, hoeft de rest
niet meer te krijgen. Dat is precies wat ons afmeldpercentage nodig heeft.

**Wat er in A1 staat** (als voorbeeld van de opbouw, definitieve tekst volgt na akkoord):

> **Onderwerp:** Je offerte voor twee zipscreens
> **Preview:** Even kijken of alles klopt, dan help ik je verder
>
> Hoi {{voornaam}},
>
> Je hebt sinds {{datum}} een offerte van ons liggen. Ik wil even checken of alles erin staat
> zoals je het voor je ziet.
>
> [donkere kaart: {{product}} · {{aantal}} stuks · **{{bedrag}}** · offertenummer {{nummer}} ·
> geldig tot {{datum}}]
>
> [ **Bekijk je offerte** ]
>
> Klopt er iets niet, of wil je een andere kleur of maat? Stuur gerust een berichtje terug, dan
> pas ik het voor je aan.
>
> Groet, Jaimy van Sonty

---

### Reeks B — Showroom (de sterkste hefboom die we hebben)

Wie de showroom bezoekt gaat volgens de eigen cijfers in ongeveer 75% van de gevallen akkoord.
Geen enkele andere campagne komt daarbij in de buurt. Deze reeks verdient daarom het beste beeld
en de meeste aandacht.

| # | Trigger | Onderwerp (A / B) | De ene actie |
|---|---|---|---|
| B1 | klikte in A2 of A3 maar boekte niet | "Even zien en voelen?" / "Kom je langs in Rijswijk?" | Kies een moment |
| B2 | 3 dagen na B1, niet geboekt | "Zaterdag ook open" / "Wanneer schikt het jou?" | Kies een moment |
| B3 | 1 dag vóór het bezoek | "Tot morgen, {{voornaam}}" | Route en openingstijden |
| B4 | 1 dag na het bezoek | "Fijn dat je er was" | Bekijk je aangepaste offerte |

B3 en B4 zijn service, geen verkoop, maar ze horen bij de reeks omdat ze het bezoek laten
doorlopen tot een beslissing.

---

### Reeks C — Reactivering koude offertes (het grootste volume)

Doelgroep: 9.198 offertes uit 2026 zonder akkoord, plus de oudere jaargangen. **Dit is de reeks
waar de meeste afmeldingen zullen vallen**, en dus de reeks waar segmentatie en dosering het
strengst moeten zijn.

Aanpak: niet alles in één keer. In blokken van een paar honderd, per productcategorie en per
seizoen, zodat de boodschap klopt met wat iemand ooit wilde. Wie zonwering aanvroeg krijgt in het
voorjaar iets anders dan wie in november naar shutters keek.

| # | Wanneer | Invalshoek | Onderwerp (A / B) | De ene actie |
|---|---|---|---|---|
| C1 | vanaf dag 60 | herkenning, geen verkoop | "Je zocht ooit {{product}}" / "Is het er nooit van gekomen?" | Bekijk wat het nu kost |
| C2 | +7 dagen, alleen bij opening | wat er sindsdien veranderd is | "Nieuwe kleuren, andere prijzen" / "Dit is er veranderd sinds toen" | Vraag een nieuwe prijs aan |
| C3 | +14 dagen, alleen bij klik | uitnodiging | "Even vrijblijvend kijken?" | Plan je showroombezoek |

C2 en C3 gaan alleen naar wie iets deed met de vorige mail. Wie C1 negeert, krijgt niets meer.
Zo blijft de reeks kort voor wie niet geïnteresseerd is, en dat drukt de afmeldingen.

---

### Reeks D — Bestaande klanten, cross-sell

2.780 klanten met minstens één factuur. Wie buitenzonwering kocht heeft binnen nog niets, en
andersom. Dit is ook de manier om het jaar rond te maken: zonwering piekt in het voorjaar,
raamdecoratie en shutters juist in het najaar.

| # | Wanneer | Onderwerp (A / B) | De ene actie |
|---|---|---|---|
| D1 | 3 maanden na montage | "Hoe bevalt je {{product}}?" | Vertel het ons (review) |
| D2 | najaar | "Nu de dagen korter worden" / "Binnen is het nieuwe buiten" | Bekijk raamdecoratie |
| D3 | bij nieuw product of actie | "Nieuw bij Sonty" | Bekijk het |

---

### Reeks E — Service en nazorg

Verkoopt niets, maar houdt de lijst gezond en levert reviews op. Een lijst die alleen verkoopmail
krijgt, brandt op; dat is precies wat er in maart gebeurde.

| # | Wanneer | Onderwerp | De ene actie |
|---|---|---|---|
| E1 | 1 week na montage | "Alles naar wens?" | Laat het weten |
| E2 | 2 weken na montage | "Wil je ons helpen?" | Plaats een review |
| E3 | jaarlijks | "Even onderhoud voor je zonwering" | Lees de tips |
| E4 | bij garantie-einde | "Je garantie loopt af" | Bekijk je opties |

---

### Losse campagnes

Twee tot vier per jaar, seizoensgebonden, altijd op segment en nooit naar de hele lijst. Dit is
het type mail dat in maart is verstuurd; met segmentatie en één actie in plaats van tien zou
diezelfde mail het aanzienlijk beter moeten doen.

## 5. Hoe we testen

Alles wat hierboven met "A / B" staat, wordt ook echt zo getest. De discipline is dezelfde als
bij de lopende WhatsApp-test, waar vier offertes per groep niets bewezen:

1. **Eén ding tegelijk.** Eerst onderwerpregels, want daar is het volume het snelst genoeg voor.
   Daarna pas de knop, dan het verzendmoment, dan het beeld.
2. **Vooraf de omvang bepalen.** Bij een verwachte click rate rond 2% zijn er per variant
   honderden ontvangers nodig voordat een verschil betekenis heeft. Dat wordt vooraf vastgelegd,
   niet achteraf bepaald.
3. **Gelijk verdelen**, niet op toeval.
4. **Holdout van 10%** per reeks: die krijgt bewust niets. Zonder die groep weten we nooit of de
   omzet door de mail kwam of toch was gekomen.
5. **Winnaar wordt standaard**, verliezer eruit, nieuwe uitdager erbij. Wekelijkse cyclus met een
   rapport op Telegram, zoals de A/B-rapportage voor WhatsApp nu al doet.

## 6. Waar we op sturen

Niet op opens. Die zeggen sinds Apple Mail Privacy Protection weinig, en juist onze opens zijn al
uitstekend; daar valt de winst niet te halen.

| Wat | Nu | Waar we naartoe willen | Waarom |
|---|---|---|---|
| Afmeldingen | 4,6% | onder 0,5% | belangrijkste gezondheidsmeter; segmentatie halveert dit volgens onderzoek |
| Click rate | 1,5 tot 2,3% | boven 4% | met een persoonlijke offertelink in plaats van de homepage is dat haalbaar |
| Akkoorden uit mail | onbekend | meetbaar maken | dit is het enige cijfer dat echt telt |
| Marge uit mail | onbekend | meetbaar maken | € 1.551 per klant, dus één extra klant per week is € 80.000 per jaar |

De keten mail → klik → offerte → akkoord → marge is te sluiten, omdat het e-mailadres aan het
Reuzenpanda-dossier hangt en aan de akkoordregel in de offerte-sheet.

## 7. Wat er in Klaviyo al staat

Het account bestaat sinds mei 2024 en is half ingericht. Voor we bouwen moet dit opgeruimd:

| Wat | Stand | Actie |
|---|---|---|
| Lijsten | 10, deels overlappend en verouderd | terugbrengen naar segmenten op basis van live data |
| Grootste lijst "Offerte verstuurd" | 5.250 profielen | aanvullen: in Reuzenpanda staan 15.976 adressen |
| "Zapier koppeling" | 3.964 profielen | uitzoeken wat die koppeling doet voor we hem vertrouwen |
| Flows | 4, waarvan 3 concept en 1 live | de live flow ("Offerte aanvraag gedaan SMS en mail") nalopen |
| Sjablonen | 2 | vervangen door de vier nieuwe |
| Segmenten | 0 | dit is waar het werk zit |

Dat er nul segmenten zijn, verklaart het afmeldpercentage van 4,6% vrijwel volledig: er is tot nu
toe alleen naar hele lijsten gestuurd.

## 8. Wat ik van Daimy nodig heb voor we bouwen

1. **Akkoord op de reeksen A tot E**, of schrappen wat je niet wilt.
2. **Toon**: is Jaimy als afzender goed, of moet het Sonty als merk zijn?
3. **Mag de reactiveringsmail (C) korting noemen**, en zo ja hoeveel? Ik houd me anders aan het
   bestaande mandaat van de bot.
4. **Startvolume**: met hoeveel mensen mogen we reeks C beginnen? Mijn voorstel is 200 per keer.
5. **Beeldmateriaal**: hebben we showroomfoto's en projectfoto's die we mogen gebruiken, of maak
   ik sfeerbeeld met Higgsfield?
6. **De vraag uit het vorige plan staat nog open**: waarom staat de herinneringsflow in
   Reuzenpanda uit? Als die aan mag terwijl wij bouwen, is dat de snelste winst.

Zodra 1 tot 3 rond zijn kan ik de segmenten en sjablonen in Klaviyo aanmaken. Er gaat geen enkele
mail de deur uit tot jij dat zegt.

---

**Bronnen bij het onderzoek**

- [Email Marketing Benchmarks by Industry 2026 — WebFX](https://www.webfx.com/blog/marketing/email-marketing-benchmarks/)
- [Email Marketing Benchmarks: Region & Industry Data 2026 — Brevo](https://www.brevo.com/blog/email-marketing-benchmarks/)
- [Email marketing benchmarks 2026 — Klaviyo](https://www.klaviyo.com/uk/blog/email-marketing-benchmarks-open-click-and-conversion-rates)
- [7 Ways to Reduce Your Unsubscribe Rate — Klaviyo](https://www.klaviyo.com/blog/7-ways-to-reduce-unsubscribe-rate)
- [Klaviyo Segmentation Strategies 2026 — ReferralCandy](https://www.referralcandy.com/blog/klaviyo-segmentation-strategies-the-complete-guide-to-boosting-ecommerce-revenue-in-2026)
- [10 Follow-Up Email Best Practices for B2B Sales 2026 — Martal](https://martal.ca/follow-up-email-lb/)
- [Sales Follow-Up: Timing, Templates & 7 Proven Tactics — Cognism](https://www.cognism.com/blog/sales-follow-up)
- [15 Top Email Design Best Practices & Tips for 2026 — Klaviyo](https://www.klaviyo.com/blog/email-design-tips)
- [Email Call to Action Best Practices for 2026 — Prospeo](https://prospeo.io/s/email-call-to-action-best-practices)
- [Email Accessibility and Design Best Practices in 2026 — emfluence](https://emfluence.com/blog/email-accessibility-and-design-best-practices-in-2026)
