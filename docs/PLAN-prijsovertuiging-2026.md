# UITWERKING: de klant heeft al gekozen vóórdat de prijsvraag opkomt

Opgesteld 5 augustus 2026, na de prijsverhoging van 3 augustus. Gebaseerd op:
4.163 Trengo-gesprekken (89 expliciete prijsbezwaren), 281 echte offertes,
peer-reviewed onderzoek (bronnen onderaan) en de sales-literatuur (SPIN, Challenger).
Alles wat in een tekst staat is teruggevoerd op code, data of de algemene voorwaarden.

**Status: NIETS hiervan staat live. Elke tekst gaat eerst langs Daimy.**

---

## 0. DE VIER PRINCIPES (akkoord Daimy 5 aug)

1. **Nooit onszelf duur noemen, nooit excuseren voor de prijs.** Challenger-toon:
   wij leren de klant waar het geld in zonwering zit en houden de regie. Het bedrag
   staat er zelfverzekerd, met de opbouw ernaast. Geen "soms is dat verschil terecht",
   geen "soms is iets goedkopers prima".
2. **Alle investering zit vóór het bedrag.** 70% van de prijsbezwaren is het
   állereerste bericht dat de klant terugstuurt (mediaan 3,9 uur na de offerte).
   Alles wat ná het bedrag komt bereikt 3 van de 10. Het gevecht wordt gewonnen in
   mail 0, de regel boven het getal en het eerste WhatsApp-bericht.
3. **Bij bezwaar: showroom vóór korting.** Warm verkeer koopt 3-4× zo vaak; nu wordt
   de showroom in 9 van de 89 bezwaargevallen genoemd en gaat het playbook drie keer
   omlaag in prijs. Korting is het laatste redmiddel, nooit de eerste reflex.
4. **Nooit het vergelijken zélf uitnodigen.** De grootste groep schrikkers (34 van 95)
   heeft géén andere offerte, alleen een fantasiegetal. Een mail "je gaat vast
   vergelijken" plant het idee bij mensen die het niet hadden. Dezelfde inhoud wordt
   als les gebracht: "waar het geld in zonwering zit."

## 1. HET INZICHT (nulmeting, ligt vast)

- 89 prijsbezwaren op 4.163 gesprekken; **70% is het eerste inbound bericht**, mediaan 3,9 uur.
- 83,3% van de klanten die een offerte krijgt zegt daarna **helemaal niets meer** (2.836 van 3.406).
- Van de 95 prijsberichten: 34 alleen "te duur" zonder reden, 26 noemen een concurrent,
  15 noemen expliciet een verwachtingsverschil, 20 vragen om een goedkoper alternatief.
- Na een bezwaar reageert 51 van de 89 nooit meer; 9 van de 89 herstelt (10%).
- Sleutelzin uit de data: *"Het zal vast wel zitten in de details"* — de klant wíl een
  reden en vindt hem nergens.
- Eén klant vertrok om de 40% aanbetaling terwijl onze regeling juist gunstig is
  (rest pas binnen 7 dagen ná montage, nooit meer dan de helft vooruit) — staat nergens.

## 2. WAT ER NU STAAT EN WAT HET WORDT

| Moment | Nu | Wordt |
|---|---|---|
| Aanvraag binnen | Formulierleads: niets. Configurator: 3 zinnen | Mail 0 naar álle leads: wat er straks in de prijs zit + betaalregeling |
| Eerste WhatsApp | Bedrag in zin 2, framing = korting op eigen brutoprijs | 5e A/B-variant: bedrag mét "daarin zit {opsomming uit de echte offerteregels}" |
| Onder het bedrag (mail) | "Deze prijs geldt nog tot [datum]" | "In dit bedrag zit alles om het werkend aan je gevel te krijgen: …" + meereken-verwijzing |
| Boven de handtekening | 6 bullets, 4 niet te staven | 6 natelbare feiten met artikelnummers (tekst H) |
| Bij bezwaar (bot) | Budget vragen → downsellen → korting | Erkennen → wat zit erin → **showroom** → alternatief → korting als laatste |
| Dag 3 | "We zijn benieuwd wat je ervan vindt" | Betaalregeling + wat er na inmeten kan schuiven (tekst F) |
| Dag 6 | "Je offerte verloopt bijna" (3 klokken) | Les: waar het geld in zonwering zit + eigen projectfoto's + showroom (tekst G) |

## 3. DE DEFINITIEVE TEKSTEN

