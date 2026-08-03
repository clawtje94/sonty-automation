# Boekcontrole Markiezen Nederland 2026 (42 pagina's)

Bron: `~/Downloads/Prijslijst Markiezen Nederland 2026.pdf`. p1: **prijzen EXCL BTW** —
bevestigt onze opzet (markiezentabellen excl btw × markiezenFactor uit prijsconfig).
Methode: pagina als afbeelding, cel voor cel.

| p | onderwerp | status | bevinding |
|---|---|---|---|
| 1-27 | intro, specificaties, modellen, meetadvies | n.v.t. | geen prijzen die wij gebruiken |
| 26 | Specials | TE DOEN | |
| 28 | **Grenenhouten markiezen** | ✅ 03-08 | alle 153 cellen gelijk aan MK_GRENEN |
| 29 | Hardhouten markiezen | TE DOEN | |
| 30 | **Aluminium markiezen** | ✅ 03-08 | alle cellen goed t/m 500. ⚠️ boek loopt door tot 700, onze tabel stopte bij 500 — aangevuld |
| 31 | **Meerprijzen + elektrische bediening** | ✅ 03-08 | MK_BEDIENING klopt exact: LT 330, IO Sunilus 495, Solar RS100 665, Brel Solar 565, Situo 1 80 (= onze 575 voor io+zender) |
| 32 | Petmodel hardhout/aluminium | TE DOEN | verkopen wij dit? |
| 33 | Klapmodel aluminium | TE DOEN | verkopen wij dit? |
| 34-35 | Bekleden markiezen | TE DOEN | herstoffering, doen wij dat? |
| 36 | Losse onderdelen | TE DOEN | |
| 40 | Bovenkappen | TE DOEN | wij gebruiken MK_BOVENKAP, nog niet gecontroleerd |
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
