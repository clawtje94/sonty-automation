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

## 4. Per maand, per kanaal, per productgroep: doel-CPA, plafond, stop en max spend (okt 2026 t/m mei 2027)

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

### 4d. Per kanaal per productgroep per maand, okt 2026 t/m mei 2027

**Hoe de tabellen te lezen.** Alles online-only (kanaal ≠ Winkel), ex btw, productmarge. W / L = winter (okt-feb, 2 winters) / lente (mrt-mei, 2025+2026). Break-even online = conversie × marge per akkoord = wat een offerte maximaal mag kosten om quitte te spelen op productmarge. Regel B: **doel = 50%** (hierop bieden), **plafond = 70%** (tot hier goed), **stop = 100%** (daarboven uit), elk × maandindex van het kanaal. Verwachte offertes = werkelijk 25/26 online-volume × groeifactor (okt-dec Google rolluiken/screens ×1,5; Meta-rolluiken ×1,0, dec ×0,7; jan-feb ×1,1; lente Google ×1,0-1,1, Meta rolluiken/knikarm apr-mei ×1,2, raamdecoratie ×1,5; pergola Google 0, Meta lente ×0,5; voorraadscherm Meta 0). **Max spend = verwachte offertes × plafond; basis = × doel.** "was … off à €…" = werkelijk 25/26: online-offertes en kosten per offerte (Meta per campagne; Google eigen campagne + aandeel generieke campagnes naar offerte-aandeel, alleen jan-mei bekend). Google Ads-doel-CPA in het platform = doel × 0,75. Script: scratchpad jaar-cat.js.

### Google

Maandindex (marge per online-offerte t.o.v. seizoensgemiddelde): okt 1.15 · nov 1.30 · dec 0.60 · jan 1.16 · feb 0.82 · mrt 0.98 · apr 0.98 · mei 1.03

**Google: doel / plafond / stop CPA per sheet-offerte (regel B: 50% / 70% / 100% van de marge per online-offerte × maandindex)**

| productgroep | conv online W / L | marge per akkoord W / L | BE online W / L | okt | nov | dec | jan | feb | mrt | apr | mei |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rolluiken | 12,6% / 11,5% | €1.227 / €1.320 | €154 / €151 | 90 / 125 / 175 | 100 / 140 / 200 | 45 / 65 / 95 | 90 / 125 / 180 | 65 / 90 / 125 | 75 / 105 / 150 | 75 / 105 / 150 | 80 / 110 / 155 |
| Screens | 8,3% / 10,2% | €1.842 / €1.969 | €154 / €200 | 90 / 125 / 175 | 100 / 140 / 200 | 45 / 65 / 90 | 90 / 125 / 175 | 65 / 90 / 125 | 100 / 140 / 195 | 100 / 135 / 195 | 105 / 145 / 205 |
| Knikarmscherm | 9,8% / 10,6% | €1.330 / €1.350 | €130 / €143 | 75 / 105 / 150 | 85 / 120 / 170 | 40 / 55 / 80 | 75 / 105 / 150 | 55 / 75 / 105 | 70 / 100 / 140 | 70 / 100 / 140 | 75 / 105 / 150 |
| Zonwering buiten | 23,8% / 10,3% | €1.123 / €1.312 | €267 / €136 | 155 / 215 / 305 | 175 / 245 / 350 | uit: 80 / 110 / 160 | 155 / 215 / 310 | 110 / 155 / 220 | 65 / 95 / 135 | 65 / 95 / 130 | 70 / 100 / 140 |
| Markiezen | 4,3% / 12,5% | €462 / €781 | €20 / €98 | 10 / 15 / 25 | 15 / 20 / 25 | 5 / 10 / 10 | 10 / 15 / 25 | 10 / 10 / 15 | 50 / 65 / 95 | 50 / 65 / 95 | 50 / 70 / 100 |
| Uitvalscherm | 16,7% / 8,2% | €1.351 / €1.061 | €225 / €87 | 130 / 180 / 260 | 145 / 205 / 295 | uit: 70 / 95 / 135 | 130 / 180 / 260 | 90 / 130 / 185 | 45 / 60 / 85 | 40 / 60 / 85 | 45 / 60 / 90 |
| Raamdecoratie | 7,4% / 30,0% | €2.028 / €1.244 | €150 / €373 | 85 / 120 / 170 | 100 / 135 / 195 | 45 / 65 / 90 | 85 / 120 / 175 | 60 / 85 / 125 | 185 / 255 / 365 | 180 / 255 / 365 | uit: 190 / 270 / 385 |
| Voorraadscherm | 6,7% / 2,8% | €2.042 / €1.778 | €136 / €50 | 80 / 110 / 155 | 90 / 125 / 175 | 40 / 55 / 80 | 80 / 110 / 155 | 55 / 80 / 110 | 25 / 35 / 50 | 25 / 35 / 50 | 25 / 35 / 50 |
| Pergola | 0,8% / 0,0% | €5.416 / €0 | €44 / €0 | uit: 25 / 35 / 50 | uit: 30 / 40 / 55 | uit: 15 / 20 / 25 | uit: 25 / 35 / 50 | uit: 20 / 25 / 35 | uit: 0 / 0 / 0 | uit: 0 / 0 / 0 | uit: 0 / 0 / 0 |

