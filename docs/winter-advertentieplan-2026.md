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
- **Max CPA (per offerte in de sheet), per maand in §4, regel B (doel 50% / plafond 70% / stop 100% van de marge per online-offerte).** Google rolluiken: okt-nov €90-100 / €125-140 / €175-200, dec €45 / €65 / €95, jan €90 / €125 / €180, feb €65 / €90 / €125. Meta rolluiken: okt-nov €40 / €70 / €100, dec €25 / €45 / €65, jan €55 / €80 / €115, feb €45 / €60 / €90. Kanaalbreed (alle categorieën, §5): Google plafond okt €115 · nov €155 · dec €45 · jan €115 · feb €80 · mrt €95 · apr €95 · mei €100; Meta €50 · €50 · €35 · €75 · €60 · €80 · €50 · €55.
- **Budget okt-feb:** €129k (bij doel) tot €177k (bij plafond): okt €22-30k, nov €21-29k, dec €11-15k, jan €38-54k, feb €36-49k (§4). Vorige winter ≈ €160-170k, anders verdeeld: okt-nov omhoog (die orders houden het team in dec-jan aan het werk), Meta okt-dec op plafond, december laag.
- **Doorrekening tot mei 2027 (§5):** advies okt-mei Google €175k + Meta €154k (was €166k + €166k). Conservatief (zelfde conversie en leadprijs als 25/26) +€38k resultaat: €84k → €122k. Als de plafonds gehaald worden +€72k (€156k). De grote hefboom is de lente: mrt-mei levert €228k en Meta-leads kosten daar €27-29 bij een break-even van €70-76; meer winst daar vraagt montagecapaciteit (mrt 123%, apr 100%).

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

### 4c. De regel per maand (bijgewerkt na de doorrekening tot mei)

- **Regel B in alle wintermaanden:** doel = 50%, plafond = 70%, stop = 100% van de productmarge per online-offerte (showroomorders zijn upside, niet ingerekend). In de eerste versie stond jan-feb op regel A (35%); de doorrekening in §5 laat zien dat dat winst kost: Meta jan-feb draaide vorig jaar +€9k/+€17k netto op €51-54 per lead en zou onder regel A worden afgeknepen. Onder regel B blijft alles wat bijdraagt aan de vaste lasten lopen.
- **Okt-nov zijn de maanden die het team in dec-jan aan het werk houden** (levertijd 8-10 weken). Jan-feb-orders landen in mrt-apr (100-123%): daar geen groei forceren (groeifactor 1,1 i.p.v. 1,5).
- Maandverschil via één index per kanaal (marge per online-offerte in die maand t.o.v. het wintergemiddelde, beide winters, begrensd 0,6-1,3; Google okt 1,15 · nov 1,30 · dec 0,60 · jan 1,16 · feb 0,82; Meta 0,89 · 0,89 · 0,60 · 1,30 · 1,03). Losse maandcellen per categorie (5-70 offertes) zijn te klein voor een eigen conversie.
- Budget = verwachte offertes (volume 25/26 × groeifactor: okt-dec Google rolluiken/screens/raamdeco ×1,5, Meta-rolluiken ×1,0 en dec ×0,7; jan-feb ×1,1, Meta knikarm ×1,5) × doel tot × plafond. Scripts: scratchpad winter-maand.js, winter-maand2b.js (B), fragD.js.

**Google: doel / plafond / stop per sheet-offerte** (regel B alle maanden)

