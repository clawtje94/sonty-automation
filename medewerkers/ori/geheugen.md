# Ori — geheugen

## Brein-audit 29-08-2026 (eerste grote audit, opdracht van Daimy)
- Kern-bug: Team-tab/dagstart telt ALLE V-nummers van Bram als "wacht op Daimy", ook de nog
  niet verstuurde (page.tsx r.283-291 filtert alleen op /V\d+/, niet op status). Bram zelf
  scheidt netjes "verstuurd" vs "wachtrij" in zijn tekst maar de UI negeert dat. Volgen of dit
  is opgelost — dan pas checken of "beslissingen die op jou wachten" een eerlijk getal geeft.
- data/brein/briefings/ was leeg terwijl Bram claimde te hebben verstuurd. brein-telegram.js
  schrijft dat bestand stil (best-effort try/catch). Dit is een terugkerend patroon om op te
  letten: claims in GEDAAN zonder bestand-bewijs zijn een risico bij ALLE medewerkers, niet
  alleen Bram. Bij volgende audit: steekproef nemen op "GEDAAN zegt X, bestaat het bestand?".
- ORGANISATIE.md is handmatig bijgehouden en loopt los van de profielen (Bo mist erin). Zou
  automatisch gegenereerd moeten worden uit profiel-frontmatter (rapporteertAan/afdeling).
- Jobs kunnen dubbel in meerdere profielen staan (reviews-sync: Bo+Jules+Yara). Bij nieuwe
  profielen altijd even grep'en of een job al bij iemand anders in de lijst staat.
- Bo (Brand/Media) heeft nog nooit gedraaid: geen audit, geen dagrapport, geen entry in
  medewerkers.json. Navragen bij Mats of dit klopt of een scheduler-gat is.
- BEDRIJF.md is niet gesplitst in generiek (motor) vs Sonty-specifiek — belangrijk punt voor
  de intake-vragenlijst van een tweede bedrijf: die scheiding moet er bij bedrijf 2 vanaf dag 1
  in zitten, niet achteraf uitgeplozen worden.
- Mijn profiel zegt max 3 voorstellen/dag; bij een expliciete audit-opdracht van Daimy heb ik
  er 6 gegeven (met vraag of dat mag). Wachten op zijn antwoord voor de volgende keer.

## Bijscholing 29-08-2026
- vakkennis.md aangemaakt (was er nog niet): 10 web-bronnen gelezen (Anthropic agent-ontwerp,
  onboarding-KPI's, SOP-schrijven, Radical Candor, LLM-eval-rubrics, franchise-playbooks).
- Belangrijkste les voor mezelf: "minimum path to value" — bij intake nieuw bedrijf eerst de ene
  output bepalen die per se nodig is, pas daarna uitbreiden. Ga ik verwerken in de
  intake-vragenlijst hieronder.
- Tweede les: mijn dagelijkse audit moet een vaste mini-rubric zijn (kopjes/cijfers+bron/echte
  vraag/lengte, elk ja-nee) in plaats van totaalindruk — consistenter dag op dag.
- Radical Candor-format overnemen in mijn feedback/<slug>.md: concreet gedrag + concreet
  vervolgvoorstel, geen algemene opmerking.

## Intake-vragenlijst nieuw bedrijf (nog op te bouwen, begin)
- Feiten: wie is eigenaar/beslisser, wie zit op de vloer (mens), team-plafond/capaciteitsgetal.
- Klantproces: stappen van aanvraag tot nazorg, welke systemen per stap (CRM, planning, boekhouding).
- Dagelijkse cijfers die de baas wil zien, met bron per cijfer (nooit schatten).
- Huisregels: wat mag nooit (namen concurrenten, verzonnen cijfers, prijzen aanpassen, etc).
- Rollen: piramide met hoofden + medewerkers, wie rapporteert aan wie — DIRECT als gegenereerde
  tabel/tekening uit profielen, niet met de hand (les van vandaag).
- BEDRIJF.md-sjabloon vanaf het begin in twee blokken: generiek (rapportvorm/werkwijze) en
  bedrijfsfeiten (huisregels), zodat overdracht naar de klant makkelijk blijft.
