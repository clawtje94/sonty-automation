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

Bestelde items van 30 juli (#2, #3 en #13 montages) staan erin.

## Voorgesteld, wacht op akkoord Daimy

| # | Rapport | Waarom | Frequentie |
|---|---------|--------|------------|
| 5 | Conversie per **bron** (Google/Meta/buren), 4 weken | het adverteer-stuurgetal; nu alleen in losse analyses | wekelijks |
| 6 | **Maandrapport**: afgesloten maand op alle assen (bron × product × kanaal) vs zelfde maand vorig jaar | de uitgerijpte waarheid, 1× per maand rustig lezen | 1e van de maand |
| 7 | **Openstaande offertes zonder opvolging** ouder dan 14 dagen (aantal + waarde) | direct actielijstje: geld op de plank | wekelijks |
| 8 | **Showroomafspraken** per week (geboekt via AI-KS + totaal) | sterkste conversiehefboom (52–67%) | wekelijks |
| 9 | **Doel-tracker**: omzet/marge t.o.v. jaardoel €5 mln (tab "winst verlies") | ligt het bedrijf op koers | maandelijks |
| 10 | **Kosten per order / break-even** per kanaal | kan pas als de kostenkolom in "conversie %" gevuld wordt of Meta-account "Sonty.nl Creditcard" opengaat | maandelijks |
| 11 | **AI-KS effectmeting**: aug 2026 vs aug 2025 op gelijk rijpingspunt | eerste zinvolle meting ~15 oktober | eenmalig, dan maandelijks |
| 12 | **Buren/bekenden-teller** per week (Zonradar-effect) | goedkoopste kanaal, 39–44% conversie | wekelijks |

## Bewust NIET (nul-informatie, zie meldingen-opschoning 30 juli)

- "✅ geen klant wacht"-meldingen, "geen AI-gesprekken", "nog geen A/B-offertes",
  losse ✅ per verstuurde follow-up → worden digest-regels of alleen log.
