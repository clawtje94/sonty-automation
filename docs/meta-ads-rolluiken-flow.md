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

## Claim-check tegen Sunny's kennisbank (05-09, op verzoek Daimy)
Elke regel op de beelden is nagelopen tegen `data/trengo-kennisbank.md` en `data/sunny-prompt.txt`. Verwijderd omdat Sunny het niet weet: veiligheidspakket, noodkruk, servicedienst, storm/hagel, "209 kleuren", "offerte in 24 uur", "gratis inmeten" los. Gebruikte feiten: 30% energiebesparing, inbraakpreventie, geluidsdemping, 100% verduistering, Somfy Solar zonder bekabeling (laadt ook bij bewolkt weer), Tahoma-app, 10 standaardkleuren + RAL tegen meerprijs, S-42 tot 4 m breed, levertijd 8-10 weken, garantie 3/5/7, prijsindicatie → akkoord → inmeter gratis (anders €75) → harde offerte → restbedrag na montage, 3000+ klanten, 4,9 met 600+ reviews, showroom Frijdastraat Rijswijk, rolluiken goedkoper dan screens.
Prijsclaim B1 bevestigd 05-09 op Sunny's live prijs-API (offerte-tool?action=prijs): rolluikS37 120x140 io = €1.145,40 incl. montage; Daimy akkoord (V2) en "eigen monteurs" (Sonty Montage-team).

## Formaten en bestanden (`data/ads/rolluiken/lever/`, zip: `sonty-rolluik-ads.zip`)
- `1x1/` 14 ads 1080x1080 (feed FB/IG), `4x5/` 14 ads 1080x1350 (feed, meer schermruimte), `9x16/` 14 ads 1080x1920 (stories/reels, veilige zones 250 boven / 260 onder).
- `carrousel/` 5 kaarten "Kies je kleur" (wit, antraciet, groen/RAL, zwart, hout/nieuwbouw) voor fase 2.
- `video/` A1 en A2 als video (9:16 en 1:1) uit de rolluik-projectvideo's van de site; bron is 464x832, dus iets zachter beeld.
- Bron-PNG's in `1x1/ 4x5/ 9x16/ carrousel/ overlay/`, spec in `spec.json` en `carrousel.json`, bouwen met `scripts/ad-kaart.js`.

## Ads (kop op beeld | primaire tekst Meta | headline Meta)
**A1 Slaapkamer** (koud) | "Slaapkamer te warm of te licht?" | Een rolluik maakt de kamer 's zomers koel en 's nachts 100% donker. Elektrisch met afstandsbediening, op maat gemaakt en gemonteerd door Sonty. Vraag een prijsindicatie aan op jouw maten. | Rolluiken op maat, gemonteerd door Sonty
**A2 Winter** (koud) | "Tot 30% minder energieverlies" | Een gesloten rolluik legt een isolerende luchtlaag voor je raam: tot 30% energiebesparing in de winter. Levertijd 8 tot 10 weken, dus wie nu bestelt heeft het vóór de winter hangen. Garantie: 3 jaar montage, 5 jaar product, 7 jaar motor. | Klaar voor de winter met rolluiken
**A3 Dakkapel** (koud) | "Eindelijk slapen zonder hitte" | Dakkapel of zolderkamer die niet af te koelen is? Een rolluik houdt de warmte buiten en maakt het donker in één beweging. Op maat, gemonteerd door Sonty. | Rolluiken voor dakkapel en zolder
**A4 Garage** (koud) | "Ook voor garage, tuinhuis en berging" | Een gesloten rolluik is een extra barrière tegen inbrekers, ook op je garage, tuinhuis of berging. Elektrisch of op zonne-energie, op maat tot 4 meter breed. | Rolluiken voor garage en tuinhuis
**B1 Prijs** (vragen) | "Wat kost een elektrisch rolluik?" | Eerlijk antwoord: een elektrisch aluminium rolluik voor een slaapkamerraam van 120x140 cm kost circa €1.150, inclusief Somfy-motor, afstandsbediening en montage. Andere maat? Je krijgt vooraf een prijsindicatie op jouw maten, zonder verrassingen. | Rolluik incl. montage, eerlijke prijs
**B2 Inbraak** (vragen) | "Inbrekers kiezen het makkelijkste huis." | Een gesloten rolluik is een extra barrière. Dubbelwandig aluminium met isolatieschuim, elektrisch te bedienen, ook via de Somfy-app. | Inbraakpreventie met rolluiken
**B3 Kleur** (vragen) | "Past bij elke gevel en kozijn" | 10 standaardkleuren zonder meerprijs, elke RAL-kleur mogelijk. Ook voor dakkapel, garage en tuinhuis. | Rolluiken in elke kleur
**B4 Solar** (vragen) | "Rolluik op zonne-energie" | Geen stroompunt bij het raam? Een Somfy solar-motor werkt zonder bekabeling en zonder elektricien, met afstandsbediening. Laadt ook op bij bewolkt weer. | Rolluiken zonder stroomaansluiting
**B5 Rolluik of screen** (vragen) | "Rolluik of screen? Wij zeggen het eerlijk." | Rolluik: 100% donker, isolatie, inbraakpreventie. Screen: daglicht en uitzicht behouden. En ja, rolluiken zijn zelfs goedkoper dan screens. Wij adviseren wat bij jouw raam past. | Eerlijk advies: rolluik of screen
**B6 Raam open** (vragen) | "Gaat mijn raam nog gewoon open?" | Meestal wel. De inmeter checkt het bij je thuis en adviseert opbouw of inbouw, wat bij jouw kozijn past. Ook eerlijk als het niet past. | Rolluik en je raam gaat gewoon open
**B7 Geluid** (vragen) | "Minder straatgeluid, beter slapen" | Een gesloten rolluik dempt verkeer en vliegtuiglawaai merkbaar en geeft volledige privacy. Stille Somfy-motor. | Rolluiken: rust en privacy
**C1 Bewijs** (warm) | "4,9 van 5 sterren. Eigen monteurs." | Meer dan 3000 klanten, 4,9 van 5 op Google met 600+ reviews. Showroom in Rijswijk. Garantie: 3 jaar montage, 5 jaar product, 7 jaar motor. | Sonty, zonwering uit eigen hand
**C2 Proces** (warm) | "Prijsindicatie vooraf, inmeten aan huis" | Zo werkt het: eerst een prijsindicatie op jouw maten. Na akkoord komt de inmeter gratis langs, daarna volgt de definitieve offerte met exacte maten. Het restbedrag betaal je pas na de montage. | Vraag je prijsindicatie aan
**C3 Garantie** (warm) | "3, 5 en 7 jaar garantie" | 3 jaar op de montage, 5 jaar op het product, 7 jaar op de Somfy-motor. Zo koop je zonder zorgen. | Rolluiken met 3, 5 en 7 jaar garantie
**Carrousel Kleur** (vragen) | 5 kaarten wit / antraciet / groen-RAL / zwart / hout-nieuwbouw | Welke kleur past bij jouw huis? 10 standaardkleuren zonder meerprijs, elke RAL-kleur mogelijk. | Kies je kleur