| categorie | BE online / incl. winkel | okt | nov | dec | jan | feb |
|---|---|---|---|---|---|---|
| Rolluiken | €154 / €184 | 90 / 125 / 175 | 100 / 140 / 200 | 45 / 65 / 95 | 90 / 125 / 180 | 65 / 90 / 125 |
| Screens | €154 / €271 | 90 / 125 / 175 | 100 / 140 / 200 | 45 / 65 / 90 | 90 / 125 / 175 | 65 / 90 / 125 |
| Zonwering buiten | €267 / €275 | 155 / 215 / 305 | 175 / 245 / 350 | uit: 80 / 110 / 160 | 155 / 215 / 310 | 110 / 155 / 220 |
| Knikarmscherm | €130 / €241 | 75 / 105 / 150 | 85 / 120 / 170 | 40 / 55 / 80 | 75 / 105 / 150 | 55 / 75 / 105 |
| Uitvalscherm | €225 / €225 | 130 / 180 / 260 | 145 / 205 / 295 | uit: 70 / 95 / 135 | 130 / 180 / 260 | 90 / 130 / 185 |
| Raamdecoratie | €150 / €228 | 85 / 120 / 170 | 100 / 135 / 195 | 45 / 65 / 90 | 85 / 120 / 175 | 60 / 85 / 125 |
| Voorraadscherm | €136 / €136 | 80 / 110 / 155 | 90 / 125 / 175 | 40 / 55 / 80 | 80 / 110 / 155 | 55 / 80 / 110 |
| Markiezen | €20 / €65 | 10 / 15 / 25 | 15 / 20 / 25 | 5 / 10 / 10 | 10 / 15 / 25 | 10 / 10 / 15 |
| Pergola | €44 / €43 | uit: 25 / 35 / 50 | uit: 30 / 40 / 55 | uit: 15 / 20 / 25 | 25 / 35 / 50 | 20 / 25 / 35 |

**Google: budget per maand** (verwachte offertes × doel tot × plafond)

| categorie | okt | nov | dec | jan | feb | winter |
|---|---|---|---|---|---|---|
| Rolluiken | 93 off · €8.370-€11.625 | 84 off · €8.400-€11.760 | 83 off · €3.735-€5.395 | 95 off · €8.550-€11.875 | 103 off · €6.695-€9.270 | €35.750-€49.925 |
| Screens | 29 off · €2.610-€3.625 | 21 off · €2.100-€2.940 | 35 off · €1.575-€2.275 | 37 off · €3.330-€4.625 | 53 off · €3.445-€4.770 | €13.060-€18.235 |
| Zonwering buiten | 7 off · €1.085-€1.505 | 1 off · €175-€245 | uit | 6 off · €930-€1.290 | 3 off · €330-€465 | €2.520-€3.505 |
| Knikarmscherm | 10 off · €750-€1.050 | 7 off · €595-€840 | 11 off · €440-€605 | 40 off · €3.000-€4.200 | 60 off · €3.300-€4.500 | €8.085-€11.195 |
| Uitvalscherm | 3 off · €390-€540 | 2 off · €290-€410 | uit | 6 off · €780-€1.080 | 10 off · €900-€1.300 | €2.360-€3.330 |
| Raamdecoratie | 11 off · €935-€1.320 | 5 off · €500-€675 | 11 off · €495-€715 | 6 off · €510-€720 | 6 off · €360-€510 | €2.800-€3.940 |
| Voorraadscherm | 4 off · €320-€440 | 1 off · €90-€125 | 2 off · €80-€110 | 16 off · €1.280-€1.760 | 22 off · €1.210-€1.760 | €2.980-€4.195 |
| Markiezen | 1 off · €10-€15 | 2 off · €30-€40 | 2 off · €10-€20 | 3 off · €30-€45 | 11 off · €110-€110 | €190-€230 |
| Pergola | uit | uit | uit | 12 off · €300-€420 | 37 off · €740-€925 | €1.040-€1.345 |
| vast (branding / remarketing) | €300 | €300 | €300 | €300 | €300 | €1.500 |
| **totaal Google** | **158 off · €14.770-€20.420** | **123 off · €12.480-€17.335** | **144 off · €6.635-€9.420** | **221 off · €19.010-€26.315** | **305 off · €17.390-€23.910** | **€70.285-€97.400** |

**Meta: doel / plafond / stop per sheet-offerte** (regel B alle maanden)

