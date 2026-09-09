# Vakkennis Mats — Hoofd Techniek en Systemen (bijgewerkt 2026-09-07)

## Zo werken de besten (10-15 concrete regels)
1. Alert alleen als iets urgent, actionable en écht (nog) bezig is — een job die stilstaat zonder
   gebruikersimpact is een logregel, geen wekker (Google SRE).
2. Vier signalen zijn genoeg om op te letten: latency, traffic, errors, saturation. Past een alarm
   nergens bij, vraag je af of het wel een alarm moet zijn.
3. Beschrijf het symptoom, niet de oorzaak: "sunny-weetje faalt met exit 1, maar berichten kwamen
   toch aan" is bruikbaarder dan alleen "exit code ≠ 0".
4. Voor elke cronjob die stil = probleem betekent: heartbeat/dead-man's-switch idee — ping bij
   succes, alarm bij uitblijven binnen een marge (uur-job 5-10 min, dag-job 30-60 min).
5. Cronbewaking kent vier faalklassen, niet één: gemist, te laat gestart, duur wijkt af, en de
   sluipendste — "silent success" (job sluit netjes af met exit 0 maar deed feitelijk niets nuttig).
   Alleen op exit-code kijken mist die vierde klasse; check daarom ook de inhoud/output-omvang.
6. Bij 429's: exponential backoff mét jitter en Retry-After respecteren; zonder jitter retryen
   meerdere workers tegelijk en verergeren ze de piek.
7. Kleine organisatie? Kies 1-3 klantpaden die er echt toe doen (bij Sonty: inmeetafspraak plannen,
   klantbericht beantwoorden, offerte/mutatie wegschrijven) en bewaak dié eerst grondig in plaats
   van overal een beetje alarm op te zetten.
8. Leg bewust-uit vs storing altijd vast, zodat je het niet elke dienst opnieuw hoeft uit te zoeken.
9. Eén runbook-regeltje per terugkerend alarm: wat checken, welke log, welk besluit — nooit
   wachtwoorden of tokens erin.
10. Blameless kijken: rapporteer wat het systeem toeliet, niet wie iets fout deed — vooral bij eigen
    bevindingen over code van collega's.
11. Toil (repetitief handwerk) hoort onder 50% van je tijd te blijven; loopt dat vol, is dat een
    signaal om te automatiseren of te escaleren, niet om harder te scrollen door logs.
12. Combineer signalen (bv. hoge 429's mét toch een groene job) in plaats van los te alarmeren —
    scheelt ruis en voorkomt paniek om iets dat al opgevangen wordt.
13. AI-daemons (Sunny, Nanny, Kai) zijn niet-deterministisch: bewaak ze niet alleen op "draait het",
    maar ook op "deed het wat het moest" (bv. weetje/mutatie kwam echt aan) — vergelijkbaar met hoe
    platform-leads nu apart kijken naar "agent-incidenten" naast gewone systeemstoringen.
14. Cron-tijden altijd in UTC denken en pas bij het rapporteren omzetten naar lokale tijd — voorkomt
    valse "storing" bij een log dat gewoon in UTC wegschrijft.
15. Action items uit een storing krijgen een eigenaar en een datum, anders verdwijnen ze.

## Dagelijkse routine van een topper (kort, in volgorde)
1. Golden signals eerst: snapshot/dashboard — alarmen, wachtrijen, foutpercentages.
2. Bewust-uit eruit filteren voordat je verder duikt.
3. Bij overgebleven alarmen: logs induiken, laatste regels, symptoom + gebruikersimpact benoemen
   (kwam het bericht/de mutatie er ondanks de foutmelding toch doorheen?).
4. API-fouten/429's tellen in een vast tijdvenster (24u), niet losse steekproeven.
5. Cijfers rapporteren mét noemer, geen kale getallen.
6. Alleen bij echte tweekeuzes (repareren/uitzetten) een vraag stellen — de rest zelf afhandelen
   binnen je mandaat.

## Cijfers waarop de besten sturen (met bron)
- Vier golden signals: latency, traffic, errors, saturation (Google SRE book, sre.google).
- Error-budget burn rate i.p.v. statische thresholds zoals "CPU >80%" (incident.io, 2026-editie).
- Toil-percentage <50% van de beschikbare tijd (Google SRE book, hoofdstuk Eliminating Toil).
- MTTR/hersteltijd na incident en % action items met eigenaar+datum afgerond (incident.io
  postmortem-gids).
- Voor kleine teams: begin met 1-3 SLO's op de paden die klanten direct merken (login/betaling-
  equivalent), pas daarna uitbreiden naar meer diensten (Mak IT Solutions, "SRE for Small Teams").
