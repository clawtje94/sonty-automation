# Boekcontrole Sunmaster 2026 — alle 60 pagina's

Waarom: de extractie van 28 juni bleek fout op meerdere tabellen. Vier tabellen zijn op
30 juli opnieuw uitgelezen van de pagina-afbeelding, de rest nooit. Daimy 2026-08-03:
"het is altijd belangrijk dat je alle pagina's van een boek hebt gelezen, anders heeft
het sowieso geen zin". Dus: elke pagina, ook de pagina's waar we nu niks mee doen.

Methode: pagina renderen als AFBEELDING (`pdftoppm -r 165`) en cel voor cel vergelijken.
Nooit de tekstlaag — daar is het de vorige keer op misgegaan.

| p | onderwerp | status | bevinding |
|---|---|---|---|
| 1-4 | omslag, inhoud, over Sunmaster | n.v.t. | geen prijzen |
| 5 | Square 70 | ✅ n.v.t. | Daimy 03-08: **verkopen we niet**. Bewust niet in onze data — niet alsnog toevoegen |
| 6 | Screen Square 85 tekeningen | n.v.t. | |
| 7 | Screen Square 85/100 | ✅ 30-07 | opnieuw uitgelezen |
| 8 | inhoud zipscreens | n.v.t. | |
| 9 | Zip Square 85/100 | ✅ 30-07 + 03-08 | max hoogte 340, niet 280 (offerte-tool gefixt) |
| 10-11 | Zip Design 110 | ✅ 03-08 | prijstabellen 100% goed (50 + 160 cellen). ⚠️ TWEE FOUTEN in de kleurmeerprijs, zie bevinding 5 en 6 |
| 13 | vervolgtabel | TE DOEN | welk product? |
| 14-15 | Zip Square 130 | ✅ n.v.t. | Daimy 03-08: **verkopen we niet**. Bewust niet in onze data |
| 16 | meerprijzen bediening screens | TE DOEN | |
| 17 | profielen per meter, kleuren | TE DOEN | |
| 19 | kabeluitvoer | n.v.t. | |
| 21 | screendoek collectie + los doek | TE DOEN | |
| 22-23 | inhoud knikarmen | n.v.t. | |
| 24-25 | SunBasic + Cassette | ✅ 03-08 | tabellen 100% goed. Cassette heeft GEEN draaistang en 200cm-minderprijs -150 i.p.v. -160 — beide stonden goed. Min. breedte handbediend is uitval+33, wij rekenen +30 |
| 26-27 | SunEye | ✅ 03-08 | tabellen, minderprijzen en kleurmeerprijzen 100% goed |
| 28-29 | SunEye XL | ✅ 03-08 | ⚠️ FOUT GEVONDEN: cel breedte 300 bij uitval 300 stond bij ons wel, in het boek is die rij leeg. Verwijderd. Rest 100% goed |
| 31 | SunElite | ✅ 03-08 | tabellen en kleurmeerprijzen 100% goed. Kent GEEN draaistang |
| 33 | opties knikarmen | TE DOEN | |
| 34-35 | doekinformatie | n.v.t. | |
| 36 | inhoud rolluiken | n.v.t. | |
| 37 | Rolluik S-42 | ✅ 30-07 | opnieuw uitgelezen |
| 38 | Rolluik S-37 | ✅ 30-07 | opnieuw uitgelezen |
| 39 | opties rolluiken | TE DOEN | |
| 41-42 | geleiders, inhoud uitval | n.v.t. | |
| 43 | SunCube 150 | ✅ 03-08 | 192 cellen, 0 fouten |
| 44 | SunProject 100 | ✅ 03-08 | 81 schermprijzen, 54 banenprijzen en 54 kleurmeerprijzen allemaal goed. ⚠️ draaistang is volgens het boek maar mogelijk tot 460 cm breed; die grens stond nergens |
| 45 | tekeningen | n.v.t. | |
| 46 | opties uitvalschermen | TE DOEN | |
| 47-48 | maatvoering, inhoud veranda | n.v.t. | |
| 49 | SunControl 150 | ✅ 03-08 | alle 35 cellen goed, WT-motor -50 klopt. ⚠️ gekoppeld mag hier maar tot 10.000 mm, wij staan 12.000 toe |
| 50 | opties SunControl | TE DOEN | |
| 51 | SunControl 165 ZIP | ✅ 03-08 | alle 35 cellen goed. Gekoppeld tot 12.000 mm klopt hier wél. RAL-meerprijs 15% bevestigd |
| 52 | standaarduitvoering pergola | TE DOEN | |
| 53 | SunControl 165 ZIP pergola | ✅ 03-08 | alle 35 cellen goed. Gekoppeld tot 10.000 mm, niet 12.000 |
| 54-55 | Somfy accessoires | TE DOEN | |
| 56-60 | projecten, voorwaarden | TE DOEN | p57 prijsvoorwaarden lezen |