**Google: max spend per maand (verwachte online-offertes × plafond; basis = × doel) met verwachte orders, en wat het vorig jaar was**

| productgroep | okt | nov | dec | jan | feb | mrt | apr | mei |
|---|---|---|---|---|---|---|---|---|
| Rolluiken | 89 off · 11 ord · **€11.125** (basis €8.010) · was 59 off | 81 off · 10 ord · **€11.340** (basis €8.100) · was 54 off | 81 off · 10 ord · **€5.265** (basis €3.645) · was 54 off | 91 off · 11 ord · **€11.375** (basis €8.190) · was 83 off à €70 | 101 off · 13 ord · **€9.090** (basis €6.565) · was 92 off à €65 | 129 off · 15 ord · **€13.545** (basis €9.675) · was 129 off à €51 | 121 off · 14 ord · **€12.705** (basis €9.075) · was 110 off à €48 | 164 off · 19 ord · **€18.040** (basis €13.120) · was 149 off à €44 |
| Screens | 26 off · 2 ord · **€3.250** (basis €2.340) · was 17 off | 20 off · 2 ord · **€2.800** (basis €2.000) · was 13 off | 35 off · 3 ord · **€2.275** (basis €1.575) · was 23 off | 36 off · 3 ord · **€4.500** (basis €3.240) · was 33 off à €76 | 48 off · 4 ord · **€4.320** (basis €3.120) · was 44 off à €97 | 97 off · 10 ord · **€13.580** (basis €9.700) · was 97 off à €86 | 118 off · 12 ord · **€15.930** (basis €11.800) · was 107 off à €105 | 140 off · 14 ord · **€20.300** (basis €14.700) · was 127 off à €105 |
| Knikarmscherm | 8 off · 1 ord · **€840** (basis €600) · was 11 off | 7 off · 1 ord · **€840** (basis €595) · was 10 off | 10 off · 1 ord · **€550** (basis €400) · was 14 off | 37 off · 4 ord · **€3.885** (basis €2.775) · was 34 off à €64 | 55 off · 5 ord · **€4.125** (basis €3.025) · was 46 off à €52 | 109 off · 12 ord · **€10.900** (basis €7.630) · was 109 off à €37 | 129 off · 14 ord · **€12.900** (basis €9.030) · was 117 off à €44 | 165 off · 18 ord · **€17.325** (basis €12.375) · was 150 off à €46 |
| Zonwering buiten | 7 off · 2 ord · **€1.505** (basis €1.085) · was 6 off | 1 off · 0 ord · **€245** (basis €175) · was 1 off | uit (-) | 6 off · 1 ord · **€1.290** (basis €930) · was 5 off à €61 | 3 off · 1 ord · **€465** (basis €330) · was 3 off à €45 | 5 off · 1 ord · **€475** (basis €325) · was 5 off à €29 | 23 off · 2 ord · **€2.185** (basis €1.495) · was 21 off à €34 | 29 off · 3 ord · **€2.900** (basis €2.030) · was 26 off à €34 |
| Markiezen | 1 off · 0 ord · **€15** (basis €10) · was 1 off | 2 off · 0 ord · **€40** (basis €30) · was 3 off | 2 off · 0 ord · **€20** (basis €10) · was 3 off | 3 off · 0 ord · **€45** (basis €30) · was 6 off à €78 | 10 off · 0 ord · **€100** (basis €100) · was 10 off à €86 | 25 off · 3 ord · **€1.625** (basis €1.250) · was 21 off à €85 | 31 off · 4 ord · **€2.015** (basis €1.550) · was 26 off à €92 | 23 off · 3 ord · **€1.610** (basis €1.150) · was 19 off à €114 |
| Uitvalscherm | 3 off · 1 ord · **€540** (basis €390) · was 5 off | 2 off · 0 ord · **€410** (basis €290) · was 3 off | uit (-) | 6 off · 1 ord · **€1.080** (basis €780) · was 6 off à €61 | 10 off · 2 ord · **€1.300** (basis €900) · was 10 off à €45 | 29 off · 2 ord · **€1.740** (basis €1.305) · was 29 off à €29 | 27 off · 2 ord · **€1.620** (basis €1.080) · was 27 off à €34 | 40 off · 3 ord · **€2.400** (basis €1.800) · was 40 off à €34 |
| Raamdecoratie | 9 off · 1 ord · **€1.080** (basis €765) · was 6 off | 3 off · 0 ord · **€405** (basis €300) · was 2 off | 9 off · 1 ord · **€585** (basis €405) · was 6 off | 4 off · 0 ord · **€480** (basis €340) · was 4 off à €61 | 2 off · 0 ord · **€170** (basis €120) · was 2 off à €45 | 3 off · 1 ord · **€765** (basis €555) · was 2 off à €29 | 5 off · 2 ord · **€1.275** (basis €900) · was 3 off à €34 | uit (was 0 off à €0) |
| Voorraadscherm | 4 off · 0 ord · **€440** (basis €320) · was 4 off | 1 off · 0 ord · **€125** (basis €90) · was 1 off | 2 off · 0 ord · **€110** (basis €80) · was 2 off | 16 off · 1 ord · **€1.760** (basis €1.280) · was 16 off à €61 | 22 off · 1 ord · **€1.760** (basis €1.210) · was 22 off à €45 | 32 off · 1 ord · **€1.120** (basis €800) · was 63 off à €29 | 34 off · 1 ord · **€1.190** (basis €850) · was 68 off à €34 | 41 off · 1 ord · **€1.435** (basis €1.025) · was 82 off à €34 |
| Pergola | uit (was 24 off) | uit (was 21 off) | uit (was 20 off) | uit (was 22 off à €100) | uit (was 37 off à €69) | uit (was 58 off à €45) | uit (was 74 off à €46) | uit (was 56 off à €50) |
| **totaal Google** | **147 off · 17 ord · max €18.795 (basis €13.520)** | **117 off · 13 ord · max €16.205 (basis €11.580)** | **139 off · 15 ord · max €8.805 (basis €6.115)** | **199 off · 22 ord · max €24.415 (basis €17.565)** | **251 off · 27 ord · max €21.330 (basis €15.370)** | **429 off · 44 ord · max €43.750 (basis €31.240)** | **488 off · 51 ord · max €49.820 (basis €35.780)** | **602 off · 61 ord · max €64.010 (basis €46.200)** |

