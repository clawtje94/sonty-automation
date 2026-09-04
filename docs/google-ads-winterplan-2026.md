# Google Ads in de winter 2026/27 — wat mag een lead kosten en wat doen we

Gemaakt 2026-09-04 op vraag van Daimy ("wat moeten we nou doen met de Google Ads in de winter, zoek goed uit wat de CPA mag zijn").
Bronnen: offerte-register (conversie-2024/2025/2026-raw.json, afkomst = Google), ad-spend.json (Google-spend jan-jul 2026, mrt-mei 2025),
campagne-spend-google.json (spend per campagne jan-jul 2026), Google Ads zoekwoordrapport mei-jul 2026, seizoensplan.js.
Rekenscript: scratchpad winter-google.js (zelfde akkoord-definitie als seizoensplan.js).

## 1. Wat de cijfers zeggen

**Google in de winter is niet slechter dan in de zomer, eerder beter (op sheet-offertes).**

| Google (sheet, afkomst Google) | offertes | conv | productmarge per akkoord | productmarge per offerte |
|---|---|---|---|---|
| Winter okt-feb (seizoenen 24/25 + 25/26) | 1.121 | 13,6% | €1.690 | €229 |
| Zomer mrt-aug (2025 + 2026) | 5.884 | 10,7% | €2.043 | €218 |
| Winter 25/26 alleen | 884 | 10,7% | €1.866 | €200 |

Per wintermaand seizoen 25/26: okt 11,0% · nov 15,2% · **dec 8,7%** · jan 12,0% · feb 8,8%. December is elk jaar de zwakste maand (24/25: 7,4%).

**Met echte spend (jan-feb 2026) was Google winstgevend:**

| maand | spend | offertes | akkoord | CPL | kosten per akkoord | productmarge − spend | ads als % van productmarge |
|---|---|---|---|---|---|---|---|
| jan 2026 | €15.044 | 217 | 26 | €69 | €579 | +€34.888 | 30% |
| feb 2026 | €17.862 | 283 | 25 | €63 | €714 | +€27.440 | 39% |
| ter vergelijking jun 2026 | €36.808 | 764 | 60 | €48 | €613 | +€119.865 | 23% |
| ter vergelijking jul 2026 | €37.598 | 743 | 70 | €51 | €537 | +€129.352 | 23% |

Meta in dezelfde winter: okt +€2.356, nov +€1.528, **dec −€2.790**, jan +€21.996, feb +€52.208 (productmarge − spend). Meta verliest in december geld; Google-cijfers okt-dec 2025 ontbreken (spend niet bekend).

Per product, Google, winter (twee seizoenen). Break-even = productmarge per offerte.

| product | winter offertes | winter conv | marge/akkoord | break-even per lead | zomer conv |
|---|---|---|---|---|---|
| Rolluiken (40% van Google-winterleads) | 468 | 13,9% | €1.605 | €223 | 12,9% |
| Screens | 156 | 13,5% | €2.434 | €328 | 9,0% |
| Knikarmscherm | 148 | 15,5% | €1.876 | €291 | 12,6% |
| Zonwering buiten (algemeen) | 65 | 24,6% | €1.354 | €333 | 14,4% |
| Voorraadscherm | 45 | 6,7% | €2.471 | €165 | 6,2% |
| Pergola | 126 | **0,8%** | €6.554 | **€52** | 3,4% |
| Markiezen | 24 | 8,3% | €938 | €78 | 14,9% |

## 2. Wat een lead mag kosten (max CPA)

Marge hier = verkoop − inkoop (productmarge). Montage-uren en overhead zitten er nog niet af. Daarom niet tot break-even bieden.
Regel: **advertentiekosten maximaal 35% van de productmarge**. Dat is het niveau waarop zomer én winter 2026 aantoonbaar winst gaven.

| | winter (nov-feb) | zomer |
|---|---|---|
| Theoretisch break-even per lead (productmarge) | ~€200 | ~€220 |
| **Advies-plafond per lead (35%)** | **€70** | €75 |
| Advies-plafond per akkoord | €650 | €700 |
| Harde stop per lead (50% van marge) | €100 | €110 |

Per campagnegroep, plafond per lead in de winter: rolluiken €78 · screens €90 (cel klein, band €60-115) · knikarm €100 · PMax/algemeen €70 · voorraadscherm €58 · **pergola €18 (niet betaalbaar, uit)** · **markiezen €27 (uit)**.

Dit sluit aan op de eerdere notitie (Google winter €74). Die was gebaseerd op RP-conversie; RP telt ook leads die nooit een offerte kregen en ligt dus lager. Voor budgetsturing is het offerte-register leidend: daar staat de spend tegenover.

