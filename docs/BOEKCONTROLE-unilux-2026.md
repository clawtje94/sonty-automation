# Boekcontrole Unilux horren 2026 (16 pagina's)

Bron: `data/unilux/adviesprijslijst-2026.pdf`. p1: **Adviesprijslijst, incl. BTW**.
Onze opgeslagen bedragen zijn advies **+10%**; dat is de Sonty-verkoopprijs en er mag dus
geen enkele factor meer overheen (zie `uniluxAlIngerekend` in prijsconfig.json).

| p | onderwerp | status | bevinding |
|---|---|---|---|
| 3 | **Raamhor/hordeur COMFORT** | ✅ 03-08 | alle prijzen exact advies × 1,10. Ook de aflopende hoeken (bij grotere maten geen rolhor) kloppen |
| 3 | COMFORT opties | ✅ 03-08 | ⚠️ RAL-meerprijs **per stuk** ontbrak, zie bevinding 1 |
| 4 | Raamhor SUPER+ | TE DOEN | |
| 5 | Raamhor voorzethor | TE DOEN | |
| 6 | Raamhor veerstifthor/softfit | TE DOEN | |
| 7 | Raamhor inklemhor | TE DOEN | |
| 8 | Raamhor voorzet unit | TE DOEN | |
| 9 | Raamhor inklem unit | TE DOEN | |
| 10 | Hordeur plisséfit | TE DOEN | |
| 11 | Hordeur dubbele plisséfit | TE DOEN | |
| 12 | Vaste hordeur luxe | TE DOEN | |
| 13 | Schuifhordeur luxe | TE DOEN | |
| 14 | Services (afhaalkosten, orderkosten) | TE DOEN | mogelijk kosten die we niet doorberekenen |

## Bevindingen

1. **RAL-meerprijs per stuk ontbrak.** Boek p3 rekent bij een afwijkende kleur TWEE dingen:
   een starttarief per order (advies €91 → bij ons €100) **en** een meerprijs per hor
   (advies €71 → €78; structuurlak advies €91 → €100). Wij rekenden alleen het starttarief.
   Bij drie horren in een afwijkende kleur lieten we dus €156 liggen. Toegevoegd aan
   `unilux-horren-2026.json` en aan de offerte-tool.
2. **Structuurlak nog niet te onderscheiden.** Het `kleurType` in de offerte-tool kent alleen
   standaard/trend/ral, dus we rekenen nu altijd de gewone RAL-meerprijs van €78. Voor
   structuurlak is dat €22 per hor te laag. Op te lossen door het kleurtype uit te breiden.
3. **Maatvoering: kastmaat vs geleidermaat.** Boek p3 heeft de kastmaat op de verticale as en
   de geleidermaat horizontaal. Onze `heights` zijn de kastmaat (600-2600) en `widths` de
   geleidermaat (800-1800) — dat staat goed om.