- Cronbewaking scoort op 4 faalklassen: gemiste run, late start, afwijkende duur, silent success
  (Better Stack, cronjob monitoring vergelijking 2026).

## Valkuilen die de besten vermijden
- Te veel non-kritieke alarmen versturen — mensen gaan alles negeren, ook het kritieke alarm.
- Oorzaak-gebaseerd alarmeren (machine-metriek) in plaats van symptoom-gebaseerd (gebruikersimpact).
- Retries zonder jitter, waardoor meerdere clients tegelijk opnieuw proberen en de piek verergeren.
- Wachtwoorden/tokens in runbooks of losse notities zetten.
- Een handmatige dienst-check laten dienen als enige vangnet voor een silent-failing cronjob, terwijl
  een heartbeat dat structureel zou opvangen.
- Alleen op exit-code vertrouwen: een job kan "geslaagd" zijn en toch niets zinnigs hebben gedaan
  (silent success) — vooral risicovol bij AI-gegenereerde content/berichten.

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Bij twijfelgevallen check ik voortaan niet alleen exit-code maar ook of de job daadwerkelijk iets
   opleverde (bv. postvak/queue-bestand echt bijgewerkt, niet leeg of ongewijzigd) — silent-success
   check naast de bekende symptoom/gebruikersimpact-check.
2. Bij AI-daemons (Sunny/Nanny) benoem ik expliciet of het om een systeemstoring gaat of om een
   "agent deed het verkeerde" — dat zijn twee andere soorten problemen met een ander vervolg.
3. Als ik een nieuw permanent alarm zou voorstellen, toets ik het eerst aan "hoort dit bij een van de
   1-3 kernpaden van Sonty (inmeetafspraak, klantbericht, offerte/mutatie)?" — past het niet, dan is
   het geen alarm maar hooguit een logregel.

## Bronnen
- https://sre.google/sre-book/monitoring-distributed-systems/ — origineel Google SRE-hoofdstuk over
  golden signals en actionable alerts, de basis van moderne alerting.
- https://sre.google/sre-book/eliminating-toil/ — Google's eigen definitie en 50%-richtlijn voor
  toil, direct toepasbaar op mijn dagelijkse log-rondes.
- https://betterstack.com/community/comparisons/cronjob-monitoring-tools/ — 2026-overzicht van
  cronjob-monitoring met de vier faalklassen (gemist/laat/duur/silent success), precies mijn
  dagelijkse launchd-controle.
- https://makitsol.com/sre-for-small-teams-a-practical-guide/ — praktische SRE-aanpak voor kleine
  teams (1-3 SLO's, lichte incident-flow), past bij Sonty's schaal beter dan enterprise-SRE-boeken.
- https://incident.io/blog/runbook-automation-tools-2026-the-complete-guide — actuele blik op
  runbook-automatisering en escalatie, bruikbaar voor mijn eigen runbook-regeltjes in geheugen.md.
- https://truto.one/blog/best-practices-for-handling-api-rate-limits-and-retries-across-multiple-third-party-apis/
  — praktische uitleg backoff+jitter+Retry-After, relevant voor de Trengo 429's die ik dagelijks tel.
