# Sonty — Overdracht / stand van zaken (bijgewerkt 2026-07-09)

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
- **launchd crons** (~/Library/LaunchAgents/nl.sonty.*): o.a. offerte-v4 (productie offertecontrole), telegram-poll. **ALLE herinnerings-WhatsApp-crons staan UIT (Meta-blokkeringsrisico, opdracht Daimy):** followup-whatsapp (sinds 3 juli), + followup (followup-offertes.js) en followup-3d (followup-3dagen.js) sinds 7 juli. Alle drie plists in ~/Library/LaunchAgents/uitgeschakeld/, NIET heraanzetten zonder expliciete opdracht. LET OP: followup-offertes.js stuurde 7 juli nog 50 herinneringen (2626 in wachtrij) vóór het uitzetten — dát was de spam. offerte-v4 stuurt nog wél de transactionele offerte-LINK-WhatsApp (template offerte_met_link 235187, 11-68/run); wacht op Daimy of dat ook uit moet.

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

## CRM nabouw (RP vervangen) — ACTIEF sinds 8 juli
Besluit Daimy: RP (€1000+/mnd) vervangen door eigen CRM. Masterplan: `docs/sonty-crm-masterplan.md`.
**Fase 1 LIVE + getest (8 juli)**: offerte-tool knop "Sonty-link maken" → /offerte/[token] met ECHTE krabbel-handtekening (canvas, verplicht, PNG opgeslagen in lead.offerteShare.signedSignatureImage + IP/tijd audit). GEEN inmeet-voorkeursvelden (opdracht Daimy), geen verzonnen beloftes in teksten. Ondertekenen → status akkoord → Telegram. Linkstructuur sonty.nl ONGEWIJZIGD.
**Fase 2d LIVE (8 juli, n.a.v. RP-screenshot Daimy)**: deal-detail met RP-document-viewer — kaartjes tonen Offerte #nummer + statusbadge (Concept/Verstuurd/Ondertekend/Verlopen) + NL-datum; detailpaneel heeft Documenten-blok (klik = volledige offerte in Sonty-opmaak: bedrijfsgegevens Tel/Bank/Btw/Kvk, regels-tabel Omschrijving/Aantal/Prijs/Totaal/BTW, totalen, ondertekend-stempel, klantlink openen/kopiëren), Extra velden (leadwaarde/bron) en Omschrijving-blok. Publiceer-regels bevatten aantal+prijsPerStuk; RP-testoffertes opnieuw geïmporteerd met volledige data. AdminRail verborgen op loginschermen.
**Fase 2c LIVE (8 juli)**: vaste RP-navigatierail op ELKE admin-pagina (app/admin/layout.tsx + components/admin/AdminRail.tsx): Dashboard, Formulieren, Leads, Deals, Automatisering, Relaties, Artikelen, Offerte-tool, Belscherm, Meer. Nieuwe secties: /admin/relaties (unieke contacten uit leads, zoekbaar, bel/mail/WA), /admin/artikelen (productcatalogus uit prijsengine, 35+ artikelen), /admin/formulieren (site-formulieren met inzendingen per type). LET OP: sonty.nl draait nog op Webflow — admin leeft op sonty-website.vercel.app/admin (admin.sonty.nl koppelen = 1 CNAME in Cloudflare, wacht op Daimy).
**Fase 2b LIVE (8 juli, na verkenning van het echte RP-CRM met Playwright-screenshots)**:
- /admin/automations — automatiseringen zoals RP mét werkende aan/uit-toggles + run-tellers (lib/crm/automations.ts, KV crm:automations). Toggles zijn ECHT: createLead/changeStatus/shareOfferte/signOfferte checken automationActief(). Automations: nieuwe-lead-melding, offerte-mail-bij-delen, akkoord-naar-inmeten, melding-na-akkoord, melding-statuswissel.
- Pipeline-bord: RP-zijbalk (Open/Gewonnen/Verloren-tabs, datumfilter 7/30/90/alles, weergave Pipeline/Tabel, sorteren, kolommen aan/uit met localStorage), kaartjes met tel/mail/avatar, detailpaneel zoals RP (stepper, kolom-pill, gewonnen/verloren-knoppen, bel/mail/WhatsApp, contactblok, offerteregels, tijdlijn, opmerking toevoegen via add_interne_notitie).
- Daimy's RP-testoffertes geïmporteerd op het bord (20268595/20268614/20266838, kolom Offerte vestuurd) met werkende Sonty-links.
- LET OP: leads gebruiken veld `timestamp` (niet createdAt) — bord heeft aangemaakt()-fallback.
**Fase 2 LIVE (8 juli)**: /admin/pipeline met EXACT de 17 RP-kolommen (labels/kleuren/volgorde uit RP statuses-API, snapshot data/rp-pipeline-statussen.json; definitie lib/crm/rp-kolommen.ts, incl. RP-typefout "Offerte vestuurd"). Lead heeft rpKolom-veld met de RP status-id → migratie fase 3 wordt 1-op-1. Slepen = update_kolom; kolommen met gemapte interne status (Offerte vestuurd/Inmeten inplannen/Afgerond/te ver/Geen herinnering meer) triggeren changeStatus-automations (timeline/Telegram/Klaviyo). Getest: 17/17 kolommen zichtbaar, drag&drop server-side geverifieerd. Fase 3 = migratie 16,7k RP-items + RP opzeggen (opzegtermijn nog vragen aan Daimy).