**Google: okt-mei per productgroep** (verwacht bij regel B; netto = marge − spend, vóór lasten)

| productgroep | verwacht offertes | orders | marge | spend basis-max | netto bij basis / bij max | vorig jaar offertes / orders / marge / spend / netto |
|---|---|---|---|---|---|---|
| Rolluiken | 857 | 103 | €131.051 | €66.380-€92.485 | €64.671 / €38.566 | 730 / 82 / €104.517 / ≥€30.203 / ? |
| Screens | 520 | 50 | €96.478 | €48.475-€66.955 | €48.003 / €29.523 | 461 / 35 / €71.150 / ≥€39.779 / ? |
| Knikarmscherm | 520 | 54 | €73.041 | €36.430-€51.365 | €36.611 / €21.676 | 491 / 33 / €47.894 / ≥€20.586 / ? |
| Zonwering buiten | 74 | 10 | €12.281 | €6.370-€9.065 | €5.911 / €3.216 | 67 / 3 / €5.172 / ≥€2.159 / ? |
| Markiezen | 97 | 11 | €8.073 | €4.130-€5.470 | €3.943 / €2.603 | 89 / 10 / €7.666 / ≥€7.683 / ? |
| Uitvalscherm | 117 | 11 | €13.047 | €6.545-€9.090 | €6.502 / €3.957 | 120 / 12 / €13.895 / ≥€3.896 / ? |
| Raamdecoratie | 35 | 4 | €7.042 | €3.385-€4.760 | €3.657 / €2.282 | 25 / 3 / €6.217 / ≥€490 / ? |
| Voorraadscherm | 152 | 6 | €11.485 | €5.655-€7.940 | €5.830 / €3.545 | 258 / 9 / €16.795 / ≥€8.805 / ? |
| Pergola | 0 | 0 | €0 | €0-€0 | €0 / €0 | 312 / 1 / €5.416 / ≥€13.522 / ? |
| **totaal** | 2372 | 250 | €352.498 | €177.370-€247.130 | €175.128 / €105.368 | 2553 / 188 / €278.722 / ≥€127.123 / - |

