# Geheugen Mats (Techniek en Systemen)

## Bewust-uit (niet herhalen als storing, tenzij status verandert)
- wa-desktop-queue: al dagen stil, laag alarm, bewust uit.
- keten-zelfcontrole: niet geladen in launchd (plist staat er wel), bewust uit.
- sonny-rapport: niet geladen in launchd (plist staat er wel), bewust uit.

## Lopende twijfelgevallen (wacht op Daimy)
- gesprek-lab (07:30): exit 1 elke dag, FOUT-STIL 1-2. Onduidelijk of dit een bug in de
  boekingspoort is of normaal testgedrag (poort blokkeert terecht bij klanten die terugkomen/
  annuleren). Gevraagd aan Daimy 29-08. Niet zelf aanpassen.
- sunny-weetje (20:00): exit 1, maar berichten kwamen wel aan (2x verstuurd na wat API-hikjes).
  Gevraagd aan Daimy 29-08 of dit repareren nodig is of acceptabele ruis is.
- sonny-watch.log: structureel hoog aantal Trengo 429's (~4000/dag op 29-08). Retry-met-backoff
  vangt het af, job draait door. Gevraagd of poll-frequentie omlaag moet.

## Vaste daemons (permanent, KeepAlive) — moeten altijd draaien
sonny, email, telegram-poll, inmeet-verzoeken, wa-luisteraar, databot-poll.
Op 29-08 allemaal ok, geen alarm.

## Logformaten (voor volgende keer, tijd besparen)
- sonny-watch.log: alleen tijd [HH:MM:SS AM/PM] per regel, geen datum. Voor "laatste 24u" moet je
  de dag-grens zoeken (tijd die terugspringt) om vandaag te isoleren.
- inmeet-verzoeken.log: wel volledige ISO-timestamp per regel, makkelijk te filteren op 24u.
- gripp-invullen/gripp-verrijken zijn van collega "Offerte-controle", niet van Techniek. Alleen
  checken als exit-code ≠ 0 (technisch), niet als het een "klant moet nog tekenen"-boodschap is.

## Openstaand
- Nog geen bevestiging van Daimy op de 3 vragen van 29-08. Bij volgende dienst eerst checken of
  er antwoord is voor ik opnieuw vraag.