## Bevindingen tot nu toe

1. **SunEye XL had een verzonnen cel** (breedte 300 bij uitval 300, prijs 3096). Die rij is
   leeg in het boek omdat de minimale breedte daar 349 cm is. Verwijderd 03-08.
2. **Draaistang bestaat niet bij elk knikarmmodel.** Het boek geeft een minderprijs
   draaistangbediening alleen bij SunEye (p27) en SunBasic (p25). SunEye XL, SunBasic
   Cassette en SunElite hebben die regel niet. v4 trok overal een vaste -300 af en
   offreerde dus handbediende schermen die de fabriek niet levert. Gefixt 03-08.
3. **RAL 7016 — BEANTWOORD (Daimy 03-08).** Antraciet structuur *is* RAL 7016 structuur,
   en RAL 7016 glad is dezelfde kleur in gladde uitvoering. Antraciet is altijd een
   standaardkleur. Onze standaardKleuren (RAL 7016 én RAL 7016 structuur bij alle
   knikarmen) kloppen dus; er wordt terecht geen kleurmeerprijs gerekend. NIET wijzigen.
4. Minimale breedtes uit het boek, nu in v4: SunEye uitval+19, SunEye XL uitval+49 (401 bij
   uitval 350), SunElite uitval+65, SunBasic uitval+30. SunBasic handbediend is +33; dat
   verschil van 3 cm zit nog niet in de code maar heeft geen praktisch effect omdat de
   tabel pas bij 300 begint.

5. **Zip Design 110: kleurmeerprijs bij breedte 280 stond een kolom verschoven.** Wij:
   Trend 181 / RAL 361. Boek p11: Trend 148 / RAL 295. Klanten met een 280 cm breed
   scherm in een meerprijs-kleur betaalden €36 (Trend) of €73 (RAL) te veel. Gefixt.
6. **Zip Design 110: kleurmeerprijs voor breedte 100-180 ontbrak helemaal.** Boek p10 geeft
   daar Trend 115 / RAL 230; bij ons begon de tabel pas bij 200, dus die maten vielen terug
   op de staffel 200 (148/295) en betaalden €36 resp. €72 te veel. Gefixt.
   → 210 offertes uit 2026 hebben een Zip Design ≤280 breed in een meerprijs-kleur en zijn
   dus te duur geoffreerd. **BESLISSING DAIMY 03-08: verstuurde offertes met rust laten.**
   Niet corrigeren, ook de openstaande niet. Alleen nieuwe offertes krijgen de goede prijs.
   (Let op: dit is anders dan bij de uitvalschermen in augustus, waar de SENT-offertes wél
   zijn aangepast. Niet automatisch dat precedent volgen.)
7. **Standaardkleuren Zip Design 110 — OPGELOST.** Daimy 03-08: "hou maar aan zoals het in
   het boek staat". Boek p10 noemt RAL 9010, RAL 9001, Antraciet st. en RAL 9006. Dus RAL
   9006 toegevoegd en RAL 9005 structuur verwijderd. RAL 7016 (glad én structuur) blijft
   staan: antraciet is bij Sunmaster altijd standaard en antraciet structuur ís RAL 7016
   structuur (Daimy 03-08).
   → 81 Zip Design-regels in 2026 staan in RAL 9005 structuur en worden hierdoor duurder;
   RAL 9006 kwam 0 keer voor.
