# Sonty — Overdracht / stand van zaken (bijgewerkt 2026-07-05)

> Dit document is het startpunt voor een nieuwe Claude-sessie (welk Anthropic-account dan ook).
> Lees dit eerst, daarna de memory-index. Alle code staat in git (beide repos gepusht).

## Repos (alles gecommit + gepusht)
- `~/sonty` → GitHub `clawtje94/sonty-platform` (automation, AI-KS, v4 offertecontrole)
- `~/sonty-website` → GitHub `clawtje94/sonty-website` (Next.js site + offerte-tool). Deploy: `vercel build --prod --yes && vercel deploy --prebuilt --prod --archive=tgz`. Git author MOET `daimyboot@gmail.com` zijn.

## VERPLICHTE eerste actie elke sessie
`cd ~/sonty && node scripts/read-telegram-webhook.js` — leest Telegram-berichten van Daimy. Elke vraag/toestemming ALTIJD ook op Telegram stellen (bot @Sontysuperbot, chat_id 1700128390). Nederlands, je-vorm.

## Draaiende processen op deze Mac (los van Claude-account)
- **AI-KS test-watcher**: `nohup node scripts/ai-ks/daemon.js --watch 720 --only-test >> data/ai-ks/watch-test.log 2>&1 & disown`
  - Reageert LIVE, maar ALLEEN op de 3 whitelist-testnummers (config.js TEST_LIVE_PHONES): 31683500506 (Daimy), 31636516410 (Jarne), 31628209480.
  - Stopt na het watch-venster; herstart met bovenstaande regel (nohup verplicht, anders kilt de Bash-timeout hem). Check: `ps aux | grep "[d]aemon.js --watch"`.
  - MODE is SHADOW tenzij `scripts/ai-ks/.live-enabled` bestaat met inhoud "JA ECHT" (alleen Daimy mag dat aanmaken). Whitelist-nummers krijgen wél echte antwoorden via de dubbele check.
- **launchd crons** (~/Library/LaunchAgents/nl.sonty.*): o.a. offerte-v4 (productie offertecontrole), telegram-poll. Herinnerings-WhatsApps (followup-whatsapp) staan UIT sinds 3 juli (WhatsApp spam-waarschuwing) — plist in ~/Library/LaunchAgents/uitgeschakeld/, NIET heraanzetten zonder opdracht.

## Wat deze sessie (3-5 juli) is gebouwd — AI-KS (`scripts/ai-ks/`)
Autonome AI-klantenservice (Opus 4.8, persona "Jaimy"), shadow + live-op-whitelist. Kernregels in system-prompt.js:
- Framekleur ALTIJD uitvragen (prijseffect); doekkleur mag naar inmeten.
- Verplichte volgorde naar inmeten (technisch geblokkeerd): offerte-link via WA gedeeld → akkoord op die offerte → keuzevraag "zelf tekenen of ik regel het" → pas dan status naar "Inmeten inplannen" (2e9819bd-...). Klant kan NOOIT zelf plannen; bookingslink alleen voor showroom.
- Onbekend nummer → vraag of ze al een offerte hadden, zoek op mail/offertenr (gericht, nooit lukraak). Nieuwe klant → complete gegevens (naam+tel+mail+adres) vóór offerte/inmeten.
- Nieuwe offerte gevraagd → offerte_aanmaken (widget-flow + auto-nalevering link). Na verstuurde/aangepaste offerte → RP-status "Ai offerte verstuurd" (dc0efe4f-...).
- Offertenummer ALTIJD los meesturen bij de link.
- €75 = inmeetkosten als niks afgenomen na inmeten (kaal, geen Máxima). €75 mét €25 Máxima = demontage/afvoer oud product. Twee losse dingen.
- Vaste posten: hoogwerker €650/dag (boven 2e verdieping), demontage oud product €75, verlengde muursteunen €150.
- Leervragen: twijfel/onbekend antwoord → escaleren_naar_mens met leervraag=true → gaat naar Telegram, gesprek blijft open. Log: data/ai-ks/leervragen.jsonl.
- Klachten/productfoto's/montagevragen-met-situatiefoto's → altijd escaleren naar mens.
- 15% actiekorting op ALLES, als groupDiscount (nooit als productregel — dubbele-korting-bug).

