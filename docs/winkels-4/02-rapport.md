# Vier Sonty-winkels (175-250 m²): waar, in welke volgorde, en wat het oplevert
_Onderzoek 2026-09-09. Model: `~/sonty/scripts/winkels-4-analyse.js`, uitvoer `~/sonty/data/winkels-4/resultaat.json`, dit rapport wordt gegenereerd door `winkels-4-rapport.js`. Live: admin-pagina /admin/winkels-4._

## Samenvatting (de beslissing)

Het netwerk dat op Sonty-data én op koopkracht/koopwoningen het beste scoort, in de volgorde van openen (scenario J, 175-200 m² met echte showroom, besluit Daimy 10-09):

| # | Zoekgebied | Waarom hier | Extra akkoorden/jr | Netto/jr 175 m² | Netto/jr 200 m² | Met 25% inloop | Robuust? |
|---|---|---|---|---|---|---|---|
| 1 | **Rotterdam-Zuid/Oost langs de A16** (IJsselmonde–Feijenoord–Kralingen; Ridderkerk/Barendrecht (Cornelisland-Reijerwaard) scoort vrijwel gelijk) | 3.007 leads/jr binnen 20 km, koopwoning-index 131.7, 27 min van Rijswijk. Grootste winst: Rotterdam (702 leads, 10,2→19,3%), Barendrecht (148 leads, 9,0→19,3%), Schiedam (111 leads, 8,4→19,3%), Capelle Aan Den Ijssel (138 leads, 10,5→19,3%) | +148 (vol +197) | +€120k | **+€115k** (slechtste geval +€4k) | +€219k | Ja |
| 2 | **Haarlemmermeer / Amsterdam Nieuw-West bij A4-A9** (Badhoevedorp–Osdorp–De Aker, Hoofddorp aan de andere kant) | 1.888 leads/jr binnen 20 km, koopwoning-index 110.4, 44 min van Rijswijk, 65 min van de dichtstbijzijnde andere nieuwe winkel. Grootste winst: Amsterdam (319 leads, 5,8→19,3%), Haarlem (185 leads, 6,7→19,3%), Amstelveen (139 leads, 7,4→19,3%), Hoofddorp (180 leads, 10,4→19,3%) | +121 (vol +161) | +€75k | **+€71k** (slechtste geval −€21k) | +€174k | Basis positief, slechtste geval negatief |
| 3 | **Utrecht-rand aan de A2/A27** (Noordoost–Overvecht–Leidsche Rijn; Maarssen, Nieuwegein en De Bilt binnen 10 km) | 854 leads/jr binnen 20 km, koopwoning-index 133.5, 54 min van Rijswijk, 44 min van de dichtstbijzijnde andere nieuwe winkel. Grootste winst: Utrecht (158 leads, 8,3→19,3%), Amersfoort (72 leads, 0,9→11,9%), Nieuwegein (58 leads, 5,7→19,3%), Maarssen (43 leads, 6,3→19,3%) | +65 (vol +87) | −€17k | **−€21k** (slechtste geval −€72k) | +€83k | Alleen met inloop |
| 4 | **Dordrecht-Zuid / Drechtsteden aan de A16** (Zwijndrecht, Hendrik-Ido-Ambacht, Papendrecht, Alblasserdam binnen 10 km) | 835 leads/jr binnen 20 km, koopwoning-index 155.8, 36 min van Rijswijk, 20 min van de dichtstbijzijnde andere nieuwe winkel. Grootste winst: Dordrecht (247 leads, 7,6→19,3%), Papendrecht (87 leads, 5,7→19,3%), Hendrik-ido-ambacht (73 leads, 7,1→19,3%), Sliedrecht (46 leads, 4,7→19,3%) | +67 (vol +89) | −€14k | **−€19k** (slechtste geval −€71k) | +€85k | Alleen met inloop |

Totaal scenario J (200 m²): **+401 akkoorden/jr** uit online-leads die dichterbij een winkel komen, €1.445k extra omzet, **+€146k netto/jr** na alle winkelkosten. Met inloop (25% van wat Rijswijk aan winkelbezoekers trekt) wordt dat **+€561k**, met 50% +€976k. Conservatief (50% van de uplift, geen inloop): −€75k. Eenmalig ca. €95k inrichting per winkel (aanname).

