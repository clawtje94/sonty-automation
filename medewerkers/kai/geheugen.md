# Geheugen Kai

## Kansenlijst (status: idee/voorstel/pilot/gemeten/uitgerold/afgewezen)
- Trengo polling naar webhooks (voorstel, 2026-08-29): Mats en Sunny melden structureel hoge
  429's (4000-38000/dag) op Trengo. Trengo-docs: polling veroorzaakt dit, webhooks lossen het
  op (duizenden calls/uur naar handvol). Kost dev-tijd (onbekend), levert op: minder ruis in
  logs/alarmen, minder kans dat echte storing verdrinkt in retries. Wacht op akkoord Daimy,
  dan pilot: 1 wachtrij omzetten, 429-aantal voor/na meten.
- Article 50 disclosure-plicht AI-klantgesprekken (idee, 2026-08-29): signaal dat sinds aug 2026
  bedrijven met AI in klantgesprekken (zoals Sunny) moeten melden dat het AI is. Nog niet
  geverifieerd of dit Sunny/WhatsApp raakt en of Sunny dit al doet. Navragen voor uitwerken.

## Afgesloten vragen
- WhatsApp general-purpose chatbotverbod (sinds 15-1-2026): Sunny valt hier niet onder, want
  Trengo/Sunny is taakgerichte AI (klantenservice, afspraken), dat blijft toegestaan. Bevestigd
  via scan 2026-08-29, geen actie nodig.

## Leerpunten
- Elke kans eerst toetsen: gebeurt het vaak, is het repeterend, geeft het nu frictie (uren/fouten)?
  Zo niet, niet op de lijst zetten.
- Context engineering (Anthropic): kleinste set high-signal tokens, just-in-time ophalen, compaction
  bij lange taken, relevant bij beoordelen/verbeteren van collega-agents (Sunny, Nanny) en mezelf.
- MKB-pilotnorm: 1-2 weken bij Sonty, 4-8 weken bredere branche-norm; baseline-cijfer vooraf vastleggen.
- Modelprijzen/nieuwe modellen wekelijks checken; kan het Brein duurder of goedkoper maken zonder dat
  iemand het merkt.
- Interne knelpunten (Mats/Sunny dagrapporten) zijn de beste bron voor kansen, beter dan losse
  webscan; blijf dagrapporten van Techniek en Sunny als eerste lezen.
- Kosten Brein vandaag (2026-08-29): som kostenUsd laatste actie per medewerker in
  medewerkers.json ≈ $6,88 (18 medewerkers). Gebruiken als vergelijkingsbasis voor volgende dagen.

## Lopende zaken
- Trengo-webhook-kans en Article 50-signaal staan open, wachten op reactie Daimy / verder
  uitzoeken. Vrijdag (volgende): beste kans van de lijst uitwerken tot volledig voorstel voor
  Daimy (business case + pilotplan) als Trengo-kans dan nog actueel is.
