# Geheugen Kai

## Kansenlijst (status: idee/voorstel/pilot/gemeten/uitgerold/afgewezen)
- WhatsApp service-message-kosten per 1-10-2026 (voorstel, nieuw 2026-09-04): Meta laat vanaf
  1 okt 2026 "service messages" (antwoorden binnen 24u-venster, nu gratis) betalen tegen
  utility-tarief per land. Bevestigd via help.trengo.com en developers.facebook.com. Raakt Sunny
  direct (elke WhatsApp-reactie via Trengo). NL-tarief nog onbekend bij scan (bron ontbreekt).
  Voorstel bij Daimy 4-9: Mats vraagt tarief op bij Trengo, telt Sunny's service-berichten/dag,
  zodat kosten voor 1-10 bekend zijn. Geen pilot nodig, gewoon een kostenwaarschuwing met deadline.
- Trengo polling naar webhooks (voorstel, 2026-08-29, dag 14, bijgewerkt 11-9): technische
  blokkade (itf2311c) al sinds 9-9 opgelost. Vrijdagvoorstel 11-9 aan Daimy voorgelegd:
  business case (snellere reactietijd Sunny, minder API-druk bij groei, geen extra licentie) +
  pilotplan (1 week, 1 proefkanaal, Mats meet reactietijd voor/na). Wacht nu op akkoord.
- Offerte-voorbereider (voorstel-in-voorbereiding, was idee 7-9, bijgewerkt 10-9): meetbondata
  automatisch omzetten naar Gripp-conceptdata ipv handmatig overtypen na inmeten. Keten-stap
  "meetbon -> offerte bijwerken". Bouwen in eigen tool op sonty-website (huisregel 7: RP/V4 niet
  aanpassen), prijzen blijven ongewijzigd (huisregel 4). Nieuw 10-9: branchevoorbeeld gevonden
  (ICT-dienstverlener, custom GPT-4+RAG) 45->12 min/offerte, 99u/jaar bij 180 offertes/jaar, MAAR
  ~40% van de winst gaat op aan correctiewerk (bron: timmermansmedia.nl, Offertes maken met AI
  2026). Ander bedrijf/sector, dus geen Sonty-cijfer, alleen richtcijfer. Sonty-eigen baseline
  (uren/offerte, aantal/week) nog steeds niet opgehaald; dat is de volgende stap voor dit een
  echt voorstel bij Daimy wordt.
- Article 50 disclosure-plicht AI-klantgesprekken (voorstel, 2026-09-01, dag 4): sinds 2-8-2026
  verplicht elke chatbot zich als AI te identificeren op het contactmoment, handhaving actief,
  boetes tot €15 mln/3% omzet. Sunny doet dit bewust niet (system-prompt.js regel 62). Als
  weekvoorstel 4-9 aan Daimy voorgelegd: 1 zin toevoegen aan eerste bericht, eerst 1 proefgeval.
  Wacht op akkoord.
- Capaciteitswaarschuwing vakanties x boekingen (voorstel, was idee 2-9, bijgewerkt 3-9): data
  bestaat al (vakanties-overzicht.json, inmeet-boekingen.json), alleen matchlogica + vroege
  waarschuwing (2-3 weken vooruit) bij gat <50% capaciteit ontbreekt. Volgende stap: baseline
  meten (hoeveel gaten komende 4 weken) voor ik dit als pilot voorstel. Nog niet gedaan.
- Heartbeat-alarm oude Claude-opdrachten (idee, nieuw 9-9): naar aanleiding van de opgeloste
  Trengo-vertraging (zie hierboven) is dit een terugkerend patroon (3e keer dat opdrachten aan
  'claude' dagenlang blijven liggen zonder signaal). Klein scriptje: alarm in snapshot als een
  opdracht >24u op status "nieuw" staat. Kost bijna niets (geen los model nodig, alleen een
  tijdscheck), voorkomt dat voorstellen (zoals mijn eigen si55gkfm) onopgemerkt dagen stilliggen.
  Dit is Techniek-domein (Mats/itf2311c pakt de structurele fix al op); ik zet het hier als
  agent-architectuurles op mijn lijst, geen aparte actie van mij nodig, wel volgen of itf2311c
  dit meeneemt.

## Afgesloten vragen
- WhatsApp general-purpose chatbotverbod (sinds 15-1-2026): Sunny is taakgericht, blijft
  toegestaan. Bevestigd 29-8, nogmaals bevestigd bij scan 4-9. Geen actie.
- Meta AI-agent op WhatsApp (open sinds 2-9): los opt-in product, raakt Sunny/Trengo niet zolang
  niet geactiveerd. Bevestigd 3-9.
- Fable 5.1 als goedkopere optie (gecheckt 3-9): in euro's duurder dan Sonnet 5, niet geschikt.
  Sonnet 5 blijft juiste keuze.
- Sonnet 5-prijs blijvend $2/$10 per mln: nu bevestigd via OFFICIËLE bron (platform.claude.com/
  pricing, anthropic.com/pricing, gecheckt 7-9; nogmaals via claude.com/pricing gecheckt 8-9).
  Verhoging naar $3/$15 per 1-9 is definitief niet doorgegaan. Geen actie nodig, kosten-Brein
  blijft laag. Let op: sommige SEO-sites (BenchLM, layer3labs) noemen op 8-9 nog ten onrechte
  $3/$15 als actuele prijs; officiële bron blijft leidend. Vraag gesloten, geen verdere check
  nodig tenzij nieuw signaal.
