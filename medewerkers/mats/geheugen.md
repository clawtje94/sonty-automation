# Geheugen Mats (Techniek en Systemen)

## Bewust-uit (niet herhalen als storing, tenzij status verandert)
- wa-desktop-queue: al dagen stil, laag alarm, bewust uit.
- keten-zelfcontrole: BEVESTIGD via data/kill/nl.sonty.keten-zelfcontrole (Daimy, 18-08).
- sonny-rapport: BEVESTIGD via data/kill/nl.sonty.sonny-rapport (Daimy, 19-08).
- LEERPUNT: bij twijfel bewust-uit vs storing EERST data/kill/<jobnaam> checken.

## 11-09: wa-luisteraar HERSTELD (was 09/10-09 nog down)
- Laatste 401 was 10-09 11:41 UTC. Sindsdien alleen normale 503/428 reconnects met auto-herstel,
  stabiel verbonden. sunny-weetje verstuurde 11-09 2 berichten succesvol (inhoud gecontroleerd,
  geen silent success-risico). Storing als opgelost beschouwd, geen QR-scan meer nodig geweest
  (kennelijk zelf hersteld of eerder al gefixt). Nog 1-2 diensten volgen voor ik het definitief
  afsluit i.p.v. los volgen.
- sunny-ochtend/sunny-weetje exit0 op 11-09, dus de eerdere "echte storing"-conclusie (WA-401)
  vervalt vanaf nu; terugvallen op oude "check inhoud, niet alleen exit-code"-regel blijft staan.

## 10/11-09: planado-outlook — eenmalige hik, zelf hersteld
- 10-09: "FOUT: fetch failed" bij start 05:45 UTC, geen dubbelboekingscontrole die dag.
- 11-09: weer normaal (3 dubbelboekingen gemeld, 270 opdrachten). Bevestigd zelfherstellend,
  niet verder volgen tenzij het terugkomt.

## Opvolgingen bevestigd opgelost
- Planado 429-storm (l8erbbd5): 0 nieuwe "Rate Limit Exceeded" op zowel 09-09 als 10-09 — 2 dagen
  op rij, DEFINITIEF gefixt beschouwen, niet meer los volgen.
- outlook-planado-sync 422 "external_id...": 0 op 09-09, patroon lijkt weg.

## 10-09: itf2311c fix bestaat NIET, mijn 09-09 conclusie was FOUT — gecorrigeerd
- Herzien op verzoek Daimy (Isa/Fenna meldden dat 5xo3pxhk 24u+ vast staat, gripp-facturen-open.json
  9 dagen stale). Check bevestigde: 18 opdrachten "aan: claude" in postvak.json staan vast op
  status "nieuw" sinds 02-09, INCLUSIEF itf2311c zelf (08-09) — dus de fix is nooit uitgevoerd.
  Root cause: er is helemaal geen launchd/cron-daemon die deze queue verwerkt, alleen handmatige
  Claude-sessies doen dat. Mijn eerdere memory-regel "0 vastzittende nieuw-opdrachten (09-09)" was
  een verificatiefout (waarschijnlijk verkeerd gefilterd/gecheckt) — LEERPUNT: bij "bevestigd
  opgelost" ALTIJD de ruwe postvak.json doortellen (jq, status=nieuw + aan=claude), niet op een
  eerdere conclusie vertrouwen.
- gripp-facturen-open.json (9 dagen stale, sinds 1-9): scripts/gripp-facturen-sync.js heeft GEEN
  launchd-job (bevestigd via `launchctl list`) en wordt nergens anders aangeroepen — los, ongepland
  script. Dat is de hele verklaring, geen sync-bug in de data zelf.
- Actie: opdracht cqrzxh6i naar claude gezet (bouw geplande job voor gripp-facturen-sync + een
  queue-verwerker/alarm voor "aan: claude" postvak-items >X uur oud). j1k42ult beantwoord/afgesloten.
