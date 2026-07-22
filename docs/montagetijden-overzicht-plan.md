# Plan: montagetijden-overzicht → zelf plannen zonder menselijke hulp

> Opdracht Daimy 2026-07-22: "maak een plan hoe we zo goed mogelijk een overzicht kunnen
> maken van de montagetijden, zodat we uiteindelijk zelf kunnen plannen zonder menselijke
> hulp. Alleen plan, nog niks doen."
> Aanvulling Daimy 22 juli: Planado is nog niet echt gebruikt (niets uit te halen; monteurs
> volgen via Planado komt later). Indicaties nu uit Bookings halen (maar context als
> verdieping ontbreekt daar). Verder cruciaal: klant automatisch berichten voor datumkeuze
> zodra geleverd is, planning bij de juiste mensen, files ontwijken en zo min mogelijk
> reistijd per team.
> Status: PLAN — er is nog niets gebouwd.

## Einddoel
Bij elke getekende offerte berekent het systeem zelf de verwachte montageduur, zoekt een
slot bij de juiste monteur(s), stemt af met de klant en zet de job in Planado — zonder dat
Marijn of Daimy ernaar hoeft te kijken. De montagetijden-tabel is daarvoor het fundament:
zonder betrouwbare duur per product valt er niets te plannen.

## Wat we al hebben (geverifieerd 22 juli)
- **Invullijst** `docs/montagetijden-per-product.md` + Google Sheet "Montagetijden Sonty"
  (per product: 1e element + per extra element) — staat nog LEEG, wacht op Daimy.
- **Planado**: jobtypes/templates per productgroep, shifts, skills, monteurs. Bevestigd
  door Daimy: er is nog niet echt mee gewerkt, dus historisch valt er NIETS uit te halen.
  Planado is het doelsysteem voor straks (monteurs volgen, check-in/uit), niet de bron nu.
- **MS Bookings** (`scripts/bookings-api.js`, eigen Azure-app): historische afspraken met
  duur — dit is volgens Daimy de bron voor eerste indicaties. Beperking: geen context per
  afspraak (1e of 2e verdieping, bereikbaarheid, demontage) — dus alleen bruikbaar als
  ruwe basis, te verrijken via koppeling met offerte/inmeetverslag.
- **Outlook-agenda joey@** (LIVE account): historische montage-afspraken zoals Marijn
  ze inplande — planduur per klus zit impliciet in die blokken (zelfde beperking: context
  ontbreekt).
- **Gripp** (alleen-lezen, zuinig): orders met productregels per klant.
- **Eigen CRM/offerte-tool**: offertes met producttype, aantallen, afmetingen, motor.
- `scripts/planado-scrape-all-jobs.js` bevat al grove duur-heuristiek per trefwoord
  (pergola 480, knikarm/markies 240, rolluik 180, screen 150 min) — een startpunt, geen bron.

## Fase 0 — Data-inventarisatie (½ dag)
1. Bookings-historie ophalen (12-24 mnd terug): hoeveel montage-afspraken, met welke duur,
   welk soort omschrijving? Zelfde voor de Outlook-agenda.
2. Steekproef van 20 klussen: is de koppeling afspraak → klant → offerte/Gripp-order →
   producten betrouwbaar te leggen (op naam/adres/ordernummer)? En staat in offerte of
   inmeetverslag iets over verdieping/bereikbaarheid?
Resultaat: feitenrapport "zoveel klussen, zoveel met product-koppeling, zoveel met context".

