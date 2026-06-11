# Reuzenpanda Configurator API (nieuw testprofiel)

*Aangemaakt: 2026-06-11. Doel: Sonty-producten (Sunmaster buiten + Toppoint binnen) zelf bouwen in de Reuzenpanda backend.*

## Toegang

| Wat | Waarde |
|---|---|
| Profiel | **Sonty test** — `23944e59-c24d-4032-a9fa-dbdb6f52bc94` |
| API-user | `api.6089227ab9d44ae9996e4db2a86dcac3@no-reply.reuzenpanda.nl` (role `API`, `hub_mode: DISALLOW`) |
| Credentials | `data/rp-api-credentials.json` |
| Login | `POST https://backend.reuzenpanda.nl/authentication-service/login-api` met `{email, password}` → `sessionKey` (`Bearer_eyJ...`) |
| Auth-header | **`X-AUTHORIZATION: <sessionKey>`** (let op: niet `Authorization` — die werkt alleen op authentication-service) |
| Docs | https://api.reuzenpanda.app (Redoc, spec: `/openapi.yaml` → `data/rp-openapi-v3.yaml`) |

Gebruikers op het testprofiel: Casper Torén (casper@reuzenpanda.nl) + de API-user. **Daimy nog niet** — Casper moet daimyboot@gmail.com toevoegen zodat Daimy kan meekijken via hub.reuzenpanda.nl (bedrijfskeuze → Sonty test → Formulieren).

## Permissies API-user (stand 2026-06-11)

Werkt (200):
- `GET /widget-service/{pid}/configurators` — configuratorlijst (nu leeg)
- `GET /company-profile-service/get-company-profiles`
- `GET /contact-service/{pid}/boards`, `/event-types`
- `GET /document-service/v1/{pid}/templates`, `/quotations`
- `GET /trigger-service/api/v1/list`

Geblokkeerd (`INVALID_PERMISSION`):
- `POST /widget-service/{pid}/configurators` (aanmaken)
- `GET /widget-service/{pid}/configurators/optimized`, alle template/product-template paden
- → **schrijfrechten op widget-service aangevraagd via Daimy bij Casper**

## Configurator-datamodel

De builder leeft in `widget-service`. Voorbeelden van het bestaande Sonty B.V.-profiel (`731483fa-ef6b-4aae-afcf-883ec09219dd`, read-only opgehaald): `data/rp-configurator-voorbeelden/`. 7 bestaande configurators: Knikarmschermen, Screens, Uitvalschermen, Pergola, Rolluiken, Serre zonwering, Markies.

Structuur per configurator:

```
configurator
├── id, templateId, name, locale, domains, type, show
├── advancedSettings / displaySettings / analyticsSettings / style
├── priceCalculationType, resultScore (huidige Sonty-configurators: null — geen client-side prijs)
├── steps[]            (type: PAGE | FINAL_PAGE, position)
│   └── questions[]    (type: RADIO | NUMBER | TEXT, required, position)
│       └── metaData
│           ├── RADIO: answers[] {id, text, position, metaData: {description, image}, conditions}
│           └── NUMBER: {min, max, step, placeholder}   ← bv. breedte 2800–5500mm
└── relations[]        {from: stepId, to: stepId, conditionType: NO_CONDITION | AND, conditions[]}
```

**De logica** (zoals in de bestaande Knikarmschermen-configurator): Keuzemenu (RADIO) → per model een eigen pagina (Sunbasic open/gesloten cassette, Suneye) → kleur (RAL met foto), bediening (handbediend / Somfy WT / Somfy IO), breedte (NUMBER met echte min/max van het model) → conditionele relaties sturen naar de juiste uitval-pagina (bv. breedte >5500mm → andere uitvalopties). Afbeeldingen staan op `user-info.reuzenpanda.nl/widget-service/product-templates/configurators/{configuratorId}/...`.

## Productbronnen voor de nieuwe build

- **Sunmaster** (buiten): dealer.sunmaster.nl — Info@sontymontage.nl (ALLEEN LEZEN). Knikarm, uitval, screens, rolluiken, markies, pergola.
- **Toppoint** (binnen): prijsdata al geparsed in `~/zonweringdirect/data/toppoint-parsed-prices.json` (24k prijspunten, 61 grids, 20 types). Rolgordijn, duo-plissé, jaloezie, vouwgordijn, etc.
- Gripp-koppeling productnamen: `data/product-mapping-rp-gripp.json`; montagetijden: `data/product-tijden.json`.

## Schrijf-API (bevestigd werkend, 2026-06-11)

- **Create/update configurator**: `PUT /widget-service/{pid}/configurators?templateId=` met `{configurator: {...}}` → 201/200. Het hele model (steps, questions, relations, style, settings) gaat in één call. UUID's worden client-side gegenereerd. Update = zelfde call met `id` gezet.
- **Delete**: `DELETE /widget-service/{pid}/configurators/{id}` → 200
- De API-user mag dit gewoon (eerdere POST-test was het verkeerde werkwoord — het is PUT)
- Condities in relations verwijzen naar `questionId` + `value` (= answer-UUID bij RADIO, getal bij NUMBER) → bij klonen ALLE id's globaal hermappen, behalve afbeelding-URL's
- Contactvelden mappen via `technicalType`: FIRST_NAME, LAST_NAME, EMAIL, PHONE, adresvelden

## Artikelen (inventory-service)