### Meta

Maandindex (marge per online-offerte t.o.v. seizoensgemiddelde): okt 0.89 · nov 0.89 · dec 0.60 · jan 1.30 · feb 1.03 · mrt 1.30 · apr 0.82 · mei 0.89

**Meta: doel / plafond / stop CPA per sheet-offerte (regel B: 50% / 70% / 100% van de marge per online-offerte × maandindex)**

| productgroep | conv online W / L | marge per akkoord W / L | BE online W / L | okt | nov | dec | jan | feb | mrt | apr | mei |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rolluiken | 7,8% / 8,0% | €1.110 / €1.164 | €87 / €93 | 40 / 55 / 75 | 40 / 55 / 80 | 25 / 35 / 50 | 55 / 80 / 115 | 45 / 65 / 90 | 60 / 85 / 120 | 40 / 55 / 75 | 40 / 60 / 85 |
| Knikarmscherm | 8,2% / 6,7% | €1.514 / €1.450 | €125 / €96 | 55 / 80 / 110 | 55 / 80 / 110 | 35 / 50 / 75 | 80 / 115 / 160 | 65 / 90 / 130 | 65 / 90 / 125 | 40 / 55 / 80 | 45 / 60 / 85 |
| Screens | 4,1% / 6,3% | €2.152 / €1.625 | €89 / €103 | 40 / 55 / 80 | 40 / 55 / 80 | 25 / 35 / 55 | 60 / 80 / 115 | 45 / 65 / 90 | 65 / 95 / 135 | 40 / 60 / 85 | 45 / 65 / 90 |
| Pergola | 1,6% / 1,0% | €1.969 / €2.856 | €31 / €28 | 15 / 20 / 25 | 15 / 20 / 25 | 10 / 15 / 20 | 20 / 30 / 40 | 15 / 20 / 30 | 20 / 25 / 35 | 10 / 15 / 25 | 15 / 20 / 25 |
| Raamdecoratie | 12,7% / 23,3% | €1.509 / €865 | €192 / €202 | 85 / 120 / 170 | 85 / 120 / 170 | 60 / 80 / 115 | 125 / 175 / 250 | 100 / 140 / 200 | 130 / 185 / 260 | 85 / 115 / 165 | 90 / 125 / 180 |
| Markiezen | 18,2% / 12,5% | €3.500 / €903 | €636 / €113 | uit: 280 / 395 / 565 | uit: 285 / 400 / 570 | uit: 190 / 265 / 380 | uit: 415 / 580 / 825 | 330 / 460 / 655 | 75 / 105 / 145 | 45 / 65 / 95 | 50 / 70 / 100 |
| Uitvalscherm | 0,0% / 11,8% | €0 / €1.825 | €0 / €215 | uit: 0 / 0 / 0 | uit: 0 / 0 / 0 | uit: 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 140 / 195 / 280 | 90 / 125 / 175 | 95 / 135 / 190 |
| Zonwering buiten | 4,8% / 4,5% | €1.041 / €1.881 | €50 / €85 | uit: 20 / 30 / 45 | uit: 20 / 30 / 45 | uit: 15 / 20 / 30 | uit: 30 / 45 / 65 | uit: 25 / 35 / 50 | uit: 55 / 75 / 110 | uit: 35 / 50 / 70 | uit: 40 / 55 / 75 |
| Voorraadscherm | 4,5% / 1,5% | €1.229 / €2.117 | €56 / €32 | uit: 25 / 35 / 50 | uit: 25 / 35 / 50 | uit: 15 / 25 / 35 | uit: 35 / 50 / 75 | uit: 30 / 40 / 60 | uit: 20 / 30 / 40 | uit: 15 / 20 / 25 | uit: 15 / 20 / 30 |

