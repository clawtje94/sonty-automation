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
| 5 | **Square 70** | TE DOEN | ⚠️ product staat NIET in onze prijsdata |
| 6 | Screen Square 85 tekeningen | n.v.t. | |
| 7 | Screen Square 85/100 | ✅ 30-07 | opnieuw uitgelezen |
| 8 | inhoud zipscreens | n.v.t. | |
| 9 | Zip Square 85/100 | ✅ 30-07 + 03-08 | max hoogte 340, niet 280 (offerte-tool gefixt) |
| 10-11 | Zip Design 110 | TE DOEN | |
| 13 | vervolgtabel | TE DOEN | welk product? |
| 14-15 | **Zip Square 130** | TE DOEN | ⚠️ product staat NIET in onze prijsdata |
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
| 44 | SunProject 100 | TE DOEN | |
| 45 | tekeningen | n.v.t. | |
| 46 | opties uitvalschermen | TE DOEN | |
| 47-48 | maatvoering, inhoud veranda | n.v.t. | |
| 49 | SunControl 150 | TE DOEN | |
| 50 | opties SunControl | TE DOEN | |
| 51 | SunControl 165 ZIP | TE DOEN | |
| 52 | standaarduitvoering pergola | TE DOEN | |
| 53 | SunControl 165 ZIP pergola | TE DOEN | |
| 54-55 | Somfy accessoires | TE DOEN | |
| 56-60 | projecten, voorwaarden | TE DOEN | p57 prijsvoorwaarden lezen |


## Bevindingen tot nu toe

1. **SunEye XL had een verzonnen cel** (breedte 300 bij uitval 300, prijs 3096). Die rij is
   leeg in het boek omdat de minimale breedte daar 349 cm is. Verwijderd 03-08.
2. **Draaistang bestaat niet bij elk knikarmmodel.** Het boek geeft een minderprijs
   draaistangbediening alleen bij SunEye (p27) en SunBasic (p25). SunEye XL, SunBasic
   Cassette en SunElite hebben die regel niet. v4 trok overal een vaste -300 af en
   offreerde dus handbediende schermen die de fabriek niet levert. Gefixt 03-08.
3. **OPEN VRAAG VOOR DAIMY — RAL 7016.** Wij hebben "RAL 7016" en "RAL 7016 structuur" bij
   alle knikarmen als standaardkleur staan. Het boek noemt als standaard/voorraad alleen:
   SunEye RAL 9010, RAL 9001, Antraciet structuur, RAL 9005 structuur · SunElite RAL 9010
   mat, Antraciet structuur · SunBasic RAL 9001, Antraciet structuur.
   "Antraciet structuur" is vermoedelijk hetzelfde als RAL 7016 structuur, maar gladde
   RAL 7016 staat nergens. Klopt dat, of laten we daar een kleurmeerprijs liggen van
   €241–€699 (Trend) of €344–€999 (RAL) per scherm?
4. Minimale breedtes uit het boek, nu in v4: SunEye uitval+19, SunEye XL uitval+49 (401 bij
   uitval 350), SunElite uitval+65, SunBasic uitval+30. SunBasic handbediend is +33; dat
   verschil van 3 cm zit nog niet in de code maar heeft geen praktisch effect omdat de
   tabel pas bij 300 begint.
