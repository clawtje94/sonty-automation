# Vier Sonty-winkels (175-250 m²): waar, in welke volgorde, en wat het oplevert
_Onderzoek 9 september 2026. Model: `~/sonty/scripts/winkels-4-analyse.js`, uitvoer `~/sonty/data/winkels-4/resultaat.json`. Live pagina: sonty.nl/admin/winkels-4._

## Samenvatting (de beslissing)

Het netwerk dat op Sonty-data én op koopkracht/koopwoningen het beste scoort, in de volgorde van openen:

| # | Zoekgebied | Waarom hier | Extra akkoorden/jr (realistisch) | Netto per jaar bij 200 m² zichtlocatie | Robuust? |
|---|---|---|---|---|---|
| 1 | **Rotterdam-Zuid/Oost langs de A16** (IJsselmonde–Feijenoord–Kralingen; Ridderkerk/Barendrecht Cornelisland-Reijerwaard scoort vrijwel gelijk) | Grootste leadpool buiten Haaglanden: 3.007 leads/jr binnen 20 km, nu 12% conversie (Rotterdam) tegen 26,5% dichtbij een winkel. 10-19 min van magazijn Berkel. Koopwoning-index 132 (hoog, door Barendrecht/Ridderkerk/Capelle/Krimpen) | +235 (vol +313) | **+€259k** (worst-case +€84k) | Ja |
| 2 | **Haarlemmermeer/Amsterdam Nieuw-West bij A4/A9** (Badhoevedorp–Osdorp–De Aker; Hoofddorp aan de andere kant) | 1.888 leads/jr binnen 20 km die nu op 7-13% converteren. Haarlemmermeer is Sonty's sterkste markt op afstand: 431 leads/jr, 67% koop, +157% meer leads per huishouden dan de afstand voorspelt. Bereikt ook Haarlem en Amstelveen | +182 (vol +242) | **+€171k** (worst-case +€35k) | Ja |
| 3 | **Utrecht-West (A2, Leidsche Rijn/Noordwest)** | Nieuwe regio met de hoogste koopkracht-index van de shortlist (134) en het grootste onbenutte potentieel (+2.437 latente leads/jr). Nu maar 802 leads/jr in het gebied: rendement hangt af van lokale marketing | +86 (vol +114) | **+€12k** (bij 175 m² lage huur +€20k; worst-case −€54k) | Nee, pas na bewijs van 1 en 2 |
| 4 | **Zuidplas/Rotterdam-Noordoost (A20, Nieuwerkerk–Gouda)** | Splitst de Rotterdamse regio in Zuid en Noordoost, dekt Gouda, Waddinxveen, Lansingerland, Alphen. Koopwoning-index 133. 9 min van magazijn Berkel | +95 (vol +127) | **+€28k** (worst-case −€45k) | Nee, dun |

Totaal scenario H (deze vier): **+598 akkoorden/jr realistisch, €2,15 mln extra omzet, €471k netto per jaar** na alle winkelkosten. Eenmalig €95k inrichting per winkel (aanname).

Conclusie: **winkel 1 en 2 zijn op de data verantwoord; winkel 3 en 4 zijn dat pas als de uplift van 1 en 2 in de praktijk klopt.** Elke variant met 4 winkels leunt voor de laatste twee op dunne marges. De meest winstgevende 4-set volgens het model is variant I (Rotterdam-Zuid, Amsterdam-West, Zuidplas, Amsterdam-Oost/Diemen, +€497k) maar die stapelt twee winkels in Amsterdam met de laagste koopwoning-index van alle kandidaten (30% koop). Utrecht opent een nieuwe regio en past beter bij de klant die Sonty nu al heeft.

Leiden (18 min van Rijswijk) valt af: het steelt vooral van de bestaande showroom en is bij elke gevoeligheid negatief.

## 1. Wat de Sonty-data zegt

