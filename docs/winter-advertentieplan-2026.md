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
- **Max CPA (per offerte in de sheet):** Google gemiddeld €65, Meta gemiddeld €40. Per categorie in §3. Harde stop = plafond × 1,4.
- **Budget:** Google €73k + Meta €66k over okt-feb (≈ €28k/mnd), december het laagst. Vorige winter was het ≈ €160-170k; verschuiving weg van Meta-rolluiken (te duur) naar Google rolluiken/screens.

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

## 4. Budget per maand (advies)

| maand | Google | Meta | totaal | toelichting |
|---|---|---|---|---|
| okt | €13k | €12k | €25k | woonmaand; Google rolluiken/screens/PMax; Meta rolluiken ≤€45 + pergola ≤€25 + showroom-test |
| nov | €15k | €12k | €27k | sterkste wintermaand op conversie (Google 15%) |
| dec | €10k | €7k | €17k | biedingen −20% vanaf 8 dec; Meta op minimum (vorig jaar −€5.300 op €17k) |
| jan | €16k | €15k | €31k | vanaf 2e week: knikarm aan (Google + Meta vroegboek) |
| feb | €19k | €20k | €39k | piekmaand rolluiken/knikarm/screens; pergola en markiezen Google weer aan |
| **winter** | **€73k** | **€66k** | **€139k** | vorige winter ≈ €160-170k (Meta €87k + Google €33k jan-feb + okt-dec onbekend) |

Verdeling Google per maand (richting): PMax 45%, rolluiken 20%, screens 18%, plaatsen/branding/remarketing 10%, knikarm 0% tot jan dan 10%. "Straal" (€6,6k jan-feb 2026) blijft onbekend (V2 van 04-09), tot dan niet meer dan €1.500/mnd.
Verdeling Meta: rolluiken 55%, pergola 15%, retargeting 10%, showroom/raamdeco 10%, knikarm vanaf jan 15% (ten koste van rolluiken).

Het geld is niet de schaarse factor, het plafond is: zolang een categorie onder het plafond blijft mag het budget omhoog, zodra de kosten per offerte twee weken boven het plafond zitten gaat het budget 30% omlaag, boven de harde stop gaat de campagne uit. Dat is de hele sturing.

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
