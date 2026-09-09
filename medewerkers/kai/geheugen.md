# Geheugen Kai

## Kansenlijst (status: idee/voorstel/pilot/gemeten/uitgerold/afgewezen)
- WhatsApp service-message-kosten per 1-10-2026 (voorstel, nieuw 2026-09-04): Meta laat vanaf
  1 okt 2026 "service messages" (antwoorden binnen 24u-venster, nu gratis) betalen tegen
  utility-tarief per land. Bevestigd via help.trengo.com en developers.facebook.com. Raakt Sunny
  direct (elke WhatsApp-reactie via Trengo). NL-tarief nog onbekend bij scan (bron ontbreekt).
  Voorstel bij Daimy 4-9: Mats vraagt tarief op bij Trengo, telt Sunny's service-berichten/dag,
  zodat kosten voor 1-10 bekend zijn. Geen pilot nodig, gewoon een kostenwaarschuwing met deadline.
- Trengo polling naar webhooks (voorstel, 2026-08-29, dag 12, bijgewerkt 9-9): oorzaak van het
  vastzitten OPGEHELDERD door Mats (opdracht x31twb7a, 8-9): het lag niet aan Daimy-akkoord maar
  aan een procesbug in het Brein zelf: opdrachten aan 'claude' (postvak.json/inbox-claude.txt)
  blijven op "nieuw" staan tot een levende Claude-sessie ze tailt, en die sessie pakt bij herstart
  alleen NIEUWE regels op, geen backlog. 12 opdrachten (1-7 dagen oud) zaten hierdoor vast, incl.
  mijn si55gkfm. Mats heeft fix+heartbeat-advies als opdracht itf2311c naar Techniek gestuurd
  (8-9), geen Daimy-vraag nodig (bugfix). 429's zelf stabiel (Mats 8-9: ±5721/20u, geen stijgende
  trend meer). Mijn webhook-voorstel blijft staan; wacht nu op itf2311c-uitvoering, daarna pas
  Daimy-akkoord voor pilot vragen.
- Offerte-voorbereider (idee, nieuw 7-9): meetbondata automatisch omzetten naar Gripp-conceptdata
  ipv handmatig overtypen na inmeten. Raakt keten-stap "meetbon -> offerte bijwerken". Bouwen in
  eigen tool op sonty-website (huisregel 7: RP/V4 niet aanpassen). Nog geen baseline-cijfer (uren
  per offerte, aantal per week); eerst navragen bij showroom voor dit een voorstel wordt.
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

## Leerpunten
- Kosten Brein (som kostenUsd/19 medewerkers): 9-9 $6,94, 7-9 $6,22, 4-9 $5,96, 3-9 $6,46,
  2-9 $7,15, 1-9 $6,84, 31-8 $5,50. Schommelt licht, geen alarm. Model blijft Sonnet 5.
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
- Trengo-webhooks (dag 12): oorzaak vertraging opgehelderd (systeembug postvak, zie boven),
  wacht nu op opdracht itf2311c bij Techniek, daarna pas Daimy-akkoord voor pilot vragen.
  Article 50 (dag 6) wacht nog los op akkoord Daimy, was het weekvoorstel van 4-9.
- WhatsApp-servicebericht-kosten (deadline 1-10-2026, nog 21 dagen op 9-9): NL-tarief nog
  steeds niet officieel gepubliceerd, SEO-bronnen tegenstrijdig. Wacht op actie Mats
  (tarief + volume) en op Meta's eigen update.
- Capaciteitswaarschuwing: baseline-meting nog te doen, volgende dienst oppakken.
- Offerte-voorbereider: idee van 7-9, baseline uren/week nog ophalen bij showroom.
- Heartbeat-alarm oude Claude-opdrachten: nieuw idee 9-9, volgen of itf2311c dit meeneemt.
