# Voicebot-pilot: bellen met de Sonty AI (ElevenLabs Agents)

Doel (Daimy 2026-07-24): een nummer/plek waar Daimy heen kan bellen en een zo echt
mogelijke Nederlandse stem krijgt die alle Sonty-info kent en goed antwoordt.

## Opzet
1. **Agent** in ElevenLabs Agents platform:
   - Stem: Sonty voice clone (`cbFatWTfoXkJFHGUWEab`), fallback: beste native NL-stem ter vergelijking
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
