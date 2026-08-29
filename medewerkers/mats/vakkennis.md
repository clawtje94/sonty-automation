# Vakkennis Mats — Hoofd Techniek en Systemen (bijgewerkt 2026-08-29)

## Zo werken de besten (10-15 concrete regels)
1. Alert alleen als iets urgent, actionable en écht (nog) bezig is — een job die stilstaat zonder
   gebruikersimpact is een logregel, geen wekker (Google SRE).
2. Vier signalen zijn genoeg om op te letten: latency, traffic, errors, saturation. Past een alarm
   nergens bij, vraag je af of het wel een alarm moet zijn.
3. Beschrijf het symptoom, niet de oorzaak: "sunny-weetje faalt met exit 1, maar berichten kwamen
   toch aan" is bruikbaarder dan alleen "exit code ≠ 0".
4. Voor elke cronjob die stil = probleem betekent: heartbeat/dead-man's-switch idee — ping bij
   succes, alarm bij uitblijven binnen een marge (uur-job 5-10 min, dag-job 30-60 min).
5. Bij 429's: exponential backoff mét jitter en Retry-After respecteren; zonder jitter retryen
   meerdere workers tegelijk en verergeren ze de piek.
6. Leg bewust-uit vs storing altijd vast, zodat je het niet elke dienst opnieuw hoeft uit te zoeken.
7. Eén runbook-regeltje per terugkerend alarm: wat checken, welke log, welk besluit — nooit
   wachtwoorden of tokens erin.
8. Blameless kijken: rapporteer wat het systeem toeliet, niet wie iets fout deed — vooral bij eigen
   bevindingen over code van collega's.
9. Toil (repetitief handwerk) hoort onder 50% van je tijd te blijven; loopt dat vol, is dat een
   signaal om te automatiseren of te escaleren, niet om harder te scrollen door logs.
10. Documenteer wijzigingen traceerbaar (wie/wat/wanneer) — past bij Sonty's eigen huisregel om
    niets buiten je map te wijzigen en alles als voorstel te melden.
11. Bulk-fixes: eerst 1 proefgeval, laten checken, dan pas de rest.
12. Combineer signalen (bv. hoge 429's mét toch een groene job) in plaats van los te alarmeren —
    scheelt ruis en voorkomt paniek om iets dat al opgevangen wordt.
13. Action items uit een storing krijgen een eigenaar en een datum, anders verdwijnen ze.

## Dagelijkse routine van een topper (kort, in volgorde)
1. Golden signals eerst: snapshot/dashboard — alarmen, wachtrijen, foutpercentages.
2. Bewust-uit eruit filteren voordat je verder duikt.
3. Bij overgebleven alarmen: logs induiken, laatste regels, symptoom benoemen.
4. API-fouten/429's tellen in een vast tijdvenster (24u), niet losse steekproeven.
5. Cijfers rapporteren mét noemer, geen kale getallen.
6. Alleen bij echte tweekeuzes (repareren/uitzetten) een vraag stellen — de rest zelf afhandelen
   binnen je mandaat.

## Cijfers waarop de besten sturen
- Vier golden signals: latency, traffic, errors, saturation (Google SRE book, sre.google).
- Error-budget burn rate i.p.v. statische thresholds zoals "CPU >80%" (incident.io, 2026-editie).
- Toil-percentage <50% van de beschikbare tijd (Google SRE book, hoofdstuk Eliminating Toil).
- MTTR/hersteltijd na incident en % action items met eigenaar+datum afgerond (incident.io
  postmortem-gids).

## Valkuilen die de besten vermijden
- Te veel non-kritieke alarmen versturen — mensen gaan alles negeren, ook het kritieke alarm.
- Oorzaak-gebaseerd alarmeren (machine-metriek) in plaats van symptoom-gebaseerd (gebruikersimpact).
- Retries zonder jitter, waardoor meerdere clients tegelijk opnieuw proberen en de piek verergeren.
- Wachtwoorden/tokens in runbooks of losse notities zetten.
- Een handmatige dienst-check laten dienen als enige vangnet voor een silent-failing cronjob, terwijl
  een heartbeat dat structureel zou opvangen.

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Bij terugkerende twijfelgevallen (gesprek-lab, sunny-weetje, sonny-watch 429's) leg ik voortaan
   niet alleen "exit-code" vast maar expliciet het symptoom en de gebruikersimpact (kwam het bericht
   toch aan? blokkeerde de poort terecht?) — dat maakt mijn vraag aan Daimy scherper.
2. Bij 429-meldingen geef ik voortaan een onderbouwd voorstel (backoff/jitter/poll-frequentie) in
   plaats van alleen het aantal te melden — concreet advies i.p.v. enkel signaleren.
3. Waar een permanente job silent kan falen zonder alarm, noteer ik dat als VOORSTEL "heartbeat/
   dead-man's-switch toevoegen" in plaats van het stilzwijgend te laten passeren — bouwen doe ik
   niet zelf, wel benoemen.

## Bronnen (met reden)
- https://sre.google/sre-book/monitoring-distributed-systems/ — origineel Google SRE-hoofdstuk over
  golden signals en actionable alerts, de basis van moderne alerting.
- https://sre.google/sre-book/eliminating-toil/ — Google's eigen definitie en 50%-richtlijn voor
  toil, direct toepasbaar op mijn dagelijkse log-rondes.
- https://incident.io/blog/sre-incident-postmortem-best-practices — recente (2026) samenvatting van
  blameless postmortem-praktijk bij moderne engineeringteams.
- https://truto.one/blog/best-practices-for-handling-api-rate-limits-and-retries-across-multiple-third-party-apis/
  — praktische uitleg backoff+jitter+Retry-After, relevant voor de Trengo 429's die ik dagelijks tel.
- https://nurbak.com/en/blog/dead-mans-switch/ — heldere uitleg heartbeat-monitoring voor cronjobs,
  toepasbaar op de launchd-jobs die ik bewaak.
- https://blog.incidenthub.cloud/The-No-Nonsense-Guide-to-Runbook-Best-Practices — concrete regels
  voor korte, veilige runbooks, bruikbaar voor mijn twijfelgevallen in geheugen.md.
