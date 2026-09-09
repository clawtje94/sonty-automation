# Geheugen Fee — Designer

## Lopende zaken
- 2026-08-30: eerste ronde gedraaid (configurator + offerte-tool). Voorstel bij Daimy: 8 knoppen
  met emoji/symbool (✓ ⬇ ✉ 🔗) verwijderen, o.a. hoofd-CTA "Akkoord & onderteken" op de
  offertepagina en 2x "Toevoegen aan aanvraag ✓" in de configurator. Wacht op akkoord.
- 2026-08-30 ad hoc (via Bram): Brein-dashboard tab Team herontwerp. Voorstel doorgezet naar Claude
  (opdracht jm1atpfn): 3 samenvattingstegels bovenaan (Nu bezig / Wacht op jou / Techniek),
  "Beslissingen die op jou wachten" naar boven + cap op 5 (nu ongecapt tot 25!), Let-op-alarmen
  (ernst midden/laag) inklappen zodat alleen ernst hoog los zichtbaar blijft. Wacht op bouw + akkoord
  Daimy. Zijstap opgemerkt (geen designfix): bramVragen-trechter faalt soms stil naar alle losse
  hoofd-vragen (page.tsx regel 320-325) — oorzaak van de 25.
- Rotatie: homepage, configurator, offerte-tool, Brein/admin, mailtemplates, social.
  Brein/admin deels al gedaan (tab Team) op 2026-08-30 door ad hoc opdracht; rest van Brein/admin
  (overige tabs) en dan verder in rotatie.
- OPGELOST (2026-08-31): de 3 oranjes zijn geen afwijking. Er is een volledig merkboek
  (~/sonty-website/docs/merkboek.html): #BF5317 = --sonty-brand (licht/wit), #F97316 = alleen op
  donkere secties (geen token, bewust), #FFCC01 "zongeel" = accent op donker (ook bewust,
  bijv. badge en cijfers 5-stappen op hero). #FF6B00 (uit CLAUDE.md) is expliciet de OUDE
  merkkleur, moet overal weg. Blad 10 van het merkboek heeft een kant-en-klare lijst "bekende
  afwijkingen" (7 punten, met exacte aantallen) — vanaf nu eerst dat blad checken voor ik zelf
  iets als afwijking meld, scheelt dubbel werk.
- 2026-08-31: homepage beoordeeld. 1 voorstel naar Daimy: wit-op-#EA580C contrast (3,56:1) in
  2 CTA-secties (offerte-banner + final CTA), fix naar #C2410C eindkleur. Dit stond al als
  bekende afwijking in merkboek blad 10 (item: wit op EA580C-gradiëntstop, 3,56:1) maar nog
  niet doorgevoerd in app/page.tsx. Wacht op akkoord Daimy.
- 2026-09-01: mailtemplates beoordeeld (~/sonty/scripts/email/bouw-templates.js). Schrijfstijl
  en alt-teksten al op orde. Wel afwijking: M.oranje = #FF6B00 (oude merkkleur) nog los in de
  mailscripts, niet gedekt door de sonty-website-telling in merkboek blad 10 (die 12x is alleen
  website-code). Voorstel: splitsen naar #BF5317 (licht/knop) en #F97316 (donkere kaarten,
  cijfers/prijs) volgens merkboekregel 09.02. Wacht op akkoord Daimy.
- 2026-09-02: rest van Brein/admin beoordeeld (dagstart, overzicht, jobs, tijdlijn, postvak
  tabs). Team-tab herontwerp van 30-08 bevestigd live (VERSIE 2026-08-30.02 in de code).
  Gevonden: postvak-tab rendert alle opdrachten (tot 100, API-cap) ongecapt als volledige
  kaarten — zelfde bug-patroon als de 25-alarmen-fout, hier nog niet gefixt. Voorstel: cap op
  15 + "alle X tonen"-knop, zelfde stijl als Beslissingen/Gesprekken op Team-tab. Wacht op
  akkoord Daimy.
- 2026-09-03: social gedaan (rotatie rond) via app/admin/linkedin/page.tsx (LinkedIn-
  postplanner). Hoofd-CTA/flow zelf goed. Gevonden: 12x hardcoded hex i.p.v. --adm-* tokens
  uit admin.css (die licht/donker al netjes omschakelen) — o.a. indigo #4338ca/#a5b4fc voor
  de "Download PDF"-knop (geen merkkleur, komt nergens anders voor), groen #16A34A (3x),
  rood #dc2626, en 5 losse lichte randkleuren. Risico: breekt in donkere modus. Voorstel
  naar Daimy: vervangen door tokens. Wacht op akkoord. Rotatie weer van voren af: homepage.