## Prijsopbouw centraal + aanpasbaar (8 juli, architectuurpunt Daimy)
Regel Daimy: wat v4 handmatig corrigeert moet aan de BRON goed staan (configurator/offerte-tool), met één aanpasbare prijsstructuur. Gebouwd: lib/offerte-tool/prijsconfig.ts (defaults = v4-tarieven; KV-overrides crm:prijsconfig), pricing.ts rekent via injecteerbare rekenConfig (API-route laadt KV bovenaan GET/POST), beheer-UI = Prijsopbouw-blok in /admin/artikelen (markup/Roma-opslag/kleur%/handzender/voorraadactie), API /api/admin/prijsconfig. End-to-end getest: markup wijzigen verandert de berekende prijs direct, zonder deploy. VOLGT (configurator-blok): beschrijving-generator + optieblokken uit v4 naar de bron, zodat configurator-offertes meteen v4-kwaliteit zijn.

## Configurator → echte prijsengine (8 juli, blok 1 van de rebuild)
action=configurator-prijs (route offerte-tool) + lib/offerte-tool/configurator-map.ts: variant/bediening/framekleur → centrale prijsengine (incl. KV-prijsconfig). Backend cent-exact gelijk aan v4 (S-42 io 1670×1360 = €1.227,90 ✓, solar+RAL = €1.629,64 ✓). BELEID DAIMY 2026-07-08: GEEN prijzen zichtbaar in de configurator-UI (prijsindicatie komt per mail); engine-prijs blijft op de achtergrond voor lead/offerte. Maten = sliders + invulveld, vooringevuld op gangbare maat (midden bereik, per 50mm). Mobiele uitlijning gefixt: zijpadding cfg-root, gat boven stap 1 weg (paddingTop 80→24), sticky onderbalk gerepareerd (transform:none op stap-wrapper — translateY(0) brak position:fixed), Verder-knop full-width, breadcrumb autoscroll. Verzonnen claims uit productdata (40% isolatie/130 km/u/SKG); "tot 90% minder warmte" heeft bron (trengo-kennisbank:910). Hele mobiele flow visueel getest. VOLGT in de rebuild: stepper met vinkjes, meetinstructies+diagram, productvisual, URL-state, beschrijving-generator (v4-teksten aan de bron). Werkwijze-mandaat Daimy: doorbouwen + altijd backend & visueel testen tot goed (memory feedback_doorbouwen_testen). Open: bestaand "binnen 24 uur exacte offerte"-blok in cartstap laten staan, gemeld aan Daimy.

