# Vakkennis Kai — AI-innovatie en R&D (bijgewerkt 2026-09-07)

## Zo werken de besten (toepasbaar in mijn dagelijkse dienst)
1. Kies per pilot één proces dat vaak voorkomt, repeterend is en nu frictie geeft (tijdverlies/fouten) — dat is mijn toets voor elke kans op de lijst.
2. Pilot klein en kort: 1-2 weken bij Sonty, branche-norm 4-8 weken voor MKB, daarna pas opschalen.
3. Reserveer aandacht voor training/uitleg naast de tooling zelf; norm is 20-30% van het AI-budget.
4. Meet ROI per smalle, scherp afgebakende use case; brede beloftes ("AI voor alles") leveren zelden aantoonbare winst op.
5. Klantenservice en planning zijn de snelste terugverdieners (maanden, geen jaren) — daar eerst kijken bij nieuwe kansen voor Sunny/Nanny.
6. Context engineering: geef een agent de kleinst mogelijke set high-signal tokens, niet alles wat beschikbaar is; just-in-time ophalen ipv alles vooraf proppen.
7. Elke medewerker-agent (zoals elke subagent) krijgt precies één job en scherp afgebakende tools zonder overlap; overlap geeft verkeerde keuzes.
8. Nieuw: kies het model per taak, niet één model voor alles. Eenvoudige/repetitieve klussen (samenvatten, filteren) op een goedkoper model, complexe beslissingen (contracten, klantimpact) op het duurdere model — dit is een directe kostenknop voor het Brein naast dagelijkse prijs-checks.
9. Nieuw: bouw eerst één gespecialiseerde agent/taak, meet hoe vaak en waarvoor die nodig is, voeg pas een tweede toe als er een duidelijk herhalend patroon is — niet vooraf een hele reeks agents optuigen.
10. Bij lange taken: laat een agent samenvatten/aantekeningen maken (compaction/memory) ipv context laten volstromen.
11. Architectuur (hoe info verwerkt wordt) bepaalt kosten meer dan het modelprijskaartje; slecht ontworpen flows kunnen 3-10x duurder zijn per beslissing.
12. Ken de kanaalregels: WhatsApp Business staat sinds 15-1-2026 geen general-purpose chatbots meer toe, wel taakgerichte AI — direct relevant voor Sunny.
13. Hybride AI+mens scoort even goed als volledig mens (4,25 vs 4,3 CSAT); AI ondersteunt, vervangt niet — zeker bij NL-klanten die weinig vertrouwen hebben in chatbots.
14. Elke kans op de lijst krijgt een status (idee/voorstel/pilot/gemeten/uitgerold) én een cijfer; zonder cijfer is het ruis — geldt ook voor cijfers die ik online vind (enterprise-bronnen missen vaak een MKB-cijfer, dat meld ik dan als "bron ontbreekt").

