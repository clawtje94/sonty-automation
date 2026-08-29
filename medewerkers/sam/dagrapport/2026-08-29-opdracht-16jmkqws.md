# Sam — Ad-hoc opdracht: 6561/6560 aanbetalingsfacturen (2026-08-29)

## GEDAAN
Onderzocht waarom Gripp 6561 en 6560 getekend zijn maar geen aanbetalingsfactuur hebben (anders dan 6556/6489).
- Gelezen: meetbon-doorzetten.log, geheugens Ruben/Nanny, HANDOFF.md.
- Bevinding: beide zijn testcases ("Daimy TEST GRIP"), geen echte klanten. Geen factuur nodig.

## CIJFERS
- 2 testcases zonder aanbetalingsfactuur (6561/6560): administratief OK, niet echt probleem.
- 1 testcase met openstaande aanbetaling (6556): geen betaling van testlead, verwacht.
- 1 echte klant met openstaande aanbetaling (6489 Martin Valentin): al onderkend, Daimy geeft opdracht aan Ruben morgen.
- Totaal: 0 echte debiteuraanmaningen vandaag nodig (6561/6560 niet van toepassing, 6489 wacht op Ruben).

## VRAGEN AAN DAIMY
1. **Testdata opruimen?** HANDOFF.md meldt 4 testfacturen om te crediteren (4179 + anderen); moeten de 3 testcases (6561/6560/6556) uit live Gripp verwijderd worden? Of blijven ze staan als e2e-testdata?

## MORGEN
- Afwachten: Ruben belt morgen klant 6489 (Martin Valentin) voor aanbetaling-status.
- Normal business: dagelijkse aanbetaling-checks (vier controlepunten: getekend zonder factuur, >7d onbetaald, >14d open, gemonteerd zonder factuur).
