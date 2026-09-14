# Winter-advertentieplan 2026/27: welke categorieën, hoeveel budget, max CPA

Gemaakt 2026-09-14 op vraag van Daimy ("hoeveel en welke categorieën in de winter door adverteren, wat is de max CPA, onderzoek met de sheet").
Bron: offerte-register (conversie-2024/2025/2026-raw.json, ververst 14-09 08:35), Meta Marketing API per campagne (okt 2025 t/m feb 2026, vandaag bijgehaald in campagne-spend-meta.json), Google-spend per campagne jan-feb 2026, maand-lasten.json.
Methode: akkoord-definitie en productgroepen exact als scripts/seizoensplan.js. Winter = okt t/m feb, twee seizoenen (24/25 en 25/26). **Alle bedragen ex btw** (sheet ÷ 1,21). Marge = productmarge (verkoop − inkoop). Scripts: scratchpad winter-cat.js + winter-netto.js (uitvoer winter-cat.json).
Vervangt de Google-notitie van 04-09 (docs/google-ads-winterplan-2026.md) als het gaat om plafonds; die stonden incl. btw.

## 1. Kort antwoord

- **Vier categorieën de hele winter aan:** rolluiken (Google én Meta), screens (Google), algemeen zonwering / Performance Max (Google), pergola (alleen Meta, alleen goedkoop).
- **Twee categorieën aan vanaf de tweede week januari:** knikarmschermen (Google + Meta vroegboek), uitvalschermen (meeliften in knikarm-campagne). Okt t/m dec halen ze vrijwel niets (knikarm okt-jan 10 orders op 88 Google-offertes; Meta 0 op 37).
- **Eén test, klein:** raamdecoratie binnen met de showroom als CTA (slaging 22-27%, maar cel klein).
- **Uit:** Google-pergola (1 order op 126 winteroffertes), markiezen nov-jan, eigen voorraadscherm-campagne, Meta-screens zodra boven €30 per lead.
- **Max CPA (per offerte in de sheet), per maand in §4.** Okt-nov (verlies minimaliseren, team aan het werk): Google rolluiken doel €90-100 / plafond €125-140 / stop €175-200, Meta rolluiken €40 / €70 / €100. December: de helft. Jan-feb (winst per lead, montage valt in vol voorjaar): Google rolluiken €45-60 / €55-75 / €75-105, Meta €30-40 / €40-50 / €55-70.
- **Budget:** €106k (bij doel-CPA) tot €144k (bij plafond) over okt-feb: okt €22-30k, nov €21-29k, dec €11-15k, jan €27-35k, feb €25-34k (§4). Google €61-101k, Meta €45-66k. Vorige winter ≈ €160-170k. Zwaartepunt naar okt-nov, want die orders worden in dec-jan gemonteerd (team op 24-32%); jan-feb-orders landen in mrt-apr (100-123%).

## 2. Wat de sheet zegt over winter 25/26 (okt-feb), per kanaal per maand

Netto = productmarge ex btw − advertentiekosten. Vaste lasten (monteurs, lease, overhead) zitten hier NIET in, zie §6.

| maand | Google off | akk | marge ex | spend | netto | Meta off | akk | marge ex | spend | netto |
|---|---|---|---|---|---|---|---|---|---|---|
| okt 25 | 146 | 16 | €18.938 | ? | ? | 204 | 13 | €14.056 | €14.651 | **−€595** |
| nov 25 | 112 | 17 | €28.539 | ? | ? | 222 | 12 | €13.297 | €14.562 | **−€1.265** |
| dec 25 | 126 | 11 | €20.327 | ? | ? | 199 | 7 | €12.004 | €17.315 | **−€5.311** |
| jan 26 | 217 | 26 | €41.265 | €15.044 | +€26.222 | 378 | 22 | €34.116 | €19.284 | +€14.832 |
| feb 26 | 283 | 25 | €37.439 | €17.862 | +€19.578 | 438 | 35 | €60.779 | €21.334 | +€39.445 |
| **winter** | 884 | 95 (10,7%) | €146.508 | ≥€32.905 | jan-feb +€45.800 | 1.441 | 89 (6,2%) | €134.252 | €87.146 | **+€47.106** |

