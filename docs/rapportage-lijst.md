# Wat Daimy wil weten — vaste rapportagelijst

Levend document. Elke wijziging hier ook doorvoeren in de launchd-jobs en HANDOFF.
Alle datarapporten gaan via de **databot** (@Sontydatabot); alarmen via de hoofdbot.
Akkoord-definitie overal: inkoopkolom gevuld (ook €1) OF akkoord-blok — zie
memory `sonty-offerte-sheet-structuur`. Jonge weken altijd met rijpheidswaarschuwing
(mediaan 24 dagen tot akkoord).

## Draait al (maandagochtend)

| # | Rapport | Wanneer | Script / job |
|---|---------|---------|--------------|
| 1 | Capaciteitsmonitor: instroom vs verwerking → OP-/AFSCHALEN | ma 08:30 | `capaciteitsmonitor.js` (nl.sonty.capaciteit) |
| 2 | Conversie per verzendkanaal (mail/WA), 4 weken + vorige maand | ma 08:35 | `conversie-per-kanaal.js` (nl.sonty.maandag-data) |
| 3 | Conversie per productgroep, laatste 14 dagen | ma 08:35 | `conversie-productgroep-recent.js` (nl.sonty.maandag-data) |
| 4 | Cohortrapport: uitrijping per offerteweek | ma 08:45 | `weekrapport-cohorten.js` (nl.sonty.cohortrapport) |
| 13 | Montage & inmeten: vorige week gedaan + vooruit ingepland, week- en maandtabellen | ma 08:35 | `montage-rapport.js` (nl.sonty.maandag-data) |
| 5 | Conversie per bron (Google/Meta/buren), 4 weken | ma 08:35 | `conversie-per-bron.js` (nl.sonty.maandag-data) |
| 7 | Geld op de plank: open offertes 14-60 dgn, per leeftijdsbucket | ma 08:35 | `openstaande-offertes.js` (nl.sonty.maandag-data) |
| 6 | Maandrapport: afgesloten maand vs zelfde maand vorig jaar | 1e vd maand 08:50 | `maandrapport.js` (nl.sonty.maandrapport) |
| 14 | Gripp openstaand + opruimlijst (oude versies, status-fouten, echt open) | ma 08:35 | `gripp-open-offertes.js` (nl.sonty.maandag-data) |
| 15 | Dashboard sonty.nl/dashboards/conversie.html: conversie per product & platform per maand + rendement advertenties, jaartabs | ma 07:45 auto-deploy | `bouw-conversie-dashboard.js` + `update-dashboard.sh` (nl.sonty.dashboard-update) |

Bestelde items van 30 juli (#2, #3 en #13 montages) staan erin.

## Voorgesteld, wacht op akkoord Daimy

| # | Rapport | Waarom | Frequentie |
|---|---------|--------|------------|
| 8 | **Showroomafspraken** per week (geboekt via AI-KS + totaal) | sterkste conversiehefboom (52–67%) | wekelijks |
| 9 | **Doel-tracker**: omzet/marge t.o.v. jaardoel €5 mln (tab "winst verlies") | ligt het bedrijf op koers | maandelijks |
| 10 | **Kosten per order / break-even** per kanaal | kan pas als de kostenkolom in "conversie %" gevuld wordt of Meta-account "Sonty.nl Creditcard" opengaat | maandelijks |
| 11 | **AI-KS effectmeting**: aug 2026 vs aug 2025 op gelijk rijpingspunt | eerste zinvolle meting ~15 oktober | eenmalig, dan maandelijks |
| 12 | **Buren/bekenden-teller** per week (Zonradar-effect) | goedkoopste kanaal, 39–44% conversie | wekelijks |

## Uitgevoerd 30 juli (meldingen-opschoning, "doe wat jij wijs vindt")
- Nul-meldingen UIT: "geen klant wacht" (wachtlijst), "nog geen A/B-offertes", "geen AI-gesprekken" — alleen nog in de log.
- Oud weekrapport (nl.sonty.weekrapport) UIT: bron was het rp-archief dat op 16 juli bevroor, dus elke maandag foute cijfers.
- Maandag-script doet nu EERST een verse sheet-extractie (anders rapporteert alles de stand van vorige week).

## Bewust NIET (nul-informatie, zie meldingen-opschoning 30 juli)

- "✅ geen klant wacht"-meldingen, "geen AI-gesprekken", "nog geen A/B-offertes",
  losse ✅ per verstuurde follow-up → worden digest-regels of alleen log.
