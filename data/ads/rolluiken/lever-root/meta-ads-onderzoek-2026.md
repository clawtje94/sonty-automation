# Social ads: onderzoek, zelfbeoordeling en verbeteringen (05-09-2026)

## Wat het onderzoek zegt (3 bronnen + Meta Ads Library NL)
1. **Creatief bepaalt meer dan targeting.** Meta's rankingsysteem (Andromeda) beloont creatieve variatie; 9:16 verticale video is hét prioriteitsformaat voor 2026. Advantage+ leads-campagnes geven gemiddeld ~10% lagere kosten per gekwalificeerde lead. (adamigo.ai benchmarks, madgicx Advantage+ review)
2. **Video: 15-30 s voor Reels/Stories, hook in de eerste 3 seconden, 85% kijkt zonder geluid** dus tekst in beeld is verplicht. 9:16 video met geluid heeft ~34% lagere CPA dan een statisch beeld op Reels. Voor woningverbetering verslaan "echte" beelden van de monteur op locatie en klant-testimonials de gelikte studio-ad in 9 van de 10 accounts. (adlibrary.com Creative Field Guide, builtrightdigital remodeler-guide, coinis first-3-seconds)
3. **Statisch eerst testen, dan video van de winnaar.** Statische ads winnen bij directe duidelijkheid en geluid-uit; test 3-4 hoeken als statisch, bouw video rond de winnaar. (kalungi, attnagency)
4. **Click-to-WhatsApp (CTWA):** Forrester-studie in opdracht van Meta: tot 94% hogere conversie en 92% lagere kosten per lead dan landingspagina-campagnes, mits reactie binnen ~30 s en opvolging binnen 72 uur. Lokale dienstverleners rapporteren 37% lagere kosten per gekwalificeerde lead met WhatsApp-voorkwalificatie. (egrow, asisteclick, spurnow)
5. **Leadformulier met kwalificatievragen** (huiseigenaar, product, gewenste startdatum) verhoogt de kosten per lead iets, maar filtert huurders en prijsvragers vóór het salesteam tijd investeert. (builtrightdigital)
6. **Benchmarks:** home services €30-50 per lead op Meta; Sonty's eigen historie: €43-50 per lead bij de beste ads, €73 bij de duurste video. Break-even winter Meta €46 (CPA-memo).
7. **Ads Library NL, categorie rolluiken/zonwering (465 actieve ads):** dezelfde hoeken als bij ons komen terug: "wat kosten rolluiken voor jouw woning", "rolluiken zijn niet alleen voor de zomer", "profiteer er het hele jaar van", aanbiedingen (gratis solarmotor, kortingspercentages), opsommingen (zonwerend, isolerend, geluidwerend, inbraakpreventief). Veel accounts draaien vooral vacature-ads. Onderscheid voor Sonty: echte projectfoto's, eerlijke prijs uit de eigen prijsmotor, showroom, 600+ reviews, en direct antwoord via WhatsApp (Sunny).

## Eerlijke zelfbeoordeling van de set tot nu toe
Goed: gebouwd op de bewezen kaart-formule (€43/lead), echte foto's, claims uit de kennisbank, 5 teststijlen, alle formaten, 3 fases per product, data-onderbouwde productkeuze (rolluik, knikarm, showroom).
Wat ontbrak vóór dit onderzoek: (a) te weinig video en geen hook in de eerste 3 seconden; de bestaande video's toonden meteen de kaart; (b) geen click-to-WhatsApp-variant terwijl Sunny al live op WhatsApp antwoordt; (c) geen leadformulier-variant met kwalificatievragen; (d) geen monteur-op-locatie-beelden ingezet, terwijl die er zijn (montage-video's); (e) geen expliciete meetregel voor hook-rate en thumbstop.

## Wat er nu bij is gebouwd
- **Video's met hook (0-3 s) + kaart (vanaf 3 s), 9:16 en 1:1** via `scripts/ad-video.js` + `scripts/ad-hook.js`:
  rolluiken R1 slaapkamer, R2 winter (video-v2); knikarm K1 montage (monteur op locatie), K2 prijs, K8 eigen monteurs; showroom W1 fotoslideshow met langzame zoom.
- **Click-to-WhatsApp-varianten** (onderbalk "App ons op WhatsApp") van de top-ads per product: rolluiken A1/B1/A5, knikarm K1/K2, showroom W1/W3, in 3 formaten (`lever/whatsapp-variant/`).
- Kennisbank showroom-regel bijgewerkt (binnenlopen kan), rolluikprijs live bevestigd op Sunny's prijs-API.

## Aanbevolen campagne-opzet (test in 3 sporen, per product)
| Spoor | Doel | CTA | Waarom |
|---|---|---|---|
| A Landingspagina | Leads (Bedankt Offerte) | Offerte aanvragen | Bewezen bij Sonty, vergelijkbaar met historie |
| B Click-to-WhatsApp | Berichten (WhatsApp) | App ons | Sunny antwoordt direct met prijsindicatie; onderzoek: laagste kosten per lead. Voorwaarde: antwoord < 1 minuut, ook 's avonds (Sunny) |
| C Instant leadformulier | Leads (formulier) | Prijsindicatie aanvragen | Kwalificatievragen: huiseigenaar, product, maat, gewenste periode; lead direct naar RP/Sunny |
Per spoor dezelfde 2 winnende ads (statisch) + 1 video. Budget 7 dagen minimaal €150 per spoor. Beoordelen op kosten per akkoord (sheet, kanaal + afkomst), niet op klikratio. Hook-rate video >30% (3-seconden-weergaven / impressies), anders hook vervangen.

## Volgende stappen
1. Daimy: akkoord op de 3 sporen en op CTWA (WhatsApp-nummer 085 006 9681 als bedrijfsnummer in Meta).
2. Concepten klaarzetten in Ads Manager (niets live zonder ja).
3. Na 7 dagen: winnaars dupliceren met tweede foto/hook; verliezers uit.
4. Screens-set als volgend product (winteromzet nr. 3).

Bronnen: leadsbridge.com/blog/meta-ads-best-practices · adlibrary.com/posts/meta-ads-creative-best-practices · builtrightdigital.com/remodeler-meta-ads-tips · coinis.com/how-to/first-3-seconds-facebook-video-ad · adamigo.ai/blog/meta-ads-benchmarks-2026-by-objective-and-placement · madgicx.com/blog/meta-advantage-plus-review · egrow.com click-to-whatsapp guide 2026 · asisteclick.com CTWA 2026 · Meta Ads Library (NL, "rolluiken", "zonwering showroom", 05-09-2026)