**Vertaling naar Google Ads zelf.** Google telt eigen conversies (mei-jul search: 1.358 conversies voor €53.167 = €39 per Google-conversie, terwijl de sheet-CPL toen €51 was). Factor ongeveer 0,75. Dus:
- doel-CPA in Google Ads winter: **€50-55 per Google-conversie** (= €70 per sheet-lead)
- rolluiken €55-60, screens €65, knikarm €70, PMax €50
- factor eerst hard meten zodra de Google Ads API werkt (docs/google-ads-api-setup.md, credentials ontbreken nog).

## 3. Wat te doen, per campagne

Spend jan/feb 2026 (echte verdeling) en advies voor nov 2026 - feb 2027:

| campagne | jan 26 | feb 26 | advies winter 26/27 |
|---|---|---|---|
| Performance Max Zonwering | €6.601 | €6.385 | houden, doel-CPA €50, budget €7-8k/mnd |
| Zonwering Rolluiken | €790 | €1.919 | **opschalen** naar €2.500-3.000/mnd vanaf nov; 40% van de winterleads, conv 13,9% |
| Schermen + Screens | €524 | €2.287 | **opschalen** naar €2.500/mnd; winterconv 13,5%, hoogste marge per akkoord |
| Knikarmschermen | €100 | €319 | uit in nov-dec, **aan vanaf 2e week jan** op €1.500/mnd; feb = 23% van de jaarvraag knikarm |
| Plaatsen | €1.825 | €2.675 | houden, €2.000-2.500/mnd |
| Straal | €3.955 | €2.655 | onbekend wat dit is (bestond alleen jan-feb) → eerst uitzoeken, tot dan niet meer dan €1.500 |
| Pergola | €861 | €913 | **uit** van nov t/m half jan (winterconv 0,8%, break-even €52); aan in feb |
| Markiezen | €105 | €417 | uit nov-jan; aan in feb |
| Branding / Discovery / Remarketing | €280 | €290 | laten staan |

Budget totaal Google: **nov €15k · dec €10-12k · jan €15-18k · feb €18-20k**. Jan-feb 2026 op €15-18k gaf +€27-35k productmarge per maand; met de verschuiving van pergola/markiezen/straal naar rolluiken/screens moet hetzelfde budget meer opleveren.

Waar het geld vandaan komt: Meta afschalen in de winter. Meta levert €127 productmarge per offerte tegen €242 bij Google (aug-feb, twee seizoenen). Meta-pergola in de winter is de grootste verspilling van offertecapaciteit (676 offertes, 1,6% conv). In december Meta op minimum.

## 4. Timing

- **Oktober**: woonmaand 20% (Daimy) als boodschap in ads en landingspagina's; okt-conv Google 11%.
- **November**: sterke maand (conv 15%, marge per offerte €308). Volle budgetten rolluiken/screens/PMax.
- **8 dec - 5 jan**: biedingen 20% omlaag, budget €10-12k. Zwakste conv (8,7%), akkoorden schuiven over de feestdagen heen.
- **Vanaf 2e week januari**: opschalen; knikarm aan. Januari conv 12%.
- **Februari**: piekmaand voor rolluiken, knikarm en screens (elk ~21-23% van de aug-feb-vraag). Volle budgetten, pergola en markiezen weer aan.
- Let op capaciteit: feb 2026 zat op 290 offertes/week over alle kanalen, boven de gezonde 250 (capaciteitsmonitor). Google-leads verdringen dan liever Meta-leads dan andersom.

## 5. Kanttekeningen (eerlijk)

1. Marge is productmarge. Montage en overhead onbekend per order; daarom het 35%-plafond in plaats van break-even.
2. Afkomst in de sheet is wat de klant zelf zegt ("via Google"). Google's eigen conversietelling wijkt af (factor ~0,75, alleen gemeten op search mei-jul 2026, PMax niet apart).
3. Google-spend okt-dec 2025 is niet bekend; die maanden zijn alleen op conversie/marge beoordeeld, niet op CPL.
4. Screens-, markiezen- en voorraadscherm-cellen in de winter zijn klein (24-156 offertes); plafonds daar als band lezen.
5. Aug 2026 staat op 6,1% Google-conv maar is 4 dagen oud; mediaan offerte→akkoord is 24 dagen. Niet gebruiken.

## 6. Open vragen aan Daimy

- V1: Google Ads API-toegang (developer token + OAuth-client, 15 min, stappen in docs/google-ads-api-setup.md). Dan meet ik per campagne per week en kan het plafond per campagne automatisch bewaakt worden (alleen-lezen, niets aanpassen).
- V2: wat is campagne "01 | Zonwering | Straal" (jan-feb 2026, €6.600 totaal)?
- V3: Google-spend okt, nov, dec 2025 (drie bedragen) in data/ad-spend-handmatig.json, dan is de hele winter 25/26 doorgerekend.
