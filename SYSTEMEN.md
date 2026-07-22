# SYSTEMEN.md — register van alle Sonty-automatisering

> Bron van waarheid voor wat er draait, wat het doet en hoe je het stopt. Wordt door
> `scripts/status-collect.js` gebruikt voor het dashboard **sonty-website.vercel.app/admin/systemen**.
> Bijwerken bij elke nieuwe/gewijzigde dienst. (Aangemaakt 22-07-2026.)

**Snel stoppen (kill-switch):** `touch ~/sonty/data/kill/<label>` zet de dienst stil bij zijn
volgende ronde (voor diensten met kill-switch-ondersteuning, zie kolom KS). Weghalen = weer aan.
Hard stoppen kan altijd met `launchctl bootout gui/501/<label>`; weer aan met
`launchctl bootstrap gui/501 ~/Library/LaunchAgents/<label>.plist`.

## Klantgericht (raakt klanten direct — hoogste risico)

| Dienst | Doet | Ritme | Log | Als hij uitvalt | KS |
|---|---|---|---|---|---|
| `nl.sonty.sonny` | AI-klantenservice WhatsApp (Jaimy-persona): beantwoordt actieve gesprekken + whitelist, boekt showroomafspraken, maakt/wijzigt offertes | permanent (KeepAlive, poll ~30s) | sonny-watch.log | klanten krijgen geen antwoord op WhatsApp | – |
| `nl.sonty.email` | AI-klantenservice e-mail (aanvragen@ + info@): beantwoordt open tickets van Sunny/niemand, escaleert naar Mens nodig | permanent (KeepAlive, elke 90s) | email-daemon.log | klantmails blijven onbeantwoord (team ziet ze wel in Trengo) | – |
| `nl.sonty.opvolging-schaduw` | Offerte-opvolging in SCHADUW (verstuurt niets, dagelijks 10:30 voorstel-rapport) | dagelijks | opvolging.log | geen rapport; klanten merken niets | – |

## Planning & orders

| Dienst | Doet | Ritme | Log | Als hij uitvalt | KS |
|---|---|---|---|---|---|
| `nl.sonty.planning-mail` | Leest ongelezen orders@/info@-mails (blijven ongelezen), PDF-bijlagen uit, schrijft orders/leverdatums in Planning-sheet tab "Claude ai test" (blauw + Ai opmerking) | elke 30 min | planning-mail-daemon.log | sheet loopt achter; mails blijven staan (geen verlies) | ✅ |
| `nl.sonty.markiezen` | Markiezen-workflow (cron-markiezen.js) | dagelijks (calendar) | markiezen.log | markiezen-taken blijven liggen | – |
| `nl.sonty.vacaturemail` | Wervingsmail naar klanten in batches van 150/dag (10:30) tot de doelgroep-lijst klaar is; reacties gaan naar Daimy, bots blijven eraf | dagelijks 10:30 | vacaturemail.log | batch schuift een dag op | ✅ |

## Offertes & CRM

| Dienst | Doet | Ritme | Log | Als hij uitvalt | KS |
|---|---|---|---|---|---|
| `nl.sonty.offerte-v4` | Offerte-controle v4 (RP-offertes controleren, kritieke regels, montageprijzen) | calendar | v4.log | nieuwe offertes worden niet gecontroleerd | – |
| `nl.sonty.v4-selfcheck` | Controleert 30 min na elke V4-run of alles verwerkt is en fixt automatisch | calendar | v4-selfcheck.log | gemiste V4-items blijven liggen | – |
| `nl.sonty.gripp-invullen` | Vult Gripp aan vanuit offerte-register | dagelijks (calendar) | gripp-invullen.log | Gripp loopt achter | – |
| `nl.sonty.auto-sync` | RP → HubSpot lead-sync | elke 15 min | sync.log | nieuwe leads komen niet in HubSpot | – |
| `nl.sonty.prijs-steekproef` | Steekproef prijzen configurator vs leverancier | calendar | prijs-steekproef.log | geen prijsbewaking | – |

## Rapportage & bewaking

| Dienst | Doet | Ritme | Log | Als hij uitvalt | KS |
|---|---|---|---|---|---|
| `nl.sonty.health-check` | Bewaakt ALLE diensten hierboven, alarm via Telegram | 2x/dag (calendar) | health-check.log | storingen blijven onopgemerkt (dashboard toont het nog wel) | – |
| `nl.sonty.credits-check` | Anthropic-credits watchdog (AI-KS valt stil zonder credits) | elke 2u | credits-check.log | credits kunnen ongemerkt op raken | – |
| `nl.sonty.sonny-rapport` | Ochtendrapport AI-gesprekken naar Telegram (08:30) | dagelijks | sonny-rapport.log | geen ochtendrapport | – |
| `nl.sonty.getekend-rapport` | Dagrapport tekeningen + AI-resultaten (07:45) | dagelijks | getekend-rapport.log | geen dagrapport | – |
| `nl.sonty.weekrapport` | Weekrapport conversie | wekelijks | weekrapport.log | geen weekrapport | – |
| `nl.sonty.qa-leren` | Destilleert leerpunten uit QA-afkeuringen (07:45) | dagelijks | qa-leren.log | bot leert niet bij | – |
| `nl.sonty.reviews-sync` | Google-reviews naar website | dagelijks | reviews-sync.log | reviews lopen achter | – |

## Infrastructuur (Mac mini)

| Dienst | Doet | Ritme | Log | Als hij uitvalt | KS |
|---|---|---|---|---|---|
| `nl.sonty.telegram-poll` | Haalt Telegram-berichten van Daimy op → telegram-inbox.txt | permanent (KeepAlive) | telegram-poll.log | Daimy's berichten komen niet binnen bij Claude | – |
| `nl.sonty.auto-resume` | Werk-hervatting na crash/reboot | elke 5 min | auto-resume.log | geen auto-herstart van werk | – |
| `nl.sonty.feedback-processor` | Verwerkt feedback-queue | elke 5 min | feedback.log | feedback blijft liggen | – |
| `nl.sonty.status-push` | Verzamelt status van alle diensten → dashboard /admin/systemen | elke 10 min | status-push.log | dashboard loopt achter (diensten zelf draaien door) | – |
| `nl.sonty.dummy4k` / `dummy4k-resolution` | Virtueel 4K-scherm voor headless Mac (Playwright) | permanent / boot | – | browserwerk kan haperen | – |

## Vaste afspraken
- Elke dienst logt naar `~/sonty/logs/<log>`; de health-check alarmeert op oude logs.
- Credentials horen in `scripts/secrets.js` (gitignored) — NIET hardcoded in scripts (migratie loopt).
- Elke actie richting klant/extern systeem hoort in het audit-log: `~/sonty/logs/audit.jsonl` (via `scripts/audit.js`).
- Nieuwe dienst? Voeg toe aan: dit register, `cron-health-check.js` (DAEMONS) en desgewenst kill-switch-support.
- Bekende single point of failure: alles draait op één Mac mini (kernel panic 21-07). Cloud-migratie van kritieke flows = aparte beslissing van Daimy.
