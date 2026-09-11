# Geheugen Noor (Hoofd Operatie)

## Lopende zaken
- Werkbonnen: 79→93→101→110→113→113→116→121→130 open (01-09 t/m 11-09). Positief signaal 11-09:
  5 werkbonnen afgerond op 10-09 — eerste afronding na 8 werkdagen stilstand (daemon-herstart Tess).
  Morgen checken of dit doorzet of eenmalig was.
- Bestel-blokkade 6325/6579/6278: verdwenen uit meetbon-doorzetten-log 11-09, mogelijk al besteld
  door Daimy. 11-09: gedelegeerd aan Ruben (opdracht ohjbtmk9) om dit read-only in de portalen te
  checken — dit mag wel (huisregel 9 verbiedt alleen SCHRIJVEN, niet lezen). Les: eerder te snel
  aangenomen dat "checken" ook onder de schrijf-blokkade viel; lezen is altijd toegestaan.
- Aanbetaling geblokkeerd: 4 orders. 6332 Sjoerd van Marum nu 2 werkdagen over norm (nieuw, apart
  volgen). 3 testorders (6556/6560/6561) nu 10-14 werkdagen structureel, 4e keer bij Daimy gevraagd
  (verwijderen uit Gripp of dummy-betaling), nog geen antwoord.
- Capaciteit: Sjoerd terug 12-09 (laatste vakantiedag bevestigd 11-09), Dennis vakantie 30-9 t/m
  14-10 (11 werkdagen) — capaciteitsgat week 14-09 nu 4e keer gevraagd bij Daimy, nog onbeantwoord.
  Bron: data/vakanties-overzicht.json.
- Planado: nieuwe dubbelen 11-09 (Yudi/Nick 09:30 & 10:00, adresveld ontbreekt) — Tess pakt dit zelf
  op richting Techniek, geen actie van mij nodig.
- Prijs-kruiscontrole: groen, geen actie nodig.
- Delegaties gebruikt 11-09: 1/3 (Ruben, portaalstatus 3 orders checken).

## Vakkennis (bijgewerkt 07-09, wekelijkse bijscholing)
- Nieuw deze week: gewogen supplier scorecard (40% kwaliteit/30% levertijd/20% kosten/10% service);
  First Time Fix-benchmark ~85%; onvolledige intake is bekende oorzaak van planningsvertraging.
- Blijft staan: Theory of Constraints (inmeten = bottleneck), First Time Right vs First Time Fix,
  schedule adherence-norm 90-100% (75-80% realistisch startpunt).
- Nog te doen (4e dag op rij doorgeschoven): Ruben vragen om gewogen leverancierscore; Tess/Nanny
  vragen naar concreet FTF- en schedule adherence-cijfer. Volgende dienst echt oppakken, anders
  expliciet melden waarom het niet lukt (zie feedback Ori).

## Leerpunten
- Weekend (za/zo): geen dagrapporten van team; "gisteren" is dan de vorige werkdag.
- Max 3 delegaties/dag, max 3 V-vragen/dag (mandaat-laag 3) — oude openstaande vragen samenvoegen
  i.p.v. apart tellen.
- BELANGRIJKSTE LES 10-09 (blijft gelden): voor je iets BESLIST ZELF labelt, check ook expliciet of
  een vaste huisregel het blokkeert. Nieuwe nuance 11-09: huisregel 9 (leveranciersportalen) verbiedt
  alleen SCHRIJVEN/bestellen, niet lezen — status opvragen mag gewoon binnen mandaat gedelegeerd
  worden, hoeft geen V-vraag te zijn.
- Niet blind op "vorig rapport zei opgelost" vertrouwen: blijf patronen navragen i.p.v. los te melden.
- Feedback Ori 09-09/10-09 toegepast: geen ordernummers herhalen in VRAGEN die al bij CIJFERS staan,
  boilerplate-bevestigingen zonder afwijking schrappen, elke vraag max 2 regels. 11-09 rapport 23
  regels (limiet 30) — check morgen of Ori dit als opgelost bevestigt.
- python3 -c en date -j in Bash triggeren approval-verzoeken; gebruik Grep/Read i.p.v. losse
  python/date one-liners. snapshot.json is single-line JSON — voor gerichte info liever het
  bronbestand lezen (bv. vakanties-overzicht.json) dan grep -o op snapshot.
