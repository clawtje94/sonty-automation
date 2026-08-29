# Vakkennis Ori — Onboarding en raamwerk (bijgewerkt 2026-08-29)

## Zo werken de besten (concreet toepasbaar bij Sonty)
1. Voor kickoff van een nieuw bedrijf: eerst feiten en doelen ophalen, dan pas een plan schrijven
   dat de eigenaar afvinkt — nooit een profiel bouwen op aannames (OnRamp 2025-gids).
2. Bepaal per nieuw bedrijf het "minimum path to value": de kortste route van intake naar het
   eerste bruikbare dagrapport, en schrap elke overbodige stap of vraag daaruit.
3. Start elk agent-profiel zo simpel mogelijk; voeg pas een extra stap of tool toe als een simpele
   prompt aantoonbaar tekortschiet (Anthropic: "add multi-step agentic systems only when simpler
   solutions fall short").
4. Geef een agent alleen de tools die hij echt nodig heeft; te veel tools per profiel verhoogt
   hallucinatie-risico en tokenkosten (Anthropic agent-ontwerp).
5. Toon altijd het tussenliggende redeneerpad (GEDAAN/CIJFERS-kopjes) in plaats van alleen een
   eindantwoord — transparantie is een van de drie kernprincipes van agentontwerp.
6. Schrijf elk profiel/SOP in de taal van wie het uitvoert, met alleen de stappen die nodig zijn
   voor het doel; aparte kanttekeningen (waarschuwingen, uitzonderingen) apart, niet in de hoofdstap.
7. Betrek de mensen die het werk al doen bij het schrijven van een SOP — niet alleen top-down
   vanuit het hoofdkantoor bedenken.
8. Geef feedback per gedrag, niet per persoon: concreet, kort na het moment, privé bij kritiek
   (Radical Candor — "caring personally, challenging directly").
9. Bouw evaluatiecriteria als rubric met concrete voorbeelden per dimensie, niet als vage
   kwaliteitsindruk; een aparte rubric per dimensie werkt beter dan één totaalcijfer.
10. Test nieuwe profielen/instructies op veel voorbeeldcases voordat je ze live zet (Anthropic:
    "workbench-testing" — fouten opsporen vóór uitrol, net als de regel "eerst 1 proefgeval" bij Sonty).
11. Standaardiseer bij een tweede locatie/bedrijf altijd via een sjabloon-playbook, niet ad hoc per
    geval — anders ontstaat inconsistentie tussen bedrijven (franchise-onboarding-les).
12. Automatiseer het herhaalbare (checklists, welkomstmail, sjablonen) en bewaar mensuren voor het
    unieke (coaching, uitzonderingen, beslissingen).
13. Vroege, kleine "wins" tonen in de eerste dagen van een nieuw profiel of nieuw bedrijf werken
    beter dan alles in één keer perfect willen opleveren.

## Dagelijkse routine van een topper (kort, in volgorde)
1. Lees eerst wat er gisteren/vandaag al binnenkwam (rapporten, signalen) voor context.
2. Beoordeel per medewerker/profiel kort tegen de vaste norm (kopjes, cijfers+bron, echte vragen).
3. Zoek patronen over meerdere rapporten heen, niet alleen incidenten.
4. Doe een beperkt aantal concrete verbetervoorstellen (niet alles tegelijk aanpassen).
5. Geef gerichte, korte feedback aan wie dat nodig heeft; check de dag erna of het beklijfde.
6. Werk het eigen geheugen/de intake-vragenlijst bij met wat je vandaag leerde.

## Cijfers waarop de besten sturen (met bron)
- Time-to-First-Value: hoe snel iemand (klant of nieuw bedrijf) het eerste tastbare resultaat
  ziet; hoe korter, hoe hoger de kans dat het blijft plakken (Supademo/Onramp, 2025-2026).
- Onboarding completion rate: richtwaarde 40-60% B2B als goed, >80% als robuust (Userlist-cijfer
  via Dock/Onramp) — voor Sonty vertaalbaar naar "% nieuwe profielen dat na proefperiode zonder
  aanpassing blijft draaien".
- Early-stage churn/terugval: % dat binnen de eerste periode weer afhaakt of terugvalt in oude
  fouten — dit is het signaal dat een coaching- of profielaanpassing niet beklijfde.
- Bij evaluatie van agent-output: consistentie tussen beoordelaars/momenten telt zwaarder dan één
  totaalcijfer; binaire ja/nee-criteria geven aantoonbaar hogere overeenstemming dan een schaal
  (LLM-eval-onderzoek, Twine/arXiv).

## Valkuilen die de besten vermijden
- Alles in één keer optuigen bij een nieuw bedrijf of profiel in plaats van klein beginnen en
  bewijzen dat het werkt.
- Onboarding-metrics los van elkaar bekijken in plaats van als keten (een trage stap vertraagt alles
  erna).
- Te veel tools/stappen aan één profiel hangen "voor de zekerheid" — verhoogt fouten en kosten.
- Feedback vaag of laat geven, of alleen kritiek zonder concreet vervolgvoorstel.
- Rubrics/normen bedenken zonder voorbeeld erbij — dat geeft inconsistente beoordeling.
- Sales-naar-uitvoering (of hoofd-naar-medewerker) overdracht slordig doen, zonder vastgelegde
  context — grootste bron van kennis-gaten bij onboarding.

## Wat ik hiervan vanaf morgen anders doe
1. Bij coaching-feedback (feedback/<slug>.md) altijd één concreet gedrag + één concreet
   vervolgvoorstel noemen, nooit een algemene opmerking — conform Radical Candor-specificiteit.
2. Bij mijn eigen dagelijkse audit een vaste mini-rubric per rapport aanhouden (kopjes/cijfers+bron/
   echte vraag/lengte, elk ja-nee) in plaats van een totaalindruk — geeft consistentere beoordeling
   dag na dag.
3. De intake-vragenlijst voor een nieuw bedrijf opbouwen rond "minimum path to value": eerst welke
   ene dagelijkse output het bedrijf per se nodig heeft, pas daarna de rest uitbreiden.

## Bronnen
- https://www.anthropic.com/engineering/building-effective-agents — Anthropic's eigen richtlijnen
  voor agentontwerp: simpel houden, transparantie, tool-testen; direct toepasbaar op profielen.
- https://onramp.us/blog/customer-onboarding-best-practices — recente (2025-2026) onboarding-
  best-practices en KPI's van een gespecialiseerd onboarding-platform, met concrete cijfers.
- https://www.radicalcandor.com/our-approach — Kim Scott's feedbackframework, basis voor mijn
  coaching-taak (feedbackbestanden per medewerker).
- https://www.twine.net/blog/how-to-write-an-llm-evaluation-rubric/ — hoe je een rubric voor
  AI-output bouwt die consistent te beoordelen is, relevant voor kwaliteitscontrole van agents.
- https://scribe.com/library/sop-best-practices — praktische regels voor het schrijven van SOP's
  die mensen ook echt volgen, relevant voor profielen.md en BEDRIJF.md.
