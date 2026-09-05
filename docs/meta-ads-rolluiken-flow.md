# Meta Ads: rolluikseizoen 2026, ad-flow die klantvragen beantwoordt

Opgesteld 2026-09-05. Beelden: `data/ads/rolluiken/*.png` (1080x1080, echte Sonty-projectfoto's + winnende tekstkaart-formule uit "Afbeelding 1", €43 per lead). Spec: `data/ads/rolluiken/spec.json`, bouwen: `node scripts/ad-kaart.js`.

## Waarom deze opzet
- De winnende Sonty-ads (2024) waren allemaal: echte foto + witte kaart + geel label + 3 vinkjes + offerte-balk. Die formule is 1-op-1 overgenomen.
- Echte klantvragen uit de mail/Trengo-historie: slaapkamer/kinderkamer koel en donker, wind en verduisteren, kleur passend bij kozijn, geen stroompunt (solar), inbraak, prijs, "gaat mijn raam nog open".
- Regels: geen handbediening, geen prijsstijging januari noemen, geen 20% woonmaand (V13 open), geen concurrentnamen, garantie 5 jaar product / 7 jaar motor.

## Structuur (1 campagne "Rolluiken najaar 2026", doel Leads, conversie Bedankt Offerte)
| Adset | Doelgroep | Ads | Budget |
|---|---|---|---|
| 1 Koud | Advantage+ audience, 30 km rond Berkel/Rijswijk, 30-65, uitsluiten sitebezoekers 30 d | A1, A2 (+ B1 als 3e, prijs trekt kwaliteit) | 60% |
| 2 Vragen (retarget lauw) | Sitebezoekers 30 d, IG/FB-engagement 90 d, video 50%+; uitsluiten leads | B1, B2, B3, B4 | 25% |
| 3 Warm | Bezoekers /offerte-aanvragen, /diensten/rolluiken 14 d zonder bedankt; uitsluiten leads | C1, C2 | 15% |
Doel-CPA €50-55, max €70 (winterregel). Na 7 dagen: ads onder 1,5% CTR of boven €90/lead uit, winnaar dupliceren met 2e foto.

## Ads (kop op beeld | primaire tekst Meta | headline Meta)
**A1 Slaapkamer** (fase koud) | "Slaapkamer te warm of te licht?" | Een rolluik maakt de kamer 's zomers koel en 's nachts pikdonker. Elektrisch, met afstandsbediening, op maat gemaakt en gemonteerd door onze eigen monteurs. Vraag vrijblijvend een offerte aan, we komen gratis inmeten. | Rolluiken op maat, gemonteerd door Sonty
**A2 Winter** | "Tot 30% minder warmteverlies" | Een gesloten rolluik legt een extra luchtlaag voor je raam. Dat scheelt 's winters tot 30% warmteverlies via het glas. Nu bestellen is vóór de kou gemonteerd. 5 jaar garantie, 7 jaar op de motor. | Klaar voor de winter met rolluiken
**B1 Prijs** (fase vragen) | "Wat kost een elektrisch rolluik?" | Eerlijk antwoord: een elektrisch aluminium rolluik voor een slaapkamerraam van 120x140 cm kost bij ons circa €1.150, inclusief Somfy-motor, afstandsbediening en montage. Groter of kleiner raam? We meten gratis in en je hebt binnen 24 uur je prijs. | Rolluik incl. montage, eerlijke prijs
**B2 Inbraak** | "Inbrekers kiezen het makkelijkste huis." | Aluminium rolluiken (geen PVC) vormen een fysieke barrière. Wil je meer, dan is er een veiligheidspakket met verzwaarde geleiders en onderlijst. Bedien alles elektrisch, ook via de app. | Inbraakwerende rolluiken op maat
**B3 Kleur** | "Past bij elke gevel en kozijn" | Wit, antraciet, groen of precies jouw RAL-kleur: 209 standaardkleuren. Strak weggewerkt boven het raam, ook op dakkapel, garage en tuinhuis. | Rolluiken in 209 kleuren
**B4 Solar** | "Rolluik op zonne-energie" | Geen stroompunt bij het raam? Kies een rolluik met Somfy solar-motor: geen elektricien, geen hak- en breekwerk, wel afstandsbediening. 7 jaar garantie op de motor. | Rolluiken zonder stroomaansluiting
**C1 Bewijs** (fase warm) | "4,9 van 5 sterren. Eigen monteurs." | Meer dan 3000 klanten gingen je voor, 4,9 van 5 op Google. Inmeten, maken en monteren doen we zelf. Showroom in Rijswijk, 5 jaar garantie, 7 jaar op de motor. | Sonty, zonwering uit eigen hand
**C2 Proces** | "Gratis inmeten, offerte in 24 uur" | Zo werkt het: adviseur komt bij je thuis, binnen 24 uur je offerte, op maat gemaakt en gemonteerd door Sonty. Wie nu tekent, heeft er dit najaar al plezier van. | Vraag nu je rolluik-offerte aan

Alle ads: CTA "Offerte aanvragen", link https://sonty.nl/offerte-aanvragen/?utm_source=Facebook&utm_medium=paid&utm_campaign=rolluiken-najaar-2026.

## Volgende stappen
1. Daimy: akkoord op beelden/teksten en op de prijsclaim in B1 (uit de centrale prijsmotor, S-37, io-motor, RAL 7016; nog niet live gemeten).
2. Video-varianten van A1/A2 uit `sonty-website/public/videos/portfolio/rolluik-*.mp4` (winnaar "Video 1" had de meeste leads).
3. 4:5-formaat (1080x1350) voor feed, 9:16 voor stories.
4. Klaarzetten in Ads Manager als concept (via MCP), pas live na "ja".
