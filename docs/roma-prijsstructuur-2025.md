# Roma Prijsstructuur 2025 — ingelezen, NIET gekoppeld

> Bron: `data/prijsboeken/Prijslijst 2025 Roma NL.pdf` (328 pagina's, ROMA Benelux).
> Volledige extracties: `data/prijsboeken/roma-extract/roma-01..13*.md` — elk bestand is
> cel-voor-cel geverifieerd tegen de PDF-tekstlaag (`data/prijsboeken/roma-tekst/`) op
> 2026-07-03, met in totaal ±11.500 correcties t.o.v. de eerste visuele extractie.
> Status: ALLEEN INGELEZEN. Nergens gekoppeld aan v4, de offerte-tool of de AI-klantenservice
> (afspraak Daimy: eerst samen bepalen wanneer we welk merk gebruiken).

## ⚠️ HET KRITIEKE VERSCHIL MET SUNMASTER

| | **Sunmaster** | **Roma** |
|---|---|---|
| Prijstype | **Advies-verkoopprijzen INCL. BTW** | **Netto dealerprijzen EXCL. BTW** (voorwaarden p324 §3: "netto prijzen … plus de toepasselijke btw") |
| Sonty-rekenregel | boekprijs × 1,10 | nog te bepalen (× 1,21 BTW × marge) |
| Motoren in tabelprijs | Somfy (Sunea/Sunilus/RS100, zonder handzender €76) | Rolluiken: RS100 io + Smoove io · Screens: Maestria io + Smoove io · Buitenjaloezieën: J4 io + Smoove io (zenders al ingeleerd af fabriek) |
| Garantie fabrikant | — | 5 jaar op materialen, 7 jaar op RS100 io solar |
| Jaargang | 2026 | **2025** (check of er een 2026-lijst komt) |

**Nooit Roma- en Sunmaster-prijzen door elkaar gebruiken zonder deze correctie.**

## Assortiment (met extract-bestand en paginabereik)

| Productgroep | Producten | Extract | Pagina's |
|---|---|---|---|
| Voorzetrolluiken | .XP geëxtrudeerd, .XP Solar, .P geëxtrudeerd, .P Solar, .P gerolvormd | roma-04, roma-05 | 64-95 |
| Schuine rolluiken | TRENDO .XP/.P | roma-05 | 96-101 |
| Opbouw/inbouw rolluiken | PURO 2.(K), PURO 2.XR(K), KARO, RA.2 | roma-06 | 102-134 |
| Rolluiklamellen | ALUMINO 34/37/44/52 + kunststof | roma-07 | 135-141 |
| Buitenjaloezieën | Raffstore .P/.XP, MODULO .P/.XP/.S (lamellen CDL70/ZL81/DBL70/GL85) | roma-08 | 152-177 |
| Buitenjaloezieën opbouw/gevel | PURO 2.XR(K)-RS, gevel (geleider/staaldraad/vrijdragend) | roma-09 | 178-213 |
| Screens | zipSCREEN.2 (+Solar/vrijstaand/mini), rollSCREEN.2, zipSCREEN F50, PURO 2.XR(K)-zip, RA zipSCREEN | roma-10, 10b, 10c, roma-11 | 214-281 |
| Elektrik | zenders/sensoren/besturingen (Somfy io/RTS, Elero, Geiger) | roma-12 | 282-291 |
| Garagedeuren | GECCO, SILENTO, ROLENTO, PROTEGO rolhekken | roma-13 | 292-323 |
| Doorvalbeveiliging | glazen-doorvalbeveiliging (Frans balkon) | roma-02 | 27-37 |
| Kleuren | 209 standaardkleuren, kleurgroepen + toeslagen, folie/VEKA | roma-02 | 19-26 |
| Windklassen/planning | windlastzones, maxmaten per windklasse | roma-03 | 38-59 |

## Commercieel relevante regels (uit het boek)

- **Kleuren**: 209 kleuren standaard in mat/structuur voor kast/geleiders/onderlijst zonder
  natlak (poedercoat); speciale pantserkleuren pas rendabel vanaf 40 m², anders volle
  meerprijs + €40/m² materiaaltoeslag (min. 1 m²).
- **Standaard afgeleverd met**: design-onderlijst, aandrukveren, RVS-schroeven, Plug&Play
  motoren; motoren af fabriek afgesteld, zenders ingeleerd.
- **Veiligheidspakket**: gemiddeld 300%+ inbraakvertragend; alleen bij geëxtrudeerd P/XP
  (advies: alleen XP).
- **Betaling**: 30 dagen; binnen 8 dagen of automatische incasso = 2% korting.
- **Lamelkeuze**: 4 typen zonder meerprijs (ALUMINO 34/37/44/52).
- **Roma vs Sunmaster verkoop-argument** (uit teamgesprekken): dikker aluminium, 2×
  gepoedercoat, alle RAL-kleuren zonder groot prijsverschil — team adviseert Roma bij
  afwijkende RAL-kleuren op rolluiken.

## Verificatiestatus per bestand

Alle bestanden dragen bovenaan "> Geverifieerd tegen PDF-tekstlaag op 2026-07-03; N correcties."
Resterende (gemarkeerde) aandachtspunten:
- roma-09 p189: 7 blauwe rijen visueel afgelezen uit de PDF (consistent XRK/XR-verschil) —
  herbevestigen bij daadwerkelijke koppeling.
- roma-13 PROTEGO p312-314: kleurcodering (G72/G82/G77) gereconstrueerd op rijvolgorde —
  origineel raadplegen bij twijfel.
- Grafische elementen (kleurstalen-matrices, technische tekeningen) zijn beschrijvend, niet
  cel-exact.

## Bij toekomstige koppeling (fase-1-checklist)

1. Beslissing Daimy: welke producten via Roma, welke via Sunmaster (en wat bij overlap rolluiken/screens).
2. Sonty-marge op Roma-netto bepalen (excl → incl BTW × marge).
3. `data/roma-prices-2025.json` bouwen uit de extracts (zelfde structuur als sunmaster-prices-2026.json).
4. Koppelen in v4 + AI-klantenservice mét merk-onderscheid in de productnaam.
5. De gemarkeerde cellen (zie hierboven) herbevestigen.