## Fase 1 — Historie oogsten: hoe plande de mens het? (1-2 dagen)
De menselijke plankennis zit in Bookings en de agenda. Per historische montage-afspraak:
duur van het blok + gekoppelde producten uit offerte/Gripp + aantal monteurs.
Dat levert per producttype een verdeling op: "1 knikarmscherm werd gemiddeld op X uur
gepland, elke extra op Y". Mediaan gebruiken (uitschieters zijn vaak reistijd of
gecombineerde klussen). Dit is direct het eerste gevulde overzicht — zonder invulwerk.
Het verdieping-probleem (Daimy): klopt, Bookings weet niet of iets 1e of 2e verdieping
was. Deels op te lossen door offerte/inmeetverslag erbij te pakken (staat soms in), en
verder accepteren we dat de historie een GEMIDDELDE over makkelijke en lastige klussen
is — precies goed als startpunt; de toeslagen komen uit fase 3 en echte metingen.
Belangrijk: vanaf nu context WEL vastleggen — bij de datumkeuze-flow (fase 5a) stellen we
de klant 3 korte vragen: welke verdieping, bereikbaarheid achterom, parkeren voor de deur.
Dan bouwt de context-data zichzelf op.

## Fase 2 — Vanaf nu écht meten (zodra het team zover is)
Daimy: monteurs via Planado volgen moet er komen, maar kan nu nog niet. Daarom:
1. **Nu al**: WhatsApp-vangnet — na elke montagedag een 1-taps berichtje aan de monteur
   ("klus bij X klaar? hoe lang echt bezig geweest?"). Laagdrempelig, geen app-discipline
   nodig, en de metingen-database begint vast te groeien.
2. **Later** (moment bepaalt Daimy): Planado check-in/uit als structurele bron zodra het
   team er echt mee gaat werken. Het plan is er klaar voor; dit blokkeert niets.
Elke gemeten klus gaat in `data/montagetijden/metingen.jsonl`: producten, aantallen,
monteurs, gepland, werkelijk, bijzonderheden (hoogte, steiger, oude zonwering demonteren).

## Fase 3 — Het montagetijden-model (1 dag, na fase 1)
Per product een formule in plaats van één getal:
`duur = basistijd(product) + (n-1) × extratijd(product) + toeslagen`
Toeslagen: demontage oude zonwering, verdieping/ladder vs steiger, elektra/motor-aansluiting,
gekoppelde pergola (12 m), inmeten-combinatie. Kalibratie:
- data uit fase 1/2 = uitgangspunt (mediaan per producttype);
- Daimy's invullijst = correctie en vulling van gaten — de lege sheet vervangen door een
  KORT lijstje gerichte vragen ("klopt 2u voor 1e screen? alleen ja/nee of beter getal"),
  dat vult sneller dan 30 lege regels;
- conflicten data vs Daimy → aan Daimy voorleggen, tot die tijd Daimy leidend (fail-closed).

## Fase 4 — Eén beheerbaar overzicht (½ dag)
- Montagetijden als data in de eigen CRM (`sonty-website`), met admin-pagina om tijden
  bij te stellen (zelfde stijl als prijstabellen-beheer). Geen losse sheet als bron:
  de sheet wordt export/weergave, de CRM-tabel is de waarheid (regel: alles naar eigen tool).
- Planado jobtype-standaardduren automatisch vanuit deze tabel bijwerken.
- Elke offerte in de offerte-tool toont vanaf dan de verwachte montageduur.

## Fase 5a — Leverings-trigger + datumkeuze door de klant (kernwens Daimy)
Zodra de bestelling geleverd/binnen is, moet de klant vanzelf bericht krijgen om een
montagedatum te kiezen:
1. **Trigger "geleverd"**: detecteren wanneer materiaal binnen is — bron bepalen in fase 0
   (Gripp-bestelstatus, leveranciersmail Sunmaster/Unilux/Roma, of handmatige "binnen"-tik
   in ons CRM als start). Zonder betrouwbare trigger valt hier niets te automatiseren,
   dus dit is een eigen onderzoekspuntje.
2. **Klantbericht met datumkeuze**: WhatsApp/mail met 2-3 concrete slotvoorstellen (geen
   open "wanneer schikt het", dat wordt pingpongen) + de 3 contextvragen (verdieping,
   achterom, parkeren). Kiezen = bevestigd + in de planning.
3. De aangeboden sloten komen uit de planner (5b) — zo blijven routes en teams kloppen.

