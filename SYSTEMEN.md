# SYSTEMEN.md — register van alle Sonty-automatisering

> GEGENEREERD uit `data/systemen-register.json` door `scripts/systemen-md-genereer.js`.
> NIET hier bewerken: pas het register aan (of via sonty-website.vercel.app/admin/systemen)
> en draai de generator. Laatst gegenereerd: 2026-08-15.

**Snel stoppen (kill-switch):** `touch ~/sonty/data/kill/<label>` — of de "zet uit"-knop op
/admin/systemen. Hard stoppen: `launchctl bootout gui/501/<label>`; weer aan met
`launchctl bootstrap gui/501 ~/Library/LaunchAgents/<label>.plist`.

**Bewaking:** status-collect.js pusht elke 10 min naar /admin/systemen, herstart stille
pollers zelf (heartbeat) en meldt nieuw-rood, ongeregistreerde en verdwenen diensten op
Telegram. cron-health-check.js (2x/dag) leest hetzelfde register.

## Klantgericht

| Dienst | Doet | Ritme | Log | Bewaking |
|---|---|---|---|---|
| `nl.sonty.sonny` | Beantwoordt als Jaimy actieve WhatsApp-gesprekken + whitelist, boekt/verzet showroomafspraken, maakt en wijzigt offertes. | permanent (poll ~30s) | sonny-watch.log | log < 1u |
| `nl.sonty.email` | Beantwoordt als Sunny open tickets op aanvragen@ + info@, escaleert naar Mens nodig. | permanent (elke 90s) | email-daemon.log | log < 1u |
| `nl.sonty.trengo-bundel` | Voegt actieve tickets van hetzelfde contact op hetzelfde kanaal samen tot één gesprek. | elke 15 min | trengo-bundel.log | log < 2u |
| `nl.sonty.opvolging-schaduw` | Berekent welke offerte-opvolging verstuurd zou worden (verstuurt niets), dagelijks 10:30 rapport. | elk uur | opvolging.log | log < 26u |

## Planning & orders

| Dienst | Doet | Ritme | Log | Bewaking |
|---|---|---|---|---|
| `nl.sonty.inmeet-dashboard` | Berekent beste inmeettijden per wachtende lead, publiceert het plan-dashboard, bewaakt de 24-uursklok van aanbiedingen. | elke 30 min | inmeet-dashboard.log | log < 2u |
| `nl.sonty.inmeet-verwerker` | Boekt gekozen aanbiedingen echt: Planado-opdracht, Outlook, Gripp, meetbon, sheet, bevestiging naar klant. | elke 5 min | inmeet-verwerker.log | log < 2u |
| `nl.sonty.inmeet-verzoeken` | Verwerkt dashboard-verzoeken direct: tijden rekenen, direct boeken, keuzelink sturen, verzetten, annuleren. | permanent (wachtrij) | inmeet-verzoeken.log | alleen geladen-check |
| `nl.sonty.aanbod-replies` | Leest klantreacties op keuzelinks (WhatsApp), boekt keuzes, vraagt nieuwe voorstellen aan bij ander-moment, remt pingpong af. | elke 3 min | aanbod-replies.log | log < 1u |
| `nl.sonty.meetbon-doorzetten` | Complete meetbon + betaalde aanbetalingsfactuur → bestelmail naar orders@ + Telegram, bon op doorgezet. | elk uur | meetbon-doorzetten.log | log < 3u · KS |
| `nl.sonty.planning-mail` | Leest orders@/info@-mails en PDF-bijlagen, schrijft orders en leverdatums in de Planning-sheet; beheert het OWA-token dat meer diensten gebruiken. | elke 30 min | planning-mail-daemon.log | log < 2u · KS |
| `nl.sonty.outlook-planado-sync` | Zet nieuwe Outlook-afspraken door naar Planado-opdrachten. | elke 10 min | outlook-planado-sync.log | log < 2u |
| `nl.sonty.planado-outlook` | Controleert dagelijks of alles wat in Planado staat ook in Outlook staat (en andersom), meldt gaten. | dagelijks 07:45 | planado-outlook.log | log < 30u |
| `nl.sonty.planado-shifts` | Zet de beschikbaarheid van de inmeters in Planado vanuit het echte rooster + vakanties uit Outlook. | dagelijks 07:45 | planado-shifts.log | log < 30u |
| `nl.sonty.gripp-verrijken` | Zet Gripp-offerte-informatie in de Planado-inmeetopdrachten zodat de inmeter precies weet wat hij gaat inmeten. | 2x per dag | gripp-verrijken.log | log < 30u |
| `nl.sonty.markiezen` | Dagelijkse markiezen-taken (cron-markiezen.js). | 2x per dag | markiezen.log | log < 30u |
| `nl.sonty.reminder-template` | Verstuurt de inmeet-herinnering zodra het goedgekeurde WhatsApp-template beschikbaar is. | elke 30 min | reminder-template.log | alleen geladen-check |
| `nl.sonty.template-wachter` | Houdt in de gaten of nieuwe WhatsApp-templates door Meta zijn goedgekeurd en meldt dat. | elke 30 min | template-wachter.log | alleen geladen-check |

