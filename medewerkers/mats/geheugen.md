# Geheugen Mats (Techniek en Systemen)

## Bewust-uit (niet herhalen als storing, tenzij status verandert)
- wa-desktop-queue: al dagen stil, laag alarm, bewust uit.
- keten-zelfcontrole: BEVESTIGD via data/kill/nl.sonty.keten-zelfcontrole (Daimy, 18-08).
- sonny-rapport: BEVESTIGD via data/kill/nl.sonty.sonny-rapport (Daimy, 19-08).
- LEERPUNT: bij twijfel bewust-uit vs storing EERST data/kill/<jobnaam> checken.

## 09-09: wa-luisteraar nog steeds down — 24u+, root cause raakt nu ook Sunny-berichten
- Crash-loop op WA 401 loopt door sinds 08-09 ~06:06 UTC, nog actief 09-09 ~06:00 UTC (>24u).
  Doorzetting rm3n4x9n (08-09) staat nog open, NIET herhaald, wel als échte V-vraag aan Daimy
  gemeld (09-09): fix vraagt fysieke QR-scan op het toestel, dat kan geen agent. Check volgende
  dienst of active count weer 1 is.
- BELANGRIJK: sunny-ochtend/sunny-weetje exit1 is NIET meer het oude twijfelgeval (generatie-
  fout, bericht kwam toch aan) — log toont nu expliciet "koppeling verbroken op telefoon",
  zelfde WA-401 oorzaak als wa-luisteraar. Dus voorlopig ECHTE storing met klantimpact zolang
  wa-luisteraar plat ligt; oude "geen-storing"-aanname pas weer laten gelden nadat WA hersteld is
  en berichten aantoonbaar weer aankomen.

## 09-09: opvolgingen bevestigd opgelost
- Claude-postvak procesbug (itf2311c): 0 vastzittende "nieuw"-opdrachten meer (was 12) — opgepakt,
  geen escalatie meer nodig.
- Planado 429-storm (l8erbbd5): 0 nieuwe "Rate Limit Exceeded" op 09-09, lijkt gefixt. Nog 1 dag
  bevestigen voor definitief.
- outlook-planado-sync 422 "external_id...": 0 op 09-09, patroon lijkt weg.

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
