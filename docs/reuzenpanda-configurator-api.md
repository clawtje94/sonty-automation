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

## Volgende stappen

1. ⏳ Casper: Daimy toevoegen aan Sonty test profiel + schrijfrechten widget-service voor API-user
2. Sunmaster modellen/maten/opties inventariseren vanaf dealerportaal
3. Per productcategorie configurator bouwen op testprofiel (zelfde logica als bestaande, maar met prijsindicatie)
4. Toppoint raamdecoratie-configurator toevoegen
5. Review door Daimy via hub → daarna live profiel

## Verkenningsscripts

- `scripts/explore-rp-configurator.js` — login + profielen + routes
- `scripts/explore-rp-configurator2.js` — formulieren-sectie + API-call capture
- `scripts/explore-rp-configurator3.js` — bestaande configurators read-only dumpen