8. **p28 SunEye XL standaardkleuren gecontroleerd:** RAL 9010, RAL 9001, Antraciet structuur,
   RAL 9005 structuur — gelijk aan onze data. Goed.

## Blinde vlek in de meetlat (ontdekt 03-08)

De meetlat meet kleurmeerprijzen wél (via kleurType standaard/trend/ral) maar meet NIET of
een concrete kleurnaam als standaard geldt. De wijziging aan `standaardKleuren` van Zip
Design 110 gaf daardoor 0 afwijkingen in de meetlat, terwijl hij in de praktijk 81
offerteregels raakt. Wie hier alleen op de meetlat afgaat, denkt onterecht dat er niets
verandert. Nog toe te voegen: per product elke standaard- én meerprijskleur door
`isStandaardKleur` halen en die uitkomst vastleggen.

9. **SunProject 100 draaistang alleen tot 460 cm** (boek p44). Die breedtegrens stond nergens
   in onze code, dus boven 460 cm offreerden we een draaistang die niet leverbaar is.
   Gefixt. Let op: bij SunCube (p43) staat die grens er NIET, dus die blijft ongelimiteerd —
   ik had de grens eerst per ongeluk bij SunCube gezet en dat teruggedraaid.
10. **Doek 225 heeft bij SunProject geen banen-confectie** ("doek in banen niet mogelijk
   i.v.m. oproldiameter"). Onze data heeft banenConfectie alleen voor doek 165 en 200 —
   dat klopt dus.

## Daarna ook deze boeken (opdracht Daimy 03-08)

Zelfde methode, pagina voor pagina als afbeelding:
- **Markiezen NL** — tabellen staan nu hardcoded in v4 (MK_GRENEN / MK_ALUMINIUM / MK_HARDHOUT,
  bovenkap, zijkap, bediening). Nooit tegen het boek gecontroleerd.
- **Roma** — Prijslijst 2025; uit de tekstlaag geëxtraheerd, niet visueel. Let op: uitzoeken
  of de tabellen bruto lijstprijs of netto dealer zijn (het boek noemt "bruto meerprijs" en
  markeert losse posten als "netto, geen korting toepassen").
- **Unilux horren** — Adviesprijslijst 2026; opslag zit al in onze bedragen verwerkt.

11. **Kleurpercentages stonden op drie plekken hardcoded** (v4, de bot, de offerte-tool:
   0.15 / 0.20) terwijl de website ze al uit de config las. Gevonden doordat p51 bevestigt
   dat serre/pergola 15% RAL-meerprijs heeft en niet de 20% van de rolluiken. Alle drie nu
   uit `prijsconfig.json`, met een nieuw veld `kleurRalPctSerre`. Het slot let er nu ook op:
   de regex vangt voortaan óók 0.15 en 0.20.
12. **Gekoppelde uitvoering — maximum per product, GEFIXT.** Boek: SunControl 150 tot
   10.000 mm (p49), 165 ZIP tot 12.000 mm (p51), pergola tot 10.000 mm (p53). Onze code
   hanteerde overal 2× de tabelbreedte (12.000 mm). Nu staat de grens per product in de data
   als `maxGekoppeldMM`.
   ⚠️ **LET OP DAIMY:** dit zet de pergola terug van 12 m naar 10 m. In het geheugen staat
   "pergola max 12 m breed, bevestigd door Daimy 2026-07-02". Het boek zegt 10 m. Ik ben van
   het boek uitgegaan omdat dat de afspraak is (03-08), maar als jij van Sunmaster weet dat
   12 m wél kan bij de pergola, zeg het dan — dan zet ik `maxGekoppeldMM` daar op 12000.
   In de 2026-offertes staat 0 keer een serre of pergola breder dan 10 m, dus dit raakt
   voorlopig niemand.