**Conclusie: winkel 1 (Rotterdam) is op de gemeten cijfers verantwoord en winkel 2 (Haarlemmermeer/Amsterdam-West) in het basisgeval ook. Winkel 3 en 4 draaien alleen positief als de nieuwe winkels zelf inloop trekken, en dat is precies wat winkel 1 eerst moet bewijzen.** De Rijswijkse showroom trekt nu 466 winkelbezoekers per jaar die 54% converteren = 251 akkoorden/jr. Een nieuwe winkel die daar een kwart van haalt, verdient er €104k brutowinst per jaar bij. Dat is de grootste hefboom én de grootste onzekerheid.

Leiden (18 min van Rijswijk) valt af: het steelt vooral van de bestaande showroom en is bij elke gevoeligheid negatief. Zuidplas (eerder als 4 genoemd) valt af voor Dordrecht: Zuidplas ligt 21 min van de Rotterdam-winkel en 22 min van Rijswijk en overlapt met beide; Dordrecht dekt de Drechtsteden (58% koop, 78% meer leads per huishouden dan de afstand voorspelt) zonder overlap.

## 1. Wat de Sonty-data zegt

**Databasis.** 23.276 leads uit het offerte-register (mei 2024 t/m september 2026), 640 woonplaatsen gegeocodeerd. Jaarbasis voor prognoses: september 2025 t/m augustus 2026 = 13.541 leads, 1.326 akkoorden, 1.091 "te ver". Akkoord = inkoopvak gevuld (regel Daimy).

**Afstand bepaalt conversie, maar reken met online-leads.** De totale conversie dichtbij Rijswijk zit vol winkelbezoekers (66% conversie); een nieuwe winkel trekt de óngeziene online-lead naar de online-conversie dichtbij:

| Afstand tot Rijswijk | Online-conversie | Online-leads | Alle kanalen |
|---|---|---|---|
| 0-10 km | **19,3%** | 2.890 | 26,5% |
| 10-20 km | **11,9%** | 3.952 | 15,1% |
| 20-30 km | **9,1%** | 3.207 | 10,9% |
| 30-50 km | **7,2%** | 4.177 | 8,2% |
| 50-80 km | **3,7%** | 3.899 | 4,3% |
| 80-∞ km | **0,9%** | 2.142 | 1,4% |

Het eerdere onderzoek (juli 2026) rekende met de alle-kanalen-curve (26,6% dichtbij) en overschatte de uplift daardoor met ruwweg een derde. Dit rapport corrigeert dat.

Afstand alleen verklaart 73,8% van het conversieverschil tussen gemeenten; koop, WOZ, inkomen en eengezins voegen samen 3,0 punt toe. **Een lead die er is, converteert overal ongeveer even goed op gelijke afstand.**

**Koopwoningen bepalen hoeveel leads er komen.** Leads per 1.000 huishoudens per jaar, gecorrigeerd voor afstand (regressie op 112 gemeenten, R² 60% tegen 48% voor afstand alleen): +10 punten koopwoningen = **+37% meer leads per huishouden**; +€10k gestandaardiseerd inkomen = +6%; WOZ en eengezins doen er dan niets meer toe. Ten opzichte van wat de afstand voorspelt:

| Gemeente | Leads/1.000 hh/jr | T.o.v. afstand | Koop |
|---|---|---|---|
| Waddinxveen | 9,7 | +177% | 66% |
| Haarlemmermeer | 6,2 | +158% | 67% |
| Barendrecht | 7,5 | +133% | 70% |
| Voorne aan Zee | 6,5 | +98% | 68% |
| Lansingerland | 9,0 | +86% | 73% |
| Dordrecht | 4,3 | +78% | 58% |
| Leiden | 1,9 | -53% | 41% |
| Delft | 3,2 | -62% | 37% |
| Amsterdam | 0,7 | -66% | 30% |
| Rijswijk | 8,7 | -66% | 49% |
| Den Haag | 2,6 | -70% | 42% |

Sonty is een suburbane koopwoning-zaak: de grote steden leveren volume door hun omvang, de randgemeenten leveren de dichtheid. Een winkel hoort aan de rand van een grote stad, met de koop-suburbs binnen 10 km, niet in het centrum.

