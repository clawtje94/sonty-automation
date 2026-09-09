## Huidige status (2026-09-09)

**Blokkades (3 vragen aan Daimy — KRITISCH):**
- V1: Mailklikrate 0,76% (norm 2,00%). ACHT DAGEN achter elkaar onder 1% (2 sep 0,30%, 5 sep 0,70%, 7 sep 0,76%). Offerte-opvolging 0,00%-0,81% klik. Content-probleem (subject/body). Voorstel: A/B-test autorisatie vandaag (1 segment, 48u meetperiode).
- V2: Google Ads credentials ontbreken (.env) — geen CPL data. Exit code 2 dagelijks 07:10. KRITISCH voor leadval (9 dagen).
- V3: Reviews API-key ontbreekt — 177+ "geen API-key" entries (gisteren). Geen review-volume, responstime (11 dagen).

**Werkend:**
- Email-daemon: permanent, tickets verwerken.
- SEO-agent: dagelijks 05:30, 100 pagina's, 50 open, 0 nieuw (sinds 29 aug: nul leads — 9 dagen).
- Email-sync: klaar (17.212 profielen 1 sep), mailvolume stabiel (~1400-1700 per dag).
- Mailrapport: maandag 08:30 (vandaag draait, wacht op vandaag's cijfers).

**KPI's 7 sep (meest recent beschikbaar):**
- Mails verstuurd: 1445
- Mailklikrate: 0,76% (norm 2,00% — ZEVEN DAGEN ACHTER ELKAAR ONDER 1%)
- Offerte-opvolging: 0,00%-0,81% klik (worst performer)
- Tekenbonus 4d: 1,74% klik (enige op norm)
- Mailakkoorden: 3 (0,21% conversie)
- Google Ads CPL: onbekend (V2)
- SEO-leads: 0 (sinds 29 aug; 100 pagina's, 50 open)
- Reviews: onbekend (V3)

## Bijscholing 2026-09-07
- Vakkennis.md ververst: CPL-bandbreedte per vak ($25-150), leerfase Google Ads (pas target-CPA na 30+30 dagen, stappen 10-15%, niet resetten), flows-vs-campagnes (5,58% vs 1,69%), reviewnorm (24u, 90%+).
- **Toepassing:** Offerte-opvolging campagnes hebben lage klikrate (0,00%-1,16%) én lage volume (39-172 per batch). Dit is NIET Apple MPP (ander katern): content-kwestie (subject/body passen niet, of timing). OR-test vandaag starten.
- **Google Ads:** Zonder 30 conversies kan ik niet naar target-CPA; moet CPL meten zodra credentials eraan. Daarna: per dienst apart CPA-doel (zonwering vs rolluiken anders).
- **Wachtposten:** V2+V3 blijven blokkades totdat Daimy credentials/key geeft; vandaag V1 testen via mail-OR.
- Vanaf nu: Mailklikrate-dips zeggen: "controle A/B subject/body (Apple MPP is voor open-rate, niet klik)"; CPL rapporteren zodra mogelijk per dienst; reviews rapporteren tegen 90%-24u-doel.

## Bijscholing 2026-08-29
- Vakkennis.md aangemaakt (ads, e-mail, SEO, reviews best practices 2026).
- Vanaf nu: CPL/CPA per kanaal apart rapporteren zodra leaddata er is, klikrate/conversie
  zwaarder wegen dan open-rate (Apple MPP vertekent open-rate), reviews vragen vlak na
  oplevering, SEO/review-bulkvoorstellen eerste als 1 proefgeval.

## Acties wachtrij (9 sep)
- V1: Mailklikrate KRITISCH (ACHT dagen < 1%). A/B-test autorisatie nodig (subject/body offerte-opvolging) — 48u meetperiode, 1 proefgeval eerst.
- V2: Google Ads credentials — Daimy URGEND. Geen CPL/lead-data sinds 1 sep zonder dit (9 dagen).
- V3: Reviews API-key — Daimy + Bo. Nul review-data sinds 29 aug (11 dagen).
- Mailrapport van 8 sep verwacht (maandag-schema, zou vandaag/morgen moeten komen).
- SEO: 12e dag zonder leads; week-report zaterdag 13 sep.

## Learnings 9 sep
- Mailklikrate: ACHT dagen achter elkaar onder 1%. Pattern: 2 sep 0,30%, 5 sep 0,70%, 7 sep 0,76%. Niet Apple MPP (verdeling offerte-opvolging 0,00-0,81% vs Tekenbonus 1,74-4,49% wijkt af). Content-issue: subject/body passend niet voor offerte-context.
- Offerte-opvolging worst performer (0,00%-0,81% klik, norm 2,00%). Reactivering 0,57-0,72% ook laag. Tekenbonus 4d 1,74-4,49% dicht bij/boven norm — dit is verschil in messaging/timing.
- SEO-agent: nul leads sinds 29 aug (12 dagen). Dagelijks 100 pagina's, 50 open. Week-report (7 sep): 13 content-suggesties (0 zakelijk), 14 links in "wachten-op-livegang", geen ranking-data (geen Search Console key).
- Reviews-sync: 177+ "geen API-key"-entries in gisteren's log — V3 blokkade persistent sinds 29 aug (11 dagen).
- Google Ads: exit code 2 persist dagelijks 07:10 — V2 blokkade sinds 1 sep (9 dagen).
