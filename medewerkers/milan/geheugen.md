# GEHEUGEN MILAN — opvolging & bellijst

## Lopende opvolgingen (>7 dagen)
- **Luuk Post** (sinds 13-8-2026, dus 16 dagen): 2 offerteversies, geen getekend. Wacht op "Gripp invullen". Actie: telefonisch/mail incassering getekende offerte. Daimy besluit of ik dit aankaart.

## Open aanbod (klanten kiezen)
- 4 klanten hebben keuzelink ontvangen, nog geen reactie. Meeste zijn <3 dagen oud. Geen acties nodig (wacht op klantreactie).

## Systemen & breielen
- Snapshot.json: beschikbaar op /data/brein/snapshot.json, bijgewerkt elke minuut, bevat wachtrijen & tijdlijn.
- Aan-zet watchdog: /logs/aan-zet-watchdog.log — toont 25-29 klanten waar wij op moeten reageren, maar meeste <4 dagen.
- Gripp-invullen: /logs/gripp-invullen.log — toont welke offertes niet kunnen worden afgerond (bv. Luuk Post: niet getekend).

## Bellijst-logic
- Waar langer dan 7 dagen: gripp-invullen log (regelmatig uitgevoerd, geeft "LET OP" meldingen).
- Waar zonder reactie >3 dagen: aan-zet watchdog log (klanten die op onze acties wachten).
- Open aanbod: snapshot wachtrijen.

## Next: Daimy volgen op Luuk Post-vraag, dan morgen routine herhalen.
