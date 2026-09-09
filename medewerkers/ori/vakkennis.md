# Vakkennis Ori — Onboarding en raamwerk (bijgewerkt 2026-09-07)

## Zo werken de besten (concreet toepasbaar bij Sonty)
1. Voor kickoff van een nieuw bedrijf: eerst feiten en doelen ophalen, dan pas een plan schrijven
   dat de eigenaar afvinkt — nooit een profiel bouwen op aannames (Onramp-gids 2026).
2. Bepaal per nieuw bedrijf het "minimum path to value": de kortste route van intake naar het
   eerste bruikbare dagrapport, en schrap elke overbodige stap of vraag daaruit.
3. Houd checklists en intake-vragenlijsten kort: 3-5 stappen ronden gemiddeld 67% af tegen 18%
   bij 10+ stappen (SaaS-onboardingdata 2026) — elke extra vraag in een intake kost afmaakkans.
4. Start elk agent-profiel zo simpel mogelijk; voeg pas een extra stap of tool toe als een simpele
   prompt aantoonbaar tekortschiet (Anthropic: "add multi-step agentic systems only when simpler
   solutions fall short").
5. Geef een agent alleen de tools die hij echt nodig heeft; te veel tools per profiel verhoogt
   hallucinatie-risico en tokenkosten (Anthropic agent-ontwerp).
6. Toon altijd het tussenliggende redeneerpad (GEDAAN/CIJFERS-kopjes) in plaats van alleen een
   eindantwoord — transparantie is een van de drie kernprincipes van agentontwerp.
7. Combineer bij het beoordelen van agent-output vaste checks (staan de kopjes er, staat er een
   bron+noemer) met een korte inhoudelijke check; geef elk criterium een eigen ja/nee-oordeel,
   nooit één totaalcijfer — geeft hogere overeenstemming tussen beoordelingsmomenten (hybride
   deterministisch + rubric, agent-eval-onderzoek 2026).
8. Betrek de mensen die het werk al doen bij het schrijven van een SOP/profiel én wijs één
   eigenaar aan die het actueel houdt; zonder eigenaar verwatert een SOP binnen een kwartaal
   (franchise/SOP-best-practice 2026).
9. Geef feedback per gedrag, niet per persoon: concreet, kort na het moment, met ruimte voor
   reactie van de medewerker zelf (Radical Candor + QA-coaching: feedback moet tweerichtings zijn).
10. Volg na coaching-feedback het effect op vaste momenten (bv. dag erna, na een week) in plaats
    van alleen te hopen dat het beklijft (contact-center-QA-les 2026).
11. Test nieuwe profielen/instructies op één proefgeval voordat je ze breed uitrolt — net als de
    Sonty-regel "eerst 1 proefgeval, dan de rest".
12. Standaardiseer bij een tweede locatie/bedrijf altijd via een sjabloon-playbook, niet ad hoc per
    geval; kleine lokale aanpassingen stapelen zich anders op tot inconsistentie.
13. Automatiseer het herhaalbare (checklists, sjablonen) en bewaar mensuren voor het unieke
    (coaching, uitzonderingen, echte beslissingen).

## Dagelijkse routine van een topper (kort, in volgorde)
1. Lees eerst wat er gisteren/vandaag al binnenkwam (rapporten, signalen) voor context.
2. Beoordeel per medewerker/profiel met de vaste mini-rubric (kopjes, cijfers+bron, echte vraag,
   lengte) — elk ja/nee, geen totaalindruk.
3. Zoek patronen over meerdere rapporten heen, niet alleen incidenten.
4. Doe een beperkt aantal concrete verbetervoorstellen (niet alles tegelijk aanpassen).
5. Geef gerichte, korte feedback aan wie dat nodig heeft; check een vaste dag later of het beklijfde
   en leeg het feedbackbestand pas dan.
6. Werk het eigen geheugen/de intake-vragenlijst bij met wat je vandaag leerde.

## Cijfers waarop de besten sturen (met bron)
- Time-to-First-Value: mediaan in SaaS circa 4 dagen, topkwart onder 5 minuten (412k-cohort 2026)
  — voor Sonty: hoe snel geeft een nieuw profiel/bedrijf zijn eerste bruikbare dagrapport.
- Onboarding completion rate: mediaan circa 65%, topkwart 85% (SaaS-benchmark 2026) — voor Sonty:
  "% nieuwe profielen dat na proefperiode zonder aanpassing blijft draaien".
- Klanten die binnen 14 dagen eerste waarde zien, retentie 80%+ na 12 maanden; na 30 dagen zonder
  waarde 35-50% (zelfde benchmark) — reden om "minimum path to value" als eerste prioriteit te zien.
- QA-coaching: volwassen programma's meten verbetering op vaste momenten (30/60/90 dagen) in plaats
  van eenmalig — voor Sonty vertaald naar "dag erna checken, niet er per ongeluk op terugkomen".
- Bij evaluatie van agent-output: consistentie tussen beoordelingsmomenten telt zwaarder dan één
  totaalcijfer; losse ja/nee-criteria per dimensie geven aantoonbaar hogere overeenstemming.

## Valkuilen die de besten vermijden
- Alles in één keer optuigen bij een nieuw bedrijf of profiel in plaats van klein beginnen en
  bewijzen dat het werkt.
- Lange intake-vragenlijsten of checklists "voor de zekerheid" — elke extra stap kost afmaakkans.
- Te veel tools/stappen aan één profiel hangen "voor de zekerheid" — verhoogt fouten en kosten.
- Feedback vaag of laat geven, alleen kritiek zonder vervolgvoorstel, of eenrichtings (medewerker
  krijgt geen kans om terug te melden wat niet lukte).
- Rubrics bedenken zonder voorbeeld, of met één totaalcijfer in plaats van losse ja/nee-criteria.
- Een SOP/profiel zonder aangewezen eigenaar laten drijven — niemand houdt hem dan actueel.
- Hoofd-naar-medewerker overdracht slordig doen zonder vastgelegde context — grootste bron van
  kennis-gaten bij onboarding.

## Wat ik hiervan vanaf morgen anders doe
1. Bij coaching-feedback (feedback/<slug>.md) één concreet gedrag + één concreet vervolgvoorstel
   noemen, en de medewerker impliciet ruimte geven om in zijn eigen rapport terug te melden of het
   lukte — niet alleen top-down opleggen.
2. De intake-vragenlijst voor een nieuw bedrijf bewust kort houden (richtlijn: hooguit 5 kernvragen
   per blok) in plaats van alles in één keer uit te vragen — sluit aan bij de 3-5-stappen-data.
3. Bij elk nieuw profiel/SOP-voorstel meteen een eigenaar benoemen (wie houdt dit actueel), niet
   pas achteraf als het al verwaterd is.

## Bronnen
- https://www.anthropic.com/engineering/building-effective-agents — Anthropic's eigen richtlijnen
  voor agentontwerp: simpel houden, transparantie, tool-testen; direct toepasbaar op profielen.
- https://onramp.us/blog/customer-onboarding-best-practices — recente onboarding-best-practices
  van een gespecialiseerd onboardingplatform, met concrete stappen voor kickoff en overdracht.
- https://www.digitalapplied.com/blog/customer-onboarding-time-to-value-2026-saas-metrics-framework
  — actuele cijfers over time-to-value en completion rate (412k-cohort), basis voor mijn KPI-sectie.
- https://www.hebbia.com/blog/evaluating-ai-agents-a-hybrid-deterministic-and-rubric-based-framework
  — hybride aanpak (vaste checks + rubric) voor het beoordelen van agent-output, past op mijn audit.
- https://kaizo.com/blog/how-to-improve-quality-assurance-call-center/ — QA-coachingpraktijk
  (continu, tweerichtings, 30/60/90-dagen opvolging), basis voor mijn coachingaanpassing.
- https://trainual.com/manual/the-5-sops-every-franchise-and-multi-location-needs — SOP-eigenaarschap
  en het risico dat kleine lokale afwijkingen zich opstapelen bij een tweede locatie.
