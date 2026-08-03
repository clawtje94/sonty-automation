# Boekcontrole Roma NL 2025 (328 pagina's)

Bron: `data/prijsboeken/Prijslijst 2025 Roma NL.pdf`.
Methode: pagina als afbeelding, volledige rijen naast onze data.

## DE BELANGRIJKSTE VONDST: het prijstype klopte niet

Ons databestand had `prijstype: "netto dealer EXCL BTW"`. **Dat is fout.** Bewijs uit het boek:

- p70 en p82, kader INTEGO: *"(**Lijstprijs** element + 26,40/St./m elementbreedte)"*
- p328: *"Alle **fabrieksprijzen**, in EURO."*
- p12106 in de tekstlaag: *"Kosten om tot minimale afname m² te komen (**dit is een netto prijs!**)"* —
  zo'n uitzondering zetten ze er alleen bij als de tabel zélf bruto is
- meerdere plekken: *"**Bruto** meerprijs € 198,00/element"*

Dus: de tabellen zijn **BRUTO LIJSTPRIJZEN excl BTW**, waar een dealerkorting overheen hoort te
gaan die niet in het boek staat. Meta gecorrigeerd op 2026-08-03.

**Dit bepaalt de werkelijke marge en die kan ik niet berekenen zonder het kortingspercentage.**
Bij de nu afgesproken opslag ×1,30 is de klantprijs 130% van de lijstprijs excl btw, oftewel
107% ervan ná btw. Krijgen wij bijvoorbeeld 40% dealerkorting, dan is de inkoop 60% van de
lijst en zit er ruim marge op. Krijgen wij niets, dan is het bijna kostprijs. **Vraag aan
Daimy: welk kortingspercentage krijgen wij bij Roma?**

## Tabellen

| tabel | pagina | status | resultaat |
|---|---|---|---|
| voorzetrolluik_xp | p70-71 | ✅ 03-08 | 4 volledige rijen × 33 breedtes nagerekend, 0 fouten. Ook de lege hoeken kloppen |
| voorzetrolluik_p | p82 | ✅ 03-08 | 5 volledige rijen × 16 breedtes, 0 fouten. Lege cellen vanaf breedte 1900 bij hoogte 4000 kloppen |
| voorzetrolluik_p (breed) | p83 | TE DOEN | breedtes 2400-4000 |
| voorzetrolluik_xp_solar | p72-73 | TE DOEN | |
| voorzetrolluik_p_solar | p84-85 | TE DOEN | |
| voorzetrolluik_p_gerolvormd | p88-90 | TE DOEN | |
| zipscreen2 | p226-228 | TE DOEN | 2.022 cellen, grootste tabel |
| zipscreen2_solar | p230-231 | TE DOEN | |
| trendo / zipscreen2_mini | — | leeg in onze data | wordt nergens gebruikt |

## Verder gevonden

1. **De tabelprijs is inclusief motor** (p71: "De prijzen hebben betrekking op elementen met
   RS100 io incl. RS100 io Smoove en ALUMINO lamellen"). Klopt met onze aanname.
2. **Meer- en minderprijzen die wij niet modelleren** (p71): bandbediening −412/element,
   monobediening −304, OXIMO WT-motor −134, ILMO2 WT −152, kunststofpantser −52/m²,
   noodhandbediening +68, aandrijfcombi 2 elementen 1 motor −326,20, kastkoppeling +18,20.
   Wij leveren Roma uitsluitend elektrisch (io of solar) en weigeren de rest, dus die
   minderprijzen zijn niet nodig — behalve als we ooit bandbediening gaan verkopen.
3. **INTEGO-uitvoering** (stucvoorbereiding): +26,40 per strekkende meter elementbreedte.
   Rekenen wij niet. Komt dat voor?