Alle ads: CTA "Offerte aanvragen", link https://sonty.nl/offerte-aanvragen/?utm_source=Facebook&utm_medium=paid&utm_campaign=rolluiken-najaar-2026.

## Volgende stappen
1. Daimy: akkoord op set en prijsclaim B1.
2. Concepten klaarzetten in Ads Manager (via MCP), pas live na "ja".
3. Na 7 dagen: winnaars dupliceren met tweede foto (102 rolluikfoto's beschikbaar).

## Test-stijlen (05-09, op verzoek Daimy: "bijna alles hetzelfde")
Vijf visueel andere formules om tegen de winnende kaart-formule te testen. Zelfde feiten (kennisbank-gecheckt), andere vorm. Bestanden: `lever/test-stijlen/{1x1,4x5,9x16}`, spec `stijlen.json`, bouwen met `FONTCONFIG_FILE=data/ads/fonts/fonts.conf node scripts/ad-stijlen.js`.
| Stijl | Wat het test | Ads |
|---|---|---|
| S1 Marker | Handgeschreven kop (Permanent Marker, merkfont) + pijl op full-bleed foto, "authentiek" gevoel | slaapkamer, prijs |
| S2 Donker | Zwarte brand-look met oranje accent, foto in kader, rustige statement | inbraak, winter |
| S3 Grid | 4 projectfoto's in één beeld: bewijs van variatie/kleur | kleur, overal |
| S4 Vraag & antwoord | Grote vraag + antwoordkaart, weinig foto: test of "eerlijk antwoord" beter converteert dan beeld | raam open, rolluik of screen |
| S5 Minimaal | Alleen foto + één regel, geen vinkjes/knop: test of minder tekst wint | dakkapel, geluid |
Testopzet: per adset 1 kaart-ad (controle) + 1 teststijl met dezelfde boodschap, 7 dagen, minimaal €150 per variant; winnaar op kosten per lead, niet op klikratio (Video BBQ had 5,7% CTR en €154 per lead).


## Aanvulling 05-09 (antwoorden Daimy)
- A5-korting toegevoegd: 15% actiekorting op maatwerk-zonwering (V5 akkoord). C2 noemt de korting ook.
- Showroom: binnenlopen is prima in de winter (V4); kennisbank aangepast naar openingstijden di-vr 9:30-17:00, za 9:30-16:00, afspraak aanraden bij twijfel.