## Dagelijkse routine van een topper
1. Scan gericht een beperkt aantal bronnen (modellen, prijzen, agent-frameworks, branche) — niet alles lezen.
2. Lees eerst intern: waar loopt het team vast (foutmeldingen, handwerk, 429's)? Beste bron voor kansen.
3. Kies max 1 signaal per dag, werk het uit tot kans met kosten/opbrengst/pilotplan.
4. Check de eigen AI-kosten (tokens/euro's, welk model waarvoor) voor je iets nieuws voorstelt.
5. Rapporteer kort met cijfers, vraag alleen als er echt een beslissing nodig is.

## Cijfers waarop de besten sturen
- Pilot 4-8 weken, totale roadmap 90 dagen voor MKB 10-250 medewerkers (bron: werkenmetai.nl, AI-implementatieroadmap 2026).
- 20-30% van AI-budget naar training/change management (bron: stratalytic.nl, gratis AI-pilot MKB 2026).
- WhatsApp/klantenservice AI: implementatie €1.500-€15.000, doorlopend €200-600/mnd, payback 2-4 maanden (bron: voicelabs.nl, AI-telefonie MKB 2026).
- Slechts ~23% van organisaties haalt aantoonbare ROI uit AI-agents; vooral bij smalle, meetbare use cases (bron: onereach.ai, Agentic AI stats 2026).
- Hybride AI+mens CSAT 4,25/5 vs volledig mens 4,3/5; slechts 12% NL-consumenten vindt chatbots goed antwoorden (bron: theaidaily.nl, AI-klantenservice statistieken 2026).
- Enterprise-cijfers zoals "gemiddeld 171% ROI" en "25-40% kostenreductie in 90 dagen" (bron: ctlabs.ai, AI Agents ROI Case Studies 2026, obv Klarna/JPMorgan) zijn NIET zomaar op Sonty toepasbaar: dit zijn grote bedrijven met eigen datateams. Voor MKB geldt: eigen baseline meten, geen enterprise-cijfer overnemen.
- Installatiebranche (vergelijkbaar MKB-domein) noemt AI-offertes, kennisbank en verkoop-binnendienstbot als "quick wins" maar zonder concreet kosten/resultaatcijfer (bron: acto.nl, AI in de installatiebranche 2026) — bevestigt: geen kans overnemen zonder eigen meting.

## Valkuilen die de besten vermijden
- Breed uitrollen zonder pilot en zonder meetbare baseline.
- Alles vooraf in de contextprompt proppen ipv just-in-time ophalen ("context rot", lagere kwaliteit).
- Chatbot volledig laten overnemen ipv hybride met mens, terwijl NL-klanten weinig vertrouwen hebben in chatbots.
- Kanaalregels negeren (bv. WhatsApp-verbod op general-purpose chatbots sinds jan 2026).
- Modelprijs als enige kostenmaatstaf nemen, terwijl architectuur/flow de echte kostenveroorzaker is; ook: overal hetzelfde (dure) model gebruiken terwijl een goedkoper model voor eenvoudige stappen volstaat.
- Enterprise-caseshowcases (Klarna, JPMorgan) of branche-quickwin-lijstjes zonder cijfer klakkeloos als bewijs gebruiken voor een MKB-bedrijf als Sonty.

## Wat ik hiervan vanaf morgen anders doe
1. Ik toets elke nieuwe kans op: gebeurt het vaak, is het repeterend, geeft het nu frictie — anders komt het niet op de lijst.
2. Bij elke kostenkans voor het Brein kijk ik voortaan ook naar "welk model past bij deze taak" (goedkoop voor simpel, duurder alleen waar nodig), niet alleen naar de lijstprijs van één model.
3. Ik vraag bij elke pilot een concreet baseline-cijfer (uren, fouten, conversie) vooraf, en vermeld expliciet als een gevonden cijfer enterprise/buitenlands is en dus niet 1-op-1 voor Sonty geldt.

## Bronnen
- https://www.tembo.io/blog/claude-code-subagents — bevestigt: één specialist-agent per taak, model kiezen per zwaarte (Haiku/Sonnet/Opus), pas opschalen bij bewezen patroon; direct toepasbaar op het Brein.
- https://www.acto.nl/actueel/ai-in-de-installatiebranche-van-quick-win-tot-toekomstvisie/ — vergelijkbare MKB-branche, laat zien dat quick-win-lijstjes vaak geen cijfer hebben, dus zelf meten blijft nodig.
- https://onereach.ai/blog/agentic-ai-adoption-rates-roi-market-trends/ — ROI-cijfers agentic AI 2026, smalle use cases scoren beter.
- https://theaidaily.nl/statistieken/ai-klantenservice-statistieken-2026/ — CSAT hybride vs mens, chatbot-vertrouwen NL.
- https://www.managementboek.nl/boek/9789024474264/doeltreffend-met-ai-agents-joop-snijder — NL-boek: eerst denken, dan klein experimenteren, dan pas opschalen; AI inzetten voor acties (agents) i.p.v. alleen tekst.
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — canonieke bron hoe agents (Sunny/Nanny/ikzelf) goedkoper en beter werken.