**Winkel versus online.** Winkelbezoekers converteren 65,5% tegen 8,6% online. Orderwaarde €3.609, brutomarge 45,8%. Inloop Rijswijk laatste 12 maanden: 466 winkelleads, 251 akkoorden.

## 2. Vergelijking met Rijswijk

Referentieprofiel Rijswijk-kern (CBS-wijken binnen 10 km van de showroom, gewogen naar huishoudens): 46.7% koop, 32.3% eengezins, WOZ €372.6k, gestandaardiseerd inkomen €39.9k, 92.5% woningen ouder dan 10 jaar, adressendichtheid 4.180/km². Gemeente Rijswijk zelf: 49% koop, 30% eengezins, WOZ €354k, verkoopprijs 2025 €423k, 59.642 inwoners.

Sonty's best presterende gemeenten (akkoorden per 1.000 koopwoningen per jaar): Rijswijk 6,3, Delft 3,0, Zoetermeer 2,7, Pijnacker-Nootdorp 2,5, Leidschendam-Voorburg 1,9, Westland 1,4, 's-Gravenhage 1,2, Haarlemmermeer 1,1, Leiden 1,1, Rotterdam 0,7. Dat is de afstandsgradiënt plus de koop-suburbs.

Lookalike-score (0-100, gelijkenis met het Sonty-klantprofiel op koop, eengezins, WOZ, inkomen, bouwjaar, dichtheid; gewichten 30/20/15/15/10/10): Den Haag 86.2, Leiden 82.1, Rotterdam 82, Delft 81.6, Utrecht 76.5, Rijswijk 76.3, Vlaardingen 70.1, Amsterdam 66.6, Haarlem 62.5. "Lijkt op Rijswijk" is niet hetzelfde als "levert veel leads per huishouden"; daarom weegt de lookalike 15% in de totaalscore en de bewezen vraag 40%.

Volledige tabel (171 gemeenten binnen 90 km: koop%, eengezins%, WOZ, inkomen, verkoopprijs 2025, leads, conversie, residu) op de admin-pagina en in `resultaat.json` onder `gemeenten`.

## 3. Methode in het kort

1. Kandidaten: 270 punten = alle gemeenten 8-75 km van Rijswijk, plus voor steden ≥120.000 inwoners elke CBS-wijk ≥4.000 huishoudens.
2. Uplift per kandidaat: voor elke woonplaats binnen 20 km die dichter bij de nieuwe winkel ligt dan bij een bestaande, gaan de online-leads van hun huidige gemeten online-conversie naar de online-curvewaarde op de nieuwe afstand; "te ver"-leads (nu 0) naar de curvewaarde. Realistisch = 75% van die uplift, conservatief 50%.
3. Inloop: apart, als aandeel (25% / 50%) van de 251 akkoorden/jr die Rijswijk uit winkelbezoekers haalt. Aanname, niet gemeten.
4. Marktpotentieel: koopwoningen binnen 15 km (CBS 2024), gewogen met de koopwoning-index uit de penetratie-regressie; onbenut = koopwoningen die nu >20 km van elke winkel liggen × 8,2 leads per 1.000 koopwoningen (penetratie Rijswijk-kern). Upside via lokale marketing, zit niet in de nettocijfers.
5. Totaalscore: 45% bewezen uplift, 25% koopwoningen binnen 15 km, 15% onbenut potentieel, 15% lookalike. Alleen klantwaarde: het magazijn telt niet mee (Daimy 10-09), het gaat om omzet en winst.
6. Netwerk: greedy (steeds de beste marginale kandidaat; minimaal 18 km tussen winkels, 15 km van Rijswijk) én combinatorisch (94 geldige 4-sets uit de beste kandidaat per gemeente, top-20). Negen benoemde scenario's per winkel marginaal doorgerekend in volgorde.
7. Rijtijden: OSRM over echte wegen (2026-09-09).

## 4. Kosten en break-even (175-250 m²)