### Tekst A — vijfde WhatsApp-variant (A/B tegen de bestaande vier)
Landt in: `scenario-buttons.js` (SLOTS) + nieuwe Meta-template + `ab-template-verdeler.js`
+ `offerte-template-vars.js` (variabele {{3}} = opsomming uit de échte offerteregels).

> Hi {{1}}, Jaimy hier van Sonty.
> Je prijsindicatie staat klaar: {{2}} euro. Daarin zit {{3}}. Btw inbegrepen, er komt niets meer bij.
> Bekijk je offerte hier: {{4}}
> {{5}}

Slot: *"Op je offerte staat bij elk product wat een ander model of een andere bediening
zou kosten, plus of min. Zo zie je zelf waar je op kunt sturen."*
{{3}} per offerte samengesteld: met motor+montage → "het scherm, de Somfy-motor, het
inmeten, de montage, het klein materiaal, het afstellen en het opruimen"; zonder motor
of montage: aangepaste varianten. Werk: groot (Meta-goedkeuring is de bottleneck — wel
nu indienen, niet op wachten).

### Tekst B — prijsbezwaar-playbook bot
Landt in: `system-prompt.js` (vervangt 413-421 en stap 3 van 308-318). Herkenning en QA-poort ongewijzigd.

> **Bij "te duur" of prijsschrik**
> 1. Erken kort wat de klant zegt, zonder eromheen te draaien. Noem Sonty nooit duur.
> 2. Benoem wat er in het bedrag zit. Alleen: inmeten (niets bij opdracht, anders €75 en
>    dat zeggen we vooraf), montage, klein materiaal, afstellen, opruimen, btw,
>    3 jaar garantie montage / 5 product / 7 Somfy-motor. En: ondeugdelijke montage is
>    onze verantwoordelijkheid, artikel 14.5 algemene voorwaarden.
> 3. Noem NOOIT: aantallen klanten of reviews, "geen onderaannemers", "gratis inmeten"
>    zonder de 75-euroregel, of wat concurrenten wel/niet doen.
> 4. Bied de showroom aan vóórdat je over geld begint: "Je voelt het verschil beter dan
>    je het leest. Kom langs in Rijswijk, dan zet ik de modellen naast elkaar en zie je
>    meteen waar het geld in zit."
> 5. Pas daarna een goedkoper alternatief doorrekenen (prijs_berekenen) en zeggen wat het scheelt.
> 6. Korting blijft het laatste redmiddel, mandaat ongewijzigd.

Werk: klein + regressierun over `data/sunny-testbank`.

### Tekst C — kennisbank-tegenspraak
`trengo-kennisbank.md:764` ("We werken niet met kunstmatige hoge prijzen…") →
*"Wat op je offerte staat is wat je betaalt. Inclusief montage en btw, en er komt na de
montage geen narekening."* Regels 605-611 (China/Turkije, "veel concurrenten bieden
minder") gaan eruit zonder vervanging. Werk: klein.

### Tekst D — mail 0, bevestiging naar ÁLLE leads
`mail-templates.ts` (aanvraagBevestigingMail) + aanroep toevoegen in
`app/api/contact/route.ts` en `app/api/offerte/route.ts` (sturen nu niets).
Onderwerp: **Je aanvraag is binnen, dit zit er straks in de prijs**

> Hoi [voornaam],
> Je aanvraag is bij ons binnen. Binnen 24 uur op werkdagen krijg je een prijsvoorstel per mail en WhatsApp.
> Zodat je dat bedrag straks meteen kunt plaatsen, alvast wat erin zit:
> - het product, en als er een motor in zit is dat altijd een Somfy;
> - het inmeten bij je thuis. Gaat de opdracht door, dan rekenen we daar niets voor. Gaat hij niet door, dan is het 75 euro en dat melden we vooraf;
> - de montage, het klein materiaal, het afstellen van de motor en het meenemen van het verpakkingsmateriaal;
> - 3 jaar garantie op de montage, 5 jaar op het product, 7 jaar op de motor;
> - de btw.
> Over betalen: 40 procent bij opdracht, de rest pas binnen zeven dagen nadat het hangt. Meer dan de helft vooruit vragen we nooit.
> Bij het voorstel staat per product wat een ander model of een andere bediening zou kosten, plus of min. Zo kun je zelf sturen op wat je uitgeeft. Bellen mag ook: 085 006 9681.
> Groet, Jaimy