- WhatsApp NL-servicebericht-tarief (deadline 1-10-2026): bij scan 9-9 nog steeds geen officieel
  cijfer; developers.facebook.com/documentation toont bij fetch nog juli-tarieven (niet
  bijgewerkt voor 1-10). SEO-bronnen spreken elkaar tegen (5 cent vs 13,23 cent voor NL) dus
  GEEN van beide overnemen. Blijft "bron ontbreekt", zie kansenlijst.
- 11-9: 2 nieuwe bronnen (SendPulse, EngageLab) bevestigen onafhankelijk mechanisme+datum
  (service messages vanaf 1-10 betaald tegen utility/authentication-tarief), maar NL-utility-
  tarief zelf staat achter CSV/PDF-links op developers.facebook.com, niet los toegankelijk.
  Officiële pagina zelf toont bij fetch 11-9 nog steeds oude tekst ("service conversations free").
  Blijft "bron ontbreekt" tot Mats/Trengo het concrete tarief heeft.

## Leerpunten
- Kosten Brein (som kostenUsd/19 medewerkers, snapshot-moment, niet iedereen al gedraaid): 11-9
  $6,85, 10-9 $7,77, 9-9 $6,94, 7-9 $6,22, 4-9 $5,96, 3-9 $6,46, 2-9 $7,15, 1-9 $6,84, 31-8 $5,50.
  Schommelt, geen alarm zolang <$8-9. Model blijft Sonnet 5 (11-9 opnieuw bevestigd $2/$10
  stabiel, Fable 5.1 blijft duurder op $10/$50).
- Externe branchevoorbeelden (zoals ICT-offerteautomatisering) altijd als richtcijfer behandelen,
  nooit als Sonty-cijfer; eerst eigen baseline meten (zie vakkennis-regel enterprise-cijfers).
- Dagrapporten van collega's (Mats-opdrachten) zijn soms de beste bron voor waarom EIGEN
  voorstellen vastzitten: eerst checken of het een Daimy-vraag is of een bekende systeembug
  voor ik "wacht op akkoord" herhaal.
- 2026-09-01: sonny-watch.log had losstaand van credits-check.log 168 Anthropic
  "credit balance too low"-fouten; blinde vlek in mijn eigen kostenbewaking, al gemeld door Sunny.
- Elke kans eerst toetsen: gebeurt het vaak, is het repeterend, geeft het nu frictie (uren/fouten
  of, zoals vandaag, een harde kostendeadline)? Zo niet, niet op de lijst zetten.
- Context engineering (Anthropic): kleinste set high-signal tokens, just-in-time ophalen,
  compaction bij lange taken; relevant bij beoordelen van Sunny/Nanny en mezelf.
- MKB-pilotnorm: 1-2 weken bij Sonty, 4-8 weken bredere branche-norm; baseline-cijfer vooraf.
- Interne knelpunten (Mats/Sunny dagrapporten) zijn de beste bron voor kansen; blijf die als
  eerste lezen. Externe prijswijzigingen (zoals WhatsApp vandaag) kunnen net zo urgent zijn.
- Bij prijs-/regelnieuws: leun op de bron zelf (platformdocumentatie, help center) boven
  SEO-verzamelsites; die laatste geven vaak tegenstrijdige cijfers.

## Bijscholing 7-9 (wekelijks)
- Vakkennis ververst: model-per-taak kiezen (Haiku/Sonnet/Opus naar zwaarte taak) is een
  directe kostenknop voor het Brein naast wekelijkse modelprijs-check. Eerst 1 gespecialiseerde
  agent bouwen en gebruik meten voor ik een tweede voorstel. Enterprise-ROI-cijfers (Klarna,
  JPMorgan, "171% ROI") NIET 1-op-1 op Sonty toepassen; installatiebranche-vergelijking bevestigt
  dat MKB-quickwin-lijstjes vaak geen cijfer hebben, dus altijd eigen baseline meten.
- Bron Claude Code subagent best practices (tembo.io) direct bruikbaar bij beoordelen van hoe
  het Brein zelf is opgebouwd (elke medewerker-agent = 1 job, 1 duidelijk kostenniveau).

## Lopende zaken
- Trengo-webhooks (dag 14): als weekvoorstel 11-9 kant-en-klaar bij Daimy neergelegd (business
  case + pilotplan), wacht op akkoord. Article 50 (dag 7) wacht nog los op akkoord Daimy, was het
  weekvoorstel van 4-9, niet herhaald 11-9 om er niet twee tegelijk voor te leggen.
- WhatsApp-servicebericht-kosten (deadline 1-10-2026, nog 20 dagen op 10-9): NL-tarief nog
  steeds niet officieel gepubliceerd (ook niet via developers.facebook.com op 10-9), SEO-bronnen
  tegenstrijdig. Wacht op actie Mats (tarief + volume) en op Meta's eigen update.
- Capaciteitswaarschuwing: baseline-meting nog te doen, volgende dienst oppakken.
- Offerte-voorbereider: nu voorstel-in-voorbereiding (zie boven), baseline uren/week nog ophalen
  bij showroom.
- Heartbeat-alarm oude Claude-opdrachten: idee 9-9, volgen of itf2311c dit meeneemt.
- Niet mijn actie, alleen ter info: wa-luisteraar (interne Baileys WhatsApp-sessie voor
  sunny-ochtend/weetje) staat sinds 8-9 plat op 401, eerste keer dat dit gebeurt (was t/m 7-9
  altijd ok); Mats heeft dit al als V-vraag bij Daimy (fysieke QR-herkoppeling nodig), geen
  dubbele actie van mij nodig.