Lezen: Meta verdiende in okt-dec niets terug (€0,85 productmarge per advertentie-euro) en verloor in december €5.300; jan-feb maakte het goed (€2,34 per euro). Google deed in jan-feb €2,39 per euro, dus in de kernwinter zijn beide kanalen gelijkwaardig; het verschil zit in okt-dec bij Meta. Google okt-dec 2025 kan niet netto berekend worden: spend onbekend (V1).

## 3. Per categorie: conversie, break-even en max CPA

Break-even per offerte = productmarge per offerte (conv × marge per akkoord). **Plafond = 35% daarvan** (het niveau waarop zomer én winter 2026 aantoonbaar winst gaven; 65% blijft over voor montage en vaste lasten). **Harde stop = 50%.** "Gerealiseerd" = kosten per sheet-offerte winter 25/26 (Meta: campagne-spend, Google: jan-feb, eigen campagne + aandeel generieke campagnes naar offerte-aandeel).

### Google (beide winters, 1.121 offertes, 13,6%)

| categorie | off | akk | conv | marge/akk | break-even/off | **plafond** | stop | gerealiseerd 25/26 | advies |
|---|---|---|---|---|---|---|---|---|---|
| Rolluiken | 468 | 65 | 13,9% | €1.327 | €184 | **€64** | €92 | €64 | AAN, opschalen (40% van de Google-winterleads) |
| Screens | 156 | 21 | 13,5% | €2.011 | €271 | **€95** | €135 | €84 | AAN, opschalen (hoogste marge/akkoord) |
| Zonwering algemeen / PMax | 65 | 16 | 24,6% | €1.119 | €275 | **€96** | €138 | ~€49 | AAN (PMax houden) |
| Knikarmscherm | 148 | 23 | 15,5% | €1.550 | €241 | **€84** | €120 | €54 | AAN vanaf 2e week jan; feb 13/60 = 22% |
| Uitvalscherm | 24 | 4 | 16,7% | €1.351 | €225 | €79 | €112 | €49 | meeliften met knikarm vanaf jan (cel klein) |
| Raamdecoratie | 36 | 8 | 22,2% | €1.024 | €228 | €80 | €114 | €49 | klein testen (cel klein) |
| Voorraadscherm | 45 | 3 | 6,7% | €2.042 | €136 | €48 | €68 | €49 | geen eigen campagne, alleen via PMax |
| Markiezen | 24 | 2 | 8,3% | €775 | €65 | **€23** | €33 | €80 | UIT nov-jan, aan in feb |
| Pergola | 126 | 1 | 0,8% | €5.416 | €43 | **€15** | €22 | €79 | UIT okt t/m half jan |
| **Google totaal** | 1.121 | 152 | 13,6% | €1.397 | €189 | **€66** | €95 | €66 (jan-feb) | |

Vertaling naar Google Ads zelf: Google telt ~1,33× meer eigen conversies dan de sheet offertes (factor 0,75, gemeten mei-jul 2026). Doel-CPA in Google Ads = plafond × 0,75: rolluiken €48, screens €70, PMax €70, knikarm €63, totaal ≈ €50.

### Meta (beide winters, 2.147 offertes, 7,8%)

Meta-leads en sheet-offertes lopen 1-op-1 (winter 25/26: 1.437 Meta-leads tegenover 1.441 sheet-offertes met afkomst Facebook/Instagram). De plafonds gelden dus direct als kosten per lead in Ads Manager.