## Configurator-rebuild AFGEROND (9 juli, live op sonty-website.vercel.app)
Alle VOLGT-punten gebouwd + getest (desktop/mobiel, prod-verificatie, commit 5d0ce62):
- Stepper met groene vinkjes in de breadcrumb (afgerond=✓, actief=nummer).
- Meethulp-uitklap in Afmetingen: SVG-meetdiagram + in de dag/op de dag-instructies (geen kostenclaims; "monteur meet vóór productie").
- URL-state: ?product=&variant= deep-links (landen direct op de juiste stap), adresbalk volgt keuzes, onbekende ids worden genegeerd+opgeschoond. Deep-links bruikbaar voor ads/mail.
- Productvisual: echte RP-productfoto's in zijbalk + offerte-overzicht (geen verzonnen visuals).
- SAMENSPEL (opdracht Daimy 9 juli "alles moet samenwerken"): /api/configurator/submit rekent nu via de CENTRALE prijsengine (configurator-map + KV-prijsconfig, cent-exact = offerte-tool/v4; getest: S-42 io 1670×1360 = €1.227,90 ✓). Oude Sunmaster-engine alleen nog fallback voor niet-gemapte varianten (regel krijgt veld engine:"centraal"|"sunmaster").
- Beschrijving-generator aan de bron: lib/offerte-tool/beschrijving.ts (1-op-1 port van goedgekeurde v4 "Waarom dit product"-teksten, 2026-06-10); elke lead-regel krijgt veld beschrijving met klantkeuzes + Waarom-blok. Leads uit de configurator zijn zo meteen v4-kwaliteit.
- Fix: setOpts naar functionele updates (pill-keuzes konden elkaar overschrijven bij snelle opeenvolgende klikken).
- LET OP dev-testen: browser kan oude Turbopack-chunks cachen (zelfde chunknaam, oude inhoud); bij "edit doet niks" → prod-build checken i.p.v. eindeloos dev debuggen.
- Fix 9 juli: pagina sprong bij elke klik terug naar boven (breadcrumb-scrollIntoView vuurde op elke re-render); nu alleen horizontale kruimel-scroll bij stapwissel. Prod-getest: klik en slider behouden scrollpositie.
- Aanvulling 9 juli (feedback Daimy): maatrange-keuzestap VERWIJDERD — klant ziet één breedteschuif over het hele bereik; de interne band (uitval-opties/max-hoogte/bediening per band) wordt automatisch gemapt op de breedte en is nergens meer zichtbaar (ook badge weg). Band blijft intern in lead-payload (options.maatrange). Mobiele sticky Verder-balk op de optiestap ook weg (eerst alles afronden, knop onderaan is de enige doorgang). Getest op prod: knikarm uitval wisselt per band (4250→4 opties, 5800→3), screens max-hoogte wisselt (2300→2800mm, 3900→2000mm).

## Terminologie prijsindicatie vs offerte (9 juli, regel Daimy)
Alles wat via de configurator binnenkomt = **prijsindicatie** (op ingevulde maten/opties); de **definitieve/harde offerte** maken wij pas na het inmeten op de daadwerkelijke maten. Site-breed doorgevoerd (configurator-UI, homepage, header/footer, contact, reviews, blog, diensten, 404, WhatsApp-widget) en live gedeployed. Routes + SEO-metadata (/offerte-aanvragen) bewust ongewijzigd; zakelijk blijft "offerte" (loopt niet via configurator); admin/offerte-tool blijft "offerte". Branch `prijsindicatie-terminologie`, PR #6 (sonty-website) staat klaar om te mergen — prod is al vanaf die branch gedeployed, dus mergen houdt git en prod gelijk. V4-optieblok-slotzin geneutraliseerd (sonty-platform main).

## Vertragingsmail VERSTUURD (9 juli)
Alle 60 unieke klanten uit sheet-tab "Vertraging. " gemaild ("Update over je bestelling bij Sonty", akkoord + startsein Daimy): uitleg vertraging, FIFO zonder uitzonderingen, niet bellen, 3-4 weken inlopen, contact zodra product binnen. Scripts: vertraging-mail.js (bulk vereist akkoord-vlag; verstuurd-log data/vertraging-mail-verstuurd.json voorkomt dubbel), vertraging-maillijst.js (lijst + Gripp-voornamen). NIET gemaild (geen bruikbaar adres): Koen Zitoen, Leco van Zadelhoff, de Bruin (4 Gripp-matches). Reacties komen binnen op Trengo "Aanvragen". Tekst: docs/concept-vertragingsmail.md.

