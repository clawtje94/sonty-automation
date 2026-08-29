# Geheugen Fenna

## Lopende zaken
- 2026-08-29: 4 orders getekend zonder (betaalde) aanbetaling: 6489 (Martin Valentin), 6556 (Daimy TEST?), 6560, 6561. Ruben checkt 6489/6556 morgen (opdracht van Daimy). Sam checkt 6560/6561 (mijn opdracht: geen factuur gevonden, geen "niet betaald").
- 2026-08-29: Luuk Post (Gripp) 16 dagen vast op ongetekende offerte. Tess + Milan al gevraagd contact op te nemen (dubbele opdracht van Daimy, niet meer nodig om te herhalen).
- 2026-08-29: Sjoerd op vakantie 24 aug–11 sept. Joey op Disney 7-8 sept → die 2 dagen 0 inmeters. Nog geen boekingen op die data, dus geen acute annulering nodig. Wel in de gaten houden dat Sunny/Nanny niet per ongeluk daar iets inplant.

## Openstaande vraag aan Daimy (nog geen antwoord)
- Vaste bron voor "orders/omzet deze week vs plafond 35" ontbreekt — gripp-open-opdrachten.json is verouderd (data t/m 2022) en heeft geen weekfilter. Wachtend op aanwijzing.

## Structuur / bronnen die werken
- Directeurscijfers boekingen: data/inmeet-boekingen.json (velden: geboektOp, aankomst, inmeter, status).
- Wachtrijen/alarmen/stil-lijst: data/brein/snapshot.json (wachtrijen, alarmen).
- Delegeren: node scripts/brein-sessie.js opdracht <slug> "<tekst>" (max 3/dag, teller: 1 gebruikt op 29-08).

## Let op volgende dienst
- Eerste dienst was 29-08, dus nog geen week-op-week vergelijking mogelijk. Vanaf 30-08 wel gisteren-vergelijking doen.