**Databasis.** 23.276 leads uit het offerte-register (mei 2024 t/m 9 september 2026), 2.688 akkoorden (inkoop gevuld), €9,86 mln akkoord-omzet, 640 woonplaatsen gegeocodeerd. Jaarbasis voor prognoses: september 2025 t/m augustus 2026 = 13.541 leads, 1.326 akkoorden, 1.091 "te ver".

**Afstand bepaalt conversie.** Herijkt op de nieuwe data:

| Afstand tot showroom Rijswijk | Conversie | Leads |
|---|---|---|
| 0-10 km | 26,5% | 3.370 |
| 10-20 km | 15,2% | 4.314 |
| 20-30 km | 10,9% | 3.335 |
| 30-50 km | 8,2% | 4.269 |
| 50-80 km | 4,2% | 4.004 |
| > 80 km | 1,4% | 2.164 |

Afstand alleen verklaart 74% van de spreiding in conversie tussen gemeenten (regressie, 112 gemeenten). Koopwoningen, WOZ, inkomen en eengezins voegen daar samen maar 3 punten aan toe: **als een lead er eenmaal is, converteert hij overal ongeveer even goed op gelijke afstand.**

**Koopwoningen bepalen hoeveel leads er komen.** Leads per 1.000 huishoudens per jaar, gecorrigeerd voor afstand: +10 punten koopwoningen = +37% meer leads per huishouden; +€10k gestandaardiseerd inkomen = +6%; WOZ en eengezins doen er dan niets meer toe (R² 60%, afstand alleen 48%). Dat is het "koopkracht/koopwoning"-effect en het is groot. Concreet, ten opzichte van wat de afstand voorspelt:

| Gemeente | Leads/1.000 hh/jr | T.o.v. afstand | Koop |
|---|---|---|---|
| Waddinxveen | 9,7 | +177% | 66% |
| Haarlemmermeer | 6,2 | +157% | 67% |
| Barendrecht | 7,5 | +133% | 70% |
| Voorne aan Zee | 6,5 | +98% | 68% |
| Lansingerland | 9,0 | +86% | 73% |
| Dordrecht | 4,3 | +78% | 58% |
| Rotterdam | 2,4 | −51% | 35% |
| Utrecht | 1,1 | −46% | 44% |
| Amsterdam | 0,7 | −66% | 30% |
| 's-Gravenhage | 2,6 | −70% | 42% |

Sonty is een suburbane koopwoning-zaak: de grote steden leveren volume door hun omvang, de randgemeenten leveren de dichtheid. Een winkel hoort dus aan de rand van een grote stad, met de koop-suburbs binnen 10 km, niet in het centrum.

**Winkel versus online.** 865 winkelleads converteren 65,5% (was 65,5%), 22.015 online-leads 8,6%. Gemiddelde orderwaarde €3.609, brutomarge 45,8% (ongewijzigd uit het eerdere onderzoek).

## 2. Vergelijking met Rijswijk

Referentieprofiel Rijswijk-kern (CBS-wijken binnen 10 km van de showroom, gewogen naar huishoudens): 46,7% koop, 32,3% eengezins, WOZ €373k, gestandaardiseerd inkomen €39,9k, 92,5% woningen ouder dan 10 jaar, adressendichtheid 4.180/km². De gemeente Rijswijk zelf: 49% koop, 30% eengezins, WOZ €354k, verkoopprijs 2025 €423k, 59.642 inwoners.

Sonty's best presterende gemeenten (akkoorden per 1.000 koopwoningen): Rijswijk 6,3, Delft 3,0, Zoetermeer 2,7, Pijnacker-Nootdorp 2,5, Leidschendam-Voorburg 1,9, Westland 1,4, Den Haag 1,2, Haarlemmermeer 1,1, Leiden 1,1, Rotterdam 0,7. Dat is puur de afstandsgradiënt plus de koop-suburbs.

