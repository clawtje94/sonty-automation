# Plan: montagetijden-overzicht → zelf plannen zonder menselijke hulp

> Opdracht Daimy 2026-07-22: "maak een plan hoe we zo goed mogelijk een overzicht kunnen
> maken van de montagetijden, zodat we uiteindelijk zelf kunnen plannen zonder menselijke
> hulp. Alleen plan, nog niks doen."
> Status: PLAN — er is nog niets gebouwd.

## Einddoel
Bij elke getekende offerte berekent het systeem zelf de verwachte montageduur, zoekt een
slot bij de juiste monteur(s), stemt af met de klant en zet de job in Planado — zonder dat
Marijn of Daimy ernaar hoeft te kijken. De montagetijden-tabel is daarvoor het fundament:
zonder betrouwbare duur per product valt er niets te plannen.

## Wat we al hebben (geverifieerd 22 juli)
- **Invullijst** `docs/montagetijden-per-product.md` + Google Sheet "Montagetijden Sonty"
  (per product: 1e element + per extra element) — staat nog LEEG, wacht op Daimy.
- **Planado**: jobtypes/templates per productgroep, shifts, skills, monteurs. Eerste
  100 jobs via API zijn allemaal toekomstig (published/scheduled); geen afgeronde jobs
  met werkelijke start/eindtijden gevonden. Werkelijke duur-data is er dus (nog) niet of
  nauwelijks — fase 0 moet dit definitief vaststellen.
- **Outlook-agenda joey@** (LIVE account): de historische montage-afspraken zoals Marijn
  ze de afgelopen jaren inplande — planduur per klus zit impliciet in die blokken.
- **Gripp** (alleen-lezen, zuinig): orders met productregels per klant.
- **Eigen CRM/offerte-tool**: offertes met producttype, aantallen, afmetingen, motor.
- `scripts/planado-scrape-all-jobs.js` bevat al grove duur-heuristiek per trefwoord
  (pergola 480, knikarm/markies 240, rolluik 180, screen 150 min) — een startpunt, geen bron.

## Fase 0 — Data-inventarisatie (½ dag)
1. Alle Planado-jobs pagineren: hoeveel afgerond, hebben afgeronde jobs werkelijke
   start/stop (check-in/uit monteursapp) of alleen geplande duur?
2. Outlook-agenda historie ophalen: hoeveel montage-afspraken staan er (12-24 mnd terug),
   met duur en omschrijving?
3. Steekproef van 20 klussen: is de koppeling afspraak → klant → offerte/Gripp-order →
   producten betrouwbaar te leggen (op naam/adres/ordernummer)?
Resultaat: feitenrapport "zoveel klussen, zoveel met product-koppeling, zoveel met echte tijden".

## Fase 1 — Historie oogsten: hoe plande de mens het? (1-2 dagen)
De menselijke plankennis zit in de agenda. Per historische montage-afspraak:
duur van het blok + gekoppelde producten uit offerte/Gripp + aantal monteurs.
Dat levert per producttype een verdeling op: "1 knikarmscherm werd door Marijn gemiddeld
op X uur gepland, elke extra op Y". Mediaan gebruiken (uitschieters zijn vaak reistijd
of gecombineerde klussen). Dit is direct het eerste gevulde overzicht — zonder dat er
iemand iets hoeft in te vullen.

## Fase 2 — Vanaf nu écht meten (doorlopend, start meteen)
Geplande tijd ≠ werkelijke tijd. Twee opties, samen te gebruiken:
1. **Planado check-in/uit**: monteurs starten/stoppen de job in de app. Kost discipline;
   afspraak met het team nodig (Daimy). Dit is de nette, structurele bron.
2. **Vangnet**: dagelijkse cron vergelijkt geplande jobs met daadwerkelijke resolutie-tijd
   (updated_at bij afronden) en/of laat de monteur via een 1-taps WhatsApp-bericht
   ("klaar? hoe lang?") de echte tijd bevestigen.
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

## Fase 5 — Zelf plannen, in drie treden (na fase 3/4)
1. **Schaduwplanner** (zoals AI-KS en opvolging): bij elke getekende offerte berekent hij
   duur + zoekt sloten (Planado shifts, skills per producttype, regio-clustering zodat
   monteurs niet kriskras rijden, buffer voor uitloop) en logt zijn voorstel NAAST wat
   Marijn echt plant. Wekelijks verschil-rapport naar Daimy.
2. **Voorstel-modus**: planner stuurt Daimy/Marijn per klus 1 Telegram-bericht met het
   voorgestelde slot; 1 tik = akkoord → job in Planado + bevestiging naar klant.
3. **Autonoom**: na een afgesproken foutmarge (bv. 2 weken lang ≥90% voorstellen
   ongewijzigd overgenomen) plant hij zelf en meldt alleen uitzonderingen.
Levertijden leverancier (bestelling binnen?) zijn een harde randvoorwaarde vóór het slot —
meenemen vanaf trede 1.

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
- V3: akkoord met deze volgorde (eerst historie oogsten, dan meten, dan pas planner)?
- V4: mogen monteurs verplicht in-/uitchecken in de Planado-app, of liever het
  WhatsApp-vangnet?
- V5: korte gerichte vragenlijst i.p.v. de lege sheet invullen — goed?

## Inschatting
Fase 0-1: 2 dagen werk → eerste gevuld overzicht. Fase 2 loopt vanaf dag 1 mee.
Fase 3-4: 2 dagen. Fase 5 trede 1 (schaduwplanner): 2-3 dagen, daarna wekenlang schaduw
draaien net als de opvolging. Realistisch: binnen ~2 weken een betrouwbaar
montagetijden-overzicht, autonoom plannen in schaduw daarna direct te starten.
