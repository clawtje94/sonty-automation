# Tess – geheugen (montage-coördinatie)

## Bijscholing 07-09: vakkennis ververst
- Nieuw in vakkennis.md: FTF branchegemiddelde ~80%, top 84-92%; mislukt 1e bezoek = 2,7 bezoeken/
  13 dagen extra; route vooraf vastzetten kan tot 25% minder rijkilometers; escaleren = vroeg
  signaleren, niet wachten tot klant het merkt.
- Toepassen vanaf morgen: oudste werkbon met naam+dagen, materiaalcheck als apart controlepunt
  vóór montagedag, meerwerk apart tellen van "wacht op klant"/"wacht op planning".

## 🚨 KNELPUNT ACTIEF (2026-09-08 07:20u UPDATE)
**WERKBONNEN STAPELEN OP, GEEN AFZETTING SINDS 02 SEP 12:59 (6 DAGEN VOORTGEZET)**:
- Werkbon-daemon stabiel (0 errors), 12 jobs verwerkt sinds 20-08.
- **KNELPUNT TEAM SIDE**: Sinds 02-09 12:59 → 0 werkbonnen ingediend door teams (bevestigd t/m 07-09 06:10).
- Trend open werkbonnen: 79 (01-sep) → 93 (02-sep) → 101 (03-sep) → 110 (04-sep) → 113 (05-sep) → 113 (06-sep) → 113 (07-sep).
- **Gisteren nul afzetting**: 113 open, 0 van vorige dag (07-09 06:10); ook 08-09 geen update (logs loopt niet meer).
- Werkbon-afhandeling: 0 afgerond sinds 03-sep; log stopt permanent na 22-08 (daemon werkt niet).
- **Planado 429 + SUNNY CREDITS LEEG**: Voortdurend rate-limit (Mats), 22 sync-fouten (Nanny); KRITIEK: Sunny Anthropic credits op = 168 fouten "balance too low" = ~7% berichten niet verzonden.
- **Capaciteit DAG 08-09**: BEIDEN inmeters op vakantie (Sjoerd t/m 11-09, Joey 07-09) = 0 capaciteit vandaag; herstelt morgen (Joey 09-09 terug, Sjoerd 12-09).

## Lopende status (2026-09-08 07:20u)
- **Werkbonnen**: 113 open (per 07-sep 06:10); geen vandaag-bijgewerkte teller in snapshot/logs.
- **Oudste werkbonnen**: onbekend naam/dagen (werkbon-tekenlink bijgewerkt tot 07-09 14:06).
- **Teams**: 5 actief (Dennis&Frenky, Marvin/Bart, Marvin/Moa, Tygo/Kevin, Yudi/Nick), capaciteit VANDAAG 0% (beide inmeters vakantie).
- **Montage-voorstellen**: 31 klaar (per 08-09 05:10), 412 geblokkeerd (materiaal/klantinfo) — normaal.
- **Planado 429**: Voortdurend; sync-fouten 22 (Nanny 08-09), 422-pattern (Mats 07-09), dubbele boekingen 5 (04-09 audit).
- **Sunny critiek**: Anthropic credits leeg (168 fouten 07% berichten), tickets-rapport daemon offline (sinds 06-09), wa-luisteraar offline (Mats alarm).
- **Telefoonnummers teams**: Yudi = 06192585866; Dennis&Frenky, Marvin/Bart, Marvin/Moa, Tygo/Kevin ontbreken.

## Kritieke punten (08-09)
1. WERKBONNEN BLOKKEADE: Teams nul afzetting sinds 02-09 12:59 (nu 6 dagen). Gebruiker-side vermoedelijk.
2. SUNNY CREDITS LEEG: Anthropic balance = 0, 7% berichten niet verzonden; naar Techniek ACUUT.
3. Capaciteit VANDAAG 08-09: beide inmeters vakantie = geen montage. Herstelt 09-09 (Joey) + 12-09 (Sjoerd).
4. Werkbon-logs gestopt: afhandeling-daemon draait niet (sinds 22-08); geen vandaag-cijfers beschikbaar.
5. Planado voortdurend: 429 rate-limit, 422 sync-fouten, 5 dubbele boekingen.

## Status 2026-09-10 07:20u VANDAAG
- **Werkbonnen**: 121 open (per 09-09 06:10); trend stijging, geen afzettingen sinds 02-09 12:59 (nu 8 werkdagen).
- **Montage-voorstellen**: 38 klaar, 399 geblokkeerd — goed volume.
- **Montage-afzettingen vandaag**: 0; gisteren 08-09: 5 werkbonnen verwerkt (kernel draait).
- **Planado vandaag**: 2 dubbelen (09:30 & 10:00 Yudi/Nick), 429 rate-limit voortdurend.
- **Capaciteit**: 50% (Joey terug na vakantie, Sjoerd vakantie t/m 11-09).
- **Sunny**: credits OK (05:00).
- **Techniek-opdracht gestuurd**: werkbon-afhandeling-daemon restart-status (offline sinds 22-08).

## Status 2026-09-11 07:20u VANDAAG
- **Werkbonnen**: 130 open (per 10-sep 06:10); +9 in 1 dag, +51 in 9 dagen, geen afzetting sinds gisteren.
- **Montage-voorstellen**: 33 klaar, 389 geblokkeerd.
- **Montage-afzettingen gisteren**: 5 werkbonnen (kernel werkt).
- **Planado vandaag**: 2 dubbelen (09:30 & 10:00 Yudi/Nick), geen adres — sync-fout.
- **Capaciteit**: 50% (Joey terug, Sjoerd t/m 11-09 weg).
- **Oudste werkbonnen**: onbekend naam/dagen (link niet vandaag bijgewerkt).

## Volgende acties (12-09)
1. Sjoerd terug → capaciteit 100%.
2. Werkbon-afhandeling-daemon herstart (10 sept): voortgang volgen.
3. Planado adresfouten Yudi/Nick → naar Techniek.
4. Materiaalcheck vóór montagedag: 389 geblokkeerd = veel wachtposten.