| categorie | off | akk | conv | marge/akk | break-even/off | **plafond** | stop | gerealiseerd 25/26 | netto 25/26 | advies |
|---|---|---|---|---|---|---|---|---|---|---|
| Rolluiken | 1.210 | 111 | 9,2% | €1.209 | €111 | **€39** | €56 | **€78** (€70/Meta-lead) | +€6.673 op €54.117 | AAN, maar plafond €40-45; boven €56 budget omlaag; dec minimum (conv 6,4%) |
| Pergola | 389 | 9 | 2,3% | €2.574 | €60 | **€21** | €30 | €23 (€26/Meta-lead) | **+€14.127** op €9.039 | AAN, alleen zolang ≤ €25/lead (correctie op advies 04-09) |
| Knikarmscherm | 110 | 14 | 12,7% | €1.576 | €201 | **€70** | €100 | geen eigen campagne | | AAN vanaf 2e week jan (vroegboek-set klaar); jan-feb 14/73 = 19% |
| Raamdecoratie ("Gordijnen") | 68 | 10 | 14,7% | €1.343 | €197 | **€69** | €99 | **€166** (€106/Meta-lead) | +€2.075 op €6.133 | ombouwen naar showroom-CTA, plafond €70, anders uit |
| Screens | 200 | 10 | 5,0% | €1.729 | €86 | **€30** | €43 | **€54** (€63/Meta-lead) | +€4.228 op €8.211 | klein houden, boven €30 uit; screens horen bij Google |
| Zonwering algemeen | 89 | 7 | 7,9% | €1.341 | €105 | €37 | €53 | generiek €9.646 (retargeting + "Zonwering") | | retargeting houden ~€1.500/mnd |
| Voorraadscherm | 45 | 3 | 6,7% | €1.213 | €81 | €28 | €41 | | | UIT (20%-actie via Sunny/mail) |
| Markiezen | 11 | 2 | 18,2% | | | | | | | te klein om te sturen; niet adverteren |
| **Meta totaal** | 2.147 | 168 | 7,8% | €1.378 | €108 | **€38** | €54 | €60 | +€47.106 op €87.146 | |

Als de generieke Meta-spend (€9.646) naar offerte-aandeel over de categorieën wordt verdeeld, blijft pergola +€11.500 en rolluiken +€2.000. De conclusie verandert niet: Meta-rolluiken was vorige winter twee keer te duur, Meta-pergola was goedkoop en positief.

**Waarom dit afwijkt van 04-09 (§8: Meta-pergola sep-feb −€2.078).** Die berekening verdeelde de totale Meta-spend naar offerte-aandeel (pergola 28% van de offertes → €30k). Hier is de spend per campagne gebruikt (Meta API): de pergola-campagne kostte sep-feb €10.833 en leverde 420 Meta-leads, tegenover 503 pergola-offertes in de sheet. De campagne-toewijzing klopt met de leadaantallen (rolluiken-campagne 964 leads ↔ 846 sheet-offertes) en is dus de juiste. Correctie van het eerdere advies: Meta-pergola in de winter aan laten, met plafond.

### Per maand, conversie (akkoord/offertes, beide winters)

| categorie | okt | nov | dec | jan | feb |
|---|---|---|---|---|---|
| Google rolluiken | 10/67 15% | 16/72 22% | 6/73 8% | 20/119 17% | 13/137 9% |
| Google screens | 4/22 18% | 3/17 18% | 3/24 13% | 6/38 16% | 5/55 9% |
| Google knikarm | 2/16 13% | 5/14 36% | 2/20 10% | 1/38 3% | 13/60 22% |
| Google pergola | 0/25 | 0/21 | 0/20 | 1/23 | 0/37 |
| Meta rolluiken | 11/103 11% | 21/191 11% | 14/220 6% | 37/346 11% | 28/350 8% |
| Meta pergola | 2/70 3% | 1/76 1% | 0/41 | 3/100 3% | 3/102 3% |
| Meta knikarm | 0/6 | 0/21 | 0/10 | 6/28 21% | 8/45 18% |
| Meta raamdeco | 0/8 | 3/12 25% | 0/8 | 3/17 18% | 4/23 17% |

December is overal de zwakste maand. Knikarm doet vóór januari niets. Pergola-Meta-orders komen in alle maanden behalve december.

## 4. Per maand: max CPA en budget (bijgewerkt 14-09 middag na "heb je goed gekeken?" en "verlies minimaliseren, personeel aan het werk houden")