"Gratis inmeting"-regel (203) vervalt. Werk: middel (dubbele-mail-check configuratorleads).

### Tekst E — onder de knop in de prijsvoorstel-mail (vervangt geldigheidRegel)
> In dit bedrag zit alles wat nodig is om het werkend aan je gevel te krijgen: het product, de motor als die erin zit, het inmeten, de montage, het klein materiaal, het afstellen en het opruimen van de verpakking. En de btw.
> Op de offerte staat per product wat een ander model of een andere bediening kost, plus of min. Zo zie je zelf waar je op kunt sturen.
> Bij het inmeten controleren we je maten. Wijkt het bedrag daardoor af, dan hoor je dat voordat we bestellen. Tien centimeter breder scheelt bij de meeste producten tussen de 25 en 50 euro.

(Bandbreedte nagerekend op het prijsboek met opslag 1,20: 23-35 €/10cm voor de meeste
modellen, 45-78 voor SunControl/SunEye XL/pergola.)
Tegelijk verplicht in hetzelfde bestand: GARANTIE_REGELS 5→3 jaar montage, en de
FAQ-vraag "Hebben jullie eigen monteurs?" → *"Wie doet de montage? Die doen wij, het
hoort bij de opdracht. Is de montage niet goed, dan is dat onze verantwoordelijkheid.
Artikel 14.5 van onze algemene voorwaarden."*

### Tekst F — dag 3 (herinneringMail)
Onderwerp: **Twee dingen die vaak de vraag zijn bij je voorstel**
> Hoi [voornaam],
> Je prijsvoorstel staat er nu een paar dagen. Twee dingen waar mensen meestal naar vragen.
> **Wanneer je wat betaalt.** 40 procent bij opdracht, de rest binnen zeven dagen nadat het hangt. Meer dan de helft vooruit vragen we nooit.
> **Wat er nog kan schuiven.** Bij het inmeten controleren we je maten. Verandert het bedrag daardoor, dan hoor je het voordat we bestellen. Bij de meeste producten praat je over 25 tot 50 euro per tien centimeter, geen honderden euro's. En meerwerk doen we alleen als jij daar opdracht voor geeft, met de prijs vooraf.
> Wil je iets goedkoper of juist zwaarder: op je offerte staat bij elk product wat dat kost, plus of min. Bellen kan ook, 085 006 9681.