| categorie | BE online / incl. winkel | okt | nov | dec | jan | feb |
|---|---|---|---|---|---|---|
| Rolluiken | €87 / €111 | 40 / 55 / 75 | 40 / 55 / 80 | 25 / 35 / 50 | 55 / 80 / 115 | 45 / 65 / 90 |
| Pergola | €31 / €60 | 15 / 20 / 25 | 15 / 20 / 25 | 10 / 15 / 20 | 20 / 30 / 40 | 15 / 20 / 30 |
| Knikarmscherm | €125 / €201 | 55 / 80 / 110 | 55 / 80 / 110 | 35 / 50 / 75 | 80 / 115 / 160 | 65 / 90 / 130 |
| Raamdecoratie | €192 / €197 | 85 / 120 / 170 | 85 / 120 / 170 | 60 / 80 / 115 | 125 / 175 / 250 | 100 / 140 / 200 |
| Screens | €89 / €86 | 40 / 55 / 80 | 40 / 55 / 80 | 25 / 35 / 55 | 60 / 80 / 115 | 45 / 65 / 90 |

**Meta: budget per maand** (verwachte offertes × doel tot × plafond)

| categorie | okt | nov | dec | jan | feb | winter |
|---|---|---|---|---|---|---|
| Rolluiken | 99 off · €3.960-€5.445 | 104 off · €4.160-€5.720 | 78 off · €1.950-€2.730 | 193 off · €10.615-€15.440 | 191 off · €8.595-€12.415 | €29.280-€41.750 |
| Pergola | 70 off · €1.050-€1.400 | 76 off · €1.140-€1.520 | 41 off · €410-€615 | 100 off · €2.000-€3.000 | 102 off · €1.530-€2.040 | €6.130-€8.575 |
| Knikarmscherm | 2 off · €110-€160 | 3 off · €165-€240 | 3 off · €105-€150 | 24 off · €1.920-€2.760 | 50 off · €3.250-€4.500 | €5.550-€7.810 |
| Raamdecoratie | 3 off · €255-€360 | 11 off · €935-€1.320 | 3 off · €180-€240 | 14 off · €1.750-€2.450 | 14 off · €1.400-€1.960 | €4.520-€6.330 |
| Screens | 20 off · €800-€1.100 | 23 off · €920-€1.265 | 23 off · €575-€805 | 27 off · €1.620-€2.160 | 41 off · €1.845-€2.665 | €5.760-€7.995 |
| vast (retargeting) | €1.500 | €1.500 | €1.500 | €1.500 | €1.500 | €7.500 |
| **totaal Meta** | **194 off · €7.675-€9.965** | **217 off · €8.820-€11.565** | **148 off · €4.720-€6.040** | **358 off · €19.405-€27.310** | **398 off · €18.120-€25.080** | **€58.740-€79.960** |

**Samen per maand**

| maand | regel | Google | Meta | totaal basis | totaal max | vorige winter | teambezetting 25/26 |
|---|---|---|---|---|---|---|---|
| okt | B (bezetting dec-jan) | €14.770-€20.420 | €7.675-€9.965 | €22.445 | €30.385 | Meta €14.651 + Google ? | 32% (48 orders) |
| nov | B (bezetting dec-jan) | €12.480-€17.335 | €8.820-€11.565 | €21.300 | €28.900 | Meta €14.562 + Google ? | 32% (48) |
| dec | B (bezetting dec-jan) | €6.635-€9.420 | €4.720-€6.040 | €11.355 | €15.460 | Meta €17.315 + Google ? | 24% (36) |
| jan | B (winst; montage mrt-apr) | €19.010-€26.315 | €19.405-€27.310 | €38.415 | €53.625 | Meta €19.284 + Google €15.044 | 46% (69) |
| feb | B (winst; montage mrt-apr) | €17.390-€23.910 | €18.120-€25.080 | €35.510 | €48.990 | Meta €21.334 + Google €17.862 | 56% (84) |
| **winter** | | | | **€129.025** | **€177.360** | Meta €87.146 + Google ≥€32.905 | 285 orders, €409k lasten |