**Meta: max spend per maand (verwachte online-offertes × plafond; basis = × doel) met verwachte orders, en wat het vorig jaar was**

| productgroep | okt | nov | dec | jan | feb | mrt | apr | mei |
|---|---|---|---|---|---|---|---|---|
| Rolluiken | 98 off · 8 ord · **€5.390** (basis €3.920) · was 98 off à €104 | 101 off · 8 ord · **€5.555** (basis €4.040) · was 101 off à €88 | 76 off · 6 ord · **€2.660** (basis €1.900) · was 108 off à €86 | 186 off · 15 ord · **€14.880** (basis €10.230) · was 186 off à €66 | 185 off · 14 ord · **€12.025** (basis €8.325) · was 185 off à €73 | 307 off · 24 ord · **€26.095** (basis €18.420) · was 307 off à €56 | 349 off · 28 ord · **€19.195** (basis €13.960) · was 291 off à €44 | 361 off · 29 ord · **€21.660** (basis €14.440) · was 301 off à €43 |
| Knikarmscherm | 1 off · 0 ord · **€80** (basis €55) · was 2 off | 3 off · 0 ord · **€240** (basis €165) · was 5 off | 3 off · 0 ord · **€150** (basis €105) · was 9 off | 23 off · 2 ord · **€2.645** (basis €1.840) · was 15 off | 38 off · 3 ord · **€3.420** (basis €2.470) · was 25 off | 114 off · 8 ord · **€10.260** (basis €7.410) · was 104 off | 128 off · 9 ord · **€7.040** (basis €5.120) · was 107 off | 170 off · 11 ord · **€10.200** (basis €7.650) · was 142 off |
| Screens | 19 off · 1 ord · **€1.045** (basis €760) · was 19 off à €88 | 23 off · 1 ord · **€1.265** (basis €920) · was 23 off à €70 | 23 off · 1 ord · **€805** (basis €575) · was 23 off à €72 | 26 off · 1 ord · **€2.080** (basis €1.560) · was 32 off à €52 | 39 off · 2 ord · **€2.535** (basis €1.755) · was 49 off à €32 | 85 off · 5 ord · **€8.075** (basis €5.525) · was 77 off à €23 | 120 off · 8 ord · **€7.200** (basis €4.800) · was 109 off à €14 | 127 off · 8 ord · **€8.255** (basis €5.715) · was 115 off à €15 |
| Pergola | 70 off · 1 ord · **€1.400** (basis €1.050) · was 70 off à €27 | 75 off · 1 ord · **€1.500** (basis €1.125) · was 75 off à €24 | 41 off · 1 ord · **€615** (basis €410) · was 41 off à €45 | 99 off · 2 ord · **€2.970** (basis €1.980) · was 99 off à €19 | 100 off · 2 ord · **€2.000** (basis €1.500) · was 100 off à €17 | 69 off · 1 ord · **€1.725** (basis €1.380) · was 138 off à €13 | 57 off · 1 ord · **€855** (basis €570) · was 114 off à €14 | 67 off · 1 ord · **€1.340** (basis €1.005) · was 134 off à €13 |
| Raamdecoratie | 2 off · 0 ord · **€240** (basis €170) · was 1 off à €280 | 6 off · 1 ord · **€720** (basis €510) · was 4 off à €340 | 3 off · 0 ord · **€240** (basis €180) · was 2 off à €774 | 9 off · 1 ord · **€1.575** (basis €1.125) · was 8 off à €193 | 11 off · 1 ord · **€1.540** (basis €1.100) · was 10 off à €140 | 11 off · 3 ord · **€2.035** (basis €1.430) · was 7 off à €215 | 14 off · 3 ord · **€1.610** (basis €1.190) · was 9 off à €134 | 14 off · 3 ord · **€1.750** (basis €1.260) · was 9 off à €136 |
| Markiezen | uit (was 1 off à €0) | uit (was 0 off à €0) | uit (was 2 off à €0) | uit (was 2 off à €0) | 5 off · 1 ord · **€2.300** (basis €1.650) · was 5 off à €0 | 9 off · 1 ord · **€945** (basis €675) · was 9 off à €40 | 16 off · 2 ord · **€1.040** (basis €720) · was 16 off à €44 | 11 off · 1 ord · **€770** (basis €550) · was 11 off à €35 |
| Uitvalscherm | uit (was 2 off) | uit (was 1 off) | uit (was 1 off) | 3 off · 0 ord · **€0** (basis €0) · was 3 off | 4 off · 0 ord · **€0** (basis €0) · was 4 off | 11 off · 1 ord · **€2.145** (basis €1.540) · was 11 off | 20 off · 2 ord · **€2.500** (basis €1.800) · was 20 off | 17 off · 2 ord · **€2.295** (basis €1.615) · was 17 off |
| Zonwering buiten | uit (was 3 off) | uit (was 4 off) | uit (was 3 off) | uit (was 6 off) | uit (was 7 off) | uit (was 15 off) | uit (was 16 off) | uit (was 29 off) |
| Voorraadscherm | uit (was 2 off) | uit (was 2 off) | uit (was 7 off) | uit (was 8 off) | uit (was 25 off) | uit (was 87 off) | uit (was 143 off) | uit (was 169 off) |
| **totaal Meta** | **190 off · 10 ord · max €8.155 (basis €5.955)** | **208 off · 11 ord · max €9.280 (basis €6.760)** | **146 off · 8 ord · max €4.470 (basis €3.170)** | **346 off · 20 ord · max €24.150 (basis €16.735)** | **382 off · 23 ord · max €23.820 (basis €16.800)** | **606 off · 43 ord · max €51.280 (basis €36.380)** | **704 off · 52 ord · max €39.440 (basis €28.160)** | **767 off · 55 ord · max €46.270 (basis €32.235)** |