## Offertes & CRM

| Dienst | Doet | Ritme | Log | Bewaking |
|---|---|---|---|---|
| `nl.sonty.offerte-v4` | Controleert RP-offertes op kritieke regels en montageprijzen, maakt AI-offertekaarten. | 2x per dag (09:00/17:00) | v4.log | log < 30u |
| `nl.sonty.v4-selfcheck` | Controleert 30 min na elke V4-run of alles verwerkt is en fixt gemiste items automatisch. | 2x per dag (09:45/17:45) | v4-selfcheck.log | log < 30u |
| `nl.sonty.gripp-invullen` | Vult Gripp-offertes aan vanuit het offerte-register. | 7x per dag | gripp-invullen.log | log < 5u |
| `nl.sonty.auto-sync` | Synchroniseert nieuwe Reuzenpanda-leads naar HubSpot. | elke 15 min | sync.log | log < 2u |
| `nl.sonty.prijs-steekproef` | Nachtelijke steekproef: configuratorprijzen vergelijken met leveranciersdata. | dagelijks 03:30 | prijs-steekproef.log | log < 30u |
| `nl.sonty.prijs-kruiscontrole` | Dagelijkse kruiscontrole van prijzen over de verschillende bronnen heen. | dagelijks 07:45 | prijs-kruiscontrole.log | log < 30u |

## Bewaking

| Dienst | Doet | Ritme | Log | Bewaking |
|---|---|---|---|---|
| `nl.sonty.health-check` | Controleert 2x per dag alle geregistreerde diensten (dit register) en alarmeert via Telegram. | 2x per dag (08:00/19:00) | health-check.log | log < 14u |
| `nl.sonty.keten-zelfcontrole` | Controleert elk uur 7 invarianten van de inmeet-keten: dubbele boeking, botsend aanbod, aanbod na boeking, stille klant, dood ticket, vergeten lead, verlopen zonder vervolg. | elk uur | keten-zelfcontrole.log | log < 3u |
| `nl.sonty.aan-zet-watchdog` | Bewaakt of het laatste echte klantbericht onbeantwoord blijft (>2u), meldt dode gesprekken. | elk uur | aan-zet-watchdog.log | log < 3u |
| `nl.sonty.credits-check` | Bewaakt de API-credits waar de AI-klantenservice op draait. | elke 2 uur | credits-check.log | log < 14u |
| `nl.sonty.gesprek-lab` | Test dagelijks de gespreksafhandeling tegen scenario's zodat wijzigingen de bot niet slechter maken. | dagelijks 07:30 | gesprek-lab.log | log < 30u |
| `nl.sonty.status-push` | Verzamelt elke 10 min de status van alle diensten uit dit register, herstart stille pollers, en pusht naar /admin/systemen. | elke 10 min | status-push.log | log < 1u |

## Rapportage