### 4a. Twee correcties op de eerste versie

1. **Showroom zat in de cijfers.** Kolom kanaal = Winkel: showroomklanten die "Google" of "Instagram" als afkomst opgeven converteren 49-63% en trokken de plafonds omhoog. Online-only is de conversie Google 11% (marge per offerte €142 i.p.v. €189) en Meta 6% (€81 i.p.v. €108). Ads brengen wél mensen naar de showroom (afkomst winkelklanten: Google 102, Instagram 94), dus die orders helemaal wegstrepen klopt ook niet. Daarom per categorie per maand drie getallen: **doel** (hierop bieden), **plafond** (tot hier aantoonbaar goed) en **stop** (daarboven uit).
2. **Het doel is niet winst per lead maar verlies minimaliseren en het team aan het werk houden** (Daimy 14-09). De vaste lasten (€64-92k per wintermaand) zijn er hoe dan ook; elke offerte die minder kost dan zijn productmarge verkleint het verlies. Dat vraagt een ruimere regel dan 35%.

### 4b. Teambezetting: waar het werk ontbreekt

| maand | orders (alle kanalen) | offertes | lasten | lasten/order | bezetting t.o.v. ~150 orders/mnd (35/week) |
|---|---|---|---|---|---|
| sep 25 | 81 | 661 | €95.000 | €1.173 | 54% |
| okt 25 | 48 | 390 | €91.900 | €1.915 | 32% |
| nov 25 | 48 | 375 | €83.899 | €1.748 | 32% |
| dec 25 | 36 | 377 | €64.000 | €1.778 | 24% |
| jan 26 | 69 | 646 | €82.500 | €1.196 | 46% |
| feb 26 | 84 | 795 | €86.749 | €1.033 | 56% |
| mrt 26 | 185 | 1.499 | €106.096 | €573 | 123% |
| apr 26 | 150 | 1.592 | €108.214 | €721 | 100% |

Okt-dec draait het team op een kwart tot een derde van de zomercapaciteit, terwijl de lasten per maand vrijwel gelijk blijven. Dat is het verlies. Levertijd is 8-10 weken (kennisbank): **orders uit okt-nov worden in dec-jan gemonteerd, de leegste maanden; orders uit jan-feb landen in mrt-apr, als het team al op 100-123% zit.** Extra ads in jan-feb houden dus niemand aan het werk in de winter, ze verzwaren het voorjaar.

### 4c. De regel per maand

- **Okt, nov, dec: regel B (verlies minimaliseren).** Doel = 50%, plafond = 70%, stop = 100% van de productmarge per online-offerte (showroomorders zijn upside, niet ingerekend). Boven het plafond blijft een offerte bijdragen, maar steeds minder; boven stop kost hij geld.
- **Jan, feb: regel A (winst per lead).** Doel = 35% online, plafond = 35% incl. showroom, stop = 50% incl. showroom. Montage van deze orders valt in het volle voorjaar.
- Maandverschil via één index per kanaal (marge per online-offerte in die maand t.o.v. het wintergemiddelde, beide winters, begrensd 0,6-1,3; Google okt 1,15 · nov 1,30 · dec 0,60 · jan 1,16 · feb 0,82; Meta 0,89 · 0,89 · 0,60 · 1,30 · 1,03). Losse maandcellen per categorie (5-70 offertes) zijn te klein voor een eigen conversie.
- Budget = verwachte offertes (volume 25/26 × groeifactor: okt-dec Google rolluiken/screens ×1,5, Meta-rolluiken ×1,0; jan-feb Google ×1,3, Meta-rolluiken ×0,8-0,9) × doel tot × plafond. Scripts: scratchpad winter-maand.js, winter-maand2.js (A), winter-maand2b.js (B), fragC.js.

**Google: doel / plafond / stop per sheet-offerte** (okt-dec regel B, jan-feb regel A)