**Meta: okt-mei per productgroep** (verwacht bij regel B; netto = marge − spend, vóór lasten)

| productgroep | verwacht offertes | orders | marge | spend basis-max | netto bij basis / bij max | vorig jaar offertes / orders / marge / spend / netto |
|---|---|---|---|---|---|---|
| Rolluiken | 1663 | 132 | €150.378 | €75.235-€107.460 | €75.143 / €42.918 | 1577 / 107 / €122.410 / €97.353 / €25.057 |
| Knikarmscherm | 480 | 33 | €48.226 | €24.815-€34.035 | €23.411 / €14.191 | 409 / 31 / €46.007 / ≥€0 / ? |
| Screens | 462 | 26 | €45.668 | €21.610-€31.260 | €24.058 / €14.408 | 447 / 25 / €46.851 / €13.265 / €33.586 |
| Pergola | 578 | 8 | €17.300 | €9.020-€12.405 | €8.280 / €4.895 | 771 / 10 / €23.240 / €14.089 / €9.150 |
| Raamdecoratie | 70 | 13 | €13.822 | €6.965-€9.710 | €6.857 / €4.112 | 50 / 10 / €12.753 / €10.066 / €2.687 |
| Markiezen | 41 | 5 | €7.246 | €3.595-€5.055 | €3.651 / €2.191 | 46 / 6 / €11.410 / €1.448 / €9.962 |
| Uitvalscherm | 55 | 6 | €10.305 | €4.955-€6.940 | €5.350 / €3.365 | 59 / 6 / €10.949 / ≥€0 / ? |
| Zonwering buiten | 0 | 0 | €0 | €0-€0 | €0 / €0 | 83 / 5 / €11.077 / ≥€0 / ? |
| Voorraadscherm | 0 | 0 | €0 | €0-€0 | €0 / €0 | 443 / 8 / €15.163 / ≥€0 / ? |
| **totaal** | 3349 | 223 | €292.945 | €146.195-€206.865 | €146.750 / €86.080 | 3885 / 208 / €299.858 / ≥€136.221 / - |

**Lezen.**
- Okt-mei per kanaal: Google basis €177k / max €247k (2.372 offertes, 250 orders, €352k marge), Meta basis €146k / max €207k (3.349 offertes, 223 orders, €293k marge). Basis = het budgetadvies (§5); max = tot waar het mag zolang de leads onder het plafond blijven.
- Winter okt-feb: Google-rolluiken/screens in okt-nov omhoog, Meta-rolluiken okt-dec op plafond €55/€35 (was €86-104 per online-offerte: te duur), Meta-pergola alleen ≤ €20-25, december overal laag.
- Lente: Google screens (plafond €135-145, marge/akkoord €1.969) en rolluiken (€105-110) dragen het meest; Meta-rolluiken apr-mei plafond €55-60 tegen €27-29 werkelijk = ruimte voor volume; Google-pergola uit, voorraadscherm alleen via PMax, Meta-pergola ≤ €15-25.
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