## Configurator keuzehulp uit kennisbank (9 juli, live)
Opdracht Daimy: klantenservice-info in de configurator. Gebouwd: lib/configurator/keuzehulp.ts (sonty-website) met teksten 1-op-1 uit data/trengo-kennisbank.md (delen 2-9), bewust ZONDER bedragen (geen prijzen in configurator). UI: varianthulp-uitklap op variantstap (screens/knikarm/uitval), "Goed om te weten over [product]"-uitklap op optiestap (alle 6 productgroepen), "Hulp bij je kleurkeuze"-uitklap boven kleurpills, en live uitleg onder de gekozen bediening (io/solar/draai/slinger/band, ook bij bedieningOverride). Prod-getest.

## Configurator A-Z ronde 2 (9 juli, live) — Roma/horren/vanaf-prijzen
Opdracht Daimy: alle verkochte producten met bekende prijzen erin + prijsverschil tussen varianten tonen + A-Z checken.
- NIEUW: ROMA zipSCREEN.2 onder screens; 3 ROMA-rolluiken (.XP premium met insectenrolhor-upsell, .P geëxtrudeerd, .P gerolvormd) onder rolluik; markies hardhout + aluminium erbij; NIEUWE categorie Horren met 12 Unilux-varianten (rolhorren/vaste horren/plissé/hordeuren) incl. gaaskeuze (standaard/pollen/petscreen) die de engine via de bediening-param prijst (mapBediening hor→gaas*).
- VANAF-PRIJZEN op variantkaarten (wens Daimy, versoepelt "geen prijzen"-beleid op variantniveau): action=configurator-vanaf, berekend uit centrale engine (kleinste maat, io, standaardkleur, incl. montage). Windvast €1342 vs Niet windvast €969 vs ROMA €1338; Suneye €2823 vs Sunbasic €2408 enz.
- GEFIXT n.a.v. audit (elke variant × bediening tegen engine getest): solar ontbrak bij screens (nu bij Windvast, Niet windvast in alle 5 banden); Windvast had dubbele "Motor bedraad"-keuze (weg); SunEye-minimum 2450→2690 en SunElite 2450→3150 (echte technische minima engine); markies hoogte/uitval-max 3500→2000 (engine-grens); upsell-keuzes (extras) gingen NIET mee in de lead → nu wel (options.extras); USP-badges liepen op desktop buiten de productkaarten (whiteSpace nowrap weg).
- Beschrijving-generator: ROMA-varianten krijgen het goedgekeurde "Waarom ROMA?"-blok (nooit de Sunmaster-tekst "Nederlands geproduceerd"). Keuzehulp uitgebreid: rolluik- en horren-varianthulp, ROMA-regels bij screens/rolluik.
- E2E getest: backend-audit alle 33 varianten, submit-test hor+ROMA (centraal geprijsd, extras + Waarom ROMA in lead), prod-visueel desktop (grid, varianten, vanaf-prijzen, horren-tab).

