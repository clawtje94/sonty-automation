# Geheugen Fee — Designer

## Open voorstellen (lijst bijhouden, elke ronde volledig natellen, niet op vorig rapport vertrouwen)
1. Configurator/offerte (30-08): 2x "Toevoegen aan aanvraag ✓" emoji in ProductConfigurator.tsx
   regel 1204/1250 weg. (Offerte-eigen emoji-CTA is al opgelost, zie 08-09.)
2. Brein Team-tab (30-08, ad hoc via Bram): opdracht jm1atpfn — bevestigd LIVE sinds 02-09.
3. Homepage (31-08): wit-op-#EA580C contrast 3,56:1 in offerte-banner + final CTA, fix #C2410C.
4. Mailtemplates (01-09, verscherpt 10-09): M.oranje #FF6B00 (oude merkkleur) in
   scripts/email/bouw-templates.js. Knop regel 100-102 (wit op #FF6B00 = 2,86:1, hoogste impact:
   staat in élke mail) en tekst-op-licht (regel 157 sterren, 199 garantie, 246/251 Buiten/Binnen,
   220/222/279 links) allemaal 2,86:1 → naar #BF5317 (4,70:1). Tekst-op-donker (regel 131 kaart,
   145 zwart cijferblok) → #F97316. Nog niet gebouwd.
5. Brein/admin postvak-tab (02-09): opdrachten ongecapt als volle kaarten (page.tsx regel 277),
   cap op 15 + "alle tonen"-knop zoals Team-tab.
6. Social/LinkedIn (03-09, verscherpt 11-09): 15 hardcoded kleurwaarden op 13 regels in
   linkedin/page.tsx (nageteld, was ingeschat op 12x) i.p.v. --adm-* tokens: r356 #bfdbfe→
   var(--adm-info), r358+449 #f0f0f0→var(--adm-border), r381 #e0dcff→var(--adm-border), r386
   PDF-knop #a5b4fc/#4338ca/rgb(255,255,255)→var(--adm-panel-3)/var(--adm-info)/var(--adm-on-accent),
   r418 #e8edf3→var(--adm-border), r432 #dc2626→var(--adm-bad), r450/475/484/498 #16A34A→
   var(--adm-ok), r459 #fecaca→var(--adm-bad). Reden: --adm-ok/bad/info hebben al een lichtere
   dark-mode-variant, hardcoded hex niet → knoppen breken in donkere modus. Nog niet gebouwd.
7. Homepage (04-09): hero-knop 2 "Toon het op mijn huis" te zwaar gestyled naast hoofd-CTA (Hick's
   Law) → tekstlink + pijl, sluit ook aan bij merkboek regel 1427-1428.
8. Configurator (07-09): .cfg-btn-primary (globals.css regel 570-580, hoofd-CTA hele configurator)
   wit op #EA580C-eind = 3,56:1 → #C2410C (4,89:1).
9. Offerte-tool (08-09): "Download PDF"-knop (regel 370-372) volle oranje vulling i.p.v. outline
   zoals WhatsApp/mail/kopieer ernaast → outline-stijl, oranje alleen icoon.

Status 11-09: 8 voorstellen open (nr.2 is gebouwd/live), 0 goedgekeurd, 0 van de open 8 doorgevoerd.
Herhaald gevraagd aan Daimy: alles in 1x laten bouwen door Claude.

## Rotatie
homepage → configurator → offerte-tool → Brein/admin → mailtemplates → social, dan weer homepage.
Laatste rondes: 07-09 configurator, 08-09 offerte-tool, 09-09 Brein/admin, 10-09 mailtemplates,
11-09 social.
Volgende: homepage.

## Vaste kennis (niet steeds opnieuw uitzoeken)
- Merkboek (~/sonty-website/docs/merkboek.html) is de bron van waarheid: #BF5317 = --sonty-brand
  (licht/wit), #F97316 = alleen bewust op donkere secties, #FFCC01 zongeel = accent op donker.
  #FF6B00 is overal de oude merkkleur en moet weg. Blad 10 heeft een lijst "bekende afwijkingen"
  (7 punten, sonty-website-code alleen) — eerst daar checken voor ik zelf iets meld.
- 07-09 bijscholing: vanaf nu bij hardcoded kleur expliciet "semantisch token"-taal; bij
  Brein-tabs standaard de 5-7-kernmetrics- en cap+toon-alles-regel toetsen; contrast altijd als
  exacte ratio noemen (bv. 2,86:1 → 4,5:1), niet "te licht".

## Leerpunten
- Toetsingslijst per ronde: hoofd-CTA duidelijk? grof-naar-fijn bij keuzeflows? laadgevoel/
  whitespace? contrast/toegankelijkheid? mobiel eerst? emoji's in knoppen?
- Elk voorstel onderbouwen met verwacht effect/principe, niet alleen esthetiek.
- Configurator is functioneel al sterk (guided flow, foutpreventie, real-time prijs) — quick wins
  zitten in knoptekst/huisstijl-consistentie, niet in structuur.
- Rapport kort houden (Ori-feedback 09-09): vraag = kernvraag + eigen voorstel, geen herhaalde
  uitleg van wat al in geheugen staat.
