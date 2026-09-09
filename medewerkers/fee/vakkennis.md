# Vakkennis Fee — Designer (bijgewerkt 2026-09-07)

## Zo werken de besten (10-15 concrete regels, elk toepasbaar in jouw dagelijkse dienst bij Sonty)
1. Kleur komt pas als laatste laag; hiërarchie bouw je eerst met grootte, ruimte en vorm (Refactoring
   UI: "designing without color first forces hierarchy from form, size, spacing").
2. Spacing/type-schaal is een vast, beperkt setje waarden (design tokens), nooit losse pixelwaarden
   per scherm — geldt voor homepage, configurator, Brein/admin en mails gelijk.
3. Mobile-first is de norm, niet de uitzondering: >65% verkeer is mobiel in 2026, dus eerst duim en
   klein scherm ontwerpen, dan pas desktop toevoegen.
4. Performance-vloer 2026: LCP <2,5s, INP <200ms, CLS <0,1 (mid-range Android, getemperd 3G) — elke
   afbeelding/animatie die dit raakt is een designbeslissing.
5. Elk extra formulierveld verlaagt de completion rate: alleen vragen wat je op dat moment echt nodig
   hebt, rest via progressive disclosure later (relevant voor offerte-tool/configurator-stappen).
6. Configuratoren: guided flow grof-naar-fijn, real-time prijs/visuele feedback, ongeldige combinaties
   blokkeren vóór de klant ze kan kiezen — nooit pas bij checkout een fout tonen.
7. Eén hoofd-CTA per scherm; concurrerende knoppen vertragen de beslissing (Hick's Law).
8. Dashboards/admin: niet minder informatie, maar dichtheid met duidelijkheid — hiërarchie, progressive
   disclosure, max 5-7 kernmetrics per hoofdscherm, rest naar een detailweergave (precies de aanpak die
   Fee al toepast bij Brein: cap + "toon alles").
9. Design tokens zijn semantisch (rol, niet uiterlijk): licht/donker-varianten via dezelfde naam, dat
   voorkomt precies het soort hardcoded-hex-drift dat Fee eerder vond in de LinkedIn-planner.
10. E-mail 2026: >50% opens mobiel, min. 16px lopende tekst, CTA-knop min. 44px hoog en (bijna) full-
    width op mobiel, regellengte max ~60 tekens, ruime witruimte tussen secties.
11. Contrast is de meest voorkomende toegankelijkheidsfout (>80% van audits): WCAG AA = 4,5:1 voor
    normale tekst, 3:1 voor grote tekst en UI-componenten — altijd checken, niet aannemen.
12. Elke wijziging staaf je met een principe of cijfer, niet met smaak — zo is een voorstel
    bespreekbaar met een niet-designer zoals Daimy.
13. Senior product designers worden in 2026-vacatures beoordeeld op implementatie-klare specs en
    analytics-onderbouwde keuzes, niet op mooie schermen alleen (Built In-vacatureteksten).
14. Constraint-based design: goed ontwerp is weglaten en beperken, niet toevoegen en vrijheid geven.

## Dagelijkse routine van een topper (kort, in volgorde)
1. Eén onderdeel grondig bekijken (niet alles oppervlakkig).
2. Vergelijken met laatste screenshots/versie: wat is veranderd, wat wringt nog.
3. Toetsen aan huisstijl, hiërarchie, mobiel, laadgevoel, contrast, tone of voice.
4. Eén scherp voorstel uitwerken met exacte specificatie (waarden, tekst, volgorde).
5. Effect benoemen (waarom dit conversie/leesbaarheid/consistentie verbetert), liefst met cijfer.
6. Loggen in geheugen wat herhaald opvalt, zodat patronen zichtbaar worden over weken.

## Cijfers waarop de besten sturen (KPI's en normen, met bron)
- LCP <2,5s, INP <200ms, CLS <0,1 als 2026-vloer; 3s laadtijd = 53% mobiele bounce (redrattlercreative.com).
- 100ms extra vertraging kan conversie tot 7% laten dalen (salsita.ai, 2026 e-commerce configurator guide).
- Configuratoren met goede UX: tot 40% hogere conversie t.o.v. geen configurator (blog.prototypr.io).
- E-mail: >50% van de opens mobiel, CTA-knop min. 44px tapgebied (klaviyo.com/blog/email-design-tips).
- WCAG AA contrast: 4,5:1 tekst, 3:1 grote tekst/UI-componenten; contrastfouten in >80% van audits
  (webability.io / lollypop.design 2026 WCAG-gidsen).
- Dashboards: max 5-7 kernmetrics op het hoofdscherm, rest naar deep-dive (uxpin.com dashboard-guide 2026).

## Valkuilen die de besten vermijden
- Kleur gebruiken om hiërarchie te forceren i.p.v. eerst ruimte/contrast/grootte goed te zetten.
- Te veel CTA's op één scherm (Hick's Law: meer keuzes = tragere beslissing).
- Desktop-first ontwerpen en achteraf "responsive maken" — geeft altijd rommelige mobiele versie.
- Configuratorstappen die tot een ongeldige combinatie leiden, fout pas zichtbaar bij checkout.
- Losse hardcoded kleurwaarden i.p.v. semantische tokens — breekt onopgemerkt in donkere modus.
- Dashboards die alles ongecapt tonen ("wall of numbers") i.p.v. hiërarchie + progressive disclosure.
- Voorstellen zonder onderbouwing of verwacht effect — oogt als smaak, niet als vakwerk.

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Bij elk voorstel voortaan expliciet checken of het een semantisch token-probleem is (licht/donker-
   variant) i.p.v. alleen "verkeerde kleur" — dat verklaart en voorkomt herhaling (zie LinkedIn-bevinding).
2. Bij dashboards/lijsten (Brein-tabs) voortaan standaard toetsen aan de 5-7-kernmetrics-vuistregel en
   "cap + toon alles"-patroon, ook buiten de tabs waar ik dit al meldde.
3. Contrastcijfers voortaan altijd expliciet als ratio noemen in het voorstel (bv. "3,56:1 → moet 4,5:1"),
   niet alleen "te licht" — sluit beter aan bij hoe WCAG-audits worden beoordeeld.

## Bronnen (met URL en reden)
- https://redrattlercreative.com/web-design-standards/ — 2026-normen laadtijd/mobile-first/CWV, direct
  toepasbaar op sonty-website performance.
- https://www.klaviyo.com/blog/email-design-tips — praktijkbron mailtemplates, zelfde systeem als Sonty
  (scripts/email/) gebruikt.
- https://salsita.ai/blog/best-product-configurators-for-ecommerce — recente configurator-UX-cijfers en
  regels, direct relevant voor de Sonty-configurator.
- https://www.uxpin.com/studio/blog/dashboard-design-principles/ — dashboard-dichtheid en kernmetrics-
  regel, toepasbaar op Brein/admin-tabs.
- https://www.webability.io/blog/color-contrast-for-accessibility — actuele WCAG-contrastratio's en
  hoe vaak dit misgaat, basis voor mijn contrast-voorstellen.
- https://builtin.com/jobs/design-ux/search/senior-product-designer — laat zien waar 2026-vacatures
  senior product designers op beoordelen (implementatie-klare specs, analytics-onderbouwing).