| categorie | BE online / incl. winkel | okt | nov | dec | jan | feb |
|---|---|---|---|---|---|---|
| Rolluiken | €154 / €184 | 90 / 125 / 175 | 100 / 140 / 200 | 45 / 65 / 95 | 60 / 75 / 105 | 45 / 55 / 75 |
| Screens | €154 / €271 | 90 / 125 / 175 | 100 / 140 / 200 | 45 / 65 / 90 | 60 / 110 / 155 | 45 / 75 / 110 |
| Zonwering buiten | €267 / €275 | 155 / 215 / 305 | 175 / 245 / 350 | uit: 80 / 110 / 160 | 110 / 110 / 160 | 75 / 80 / 110 |
| Knikarmscherm | €130 / €241 | 75 / 105 / 150 | 85 / 120 / 170 | 40 / 55 / 80 | 55 / 95 / 140 | 35 / 70 / 100 |
| Uitvalscherm | €225 / €225 | 130 / 180 / 260 | 145 / 205 / 295 | uit: 70 / 95 / 135 | 90 / 90 / 130 | 65 / 65 / 90 |
| Raamdecoratie | €150 / €228 | 85 / 120 / 170 | 100 / 135 / 195 | 45 / 65 / 90 | 60 / 90 / 130 | 45 / 65 / 95 |
| Voorraadscherm | €136 / €136 | 80 / 110 / 155 | 90 / 125 / 175 | 40 / 55 / 80 | 55 / 55 / 80 | 40 / 40 / 55 |
| Markiezen | €20 / €65 | 10 / 15 / 25 | 15 / 20 / 25 | 5 / 10 / 10 | uit: 10 / 25 / 35 | 5 / 20 / 25 |
| Pergola | €44 / €43 | uit: 25 / 35 / 50 | uit: 30 / 40 / 55 | uit: 15 / 20 / 25 | 20 / 15 / 25 | 10 / 10 / 20 |

**Google: budget per maand** (verwachte offertes × doel tot × plafond)

| categorie | okt | nov | dec | jan | feb | winter |
|---|---|---|---|---|---|---|
| Rolluiken | 93 off · €8.370-€11.625 | 84 off · €8.400-€11.760 | 83 off · €3.735-€5.395 | 112 off · €6.720-€8.400 | 122 off · €5.490-€6.710 | €32.715-€43.890 |
| Screens | 29 off · €2.610-€3.625 | 21 off · €2.100-€2.940 | 35 off · €1.575-€2.275 | 44 off · €2.640-€4.840 | 62 off · €2.790-€4.650 | €11.715-€18.330 |
| Zonwering buiten | 7 off · €1.085-€1.505 | 1 off · €175-€245 | uit | 5 off · €550-€550 | 3 off · €225-€240 | €2.035-€2.540 |
| Knikarmscherm | 10 off · €750-€1.050 | 7 off · €595-€840 | 11 off · €440-€605 | 36 off · €1.980-€3.420 | 60 off · €2.100-€4.200 | €5.865-€10.115 |
| Uitvalscherm | 3 off · €390-€540 | 2 off · €290-€410 | uit | 6 off · €540-€540 | 10 off · €650-€650 | €1.870-€2.140 |
| Raamdecoratie | 11 off · €935-€1.320 | 5 off · €500-€675 | 11 off · €495-€715 | 5 off · €300-€450 | 5 off · €225-€325 | €2.455-€3.485 |
| Voorraadscherm | 4 off · €320-€440 | 1 off · €90-€125 | 2 off · €80-€110 | 16 off · €880-€880 | 22 off · €880-€880 | €2.250-€2.435 |
| Markiezen | 1 off · €10-€15 | 2 off · €30-€40 | 2 off · €10-€20 | uit | 11 off · €55-€220 | €105-€295 |
| Pergola | uit | uit | uit | 12 off · €240-€180 | 37 off · €370-€370 | €610-€550 |
| vast (branding / remarketing) | €300 | €300 | €300 | €300 | €300 | €1.500 |
| **totaal Google** | **158 off · €14.770-€20.420** | **123 off · €12.480-€17.335** | **144 off · €6.635-€9.420** | **236 off · €14.150-€19.560** | **332 off · €13.085-€18.545** | **€61.120-€85.280** |