Lookalike-score (0-100, gewogen afstand tot het Sonty-klantprofiel op koop, eengezins, WOZ, inkomen, bouwjaar, dichtheid; gewichten 30/20/15/15/10/10): Den Haag 86, Rotterdam 82, Leiden 82, Delft 82, Utrecht 77, Rijswijk 76, Schiedam 70, Amsterdam 67, Haarlem 63. De lookalike-score lijkt sterk op Rijswijk voor stedelijke gemeenten, maar de penetratie-analyse hierboven laat zien dat "lijkt op Rijswijk" niet hetzelfde is als "levert veel leads per huishouden". Daarom weegt de lookalike maar 15% in de totaalscore en de bewezen vraag 40%.

Volledige gemeentetabel (171 gemeenten binnen 90 km met koop%, eengezins%, WOZ, inkomen, verkoopprijs 2025, leads, conversie, residu): op de admin-pagina en in `resultaat.json` onder `gemeenten`.

## 3. Methode in het kort

1. Kandidaten: 270 punten = alle gemeenten 8-75 km van Rijswijk, en voor steden ≥120.000 inwoners elke CBS-wijk ≥4.000 huishoudens (Rotterdam, Den Haag, Amsterdam, Utrecht, Haarlem, Leiden, Dordrecht, Zoetermeer, …).
2. Uplift per kandidaat: voor elke woonplaats binnen 20 km die dichter bij de nieuwe winkel ligt dan bij een bestaande, trekt de conversie van de huidige gemeten waarde naar de curvewaarde op de nieuwe afstand; "te ver"-leads (nu 0) gaan naar de curvewaarde. Realistisch = 75% van die uplift, conservatief 50%.
3. Marktpotentieel: koopwoningen binnen 15 km (CBS 2024), gewogen met de koopwoning-index uit de penetratie-regressie; onbenut = koopwoningen die nu >20 km van elke winkel liggen × 8,2 leads per 1.000 koopwoningen (de penetratie in de Rijswijk-kern). Dit is upside via lokale marketing en zit NIET in de nettocijfers.
4. Totaalscore: 40% bewezen uplift, 20% koopwoningen binnen 15 km, 15% onbenut potentieel, 15% lookalike, 10% logistiek (afstand magazijn Berkel).
5. Netwerk: greedy (steeds de beste marginale kandidaat, minimaal 18 km tussen winkels en 15 km van Rijswijk) én combinatorisch (alle 4-sets uit de beste kandidaat per gemeente, top-20: 200 geldige sets). Negen benoemde scenario's per winkel marginaal doorgerekend.
6. Rijtijden: OSRM (werkelijke wegen), 9 september 2026.

## 4. Kosten en break-even (175-250 m²)

Huurbandbreedtes uit bronnenonderzoek (`01-huurprijzen-bronnen.md`): bedrijventerrein zichtlocatie €75-125/m² (midden €95), woonboulevard/PDV €90-160 (midden €120; Rotterdam Alexandrium gemeten €209 kaal), centrum/aanloopstraat €150-350. Per winkel per jaar, 200 m² zichtlocatie: huur €19k, service €7k, 1,5 FTE €72k, lokale marketing €12k, inrichting €95k eenmalig afgeschreven over 5 jaar €19k = **€129k/jr**. Break-even = **79 extra akkoorden per jaar** (76 bij 175 m² zicht, 88 bij 250 m² PDV, 94 bij 200 m² centrum).

Personeel is 56% van de kosten: de m² maken weinig uit, de bezetting wel. Een winkel die alleen op afspraak open is met 1 FTE zakt naar ~€95k/jr en 58 akkoorden break-even.

Gevoeligheid per winkel (netto/jr, 200 m² zicht):

| Winkel | Basis | Huur +20% | Uplift −20% | Leads −30% | Alles tegen |
|---|---|---|---|---|---|
| Rotterdam-Zuid/Oost | +€259k | +€255k | +€181k | +€143k | +€84k |
| Haarlemmermeer/A'dam-West | +€171k | +€167k | +€111k | +€81k | +€35k |
| Utrecht-West | +€12k | +€9k | −€16k | −€30k | −€54k |
| Zuidplas | +€28k | +€25k | −€3k | −€19k | −€45k |

## 5. Scenario's vergeleken (4 winkels, marginaal in volgorde)