## Wat deze sessie is gebouwd — offerte-tool (`~/sonty-website`, `/admin/offerte-tool`)
- **Roma-producten**: romaZipscreen + drie rolluik-uitvoeringen: .XP geëxtrudeerd (premium, geïntegreerde insectenrolhor als optie: €138/m² netto, min 1 m², max 1500mm breed/2500mm hoog), .P geëxtrudeerd en .P gerolvormd (instap; solar = Elero-pakket +€728 netto, geen eigen matrix). io én solar (eigen tabellen). Data: `data/roma-prices-2025.json` (synchroon in beide repos). Vanaf-maten open: onder kleinste staffel = prijs kleinste staffel (regel Daimy 2026-07-05); knikarm-minima en Unilux-bestelminima blijven technisch geblokkeerd. Rekenregel Daimy: klantprijs incl BTW = Roma netto boekprijs × 1,15, daarna 15% actie als groupDiscount. Roma-solar is DUURDER (Somfy premium; geen Brel bij Roma). 209 RAL-kleuren gratis. Maatgrenzen per bediening zichtbaar; foutmeldingen noemen echte grenzen + io-alternatief. Roma-uitlegvlak in UI + "Waarom ROMA?"-blok op offerte.
- **Roma duo-offerte** (`~/sonty/scripts/roma-duo-offerte.js`): v4 maakt bij elke rolluik/screen-offerte automatisch een APART Roma-document met merkverhaal. Dedupe: data/roma-duo-gemaakt.json.
- **Kortingsbug gefixt**: tool zette korting als productregel → dubbel. Nu groupDiscount server-side, oude regels auto-opgeruimd. Korting reset per offerte (toont echte groupDiscount, nieuw = 15%).
- **Klant zoeken**: postcode+huisnummer (apart) / naam / telefoon → lijst openstaande offertes, direct te openen.
- **Winkel/Online-keuze** bij nieuwe offerte → RP-herkomst + sheet-kanaal. Online → na opslaan naar "Offerte verstuurd" (15c4f0be-...) zodat klant auto WA-link krijgt; winkel blijft in Winkel-kolom (058e79f8-...).
- **PDOK**: postcode+huisnummer vult straat/plaats automatisch (api.pdok.nl/bzk/locatieserver/search/v3_1).
- **Montage-uitvoering**: Standaard/Op uitbouw (knikarm €325 i.p.v. €275, v4-tarief).
- **Tool-leads in de sheet**: v4 neemt de Winkel-kolom mee naar offerte-register.
- **Kleur-dropdowns**: standaardkleuren per product (dropdown); trend/RAL = vrij tekstveld.
- **PDF-download**: officiële RP-artifact-PDF geproxied (`action=pdf` → renderer/v1/.../artifact.pdf), exacte RP-opmaak zonder ondertekenvlak.
- **UX**: maatvelden leeg by default, klantgegevens altijd bovenaan editor, "+ Nieuwe offerte"-knop wist alles.
- **Horren-minima**: echte Unilux-bestelgrenzen i.p.v. staffel-ondergrens (kleiner = prijs kleinste staffel). Gedocumenteerd: Comfort min 440mm hoog, Super+ min 300mm breed. Standaardkleuren: RAL 9001/9010/7016 STR/9006/9005 STR.

## Prijsboeken ingelezen (NIET overal gekoppeld)
- **Roma 2025**: `data/prijsboeken/roma-extract/` (13 md-bestanden, cel-voor-cel geverifieerd tegen pdftotext-tekstlaag `data/prijsboeken/roma-tekst/`, ±11.500 correcties). Overzicht: `docs/roma-prijsstructuur-2025.md`. KRITIEK: Roma = netto EXCL BTW; Sunmaster = advies INCL BTW. LES: extractie op beelden verzint prijzen — ALTIJD tegen tekstlaag verifiëren.
- **Unilux horren 2026**: `data/unilux/` (catalogus + prijslijst + meetformulier). Bestelmaten: `data/unilux/echte-bestelmaten.md`.

## Openstaand / wacht op Daimy
0. **WA verkeerde offerte-link (6 juli)**: 13 klanten kregen de Roma duo-link i.p.v. hun hoofdofferte (WA-cron pakte nieuwste SENT offerte; duo-batch van 09:32 was nieuwer). Bug gefixt (duo-docIds uitgesloten, commit dc2fdc0). Lijst: `data/wa-verkeerde-link-2026-07-06.json`. Wacht op Daimy: alsnog juiste link sturen / handmatig / laten.
1. **Garantie-inconsistentie** (belangrijk): mail zegt "5 jaar montage", v4-offertes "3 jaar montage | 5 jaar product | 7 jaar motor", oude v4-regel "2 jaar montage | 3 jaar product", kennisbank "5+7 jaar". MOET één lijn worden — vraag Daimy de juiste cijfers en trek overal gelijk.
2. **Buitenjaloezie-uitvoering Roma**: welke (Raffstore .P/.XP of MODULO) + lameltype (CDL70/ZL81/DBL70/GL85)? Dan in tool + TRENDO schuine rolluiken (hellingshoek-UI) afmaken.
3. **RP-automation mail** ("binnen 24u" bij tool-contacten): moet in Reuzenpanda zelf uitgezet worden op herkomst=Winkel (onze API-token heeft geen automation-rechten). Verbeterde prijsvoorstel-mail geleverd in chat, wacht op akkoord + garantie-cijfers.
4. **Roma-marge/bezorging**: duo-offerte staat klaar naast hoofdofferte — moet de klant beide links automatisch krijgen of stuurt team handmatig?
5. **Voorraadschermen** (aanbetaald, geen eindfactuur): 11 stuks (5 beige, 3 grijs, 4 kleur onbekend). 4 zonder kleur nazoeken in RP/HubSpot. Peter van der Maat staat lang open (jan). Data: `data/voorraadschermen-open.json`.
6. **Beleidsvragen analyse §6**: burenkorting-regel, kortingsmandaat AI (nu max 17,5%), service-nodi.nl, orderstatus-toegang.
7. AI-KS niet live buiten whitelist tot Daimy akkoord (fase-1 shadow-cron voor alle gesprekken wacht).

## Credentials & IDs
Alles in memory: `~/.claude/projects/-Users-clawdboot/memory/reference_sonty_credentials.md` + `reference_reuzenpanda_api.md`. RP: PID 731483fa-ef6b-4aae-afcf-883ec09219dd. Anthropic API-key: `scripts/.anthropic-api-key.txt` (tegoed kan opraken — Daimy laadt bij).