**Lezen.**
- Totaal okt-feb €129k (bij doel) tot €177k (bij plafond); vorige winter ≈ €160-170k, maar anders verdeeld: Google-rolluiken/screens in okt-nov omhoog, Meta-rolluiken in okt-dec op een plafond van €70/€45 (was €74-88), Meta-pergola alleen ≤ €35, december overal laag.
- Google Ads-doel-CPA in het platform zelf = doel × 0,75.
- Budget is een gevolg, geen doel: op of onder doel mag omhoog tot het volume opdroogt; twee weken boven plafond → −30%; boven stop → uit. Beoordelen op kosten per sheet-offerte per week, op akkoorden pas na 4 weken.
- Ads zijn niet het enige middel voor bezetting: de teken-nu-campagne en het verkocht-nog-niet-geplaatst werk (rapport 16-08) vullen dec-jan zonder advertentiekosten.

## 5. Doorrekening okt 2026 t/m mei 2027, per maand per kanaal (Daimy 14-09: "doel volgend jaar meer winst")

Model (scratchpad jaar-stats.js + forecast.js): per maand per kanaal budget × leadprijs → offertes × online-conversie → orders × marge per akkoord. Overige kanalen (winkel, buren, anders, showroom-via-ads) en de maandlasten staan op het niveau van 25/26. Resultaat = productmarge alle kanalen − advertenties − lasten (ex btw, vóór belasting; geen andere opbrengsten). Google-spend okt-dec 2025 is aangenomen op €13.000/mnd (V1 open). Mei 2026 is 4 maanden oud; mediaan offerte→akkoord 24 dagen, dus bruikbaar.

**Werkelijk 25/26 (okt-mei): resultaat €83.673.** Okt-dec −€134k, jan-feb −€11k, mrt-mei +€228k. De winter kost dus ongeveer wat de lente oplevert; het jaar blijft net positief.

**Budgetadvies 26/27 (Google / Meta):** okt €17,5k / €9k · nov €15k / €10k · dec €8k / €5,5k · jan €17k / €19k · feb €18k / €21k · mrt €26k / €29k · apr €34k / €29k · mei €40k / €31k. Totaal €329k (was €332k), verschoven van Meta okt-dec (−€22k) naar Google okt-nov en Meta/Google apr-mei.

**Scenario 1 (conservatief): conversie én leadprijs gelijk aan 25/26, alleen het budget verschuift**

