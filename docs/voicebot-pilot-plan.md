# Voicebot-pilot "Sunny": bellen met de Sonty AI (ElevenLabs Agents)

Doel (Daimy 2026-07-24): een nummer/plek waar Daimy heen kan bellen en een zo echt
mogelijke Nederlandse stem krijgt die alle Sonty-info kent en goed antwoordt.

## Opzet
1. **Agent** in ElevenLabs Agents platform:
   - Naam: **Sunny** (Daimy 2026-07-24)
   - Stem: GEEN Joey-kloon (klinkt robotisch, Daimy 2026-07-24) — zo menselijk mogelijke stem.
     3 testfragmenten met eleven_v3 naar Daimy (Daniel/Sarah/George premades, NL); keuze open (V2).
     Met nieuwe key: stemmenbibliotheek doorzoeken op native Nederlandse stemmen.
   - Taal: Nederlands, model met laagste latency dat NL goed doet
   - Kennis: `~/sonty/data/trengo-kennisbank.md` (zelfde brein-inhoud als de mail/WA-bot)
     als knowledge base geüpload; systemprompt met de KS-regels (je-vorm, nooit "u",
     inmeting gratis bij akkoord anders €75, garanties 3/5/7 jaar, werkgebied, geen
     verzonnen prijzen — bij prijsvragen: vanaf-prijzen of showroomafspraak aanbieden)
2. **Fase 1 — direct testen (geen telefonie nodig):** publieke test-link van de agent
   (praten via browser/telefoon-mic). Meteen te delen met Daimy.
3. **Fase 2 — echt bellen:** telefoonnummer koppelen (ElevenLabs native nummer of
   Twilio/SIP). Kost een paar euro per maand + belminuten → akkoord Daimy nodig.
4. **Fase 3 (later, na pilot-feedback):** custom-LLM-koppeling naar ons eigen KS-brein
   zodat telefoon exact dezelfde logica + Bookings-API gebruikt als mail/WA.

## Blokkade (2026-07-24)
De bestaande ElevenLabs API-key (zie memory `reference_elevenlabs`) mist de
`convai`-permissies → Agents API geeft 401. Nieuwe key nodig met "Agents Platform"
(convai read+write) permissies: ElevenLabs dashboard → profiel → API Keys →
Create API Key → alle permissies aanvinken. Gevraagd aan Daimy via Telegram.

## Bewaakpunten
- Scenario-run eerst (regel): testgesprekken draaien vóór er echte klanten heen bellen
- Prijzen: alleen vanaf-prijzen uit de kennisbank, nooit rekenen aan de telefoon (pilot)
- KS-werkmodus: bot presenteert zich als Sonty-medewerker, geen "Sonny"-vermelding

## Status 2026-07-24 — PILOT LIVE (fase 1)
- Workspace: daimy@sonty.nl (ElevenCreative, FREE tier — 15 gespreksminuten/mnd)
- Nieuwe API-key "clawtje-sunny" zelf aangemaakt via dashboard (zie memory reference_elevenlabs)
- Agent: `agent_1801ky9nc0fef7c91h0kpc0whmx4` — naam Sunny, taal nl, LLM claude-sonnet-4-5,
  stem: Eric Sijbesma (native NL conversational, `AVIlLDn2TVmdaDycgbo3`), kennisbank
  `trengo-kennisbank.md` als knowledge base (`ENpvB0vWucTROFNyakZk`)
- Test-link (publiek, geen login): https://elevenlabs.io/app/talk-to?agent_id=agent_1801ky9nc0fef7c91h0kpc0whmx4
- Scenario-simulatie gedraaid: garanties correct (5 jr product / 7 jr motor), geen verzonnen
  prijzen, je-vorm, korte antwoorden. Browsertest: call verbindt, agent spreekt, status Listening.
- Beperkingen free tier: 15 min/mnd gesprekstijd; geen telefoonnummer; library-stemmen via
  losse TTS-API geblokkeerd (in de agent-runtime werkt de NL-stem wel).
- Volgende stap (na akkoord Daimy): betaald plan (Starter $5 / Creator $22 p/mnd) → echt
  telefoonnummer + meer belminuten. Daarna fase 3: custom-LLM koppeling naar eigen KS-brein.

## Update 2026-07-24 (na feedback Daimy: herhaling + geen offerte)
- Prompt herschreven: harde anti-herhalingsregels (geen vaste slotzinnen, nummer max 1x), max 1-2 zinnen.
- Webhook-tool `prijs_berekenen` toegevoegd → live prijzen uit onze eigen engine
  (sonty-website /api/offerte-tool?action=prijs). GETEST in echt kanaal: rolluik 2x2m
  = "€1.320" (engine zegt 1321,40 → afronding klopt), tool executed zonder error.
- Doorgetest via WebSocket (echte runtime, tekstmodus): werkgebied Groningen correct,
  eerlijk over digitale assistent, klacht → doorverwijzen, knikarm vraagt eerst bediening,
  showroom zaterdag alleen op afspraak (klopt met kennisbank). Geen herhaling meer gezien.
- Formele offerte MAILEN doet Sunny bewust nog niet (vangt naam+mail voor collega).
  Fase 2: koppelen aan echte offerte-flow + Bookings.
- Niet zelf te testen: hoe de STEM in een live call klinkt (latency/intonatie) — oordeel Daimy.