> **BESLUIT Daimy 22 juli**: Planado blijft het eindsysteem, maar we bouwen er PAS naartoe
> als alles volledig staat. Tot die tijd: alles lokaal/in eigen tooling ontwikkelen en
> geen Planado-integraties bouwen of Planado-data aanpassen. Route-motor: OSRM + VROOM
> lokaal (V10 akkoord 22 juli), TomTom-API later als verkeerslaag voor de dagplanning.

## Fase 5b — Zelf plannen, in drie treden (na fase 3/4)
**Kernprincipe (Daimy 22 juli)**: de oude planning zette klussen rug-aan-rug met de
reistijd verstopt in de klusblokken (81% had 0 min ertussen). De nieuwe planner splitst
dat expliciet: NETTO montagetijd per klus (uit metingen, fase 2) + reistijd tussen klussen
(uit OSRM/TomTom) als aparte blokken. Daardoor: (a) de klant krijgt een smal
aankomstvenster ("tussen 9:30 en 10:00") in plaats van een dagdeel, met later eventueel
een "monteur is onderweg"-bericht; (b) wij zien per team de verwachte eindtijd van de dag,
dus ook wanneer er ruimte is voor een extra (service)klus of eerder naar huis.
LET OP voor fase 3: de historische medianen uit Bookings zijn dus BRUTO (incl. verstopte
reistijd); netto montagetijden moeten uit de echte metingen komen, de historie is alleen
het startpunt.