| maand | Google budget → offertes / orders / netto | Meta budget → offertes / orders / netto | overig orders / marge | orders totaal (bezetting) | lasten | resultaat plan | resultaat 25/26 | verschil |
|---|---|---|---|---|---|---|---|---|
| okt | €17.500 (was €13.000?) → 183 / 16 / +€1.737 (was +€1.290) | €9.000 (was €14.651) → 122 / 7 / €-2.261 (was €-3.680) | 25 / €43.972 | 48 (32%) | €91.900 | **€-48.451** | €-50.318 | +€1.867 |
| nov | €15.000 (was €13.000?) → 125 / 15 / +€10.432 (was +€9.041) | €10.000 (was €14.562) → 148 / 6 / €-4.704 (was €-6.851) | 27 / €44.058 | 47 (31%) | €83.899 | **€-34.113** | €-37.650 | +€3.537 |
| dec | €8.000 (was €13.000?) → 75 / 5 / €-2.521 (was €-4.096) | €5.500 (was €17.315) → 62 / 2 / €-2.831 (was €-8.914) | 22 / €30.960 | 29 (19%) | €64.000 | **€-38.392** | €-46.050 | +€7.658 |
| jan | €17.000 (was €15.044) → 236 / 25 / +€21.951 (was +€19.425) | €19.000 (was €19.284) → 355 / 16 / +€9.336 (was +€9.476) | 31 / €36.845 | 72 (48%) | €82.500 | **€-14.367** | €-16.754 | +€2.387 |
| feb | €18.000 (was €17.862) → 271 / 16 / +€5.677 (was +€5.633) | €21.000 (was €21.334) → 408 / 25 / +€17.189 (was +€17.463) | 43 / €69.600 | 84 (56%) | €86.749 | **+€5.717** | +€5.947 | €-230 |
| mrt | €26.000 (was €26.258) → 512 / 48 / +€38.536 (was +€38.918) | €29.000 (was €29.020) → 761 / 57 / +€41.164 (was +€41.192) | 80 / €134.747 | 184 (123%) | €106.096 | **+€108.351** | +€108.761 | €-410 |
| apr | €34.000 (was €31.543) → 597 / 36 / +€23.584 (was +€21.880) | €29.000 (was €24.026) → 997 / 56 / +€39.564 (was +€32.778) | 71 / €102.864 | 162 (108%) | €108.214 | **+€57.798** | +€49.308 | +€8.490 |
| mei | €40.000 (was €36.767) → 708 / 42 / +€32.588 (was +€29.954) | €31.000 (was €25.419) → 1132 / 52 / +€66.224 (was +€54.302) | 52 / €93.421 | 147 (98%) | €107.248 | **+€84.986** | +€70.429 | +€14.557 |
| **okt-mei** | **€175.500** (was €166.474) → marge €307.484 | **€153.500** (was €165.611) → marge €317.181 | | 773 (was 754) | | **+€121.527** | +€83.673 | **+€37.854** |

**Scenario 2: conversie 25/26, leads op het plafond waar ze vorig jaar duurder waren**

| maand | Google budget → offertes / orders / netto | Meta budget → offertes / orders / netto | overig orders / marge | orders totaal (bezetting) | lasten | resultaat plan | resultaat 25/26 | verschil |
|---|---|---|---|---|---|---|---|---|
| okt | €17.500 (was €13.000?) → 238 / 21 / +€7.500 (was +€1.290) | €9.000 (was €14.651) → 233 / 13 / +€3.857 (was €-3.680) | 25 / €43.972 | 59 (39%) | €91.900 | **€-36.571** | €-50.318 | +€13.747 |
| nov | €15.000 (was €13.000?) → 125 / 15 / +€10.432 (was +€9.041) | €10.000 (was €14.562) → 398 / 15 / +€4.286 (was €-6.851) | 27 / €44.058 | 57 (38%) | €83.899 | **€-25.123** | €-37.650 | +€12.527 |
| dec | €8.000 (was €13.000?) → 157 / 10 / +€3.429 (was €-4.096) | €5.500 (was €17.315) → 183 / 6 / +€2.357 (was €-8.914) | 22 / €30.960 | 38 (25%) | €64.000 | **€-27.254** | €-46.050 | +€18.796 |
| jan | €17.000 (was €15.044) → 236 / 25 / +€21.951 (was +€19.425) | €19.000 (was €19.284) → 355 / 16 / +€9.336 (was +€9.476) | 31 / €36.845 | 72 (48%) | €82.500 | **€-14.367** | €-16.754 | +€2.387 |
| feb | €18.000 (was €17.862) → 294 / 18 / +€7.714 (was +€5.633) | €21.000 (was €21.334) → 408 / 25 / +€17.189 (was +€17.463) | 43 / €69.600 | 85 (57%) | €86.749 | **+€7.754** | +€5.947 | +€1.807 |
| mrt | €26.000 (was €26.258) → 512 / 48 / +€38.536 (was +€38.918) | €29.000 (was €29.020) → 761 / 57 / +€41.164 (was +€41.192) | 80 / €134.747 | 184 (123%) | €106.096 | **+€108.351** | +€108.761 | €-410 |
| apr | €34.000 (was €31.543) → 597 / 36 / +€23.584 (was +€21.880) | €29.000 (was €24.026) → 997 / 56 / +€39.564 (was +€32.778) | 71 / €102.864 | 162 (108%) | €108.214 | **+€57.798** | +€49.308 | +€8.490 |
| mei | €40.000 (was €36.767) → 708 / 42 / +€32.588 (was +€29.954) | €31.000 (was €25.419) → 1132 / 52 / +€66.224 (was +€54.302) | 52 / €93.421 | 147 (98%) | €107.248 | **+€84.986** | +€70.429 | +€14.557 |
| **okt-mei** | **€175.500** (was €166.474) → marge €321.234 | **€153.500** (was €165.611) → marge €337.477 | | 804 (was 754) | | **+€155.573** | +€83.673 | **+€71.900** |

