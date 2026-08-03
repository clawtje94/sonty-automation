# Boekcontrole Markiezen Nederland 2026 (42 pagina's)

Bron: `~/Downloads/Prijslijst Markiezen Nederland 2026.pdf`. p1: **prijzen EXCL BTW** —
bevestigt onze opzet (markiezentabellen excl btw × markiezenFactor uit prijsconfig).
Methode: pagina als afbeelding, cel voor cel.

| p | onderwerp | status | bevinding |
|---|---|---|---|
| 1-27 | intro, specificaties, modellen, meetadvies | n.v.t. | geen prijzen die wij gebruiken |
| 26 | Specials (ronde markies, baldakijn, model 1-4) | ✅ 03-08 | eigen, veel duurdere tabel (300 cm/uitval 150 = €2.383 tegen €1.499 aluminium). Wij hebben die tabel niet |
| 28 | **Grenenhouten markiezen** | ✅ 03-08 | alle 153 cellen gelijk aan MK_GRENEN |
| 29 | **Hardhouten markiezen** | ✅ 03-08 | alle cellen t/m 420 gelijk aan MK_HARDHOUT. ⚠️ boek heeft ook 440-500 (7 cm latten) — aangevuld |
| 30 | **Aluminium markiezen** | ✅ 03-08 | alle cellen goed t/m 500. ⚠️ boek loopt door tot 700, onze tabel stopte bij 500 — aangevuld |
| 31 | **Meerprijzen + elektrische bediening** | ✅ 03-08 | MK_BEDIENING klopt exact: LT 330, IO Sunilus 495, Solar RS100 665, Brel Solar 565, Situo 1 80 (= onze 575 voor io+zender) |
| 32 | Petmodel hardhout/aluminium | ✅ gezien | eigen tabel, hebben wij niet. Komt 2× voor in de 2026-offertes, dus handmatig geprijsd |
| 33 | Klapmodel aluminium | ✅ gezien | eigen tabel, hebben wij niet. 1× in de Gripp-verkoopregels |
| 34-35 | Bekleden markiezen (herstofferen) | ✅ gezien | dienst, komt 0× voor in onze offertes |
| 36 | Losse onderdelen | ✅ 03-08 | servicedelen (beugels, koord, biesband). Horen niet in een nieuwbouwofferte |
| 40 | **Bovenkappen + zijkappen** | ✅ 03-08 | MK_BOVENKAP_HARDHOUT, MK_BOVENKAP_ALU, MK_ZIJKAP_HARDHOUT en MK_ZIJKAP_ALU allemaal exact gelijk aan het boek |
| 41-42 | profielen, adres | n.v.t. | |

## Bevindingen

1. **Aluminiumtabel liep bij ons tot 500 cm, in het boek tot 700 cm.** Tien breedtes
   (520–700) ontbraken. Aangevuld uit p30.
2. **Vanaf 440 cm breed is een tussenpoot (€160) of verzwaard profiel (€350) VERPLICHT**
   (boek p30). Wij rekenden dat niet. Welke van de twee is een keuze die wij niet kunnen
   maken, dus die maten gaan nu naar handmatige controle in plaats van een prijs zonder
   verplichte verzwaring. De regressietest legde het oude gedrag vast en is bijgewerkt met
   uitleg.
   *Nauwkeurigheidscorrectie:* ik meldde eerst dat een echte offerte van 460 cm een prijs
   zonder verzwaring had gekregen. Dat klopt niet: die offerte stond op materiaal "Hout",
   en de grenen/hardhouttabellen stoppen al bij 420, dus die gaf al null. Er is dus **geen
   enkele klant geraakt**; het gat was alleen mogelijk bij aluminium 440–500.

## Open vragen voor Daimy

3. **Kleurtoeslag markiezen.** Boek p28 (hout): standaard alleen RAL 9001 en 9010, alle
   andere kleuren **€150 per order**. Boek p30 (aluminium): acht standaardkleuren, alle
   andere RAL **+10%**, en dan zijn aluminium scharnieren standaard (**+€100 per markies**).
   Wij rekenen geen van drieën. Doorberekenen?
4. **Doektoeslag markiezen.** Boek p28/p30: Swela en Sunvas +15%, Dickson MAX / Soltis PVC /
   MN 2-kleuren +20%, Sattler Lumera +5% op de tabelprijs. Wij rekenen dat niet. Bij
   Sunmaster was het antwoord "we verkopen standaard Sergé 5%" — geldt hier iets
   vergelijkbaars?
5. **Zwaardere motor +€44 bij markiezen breder dan 4,5 m** (p31). Niet berekend.
6. **Achterpoten rond of afgeschuind €25 per markies** (p28). Recht is standaard.
7. Verkopen wij het **petmodel** (p32) en het **klapmodel** (p33)? Die staan niet in onze
   data. En doen wij **bekleden/herstofferen** (p34)? Zo ja, dan moeten die tabellen erbij.

8. **Hardhouttabel liep bij ons tot 420 cm, het boek heeft ook 440-500** (blok "vanaf 440cm
   breed, 7 cm latten"). Aangevuld. Onze tabellen tellen nu 21 breedtes hardhout en 31
   aluminium, precies als het boek.
9. **Kappen: wij modelleren alleen de "recht"-variant.** Boek p40 heeft per kap vier
   varianten. Prijsverschil bij 300 cm breed: hardhout recht 25 diep €205 (wat wij rekenen)
   tegen sierlijst 25 diep €315, recht 30 diep €266, sierlijst 35 diep €528. Zijkap bij
   uitval 150: hardhout recht 22 cm €145 tegen golf 32 cm €314; aluminium recht 20 cm €199
   tegen golf 25 cm €402.
   In onze 2026-offertes komt alleen "recht" voor (20×), dus vandaag klopt het. Kiest een
   klant bij het inmeten een golf- of sierlijstkap, dan missen we €29 tot €203.
10. **Modellen die het boek wel heeft en wij niet:** specials/ronde markies (p26), petmodel
   (p32), klapmodel (p33) en bekleden/herstofferen (p34). Petmodel komt 2× voor in de
   2026-offertes en klapmodel 1× in de Gripp-verkoopregels, dus die worden nu met de hand
   geprijsd. Wil Daimy ze automatisch, dan moeten die tabellen erbij.

## Beslissingen Daimy 2026-08-03 (nog te bouwen)

- **b. Kleurtoeslag: JA doorberekenen.** Hout €150 per order buiten RAL 9001/9010.
  Aluminium +10% buiten de acht standaardkleuren, plus €100 aluminium scharnieren
  (die zijn dan standaard).
- **c. Doektoeslag: JA.** Let op — gewone Dickson ís standaard: de standaardcollectie is
  "uni- en streepdoeken van Tibelly/Sattler/Dickson/Citel" en kost €0. De toeslagen gelden
  voor de premiumlijnen: Swela en Sunvas +15%, **Dickson MAX** / Soltis PVC / MN 2-kleuren
  +20%, Sattler Lumera +5%.
- **d. Zwaardere motor +€44 boven 4,5 m: JA.**
- **e. Achterpoten rond/afgeschuind €25: JA.**
- **f. Petmodel (p32), klapmodel (p33) en specials (p26) tabellen erbij: JA.**
- **g. Kappen:** recht blijft standaard, de andere varianten (sierlijst, golf, modern, en de
  diepere uitvoeringen) als optie erbij.