Huurbandbreedtes uit bronnenonderzoek (`01-huurprijzen-bronnen.md`): bedrijventerrein zichtlocatie €75-125/m² (midden €95), woonboulevard/PDV €90-160 (Rotterdam Alexandrium gemeten €209 kaal), centrum/aanloopstraat €150-350. Per winkel per jaar, 200 m² zichtlocatie: huur €19k, service €7k, 1,5 FTE €72k, lokale marketing €12k, inrichting €95k eenmalig over 5 jaar €19k = **€129k/jr**. Break-even = **79 extra akkoorden per jaar** (76 bij 175 m² zicht, 88 bij 250 m² PDV, 94 bij 200 m² centrum). Personeel is 56% van de kosten: de bezetting weegt zwaarder dan de m².

Gevoeligheid per winkel (netto/jr, 200 m² zicht, zonder inloop):

| Winkel | Basis | Huur +20% | Uplift −20% | Leads −30% | Alles tegen | Met 25% inloop | Met 50% inloop |
|---|---|---|---|---|---|---|---|
| Rotterdam-Zuid/Oost | +€115k | +€111k | +€66k | +€42k | +€4k | +€219k | +€323k |
| Haarlemmermeer | +€71k | +€67k | +€31k | +€11k | −€21k | +€174k | +€278k |
| Utrecht-rand | −€21k | −€25k | −€43k | −€54k | −€72k | +€83k | +€186k |
| Dordrecht-Zuid | −€19k | −€22k | −€41k | −€52k | −€71k | +€85k | +€189k |

## 5. Scenario's vergeleken (4 winkels, marginaal in volgorde)

| Scenario | Winkels (marginale akkoorden vol) | Akk/jr vol | Netto/jr zonder inloop | Met 25% inloop | Conservatief |
|---|---|---|---|---|---|
| K. Rotterdam + Amsterdam-West + Drechtsteden + Amsterdam-Oost | Rotterdam – Feijenoord +197, Amsterdam – De Aker +161, Dordrecht – Wijk 08 Crabbehof/Zuidhoven +89, Diemen +98 | +545 | +€160k | +€575k | −€66k |
| D. Rotterdam + Amsterdam-West + Utrecht + Drechtsteden | Rotterdam – Feijenoord +197, Amsterdam – De Aker +161, Utrecht – Wijk 02 Noordwest +77 | +435 | +€152k | +€463k | −€27k |
| I. Rotterdam-Zuid + Amsterdam-West + Zuidplas + Amsterdam-Oost | Rotterdam – IJsselmonde +194, Amsterdam – De Aker +161, Zuidplas +86, Diemen +98 | +539 | +€152k | +€567k | −€71k |
| J. Rotterdam + Amsterdam-West + Utrecht + Drechtsteden **(advies)** | Rotterdam – Feijenoord +197, Amsterdam – De Aker +161, Utrecht – Wijk 04 Noordoost +87, Dordrecht – Wijk 08 Crabbehof/Zuidhoven +89 | +534 | +€146k | +€561k | −€75k |
| B. Max marginale akkoorden (combinatorisch) | Albrandswaard +175, Haarlem – Boerhaavewijk +136, Zuidplas +108, Diemen +112 | +531 | +€142k | +€557k | −€77k |
| G. Rotterdam + Amsterdam-West + Amsterdam-Oost + Utrecht | Rotterdam – Feijenoord +197, Amsterdam – De Aker +161, Diemen +98, Utrecht – Wijk 02 Noordwest +71 | +527 | +€137k | +€552k | −€80k |
| H. Rotterdam + Amsterdam-West + Utrecht + Zuidplas | Rotterdam – Feijenoord +197, Amsterdam – De Aker +161, Utrecht – Wijk 02 Noordwest +77, Zuidplas +86 | +521 | +€130k | +€545k | −€85k |
| C. Rotterdam + Amsterdam gesplitst + Utrecht | Rotterdam – Feijenoord +197, Haarlem – Boerhaavewijk +136, Diemen +112, Utrecht – Wijk 02 Noordwest +71 | +516 | +€124k | +€539k | −€90k |
| F. Rotterdam + Amsterdam-West + Utrecht + Leiden | Rotterdam – Feijenoord +197, Amsterdam – De Aker +161, Utrecht – Wijk 02 Noordwest +77, Leiden – Bos- en Gasthuisdistrict +62 | +497 | +€100k | +€515k | −€105k |
| E. Rotterdam-Zuid + Zuidplas + Haarlemmermeer + Leiden | Rotterdam – IJsselmonde +194, Zuidplas +86, Haarlemmermeer – Badhoevedorp +147, Leiden – Bos- en Gasthuisdistrict +56 | +483 | +€83k | +€498k | −€117k |
| A. Greedy op totaalscore | Rotterdam – Kralingen-Crooswijk +200, Amsterdam – Geuzenveld +144, Utrecht – Wijk 02 Noordwest +77, Leiden – Bos- en Gasthuisdistrict +58 | +479 | +€78k | +€493k | −€120k |