| Scenario | Winkels | Akk/jr vol | Netto/jr 200 m² | Conservatief |
|---|---|---|---|---|
| H (advies) | Rotterdam-Zuid/Oost, A'dam-West, Utrecht, Zuidplas | +796 | €471k | €142k |
| I (max netto) | Rotterdam-Zuid, A'dam-West, Zuidplas, A'dam-Oost/Diemen | +817 | €497k | €159k |
| G | Rotterdam, A'dam-West, A'dam-Oost, Utrecht | +800 | €476k | €145k |
| B (max akkoorden) | Albrandswaard, Haarlem, Zuidplas, Diemen | +806 | €483k | €150k |
| C | Rotterdam, Haarlem, Diemen, Utrecht | +784 | €456k | €132k |
| F | Rotterdam, A'dam-West, Utrecht, Leiden | +771 | €440k | €121k |
| A (greedy op score) | Rotterdam, A'dam-Geuzenveld, Utrecht, Leiden | +743 | €405k | €98k |
| E | Rotterdam-Zuid, Zuidplas, Badhoevedorp, Leiden | +752 | €416k | €105k |

Alle scenario's zitten binnen 10% van elkaar. De keuze voor winkel 1 en 2 is in elk scenario gelijk; de discussie gaat alleen over 3 en 4.

## 6. Fasering

1. **Nu: Rotterdam-Zuid/Oost.** Kortste afstand tot magazijn, grootste bewezen vraag, positief in elk scenario. Het eerdere loods-onderzoek (Cornelisland/Reijerwaard, Schaapherderweg 5-f 263 m², Pesetastraat 84 351 m²) ligt in dit zoekgebied; voor 175-250 m² is Schaapherderweg 5-f de dichtstbijzijnde match, opnieuw te checken.
2. **Na 6 maanden meten** (conversie van leads binnen 10 km van winkel 1 moet richting 20-26% gaan; nu 12%). Klopt dat, dan is de curve causaal en niet alleen correlatie. Dat is de grootste aanname van dit hele model.
3. **Dan Haarlemmermeer/Amsterdam Nieuw-West.** Zoek aan de A4/A9 (Badhoevedorp, Osdorp, Hoofddorp-Noord): bereikbaar voor Haarlem, Hoofddorp, Amstelveen en Amsterdam-West.
4. **Winkel 3 en 4 alleen met kleiner format** (175 m², lage huur, 1 FTE op afspraak) en met lokale marketing om het onbenutte potentieel aan te boren: Utrecht-West (2.437 latente leads/jr) en Zuidplas/Rotterdam-NO.

## 7. Wat dit onderzoek niet kan zeggen

- Of de conversiecurve causaal is (winkel dichtbij → hogere conversie) of deels selectie (dichtbij wonen → serieuzer). De 65,5% winkelconversie wijst op een echt showroomeffect, maar bewijs komt pas uit winkel 1.
- Den Haag zit als één woonplaats in het register (738 leads/jr), wijken zijn niet te scheiden. Voor dit onderzoek maakt dat niet uit: Den Haag blijft bij Rijswijk.
- Concurrentiedichtheid is niet gemeten (geen betrouwbare openbare bron per gebied); tellen bij de bezichtiging.
- Huurprijzen zijn bandbreedtes uit rapporten en aanbod, geen offertes. Inrichting €95k is een aanname.
- Seizoen: 63% van de leads valt in maart-augustus; een winkel die in het najaar opent, ziet de eerste 5 maanden weinig.
- CBS-cijfers zijn peiljaar 2024 (gepubliceerd juni 2026); verkoopprijzen 2025.

## Bronnen
Sonty offerte-register (Google Sheet, tabs mei 2024 t/m sep 2026) · CBS 85984NED Kerncijfers wijken en buurten 2024 (opgehaald 09-09-2026) · CBS 83625NED Bestaande koopwoningen verkoopprijzen 2025 · PDOK Locatieserver v3_1 (geocoding, gemeente- en wijkcentroïden) · OSRM router.project-osrm.org (rijtijden) · huurbronnen in `01-huurprijzen-bronnen.md`.
