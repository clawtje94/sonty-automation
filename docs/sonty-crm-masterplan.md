# Sonty CRM — Reuzenpanda vervangen op eigen platform

> Besluit Daimy 2026-07-08: uitwerken en bouwen. Aanleiding: RP kost €1.000+/maand,
> API is traag en fragiel (16k items zonder filter, 504's, board-endpoint verzwijgt
> kolommen, geen automation-rechten op mail), en de kwaliteit is ondermaats.
> Besparing: €12.000+/jaar. Platform: sonty-website (Next.js 16 + Supabase + Vercel).

## Wat RP vandaag doet → wat het wordt

| RP-functie | Vervanging | Status |
|---|---|---|
| Configurator-widget op sonty.nl (lead-intake) | Eigen configurator (staat al live, betere prijzen) | ✅ bestaat |
| Prijsindicatie/offerte maken | Offerte-tool admin (alle producten incl. Roma/Unilux) | ✅ bestaat |
| Offerte-PDF | Eigen PDF-generator + RP-artifact-proxy | ✅ bestaat |
| Klantportaal: offerte online bekijken + ondertekenen | **FASE 1: /offerte/[token] + digitaal akkoord** | 🔨 bouwen |
| Offerte-mail bij "verstuurd" | **FASE 1: eigen mail (Trengo Aanvragen-kanaal, zoals duo-mail)** | 🔨 bouwen |
| Pipeline-bord (team werkt er dagelijks in) | **FASE 2: /admin/pipeline op Supabase** | 🔨 bouwen |
| Lead-opslag + historie (16,7k items) | **FASE 3: migratie naar Supabase** | later |
| Statuswissels → automations (v4, AI-KS, WA) | Zelfde automations, maar op Supabase (sneller/betrouwbaar) | fase 2/3 |

## Architectuur

- **Data**: Supabase (Postgres). Kern-tabellen:
  - `klanten` (naam, e-mail, telefoon, adres, bron, rp_lead_id voor migratie)
  - `offertes` (nummer, klant_id, status, regels JSONB, group_discount, totalen,
    geldig_tot, public_token, gemaakt_door, timestamps)
  - `offerte_events` (offerte_id, type: aangemaakt/verstuurd/bekeken/ondertekend/
    afgewezen/herinnering, meta JSONB: ip, user_agent, naam_ondertekenaar, hash — audit-trail)
  - `pipeline_statussen` (naam, volgorde, kleur, automation_hooks)
  - `taken` (bel-taken, follow-ups — vervangt later de sheet-kolommen)
- **Ondertekenen (eIDAS "gewone elektronische handtekening" — voldoende voor offerte-akkoord)**:
  klant opent unieke tokenlink → ziet offerte → typt naam + vinkje akkoord →
  wij loggen naam, tijdstip, IP, user-agent en SHA-256 van de offerte-inhoud →
  bevestigingsmail naar klant én team → PDF met ondertekenblok gearchiveerd.
  Bewijsbaarheid = de audit-trail; dit is juridisch gelijkwaardig aan RP's DOCSIGN.
- **Nummering**: eigen reeks (bv. S-2026-0001) naast RP-nummers tijdens de overgang.
- **Mail**: via Trengo Aanvragen-kanaal (werkt al, zie duo-mail) — reply's komen
  gewoon in de teaminbox. Later evt. Resend voor transactioneel.
- **Auth**: bestaande admin-login; pipeline krijgt per-gebruiker naam (voor "wie heeft wat gedaan").

## Fases

**Fase 1 — Offerte + ondertekenen (NU bouwen)**
1. Supabase-schema (bovenstaande tabellen)
2. Offerte-tool krijgt "Publiceer Sonty-link": slaat offerte lokaal op + genereert token
3. Publieke pagina `/offerte/[token]`: Sonty-huisstijl, productregels, korting,
   totalen, geldigheid, "Waarom Sonty", akkoord-flow + afwijzen-met-reden
4. Events + mails (verstuurd/ondertekend) + Telegram-melding bij akkoord
5. Parallel: RP blijft leidend; elke Sonty-link is extra, geen risico

**Fase 2 — Pipeline-bord** (na akkoord team)
- `/admin/pipeline`: kolommen zoals RP (Offerte controle → Gecontroleerd →
  Offerte verstuurd → Akkoord → Inmeten → Besteld → Montage → Afgerond → Te ver/Verloren)
- Drag & drop, zoeken, filters, leadwaarde, WhatsApp/mail-knoppen, notities
- v4/AI-KS/WhatsApp-automations lezen Supabase i.p.v. RP (API wordt intern: <100ms i.p.v. 34s)
- Team draait 2-4 weken parallel met RP

**Fase 3 — Migratie + opzeggen**
- Export alle 16,7k RP-items + offertes → Supabase (rp_lead_id als koppel)
- Configurator-leads op sonty.nl direct naar Supabase (RP-widget eraf)
- RP opzeggen (LET OP: opzegtermijn checken in het contract!)

## Risico's & mitigatie
- **Team-adoptie**: fase 2 pas live na demo + akkoord team; parallel draaien; UI bewust RP-achtig
- **Uptime**: Vercel + Supabase (99,9%), dagelijkse Supabase-backup + wekelijkse export naar Sheet
- **Ondertekende offertes kwijtraken**: PDF + audit-trail ook naar e-mail/archief
- **Migratiefouten**: rp_lead_id bewaren, RP read-only aanhouden tot 1 maand na cutover

## Openstaande vragen aan Daimy
1. RP-opzegtermijn/contractdatum? (bepaalt tempo fase 3)
2. Eigen offertenummer-formaat OK? (voorstel S-2026-0001)
3. Wie van het team test fase 2 als eerste? (voorstel: Jaimy + Nanny)