**CPA per maand per kanaal (per sheet-offerte): vorig jaar werkelijk → plafond regel B (70% van marge per online-offerte)**

| maand | Google werkelijk 25/26 | Google plafond | Meta werkelijk 25/26 | Meta plafond |
|---|---|---|---|---|
| okt | €96? ⚠ | €75 | €74 ⚠ | €40 |
| nov | €120? | €145 | €68 ⚠ | €25 |
| dec | €107? ⚠ | €50 | €88 ⚠ | €30 |
| jan | €72 | €115 | €54 | €55 |
| feb | €66 ⚠ | €60 | €51 | €65 |
| mrt | €51 | €90 | €38 | €65 |
| apr | €57 | €70 | €29 | €50 |
| mei | €56 | €70 | €27 | €60 |

**Lente (mrt-mei, 2025+2026) per categorie**

| categorie | Google off / conv online / BE online | advies lente | Meta off / conv online / BE online | advies lente |
|---|---|---|---|---|
| Rolluiken | 678 / 11,5% / €151 | AAN, plafond €105 | 1.696 / 8,0% / €93 | AAN, plafond €65 (was €27-48: ruimte) |
| Screens | 469 / 10,2% / €200 | AAN, plafond €140, hoogste marge/akkoord | 507 / 6,3% / €103 | AAN, plafond €70 |
| Knikarmscherm | 676 / 10,6% / €143 | AAN, plafond €100 | 846 / 6,7% / €96 | AAN, plafond €65 |
| Zonwering buiten / PMax | 126 / 10,3% / €136 | AAN | 143 / 4,5% / €85 | generiek, retargeting |
| Markiezen | 83 / 12,5% / €98 | AAN (lente is markiezentijd), plafond €70 | 49 / 12,5% / €113 | klein, meenemen |
| Uitvalscherm | 101 / 8,2% / €87 | meeliften knikarm | 53 / 11,8% / €215 | klein |
| Raamdecoratie | 19 / 30% / €373 | klein, showroom-CTA | 42 / 23% / €202 | klein, showroom-CTA |
| Voorraadscherm | 215 / 2,8% / €50 | **geen eigen budget**: 2,8% online, alleen via PMax/20%-actie | 400 / 1,5% / €32 | **UIT** (1,5%) |
| Pergola | 197 / **0,0% online** (4 orders, alle showroom) / €0 | **UIT als eigen campagne**; showroom-route | 408 / 1,0% / €28 | **UIT of ≤ €20/lead** |

