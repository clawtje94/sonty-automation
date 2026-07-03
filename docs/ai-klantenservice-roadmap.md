# Roadmap: Autonome AI-Klantenservice Sonty

> Doel: de klantenservice volledig autonoom laten draaien — sales-gedreven (hoofddoel =
> inmeetafspraak), inclusief offerte-aanpassingen via aanvragen@ en WhatsApp, met de
> €75-regel correct toegepast. De lat: **beter dan de huidige klantenservice** — dat is
> haalbaar, want 41% van de klantgesprekken wordt nu nooit beantwoord (zie
> `docs/klantenservice-analyse-2026-07.md`).
> Regel: NIETS gaat live zonder expliciet akkoord van Daimy per fase.

## Architectuur (gebouwd in `scripts/ai-ks/`)

```
Trengo (WA + Aanvragen/KS-mail)
   │  poll elke 5 min (daemon.js)
   ▼
Agent (agent.js, Claude Opus 4.8, persona "Jaimy")
   ├─ systeemprompt: sales-flow + €75-regel + letterlijke team-scripts (system-prompt.js)
   ├─ kennisbank: data/trengo-kennisbank.md (+ later Roma-prijsboek)
   └─ tools (tools.js):
        prijs_berekenen        → v4-prijsengine 1-op-1 (v4-pricing.js — zelfde cijfers als offertecontrole)
        klant_opzoeken         → RP-offertes + HubSpot contact/deals (klant-context.js)
        offerte_aanpassen      → RP quotation-update (shadow: alleen voorstel)
        inmeet_afspraak_voorstellen → planningstaak/boekingslink (shadow: alleen voorstel)
        escaleren_naar_mens    → interne notitie + Telegram-alert
   ▼
Shadow: interne notitie op het ticket ("🤖 AI-concept…") — klant ziet niets
Live:   antwoord wordt echt verstuurd (vergrendeld achter scripts/ai-ks/.live-enabled)
Log:    data/ai-ks/log.jsonl (elk concept + acties + tokens)
Replay: replay.js — AI naast echte team-antwoorden op historische gesprekken
```

## Fase 0 — Fundament ✅ (klaar, 3 juli)
- [x] Analyse 1.168 gesprekken → `docs/klantenservice-analyse-2026-07.md`
- [x] Prijsengine gekoppeld aan v4 (geverifieerd, zelfde prijzen als offertecontrole)
- [x] Agent + tools + systeemprompt met echte team-scripts (€75, waarde-verkopen, FAQ)
- [x] Shadow-daemon + replay-harnas gebouwd
- [ ] Daimy's WA-playbook (laatste 2 weken) verwerken als paar-voorbeelden in de prompt
- [ ] Beleidsvragen §6 van de analyse beantwoord door Daimy

## Fase 1 — Schaduwdraaien + kwaliteit meten (week 1-2)
- Daemon in cron (elke 5 min, alleen shadow). Bij elk nieuw klantbericht verschijnt
  het AI-concept als interne notitie in Trengo; team antwoordt gewoon zelf.
- Replay-batches op historische gesprekken; Daimy beoordeelt concepten (goed/fout/bijna).
- Meetlat voor livegang (op minimaal 100 beoordeelde concepten):
  · ≥90% "had zo verstuurd kunnen worden" op productvragen/FAQ/inmeet-flow
  · 0 verzonnen feiten of prijzen, 0 gemiste verplichte escalaties
  · €75-regel in 100% van de inmeet-toezeggingen genoemd
- Roma-prijsboek inleren zodra Daimy het aanlevert (zelfde structuur als Sunmaster:
  data/roma-prices-2026.json + koppeling in v4 én prijs_berekenen).

## Fase 2 — Live op de veilige helft (week 3-4, na akkoord Daimy)
- Live voor: productvragen, FAQ, prijsindicaties, showroom-uitnodigingen,
  inmeet-flow t/m boekingslink + planningstaak. Escalaties blijven naar mens.
- WhatsApp eerst (24-uursvenster maximaal benutten: reageren binnen minuten).
- Aanvragen-mail daarna, MITS de mail volledig via Trengo loopt. Let op (Daimy, 3 juli):
  het team beantwoordt nu deels vanuit de gewone mail-login buiten Trengo om — de AI kan
  dus dubbel antwoorden. Vóór mail-livegang: óf iedereen op Trengo voor aanvragen@, óf de
  AI leest de Outlook-mailbox mee om al-beantwoorde threads over te slaan.
- Offerte_aanpassen live: AI voert wijziging door in RP (met backup zoals v4 dat doet)
  en stuurt de nieuwe offerte-link. Eerst 2 weken met vier-ogen-knop (team keurt de
  RP-wijziging in 1 klik goed via interne notitie), daarna vol automatisch.
- Vangrails: rate-limit per klant (max 5 AI-berichten/gesprek/dag), stille uren respecteren,
  dagelijkse Telegram-samenvatting (aantal gesprekken, escalaties, geplande inmeten).

## Fase 3 — Volledige autonomie (maand 2)
- Inmeet_afspraak volledig automatisch: AI maakt de afspraak in Planado/HubSpot-agenda
  (koppeling met beschikbaarheid van inmeters, zoals belscherm-flow) i.p.v. alleen een taak.
- Status-vragen beantwoorden uit Gripp/Planado ("wanneer wordt er gemonteerd?").
- Proactieve opvolging: onbeantwoorde offertes na 3 dagen persoonlijk (niet-template)
  opvolgen binnen het WhatsApp-venster; reactivatie van stille leads.
- €75-facturatie-signaal: na inmeten-zonder-akkoord automatisch taak voor factuur.

## Fase 4 — Zelfverbetering (doorlopend)
- Wekelijkse evaluatie: AI-antwoorden vs. uitkomsten (inmeet geboekt? klant stil?),
  verliesredenen taggen, prompt/kennisbank bijwerken.
- Kennisbank uitbreiden per nieuw prijsboek/product (Roma, Unilux-horren, raamdeco).
- KPI-dashboard: reactietijd, % beantwoord, inmeet-conversie per kanaal, escalatie-ratio.

## KPI's (nulmeting → doel)

| KPI | Nu | Doel fase 2 | Doel fase 3 |
|---|---|---|---|
| % klantberichten beantwoord | 59% | 100% | 100% |
| Mediane reactietijd WA | 39 min | < 3 min | < 3 min |
| Mediane reactietijd mail | 20 uur | < 15 min | < 15 min |
| Inmeet-voorstel bij koopintentie | ~54% | 100% | 100% |
| Uren menselijke KS per week | ~alles Daimy | -50% | -85% |

## Veiligheid & principes
- Shadow is de default; live vereist het bestand `scripts/ai-ks/.live-enabled` met
  inhoud "JA ECHT" — aan te maken door Daimy zelf, nooit door de AI.
- De AI verzint niets: prijzen alleen via de v4-engine, feiten alleen uit de kennisbank,
  onbekend = eerlijk zeggen + uitzoeken/escaleren.
- Elke actie gelogd (data/ai-ks/log.jsonl); escalaties direct op Telegram.
- Verplichte escalatielijst (klachten, schade, juridisch, boos, veiligheid, korting,
  B2B, phishing, opt-out) staat hard in de prompt én wordt in shadow-fase getoetst.