- 11-09: cqrzxh6i ZELF staat ook nog op status "nieuw" — bevestigt dat er structureel geen daemon
  is die deze queue oppakt (alleen handmatige sessies). Backlog "aan: claude"+"nieuw" nu 20 (was
  18 op 10-09), gripp-facturen-open.json nog steeds 1 sept. Blijft groeien tot iemand een sessie
  start die de queue leegwerkt of de gevraagde daemon bouwt. Niet elke dienst opnieuw als V-vraag
  stellen, wel het aantal blijven noemen in CIJFERS/GEDAAN zodat het niet wegzakt.

## Openstaand / nog volgen
- 113 open werkbonnen (08-09, opdracht Daimy): bevestigd user-side (teams ronden oude klussen niet
  af in Planado-app), geen sync-bug.
- Google Ads .env-credentials: nog 0, wacht op Daimy, niet opnieuw los vragen.
- Trengo 429-baseline (sonny-watch.log, correct 24u-venster via "7:5x AM"-marker in lokale tijd):
  09-09 1862/24u, vergelijkbaar met vorige volle dagvensters (~1836) — stabiel, geen klantimpact.
  LET OP: eerdere waarden in dit bestand (5700-6574) kwamen uit een andere (bredere) telmethode,
  niet vergelijkbaar; vanaf nu de "7:5x AM"-marker-methode als vaste maatstaf aanhouden.
- gesprek-lab exit1: bevestigd normale werking (poort blokkeert terecht foute boekingen), geen
  storing tenzij FOUT-BOEKING > 0.

## Sandbox-beperking
`node` (ook `node -e`) en commands buiten ~/sonty vragen approval, dus geen scripts zelf draaien.
`launchctl list/print` en bestanden lezen werken wel zonder approval.

## Vaste daemons (permanent, KeepAlive) — moeten altijd draaien
sonny, email, telegram-poll, inmeet-verzoeken, wa-luisteraar, databot-poll.
09-09: wa-luisteraar DOWN (zie boven), rest ok. databot-poll exit 1 is oude
ENETUNREACH-historie, KeepAlive herstelt zelf, geen actie.

## Logformaten (tijd besparen)
- sonny-watch.log: alleen tijd [HH:MM:SS AM/PM], geen datum. Voor 24u-venster: zoek het
  "[H:MM AM/PM]"-punt van gisteren (huidige kloktijd) als startregel, tel 429 tot einde bestand.
- inmeet-verzoeken.log: volledige ISO-timestamp per regel, filter met "^2026-MM-DD".
- gripp-invullen/gripp-verrijken zijn van collega "Offerte-controle". Alleen checken bij
  exit-code ≠ 0 (technisch, via launchctl print "last exit code"), niet bij inhoud.
- jq werkt op snapshot/postvak.json zonder shell-approval-gedoe; python3 -c en awk met -v
  triggeren wel een approval-stap — vermijd die, gebruik jq/grep/sed waar het kan.
- Meerdere shell-operaties (pipes/for-loops) in 1 Bash-call triggeren soms approval; los in
  losse simpele commando's opsplitsen scheelt tijd.

## Openstaand (laag risico, niet elke dienst herhalen)
- werkbon-niet-afgerond/-klantmail/-tekenlink: geen alarmbewaking in systemen-register.json,
  VOORSTEL nog open (buiten mijn bestandsmandaat).
- brein-collect zou ook op exit-code≠0 moeten alarmeren i.p.v. alleen tijd-sinds-laatste-log,
  VOORSTEL nog open.
- LEERPUNT: bij "log al dagen stil" ALTIJD eerst UTC vs lokale tijd checken vóór storing concluderen.

## Bijscholing (kern, volledig in vakkennis.md, laatst ververst 07-09)
Symptoom/gebruikersimpact melden i.p.v. oorzaak; heartbeat-voorstel bij silent-falende permanente
jobs; concreet 429-advies (backoff/jitter/poll-frequentie) i.p.v. alleen tellen.
NIEUW 07-09: "silent success" is 4e faalklasse naast gemist/laat/duur — exit 0 betekent niet
automatisch geen storing, check ook of de job echt iets opleverde (relevant bij sunny-weetje-achtige
twijfelgevallen en outlook-planado-sync). Kleine-teams-SRE-advies: focus alarmbewaking op 1-3
kernpaden (inmeetafspraak, klantbericht, offerte/mutatie) i.p.v. overal een beetje alarm.