### Tekst G — dag 6 (HERSCHREVEN t.o.v. workflow-versie: les, geen vergelijk-uitnodiging)
Onderwerp: **Waar het geld in zonwering zit**
> Hoi [voornaam],
> Drie dingen bepalen wat zonwering kost, en je ziet ze niet op een foto.
> **De motor.** Bij ons zit er standaard een Somfy in, met 7 jaar garantie. Een motor is het onderdeel dat het eerst slijt, en vervangen buiten de garantie is een aparte klus met een aparte rekening.
> **De montage.** Bij ons zit die in het bedrag, met het klein materiaal, het afstellen en het opruimen. En is de montage niet goed, dan is dat onze verantwoordelijkheid, ongeacht welke ploeg er bij je staat. Artikel 14.5 van onze algemene voorwaarden.
> **Het doek en het profiel.** Die bepalen of je scherm bij wind nog uit kan en hoe het er over tien jaar uitziet. De specificaties van jouw voorstel sturen we op verzoek gewoon door.
> Hieronder een paar schermen die wij zelf hebben gehangen. Wil je het in het echt zien en voelen: onze showroom staat aan de Frijdastraat 8F in Rijswijk.
> [drie foto's uit portfolio-gallery.json, gefilterd op de categorie van deze offerte]

Werk: middel (foto's in de mail is nieuw; per categorie: screens 184, knikarm 161,
rolluik 106, markies 50, raamdeco 206, pergola 29). Openingstijden pas na verificatie.

### Tekst H — vervanging WAAROM_SONTY_TEXT (boven de handtekening, 278/281 offertes)
Landt in: `cron-offerte-controle-v4-combined.js:755` + `cron-offerte-controle-v3.js:354`
+ `cron-markiezen.js:27` + `apply-enhance-gecontroleerd.js:14`.
LET OP: `addWaaromSontyBlock` is idempotent op de string "Waarom Sonty" — check mee
veranderen, anders dubbele blokken op bestaande offertes.

> **Wat er in dit bedrag zit**
> - Het inmeten bij je thuis. Gaat de opdracht door, dan rekenen we daar niets voor. Gaat hij niet door, dan bedragen de inmeetkosten 75 euro, en dat melden we vooraf.
> - De montage, het klein materiaal, het afstellen van de motor en het meenemen van het verpakkingsmateriaal.
> - 3 jaar garantie op de montage, 5 jaar op het product, 7 jaar op de Somfy-motor.
> - Is de montage niet goed, dan is dat onze verantwoordelijkheid, ongeacht welke ploeg bij je op de stoep staat. Artikel 14.5 van onze algemene voorwaarden.
> - Meerwerk voeren we alleen uit als jij daar opdracht voor geeft, en we noemen de prijs vooraf. Artikel 12.1.
> - Je betaalt 40 procent bij opdracht, de rest binnen zeven dagen na de montage. Meer dan de helft vooruit vragen we nooit.
> Alle bedragen zijn inclusief btw.

### Tekst I — regel onder het totaal (OfferteView.tsx:471-475 + OfferteBrochure.tsx:381-388)
> Bij het inmeten controleren we je maten. Verandert het bedrag daardoor, dan hoor je dat voordat we bestellen: tien centimeter breder scheelt bij de meeste producten 25 tot 50 euro. Meerwerk doen we alleen als jij daar opdracht voor geeft, met de prijs vooraf. Alle bedragen zijn inclusief btw, inmeten, montage, klein materiaal, afstellen en opruimen.

### Tekst J — de akkoordzin (OfferteView.tsx:539-542)
> Ik ga akkoord met deze offerte voor € X incl. btw en geef Sonty toestemming om de inmeting in te plannen. Hierin zitten het inmeten, de montage, het klein materiaal, het afstellen en het opruimen, met 3 jaar garantie op de montage, 5 jaar op het product en 7 jaar op de motor. Wijken de maten na het inmeten af, dan hoor ik het nieuwe bedrag voordat er iets besteld wordt.

### Structuuringreep offertepagina
Tekenblok (482-573) staat boven alle argumentatie (575-665) → tekst H komt direct onder
het totaal en boven het tekenen. Weg: zekerheden-tegel "Geen onderaannemers" (613) en
de vier cijfers boven de prijs (282-296: 500+ reviews, 3000+ projecten, 24u reactie).
Verplicht responsive-check.

### Reparatie zonder tekst: het meereken-blok rekent op bruto
`cron-offerte-controle-v4-combined.js:1103-1137` + `lib/offerte-tool/verrijking.ts:229-249`:
diff wordt vóór de 15% groepskorting berekend, klant betaalt ná. "-€370" is echt -€314,50,
"+€195 Tahoma" is echt +€165,75. Bij voorraadschermen is het blok om precies deze reden
al uitgezet; bij de rest staat het aan. Fix: kortingspercentage doorgeven en diff ×
(1 - korting/100), plus regel: *"Deze bedragen zijn wat je er netto bij of af betaalt,
inclusief de korting die op je offerte staat."* Regressierun over de 281 backups.

## 4. WAT ER NOOIT MEER IN MAG (uit de scepticus- en waarheidstoets)

- Reviewgetallen ("600+", "597") — bron is een bevroren scrape. Wél: één ondertekend,
  publiek controleerbaar citaat (C Luscuere: *"…zeker geen prijzige partij na
  onderzoek"*), pas na akkoord Daimy over citeren.
- "Geen onderaannemers" / aantallen ploegen / "allemaal in dienst" — `montage-teams.json`
  spreekt "2 van de 5" tegen. Vervanger is altijd artikel 14.5 ("door of namens Sonty").
- "Onze leveranciers hebben verhoogd, wij berekenen alleen door" — niet te staven uit
  prijsconfig.json (dat zijn onze eigen opslagen). Kleurloze variant tot Daimy bevestigt.
- "Projecten bij jou in de buurt" — portfolio-data heeft geen plaats. Wel: "schermen die
  wij zelf hebben gehangen", per producttype.
- Concurrenten afvallen (China/Turkije-blok), absolute woorden ("uitsluitend",
  "de beste", "altijd"), drie klokken op één bedrag, downsellen als eerste reflex,
  argumenten stapelen (6 natelbare > 12 waarvan 4 omvallen).

## 5. VOLGORDE VAN INVOEREN

**Blok 1 — deze week: wat aantoonbaar onwaar is moet weg.** (voorwaarde voor de rest)
1. WAAROM_SONTY_TEXT → tekst H (4 bestanden). 2. GARANTIE_REGELS 5→3 + monteurs-FAQ.
3. "Geen onderaannemers" uit OfferteView.tsx:613 + 03-definitieve-offerte.html.
4. "Gratis inmeting" uit mail-templates.ts:203. 5. Vier cijfers boven de prijs weg.
6. sonty-welkom.html herschrijven vóór de Klaviyo-flow ooit aangaat.
7. wa-templates.md: "Daimy"→"Jaimy", "gratis opmeting" eruit.

**Blok 2 — deze week: meereken-blok laten kloppen.** (enige unieke argument; bedient de
20 alternatiefvragers; regressierun over 281 backups)

**Blok 3 — volgende week: mail 0 naar alle leads.** (grootste bereik, minste moeite; de
enige mail die zeker vóór het bedrag aankomt)

**Blok 4 — volgende week: teksten rond het bedrag** (E, F, G, I, J + structuuringreep).

**Blok 5 — parallel: botplaybook** (B en C; klein, direct meetbaar via QA-poort).

**Blok 6 — bij Meta indienen, niet op wachten: 5e WhatsApp-variant** (A; hoogste
potentie want daar valt 70% van de bezwaren; A/B-baar tegen de bestaande varianten).

## 6. BESLISPUNTEN DAIMY (geen bouwwerk)

1. **De permanente 15%.** Staat op 271 van 281 offertes; alleen de naam rouleert. Een
   anker dat nooit echt is ondermijnt elk getal dat wél klopt. Opties: echt tijdelijk
   maken, of brutoprijs verlagen en korting laten vervallen. Raakt de marge → jouw keuze.
2. **Citeren van Google-reviews met naam** (C Luscuere) — mag dat?
3. **Openingstijden showroom**: vijf verschillende versies (voorwaarden art. 1.1,
   /showroom, kennisbank, OfferteView, mailhandtekening) incl. tegenspraak over vrij
   binnenlopen. Eén waarheid vaststellen; tot die tijd geen tijden in teksten.
4. **Is de verhoging een leveranciers-doorberekening?** Bepaalt of de kostenreden
   (Kahneman: dan is hij "eerlijk") genoemd mag worden.
5. **Ploegen: hoeveel in dienst / zzp?** Tot bevestigd: geen aantallen, alleen art. 14.5.
6. **3 jaar montagegarantie contractueel hard?** Art. 14.2 verwijst naar de offerte —
   dan is de offerte de juiste plek, maar dan moet hij overal gelijk zijn.
7. **Levertijd**: drie versies in één traject (4-6 wk / 8-10 wk / 2-4 wk). Eén waarheid.

## 7. HOE WE METEN OF HET WERKT

Naast het weekrapport-conversie (hoofdmeter, methode-Daimy 3 aug):
1. **Prijsbezwaarratio** (bezwaren ÷ verstuurde offertes per week).
2. **Aandeel bezwaren dat het eerste inbound bericht is** (nu 70% — dé meter voor dit plan).
3. **Herstelratio na bezwaar** (nu 10%).
4. **Showroom-aanbod na bezwaar** (nu 9/89; procesmaat voor de bot).
5. **Gemiddelde korting per akkoord** (groupDiscount + sonnyKorting — het geldbewijs:
   werkt waardeverdediging, dan daalt de korting bij gelijke conversie).

Niets concluderen vóór eind augustus (mediaan offerte→akkoord is 24 dagen). Voetnoot in
het eerste rapport: prijsverhoging 3 aug + website stond t/m 5 aug 9,1% onder de
offerteprijs.

## BRONNEN
Karmarkar/Shiv/Knutson JMR 2015 (price primacy, fMRI) · Kahneman/Knetsch/Thaler AER 1986
(dual entitlement) · Mohan/Buell/John Marketing Science 2020 (kostentransparantie) ·
Buell/Norton Management Science 2011 (operational transparency) · Gourville JCR 1998
(pennies-a-day, grens bij grote bedragen) · Boulding (garantie als signaal) · Rackham,
SPIN Selling (35.000 gesprekken: bezwaar voorkomen > behandelen, -55%) · Dixon/Adamson,
The Challenger Sale (leren + regie wint) · Cialdini, Pre-Suasion (privileged moments) ·
Ein-Gar e.a. JCR 2012 (blemishing werkt NIET bij aandachtige lezers → geen
duurder-bekentenissen) · eigen data: 4.163 gesprekken, 281 offertes, 89 bezwaren.