## Openstaand / wacht op Daimy
0. **WA verkeerde offerte-link (6 juli)**: 13 klanten kregen de Roma duo-link i.p.v. hun hoofdofferte (WA-cron pakte nieuwste SENT offerte; duo-batch van 09:32 was nieuwer). Bug gefixt (duo-docIds uitgesloten, commit dc2fdc0). Lijst: `data/wa-verkeerde-link-2026-07-06.json`. GEEN nieuwe WhatsApp sturen (expliciete opdracht Daimy). Voorstel dat openstaat: inhoud van die 13 Roma-documenten vervangen door de hoofdofferte zodat de al-gedeelde link de juiste offerte toont — wacht op ja/nee.
0b. **Roma duo solar-bug (6 juli)**: duo-script pakte altijd de bedrade .XP/zipSCREEN-matrix, ook bij solar-hoofdoffertes. Script gefixt én alle bestaande duo-documenten herberekend met `herbereken-roma-duos.js` (69 in-place bijgewerkt, akkoord Daimy). 3 skips: zipscreens 4267-5000mm breed — Roma solar-zipscreen gaat maar tot 4000mm, daar blijft de bedrade duo-variant staan (Gerrit Boogaardt, Ertugrul Selat, marthijn middelkoop).
0c. **Duo-offerte automatische mail (vraag Daimy 6 juli)**: verzendkanaal = Trengo "Aanvragen" (aanvragen@sonty.nl, kanaal 1363384). Module klaar: `scripts/duo-mail.js` (contact → ticket → mail → ticket sluiten; `--test` stuurt naar daimy@sonty.nl, getest OK). Nog NIET gekoppeld aan v4. Wacht op Daimy: akkoord op de maildtekst (testmail in zijn inbox) + scope: alleen nieuwe duo's of ook inhaalslag bestaande duo-klanten (die inhaalslag zou meteen de 13 verkeerde-link-klanten van punt 0 hun hoofdofferte geven).
1. **Garantie-inconsistentie** (belangrijk): mail zegt "5 jaar montage", v4-offertes "3 jaar montage | 5 jaar product | 7 jaar motor", oude v4-regel "2 jaar montage | 3 jaar product", kennisbank "5+7 jaar". MOET één lijn worden — vraag Daimy de juiste cijfers en trek overal gelijk.
2. **Buitenjaloezie-uitvoering Roma**: welke (Raffstore .P/.XP of MODULO) + lameltype (CDL70/ZL81/DBL70/GL85)? Dan in tool + TRENDO schuine rolluiken (hellingshoek-UI) afmaken.
3. **RP-automation mail** ("binnen 24u" bij tool-contacten): moet in Reuzenpanda zelf uitgezet worden op herkomst=Winkel (onze API-token heeft geen automation-rechten). Verbeterde prijsvoorstel-mail geleverd in chat, wacht op akkoord + garantie-cijfers.
4. **Roma-marge/bezorging**: duo-offerte staat klaar naast hoofdofferte — moet de klant beide links automatisch krijgen of stuurt team handmatig?
5. **Voorraadschermen** (aanbetaald, geen eindfactuur): 11 stuks (5 beige, 3 grijs, 4 kleur onbekend). 4 zonder kleur nazoeken in RP/HubSpot. Peter van der Maat staat lang open (jan). Data: `data/voorraadschermen-open.json`.
6. **Beleidsvragen analyse §6**: burenkorting-regel, kortingsmandaat AI (nu max 17,5%), service-nodi.nl, orderstatus-toegang.
7. AI-KS niet live buiten whitelist tot Daimy akkoord (fase-1 shadow-cron voor alle gesprekken wacht).
8. **TE VER-regel vs 60km-Gouda-afspraak (9 juli)**: v4 checkTeVer meet vanaf RIJSWIJK (>125km altijd te ver; ≥60km én <€7500 te ver). Almere/Amersfoort/Den Bosch/Tilburg/Breda = 61-78km vanaf Rijswijk → auto TE VER, maar vallen wél binnen de afgesproken 60km rond GOUDA (49-57km). Vraag op Telegram: A) regel gelijktrekken met Gouda-afspraak, B) straal bij partij kleiner, C) anders. Wacht op antwoord.

## Credentials & IDs
Alles in memory: `~/.claude/projects/-Users-clawdboot/memory/reference_sonty_credentials.md` + `reference_reuzenpanda_api.md`. RP: PID 731483fa-ef6b-4aae-afcf-883ec09219dd. Anthropic API-key: `scripts/.anthropic-api-key.txt` (tegoed kan opraken — Daimy laadt bij).

## Update 2026-07-08: agenda → Planado sync
- 261 agenda-afspraken (Sonty Montage, 8 wkn) als Planado-jobs gezet via `scripts/agenda-full-sync-2026-07.js` (0 fouten; 60 bewust niet-toegewezen, geen monteur-info in agenda).
- Werkroosters + vakantieblokken herbouwd via `scripts/planado-shifts-rebuild-2026-07.js` (292 shift-dagen; geen shift = geblokt).
- API-lessen: shifts alleen batchgewijs `PATCH /users/{uuid}/shifts` met `{shifts:[...]}`; per-datum endpoint bestaat niet (404, faalde stil). Templates niet via API aan jobs te koppelen.
- Wacht op Daimy: rooster Jaimy bevestigen; oude auto-sync (dood sinds 30/3) reactiveren ja/nee.
