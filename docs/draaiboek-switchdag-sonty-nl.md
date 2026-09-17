# Draaiboek switchdag: sonty.nl van Webflow naar Vercel

Opgesteld 17-09-2026. Alles hieronder is voorbereid en gemeten; de switch zelf is twee DNS-records plus vier schakelaars. Terugdraaien kan op elk moment door de twee DNS-records terug te zetten.

## Stand van de voorbereiding (klaar)

- sonty.nl en www.sonty.nl staan in het Vercel-project (nog niet actief, wacht op DNS).
- Code: één site-URL (env NEXT_PUBLIC_SITE_URL), www → sonty.nl (301), noindex op *.vercel.app, cron-routes alleen met CRON_SECRET.
- Formulieren komen als open ticket op aanvragen@ in Trengo met bevestigingsmail en spam-rem (live bewezen 17-09).
- Verzendcentrum-proef in testmodus geslaagd (mail + klantlink + tekenen).
- Configurator: extra's, TaHoma, korting en voorraadscherm gecorrigeerd; klik-lab loopt dagelijks 04:15.
- Back-up KV dagelijks 03:30 (nl.sonty.kv-backup) + wachter 09:00; herstelproef geslaagd.
- Uptime-wacht nl.sonty.site-wacht (elke 5 min) bewaakt vercel.app; sonty.nl erbij zodra de vlag staat.
- Smoke-run 76/76 (desktop + mobiel) op de build van 17-09.

## D-1 (dag vóór de switch)

1. Neostrada: TTL van A @ en CNAME www op 300 seconden zetten (Daimy, of Claude met login).
2. Smoke-run opnieuw op de build die live gaat: `cd ~/sonty-website && PLAYWRIGHT_BASE_URL=https://sonty-website.vercel.app npx playwright test full-site.spec.ts` en `node scripts/klik-lab/configurator.mjs`.
3. Controleren dat er geen openstaande fouten zijn in `data/klik-lab-configurator.json` en dat `~/sonty/backups/kv/laatste.json` van vannacht is.
4. Aan Daimy: bevestiging dat de Google Ads- en Meta-beheerders weten dat de site wisselt (landingspagina's zijn dezelfde paden).

## D-dag, ochtend (rustig moment, bijvoorbeeld 07:30)

**Stap 1, Claude (2 min): site-URL omzetten.**
```
cd ~/sonty-website
vercel env rm NEXT_PUBLIC_SITE_URL production -y
printf 'https://sonty.nl' | vercel env add NEXT_PUBLIC_SITE_URL production
git commit --allow-empty -m "Domeinswitch: site-URL sonty.nl" && git push
```
Wachten op de GitHub Actions-deploy (`gh run watch`), ±3 min.

**Stap 2, Daimy of Claude (2 min): DNS bij Neostrada.**
- A-record `@` van 198.202.211.1 naar `76.76.21.21`
- CNAME `www` van cdn.webflow.com naar `cname.vercel-dns.com`
- Alles anders LATEN STAAN: MX, SPF (TXT), DKIM selector1/selector2, _dmarc, autodiscover, klaviyo-site-verification, A-record sst, wildcard *.

**Stap 3, Claude (direct daarna): verzendcentrum op eigen.**
Op /admin/verzendcentrum: bron eigen, testmodus uit, automatisch versturen aan, herinneringen aan. Vanaf nu krijgt elke configurator-aanvraag automatisch het prijsvoorstel (mail + WhatsApp + klantlink).

**Stap 4, Claude: uptime-wacht op sonty.nl aanzetten.**
```
touch ~/sonty/data/.site-wacht-sonty-nl
```

## D-dag, controle binnen 15 minuten (Claude)

```
curl -sI https://sonty.nl | grep -i "server\|x-vercel"          # server: Vercel
curl -sI https://www.sonty.nl | grep -i "location"               # 301 → https://sonty.nl/
curl -sI https://sonty.nl/diensten/shutters | grep -i location   # 308 → /diensten/binnenshutters
curl -sI https://sonty-website.vercel.app | grep -i x-robots      # noindex (alleen daar)
curl -sI https://sonty.nl | grep -i x-robots                      # leeg (wel indexeren)
```
- Cookiebot-banner zichtbaar op https://sonty.nl (domeingroep bevat sonty.nl).
- Tracking-meting: `node scripts/tracking-meting.mjs https://sonty.nl/configurator` (configurator.conversion, contact_form_submit).
- Eén echte testaanvraag via de configurator met een echt mailadres: lead in /admin/pipeline, prijsvoorstel-mail, klantlink op sonty.nl, Sheet-rij.
- Eén contactformulier: open ticket op aanvragen@ in Trengo, bevestigingsmail bij de afzender.
- Admin-inlog op https://sonty.nl/admin.
- Melding aan Daimy op Telegram: switch gedaan + de vijf metingen.

## D-dag tot D+14

- Search Console: property sonty.nl verifiëren, sitemap https://sonty.nl/sitemap.xml indienen, dagelijks dekking en 404's lezen (Daimy geeft toegang).
- Google Bedrijfsprofiel: website-link controleren.
- Webflow laten staan als terugvaloptie; niets opzeggen.
- Eerste 10 echte configurator-aanvragen persoonlijk volgen (verzendlog, Sunny, planner, Gripp bij akkoord).
- Scripts in ~/sonty die nog vercel.app-links versturen geleidelijk omzetten (blijven werken).

## Terugdraaien (bij een echt probleem)

1. Neostrada: A @ terug naar 198.202.211.1, CNAME www terug naar cdn.webflow.com (TTL 300 → binnen 5 min terug).
2. Verzendcentrum: bron rp, testmodus aan.
3. `rm ~/sonty/data/.site-wacht-sonty-nl`
4. NEXT_PUBLIC_SITE_URL terug op https://sonty-website.vercel.app + lege commit + push.

## D+14

- Webflow-hosting opzeggen (Daimy).
- Reuzenpanda-overstap (V20 en runbook) in eigen tempo daarna.
