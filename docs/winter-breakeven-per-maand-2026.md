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

## 6. Aanvulling 17-09 (Daimy: "hoeveel ads moeten we draaien om winst of zo min mogelijk verlies te draaien")

Model (scratchpad ads-optimum.js): per maand per kanaal leads = leads_vorig_jaar × (budget / budget_vorig_jaar)^0,65 (afnemende meeropbrengst: 2× budget = 1,6× leads, leadprijs +27%). Conversie en marge per akkoord = dezelfde maand vorige winter (Google conv gemaximeerd op 12%, Meta op 7%). Optimum = doorgaan tot een extra advertentie-euro nog precies één euro marge oplevert; dat is het punt waar de gemiddelde leadprijs 65% van de break-even per offerte raakt. Budget maximaal 2× vorig jaar. Google okt-dec: spend onbekend (V1), aangenomen €13k/mnd met leadprijs jan × 1,1-1,2. Meta: drie varianten voor de nieuwe rolluik-set (september kost een lead €23, vorig jaar september €57): volledig effect, half effect (midden), geen effect.

**Stop-leadprijs (gemiddeld, per maand): zolang je hieronder zit, verkleint elke extra euro ads het verlies.**

| | okt | nov | dec | jan | feb |
|---|---|---|---|---|---|
| Meta (Ads Manager CPL = sheet) | €33 | €37 | €35 | €49 | €72 |
| Google per sheet-offerte | €84 | €125 | €105 | €105 | €79 |
| Google doel-CPA in Google Ads (×0,75) | €63 | €94 | €79 | €79 | €59 |

Vorige winter zat Meta okt-dec op €66-87 per lead: ver boven de stop, daarom verloor Meta daar geld. Google jan-feb €63-69: onder de stop, dus daar was ruimte.

**Budgetadvies per maand (lasten €125k, midden-variant; bandbreedte = geen effect tot volledig effect nieuwe rolluik-set)**

| maand | Meta | Google | totaal ads | online orders | resultaat | winterplan (€140k ads) | €0 ads |
|---|---|---|---|---|---|---|---|
| okt | €4k (€1,5-12k) | €17k | €22k | 31 | **−€69k** (−65 à −71k) | −€82k | −€81k |
| nov | €8k (€3-23k) | €26k | €34k | 44 | **−€51k** (−43 à −54k) | −€75k | −€81k |
| dec | €4k (€1-10k) | €25k | €29k | 25 | **−€79k** (−75 à −80k) | −€99k | −€94k |
| jan | €39k (€17-39k) | €30k | €69k | 90 | **−€38k** (−10 à −54k) | −€57k | −€88k |
| feb | €43k | €34k | €77k | 107 | **+€29k** (−4 à +77k) | −€33k | −€55k |
| **okt-feb** | €98k | €132k | **€230k** | 296 | **−€208k** (−117 à −262k) | **−€346k** | **−€400k** |

Lezen:
1. **Meer adverteren, niet minder: het winterplan-budget (€140k) laat ~€140k verlies liggen.** Het optimum ligt op €230k okt-feb, vooral Google (2× vorig jaar, elke maand) en Meta in jan-feb (2×). Bij €115k lasten: elke maand €10k minder verlies, zelfde budgetten.
2. **Okt-dec blijft verlies, wat je ook doet** (−€65k tot −€80k per maand): de vraag is te klein. Meta daar alleen als de nieuwe rolluik-set de leadprijs onder €33-37 houdt; anders bijna uit. Google wel vol aan (rolluiken, screens, PMax).
3. **Jan-feb is waar winst te halen is**: 90-137 orders per maand haalbaar binnen capaciteit (~150). Februari kan bij €77k ads +€29k tot +€77k opleveren.
4. **De stuurregel is belangrijker dan het budgetgetal**: budget wekelijks +20% zolang de gemiddelde leadprijs onder de stop-waarde blijft, terugschroeven zodra erboven. Akkoorden pas na 4 weken beoordelen.
5. **Nu (september)**: Meta staat op €12,6k/mnd bij €23 per lead; stop-waarde september ≈ €45. Direct opschalen naar €20-25k/mnd, de rolluiken-campagne voorop.

Onzekerheden: elasticiteit 0,65 is een aanname (bij 0,5 liggen de optima 30% lager, bij 0,8 hoger); Google okt-dec zonder data (V1); Meta okt-dec hangt volledig aan de nieuwe rolluik-set. Wat niet onzeker is: bij de huidige leadprijzen ligt het optimum ruim boven het winterplan.
