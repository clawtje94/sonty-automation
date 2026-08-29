# Vakkennis Kai — AI-innovatie en R&D (bijgewerkt 2026-08-29)

## Zo werken de besten (toepasbaar in mijn dagelijkse dienst)
1. Kies per pilot één proces dat vaak voorkomt, repeterend is en nu frictie geeft (tijdverlies/fouten) — dat is mijn toets voor elke kans op de lijst.
2. Pilot klein en kort: 1-2 weken bij Sonty, branche-norm 4-8 weken voor MKB, daarna pas opschalen.
3. Reserveer aandacht voor training/uitleg naast de tooling zelf; norm is 20-30% van het AI-budget.
4. Meet ROI per smalle, scherp afgebakende use case; brede beloftes ("AI voor alles") leveren zelden aantoonbare winst op.
5. Klantenservice en planning zijn de snelste terugverdieners (maanden, geen jaren) — daar eerst kijken bij nieuwe kansen voor Sunny/Nanny.
6. Context engineering: geef een agent de kleinst mogelijke set high-signal tokens, niet alles wat beschikbaar is.
7. Tools/taken van een agent moeten scherp afgebakend zijn zonder overlap; overlap geeft verkeerde keuzes.
8. Haal info just-in-time op via tools ipv alles vooraf in de prompt proppen; bespaart tokens, houdt kwaliteit hoog.
9. Bij lange taken: laat een agent samenvatten/aantekeningen maken (compaction/memory) ipv context laten volstromen.
10. Architectuur (hoe info verwerkt wordt) bepaalt kosten meer dan het modelprijskaartje; slecht ontworpen flows kunnen 3-10x duurder zijn per beslissing.
11. Ken de kanaalregels: WhatsApp Business staat sinds 15-1-2026 geen general-purpose chatbots meer toe, wel taakgerichte AI (bestellingen, afspraken, klantenservice) — direct relevant voor Sunny.
12. Hybride AI+mens scoort even goed als volledig mens (4,25 vs 4,3 CSAT); AI ondersteunt, vervangt niet — zeker bij NL-klanten die weinig vertrouwen hebben in chatbots.
13. Volg modelprijzen van de grote labs wekelijks; een nieuwe generatie maakt het Brein ongemerkt goedkoper of duurder.
14. Elke kans op de lijst krijgt een status (idee/voorstel/pilot/gemeten/uitgerold) én een cijfer; zonder cijfer is het ruis.

## Dagelijkse routine van een topper
1. Scan gericht een beperkt aantal bronnen (modellen, prijzen, agent-frameworks, branche) — niet alles lezen.
2. Lees eerst intern: waar loopt het team vast (foutmeldingen, handwerk, 429's)? Beste bron voor kansen.
3. Kies max 1 signaal per dag, werk het uit tot kans met kosten/opbrengst/pilotplan.
4. Check de eigen AI-kosten (tokens/euro's) voor je iets nieuws voorstelt.
5. Rapporteer kort met cijfers, vraag alleen als er echt een beslissing nodig is.

## Cijfers waarop de besten sturen
- Pilot 4-8 weken, totale roadmap 90 dagen voor MKB 10-250 medewerkers (bron: werkenmetai.nl, AI-implementatieroadmap 2026).
- 20-30% van AI-budget naar training/change management (bron: stratalytic.nl, gratis AI-pilot MKB 2026).
- WhatsApp/klantenservice AI: implementatie €1.500-€15.000, doorlopend €200-600/mnd, payback 2-4 maanden (bron: voicelabs.nl, AI-telefonie MKB 2026).
- Slechts ~23% van organisaties haalt aantoonbare ROI uit AI-agents; vooral bij smalle, meetbare use cases (bron: onereach.ai, Agentic AI stats 2026).
- Hybride AI+mens CSAT 4,25/5 vs volledig mens 4,3/5; slechts 12% NL-consumenten vindt chatbots goed antwoorden (bron: theaidaily.nl, AI-klantenservice statistieken 2026).
- Architectuurkeuze kan kosten per beslissing 3-10x laten verschillen bij gelijk modelprijskaartje (bron: McKinsey, "Measuring agentic AI ROI beyond token costs", 2026).

## Valkuilen die de besten vermijden
- Breed uitrollen zonder pilot en zonder meetbare baseline.
- Alles vooraf in de contextprompt proppen ipv just-in-time ophalen ("context rot", lagere kwaliteit).
- Chatbot volledig laten overnemen ipv hybride met mens, terwijl NL-klanten weinig vertrouwen hebben in chatbots.
- Kanaalregels negeren (bv. WhatsApp-verbod op general-purpose chatbots sinds jan 2026).
- Modelprijs als enige kostenmaatstaf nemen, terwijl architectuur/flow de echte kostenveroorzaker is.

## Wat ik hiervan vanaf morgen anders doe
1. Ik toets elke nieuwe kans op: gebeurt het vaak, is het repeterend, geeft het nu frictie — anders komt het niet op de lijst.
2. Ik check bij elke WhatsApp/Sunny-kans expliciet of die taakgericht is (mag) of general-purpose (mag niet sinds 15-1-2026).
3. Ik vraag bij elke pilot een concreet baseline-cijfer (uren, fouten, conversie) vooraf, zodat ik na een week echt kan meten.

## Bronnen
- https://werkenmetai.nl/blog/ai-implementatie-roadmap-eerste-90-dagen — 90-dagen pilotritme NL MKB, direct toepasbaar op mijn pilotplannen.
- https://stratalytic.nl/blog/gratis-ai-pilot-mkb — tijdsinvestering en budgetverdeling (20-30% training) van een AI-pilot.
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — canonieke bron hoe agents (Sunny/Nanny/ikzelf) goedkoper en beter werken.
- https://www.voicelabs.nl/nieuws/ai-telefonie-voor-mkb-waarom-84-investeert-maar-76-faalt-2026-w18 — waarom AI-telefonie/klantenservice pilots vaak falen, met NL-cijfers.
- https://theaidaily.nl/statistieken/ai-klantenservice-statistieken-2026/ — CSAT hybride vs mens, chatbot-vertrouwen NL.
- https://onereach.ai/blog/agentic-ai-adoption-rates-roi-market-trends/ — ROI-cijfers agentic AI 2026, smalle use cases scoren beter.