**Meta: doel / plafond / stop per sheet-offerte** (okt-dec regel B, jan-feb regel A)

| categorie | BE online / incl. winkel | okt | nov | dec | jan | feb |
|---|---|---|---|---|---|---|
| Rolluiken | €87 / €111 | 40 / 55 / 75 | 40 / 55 / 80 | 25 / 35 / 50 | 40 / 50 / 70 | 30 / 40 / 55 |
| Pergola | €31 / €60 | 15 / 20 / 25 | 15 / 20 / 25 | 10 / 15 / 20 | 15 / 25 / 40 | 10 / 20 / 30 |
| Knikarmscherm | €125 / €201 | 55 / 80 / 110 | 55 / 80 / 110 | 35 / 50 / 75 | 55 / 90 / 130 | 45 / 70 / 105 |
| Raamdecoratie | €192 / €197 | 85 / 120 / 170 | 85 / 120 / 170 | 60 / 80 / 115 | 85 / 90 / 130 | 70 / 70 / 100 |
| Screens | €89 / €86 | 40 / 55 / 80 | 40 / 55 / 80 | 25 / 35 / 55 | 40 / 40 / 55 | 30 / 30 / 45 |

**Meta: budget per maand** (verwachte offertes × doel tot × plafond)

| categorie | okt | nov | dec | jan | feb | winter |
|---|---|---|---|---|---|---|
| Rolluiken | 99 off · €3.960-€5.445 | 104 off · €4.160-€5.720 | 78 off · €1.950-€2.730 | 154 off · €6.160-€7.700 | 172 off · €5.160-€6.880 | €21.390-€28.475 |
| Pergola | 70 off · €1.050-€1.400 | 76 off · €1.140-€1.520 | 41 off · €410-€615 | 100 off · €1.500-€2.500 | 102 off · €1.020-€2.040 | €5.120-€8.075 |
| Knikarmscherm | 2 off · €110-€160 | 3 off · €165-€240 | 3 off · €105-€150 | 24 off · €1.320-€2.160 | 50 off · €2.250-€3.500 | €3.950-€6.210 |
| Raamdecoratie | 3 off · €255-€360 | 11 off · €935-€1.320 | 3 off · €180-€240 | 13 off · €1.105-€1.170 | 13 off · €910-€910 | €3.385-€4.000 |
| Screens | 20 off · €800-€1.100 | 23 off · €920-€1.265 | 23 off · €575-€805 | 20 off · €800-€800 | 31 off · €930-€930 | €4.025-€4.900 |
| vast (retargeting) | €1.500 | €1.500 | €1.500 | €1.500 | €1.500 | €7.500 |
| **totaal Meta** | **194 off · €7.675-€9.965** | **217 off · €8.820-€11.565** | **148 off · €4.720-€6.040** | **311 off · €12.385-€15.830** | **368 off · €11.770-€15.760** | **€45.370-€59.160** |

**Samen per maand**

| maand | regel | Google | Meta | totaal basis | totaal max | vorige winter | teambezetting 25/26 |
|---|---|---|---|---|---|---|---|
| okt | B verlies minimaliseren | €14.770-€20.420 | €7.675-€9.965 | €22.445 | €30.385 | Meta €14.651 + Google ? | 32% (48 orders) |
| nov | B verlies minimaliseren | €12.480-€17.335 | €8.820-€11.565 | €21.300 | €28.900 | Meta €14.562 + Google ? | 32% (48) |
| dec | B verlies minimaliseren | €6.635-€9.420 | €4.720-€6.040 | €11.355 | €15.460 | Meta €17.315 + Google ? | 24% (36) |
| jan | A winst per lead | €14.150-€19.560 | €12.385-€15.830 | €26.535 | €35.390 | Meta €19.284 + Google €15.044 | 46% (69) |
| feb | A winst per lead | €13.085-€18.545 | €11.770-€15.760 | €24.855 | €34.305 | Meta €21.334 + Google €17.862 | 56% (84) |
| **winter** | | | | **€106.490** | **€144.440** | Meta €87.146 + Google ≥€32.905 | 285 orders, €409k lasten |