Winkel 1 en 2 zijn in elk scenario gelijk (Rotterdam-Zuid/Oost en de Amsterdamse kant). Daimy's besluit (10-09): vier winkels van 175-200 m², kleiner is voor zonwering geen showroom. Scenario I heeft het hoogste netto maar zet twee winkels in Amsterdam (30% koop, laagste koopwoning-index). Het advies kiest Utrecht als derde (nieuwe regio, koopkracht-index 133.5, 2.414 latente leads/jr) en Dordrecht als vierde (koopkracht-index 155.8, 27 min van de Rotterdam-winkel, geen overlap).

## 6. Fasering

1. **Nu: Rotterdam-Zuid/Oost.** Grootste bewezen vraag buiten Haaglanden, positief zonder inloop. Het eerdere loods-onderzoek (Cornelisland/Reijerwaard, Schaapherderweg 5-f 263 m², Pesetastraat 84 351 m²) ligt in dit zoekgebied; voor 175-250 m² is Schaapherderweg 5-f de dichtstbijzijnde match, opnieuw te checken.
2. **Na 6 maanden twee dingen meten:** (a) online-conversie van leads binnen 10 km van winkel 1 moet van ~12% richting 19% gaan; (b) hoeveel inloop de winkel zelf trekt tegenover Rijswijk (466/jr). Klopt (a), dan is de curve causaal; klopt (b) op ≥25%, dan zijn winkel 3 en 4 verantwoord.
3. **Dan Haarlemmermeer / Amsterdam Nieuw-West** aan de A4/A9, bereikbaar voor Haarlem, Hoofddorp, Amstelveen en Amsterdam-West.
4. **Winkel 3 (Utrecht-rand A2/A27) en 4 (Dordrecht-Zuid A16)** op 175-200 m² met echte showroom (break-even 76-79 akkoorden/jr). Zonder inloop zijn ze licht negatief; met een kwart van de Rijswijkse inloop ruim positief. Daarom pas openen als winkel 1 die inloop laat zien, en met lokale marketing vanaf dag 1.

## 7. Wat dit onderzoek niet kan zeggen

- Of de conversiecurve causaal is (winkel dichtbij → hogere conversie) of deels selectie (dichtbij wonen → serieuzer). Bewijs komt uit winkel 1.
- Hoeveel inloop een nieuwe winkel trekt. Rijswijk staat er jaren en heeft reviews; 25% is een aanname.
- Den Haag zit als één woonplaats in het register (738 leads/jr); wijken zijn niet te scheiden. Den Haag blijft hoe dan ook bij Rijswijk.
- Concurrentiedichtheid is niet gemeten (geen betrouwbare openbare bron per gebied); tellen bij de bezichtiging.
- Huurprijzen zijn bandbreedtes uit rapporten en aanbod, geen offertes. Inrichting €95k is een aanname.
- Seizoen: 63% van de leads valt in maart t/m augustus; een najaarsopening ziet de eerste 5 maanden weinig.
- CBS-cijfers peiljaar 2024 (publicatie juni 2026), verkoopprijzen 2025.

## Bronnen
Sonty offerte-register (Google Sheet, tabs mei 2024 t/m sep 2026) · 85984NED Kerncijfers wijken en buurten 2024 (opgehaald 2026-09-09) · CBS 83625NED Bestaande koopwoningen verkoopprijzen 2025 · locatieserver v3_1 (opgehaald 2026-09-09) (geocoding, gemeente- en wijkcentroïden) · OSRM router.project-osrm.org table, 2026-09-09 · huurbronnen in `01-huurprijzen-bronnen.md`.
