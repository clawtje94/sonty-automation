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
- V3: akkoord met deze volgorde (eerst historie oogsten uit Bookings, dan meten, dan planner)?
- V4 (beantwoord 22 juli): Planado-tracking komt later, kan nu nog niet → we starten met
  het WhatsApp-vangnet. Open deelvraag: wanneer wil Daimy het team echt op Planado hebben?
- V5: korte gerichte vragenlijst i.p.v. de lege sheet invullen — goed?
- V6: wat is nu het betrouwbaarste signaal dat een bestelling geleverd is (Gripp-status,
  leveranciersmail, of handmatige tik)? Bepaalt hoe snel 5a kan.
- V7: zijn er vaste regio-dagen of vaste teams waar de planner rekening mee moet houden?

## Inschatting
Fase 0-1: 2 dagen werk → eerste gevuld overzicht uit Bookings-historie. Fase 2 (vangnet)
loopt vanaf dag 1 mee. Fase 3-4: 2 dagen. Fase 5a (leverings-trigger + datumkeuze): 2-3
dagen zodra V6 beantwoord is. Fase 5b trede 1 (schaduwplanner): 2-3 dagen, daarna
wekenlang schaduw draaien net als de opvolging. Daimy heeft gelijk dat het uitgebreid is —
maar elke fase levert los al iets bruikbaars op, en niets hoeft in één keer.