De planner moet vier dingen tegelijk goed doen:
- **Duur**: uit het montagetijden-model (fase 3), incl. contextvragen van de klant.
- **Juiste mensen**: skills per producttype (wie mag pergola's, wie elektra), 1 vs 2
  monteurs, vaste teams — vastgelegd in Planado skills + eigen regels-tabel.
- **Zo min mogelijk in de auto**: klussen per dag(deel) clusteren op regio (vaste
  regio-dagen als basis), nieuwe klus toevoegen aan de dag waar hij qua route het minst
  extra rijtijd kost.
- **Files ontwijken**: geen klussen plannen die een team in de spits (7-9 / 16-18) over
  drukke corridors jagen; rijtijden berekenen met verkeer (Google Routes API met
  vertrektijd) en de dagvolgorde daarop optimaliseren.
Treden:
1. **Schaduwplanner** (zoals AI-KS en opvolging): berekent duur + zoekt sloten en logt
   zijn voorstel NAAST wat Marijn echt plant. Wekelijks verschil-rapport naar Daimy.
2. **Voorstel-modus**: per klus 1 Telegram-bericht met het voorgestelde slot;
   1 tik = akkoord → job in Planado + bevestiging naar klant.
3. **Autonoom**: na afgesproken foutmarge (bv. 2 weken ≥90% voorstellen ongewijzigd
   overgenomen) plant hij zelf en meldt alleen uitzonderingen.
Levertijden leverancier (fase 5a-trigger) zijn een harde randvoorwaarde vóór elk slot.

## Fase 6 — Zelflerend houden (doorlopend)
Elke afgeronde job koppelt de werkelijke tijd terug: rolling mediaan per product wordt
automatisch bijgewerkt (met demping, geen wilde sprongen), wekelijks afwijkingsrapport
("screens duren structureel 30 min langer dan gepland") naar Daimy.

## Risico's / aandachtspunten
- **Datakwaliteit**: monteurs die niet in-/uitchecken maken fase 2 waardeloos → teamafspraak
  nodig, anders alleen WhatsApp-vangnet.
- **Kleine aantallen**: zeldzame producten (markies meranti) hebben te weinig klussen voor
  statistiek → daar blijft Daimy's inschatting leidend.
- **Reistijd** hoort niet in montagetijd maar wél in de planning (aparte component).
- **Gripp zuinig** gebruiken (alleen-lezen, batch-opvragen in fase 1, niet per klus live).
- **2-monteurs-klussen**: duur per klus ≠ manuren; beide vastleggen.

## Beslissingen voor Daimy (nog niet beantwoord)
### Antwoorden Daimy 22 juli (via Telegram):
- Magazijn = **Noordeindseweg 256a, 2651LL Berkel en Rodenrijs** (52.0121, 4.4848).
- V6 geleverd-signaal: nu nog niets; straks = **leveringsbevestiging in de planningssheet**
  (order compleet, met controle Gripp bestel- en leveringsbonnen) — daarop bouwt fase 5a.
- V12 skills: matrix klopt tot nu toe; eis: **makkelijk personeel/skills toevoegen** (beheer).
- Werktijden: **zoals nu** — eerste klus 8:00-9:30 (mediaan 8:00), klaar uiterlijk ~17:00.
- V7: geen vaste regio-dagen.
- V8/tijden: Daimy wil een productenlijst om **samen** de maximale montageduur per product
  + variabelen te bepalen (lijst gestuurd 22-07).
- Meten werkelijke tijden: **géén WhatsApp-vangnet — via Planado zodra het team ermee werkt**
  (fase 2 aangepast: tot die tijd blijven het geplande/bruto tijden).
- TomTom: Daimy maakt key aan (Routing API) zodra doorgegeven welke.
- Aparte Sonty-Telegrambot komt er (Daimy maakt aan via BotFather, Claude sluit aan).

### Definitieve efficiëntie-cijfers (exact adres + huidige werktijden):
15,4 → 10,9 uur rijden/week (30% besparing), spits 38% → 28%, efficiëntie 78% → 83%,
~2,3 extra klussen/week. Met ruimere starttijd (tot 10:00): 10,5 u/wk en spits 12%.

## Inschatting
Fase 0-1: 2 dagen werk → eerste gevuld overzicht uit Bookings-historie. Fase 2 (vangnet)
loopt vanaf dag 1 mee. Fase 3-4: 2 dagen. Fase 5a (leverings-trigger + datumkeuze): 2-3
dagen zodra V6 beantwoord is. Fase 5b trede 1 (schaduwplanner): 2-3 dagen, daarna
wekenlang schaduw draaien net als de opvolging. Daimy heeft gelijk dat het uitgebreid is —
maar elke fase levert los al iets bruikbaars op, en niets hoeft in één keer.

## De cirkel (Daimy 22 juli avond): inmeter → magazijn → monteur → facturatie/nabestelling
**Bindend ontwerp-idee: één orderdossier per klant, met productregels die door de hele
keten meegaan.** Het inmeetformulier ÍS de bestelspecificatie, ÍS de magazijnchecklist,
ÍS de picklijst, ÍS de afmeldlijst. Niets wordt overgetypt.

### 1. Inmeter (het begin van alle kwaliteit)
- Vooraf automatisch dossier op telefoon: offerteregels, maten uit configurator, foto's/afspraken uit het klantgesprek (Trengo), adres.
- Digitaal formulier per productregel, MAXIMAAL SIMPEL (Daimy 22-07: geen 10 vragen):
  maten bevestigen (voorgevuld uit offerte, alleen aanpassen wat afwijkt) + 3 VINKJES per
  klus: [demontage oud] [bedraad (elektra nodig)] [lastig bereikbaar / verdieping] + 2-3
  foto's van de montagepunten. De foto's vervangen de overige vragen (ondergrond, obstakels
  ziet de monteur op de foto). Elk vinkje = vaste tijdtoeslag in het montagetijden-model.
- Uitkomst = direct de definitieve bestelling (geen overtypen kantoor) + planner-context.
- Wijkt de inmeting af van de offerte → automatisch herberekenen → klant eerst akkoord, dan pas bestellen.
- **DEAL TER PLEKKE (Daimy 22-07)**: na het invullen rekent de eigen pricing-engine live de
  definitieve offerte uit → PDF op het scherm van de inmeter → klant ondertekent digitaal
  ter plekke (handtekening op scherm + tijdstempel in het dossier) → aanbetalingsfactuur
  gaat direct automatisch de deur uit (mail/WhatsApp, met betaallink) → bestelling gaat
  PAS de deur uit na ontvangst van de 40% aanbetaling (maatwerk, besluit Daimy V17). Geen dagen wachttijd meer tussen
  inmeten en bestellen; klant commit op het moment dat hij het meest enthousiast is.
  Open: V17 aanbetalingspercentage + wanneer bestellen (na tekenen of na betaling)?
  V18 betaallink: hoe betalen klanten nu (bankoverschrijving/iDEAL, welke provider)?

### 2. Magazijn (compleetheid vóór alles)
- Uit de bestelling rolt per order automatisch een checklist: hoofdproduct, doek, motor, zender, bevestigingsset, kappen, enz.
- Elke leverbon wordt afgevinkt tegen die checklist (sluit aan op de bestaande planningssheet + Gripp bestel/leverbon-controle).
- Orderstatus: besteld → deels binnen (met wat mist + verwachte datum) → COMPLEET → klaargezet → mee.
- Datumkeuze naar de klant gaat PAS bij status compleet — nooit meer een monteur op pad met een halve order.
- Avond vóór montagedag: picklijst per team, vaste plek/kar per order.

### 3. Monteur + afmelden (het slot van de cirkel)
Na elke klus één afmeldscherm, drie uitkomsten:
- **KLAAR**: 2-3 opleverfoto's verplicht → triggert facturatie (Gripp), vult het garantiedossier, klant krijgt bedankje + reviewverzoek.
- **KLAAR MET RESTPUNT**: onderdeel aanwijzen uit de orderregels → automatische nabestelling + service-afspraak zodra binnen; facturatiebeleid restpunt = beslissing Daimy (V16).
- **NIET GELUKT**: reden kiezen (niet thuis / maatafwijking / weer) → automatisch herplannen + melding kantoor.
Elke afmelding voedt: facturatie, nabestelling, tijden-database en klantcommunicatie.

### Bouwvolgorde (bij het begin beginnen)
1. Orderdossier-datastructuur + digitaal inmeetformulier (mobiel, eigen CRM)
2. Magazijn-checklist + compleetheids-status (gekoppeld aan planningssheet)
3. Afmeldflow monteurs (klaar/restpunt/niet gelukt)
4. Dan pas de schaduwplanner erbovenop — die heeft dan perfecte input.
Open: V15 wie zet nu de bestelling om naar Sunmaster/Unilux/Roma (kantoor handmatig?);
V16 factureren bij restpunt (alles, deel, of wachten)?

### Antwoorden Daimy 22 juli avond (V13-V20):
- V13: inmeters zijn aparte mensen — nu 1 inmeter, verdeeld over de teams. Eis bevestigd:
  **dashboard om skills aan personeel te koppelen** (personeel/skills-beheer in eigen CRM).
- V14: nog open (wie doet service-klussen).
- V15: bestellen gebeurt nu handmatig; **Daimy geeft alle leverancier-logins** zodat per
  product uitgezocht kan worden hoe de bestelling/meetbonnen in elkaar zitten → basis voor
  (semi-)automatisch bestellen vanuit het inmeetformulier.
- V16: eindfactuur pas als de montage volledig is afgerond; bij restpunt nog NIET factureren.
- V17 (GECORRIGEERD door Daimy 22-07 avond): **40% aanbetaling**, factuur direct na het
  tekenen bij de inmeter, maar **bestellen PAS NA ONTVANGST van de aanbetaling** — het is
  maatwerk, dus geen bestelling zonder betaling. Betaalbewaking in Gripp wordt daarmee de
  bestel-trigger: aanbetaling binnen → order vrijgegeven voor bestellen. Betaalherinneringen
  lopen al volledig via Gripp (Daimy 22-07) — wij bouwen NIETS zelf, we lezen alleen de
  betaalstatus als bestel-trigger.
- V18: klant betaalt per bank of iDEAL; betaalstatus staat in Gripp → factuur- en
  betaalbewaking via Gripp-koppeling (alleen-lezen checken, zuinig).
- V19: montagetijden: voorstel-uit-historie wordt als startpunt vastgezet (montagetijden-v1),
  bijstellen zodra de praktijk (Planado-metingen later) anders laat zien.
- V20: eigen Sonty-bot: nog niet, bewaren voor later.