**Lezen.**
- Totaal okt-feb €106k (bij doel) tot €144k (bij plafond); vorige winter ≈ €160-170k. Het geld verschuift naar okt-nov (nu €22-30k/mnd tegen ≈ €28k vorig jaar, maar met Google-rolluiken/screens erbij i.p.v. Meta-rolluiken op €78) en weg uit jan-feb.
- Regel B in okt-nov betekent: Google-rolluiken mag tot €125-140 per offerte kosten en Meta-rolluiken tot €70. Vorige winter zat Meta-rolluiken op €78, dus in okt-nov is dat bijna goed, in december (plafond €45) niet.
- Google Ads-doel-CPA in het platform zelf = doel × 0,75.
- Budget is een gevolg, geen doel: op of onder doel mag omhoog tot het volume opdroogt; twee weken boven plafond → −30%; boven stop → uit. Beoordelen op kosten per sheet-offerte per week, op akkoorden pas na 4 weken.
- Ads zijn niet het enige middel voor bezetting: het winteronderzoek van 16-08 wees op de berg verkocht-nog-niet-geplaatst werk en de teken-nu-campagne (prijs vast, inmeten later). Die vullen dec-jan zonder advertentiekosten en horen naast dit plan.

## 5. Sturing per week

- `node scripts/campagne-rendement.js` levert per campagne kosten per sheet-offerte; die tegen de plafonds uit §3 leggen (weekrapport-regel toevoegen zodra Daimy akkoord is).
- Meta: per campagne in Ads Manager CPL = sheet-CPL, dus plafond direct instelbaar als kostenlimiet per resultaat.
- Google: doel-CPA = plafond × 0,75. Zodra de Google Ads API werkt (docs/google-ads-api-setup.md) meten we de factor per campagne in plaats van één getal.
- Mediaan offerte → akkoord is 24 dagen: een campagne pas na 4 weken op akkoorden beoordelen, eerder alleen op kosten per offerte.

## 6. Kanttekeningen (eerlijk)

1. **Vaste lasten.** Winter 25/26: lasten €409k (okt-feb) over 285 orders = €1.435 per order, vrijwel gelijk aan de productmarge per order (€1.485). Op volle kostprijs houdt een winterorder dus bijna niets over, en met advertentiekosten erbij is het verlies; dat is het bekende winterprobleem (rapport 16-08). De lasten zijn er hoe dan ook (monteurs in dienst), dus advertenties worden hier beoordeeld op bijdrage aan de vaste lasten: elke offerte die minder kost dan 35% van zijn productmarge draagt bij.
2. **Google okt-dec 2025 spend ontbreekt** (V1). Google-marge in die maanden was €67.800; bij het jan-feb-niveau (€15k/mnd) was dat ruim positief.
3. Afkomst = wat de klant zelf zegt. Google's eigen conversies wijken af (factor 0,75, alleen gemeten op search mei-jul 2026). Meta klopt 1-op-1.
4. Cellen onder ~40 offertes (markiezen, uitvalscherm, raamdecoratie, voorraadscherm) zijn richting, geen meetwaarde.
5. Meta-pergola: 9 orders in een winter; één order minder en het is +€11k in plaats van +€14k. Het plafond van €21-25 per lead is dus hard.
6. Seizoen 24/25 had hogere conversie dan 25/26 (Google 24% tegen 11%, Meta 11% tegen 6%). De plafonds staan op beide seizoenen samen; wie voorzichtig wil zijn rekent met 25/26 alleen: Google €58, Meta €33.

## 7. Open vragen aan Daimy

- V1: Google-spend okt, nov, dec 2025 (drie bedragen uit Google Ads) in data/ad-spend-handmatig.json. Dan is de hele winter 25/26 netto rond.
- V2: akkoord op het budgetkader (Google €73k + Meta €66k okt-feb) en op de afwijking van 04-09: Meta-pergola AAN met plafond €25 per lead (was: uit)?