**Wat dit zegt.**
1. **Conservatief (scenario 1) levert het plan +€38k** (van €84k naar €122k): −€22k Meta in okt-dec scheelt €14k verlies, en +€13k in apr-mei levert bij dezelfde leadprijs +€23k. Dat is de zekere winst van alleen budget verschuiven.
2. **Scenario 2 (+€72k, naar €156k)** vraagt dat Meta in okt-dec en Google in dec leads koopt onder het plafond. Vorig jaar zat Meta daar op €68-88 per lead bij een break-even van €48-73 online: dat lukt alleen met de nieuwe rolluik-set (kaart-formule €43-50 historisch) en door december bijna uit te zetten. Niet inplannen als zeker.
3. **De grote hefboom zit niet in de winter maar in de lente.** Mrt-mei levert €228k; elke 10% meer orders in apr-mei bij gelijke leadprijs is ruwweg +€25k. De rem is montagecapaciteit: mrt zat op 123%, apr 100% (150 orders/mnd als referentie uit de capaciteitsmonitor; juli 2026 deed 251, dus de echte grens ligt hoger of er is uitgesteld). Wie in de lente meer winst wil, plant capaciteit (extra monteur/ZZP van mrt t/m jun) en zet Meta apr-mei (leads €27-29, break-even €70-76) en Google apr-mei (€56-57 tegen €135-143) hoger. Dat staat niet in de cijfers hierboven; de budgetten daar zijn +8% Google en +20% Meta in apr-mei.
4. **Wat niet meer moet in de lente:** Google-pergola als eigen campagne (0 van 197 online-offertes in twee lentes; de 4 orders kwamen uit de showroom), Meta-pergola boven €20 per lead (1,0% online), voorraadscherm als eigen campagne (Google 2,8%, Meta 1,5%). Dat scheelt ruwweg 800 offertes per lente die Sunny en de inmeters nu verwerken zonder omzet.
5. **Meta-leads apr-mei zijn de goedkoopste van het jaar** (€27-29) met een break-even van €70-76; Google apr-mei €56-57 tegen €135-143. Daar zit de ruimte, niet in de winter.

## 6. Sturing per week

- `node scripts/campagne-rendement.js` levert per campagne kosten per sheet-offerte; die tegen de plafonds uit §3 leggen (weekrapport-regel toevoegen zodra Daimy akkoord is).
- Meta: per campagne in Ads Manager CPL = sheet-CPL, dus plafond direct instelbaar als kostenlimiet per resultaat.
- Google: doel-CPA = plafond × 0,75. Zodra de Google Ads API werkt (docs/google-ads-api-setup.md) meten we de factor per campagne in plaats van één getal.
- Mediaan offerte → akkoord is 24 dagen: een campagne pas na 4 weken op akkoorden beoordelen, eerder alleen op kosten per offerte.

## 7. Kanttekeningen (eerlijk)

1. **Vaste lasten.** Winter 25/26: lasten €409k (okt-feb) over 285 orders = €1.435 per order, vrijwel gelijk aan de productmarge per order (€1.485). Op volle kostprijs houdt een winterorder dus bijna niets over, en met advertentiekosten erbij is het verlies; dat is het bekende winterprobleem (rapport 16-08). De lasten zijn er hoe dan ook (monteurs in dienst), dus advertenties worden hier beoordeeld op bijdrage aan de vaste lasten: elke offerte die minder kost dan 35% van zijn productmarge draagt bij.
2. **Google okt-dec 2025 spend ontbreekt** (V1). Google-marge in die maanden was €67.800; bij het jan-feb-niveau (€15k/mnd) was dat ruim positief.
3. Afkomst = wat de klant zelf zegt. Google's eigen conversies wijken af (factor 0,75, alleen gemeten op search mei-jul 2026). Meta klopt 1-op-1.
4. Cellen onder ~40 offertes (markiezen, uitvalscherm, raamdecoratie, voorraadscherm) zijn richting, geen meetwaarde.
5. Meta-pergola: 9 orders in een winter; één order minder en het is +€11k in plaats van +€14k. Het plafond van €21-25 per lead is dus hard.
6. Seizoen 24/25 had hogere conversie dan 25/26 (Google 24% tegen 11%, Meta 11% tegen 6%). De plafonds staan op beide seizoenen samen; wie voorzichtig wil zijn rekent met 25/26 alleen: Google €58, Meta €33.

## 8. Open vragen aan Daimy

- V1: Google-spend okt, nov, dec 2025 (drie bedragen uit Google Ads) in data/ad-spend-handmatig.json. Dan is de hele winter 25/26 netto rond.
- V2: akkoord op het budgetkader (Google €73k + Meta €66k okt-feb) en op de afwijking van 04-09: Meta-pergola AAN met plafond €25 per lead (was: uit)?
