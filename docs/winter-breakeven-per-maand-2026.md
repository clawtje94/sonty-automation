# Winter 26/27: hoeveel akkoorden per maand bij augustus-lasten en minder ad spend

Gemaakt 2026-09-17 op vraag van Daimy ("zelfde maandlasten als augustus maar minder ad spend, hoeveel akkoord per maand om zonder verlies de winter door te komen, staan de ads-budgetten goed of moeten we juist meer adverteren").
Bronnen: offerte-register (conversie-2025/2026-raw.json, 14-09), lasten-blok per maandtab (lasten-import.js, vers 17-09), Meta Marketing API (spend + actieve dagbudgetten, 17-09), ad-spend.json. Rekenscript: scratchpad winter-breakeven.js.
Alles ex btw. Marge = productmarge (verkoop − inkoop, €1-inkoop geschat via productratio). Resultaat = marge − lasten − ads. Lasten = alles behalve ads (definitie Daimy 31-07).

## 1. Kort antwoord

- **Augustus-lasten staan in de sheet op €125.000** (was eerder €140.000, september staat op €115.000).
- **Winterorder levert €1.400 productmarge ex btw** (okt-feb 25/26 gemeten €1.350, winterplan rekende €1.485).
- **Break-even bij €125k lasten: 90 akkoorden per maand zonder ads, ~100 bij het huidige Meta-tempo (€12,6k), ~110 bij het winterplan-budget (€26k okt).**
- **Vorige winter haalden we 48 · 48 · 36 · 69 · 84 (okt-feb, gemiddeld 57).** Break-even ligt dus bijna 2× zo hoog als wat de winter ooit heeft opgeleverd.
- **Conclusie: met augustus-lasten is de winter niet zonder verlies te doen, ook niet met €0 ads.** Verwacht verlies bij plan-budget: okt −€84k, nov −€83k, dec −€88k, jan −€64k, feb −€46k (≈ −€365k okt-feb). Bij €115k lasten €10k per maand minder verlies. Vorige winter (lasten ~€82k) was het −€134k okt-dec en −€11k jan-feb.
- **De hefboom is de lasten, niet de ads.** Elke €14k lasten minder = 10 akkoorden minder nodig. Bij lasten op het niveau van vorige winter (€82k) is break-even 59 (zonder ads) tot 78 (plan-budget): haalbaar in jan-feb, niet in okt-dec.
- **Minder adverteren maakt het verlies groter, niet kleiner, zolang een lead onder het plafond kost.** Meta rolluiken zit nu op €29 per lead (plafond okt €40, stop €75): elke €10k extra levert ~21 orders en ~€20k bijdrage aan de lasten. Meta op vorig-jaar-niveau okt-dec (€78 per lead) leverde niets op: dáár zat het lek, niet in "te veel" adverteren.

## 2. Break-even akkoorden per maand

| lasten | €0 ads | Meta nu €12,6k | plan okt €26,5k | plan jan €36k | augustus-niveau €62k |
|---|---|---|---|---|---|
| €125.000 (aug) | **90** (85-93) | 99 | 109 | 115 | 134 |
| €115.000 (sep) | 83 | 92 | 102 | 108 | 127 |
| €81.800 (vorige winter gem.) | 59 | 68 | 78 | 85 | 103 |

Bandbreedte = marge per order €1.485 tot €1.350. Vorige winter: okt 48, nov 48, dec 36, jan 69, feb 84 akkoorden.

## 3. Per maand, vorige winter tegen augustus-lasten

| maand | akk 25/26 | marge (×€1.400) | plan-ads 26/27 | resultaat bij €125k | bij €115k | werkelijk 25/26 (lasten ~€82k) |
|---|---|---|---|---|---|---|
| okt | 48 | €67.200 | €26.500 | −€84.300 | −€74.300 | −€50.318 |
| nov | 48 | €67.200 | €25.000 | −€82.800 | −€72.800 | −€37.650 |
| dec | 36 | €50.400 | €13.500 | −€88.100 | −€78.100 | −€46.050 |
| jan | 69 | €96.600 | €36.000 | −€64.400 | −€54.400 | −€16.754 |
| feb | 84 | €117.600 | €39.000 | −€46.400 | −€36.400 | +€5.947 |

## 4. Staan de ads-budgetten goed? (Meta gemeten 17-09, Google niet uitleesbaar)

Meta actief nu: rolluiken €300/dag (sep 1-17: €4.952, 168 leads, €29 per lead), pergola €85/dag (€1.412, 109 leads, €13), gordijnen €30/dag (€497, 13 leads, €38). Totaal €415/dag = €12,6k per maand; september tot 17-09 €7.077 (302 leads). Augustus was €24.113. Gepauzeerd: markiezen (klopt met het plan) en de oude winactie-berichten.

Wat dat betekent per €10.000 extra (winterconversie 25/26, marge €1.400-1.500):

| kanaal | leadprijs | offertes | orders | marge | bijdrage aan lasten |
|---|---|---|---|---|---|
| Meta rolluiken nu | €29 | 345 | 21 | €29.900 | **+€19.900** |
| Meta op okt-plafond | €40 | 250 | 16 | €21.700 | +€11.700 |
| Google winter | €70 | 143 | 15 | €22.900 | +€12.900 |
| Meta okt-dec vorig jaar | €78 | 128 | 7 | €9.900 | −€100 |

Advies:
1. **Meta rolluiken nu opschalen, niet afbouwen**: €29 per lead is ver onder het plafond (€40 okt-nov). Stapsgewijs +20% per 3-4 dagen zolang de leadprijs onder €40 blijft; stop bij €55 (regel B plafond) en pauzeer bij €75.
2. **Meta pergola aan laten** op €13 per lead (plafond €21-25), niet hoger dan €25.
3. **Google**: budgetten en spend aug/sep kan ik niet uitlezen (geen API). Winterplan: rolluiken + screens + PMax aan, pergola uit vanaf okt, doel-CPA in Google Ads = plafond × 0,75 (okt ≈ €56-75).
4. **Screens/knikarm Meta** staan uit: klopt voor okt-dec, knikarm weer aan vanaf de 2e week januari.
5. Elke campagne wekelijks tegen het plafond leggen (campagne-rendement.js); akkoorden pas na 4 weken beoordelen (mediaan offerte→akkoord 24 dagen).

## 5. Eerlijke kanttekeningen

- De vraag "hoeveel akkoorden om zonder verlies door de winter te komen" heeft bij €125k lasten geen haalbaar antwoord; het beste wintercijfer ooit is 84 (feb 26). Wie de winter zonder verlies wil, moet naar de lasten kijken: monteursbezetting/ZZP, lease, overhead (vorige winter €64-92k per maand).
- Augustus: 111 van 135 akkoorden hebben nog een €1-inkoop, de marge is geschat via productratio. Kan ±10% afwijken.
- Google-spend augustus en september ontbreekt, en Google okt-dec 2025 ook (open vraag V1 uit het winterplan). Daardoor is "alle ads-budgetten" alleen voor Meta hard gemeten.
- Lasten-blok in de sheet is wat het team invult; €125k voor aug is de stand van 17-09.
