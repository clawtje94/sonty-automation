# Google Ads API — eenmalige setup (voor Daimy)

Doel: `scripts/google-ads-api.js` haalt dagelijks spend/kliks/conversies per campagne op
(zoals de Meta-koppeling sinds 20-08). Zonder deze stappen blijft Google-data op 31-07 staan.

## Stap 1 — Developer token (5 min)
1. Log in op het Google Ads **manager-account (MCC)** → Beheer → **API-centrum**.
2. Vraag een developer token aan (basis-toegang is genoeg: alleen-lezen rapportage).
3. Zet in `~/sonty/.env`: `GOOGLE_ADS_DEVELOPER_TOKEN=...`

## Stap 2 — OAuth-client (5 min)
1. https://console.cloud.google.com → project (mag het bestaande Sonty-project zijn) →
   APIs & Services → Credentials → **Create OAuth client ID** → type **Desktop app**.
2. Zet in `.env`: `GOOGLE_ADS_CLIENT_ID=...` en `GOOGLE_ADS_CLIENT_SECRET=...`
3. Zet ook het klantnummer erin (zonder streepjes): `GOOGLE_ADS_CUSTOMER_ID=...`
   en bij een MCC erboven: `GOOGLE_ADS_LOGIN_CUSTOMER_ID=...`

## Stap 3 — Refresh token (2 min, eenmalig)
```
node scripts/google-ads-api.js --auth-url     # open de URL, log in, kopieer de code
node scripts/google-ads-api.js --code <code>  # print de GOOGLE_ADS_REFRESH_TOKEN-regel voor .env
```

## Stap 4 — Testen en aanzetten
```
node scripts/google-ads-api.js --droog        # proefdraai, schrijft niets
node scripts/google-ads-api.js                # echte run → data/campagne-spend-google.json
launchctl bootstrap gui/501 ~/Library/LaunchAgents/nl.sonty.google-ads.plist   # dagelijkse job aan
```
De job staat al klaar (07:10, log: logs/google-ads.log) maar is bewust nog niet geladen.
