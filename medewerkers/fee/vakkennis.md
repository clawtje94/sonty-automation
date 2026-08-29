# Vakkennis Fee — Designer (bijgewerkt 2026-08-30)

## Zo werken de besten (10-15 concrete regels, toepasbaar bij Sonty)
1. Grayscale eerst: hiërarchie bouw je met grootte, ruimte en contrast, kleur (oranje #F97316) komt pas
   als laatste laag om echt te accentueren (CTA's), niet als reddingsboei voor slechte hiërarchie.
2. Whitespace is de snelste fix: begin te ruim, snoei daarna. Te veel witruimte oogt altijd beter dan
   te weinig — check dit expliciet bij elke sectie die ik review.
3. Mobile-first is geen optie meer: ontwerp eerst voor duim en klein scherm, voeg pas daarna features toe
   voor desktop. Nooit desktop-first bedenken en "inpassen" op mobiel.
4. Eén duidelijke hoofd-CTA per scherm/sectie; concurrerende knoppen verzwakken elkaar (Hick's Law: meer
   keuzes = tragere beslissing).
5. Laadsnelheid is designwerk: elke afbeelding, font-load en animatie die de LCP/CLS raakt is een
   designbeslissing, niet alleen een dev-probleem. Streef <2s laadtijd, 3s = 53% van mobiele bezoekers weg.
6. Configuratoren (zoals die van Sonty): guided flow van grof naar fijn (eerst producttype, dan kleur,
   dan opties), real-time prijs- en visuele feedback bij elke keuze, en blokkeer ongeldige combinaties
   vóórdat de klant ze kan kiezen — geen fout pas bij checkout.
7. Consistente, herkenbare systemen verslaan losse creativiteit: vaste schaal voor spacing, type-sizes en
   schaduwen. Sonty heeft dit nodig voor homepage, configurator, mailtemplates en admin gelijk te houden.
8. Eén hoofdactie per e-mail, korte copy, sterk contrast, alt-tekst op afbeeldingen, mobile-first layout
   (>50% opens is mobiel) — dit geldt letterlijk voor de Klaviyo-achtige mails in scripts/email/.
9. Herken-niet-onthoud: gebruik bekende UI-patronen (menu rechtsboven, stappen met voortgangsindicator)
   zodat klanten niet hoeven na te denken over hoe iets werkt.
10. Toegankelijkheid is geen nice-to-have: voldoende contrast (WCAG AA), leesbare fontgroottes, focus-states
    — dit voorkomt afhakers en is ook gewoon eerlijk richting alle bezoekers.
11. Elke visuele wijziging staaf je met een principe of databron, niet met smaak alleen — dat maakt een
    voorstel bespreekbaar met een niet-designer zoals Daimy.
12. Portfolio/werk van topdesigners wordt beoordeeld op shipped resultaat (conversie, gebruik), niet op
    mooie schermen — dus koppel elk voorstel aan een verwacht effect (meer inmeetaanvragen, minder afhakers).

## Dagelijkse routine van een topper (kort, in volgorde)
1. Eén onderdeel grondig bekijken (niet alles oppervlakkig).
2. Vergelijken met laatste screenshots/versie: wat is veranderd, wat wringt nog.
3. Toetsen aan huisstijl, hiërarchie, mobiel, laadgevoel, tone of voice.
4. Eén scherp voorstel uitwerken met exacte specificatie (waarden, tekst, volgorde).
5. Effect benoemen (waarom dit conversie/leesbaarheid/consistentie verbetert).
6. Loggen in geheugen wat herhaald opvalt, zodat patronen zichtbaar worden over weken.

## Cijfers waarop de besten sturen (KPI's en normen, met bron)
- Laadtijd: streef <2s, 3s = 53% mobiele bounce (Google-onderzoek, via redrattlercreative.com 2026-guide).
- 1 seconde extra laadtijd kan conversie tot 7% verlagen (diverse 2026 CRO-bronnen, o.a. optimonk.com).
- Core Web Vitals: LCP, CLS, INP als kernmetrics voor performance-conversie-koppeling (contentsquare.com).
- Cart/formulier-afhaakpercentage en CTR per sectie als directe graadmeter van een verwarrende layout
  (contentsquare.com, optimonk.com).
- Goed uitgevoerde configuratoren kunnen conversie tot 40% verhogen; betere UX in het algemeen tot
  35,26% op grote e-commercesites (blog.prototypr.io / configurator.tech 2026).
- E-mail: >50% van de opens is mobiel — mobiele leesbaarheid is dus de norm, niet de uitzondering
  (klaviyo.com/blog/email-design-tips 2026).

## Valkuilen die de besten vermijden
- Kleur gebruiken om hiërarchie te forceren in plaats van ruimte/contrast/grootte eerst goed te zetten.
- Te veel CTA's op één scherm (verlaagt beslissnelheid, Hick's Law).
- Desktop-first ontwerpen en pas achteraf "responsive maken" — geeft altijd rommelige mobiele versie.
- Configuratorstappen tonen die tot een ongeldige combinatie kunnen leiden (fout pas bij checkout).
- Voorstellen doen zonder onderbouwing of verwacht effect — oogt als smaak, niet als vakwerk.
- E-mails met te veel concurrerende knoppen of te lage contrastwaarden, onleesbaar op klein scherm.

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Bij elke dagelijkse beoordeling expliciet checken: is er één duidelijke hoofd-CTA, en klopt de
   volgorde grof-naar-fijn (voor configurator/offerte-tool specifiek: stappen en foutpreventie vóór keuze).
2. Elk voorstel voortaan expliciet koppelen aan een verwacht meetbaar effect (bijv. "minder afhakers in
   stap X", "hogere leesbaarheid CTA") in plaats van alleen een esthetische reden.
3. Mailtemplates (scripts/email/) voortaan ook toetsen op: één hoofdactie, alt-tekst aanwezig, contrast
   en leesbaarheid op klein scherm — niet alleen op huisstijlkleuren.

## Bronnen (met URL en reden)
- https://redrattlercreative.com/web-design-standards/ — actuele 2026-normen voor laadtijd/mobile-first,
  concreet toepasbaar op sonty-website performance.
- https://blog.prototypr.io/21-best-practices-for-e-commerce-configurator-s-690668efe754 — direct
  relevant voor de Sonty-configurator (guided flow, real-time feedback, foutpreventie).
- https://www.klaviyo.com/blog/email-design-tips — praktijkbron voor mailtemplates, komt overeen met
  het Klaviyo-systeem dat Sonty gebruikt.
- https://www.sglavoie.com/posts/2023/09/09/book-summary-refactoring-ui/ — heldere samenvatting van
  Refactoring UI (Wathan/Schoger), de standaardregels voor witruimte/hiërarchie/contrast die ik dagelijks
  toepas.
- https://www.thefountaininstitute.com/blog/senior-product-designers-hired — laat zien waarop topbedrijven
  senior designers beoordelen (shipped resultaat, niet alleen mooie schermen).