- `GET/POST /inventory-service/{pid}/articles`, `GET/POST /inventory-service/{pid}/categories`
- Artikel-payload: `{article: {id, companyProfileId, name, sku, description, imageSrc, archived, categoryId, salesPrice: {isoCurrency, amount, inclusiveExclusive: "inclusive", vat}, purchasePrice}}`
- ⚠️ API-user heeft hier GEEN rechten (alleen `/sync`) — sync loopt via Daimy's hub-sessie (Playwright). Aan Casper vragen: inventory-service rechten voor de API-user.
- Hub UI: Artikelen-module met import/export-knoppen (handmatig prijsbeheer voor Daimy)

## Gebouwd op Sonty test (2026-06-11)

- **7 configurators** (gekloond van Sonty B.V., ID's hermapt, vraagvolgorde logisch gemaakt: maten → kleur → bediening): Knikarmschermen, Screens, Uitvalschermen, Pergola, Rolluiken, Serre zonwering, Markies. ID's in `data/rp-testprofiel-configurators.json`. Staan op `show: false` (nog niet live).
- **381 artikelen in 9 categorieën** (Knikarmschermen 83, Uitvalschermen 129, Serre 72, Pergola 37, Rolluiken 20, Screens 18, Markiezen 4, Montage 10, Accessoires 8) — bron: Sunmaster Prijscatalogus 2026 + 10% markup.

## Prijzen aanpassen (de "makkelijke functie")

1. **Per categorie**: pas `marge_per_categorie` aan in `data/rp-prijzen.json` (bv. 1.05 = +5%) → `node scripts/sync-rp-artikelen.js`
2. **Per artikel**: pas `verkoop_incl` aan in dezelfde file → zelfde sync
3. **Handmatig**: hub → Artikelen → categorie openklikken, of via Exporteer/Importeer artikelen
4. Bron-prijzen opnieuw genereren uit de Sunmaster-catalogus: `python3 scripts/genereer-rp-prijzen.py`

## Scripts

- `scripts/build-rp-testprofiel.js` — bouwt/updatet de 7 configurators op het testprofiel (idempotent)
- `scripts/genereer-rp-prijzen.py` — genereert `data/rp-prijzen.json` uit de Sunmaster-catalogus
- `scripts/sync-rp-artikelen.js` — synct prijzenfile → RP-artikelen (idempotent, ruimt testrommel op)
- `scripts/dump-rp-configurators.js` — referentie-dump van Sonty B.V. configurators
- `scripts/analyse-rp-configurators.py` — genereert `data/rp-configurator-voorbeelden/STRUCTUUR.md`
- `scripts/explore-rp-configurator*.js`, `capture-rp-*.js` — verkenning/captures

## Open punten

1. ⏳ Casper: inventory-service rechten voor de API-user (nu via browsersessie)
2. Prijsindicatie ín de widget: `priceCalculationType: LOGIC_SCORE` + `resultScore` bestaat maar de editor-UI voor scores is nog niet gevonden; huidige flow (prijsvoorstel via offerte-automation) werkt ook met artikelen
3. Koppeling configurator-antwoorden → offerte met artikelen (automation in RP — uitzoeken hoe Casper dit voor Sonty B.V. heeft ingericht)
4. Toppoint raamdecoratie-configurator (data ligt klaar in `~/zonweringdirect/data/toppoint-parsed-prices.json`)
5. Eigen productfoto's uploaden (nu verwijzen afbeeldingen naar de oude Sonty B.V. uploads — werkt, maar niet zelf beheerd)
6. Review door Daimy → daarna live profiel

## Huidige LIVE inrichting (oude widget, gedecodeerd 2026-06-11)

Daimy's mail "producten" (widget.json + product.json) = export van de live "Direct Samenstellen"-widget op sonty.nl/offerte. Actuele versie zelf opgehaald via de **publieke** endpoints (geen auth):
- `GET backend.reuzenpanda.nl/widget-service/get-widget?id=4909baad-1717-4bfa-a93a-ba9355f7a9e3`
- `GET backend.reuzenpanda.nl/widget-service/get-widget-templates?id=...` (52 producten)
- Opgeslagen: `data/rp-configurator-voorbeelden/live-widget.json` + `live-product-templates.json`

**Logica van het huidige systeem** (product-templates met upsell-ketens):
1. Hoofdcategorie (Knikarmschermen/Screens/...) → upsell "Maak je keuze" → modellen
2. Model (bv. Sunbasic open cassette, met doekkleur-optie) → upsell "Maten" → **breedte-staffel-producten** ("Breedte tussen 3201-3400 mm")
3. Staffel-product: Breedte (RANGE binnen staffel), Hoogte/Uitval (RANGE), Framekleur (choices, fixed_price_value meestal 0), Bediening (choices met meerprijzen, bv. rolluik: draaischakelaar −100, motor+afst. +75, solar +314)
4. Losse producten voor montage ("Inclusief montage ...") en accessoires (windsensor, app-bediening)
5. Prijs = staffel-basisprijs + som van fixed_price_value's (basisprijzen zitten server-side in de offerte-automation, niet in de publieke payload)

**Wat de nieuwe build hiervan overneemt**: de staffel-prijslogica en meerprijzen (zit al fijnmaziger in `data/rp-prijzen.json` per exacte maatcombinatie), montage als aparte artikelen, de upsell-volgorde als vraagvolgorde. **Wat beter wordt**: één vragenflow per categorie i.p.v. tientallen losse staffel-producten (52 stuks, allemaal status DRAFT), echte min/max per model, prijzen centraal aanpasbaar per categorie.