- 2026-09-04: homepage opnieuw beoordeeld. Check gedaan: geen van de 4 eerdere voorstellen
  (contrast EA580C, mail #FF6B00, Brein-postvak cap, LinkedIn-tokens) is al doorgevoerd in de
  code, allemaal nog open. Nieuw voorstel: hero heeft 3 CTA's, knop 2 "Toon het op mijn huis"
  is bijna even zwaar gestyled als de hoofdknop (concurrerende CTA's, Hick's Law) -> downgraden
  naar tekstlink-stijl zoals "Bezoek onze showroom" + pijl-icoon toevoegen. Bijvangst: het
  merkboek zelf (regel 1427-1428) noemt deze knoptekst als hét voorbeeld mét pijl, code heeft
  'm niet — dus dit is ook een boek-vs-code inconsistentie, niet alleen smaak. Wacht op akkoord.
  Ook gevraagd of Daimy de 4 losse voorstellen in één keer wil laten bouwen (voorstel: ja).

- 2026-09-07: wekelijkse bijscholing gedaan, vakkennis.md ververst (8 zoekopdrachten: vacatures
  senior product designer, mobile-first/CWV 2026, configurator-UX, Klaviyo-mail, design tokens,
  Refactoring UI, dashboard-dichtheid, WCAG-contrast). Nieuw vanaf nu: bij hardcoded-kleur-
  bevindingen expliciet "semantisch token"-taal gebruiken; bij Brein-tabs de 5-7-kernmetrics- en
  cap+toon-alles-vuistregel standaard toetsen; contrastvoorstellen altijd met exacte ratio (bv.
  3,56:1 → 4,5:1) formuleren i.p.v. "te licht".
- 2026-09-07: rotatie configurator. Emoji-knoppen (voorstel 30-08) staan nog live, regel 1204/1250
  in ProductConfigurator.tsx ("Toevoegen aan aanvraag ✓" x2) — LET OP: dit voorstel was in mijn
  telling van 04-09 per ongeluk uit de "4 eerdere"-lijst gevallen, voortaan bij elke ronde de VOLLE
  lijst open voorstellen opnieuw natellen i.p.v. vertrouwen op het vorige rapport. Nieuwe afwijking:
  .cfg-btn-primary (globals.css regel 570-580, dé hoofd-CTA door de hele configurator) heeft wit op
  gradient-eind #EA580C = 3,56:1, exact het bekende blad-10-issue maar dan op de belangrijkste knop
  i.p.v. alleen de 2 homepage-CTA's van 31-08. Fix uit merkboek: eindigen op #C2410C (4,89:1).
  7 voorstellen nu open in totaal. Rotatie verder: offerte-tool.
- 2026-09-08: rotatie offerte-tool (app/offerte/[token]/OfferteView.tsx, klant-onderteken-pagina).
  Goed nieuws: emoji-CTA-voorstel van 30-08 blijkt hier al opgelost, knop heet nu "Akkoord en
  onderteken" zonder emoji, en deze pagina gebruikt overal #BF5317 (geen EA580C-gradient), dus geen
  contrastprobleem. Alle 7 eerdere open voorstellen nagelopen in de code: nog stuk voor stuk NIET
  doorgevoerd. Nieuwe afwijking: "Download PDF"-knop (regel 370-372) heeft volle oranje vulling net
  als de hoofd-CTA, terwijl WhatsApp/mail/kopieer-knoppen ernaast wel outline-stijl hebben -> kleur
  die voor de hoofdactie gereserveerd hoort te zijn, wordt hier voor een bijzaak gebruikt. Voorstel:
  Download PDF terug naar outline-stijl (actieKnop), ORANJE alleen als icoonkleur. 8 voorstellen nu
  open totaal. Ook gevraagd: alle 8 in één keer laten bouwen. Rotatie verder: Brein/admin.
- 2026-09-09: rotatie Brein/admin (alle 6 tabs opnieuw, page.tsx). Getoetst aan 5-7-kernmetrics-regel:
  teamtegels (3), wachtrijtegels (5) — binnen norm. Postvak-cap-voorstel van 02-09 herbevestigd: regel
  277 rendert opdrachten nog steeds ongecapt als volle kaarten, niet gebouwd. Alle 8 open voorstellen
  stuk voor stuk in de code gecheckt: geen enkele doorgevoerd. Geen nieuwe afwijking gevonden. Kort
  rapport gemaakt volgens Ori-feedback (vraag = kernvraag + voorstel, geen herhaalde uitleg). Rotatie
  verder: mailtemplates.

## Leerpunten
- Toetsingslijst voor elke ronde: hoofd-CTA duidelijk? volgorde grof-naar-fijn bij keuzeflows?
  laadgevoel/whitespace? contrast/toegankelijkheid? mobiel eerst getoetst? emoji's in knoppen?
- Mailtemplates (scripts/email/) beoordelen op: één hoofdactie, alt-tekst, contrast,
  leesbaarheid klein scherm — niet alleen huisstijlkleuren. (nog niet aan toegekomen)
- Elk voorstel richting Daimy onderbouwen met verwacht effect, niet alleen esthetische reden.
- Configurator zelf is functioneel al sterk (guided flow, foutpreventie op maten, real-time
  prijs) — daar zit geen quick win meer, focus lag op knoptekst/huisstijl-consistentie i.p.v.
  structuur.