| Dienst | Doet | Ritme | Log | Bewaking |
|---|---|---|---|---|
| `nl.sonty.tickets-rapport` | Dagelijks 08:15 rapport hoeveel tickets de AI zelf afhandelde. | dagelijks 08:15 | tickets-rapport.log | log < 30u |
| `nl.sonty.sonny-rapport` | Dagelijks 08:30 overzicht van de AI-klantenservicegesprekken naar Telegram. | dagelijks 08:30 | sonny-rapport.log | log < 26u |
| `nl.sonty.getekend-rapport` | Dagelijks overzicht getekende offertes + AI-resultaten. | dagelijks 21:00 | getekend-rapport.log | log < 30u |
| `nl.sonty.qa-leren` | Destilleert dagelijks leerpunten uit QA-afkeuringen zodat de bot bijleert. | dagelijks 07:45 | qa-leren.log | log < 30u |
| `nl.sonty.reviews-sync` | Haalt Google-reviews op en zet ze op de website. | 2x per dag | reviews-sync.log | log < 26u |
| `nl.sonty.ab-rapport` | Dagelijks 09:15 tussenstand van lopende A/B-tests. | dagelijks 09:15 | ab-rapport.log | log < 30u |
| `nl.sonty.ab-eindrapport` | Meldt afgeronde A/B-tests met conclusie. | dagelijks 09:30 | ab-eindrapport.log | log < 30u |
| `nl.sonty.capaciteit` | Wekelijks op/afschaal-signaal tegen het teamplafond (~35 orders/week). | dagelijks 08:30 | tools/capaciteit.log | alleen geladen-check |
| `nl.sonty.cohortrapport` | Conversie per week-cohort met ijkpunten (bot live, prijswijzigingen) in de tijdlijn. | dagelijks 08:45 | cohortrapport.log | log < 30u |
| `nl.sonty.maandag-data` | Wekelijks datablok voor Daimy via de databot (na de capaciteitsmonitor). | maandag 08:35 | maandag-data.log | log < 192u |
| `nl.sonty.maandrapport` | De afgesloten maand op alle assen tegen dezelfde maand vorig jaar (1e van de maand). | maandelijks (1e) | maandrapport.log | alleen geladen-check |
| `nl.sonty.extrawerk-maandrapport` | Telt maandelijks de montage-afspraken met extra-werk-vermelding. | maandelijks | extrawerk-maandrapport.log | alleen geladen-check |
| `nl.sonty.email-weekbot` | Wekelijkse Klaviyo/mailmarketing-ronde (maandag 08:30). | maandag 08:30 | email-weekbot.log | log < 192u |
| `nl.sonty.email-sync` | Dagelijkse sync van klant- en orderdata naar Klaviyo-segmenten. | dagelijks 06:30 | email-sync.log | log < 30u |
| `nl.sonty.dashboard-update` | Wekelijks (ma 07:45) verse sheet-extractie → statische conversiepagina → git push. | maandag 07:45 | dashboard-update.log | log < 192u |
| `nl.sonty.vve-signalen` | Scant dagelijks welke appartementencomplexen in Zuid-Holland met hun gevel bezig zijn (vergunningen). | dagelijks 08:30 | vve-signalen.log | log < 30u |
| `nl.sonty.vacaturemail` | Wervingsmail naar klanten in batches van 150/dag (10:30). | dagelijks 10:30 | vacaturemail.log | log < 30u · KS |

## Infrastructuur

| Dienst | Doet | Ritme | Log | Bewaking |
|---|---|---|---|---|
| `nl.sonty.telegram-poll` | Haalt Daimy's Telegram-berichten op naar telegram-inbox.txt — de lijn tussen Daimy en Claude. | permanent (elke 5s) | tools/telegram-poll.log | heartbeat 15 min + zelfherstel |
| `nl.sonty.databot-poll` | Haalt berichten uit de Sonty-databot-chat op (datavragen Daimy). | permanent | tools/sonty-data-poll.log | heartbeat 15 min + zelfherstel |
| `nl.sonty.auto-resume` | Hervat werk automatisch na een crash of reboot van de Mac. | elke 5 min | auto-resume.log | alleen geladen-check |
| `nl.sonty.feedback-processor` | Verwerkt de feedback-wachtrij. | elke 5 min | feedback.log | alleen geladen-check |
| `nl.sonty.dummy4k` | Houdt een virtueel scherm actief voor browserwerk op de headless Mac. | permanent | – | alleen geladen-check |
| `nl.sonty.dummy4k-resolution` | Zet de virtuele schermresolutie goed na een herstart. | bij boot | – | alleen geladen-check |
| `nl.sonty.wachtlijst` | Bewust uitgezet (plist heeft .disabled-suffix). Staat hier zodat hij zichtbaar blijft. | uit | – | uitgeschakeld |

## Vaste afspraken
- Nieuwe dienst? Registreer hem in `data/systemen-register.json` — dashboard én health-check
  volgen vanzelf. Een draaiende dienst zonder registratie wordt automatisch gemeld.
- Credentials horen in `scripts/secrets.js` (gitignored), acties richting klant in het
  audit-log (`logs/audit.jsonl` via `scripts/audit.js`).
- Bekende single point of failure: alles draait op één Mac mini (kernel panic 21-07).
  Cloud-migratie van kritieke flows = aparte beslissing van Daimy.
