# Sonty — Overdracht / stand van zaken (bijgewerkt 2026-08-28, rekentool inmeters)

## 29-08 (middag): AKKOORDDATUM IN DE SHEET (kolom T) + ONDERZOEK WINKEL-LATER-AKKOORD
- Daimy: "vanaf nu ook de datum van akkoord in kolom T, zodat we weten hoelang het duurde en of winkelmensen
  uiteindelijk toch akkoord gingen; regel 1 voor 1". Kolom T = "Akkoord → Datum" (rij 2 "Datum", rij 3 "Akkoord"); index
  verschilt per tab, dus detectie op die twee koppen (oude tabs zonder die kop → overslaan, nooit verkeerde kolom).
- GEBOUWD (sonty): lib/sheet-inplannen.js schrijfAkkoordDatum (rij op RP-nummer/telefoon/Gripp, alleen als leeg, d-m-jj);
  planner-ronde vult hem 1x zodra een lead op Inmeten inplannen komt (state.gezien ≥ 29-08, state.akkoordDatumSheet).
  PROEF 1 RIJ: Stefan v.d. Spek → 'Aug 2026'!T1462 = 29-8-26. Daimy checkt; backfill van eerdere 2026-leads (state.gezien
  kent 118 datums) alleen op zijn verzoek.
- ONDERZOEK (sheet 2025-2026, 720 winkel-offerterijen, koppeling op telefoon, kolom I/J = Winkel): 221 akkoord op dezelfde
  rij (direct/≤1 dag of datum onbekend), 338 LATER akkoord (mediaan 18 dgn, p90 45; 2-7d 67, 8-30d 186, 31-90d 79, >90d 6),
  127 nooit, 34 zonder telefoon. Per jaar: 2025 296→291 (98%, vertekend: toen werden vooral winkel-ORDERS gelogd), 2026
  423→267 (63%). Data: scratchpad winkel-later.json. Kanttekening: vóór juli 2026 werden winkeloffertes niet altijd als
  "Winkel" gelabeld; T-datum ontbreekt historisch (T was in oude tabs het Gripp-nummer).

## 29-08 (middag): UUR-VERTRAGING VÓÓR SUNNY'S VOORSTEL + WINKEL-PLANT-OVERRIDE (Stefan v.d. Spek)
- Daimy: winkel gaf Stefan een datum, Sunny stuurde 10:46 een ander voorstel (do 1 okt 09:00 Joey). Voorstel ingetrokken
  (verlopen), state.winkelPlant[rpItemId] gezet, claims 'winkel' op WA 977193905 + mail 977193909; Sunny (planningRolVoor)
  en reply-route blijven 24u weg. V4 aan Daimy: welke datum gaf de winkel → dan boeken + klant informeren.
- GEBOUWD: magStarten wacht 60 min na eerste zien op het dashboard (state.gezien) → kaart "Sunny wacht: net binnen (x min)
  — winkel kan zelf plannen"; winkel-plant-vlag (7 dgn) blokkeert Sunny volledig. Lab-laag A uitgebreid (dimensie binnen).
- CORRECTIE 11:05: Daimy's dashboard-klik "boeken" WAS wél verwerkt (mutatie boek winkel 10:46 → daemon 10:53: Sjoerd di
  29 sep 10:10, Gripp 6577, Bookings, Planado, sheet r1462; Bookings stuurde zelf de bevestigingsmail, bevestigingSturen
  staat uit voor winkel). Race: Sunny's planner-ronde (10:46) en de winkel-klik liepen gelijk; Sunny's 1-okt-voorstel
  ging eerst de deur uit. Klant per mail gecorrigeerd (29 sep staat, 1 okt vervalt; ticket 977195501). winkelPlant-vlag
  en winkel-claims weer weggehaald (boeking staat). V4 daarmee overbodig.
- Nog te bouwen: knop op het dashboard "winkel plant zelf" (zet vlag + claims) i.p.v. handmatig via state.
- OPVOLGING NA NIET-KIEZEN (Daimy-vraag 29-08, bevestigd in code): 24u-klok op het aanbod; 4u vóór verlopen (of de avond
  ervoor bij vroege verval) één herinnering in het gesprek (08-21u, verzendpoort 'herinnering'); bij verlopen → ronde 2:
  herhaald voorstel als "berichtje van de planning" (bron opvolging, herhaling); ronde 2 ook onbeantwoord → geen derde
  template: Sunny vraagt 1x persoonlijk na (dag ≥3, navraagBesluit) → 5 dagen stilte → belscherm + planning-groep.
  Aangepast: herhaling telt mee als onbeantwoord voorstel; herinnering tekent Sunny bij Sunny-voorstel.

## 29-08 (ochtend): OFFERTETOOL — VRIJE REGEL (zelf typen + eigen prijs) LIVE (website ccaeb1b)
- Daimy: "in de offertetool ook een product zelf kunnen toevoegen door zelf te typen, zoals een lasmontagebeugel of
  demontage, waar we zelf de prijs aan geven". Gebouwd in app/admin/offerte-tool: knop "+ Vrije regel (zelf typen)" →
  kaart met omschrijving, prijs per stuk incl. btw (komma/punt/€ toegestaan, nooit negatief), aantal 1-50; telt mee in
  subtotaal/korting/totaal; gaat als gewone RP-tekstregel (**naam**, pricePerUnit, units) mee bij opslaan/publiceren;
  PDF/mail/verrijking werken ongewijzigd. Ongeldige regel = rode rand + reden, opslaan geblokkeerd.
- BIJVANGST GEFIXT: bij heropenen van een offerte gooide de tool elke regel die hij niet als bekend product herkende
  STIL weg (en "opslaan" verwijderde hem dan uit RP). Nu worden onbekende regels als vrije regel bewaard; alleen echte
  keten-regels (Inmeten + montage…, Montage op uitbouw, Waarom-blokken) worden bij opslaan opnieuw opgebouwd;
  "demontage"/"montagebeugel" tellen niet als keten-montageregel (ook in verrijking.ts). Server-vangnet (route.ts
  opslaan + publiceer): lege omschrijving / negatieve of NaN-prijs / aantal buiten 1-50 → 400 met reden.
- Lab: sonty-website/scripts/vrije-regel-lab.mts (npx tsx) — 580 scenario's 0x FOUT-STIL (invoer-matrix, roundtrip,
  keten-herkenning, server-vangnet, prijsparser). Headless screenshot lokaal: 2 geldige regels + 1 lege met foutmelding,
  subtotaal €150 → 15% korting → €127,50 klopt. Let op: de groupDiscount (%) geldt in RP over ALLE regels, dus ook over
  vrije regels; wil Daimy demontage e.d. buiten de korting houden, dan is dat een aparte RP-regeloptie (nog niet).

## 28-08 (avond): REKENTOOL SCHRIJFT NAAR GRIPP (website 9ba8da4) — nog GEEN echte offerte bijgewerkt
- Daimy: "ik wil het ook gelijk kunnen aanpassen in Gripp zodat die het doorzet". Gebouwd via de bewezen keten-weg:
  lib/rekentool/gripp-schrijven.ts maakt een Voorstel in keten-vorm (bijwerken op lijnId uit "origineel", anders
  nieuw; niet-overgenomen productregels vervallen; vaste regels blijven; montage per product samengevoegd; korting-%
  → bestaande kortingregel bijwerken of nieuwe regel (gripp-sync pasVoorstelToe kent nu lijnId 0 = aanmaken); korting
  uit + oude kortingregel → die vervalt). Schrijven = pasVoorstelToe (zelfde code als meetbon-keten), daarna
  bon.offerte=bijgewerkt + wachtlijst (geen meetbon? dan minimale bon met klantnaam), zodat tekenen → aanbetaling
  via cron-meetbon-keten doorloopt; knop "Verder: tekenen / mailen" → /admin/meetbon/<nr>.
- UI: blok "Naar Gripp" verschijnt na "overnemen": inmeter kiezen (Joey/Sjoerd, verplicht: mail gaat later uit
  zijn naam) → "1. Laat zien wat er verandert" (dry-run, lijst acties + was/wordt) → "2. Bijwerken in Gripp"
  (confirm). Poorten: getekende offerte, regel zonder prijs, geen inmeter, vaste regel die niet meer bestaat.
- BEWIJS: lab 7.958 scenario's 0x FOUT-STIL (648 voorstel-scenario's: acties/verwijderen/behouden/korting/
  totaal == rekentool-totaal); dry-run 6494 lokaal én op productie: 0 blokkades, excl 2.752,88 → 2.752,88;
  Playwright op iPhone 12 t/m het voorstel (bijwerk-knop NIET geklikt). Testofferte 6560 bestaat niet meer, dus
  het echte schrijven is nog niet gedraaid → regel "eerst 1, dan de rest": Daimy wijst het eerste geval aan.

## 28-08 (eind middag): REKENTOOL + GRIPP-KOPPELING LIVE (website d6b0d8e), volledige review
- Daimy: "alles nog een keer goed nakijken, als hier een fout in zit gaan ze het fout doen; handig als ze een
  Gripp-nummer kunnen invullen en de originele prijzen zien".
- GEBOUWD: lib/rekentool/gripp.ts (ALLEEN LEZEN, 1 offer.get): Gripp-nummer → regels gesorteerd product/montage/
  korting/extra/anders, per productregel een voorstel (productKey via GRIPP_PRODUCT-omkering + naam, maat uit
  "Breedte:/Uitval:/Hoogte:", bediening via mapBediening maar altijd uit de keuzelijst, kleur via mapKleurType tegen
  de echte lijsten; NTB/NNB = standaard + opmerking; "bedraad" + afstandsbediening = opmerking; montage "uitgebreid/
  uitbouw" → uitbouw aan). Losse Situo-regel = vast bedrag + opmerking (zit al in de nieuwe io-prijs). Korting-%
  uit de offerte overgenomen. Pagina: Gripp-blok bovenaan (originele regels + prijzen incl. btw), "Regels overnemen
  en herberekenen", per regel "In offerte € X → verschil", voettekst "Offerte N was € … / verschil".
- LAB-VONDST (echte stille fout, gefixt vóór live): lege "Frame kleur:" in een omschrijving las het volgende label
  ("Kleur") als kleurnaam en rekende RAL-meerprijs zonder opmerking → echte label:waarde-ontleding (velden()).
- Review-fixes: resultaat op regel-id gekoppeld (geen index-verschuiving bij verwijderen), aantal vrij typbaar,
  kleurlabel per categorie (rolluik: kast/lamellen, duurste telt), voorraadscherm zet 20% over alles.
- BEWIJS: lab 7.310 scenario's 0x FOUT-STIL (incl. 900 Gripp-omschrijvingen in 3 stijlen × lelijke waarden);
  echte offerte 6494 (Suneye 4000x2500 io, windsensor, montage uitgebreid, 15%) volledig herberekend:
  €3.330,98 vs €3.330,99 in Gripp (1 cent afronding). Productie-API + Playwright iPhone 12 op productie met de
  Gripp-flow: identiek.
- TWEE BELEIDSPUNTEN (niet zelf veranderd, aan Daimy gemeld):
  1. Unilux hor afwijkende RAL: motor rekent starttarief (€ per order) PER HOR en de tool/keten ×aantal → bij 3 horren
     2× starttarief te veel. Zit ook zo in de meetbon-keten en de winkeltool (zelfde motor).
  2. Montage op uitbouw (€325 knikarm) bestaat in de rekentool en winkeltool, maar de meetbon heeft geen uitbouw-veld
     en de keten geeft dan €275 in Gripp. Voorstel: uitbouw-keuze in de meetbon (producten.ts knikarm) + doorgeven.
- Oude offertes (bv. 1083 uit 2025, Suncube €1.850) laten grote verschillen zien door de prijsverhoging van 3-8:
  de tool toont dat eerlijk, de keten zet ook de nieuwe prijs. Beleid daarvoor is aan Daimy.

## 28-08 (middag): REKENTOOL INMETERS LIVE — /admin/rekentool (website 27297bb)
- Daimy (/goal): inmeters moeten in de admin een rekentool hebben om na het inmeten de productprijs uit te
  rekenen, zodat bij de eindofferte geen prijsboek meer nodig is en bediening/kleur/maat niet fout gaan.
  Aanvullingen: "alles moet in de btw zijn", "zorg dat je de juiste prijzen aanhoudt".
- GEBOUWD: lib/rekentool/index.ts = strenge laag over de centrale prijsmotor (lib/offerte-tool/pricing.ts,
  dezelfde als meetbon-keten/configurator/bots + KV-prijsconfig). Per product alleen de bedieningen die
  bestaan (Roma io/solar, SunEye XL zonder handbediend, hor = gaaskeuze), kleur alleen uit de echte lijsten
  (standaard/trend/RAL; Roma alles gratis), maat in cm of buiten bereik = zichtbare fout, nooit stil terug-
  vallen op io-tarief of €0-meerprijs. Prijs per stuk incl. btw + montage, aantal, extra's (Tahoma, wind-
  sensor), maandactie-korting over alles (aan/uit), totaal incl. btw + "waarvan btw", samenvatting kopiëren.
  API /api/rekentool (x-meet-code 2288 zoals de meetbon, of admin-Bearer). Pagina mobiel-eerst, staat in
  localStorage. Links: admin-rail, admin-dashboard, meetbon-dashboard.
- LAB: scripts/rekentool-lab.mts (npx tsx) 6.373 scenario's, 0x FOUT-STIL, 0 crashes, 1 FOUT-ZICHTBAAR
  (Roma zipscreen solar 3600x3600 niet leverbaar, klopt met boek en wordt zo gemeld). Pariteit met motor/
  keten over alle geldige combinaties (1.530 OK).
- LIVE GEMETEN (regel 26-08): productie-API rekentool == productie /api/offerte-tool (S-42 2000x2000 io:
  1332 + 195 = 1527; SunEye XL 5000x3000 RAL: 5746,80 + 275; Comfort-hor montage 35; handbediend geeft
  waarschuwing). Playwright iPhone 12 op productie: login → regel → cm-fout → SunEye XL zonder handbediend →
  totaal €6.416,48, 0 overflow (scripts/rekentool-visueel.mjs <url> <code>, shots /tmp/rekentool-shots).
- NIET gedaan (bewust): geen koppeling naar Gripp vanuit de rekentool; de meetbon-keten (lib/meetbon/prijs.ts)
  blijft de weg naar de offerte. Mogelijke vervolgstap: prijs live tonen ín de meetbon per product.

## 28-08 (middag): PLANADO RIJKLAAR-CHECK VOOR MAANDAG (bussen rijden vanaf 31-08 op Planado)
- Vraag Daimy: volledige check of alles goed in Planado staat (notities uit Outlook, tijden zonder buffer,
  werkbonnen, sync). Gebouwd: `scripts/planado-rijklaar-check.js` (ALLEEN LEZEN, --dagen 14 --json pad):
  per Outlook-teamafspraak → Planado-opdracht, bus, Bookings-tijd (zonder buffer), adres, Interne notities,
  werkbon-sjabloon, telefooncontact, Gripp-blok, status; plus wezen + overlap per bus + dagoverzicht.
- Gemeten (91 team-afspraken 27-08 t/m 10-09): tijden 91/91 goed (0 buffer-fouten), bus 91/91 goed,
  0 ontbrekende opdrachten, 0 wezen, werkbon overal compleet.
  LET OP: sjabloon "Montage afspraak particulier" heeft 8 rapportvelden (gemeten /v2/templates), niet 19
  zoals HANDOFF 20-08 zei; "Werk gereed?" is required:false.
- FOUT gevonden: Interne notities (Outlook) ontbraken bij 82/91 → `planado-outlook-verrijk.js` (27-08) is
  nooit met --execute gedraaid (Mac viel 27-08 12:59 uit; state-bestand leeg). Proefgeval #1083 Schrooten
  uitgevoerd en goed; Daimy akkoord (chat) → verrijker gedraaid: 106 bus-opdrachten + 92 inmeet/Nanny-
  opdrachten (Daimy: "ook in de inmeet opdrachten"; verrijker kent nu ook Joey/Sjoerd/Nanny) bijgewerkt,
  0 fouten, log logs/outlook-planado-verrijk.log. Nameting: 76/91 volledig in orde; de 15 rest zijn
  kantoor-input (9 blanco blokken zonder klant/adres, 2 vandaag al afgerond, 3 adres-spelling/onbekende
  straat, 1 Joey-blok) — geen sync-fouten. De verrijker draait NIET automatisch; nieuwe opdrachten krijgen
  notities+adres al via de sync zelf (post-PATCH sinds 27-08). Bij twijfel: node scripts/planado-outlook-verrijk.js --execute
- Overige bevindingen (kantoor/planning, geen sync-fout): 3 adressen zonder straat in Planado (Ritmeester
  #1100 Brielle, Bleijenberg #1106 Gouda, M. Jansen #1111 IJsselstein) → verrijker zet "Adres (Outlook)"
  als tekst; blanco blokken "Montage Sonty" zonder klant/adres staan als opdracht in de bus-app
  (#1080/#1082/#1103/#1113/#1118/#1125/#1158 = "Yudi vrij", "Niets plannen", magazijn); 4 overlappen op
  dezelfde bus (Bus 4 wo 2-9 11:30/12:30, Bus 5 di 8-9 2x 08:00-14:00, Bus 3 di 8-9 en do 10-9).
- Sync-status: nl.sonty.outlook-planado-sync elke 10 min (--execute, montage-sync-aan), laatste run 13:16
  zonder fouten; planado-outlook-check dagelijks 07:45. data/outlook-schrijf-uit bestaat NIET meer (terugweg
  Planado→Outlook dus aan). Planado-webhook werkbon → werkbon@sonty.nl live sinds 27-08.

## 28-08 (middag): SUNNY PLANT INMETEN ZELF — automatisch eerste voorstel (LIVE in proefstand, 1 klant)
- Daimy (/goal): "Sunny zelf zodra iemand op Inmeten inplannen komt op een menselijke manier de beste tijd
  aanbieden en inboeken, zoals nu met het dashboard; geen dubbele mails/berichten." = V7 + V8 in één.
- Ontwerp + orakel (16 regels) + lab-dimensies: docs/sunny-inmeet-plannen-ontwerp.md. Code-map vooraf gemaakt.
- GEBOUWD (sonty 42fa148): lib/sunny-start.js (beslislaag magStarten, Sunny-tekst NL/EN + mail-HTML, eigenaar-
  regel, heartbeat, vlag); planner: zonder --live stuurt de 30-min-ronde per verse lead het eerste voorstel via
  maakEnVerstuurAanbod {bron:'sunny', stijl:'sunny'} (altijd 1 beste tijd), kaart-reden zichtbaar ("Sunny stuurde
  voorstel …" / "Sunny wacht: …"), max 5 per ronde, spook-aanbod-herbezorging (crash tussen aanmaken en sturen =
  1x alsnog, nooit 2x); aanbodTickets krijgt rpItemId+bron+stijl; na WA-verzending claim(sunny) + actieve-tickets.
  Verzendpoort: 24u-regel (geen tweede voorstel <24u, tenzij opVerzoek/luistert/herhaling), claim-guard (Sunny in
  gesprek → planner stuurt niet), BOT_PATRONEN kent "Groetjes, Sunny" (anders telde Sunny als mens-actief!).
  magStarten: max 2 eerdere voorstellen zonder boeking → mens nodig (Scholten 3, Anoek 2 → niet nóg een bot-
  bericht), venster ma–za 08:30–20:00. aanbod-versturen: Sunny-stijl WA vrij bericht + mail (onderwerp "Je
  inmeetafspraak bij Sonty"), bevestiging tekent Sunny bij bron sunny. daemon.js: bron sunny = Sunny eigenaar
  (ook na 45 min), context "JIJ (Sunny) hebt … voorgesteld", heartbeat per pollRonde. tools.js: inmeet_tijden
  claimt het gesprek. aanbod-replies: kale keuze → boekroute; rest van Sunny (max 20 min, dan reply-route).
  inmeet-mutatie: register krijgt bron. system-prompt: SUNNY-VOORSTEL-regel. Dashboard (website 67328ef, live):
  reden op de kaart.
- LAB: nieuw onderdeel sunny-start (A poort 1344 / B tekst 32 / C eigenaar 96 / D echte verzendpoort 72 =
  1992); totaal 6888 scenario's 0x FOUT-STIL (klantreactie: 4 fout-zichtbaar bestonden al). Regressie echte
  historie: 24u-regel had 47/152 verzendingen geblokkeerd (alle bekende spam/cascade-paren), 36/152 vielen
  buiten het venster (06:25–08:30-verzendingen → nu 08:30). Dry-run 7 wachtenden: Scholten/Anoek → mens nodig,
  5 → sturen.
- PROEFSTAND (Daimy-regel eerst 1): vlag `scripts/ai-ks/.sunny-start-live` = "alleen:sem van nieuwkerk"; ronde
  12:52 → Sem: geen WA-gesprek → Meta-template (tekent Nanny) + mail in Sunny-stijl (token b6eac3a5…, WA-ticket
  977017918, mail 977017927), claim + actief gezet, kaart "Sunny stuurde voorstel: maandag 14 september rond 15:45".
- 13:00-13:45 LIVE-TEST DAIMY (eigen kaart, proefstand "alleen:daimy", commits 74b7df5 + volgend): voorstel 13:02 (do 1 okt
  13:10) → WA via moment-template-VER met "omdat je wat verder bij ons vandaan woont" (oude Meta-tekst 244125; route-v3
  #248773 nog PENDING) + mail Sunny-stijl. Daimy: (1) die tekst nooit meer; lijn = zo efficiënt mogelijk plannen,
  uitstoot én brandstofkosten → teksten aangepast (sunny-start + verWegRegel), ver-weg-templates UIT tot routeVerGemeld;
  (2) "WA komt van Nanny, mail van Sunny" → mail volgt nu het WA-kanaal (template = Nanny-mail, vrij bericht = Sunny).
  Zijn "ander moement" 13:07: reply-route stapte terecht opzij, Sunny antwoordde pas 13:19 (429-storm + ticket stond
  ASSIGNED op bot-account en telde niet mee in de actief-sweep). FIXES daemon.js: sweep neemt ASSIGNED-bij-bot mee,
  30 nieuwste + roterend blok van 120 i.p.v. alle 609, gesloten tickets uit actieve lijst; verwerkTicket haalt berichten
  alleen op als updated_at|messages_count veranderde (20-min TTL). NOOIT-DUBBEL-verharding: halve Planado-boeking
  (register status 'bezig') wordt hergebruikt i.p.v. tweede opdracht; external_id-vangnet meldt op Telegram; bevestiging
  per kanaal in register (noteerBevestiging); nacontrole herstelt alleen het ontbrekende kanaal en nooit als het
  register WA al als verstuurd heeft. Lab 6888 groen. Antwoord op Daimy's vraag "meerdere boekingen/bevestigingen?":
  register 84 geboekt, 0 telefoons met >1 boeking; gekozen-pad markeert 'verwerkt', boek-tak heeftGeboekteAfspraak.
- 14:14 TEST GESLAAGD: Daimy "oke doe dan maar bij sjoerd" → Sunny inmeet_boeken (citaat) → mutatie bron sunny → verzoek-
  daemon 14:17 geboekt: Sjoerd di 29 sep 10:10, Gripp 6572, meetbon, sheet r357, Outlook + Planado 1f1a2da4…, oud
  aanbod 7a5f… op verlopen, register {bron:sunny, bevestiging:{wa,mail}}, dashboard "geboekt". Onderweg gedicht
  (6e3590d): claim 'sunny-tijden' — na Sunny's eigen tijden is een kale keuze van Sunny (planningRolVoor) en blijft de
  reply-route 24u van het oude aanbod af (Daimy's keuze bleef 12 min liggen; zonder fix zou na 30 min de oude
  1-okt-tijd zijn geboekt). Vertraging Sunny = Trengo-429 accountbreed (ook losse curl krijgt 429).
- Daimy-feedback na de boeking (gefixt, 88a3bc8 + 050ef3a): (1) "2 bevestigingsberichten op WhatsApp, 1 is genoeg" → bij
  bron sunny is Sunny's eigen antwoord de WA-bevestiging, keten stuurt alleen mail (alleenMail), register wa:true via
  'sunny-gesprek' zodat nacontrole niets extra's stuurt; afgeketste Sunny-boeking → eerlijk WA-bericht aan klant.
  (2) "mail is niet als mail opgesteld" → bevestigingMailHtml: aanhef, korte opening, Wanneer/Wie/Duur/Adres in regels,
  thuisblijfvenster, wijziging via mail/WA, groet; onderwerp "Je inmeetafspraak staat: <dag>".
- 16:03 ANNULERING-TEST: Daimy "wil je hem annuleren" → Sunny stelde de waarom-vraag (26-08-regel); "ik wil er liever
  vanaf zien" → reply-route maakte er een mens-nodig-notitie voor Jorren van (afspraak bleef staan). NIEUWE REGEL Daimy:
  annuleringen volledig automatisch + melding in de planning-groep, niet de data-bot. GEBOUWD (1222061): reply-route
  zet mutatie annuleer (bron klant-reply) en claimt 'annulering-loopt' (Sunny blijft 2u weg); Sunny's instructie +
  tool: direct inmeet_annuleren, geen waarom-vraag; muteerBoeking-groepsmelding kreeg {boeking:true} (stond zonder →
  data-bot). Daimy's annulering 16:08 uitgevoerd: Outlook ✓ Planado ✓ sheet ✓ annuleringslijst ✓, RP bewust niet
  aangeraakt (kantoor beslist over vervolg). Memory: feedback_annuleringen_automatisch.md.
- 16:15-16:25 REVIEWRONDE (Daimy: "doe zelf 1 reviewronde, daarna mag je die mensen zelf altijd gaan plannen"):
  onafhankelijke code-review (opus) op de dag-diff → 14 bevindingen, alle verwerkt in 0092c8a: (1) annuleringsbevestiging
  altijd bezorgd (WA → mail → alarm; lib stuurVrijBericht) en alleen "geannuleerd" als muteerBoeking overal slaagde;
  (2) planner claimt 'sunny-voorstel' en de reply-route negeert die claim voor de keuze-verwerking → kale "ja" wordt direct
  geboekt (was: 30 min niemand); (3) claim-guard in verzendpoort niet bij opVerzoek/luistert (klantgevraagd her-voorstel
  werd geblokkeerd); (4) annulering-loopt-claim vóór de POST (race met Sunny-daemon); (5) max-2-poort telt herinneringen/
  opVerzoek niet mee (vlaggen nu in aanbodTickets) en kijkt 14 dagen; (6) sunnyNoemdeTijden blokkeert alleen de keuze op
  het oude aanbod, rest van de reply-route loopt door (na-boeking, stilte) tenzij Sunny leeft; (7) spook-herbezorging op
  verse state + voorstelIntent (stijl/bron/ver write-ahead), registratiefout zichtbaar; (8) WA-bevestiging alleen overslaan
  bij aantoonbare Sunny-verzending (data/ai-ks/sunny-verstuurd.json), anders formele WA + alarm bij nul kanalen; (9) taal
  bij ack-berichten; (10) klantmelding bij afgeketste Sunny-boeking via ticketId/String-rpItemId; (11) data-bot alleen bij
  storing, inhoudelijke annuleer-melding uitsluitend in de groep; (12) versheid-skip 8 min; (13) halve boeking merge +
  'bezig' (<2u) telt als bezet behalve voor hetzelfde slot (hergebruik). Lab: zie lab9.
- 16:25 LIVE VOOR IEDEREEN (Daimy: "daarna mag je die mensen zelf altijd gaan plannen"): vlag .sunny-start-live leeg.
  Ronde 16:28: 5 voorstellen (Tim v.d. Lans, Keus, Jhingur, Bronts, Hoogerdijk), Sem lopend, Scholten/Anoek "mens nodig
  (bellen)" op de kaart. Lab9 6888 groen. V3 daarmee afgehandeld.
- 16:30-16:50 SCHOLTEN/ANOEK (Daimy: "ook dat soort dingen moeten door jou opgelost worden"): nieuwe stap NAVRAGEN NA 2
  VOORSTELLEN (lib/sunny-start navraagBesluit/navraagTekst, planner-tak): geen derde template maar één persoonlijk
  navraagbericht van Sunny (WA als venster open, anders mail; soort 'navraag' in de verzendpoort = stil-lijst + mens-
  actief), kaart "Sunny vroeg persoonlijk na"; na 5 dagen stilte → "Mens nodig (bellen)" + 1x melding in de planning-
  groep. Ronde 16:37: Scholten (3 voorstellen, WA-venster dicht) en Anoek (mail-only, 015-nummer) allebei per mail
  nagevraagd. Lab-laag E (48). Commit + volgend.
- DAIMY'S ANNULERING HARD GEVERIFIEERD: Planado-opdracht weg (Not found), Outlook-event-id 404, register geannuleerd —
  MAAR de agenda toonde nog "Inmeten Sonty - Daimy Boot 29-09": de afspraak is een MICROSOFT BOOKINGS-afspraak
  (inmeet-boeken.js boekt via Bookings; register-id = Bookings-id) en de motor verwijderde alleen een Outlook-event.
  GEFIXT: bookings-api verwijder() (DELETE, geen Bookings-annuleringsmail), muteerBoeking probeert eerst Bookings,
  registreerBoeking bewaart agendaVia. Daimy's Bookings-afspraak 16:48 verwijderd (204), agenda 29-09 schoon.
  Gripp 6572/meetbon blijven staan (kantoor beslist, RP bewust niet aangeraakt).
- 16:55 REGEL Daimy: aankomstmarge altijd letterlijk "een uur eerder of later" (niet "iets"/"uurtje") + sms-volglink zodra
  onderweg; doorgevoerd in WA/mail-bevestiging, herinnering, gekozen-pad-bevestiging, Sunny-voorstel en system-prompt
  (memory feedback_aankomstmarge_uur_sms). Labs groen.
- 21:00-21:30 MICKEY KALRA (Badhoevedorp, "waarom is Mickey niks gestuurd"): planner wacht bewust max 4 werkdagen op een
  buurklus (omrijgrens 30 min, goedkoopste +36) — bestaand beleid Daimy 06-08 — maar deed dat in stilte. NIEUW (00ae7f4):
  Sunny meldt 1x de wachttijd (efficiënte route, uiterlijk 4 werkdagen, vraagt voorkeur; soort 'wachtmelding'), kaart
  toont de Sunny-status. Mickey krijgt hem in de eerste ronde na 08:30 (za 29-08): het is nu ná 20:00 (verzendvenster).
  Na de wachttijd (of eerder bij een buurklus) stuurt de gewone Sunny-tak het voorstel. Lab-laag F; totaal 6960 groen.
- STAND 21:25: Tim v.d. Lans (Sunny, 29-09), Cecil Jhingur (keuzelink, 31-08) en Ivo Bronts (Sunny, 12-10) GEBOEKT binnen
  een uur na de eerste live-ronde. Open: Sem, Keus, Hoogerdijk (aanbod-loopt); Scholten/Anoek navraag per mail 16:37.
- OPEN: WA-template tekent nog Nanny (route-v3 #248773 PENDING bij Meta; Sunny-variant indienen); beleidsvraag WA+mail
  beide (bestaand) of alleen WA bij WA-gesprek; Trengo-429 accountbreed (gedeelde ophaler met cache = aparte klus).
  Daemons sonny/inmeet-verzoeken/aanbod-replies herstart 12:47.

## 28-08 (ochtend): MAC 21 UUR STIL DOOR STROOMUITVAL + FILEVAULT — inhaalrun gemiste jobs
- 27-08 12:59 viel de Mac uit (geen shutdown-record = stroom/hard uit; pmset autorestart=1 → zelf herstart).
  FileVault AAN → 21 uur op het wachtwoordscherm: geen gui/501-sessie = GEEN launchd-agents (Telegram-poller,
  Sonny, email-daemon, WA-luisteraar, alle crons). Pas na Daimy's inlog 28-08 10:22 startte alles (10:23).
- Gemist: alle kalender-jobs 27-08 na 13:00 (V4 17:00, gripp-invullen 4x, health-check 19:00, getekend-rapport,
  planning-overzicht, sunny-weetje) + 28-08 tot 10:22 (V4 09:00, markiezen, planado-outlook, montage-voorstellen,
  email-sync, health-check, sunny-ochtend, digests, grond-radar, ...).
- Inhaalrun gestart 10:30 (scratchpad inhaal.sh, sequentieel via launchctl kickstart, log logs/inhaal-28-08.log):
  offerte-v4 → markiezen → planado-outlook → montage-voorstellen → email-sync → health-check → sync-waakhond →
  werkbon-niet-afgerond → mens-nodig-digest → tickets-rapport → sunny-ochtend → gesprek-lab → prijs-kruiscontrole →
  gripp-verrijken → qa-leren → reviews-sync → sheet-vangnet → vve-signalen → c-backfill → tekenbonus-opruim →
  prijs-steekproef → grond.radar → v4-selfcheck. Avond-jobs van gisteren bewust NIET ingehaald (draaien vanavond).
- V1 aan Daimy (Telegram 10:29): FileVault uit + auto-login aanzetten (dan start alles na stroomuitval vanzelf;
  nadeel: schijf onversleuteld bij fysieke diefstal) + tip UPS. Antwoord open.
- Niet geladen (bewust): nl.sonty.keten-zelfcontrole (UIT op verzoek Daimy), nl.sonty.sonny-rapport (Sonny UIT).
  com.winterstapel.tick: last exit 1, err-log leeg — nog niet onderzocht (paper trading, laag prio).
- Tijdens de inhaalrun gevonden en gefixt: (1) nl.sonty.prijs-kruiscontrole faalde al sinds 27-08 07:45 met
  "spawnSync npx ENOENT" (live-API-meetlat van 26-08 gebruikt npx, plist had geen PATH) → EnvironmentVariables PATH
  toegevoegd, herladen, run ✅ exit 0. (2) planning-mail eerste ronde na start = bekende hapering ("browser-login
  mislukt" → Cannot read 'request'), tweede ronde herstelt vanzelf (3 nieuwe orderrijen). (3) werkbon-afhandeling
  gekickstart: 4 afgeronde bus-opdrachten van 27-08 alsnog gemaild. Interval-jobs met runs=0 ook gekickstart.
- Inhaalrun KLAAR 11:12: 23 jobs, alle exit 0 (offerte-v4: 16 WA-offertes; v4-selfcheck: 1 stuck Linda Kramer
  #202612242 gerapporteerd). gesprek-lab exit 1 = chronisch (staat al weken zo in health-check), niet uitval-gerelateerd.
- Memory: project_mac_mini_filevault_stroomuitval.md.

## 27-08 (ochtend, vervolg): WERKBON VIA PLANADO-WEBHOOK DIRECT NAAR werkbon@sonty.nl (LIVE)
- Daimy: "als een werkbon wel of niet is afgerond moet die via die webhook verstuurd worden naar werkbon@sonty.nl".
  Planado heeft GEEN eigen e-mail-rapport-instelling (gecheckt: docs + Instellingen; alleen klant-SMS), wél webhooks.
- Gebouwd (sonty-website 5156a0e + fixes): app/api/planado/werkbon (POST: X-Planado-Secret, job_finished → 200
  direct, mailwerk in after(); GET ?uuid= admin) + lib/werkbon/mail.ts (zelfde mail als de Mac-lib). Mail via Trengo
  stuurMail (aanvragen@ → werkbon@sonty.nl, ticket direct gesloten). KV: werkbon:bezig/gemaild:<uuid>, log
  werkbon:webhook-log. Env PLANADO_WEBHOOK_SECRET (Vercel prod) = scripts/.planado-webhook-secret.txt.
  LES: alles in één request gaf FUNCTION_INVOCATION_TIMEOUT → after() + slot pas na succes.
- Webhook in Planado aangemaakt via UI (Playwright, /admin/integrations/webhooks/new; API kent geen create):
  "Sonty werkbon-mail (werkbon@sonty.nl)", event "Opdracht voltooid", enabled. De 2 oude Zapier-webhooks staan op "locked".
- Mac-verwerker (cron-werkbon-afhandeling, 30 min) blijft vangnet: vraagt eerst GET ?uuid (token scripts/.website-admin.txt)
  en mailt alleen als de webhook het niet deed; planning-bot-melding komt altijd van de Mac.
- Eerste echte werkbon: #1067 Erades (Bus 1) GEREED, 10:04 gemaild door de Mac-verwerker; 10:33 nogmaals als
  webhook-test (Trengo-ticket 976720113) — bewust duplicaat, gemeld.
- Werkbon-adres: alleen werkbon@sonty.nl (gedeelde mailbox bestaat; werkbonnen@ weggehaald).

## 27-08 (ochtend): WERKBON ALTIJD VOLLEDIG MAILEN + DAGELIJKSE NIET-AFGEROND-MELDING (c0b478c)
- Vraag Daimy "wat gebeurt er met de werkbonnen": gemeten in Planado: 176 bus-opdrachten sinds 20-08, 175 gepland,
  1 onderweg, 0 afgerond → verwerker vond terecht niets (state leeg). Teams drukken niet op Afronden.
- Daimy: "elke werkbon moet gemaild worden naar werkbon@sonty.nl, klaar of niet, in z'n geheel" + "oke doe het maar"
  (instructie + dagmelding). Gebouwd:
  (1) scripts/lib/werkbon-mail.js: complete HTML-mail per afgeronde opdracht (klant, contact, adres, team, gepland/
      gestart/afgerond, Gripp-nr, Planado-status, ALLE rapportvelden incl. leeg + ingevuld-op, foto-links, materialen,
      volledige omschrijving). Ontvangers: data/werkbon-mail-adressen.txt = werkbon@sonty.nl + werkbonnen@sonty.nl
      (Daimy schreef werkbon@; 20-08 was het werkbonnen@ → beide tot hij bevestigt, V1 op Telegram).
  (2) cron-werkbon-afhandeling.js: mailt ALTIJD (gereed/niet gereed/leeg/zonder velden); planning-bot krijgt kort
      bericht (✅ factuur kan / ⚠️ niet gereed / 📋 velden leeg). Mock-test 4 gevallen ok.
  (3) cron-werkbon-niet-afgerond.js + launchd nl.sonty.werkbon-niet-afgerond (dagelijks 08:10): per bus de open
      klussen van gisteren (+ ouder sinds 20-08) op de planning-bot. Dry-run 27-08: 15 van gisteren, 56 totaal.
  (4) docs/werkbon-instructie-monteurs.md (korte instructie, Daimy deelt met de teams).
  (5) Voorbeeld gemaild naar daimy@sonty.nl: "VOORBEELD — Werkbon GEREED — #1067 Trudie Erades (Bus 1)" met
      verzonnen antwoorden; script scripts/werkbon-voorbeeld-mail.js (--nee voor de niet-gereed-variant).
- Eindfactuur automatisch versturen blijft bewust NIET gebouwd.

## 27-08 (avond): LEADS-DASHBOARD LICHT (RP-stijl)
- Daimy: "dashboard voor lead gewoon in lichte kleuren zoals bij Reuzenpanda, niet dat donkere". /admin/leads
  (app/admin/leads/page.tsx) had inline donkere kleuren; omgezet naar het admin.css-palet (bg #f9fafb, witte
  panelen, randen #e5e7eb, tekst #1a1a1a, grijzen gray-400..700, statuskleuren verzadigd, uitgeschakelde knoppen
  leesbaar). Headless gecheckt desktop/detailpaneel/iPhone 12; live (7f46b68, deploy-run liep dit keer wél automatisch).
- Observatie: productie toont 1 lead (demo) + 1 visualisatie: de KV "leads"-hash is vrijwel leeg (zie prijsreview F1).
  Admin-layout zelf (layout.tsx) is nog #0a0a0a; andere admin-pagina's staan deels nog donker (25 bestanden).
  Vraag aan Daimy gesteld of die ook licht moeten.

## 26-08 (avond 3): TESTRIT-LESSEN — verkeerde-dag-boeking, dubbele bevestigingen, annuleren
- Daimy's testrit ving 3 echte fouten: (1) "oke doe dan maar dinsdag" op Sunny's tijden werd door de
  keuze-route als akkoord op het OUDE donderdag-aanbod gelezen (claim-guard zat te laat) → dubbele
  boeking + dubbele bevestigingen op WA/mail/Telegram; (2) bot-boekingen kregen pas 20 min later via
  de nacontrole een bevestiging (bevestigingSturen=false gold ook voor bot-bronnen); (3) zijn
  annulering bleef bij "een collega" liggen.
- Fixes (gepusht): claim-guard vóór de keuze-uitlezing; leesKeuze weigert een bericht dat een ANDERE
  weekdag noemt dan het ene slot (NL+EN); Sunny-tool inmeet_annuleren + daemon-route (annuleren gaat
  direct via muteerBoeking over alle systemen); bot-boekingen bevestigen altijd direct. Lab 4890 groen.
- Opgeruimd: dubbele donderdag-job #1246 en beide test-agenda-blokken weg; Daimy's testafspraak
  volledig geannuleerd ("alle systemen bijgewerkt", Planado 404-check gedaan).

- NAGEKOMEN (Daimy: "loop nou echt scenario's door"): nieuw lab-onderdeel testrit-keten speelt het
  VOLLEDIGE gesprek na door de echte code (claim actief/verlopen × keuzevarianten). Ving direct:
  annuleren-na-boeking ging nooit naar Sunny (gedicht, incl. waarom+ander-moment-flow) en
  "doe donderdag maar" op een 1-slot-donderdag was geen keuze (gedicht). Dubbelboek-poort naar
  lib-helper heeftGeboekteAfspraak. Lab 4896 scenario's groen. REGEL: elke planning-wijziging moet
  voortaan óók door testrit-keten.

## 26-08 (avond 2, planner): TEMPLATE ROUTE-V3 + MENS-ACTIEF 1,5U + HENSING-LES + LAATSTE-WOORD-FIX
- Hensing-zaak: keuzelink-klik is geen appje → oud "Ander moment" werd als afwijzing van de
  NIEUWE keuze gelezen; haar gekozen 28 sep 11:10 (Joey) alsnog geboekt + bevestigd, en
  structureel gefixt met laatsteWoordNa() (alleen berichten ná verstuurdOp tellen; lab-dimensie).
- Ver-weg-tekst neutraal gemaakt (zegt niets meer over waar de klant woont); nieuwe WhatsApp-
  template #248773 "inmeetmomentver route v3" ingediend bij Meta, template-wachter fase 4 sluit
  hem aan bij goedkeuring (oude marge-ver 244682 mag hem daarna niet overschrijven).
- Verzendpoort: voorstellen mogen 1,5 uur na het laatste MENS-bericht (Daimy, geval Sem);
  rest blijft 24u. Parallel gebouwde "luistert"-parameter (voorstel-volgt-klantwens telt niet
  voor weeklimiet) crashte op elk voorstel — door lab gevangen (480 crashes) en gefixt.
- 1-voorstel-met-beste-tijd: stond al aan (aantalTijden=1); misleidend "(3 tijd(en))"-log gefixt.
- Aanbod verstuurd: Scholten (13:17), Hensing herstel-boeking, Janos (12:42), daimy-testkaart
  (15:33, mail-only). Sem: 1e poging mens-actief; 2e in de rij na de 1,5u-regel.
- OPEN: V7 (eerste aanbod automatisch bij nieuwe kaart — wacht op Daimy). Lab-totaal 4890.
- NIEUW: cron-planning-overzicht.js — dagelijks 17:30 bundel op de data-bot (aanbiedingen,
  boekingen met bron, herplanningen, wachtlijst met ❗ bij 3+ dagen zonder lopend aanbod);
  launchd nl.sonty.planning-overzicht. Eerste editie 26-08: 12 aanbiedingen, 9 boekingen.

## 26-08 (avond, laat): PRIJSREVIEW SONTY-WEBSITE — LIVE API REKENDE 23 DAGEN MET HET OUDE PEIL (gefixt)
- Opdracht Daimy (/goal): volledige review van het systeem achter Vercel/sonty-website, alle prijzen op het
  nieuwe peil, ook de eigen configurator; checklist A-G in sonty-website/docs/REVIEW-prijzen-2026-08-26.md.
- HOOFDBEVINDING: productie-KV `crm:prijsconfig` is leeg → laadPrijsConfig() gaf PRIJS_DEFAULTS
  (lib/offerte-tool/prijsconfig.ts) met losse getallen 1,10/1,15 → zetRekenConfig() overschreef de juiste
  JSON-waarden in de live API. Klantconfigurator (API-calls) en winkel-offertetool rekenden sinds 3 aug het
  oude peil (Zip Design 110 300×250: €1.147 i.p.v. €1.252; SunEye 500×300: €3.983 i.p.v. €4.320; Roma zip
  €1.994 i.p.v. €2.228). v4, Sunny, productpagina's (calculatePrice) en beide motoren-in-code stonden goed;
  alle dagelijkse controles waren groen omdat geen enkele de productie-API aanriep.
- FIX (sonty-website 6608720, live ±23:00, gemeten 8/8 gelijk): PRIJS_DEFAULTS leest prijsconfig.json;
  KV-sleutel markiesBtwFactor → markiezenFactor vertaald. Impact: productie-KV "leads" bevat 1 lead (geen
  offertes via tool/configurator sinds 3 aug), dus geen klantoffertes op het oude peil verstuurd.
- BORGING (sonty d07bade): scripts/tests/live-api-prijspeil.js meet de productie-API (prijs +
  configurator-prijs) tegen de motor, faalt aantoonbaar op de oude situatie (16 verschillen); stap 5 in
  prijs-meetlat/kruiscontrole-dagelijks.js; geen-losse-opslagen.js bewaakt nu ook prijsconfig.ts.
  Memory: feedback_live_api_meten.md.
- OOK GEFIXT (sonty-website 669bbdd): fallback-mapping "ZIP Pergola zonwering"/"ZIP bovenliggende" kreeg
  via "zip" de zipscreen-tabel (resolve.ts + configurator/submit). offerte-tool-parity-test.mts is een
  verouderde v4-kopie (62.133 schijn-mismatches) → gemarkeerd; nieuwe scripts/configurator-motor-pariteit.mts.
- V1 LIVE (27-08, Daimy in chat: "kun je alles naar de juiste prijzen gaan zetten"): branch prijs-gelijk-aan-offerte
  gemerged (0ddadd2): calculatePrice() rekent eerst via berekenPrijs; productpagina/keuzegids = offerte (matrix 171/198,
  rest = Windvast/V2). Live-meetlat 8/8, keuzegids rolluiken toont €757/€195/€175 = motor. V2 (Windvast Square 85 vs
  Design 110) nog open.
- 27-08 ±18:20 AFGEROND: markies-motor site 696→753 (× markiezenFactor, da2aa9c); eindmeting alle dienstenpagina's =
  motor (rest = montage/accessoires v4-eindbedragen, ROMA via vanafPrijs). LET OP: pushes naar main triggerden 3x geen
  deploy-run → `gh workflow run deploy.yml --ref main` + `gh run watch`. V2 BESLIST 27-08 (Daimy: windvast altijd als Zip Design 110 aanprijzen): productpagina + showroom
  op Design 110 (368743c, live gemeten), matrix 198/198. Prijsreview volledig afgerond. Sunny: kale "zipscreen" → Zip Design 110 (10a4086, daemon nl.sonty.sonny herstart);
  een kale "screen" zonder zip blijft in v4/Sunny Zip Square 85 (niet gevraagd, niet aangepast).
- (was) OPEN, WACHT OP DAIMY (Telegram V1/V2): productpagina's/keuzegids (configurator-motor) ≠ offerte-motor op
  tussenmaten (bilineair vs volgende tabelmaat; S-37 150×250 site €1.260 / offerte €1.314), markies montage
  €195 vs €275 en motor +696 vs +753, uitvalschermen tot 17% (Sunproject 250×100 €1.568 vs €1.926).
  V2: "Windvast" = Zip Square 85 (pagina) of Zip Design 110 (offerte/VARIANT_MAP)? Pas na akkoord aanpassen
  (regel prijzen-alleen-op-verzoek). Bedieningsindicaties gridmaten SunEye/Sunbasic/Sunelite/serre kloppen.
- Let op: gh run list toonde een parallelle deploy "Inmeetaanbod: hele dagen…" van een andere sessie.

## 26-08 (avond): SUNNY PLANT INMEETAFSPRAKEN + BOEKING-NACONTROLE (LIVE, vlag aan)
- Daimy: "Sunny moet tijdens het gesprek gelijk kunnen inplannen en overleggen zonder templates,
  en iedereen die geboekt wordt moet worden nagelopen; fouten wil ik weten mét oplossing."
- Fase 1: Sunny-tool `inmeet_tijden` (lib/inmeet-tijden.js op de echte slotmotor; live getest op
  Janos). Fase 2: `inmeet_boeken` via de mutatie-boek-route mét akkoord-citaat-guard; directe
  boeking trekt een lopend keuzelink-aanbod automatisch in. Fase 3: bij "ander moment" neemt
  Sunny het gesprek over (vlag `scripts/ai-ks/.inmeet-plannen-live` staat AAN); gesprek-claims
  (lib/gesprek-claims.js, data/gesprek-claims.json, 30 min) houden aanbod-replies en de
  laatste-woord-check van een geclaimd ticket af. Env-override INMEET_PLANNEN_LIVE=0/1 voor tests.
- Nacontrole: cron-boeking-nacontrole.js (launchd nl.sonty.boeking-nacontrole, 30 min) checkt per
  boeking Planado + Sonty Montage-agenda + verstuurde bevestiging; herstelt ontbrekende
  bevestiging zelf (van Bergen + Chebon Ong meteen gevangen en hersteld); 🚨 bij echte fouten;
  dagelijkse samenvatting via de ochtend-digest (08:20). LES: Bookings-ID ≠ Outlook-event-ID —
  eerste run gaf 9 valse alarmen (gecorrigeerd op Telegram), agenda-check kijkt nu naar de
  kalender zelf. Lab: 4308 scenario's 0x FOUT-STIL. Daemons sonny + inmeet-verzoeken herstart.
- Volgende stap als er geknaagd wordt: klantreactie-lab uitbreiden met plannen-aan-scenario's
  en de eerste echte Sunny-boekingen via de nacontrole in de gaten houden.

## 26-08 (namiddag): HERPLAN-LUS NA KLANTKEUZE (Daimy: "bot moet dit zelf afhandelen")
- Gat gevonden: de reply-route (aanbod OPEN) herplande al automatisch bij "ander moment",
  maar wie via de KEUZELINK koos en daarna nog iets appte werd altijd geparkeerd — ook als
  het bericht precies zei wanneer het wél kon (Janos/Rick/Reinhard/Jacqueline).
- Gebouwd: naKeuzeBesluit in lib/boek-poort.js (pure beslislaag boeken/herplan/mens);
  planner trekt bij "ander moment" het aanbod in en vraagt zelf nieuw aanbod aan met de
  klantvoorkeur (dagen/dagdeel/vanaf + nietDeze), klant krijgt netjes bericht (NL/EN);
  pingpong-rem 2 herplans/dag (state.herplanTeller); klacht/annuleren/ander adres → mens.
- Annuleren-gat gedicht: intent "annuleren" gleed vóór deze fix als akkoord door magBoeken
  (klant die na keuze afzegt zou geboekt worden). Verzendpoort: weekbudget 4 i.p.v. 2 als
  de klant zelf om een ander moment vraagt (opVerzoek). Haiku-dagenmapping expliciet.
- Scenario-lab: nieuw onderdeel herplan-na-keuze; totaal 4308 scenario's 0x FOUT-STIL;
  6 echte-historie-replays allemaal juist. Commit gepusht; verzoek-daemon herstart.
- Janos: nieuw aanbod vanaf 4 sep in de wachtrij gezet (verzoek 24b00b2c27244cc8).

## 26-08 (middag): PLANADO-BACKOFF OVERAL + MENS-NODIG PARKEREN + WERKBON-STATE (commit f1b5177)
- Aanleiding: databot-triage 23–26/08. Planado 429 brak boeken/aanbod/syncs; werkbon-verwerker crashte
  in 93 van 186 runs; klanten op "max-voorstellen" bleven eeuwig in de retry-wachtrij (Scholten: 587
  stille retries/dag + herhaalmelding elke 6 uur, Daimy's "1x is genoeg"-klacht).
- Gebouwd: (1) lib/planado-fetch.js — centrale fetch met 429/"Rate Limit Exceeded"-backoff, ingeplugd in
  9 crons/libs (werkbon, planado-outlook-check, outlook-planado-sync, herinneringen, keten-zelfcontrole,
  meetbon-doorzetten, meeneem-melding, afspraak-annuleren, inmeet-mutatie); planner had al eigen backoff.
  (2) verzoek-daemon: max-voorstellen/stil-lijst/mens-actief zijn nu DEFINITIEF → verzoek sluit met reden,
  geen retry-spam meer. (3) verzend-poort logt mens-nodig naar data/mens-nodig-log.jsonl;
  cron-mens-nodig-digest.js bundelt dagelijks 08:20 (launchd nl.sonty.mens-nodig-digest, geladen).
  (4) data/werkbon-verwerkt.json aangemaakt met vanaf=2026-08-20 (ontbrak → reset per run → eerder
  geplande klussen werden stil overgeslagen). Werkbon-testrun draait weer foutloos.
- Daemon nl.sonty.inmeet-verzoeken herstart voor de nieuwe code.
- LET OP / openstaand: (a) montageteams ronden opdrachten in Planado NIET af — 16 bus-opdrachten van
  21-08 stonden op 24-08 (cachedatum) nog op "published"; hele werkbon-flow blijft leeg tot de monteurs
  op afronden drukken → menselijke actie/instructie nodig. (b) Handmatig oppakken: Scholten, Boom-Looij,
  Van Leeuwen, Hensing, Kranenburg (max-voorstellen) + Fazekas/Hensing (niet geboekt na keuze) + bevestiging
  checken van Bergen. (c) Luuk Post hangt sinds 13-08 op "Gripp invullen" (dagelijks "1 mislukt"-melding).

## 26-08: BOEK-CASCADE GEFIXT (Astrid Verkaaik + Chebon Ong) — halve boekingen, vals "bezet", 3 hangende klanten
- Melding Daimy: "Inmeetafspraak Astrid Verkaaik kon NIET via Bookings (geen mailadres)". Werkelijke keten:
  verwerker crashte halverwege op Planado 429 (mede door dashboard-cacheverkeer 25-08) → halve boeking bleef
  achter (Planado-job + kale Outlook-afspraak) → volgende run zag die als "bezet slot" (het eigen-afspraak-
  filter was DOOD: agenda-items uit haalAgenda hadden geen klant-veld) → klant kreeg onterecht excuus
  ("tijd net vergeven") + nieuw aanbod. Zelfde cascade bij Chebon Ong. "Geen mailadres" was een rode haring:
  de mail stond gewoon in aanbodTickets.
- Fixes (gecommit sonty-platform): (1) haalAgenda geeft klant-veld mee (eerste regel omschrijving) zodat de
  botst-checks een eigen boeking herkennen; (2) planadoPost 429/5xx-retry; (3) meetbon-detail-fetch via
  retry-helper (429-tekst crashte als "Unexpected token R"); (4) inmeet-boeken haalt ontbrekend mailadres
  uit planner-state vóór het kale-afspraak-vangnet.
- Herstel klanten: halve boekingen opgeruimd (Planado #1229/#1230 + kale/optie-events), verwarrende nieuwe
  aanbiedingen ingetrokken, keuzes terug op "gekozen" → verwerker boekte beiden schoon: Astrid ma 28 sep
  13:40 Sjoerd (Gripp 6558), Chebon di 6 okt 14:05 Sjoerd (Gripp 6559), beiden met echte Bookings-afspraak
  (bevestigingsmail automatisch) + herstelbericht (Astrid wa, Chebon mail; zijn wa-venster was dicht).
- LET OP: PATCH terug naar "gekozen" zet een token NIET terug in de KV-actieve-set — verwerker ziet hem dan
  niet ("0 gekozen"). Herstel: GET /api/inmeet-aanbod?migreer=1 herbouwt de set. Daarbij kwam ook Katuscha
  Tellegen (10-08) boven: gekozen-status hing nog terwijl de inmeting 18-08 al gedaan was → administratief
  op "verwerkt" gezet. Structureel puntje voor later: PATCH-route zelf de actieve-set laten bijwerken.

## 26-08 (2): MEETBON-KETEN FIXES NA TEST DAIMY (2 aanbetalingsmails, "concept"-factuur, opmaak)
- Daimy tekende testofferte 6556 en kreeg 2 aanbetalingsmails ("factuur ?" 13:05:09 en "factuur
  concept" 13:05:12): de 20s-poll in de app en zijn klik liepen tegelijk (Trengo-tickets bewijzen
  het). Maar één factuur (7446) in Gripp — zonder nummer: `invoice.update status 3` maakt NIET
  definitief (searchname "(concept)", klant ziet factuur zonder nummer). Geen finalize-methode in de
  API (12 namen geprobeerd). WEL: `number` is schrijfbaar → nu number = hoogste+1 + datum + status 3;
  7446 kreeg zo 4179. Nummerreeks gecheckt: 120 laatste facturen sequentieel, geen dubbelen.
  LET OP: Daimy laten checken dat de eerstvolgende kantoorfactuur 4180 wordt (geen botsing).
- FIX (commit na ec39efe): vergrendeling per bon (KV set nx, 120 s) in lib/meetbon/keten.ts;
  bedankt-mail direct na handtekening, daarna pas de factuurmail en alleen mét nummer; app polt
  elke 20 s zolang de offerte op tekenen wacht; daemon nl.sonty.meetbon-keten elke 60 s.
- OPMAAK: Gripp-regel nu in 6494-opmaak (Type/Breedte/Hoogte of Uitval/Montage/Bediening/Motor/
  Motorzijde/kleuren/Overige, witregel, "Waarom dit …"-blok uit de bestaande regel behouden,
  Garantie 3/5/7 als punten); montageregel in plaats bijgewerkt met de gangbare tekst per
  montageproduct; plek + opmerking inmeter → interne notitie (niet op de offerte).
- 26-08 (3, na 2e feedback Daimy): Gripp-PDF negeert <br> (ook bij 6494!) → omschrijving nu één <p>
  per regel (PDF 6560 geverifieerd: regels, witregels, vette koppen); validity 1 (14 dagen) gezet.
  Bedankt-mail direct na handtekening mét getekende PDF (Trengo upload/messages/multipart →
  attachment_ids) + Gripp-link; daarna de factuurmail. Klant tekent niet meteen → offerte-mail
  ALLEEN uit naam van de inmeter (lib/meetbon/inmeters.ts, Trengo-kanaal per inmeter via env
  MEETBON_INMETER_KANALEN); joey@sonty.nl/sjoerd@sonty.nl zijn nog GEEN Trengo-kanalen (V3 aan
  Daimy). Inmeter is nu een keuzelijst (Joey/Sjoerd). KV-wachtlijst meetbon:wacht zodat de
  1-minuut-daemon niet alle bonnen leest (Vercel KV meldde 500k/500k in de build-omgeving!).
  Test-meetbon voor Daimy: 6561 (Gripp id 9212), stap voor stap. 6560 (id 9211) staat op
  "verstuurd", niet getekend, op de wachtlijst.

- Testfacturen om te crediteren/verwijderen: 4179 (id 7446, Daimy TEST GRIP) + de factuur van
  testofferte 6560 (E2E 2, id 9211) zodra die gedraaid is.

## 26-08: MEETBON-KETEN LIVE — OFFERTE IN GRIPP BIJWERKEN → PDF → TEKENEN → AANBETALING 40% (opdracht Daimy /goal)
- Doel Daimy: meetbon klaar → Gripp-offerte aanpassen naar de meetbon (incl. prijs) → PDF in de
  app → klant tekent vanuit de app, of versturen → na handtekening direct aanbetalingsfactuur 40%.
- GEBOUWD (sonty-website, commit ec39efe, live op sonty-website.vercel.app):
  lib/meetbon/prijs.ts (meetbon-product → prijsmotor + Gripp-productnr + omschrijving),
  lib/meetbon/gripp-sync.ts (regels IN PLAATS via offerprojectline.*, nummer blijft; status;
  aanbetaling), lib/meetbon/keten.ts (handtekening → factuur definitief + mail, idempotent),
  API /api/meetbon/bon/[nr]/offerte (GET voorstel, POST bijwerken|versturen|check),
  /pdf (Gripp-PDF doorgeven), /keten (daemon). UI: paneel "Offerte in Gripp" in de meetbon
  na "Meetbon afronden" (stap 1 prijzen/regels met handmatige prijs voor onprijsbare producten,
  stap 2 PDF, stap 3 tekenen in Gripp-viewer (iframe/nieuw tabblad) of mailen, stap 4 getekend +
  aanbetaling). Dashboard toont de ketenstand.
- Daemon: scripts/cron-meetbon-keten.js, launchd nl.sonty.meetbon-keten elke 5 min → POST
  /api/meetbon/keten → getekend? → factuur 40% (invoice.create status 1 → update status 3) + mail
  via Trengo aanvragen@ → Telegram. Bestaande doorzet-daemon (aanbetaling betaald → orders@) blijft.
- Gripp-API feiten (memory gripp-api-schrijven): offer.update met offerlines-array werkt NIET,
  offerprojectline.create/update/delete wel; invoice.create eist templateset 2 + status; GEEN
  mail-API en project.number readonly (offerte→opdracht blijft handwerk in Gripp).
- GETEST: scenario-lab scripts/tests/meetbon-keten-lab.ts 4040 scenario's 0x fout-stil (motorprijs
  per prijsbaar product echt vergeleken); E2E op productie tegen testofferte 6556 (Daimy TEST GRIP):
  regel 51035 in plaats bijgewerkt €800→€1047,27 excl, montage opnieuw, marker in opmerkingen,
  PDF 175 KB, mail naar daimyboot@gmail.com, status Verzonden; iPhone 12 screenshot OK.
- NIET GETEST (wacht op Daimy, V2 op Telegram): handtekening → definitieve aanbetalingsfactuur
  (maakt een écht factuurnummer in de boekhouding, ook op de testklant). Eerste echte geval samen
  doen (regel eerst-1-dan-rest). Ook nog niet: mail-pad van de factuur in het echt.
- Open: testbon 6556 staat in het meetbon-dashboard (Daimy TEST GRIP), testofferte 6556/id 9207
  in Gripp mag weg na de tekentest. Producten zonder prijsmotor (binnenzonwering, gordijnen, velux,
  maatwerk, Zipscreen 130, gekoppeld uitvalscherm) → prijs handmatig in de app (incl. btw).

## 25-08 (3): OUTLOOK-SYNC MAAKTE DUPLICAAT-JOBS NA AFMELDEN — GEFIXT (melding Daimy via dashboard)
- Symptoom (Daimy): elke keer als Joey een opdracht voltooide kwam hij opnieuw in Planado.
- Oorzaak: in cron-outlook-planado-sync.js liep de dedup op starttijd+inmeter alleen over TOEKOMSTIGE
  jobs; zodra de starttijd van een rp-/planner-job verstreek viel hij eruit en maakte de volgende run
  (10 min-cyclus) een ol-duplicaat aan. Verklaart ook de historische dupes (Pecnik #1190, Julia #578,
  Eric #583/#432) die het personeelsdashboard als "afgevinkt-elders" toonde.
- Fix: dedup over ÁLLE jobs (zelfde keuze als de extId-dedup sinds Koeleman 06-08). Bewijs: dry-run
  278 events → 0 nieuw; execute-run maakt alleen echt nieuwe afspraken (per stuk geverifieerd).
- Opgeruimd: 6 duplicaten van vandaag (#1196/1200/1204/1207/1208/1211) na controle dat het origineel
  op dezelfde tijd bestond; proefgeval eerst, daarna de rest; originelen ongemoeid. Oudere afgevinkte
  dupes laten staan (historie). Joeys dag staat weer op precies 7 echte afspraken.
- Dashboard-effect: "vandaag" wordt altijd vers berekend, dus de dupes zijn daar vanzelf weg; de rode
  afwijkingen van eerdere dagen blijven kloppen (het is echt gebeurd).

## 25-08: PERSONEELSDASHBOARD /admin/personeel LIVE (uren + GPS-locatiecheck + tempo)
- Vraag Daimy: kan Planado uren/locatie bijhouden + zien of monteurs echt op locatie afmelden?
  Antwoord: ja — gebouwd als dashboard, live op sonty-website.vercel.app/admin/personeel (link in AdminRail).
- Data: `lib/personeel/planado.ts` haalt per NL-dag alle Planado-jobs (scheduled_at-filter, after-paginering),
  per job detail (timestamps onderweg/gestart/klaar) + GPS-punten (`/jobs/{uuid}/locations`), producttypes
  uit de omschrijving. Afstand GPS-punt↔klantadres bij start én afmelden; ≤250 m = op locatie.
- API `/api/admin/personeel-dashboard?dagen=7|14|30`: per monteur uren (eerste actie→laatste afmelding),
  klanturen, tempo vs gepland (mediaan) en per product (vs teamgemiddelde), klokdiscipline-%, op-locatie-%.
  Afwijkingen met ernst: ROOD = afgevinkt-elders zonder geklokte werktijd / geen-gps; ORANJE = afgemeld-na-vertrek,
  vergeten-afmelden (klok pas latere dag gestopt → werktijd telt niet mee, anders 1197-min-jobs in gemiddelden),
  niet-echt-geklokt (start/af <3 min uit elkaar), niet-gelukt.
- Infra-lessen: Planado rate limit is streng → alle calls door één poortje (250 ms tussenruimte) + 429-backoff;
  KV zit op maandlimiet (500k, Upstash) → dagcache in **Blob** (`personeel/dagcache-v2/`, zelfde patroon als
  offerte-index) + in-memory laag; route geeft deelresultaat + `nogTeLaden` en de pagina vraagt door (maxDuration 300).
- Eerste bevindingen 14 dagen: Joey/Sjoerd klokken ~70-75% van de jobs echt, inmeten is structureel ~70% sneller
  dan gepland (60 min gepland, 15-25 min echt), 7 rode afgevinkt-elders-gevallen (o.a. dubbele Outlook-sync-jobs
  die administratief worden weggevinkt), montagebussen (Bus 1-6) klokken NIET in de app (0 afmeldingen).
- Let op: montagebussen aan de app krijgen = grootste winst voor dit dashboard; duplicaat-jobs uit de
  Outlook-sync vervuilen de afwijkingenlijst (opruimen = minder valse rode meldingen).
- Aanvulling 25-08 (2): over-/minuren per week erbij. Contracturen per monteur instelbaar op de pagina
  (Blob `personeel/contracturen-v1.json`), startwaarden uit roosters defaults.ts: Joey 21 u, Sjoerd 28 u.
  Saldo alleen over volledige, volledig geladen weken; lege geladen week = minuren; lopende week geen oordeel.
  Kanttekening voor interpretatie: minuren in oudere weken kunnen ook betekenen dat er toen nog niet
  (goed) geklokt werd in de app — pas vanaf ~half aug wordt er consequent geklokt.

## 24-08: ORDERMAILS-INHAALSLAG + DAEMON HERKENT ABZ/DEFINITIEVE BEVESTIGINGEN (akkoord Daimy)
- Vraag Daimy: waarom blijven ordermails liggen / staan ze al in de sheet? Analyse: 12 mails
  bleven hangen. 3 oorzaken: (a) ABZ ontbrak in leveranciersfilter (stil overgeslagen),
  (b) nieuw onderwerpsjabloon "Orderbevestiging referentie: X" van Markiezen NL én
  Poedercoating Culemborg (gemeld, bleef ongelezen), (c) ROMA-voorraadorder zonder
  "Bestel nr." in onderwerp + FAKRO gewijzigde-leverdatum buiten het 3-dagen-venster.
- INHAALRUN (eenmalig script, dry-run eerst, daemon-lock gerespecteerd): 7 nieuwe rijen in
  tab "2026 goed": Zwijnenberg 5594 ABZ D26-001425A (lev 16-09), Den Dikken 6517 ABZ
  D26-001431A (lev 16-09, bij 6517-groep rij ~1708), Speelman 6515 ABZ D26-001434A (lev
  09-09), Althuizen 6201 Markiezen 50292, Verschoor 6473 Markiezen 50293, Voorraad ROMA
  8690360 (stelschroeven, week 36/2026), Oldenburger 6270 FAKRO26012524 (V2612507, nieuwe
  leverdatum 25-08; klantnr 6270 via Gripp — FAKRO kapt referentie af op "(627").
  Plus 5 J-updates op bestaande Poedercoating-rijen (ordernr ingevuld): Lambalgen 6318=5302,
  Leeuwen 6269=5301, de Bruin 6267=5320, van den BERG 6003=5321, de Kroon 5271=5322.
  Alle 12 mails op gelezen gezet, state bijgewerkt (imids in verwerkt, uit overgeslagen/gemeld),
  geverifieerd: 0 ongelezen in orders@ (5 dgn), rijen teruggelezen en kloppen incl. plaats/regio.
- DAEMON-FIX (commit 3902245, getest 16/17 + regressie op alle bestaande formaten, 1 "fout"
  was te strenge testverwachting): ABZ in LEVERANCIERS + DealerSalesOrder-branch + ABZ-sectie
  in planning-pdf-parse.js (ordernr/referentie/orderdatum/geschatte leverdatum/producten+maten);
  "Orderbevestiging referentie:"-branch → type orderbev-ref: vult ordernr in op bestaande
  webshop-rij (zelfde E-klantnr + D-leverancier, lege J), anders nieuwe rij, bij ambiguïteit
  melden; ROMA-onderwerpregex accepteert nu ook commissies zonder "Bestel nr." (voorraad).
- NIET gedaan (bewust): FAKRO "Gewijzigde leverdatum"-mails blijven type melden (zeldzaam,
  handmatig). Let op: mails ouder dan 3 dagen vallen buiten het daemon-venster — die worden
  nooit meer automatisch opgepakt, alleen via melding/handmatig.

## 21-08: STILTE-FIXES PLANNINGSKETEN (Fatih/Marius/Mirjam/Jeffrey kregen geen antwoord)
- OORZAAK 1 (bug): lib/verzend-poort.js filterde "onze" berichten op `!m.contact_id`, maar de
  Trengo messages-API geeft geen contact_id → ÉLK bericht (ook van de klant) telde als
  handmatig bericht van ons → "mens-actief" → hele keten 24u stil na elke klantreactie.
  FIX: outbound = `type === 'OUTBOUND'`; mens = outbound van een user_id ≠ 747786 (Sunny
  Sonty = API-account) zonder bot-handtekening. Getest op Fatihs echte historie.
- OORZAAK 2: Sunny (ai-ks) bleef 48u volledig weg bij een lopend inmeet-aanbod, de
  monitor zei "Sunny antwoordt" → niemand. FIX: ai-ks/daemon.js planningRolVoor():
  keuze/akkoord/ander-moment/annuleren = planner/monitor (Sunny weg); VRAAG/klacht =
  Sunny antwoordt mét PLANNING-CONTEXT (voorgesteld moment, waarom niet eerder, "dat past"
  = vastzetten). system-prompt: bij "ik wil een mens" eerst zelf de vraag beantwoorden.
- Monitor (cron-aanbod-replies.js): intent vraag → geen "ik zoek het uit" meer, wachthond aan.
  STILTE-WACHTHOND: laatste klantbericht ≥2u onbeantwoord (geen afsluiter, overdag, <72u)
  → excuus/ontvangstbericht via poort + 🚨 alarm (komt door telegram-filter). Alle acks
  tweetalig; leesKeuze herkent Engels ("yes", "that works", "another day").
- TAAL: lib/aanbod-versturen.js taalVan(lead) (taal-voorkeur.json): aanbod/mail/bevestiging/
  herinnering/reminder in het Engels; bij EN of herhaling eerst vrij bericht, template als vangnet.
- Planner: reminder alleen 08-21u (was 03:49 's nachts), avond-herinnering bij ochtend-verloop,
  via poort; opvolging ronde 2 = herhaling-tekst i.p.v. kopie "goed nieuws"; niet-bezorgd aanbod
  → meteen 'verlopen' + 🚨 met tijden (geen spook-aanbiedingen meer); bewaarState voegt
  opvolging-tellers samen (dubbele "ronde 2"); meldGeenAlternatiefBijFout: klant-reply zonder
  alternatief → eerlijk bericht (ma-do 09-15, drukte) i.p.v. stilte.
- cron-inmeet-herinneringen.js: ReferenceError (b.telefoon) gefixt; LET OP: dit script staat
  in GEEN launchd-plist → dag-ervoor-herinneringen zijn nooit verstuurd. Vraag aan Daimy open.
- gesprek-lab: emoji-only/"dank voor het nakijken"/Image geen FOUT-STIL meer.
- KLANTEN AFGEHANDELD 21-08: Fatih (EN antwoord Sunny: niet eerder dan 28 sep, 8-10 wk, token
  5b752780 aan monitor gekoppeld), Marius (di 29 sep 09:00 voorstel via motor), Mirjam (bericht:
  geen vrijdag, andere dag noemen; dubbel token uit administratie), Jeffrey (antwoord per mail,
  WA-venster dicht). Marco/Michel: afsluiters, geen actie.
- Daemons herstart: nl.sonty.sonny, nl.sonty.inmeet-verzoeken.
- SCENARIO-LAB (Daimy: "minimaal 500"): twee nieuwe onderdelen in scenario-lab/onderdelen/:
  planner-berichten.js (1680: taal × 24u-venster × soort bericht × moment × gesprek ×
  eerdere voorstellen × uur; nep-Trengo, nep-bestanden) en klantreactie.js (960: échte
  monitor-main + Sunny's planningRolVoor met nep-Haiku/register). Stand: 3390 scenario's,
  0x FOUT-STIL. Lab vond en fixte: annuleren/akkoord-in-woorden op open aanbod was stil,
  "ja" ná verlopen aanbod werd niet geboekt, wachthond dubbel met ack, register-storing
  met liggende keuze zonder alarm, monitor-ACK-set per run. Gesprek-lab over 101 echte
  gesprekken: FOUT-STIL 12 → 0 (Marco kreeg afsluitend antwoord).
- Vragen open bij Daimy: V1 voorraadscherm Marius vastleggen? V2 dag-ervoor-herinneringen
  inschakelen (script staat nergens in launchd)?
- SUNNY OCHTEND/AVOND IN SONTY TOPPERS-GROEP WEER AAN (Daimy 21-08: "graag opzetten"):
  plists nl.sonty.sunny-ochtend (ma-vr 07:30) en nl.sonty.sunny-weetje (ma-vr 20:00) stonden
  op .disabled → hernoemd + bootstrap. Verzending via wa-luisteraar-outbox (test-DM aan Daimy
  geslaagd 21-08). sunny-weetje.js: model naar claude-sonnet-5 (grappiger), herhalingsvanger
  (Haiku gaf de 18-08-tekst letterlijk terug). Eerste weetje: vr 21-08 20:00; ochtend ma 24-08 07:30.
- @SUNNY IN DE TOPPERS-GROEP (Daimy 21-08): wa-luisteraar antwoordt als Sunny wordt aangesproken
  (@-mention, "sunny" in tekst, of reactie op een Sunny-bericht) via lib/groep-antwoord.js:
  Sonnet-5, Grok/Tesla-"unhinged"-toon (sarcastisch, roast, vloeken mag behalve kanker), harde
  grenzen (politiek/religie/seks/discriminatie/klantgegevens), woordfilter, max 15/dag, 40 s
  tussen antwoorden, "typt..." + 8-25 s vertraging, quote + mention. Context = laatste 20
  groepsberichten (data/wa-groep-recent.json). Killswitch: data/wa-groep-antwoord-uit.txt
  aanmaken. Log: data/wa-groep-antwoorden.jsonl. Proef: node scripts/lib/groep-antwoord.js --proef "Naam: tekst".
- Sunny's profielfoto met blauw oog: data/sunny-profiel/ (origineel + 2 varianten), naar Daimy gestuurd 21-08.
- COLLEGA-ASSISTENT (DM Joey/Sjoerd/Daimy aan Sunny, lib/collega-antwoord.js) UITGEBREID (Daimy 21-08):
  gripp_offerte geeft nu ook productregels (product, maten, kleur, bediening, motor, prijs excl.);
  nieuwe tool gripp_offerte_pdf downloadt de (concept)offerte via Gripp directpdfurl (read-only)
  en de luisteraar stuurt die als PDF-document mee in de DM. antwoordCollega geeft nu
  {tekst, bijlagen}. Getest op Gripp 6521 (175 KB PDF). Reserve-route (DM-uit) kan geen PDF.
- Groepspersona grover gemaakt (Daimy: "zelfs inmeten kan je niet" mag): roasts over werk expliciet toegestaan.
- GROEPSGESCHIEDENIS (Daimy 22-08 "kan je de hele geschiedenis teruglezen?"): Sunny's nummer zit pas
  sinds 17-08 in de groep, dus via WhatsApp geen oude berichten. Exports van Daimy stonden op de Mac
  (~/Downloads/"WhatsApp Chat - Sonty toppers☀❤ (1).zip", _chat.txt t/m 17-08-2026) → scripts/
  wa-groep-geschiedenis.js import → data/wa-groep-geschiedenis.jsonl (35.053 berichten, jan 2025-aug
  2026; NIET in git, .gitignore). Luisteraar slaat nu ALLES live op (+ history-sync aan). `geheugen`
  bouwt data/wa-groep-teamgeheugen.md (Sonnet, 88 blokken parallel, cache -delen.json); groep-antwoord
  gebruikt teamgeheugen + woordmatch-retrieval van oude berichten (ALIAS export-namen → live namen).
- Sonnet-5 kan een thinking-blok vooraan zetten: overal het tekstblok pakken (was oorzaak "weetje-generatie mislukt").
- WIE-MONTEERDE-WAAR (Daimy 24-08, "Joey wil weten wie bij Daan Ram de plisse heeft opgehangen"):
  collega-DM-tool wie_bij_klant: Outlook "Sonty Montage" (-1 jr..+3 mnd, wanneer/wat) + Planado-
  opdrachtencache (welke bus: BUS_NAMEN-map) → data/planado-jobs-cache.json via scripts/
  planado-jobs-cache.js (Planado kent GEEN datum/zoekfilters; volledige paging, 3,5 s/pagina,
  rate-limit-backoff; cache >12u oud → automatisch verse achtergrond-run). Alleen-lezen.
- Teamgeheugen GEBOUWD 22-08 (data/wa-groep-teamgeheugen.md, ~1050 woorden, + delen/tussen-json): wie is wie, bijnamen, running gags, tijdlijn, gevoeligheden. Opnieuw bouwen na nieuwe import: node scripts/wa-groep-geschiedenis.js geheugen (cache per blok).



## 20-08: META ADS API-COLLECTOR (vervangt CSV-exports)
- Daimy gaf system-user-token "Sonty Dashboard API" (ads_read, verloopt niet) voor
  act_1633352477464320. Staat in ~/sonty/.env (META_ADS_TOKEN, META_AD_ACCOUNT_ID).
- scripts/meta-ads-api.js: per maand per campagne spend/kliks(link_click)/leads ->
  data/campagne-spend-meta.json (zelfde vorm als CSV-import) + data/ad-spend-meta-api.json.
  ad-spend.js pakt API als hoogste Meta-bron; campagne-rendement geeft kliks/metaLeads/cpl door.
- Controle: jan-jun 2026 = CSV op de euro; juli API 25.821 vs CSV 25.441 (CSV te vroeg
  geexporteerd). 2025 nu volledig gevuld (was mrt-mei uit sheet). Aug live (15.105 t/m 20-08).
- update-dashboard.sh: API-stap na de CSV-import; faalt API -> CSV-stand blijft staan.
- Dashboard: lopende maand toont "loopt nog" i.p.v. VERLIES. Commits sonty b39ab12, website aee7ded.
- OPEN: Google Ads API volgt (Daimy); dan zelfde patroon -> data/ad-spend-google-api.json.

## 18-08 (3): FOTO-DASHBOARD — GOEDGEKEURDE UPLOADS UIT HOOFDLIJST
- Klacht Daimy: foto's die akkoord waren bleven in de uploadlijst staan.
- Fix (commit b6da2bd, live + mobiel gecheckt): /admin/fotos tab Uploaden toont
  alleen nog items die iets van Daimy nodig hebben; status "ok" gaat naar
  inklapbare knop "Verwerkt (N)" onderaan (op prod nu 43). Afgewezen blijft
  onzichtbaar zoals eerst. Ter info: 424 foto's wachten nog op akkoord.

## 18-08 (2): OUTLOOK-ANNULERING LEIDEND (sync annuleert mee, heelt nooit terug)
- Eric-geval deel 2: de terugweg-heler had de handmatige Outlook-annulering van
  15-08 ongedaan gemaakt (afspraak stond er vandaag dus weer; Joey reed terecht,
  maar niemand wist of de klant nog rekende op bezoek — kantoor moest bellen).
- REGEL Daimy: wie in Outlook annuleert, annuleert ook Planado. Sync houdt nu
  data/sync-event-gezien.json bij: event ooit gezien en nu weg = annulering (via
  motor of directe delete + melding); naam elders in agenda = verplaatst-melding;
  nooit gezien = helen (bestond al). Werkt vanaf run 2 (run 1 bouwt administratie).

## 20-08: BUSSEN IN PLANADO + MONTAGE-SYNC + WERKBON (grote dag)
- 6 busaccounts in Planado (bus1-6@sonty.nl, ww direct gezet, alleen mobiele app);
  losse monteurs + 3 oude uitnodigingen weg; Joey/Sjoerd/kantoor onaangeroerd.
  Licenties 12/12 vol. Logins in memory reference_sonty_credentials.
- Outlook→Planado sync compleet: montage/service/stoffering naar de juiste bus
  (attendee-voornaam→bus-map in cron-outlook-planado-sync.js), toewijzing volgt
  Bookings-verplaatsingen, TIJDEN uit Bookings-afspraak (buffertijd-fix Daimy;
  Graph-datums 7 decimalen strippen!). Verificatie: 216 opdrachten, 0 tijdfouten.
- NOODREM data/outlook-schrijf-uit staat AAN: sync schrijft niets richting
  Outlook (terugweg-heler + optie-veger uit) tot Daimy anders zegt.
- 17 verouderde team-opdrachten bij Joey/Sjoerd verwijderd (elk met bewezen
  bus-vervanger); #466/#276 bewust laten staan.
- Werkbon: 19 rapportvelden op montage-sjabloon (werk gereed ja/nee verplicht,
  waarom niet, wie fout, herstel, kleur, producten gebleven, uren, foto
  niet-gereed, uitleg volgende afspraak). Alle 119 teamopdrachten herbouwd met
  volledige werkbon (eindtelling 119/119). cron-werkbon-afhandeling elke 30 min:
  gereed=ja → eindfactuur-melding (Gripp-nr), nee → mail werkbonnen@sonty.nl.
  Eindfactuur AUTOMATISCH versturen: bewust NIET gebouwd zonder expliciet akkoord.
- Tracking-SMS: spatie-fix in onderweg-template + volgpagina 3 dagen geldig;
  testjob geslaagd. Montage-voorstellen sheet (S-V) dagelijks 07:10.

## 18-08: VERZENDPOORT PLANNINGSKETEN + VANGNET-FIX (na Hans/Eric-incidenten)
- Incidenten: Hans de Lamboij kreeg 4 voorstellen in 13u (1 over kantoor heen);
  Eric v.d. Meer: Outlook 15-08 handmatig geannuleerd, Planado wist van niks,
  Joey bijna voor niks gereden; vangnet zweeg (matchte alleen op tijdstip).
- Audit 56 planner-klanten: 51 OK, 5x voorstel-spam (allen wel geboekt). Hans
  geboekt do 27 aug 15:45 Joey + op stil-lijst. Charles Gevers geannuleerd via
  motor (RP staat, kantoor belt na). Keten-zelfcontrole UIT op verzoek Daimy.
- GEBOUWD (commit gepusht): lib/verzend-poort.js (stil + mens-actief 24u +
  max 2 voorstellen/week; voorstel fail-closed, boekingsbevestiging fail-open),
  ingebouwd in aanbod-versturen/aanbod-replies/herinneringen; vangnet matcht nu
  op klantnaam; reply-volger 429-backoff. 13 scenario-tests op echte gevallen groen.
- OPEN: was Eric echt geannuleerd? (dan restanten via motor opruimen); Lotte Vos
  handmatig checken (vraag levertijd); montageplanning-voorstel v7 wacht op go.

## 17-08 (2): GRIPP-OMSCHRIJVING IN 6494-OPMAAK + GEEN TERUGWERKENDE KRACHT
- Up/downgrade-blok ("Liever een ander model of bediening?") zat sinds 7 juli in 11
  Gripp-offertes (kwam 1-op-1 mee uit de v4-offertetekst). Invuller knipt het nu weg.
- Opmaak goedgekeurd door Daimy (voorbeeld 6494 A Bertrams): specs-blok, witregel,
  "Waarom dit ..." bold met punten, witregel, "Garantie:" bold met punten. Zit nu in
  cron-gripp-invullen.js (alsGrippHtml); regressietest 200 echte regels, 0 verlies.
- REGEL Daimy: bestaande Gripp-offertes NOOIT herbouwen (nummer staat overal vermeld;
  A Bertrams schoof 6490→6493→6494, dat mag niet meer). De overige 10 met het oude
  blok blijven dus staan. Vastgelegd in memory (gripp-niet-herbouwen, eerst-1-dan-rest).

## 17-08: GRIPP-MARKERING "prijs actueel 2026" GEFIXT (datumregel)
- Daimy meldde: Helma Blokzijl (RP-offerte 13 aug, dus nieuwe prijzen) had geen
  markering in Gripp. Oorzaak: de narekening in cron-gripp-invullen.js kende
  RAL-kleurtoeslagen, voorraadschermen en Roma niet → 13 nieuwe-prijs-offertes
  zonder markering doorgelaten (gemeten over alle 80 RP-offertes in Gripp sinds 3 aug).
- Nieuwe regel (afspraak Daimy 17-08): puur RP-AANMAAKDATUM. Op/ná 3 aug 16:19
  (verhogingsmoment, commit 396bdb1) = markering; ervoor = niet, ook als klant later
  tekent. Geen narekening meer. Commit 69b03fc, gepusht.
- Alle 15 gemiste offertes handmatig in Gripp bijgewerkt (13 gemeten + 2 met
  onbekende exportdatum maar RP-nummer aantoonbaar ná verhoging: 9036, 9071).
  Eindcontrole over 80: 0 echte mismatches. Carlo Pronk (RP 3 aug 09:08, vóór
  verhoging, markering al aanwezig én destijds bewezen actueel) bewust laten staan.
- Los daarvan onderzocht (13-17 aug): annulering inmeetafspraak Raymond van der Ent
  (13 aug 18:46) — geen bot, geen Claude; handmatig vanaf ander account. Klant heeft
  getekende offerte (€3.330) maar géén inmeetafspraak meer. Daimy weet ervan ("niks
  mee doen"). Ook: ab-eindrapport-plist stond op eenmalig 8 aug → dagelijks 09:30
  gezet; telegram-poll + databot-poll gekickstart na netwerkstoring 16 aug.

## 16-08 nacht: HEEL FLOW-PAKKET ALS DRAFT IN KLAVIYO + TEKENBONUS-CAP
- Opdracht Daimy: "rest van de flows alvast bouwen voor overzicht, niet aanzetten".
  11 flows als DRAFT aangemaakt via de flows-API (0 fouten): A Offerte-opvolging
  (5 mails, dag 2-45), C Reactivering (3 mails; C1-productsplit + open/klik-voorwaarden
  moeten in de UI bij review), D Cross-sell (90d), E Service+review (7+7d), G Welkom
  (lijst R76XQg), RP1/RP4/RP5 (nieuwe metrics "RP: offerte verstuurd/geaccepteerd/
  afgewezen" — events moeten nog gebouwd), W1/W2/W3 (weersegmenten). Segment-triggers
  werken gewoon via de API ({type:'segment',id}). FLOWS.md bijgewerkt.
  Sanity: 3 live (2 Tekenbonus + oude aanvraag-flow), al het nieuwe draft.
- Tekenbonus-cap (vraag Daimy "meer dan 30 aanvragen/dag"): cap bouwt automatisch op
  30/dag → +15 per week → plafond 75/dag (warm-up mail-reputatie aanvragen@), en de
  selectie-leeftijdsgrens is 60→75 dagen zodat niemand uit de wachtrij veroudert
  (oudste eerst). Doelgroep nu 2.134.

## 16-08 avond: TEKENBONUS-CAMPAGNE — BESLUITEN + BLOK 1 GEBOUWD
- Besluiten Daimy: staffel 100/250/500 OK; bonus ONDERAAN de offerte (boven het totaal,
  onder de 15%-actieregel); deadline wordt A/B-GETEST (arm 2 dagen vs arm 4 dagen, plus
  controle-arm gewone reminder zonder bonus); testoplevering op zijn eigen offerte
  20266757 goedgekeurd na 3 iteraties (les: 15% groepskorting ombouwen naar zichtbare
  euroregel, anders toont de bonus 588 i.p.v. 500; bonusregel exact -500, totaal klopt).
- BLOK 1 LIVE in scripts/tekenbonus/: mag-benaderd.js (V9-guard, 6 lagen, fail-closed,
  klant-breed op email/tel/adres) + selectie.js (status Offerte-verstuurd/AI-verstuurd,
  30-60 dagen, niet gearchiveerd → nu 1.706 kandidaten). GETEST tegen echte dossiers:
  Edwin/Kirsten/Victor/Barbara/testdossier allemaal geweigerd (test-mag-benaderd.js),
  steekproef 15 echte kandidaten allemaal terecht groen, laag 6 (eenmaligheid via
  data/tekenbonus-log.json) geïsoleerd bewezen, lagen 3/5 gedekt door klant-brede match.
- BLOK 2 OOK GEBOUWD (16-08 laat): offerte-prep.js (bereidVoor: backup, groupDiscount
  → euroregel, staffelbonus onderaan, verlengen tot deadline+2, harde totaal-verificatie
  met automatische rollback; ruimOp: bonus eruit + groupDiscount exact terug — Sunny's
  guard checkt groupDiscount 15%), mail-template.html (10 tokens), run.js (3 armen
  round-robin via data/tekenbonus-ab.json, CAP 30/run, één klant = één arm — dedupe-bug
  gevonden en gefixt in eerste proeflijst; TESTMODUS standaard, LIVE-pad gooit bewust
  een error tot .tekenbonus-live bestaat én --execute; --proef N stuurt voorbeeldmails
  naar daimyboot@gmail.com). GETEST: proeflijst 30 echte kandidaten (armen, staffel,
  weekend-regel kloppen), volledige prep/opruim-cyclus op testofferte 20266757 exact
  rond (12.674,49 → 13.174,49 → 12.674,49). NOG TE DOEN vóór live: Klaviyo-verzending
  in het LIVE-pad (afzender Jaimy, reply aanvragen@), meting per arm in weekrapport,
  en Daimy's expliciete "aan".
- BULK-VERIFICATIE (vraag Daimy "100000% zeker?"): alle 343 bekende akkoord-dossiers
  (stop-statussen 60d + alle boekingen) als kandidaat door de guard gevoerd → 343/343
  geweigerd, 0 doorgelaten, ZONDER de Trengo-laag (die is dus nog een extra slot erop).
  Vaste test: scripts/tekenbonus/test-bulk-verificatie.js — opnieuw draaien vóór elke
  live-gang. Ook via Klaviyo getest (16-08 laat): 3 arm-mails + 1 variabelen-campagne
  (template SfJgae, testlijst Wpd5tS — live flow triggert alleen op R76XQg, gecheckt)
  naar daimyboot@gmail.com + joey@sonty.nl; per profiel eigen offerte/bonus/deadline
  (Daimy 20266757/500/di-18, Joey 20268628/250/do-20) — variabelen + staffel bewezen.
  Bekende restrisico's (eerlijk): (1) klant met totaal afwijkende identiteit in een
  tweede dossier is onherkenbaar voor élk systeem — mitigatie 3 sleutels (mail/tel/
  adres) + Trengo-laag; (2) race met tekenen op verzendmoment — mitigatie in live-pad:
  guard per klant direct vóór de send + ACCEPTED-hercheck in de prep.
- SCENARIO-LAB GEDRAAID (vraag Daimy "meerdere scenario's getest?"): nieuw onderdeel
  scenario-lab/onderdelen/tekenbonus.js — 544 scenario's (guard-matrix 500 gesampled
  uit 4.608 combinaties over identiteit/tweede-dossier/getekend/boeking/opt-out/log,
  plus staffelranden, deadline-weekmatrix, prep- en opruimpaden incl. rollback), 0x
  FOUT-STIL, 0 crashes. Twee aanscherpingen uit het orakel direct ingebouwd: (1) klant
  niet in mail-export = opt-out onbekend = NIET mailen (was: door mét e-mail), (2)
  magBonus-ondergrens: totaal onder 750 of kapot → geen bonus-mail (run.js filtert).
  Steekproef daarna herdraaid: echte kandidaten blijven gewoon mailbaar.
- LIVE GEZET (GO Daimy 16-08 avond: "morgen de eerste 30+ dagen mensen gaan mailen ok"):
  run.js volledig live-pad — fase 1 selectie (guard+doc-hercheck+magBonus+dedupe), fase
  2 per bonus-arm: bereidVoor (backup/verificatie/rollback) → Klaviyo-profiel-properties
  → verse lijst per arm per dag → campagne met goedgekeurde template SfJgae (afzender
  Jaimy, reply aanvragen@) → send; campagne-fout = alle geprepte offertes automatisch
  teruggedraaid. CONTROLE-ARM MAILT NIET (nulmeting) omdat Daimy+Joey het flow-pakket
  (incl. herinnering-mail) nog samen gaan reviewen. Log data/tekenbonus-log.json (arm,
  bonus, deadline, origineleGroupDiscount, status) = eenmaligheid + meting.
  CRONS: nl.sonty.tekenbonus (ma-za 10:30, --execute) + nl.sonty.tekenbonus-opruim
  (dagelijks 09:45: getekend registreren, verlopen bonus uit offerte + groupDiscount
  terug; coulance: pas na 23:59 van de deadline-dag). KILL SWITCH: verwijder
  scripts/tekenbonus/.tekenbonus-live (staat er nu op). CAP 30 klanten/run.
  Checks vlak voor live: lab 544/0 FOUT-STIL, bulk 343/343 geweigerd, dry-run OK.
- OMGEBOUWD NAAR FLOW (16-08 zeer laat, Daimy: "flows, anders alleen losse data" +
  "doe wat jij het beste vindt"): geen campagnes/lijsten-per-dag meer. run.js stuurt
  per bonus-klant een Klaviyo-EVENT "Tekenbonus aangeboden" (metric RMRu9T) met alle
  gegevens als event-properties (snapshot, geen property-races met de daily sync);
  Flow "Tekenbonus" (QViEvZ, via de flows-API .pre-revision aangemaakt ONDANKS de
  FLOWS.md-waarschuwing — gelukt met temporary_id + entry_action_id; definition
  geverifieerd) triggert daarop en verstuurt template "Sonty | Tekenbonus (flow,
  event-data)" (flow-kopie UwarwX, 0 hardcoded waarden, 16 event-vars, unsubscribe ok),
  afzender Jaimy/aanvragen@, smart sending BEWUST UIT (offerte is al klaargezet, mail
  mag nooit stil geskipt). Flow staat LIVE. run.js checkt vóór het preppen of de flow
  live is (anders run overslaan + melding). klaviyo-verzend.js (campagne-route)
  verwijderd. Alle stats voortaan op één plek: Flows → Tekenbonus. End-to-end bewijs
  verstuurd: echt event → flow → mail naar daimyboot@gmail.com.
- A/B ZICHTBAAR GEMAAKT (Daimy: "ik zie geen A/B, maar 1 mail"): nu TWEE flows naast
  elkaar in Klaviyo — "Tekenbonus 2 dagen" (XUFVKT, metric WBskhq) en "Tekenbonus 4
  dagen" (TUFSZX, metric UP2sLV), elk eigen stats; oude enkelflow QViEvZ verwijderd.
  run.js stuurt het event naar de metric van de arm. Eindcheck v2: 17/17 PASS.
  Eindcheck v1 ving nog een echt gat: 5 TESTDOSSIERS in de doelgroep (3x Daimy Boot,
  FGC SONTY, Playwright Testklant) → testpatroon-filter + @sonty.nl-filter in
  selectie.js. Twee bewijs-events (2d: 500/di 18, 4d: 250/do 20) naar daimyboot.
  NOG TE DOEN deze week: reminder op de laatste bonusdag (vóór wo 19-08, eerste
  2d-deadlines, kan per flow als eigen stap) + wekelijkse meting per arm.

## 16-08: WINTERONDERZOEK (doel Daimy: winter winstgevend i.p.v. verlies) — RAPPORT KLAAR
- Anatomie: okt-dec 2025 marge 108/72/45k vs kosten 118/106/91k (sep-dec samen -121k).
  Oorzaak = volume: instroom zakt van 1.250-1.500 naar 365-380 offertes/mnd (factor 4);
  conversie blijft ~10% (dec 6,6%). Prognose okt-dec 2026 bij ongewijzigd beleid: -222k.
- Datakansen: (1) rolluiken = winterproduct (tot 74% van winterakkoorden, jan-conversie
  22%); (2) winter-ads renderen in okt/nov net zo goed als aug (omzet/ad-euro 7,5 vs
  6,5), alleen dec slecht (3,8) — afschalen was te grof; (3) pergola-oriënteerders
  (65-100 off/mnd winter, ~0 conversie) = teken-nu-doelgroep voor prijsstijging jan
  2027 (prijs vast, inmeten later); (4) raamdeco/behang amper aangeboden in winter,
  Klaviyo+18 templates liggen klaar (flows UIT); (5) berg betaald winterwerk in tab
  "Geplaatst niet gefactureerd": 66k direct factureerbaar (36 opdrachten), 670k
  verkocht-nog-niet-geplaatst (288 = winterwerk team), 346k status onduidelijk;
  (6) jan/feb 2026: 2x instroom van 2025, feb al +6k → volume werkt.
- Plan (doorgerekend, +165 à 190k → winter rond break-even): rolluik-offensief okt/nov
  (ads verschuiven, niet korten), teken-nu-campagne nov-dec op prijsstijging 2027,
  binnenlijn via Klaviyo, dec-ads naar 15-20k + dec-lasten kritisch (2025 kon met 64k),
  facturatie-sprint + werkvoorraad in okt-dec plaatsen (cash).
- MAANDPLAN t/m mrt 2027 opgeleverd (16-08, op verzoek Daimy): AUG oogsten+facturatie-
  sprint+werkvoorraad inplannen; SEP ads ombouwen naar rolluiken+woonmaand klaarzetten;
  OKT woonmaand 20%+Klaviyo-binnenlijn aan+VvE-aanschrijving; NOV teken-nu-campagne
  (prijsstijging jan 2027, prijs vast/inmeten later)+dec-draaiboek; DEC deadline-piek+
  ads 15-20k+lasten minimaal+jaar schoon factureren; JAN prijsverhoging+rolluiken (jan-
  conversie 22%)+ads ~35k; FEB vroegboek voorjaar+showroomdagen+team op sterkte; MRT
  alles aan. Stuur-KPI's per maand: instroom, rolluik-akkoorden, teken-nu-deals,
  maandwinst. Financiele doelen per maand: okt 0, nov 0, dec ≥-20k, jan 0, feb +10k.
- BESLUITEN Daimy 16-08 avond: V9 (6-lagen uitsluit-waarborg op klantniveau) JA en is
  harde eis voor alles onder V6/V7; V10 NEE (mail-afmelding hoeft niet naar RP);
  Klaviyo-sync blijft 1x/dag; NIKS naar klanten sturen.
- TEKENBONUS-TESTMAIL verstuurd naar daimyboot@gmail.com (16-08): opzet = waarheid
  eerst ("jouw offerte staat nog op de oude prijs, nu opnieuw = ruim 1.100 duurder",
  klopt voor alle offertes van voor 3 aug) + eenmalige tekenbonus 250 euro vast bedrag
  met deadline. Basis dist/sonty-herinnering-2, echte offerte 20266757 (13.174,49,
  dossier Daimy Boot 45aeb252), verstuurd via Outlook-testroute (stuur-testmails-weg).
  Bouwscript+HTML in scratchpad (sessie 410ce2a0). Bij echte inzet eerst: offertes
  verlengen, dag-30-selectie, V9-lagen, A/B-meting. Wacht op oordeel Daimy (V11).
- DEFINITIEF ONTWERP TEKENBONUS (akkoorden Daimy 16-08 avond): STAFFEL 100 (tot 2.500)
  / 250 (2.500-7.500) / 500 (boven 7.500) — vast bedrag beloonde verkeerd om (28% van
  doelgroep zit 1.000-2.500 waar 250 tot halve marge kost; 2.754 open offertes 30-60d,
  gem 4.173). Volgorde per klant: (1) RP-offerte bijwerken VÓÓR de mail: geldigheid
  verlengen + zichtbare kortingsregel "Tekenbonus t/m [datum]" via pasOfferteAan
  (kortingRegel, nooit stapelen), (2) dan mail (link=zelfde bedrag, online tekenen =
  bonus erin), (3) onder de knop: "Tekenen kan direct online, planning neemt binnen 5
  werkdagen contact op" (keten bestaat en is 16-08 gefixt), (4) na deadline zonder
  handtekening kortingsregel automatisch verwijderen + loggen, (5) alles binnen
  V9-waarborg + A/B. V12 open: go om te bouwen (testmodus, niks naar klanten).
- V6 aan Daimy open: winteracties alvast klaarzetten (rolluik-mails, teken-nu-campagne,
  facturatielijst) of eerst laten bezinken.

## 16-08: EDWIN KANTERS (+31641223208) UITGEZOCHT — 3 STRUCTURELE GATEN, WACHT OP GO
- Vraag Daimy: ticket niet in sheet, niet naar Inmeten inplannen; later: offerte door AI
  gemaakt, kortingsopbouw fout; NIETS aanpassen, alleen uitzoeken.
- FEITEN: klant vulde 13-08 configurator in met 06-41223508 (WhatsApp is ...208, 1 cijfer
  anders — daarom onvindbaar op app-nummer). RP maakte 3 offertes in dezelfde ms
  (202611566/589/590). Dossier (RP-item ad8c60c2) is NOOIT in kolom Offerte controle
  geweest → V4 heeft de docs nooit genormaliseerd. Getekend za 15-08, dossier stond
  vóór de bot-reactie al op Inmeten inplannen (RP zelf/handmatig, niet de bot), geboekt
  zo 16-08 13:45 (Joey di 18-08, Gripp 6487, inmeet-boekingen "sheet": null).
- GAT 1 (kortingsopbouw): doc 202611566 heeft naamloze korting PER REGEL (20% scherm,
  20% montage, 15% Tahoma, totaal €3000,75) i.p.v. de vaste opbouw = één groupDiscount
  "20% korting voorraad scherm" onderaan (vergelijk 202611562 mickael van Es, zelfde dag
  zelfde product, wél via V4 en wél correct). Herkomst regelpercentages = RP-inrichting,
  nog niet geverifieerd.
- GAT 2 (sheet): sheetrijen schrijft alleen V4 (09:00/17:00, zo niet — getDay()==0 skip),
  en alleen voor items die op dát moment in een register-status staan (GC/TeVer/Gordijnen/
  Winkel/AI/Inmeten-inplannen; cron-offerte-controle-v4-combined.js:1982). Edwin zat er
  tijdens geen enkele run in: OC overgeslagen + Inmeten-venster viel precies in
  za-avond→zo (geen runs). Rij komt dus NOOIT automatisch; 589/590 ook niet.
- GAT 3 (bot-bug): ai-ks/tools.js inmeet_afspraak_voorstellen, getekende-offerte-pad
  (regel ~358): early return "DOORGEZET" vóór de RP-PATCH (regel ~396) → verplaatsing én
  plannernotitie worden NIET uitgevoerd terwijl de bot en de klant "geregeld" te horen
  krijgen. Hier toevallig geen schade (RP had al verplaatst), structureel wel.
- GO Daimy (16-08 middag): offerte 202611566 NIET meer aanpassen; rij alsnog in sheet;
  structureel fixen. ALLES GEDAAN, zelfde dag:
  1. SHEET HERSTELD: Edwin (Aug 2026 rij 894) + 7 audit-gevallen (Barbara Weeink,
     Jolanda van Gelder, Victor Ansink, Margreet Steup-Beekman, Droog, Ad van Gorkom,
     Lisa Terreehorst) + 6 extra die het vangnet vond (Peters, Happel, Pluijmers,
     M. van der Wereld, J. Udo, Sin Yan Leenders) = 14 rijen, geel gemarkeerd,
     maandtab op offertedatum, bedrag incl. regel- én groepskorting.
  2. TOOLS.JS GEFIXT (ai-ks): getekende-offerte-pad voert verplaatsing + plannernotitie
     nu écht uit; regressietest scripts/ai-ks/tests/inmeet-doorzetten-test.js (12 checks,
     fetch-stub). Keten-daemons herstart via herstart-keten-daemons.sh.
  3. NIEUW: scripts/cron-sheet-vangnet.js + launchd nl.sonty.sheet-vangnet (08:15 en
     20:15, óók zondag). Doet twee dingen: (a) ontbrekende offerte-rijen bijschrijven
     voor recent bewogen dossiers in OV/Inmeten/Gripp/Afgerond (dedupe op ALLE
     offertenummers van het dossier, state in data/sheet-vangnet-state.json);
     (b) korting-vangnet: verse ongetekende dossiers met het machinale patroon
     (>=2 docs zelfde creation-ms, naamloze regel-kortingen) → regel-kortingen strippen
     en item terug naar Offerte controle zodat V4 normaliseert (NOOIT strippen zonder
     terugzetten of andersom: V4 haalt regel-kortingen zelf niet weg = dubbele korting).
     Telegram-melding alleen bij actie. DRY=1 voor proefdraai.
- AUDIT (vraag Daimy): 200 flow-dossiers gecheckt → 184 stonden goed, 8 NERGENS (nu
  hersteld), 8 met oude rij zonder offertenummer (Jan/Mei-era, gemeld, niet aangepast).
  Aanbiedingen: NIEMAND stilzwijgend blijven liggen — 25 verlopen aanbiedingen horen
  allemaal bij klanten die alsnog boekten; 4 open binnen hun 24u; reminder/ronde-2/
  belscherm-keten werkt. Vlag Kirsten de Koning OPGELOST (16-08): zij is
  handmatig gepland buiten de aanbod-flow om — Outlook-afspraak Joey ma 11-08 08:00
  (outlook-planado-sync.log r312), inmeten heeft al plaatsgevonden; item daarom
  terecht handmatig op Afgerond gezet op 06-08.
- AANVULLING 16-08 avond (vraag Daimy "waarom geen datum/inmeter/1tje"): de 7 akkoorden
  waren winkelklanten die planner Jorren zelf in Outlook inplande, buiten de aanbod-flow
  om; sheet-koppeling (lib/sheet-inplannen.js: 1tje + inmeetdatum + inmeter) kon nergens
  heen omdat de rij ontbrak. Nu handmatig ingevuld op basis van Outlook-sync/boekingen:
  Edwin 18-8 Joey, Jolanda 15-9 Joey, Margreet 27-8 Joey, Droog 12-8 Sjoerd, Ad van
  Gorkom 17-8 Sjoerd. Barbara ging vandaag al vanzelf goed (rij bestond inmiddels).
  Lisa Terreehorst: 1tje gezet maar GEEN afspraak vindbaar (Outlook-sync kijkt pas vanaf
  ~05-08; zij tekende 18-07) — Jorren moet checken of zij ingepland/ingemeten is (V3).
  Let op: "Afgerond" wordt door gripp-invullen gezet (getekend → Gripp-offerte → Afgerond)
  en zegt niets over inmeten.
  V4 GEBOUWD (16-08 avond, GO Daimy; V3/Lisa laten rusten van Daimy): de Outlook-sync
  roept bij elke NIEUWE inmeet-afspraak nu schrijfInplanning aan (alleenAlsLeeg:
  overschrijft nooit een echt inkoopbedrag; geenNieuweRij: rij niet gevonden →
  sheet-schrijf-wachtrij, planner-runs proberen opnieuw, sheet-vangnet maakt intussen
  de offerte-rij). zetInWachtrij dedupet nu ook op sleutel (event-id) voor entries
  zonder grippNr. Getest: guard-regex, idempotente herschrijf (Edwin), geen-nieuwe-
  rij-pad, dry-run sync schoon (181 events, 0 fouten). Keten-daemons herstart.
- RESTGAT (klein, bekend): oud item + nieuwe offerte die nooit beweegt komt pas in de
  sheet zodra het dossier beweegt (tekening/boeking). Waarom RP sommige aanvragen met
  3 varianten direct genereert en OC overslaat = RP-kant, niet vast te stellen vanaf hier.
- Telegram-poller stond ~19u stil, herstart met launchctl kickstart.

## 16-08: WHATSAPP "NIET AFGELEVERD" — OORZAAK GEVONDEN + VANGNET LIVE
- Daimy: veel offerte-templates in Trengo op "niet afgeleverd" terwijl de nummers echt
  lijken. Gemeten (Trengo delivery-status): 8 van 42 recente offerte-apps FAILED (19%),
  allemaal "Message undeliverable". Niet Meta, niet de templates, niet de verzendcode.
- OORZAAK (zelf headless gereproduceerd, POSTs geblokkeerd dus geen echte lead): het
  RP-formulier toont het telefoonveld in +31-opmaak; klanten die daardoor de 06 weglaten
  komen als +31 + 8 cijfers in RP en de formulier-check houdt dat NIET tegen. Typ
  "22422242" → veld maakt er exact +3122422242 van (= kapotte nummer van Cas Dekker
  15-08). Praktijkbewijs: Giel Kooi kapot +3144536548 vs goed (Tiny en Giel) +31644536548.
- BESLUIT DAIMY: (1) hij meldt het formulier-lek zelf bij Reuzenpanda; (2) vangnet
  gebouwd (zie hieronder); (3) GEEN aflever-wachter — hij krijgt al te veel meldingen.
- VANGNET LIVE (commit 427a95f): `scripts/lib/telefoon-normalisatie.js` — één
  normalisatie voor WhatsApp-nummers. 8 cijfers na +31 = weggelaten 6 terugzetten
  (hersteld), vaste/onvolledige nummers = skip (markWaSent zodat er geen retry-loop
  komt). V4 gebruikt hem; herstellingen en skips staan in de bestaande run-samenvatting
  op Telegram (geen extra berichten). Followup-scripts staan in uitgeschakeld/ en zijn
  bewust niet aangepast.
- GETEST: scenario-lab `telefoon-normalisatie` 154 scenario's 0x FOUT-STIL; regressie op
  18.993 echte RP-nummers: 94,1% identiek, 524 hersteld (het lek is oud en groot),
  590 kansloze nummers voortaan skip, 0 ooit-werkende nummers geraakt (alle 119
  geslaagde deliveries in de steekproef waren +316).
- WEEKTELLING (uitslag 16-08): 340 offerte-apps in 7 dagen, 46 niet afgeleverd (13,5%).
  Van die 46: 16 herstelbaar (8-cijfer-lek), 8 vast nummer, 4 onbruikbaar, 18 geldig
  ogende 06-nummers (typefout/geen WhatsApp, waarvan 3 duidelijk nep zoals 0612345678).
- INHAALACTIE (Daimy-opdracht 16-08): 13 klanten met hersteld nummer alsnog de
  offerte-app gestuurd (checks: geen ACCEPTED, nog in Offerte verstuurd, geen
  mailcontact in Trengo; 3 nepnummers geskipt). Resultaat: 5 aangekomen (2 gelezen),
  Giel op SENT, 7 alsnog undeliverable (gok fout, ander cijfer mist). Die 7 (Cas
  Dekker, Teus Bruin, Judith Uwimana, Sel Selim, Thomas Pröpper, Luuk Post, Ana V)
  zijn via WhatsApp onbereikbaar; alleen mail/bellen kan nog. Daimy wil GEEN extra
  meldingen/automatiek hiervoor.

## 16-08: MEENEEM-MELDING VOOR DE INMETER — LIVE
- Opdracht Daimy: de inmeter moet de avond voor de afspraak in Planado zien wat hij van de
  zaak mee moet nemen. Na een paar rondes aangescherpt tot: ALLEEN binnen raamdecoratie en
  behang ("niet de rest, want dat nemen we al allemaal mee"), alleen als we daar ook echt
  gaan inmeten, altijd de dag ervoor om 18:00, en de lijst ONDER HET ADRES, niet als
  opmerking in de opdracht.
- LIVE: `scripts/cron-meeneem-melding.js` + `data/meeneem-regels.json`, plist
  `nl.sonty.meeneem-melding` geladen (1 ronde per dag, 17:00), geregistreerd in
  data/systemen-register.json (54 diensten).
- Werking: 17:00 kijkt hij naar de inmeetopdrachten van MORGEN (dagenVooruit 1), leest per
  afspraak de offerte, en zet per inmeter EEN Planado-opdracht van 15 min op vandaag 18:00.
  Omschrijving = een regel, de hele lijst in `address.description`. type default, geen
  template, X-Planado-Notify-Assignees true. external_id `meeneem-<wie>-<dag>` = idempotent
  (bestaat -> PATCH, dag leeg -> DELETE; `meeneem-voorbeeld*` wordt met rust gelaten).
- BRON IS ALLEEN DE OFFERTE. De leadtekst is bewezen onbruikbaar: van de 8 leads die op hun
  leadtekst "raamdecoratie" riepen had GEEN ENKELE raamdeco in de offerte (Helene Beek: lead
  zegt raamdecoratie, offerte is een rolluik). Geen leesbare offerte = geen melding, maar
  wel in de log met reden.
- 73% van de inmeetopdrachten heeft geen rp-koppeling (uit Outlook gesynct of handwerk).
  Die worden op klantnaam aan de lead gekoppeld, alleen bij een unieke treffer. Onbepaalbaar
  ging van 61 naar 31 van de 84.
- REGEL IS OMGEKEERD: buitenzonwering + horren + bijregels herkennen, al het andere melden.
  Lijsten gebouwd op alle 51 productnamen die echt in de offertes voorkomen; er blijven er 2
  over die melden: "Raamplissé Inklem Unit" (Daimy: mag blijven staan) en "Blend prijzen en
  spullen mee nemen mogelijk keukenraam".
- VAL DICHTGEZET: `cron-outlook-planado-sync.js` maakt van elke Planado-opdracht zonder
  agenda-afspraak een Bookings-afspraak met bevestigingsmail. external_id `meeneem-*` wordt
  daar nu overgeslagen; NIET_KLUS sluit ook MEENEMEN/LET OP/VOORBEELD-onderwerpen uit.
- ONDERWEG GEFIXT: (1) het veld `Opmerking:` uit de RP-lead ging nergens heen (135 van 1000
  leads hebben er een), staat nu in de Planado-opdracht. (2) "Waarom ROMA?" werd als PRODUCT
  geparsed, gaf valse meldingen en telde mee in de inmeetduur; gefixt in
  `inmeten-planner-lees.js`, cache ter plekke opgeschoond.
- ZICHTBAARHEID GETEST: Joey ziet opdracht #565 in zijn app, dus type default zonder template
  is genoeg. Testopdrachten met/zonder sjabloon zijn opgeruimd.
- OPEN: voorbeeld #565 (zo 16-08 18:00 bij Joey) staat er nog, weggooien zodra Joey heeft
  gezegd wat hij ervan vindt. Eerste echte ronde: 14 afspraken voor morgen, 0 meldingen
  (geen raamdeco ingepland), 7 zonder leesbare offerte.

## 16-08: MONTEURS NAAR PLANADO (fase 1 van "Claude doet de montageplanning")
- Doel Daimy (/goal): monteurs gaan Planado gebruiken, alles moet er goed in staan
  mét werkbon. Eindbeeld (Daimy): "nu plant een mens zonder rekening te houden met
  producten; straks doe jij die planning" — fase 2 = montageduur per producttype
  leren uit historie, fase 3 = autonome montageplanner zoals de inmeetplanner.
- ANALYSE (622 montages, 120 dagen Outlook): vaste naamvorm "Montage Sonty - klant",
  team als attendee, start 08:00, rug-aan-rug (reistijd zit IN de duur), 1-3 klussen
  per teamdag, gem 7,3u/dag, duur = handmatige inschatting (nergens productgestuurd).
- GEVONDEN: Planado had NUL montage-opdrachten; werkbon-sjabloon "Montage afspraak
  particulier" (uuid 1f11c802-6613-6d00-...) bestond al met 10 rapportvelden maar was
  nooit gebruikt. Sjabloon zakelijk: 1f11c802-6675-6110-...
- GEBOUWD (6fa6143): cron-outlook-planado-sync.js syncot nu ook montages → juiste
  team, werkbon-sjabloon, Gripp-productregels (TE MONTEREN), custom fields Product
  type/Bijzonderheden. ACHTER SCHAKELAAR: pas actief met data/montage-sync-aan (of
  --montage los). Dry-run 16-08: 43 montages klaar om te maken, 0 fouten.
- ECHTE BUSSEN (Daimy 16-08): Marvin+Moa, Kevin+Tygo, Yudi+Nick, Marvin+Bart,
  Frenky+Dennis. Alleen Yudi+Nick heeft een kloppend Planado-account; "Kevin Gibson
  + Marvin" klopt niet meer. In MONTEURS-mapping staan daarom alleen eenduidige
  namen (Yudi/Nick/Jorren/Sjoerd).
- GEDAAN 16-08 (middag): Planado-accounts hernoemd naar busnamen — "Bus Kevin +
  Tygo" (was Kevin Gibson + Marvin) en "Bus Yudi + Nick" (was Nick Huizer + Yudi);
  sync herkent Kevin/Tygo nu ook (d3dd6fd). Pro-abonnement = per gebruiker, ~$36/mnd
  (9 users, $324.48). Demo-werkbon-opdracht #562 staat op Daimy's eigen account.
- 16-08 (namiddag): Daimy: "nog niks erin zetten, we zijn aan het uitzoeken" —
  demo-opdracht #562 weer verwijderd, Planado leeg qua montages, schakelaar blijft
  uit. Bussen genummerd (nr = laadvak, data/bussen.json): 1 Marvin+Moa, 2 Kevin+Tygo,
  3 Yudi+Nick, 4 Marvin+Bart, 5 Frenky+Dennis; accounts heten nu "Bus 2/3 - ...".
  Toewijzingsplan oude taken: deelnemer-naam → bussen-register → busaccount; ambigue
  "Marvin"-gevallen NIET automatisch maar als lijstje naar Nanny; daarna bus-naam als
  agenda-deelnemer. Stappenlijst Daimy staat op Telegram (nummering, accounts,
  Nanny + team informeren, GO).
- 16-08 (avond): mapping COMPLEET EENDUIDIG na antwoorden Daimy: Marvin/Moa=Bus 1,
  Kevin/Tygo=Bus 2, Yudi/Nick=Bus 3, ZZP 1/Bart=Bus 4 (ZZP 1 = Marvin+Bart!),
  Dennis/Frenky=Bus 5. Mick vervallen (LET OP: 4 komende Mick-klussen in agenda
  moeten herverdeeld). Arnold = zzp binnen-raamdecoratie, krijgt eigen account.
  Logins op eigen mailadressen. Nanny hoeft NIETS te veranderen. Alles in
  data/bussen.json (besloten/openVragen). Pilotweek Bus 3 akkoord.
- WACHT OP DAIMY: mailadressen bus 1/4/5 + Arnold (laatste blokkade) → dan accounts
  bouwen; daarna GO voor pilotweek. OUD (deels ingehaald): V1 = 2 nieuwe busaccounts (Marvin+Bart, Frenky+Dennis, ~$72/mnd)
  + akkoord om Tygo's losse account om te bouwen tot Bus Marvin + Moa (gratis) +
  e-mailadressen per bus. Daarna: Nanny bus-namen in agenda laten zetten (twee
  Marvins!), team informeren → touch ~/sonty/data/montage-sync-aan → opdrachten
  met werkbon gaan erin.

## 15-08 (avond): ÉÉN SYSTEMEN-REGISTER + BEWERKBAAR DASHBOARD + ZELFHERSTEL
- Opdracht Daimy (/goal): "veel te veel losse shit" — alles in kaart, één bewerkbaar
  systeem, bewaken dat alles blijft samenwerken.
- Gevonden: 53 nl.sonty.*-diensten draaien, maar SYSTEMEN.md kende er 24,
  status-collect 24 en health-check 17 — drie losse lijsten die uit elkaar liepen.
- GEBOUWD (sonty-platform 264f541+, website 8a8e7cd+bf1c9a1):
  1. `data/systemen-register.json` = DE bron van waarheid (alle 53, met naam, functie,
     groep, ritme, log, bewaking, kill-switch, heartbeat). status-collect, health-check
     én SYSTEMEN.md (gegenereerd via scripts/systemen-md-genereer.js) lezen alle drie
     dit register. Nieuwe dienst zonder registratie → automatisch oranje + Telegram.
  2. /admin/systemen BEWERKBAAR: functie/naam/bewakingstijd aanpassen + aan/uit-knop.
     Wijzigingen → KV systemen:config → collector voert ze binnen 10 min door op
     register + kill-switches (end-to-end getest).
  3. ZELFHERSTEL: telegram-poll en databot-poll schrijven nu een heartbeat
     (data/heartbeat/); collector (elke 10 min) kickstart ze automatisch bij >15 min
     stilte + meldt het. (Poller hing 11-08 en 2x op 15-08 zonder alarm.)
  4. Nieuw-rood → gebundelde Telegram-melding per collector-ronde (dedupe op vorige
     status). Exit -15 (SIGTERM/kickstart) telt niet meer als rood.
- BEVINDINGEN uit de eerste echte ronde (staan op het dashboard, deels nog te fixen):
  sonny-rapport log al 29 DAGEN stil; planado-shifts + cohortrapport ~5 dagen stil;
  ab-eindrapport 7 dagen stil; gesprek-lab exit 1. Dode file scripts/telegram-inbox.txt
  (11 maart) verwijderd uit gebruik — echte inbox is ~/sonty/telegram-inbox.txt.

## 15-08 (middag): INMEET-DASHBOARD "VERLOPEN"-VERWARRING GEFIXT (geval Jaap v Egmond)
- Klacht Daimy: kaart "verlopen" bij Jaap v Egmond terwijl hij allang ingepland was.
  Oorzaak: Jaap appte "ander moment" op zijn eerste keuzelink (13:36) → systeem sloot
  dat aanbod correct als 'verlopen' en stuurde 13:48 een nieuw voorstel → gekozen →
  geboekt (29 sep Sjoerd, Gripp 6481, Planado/agenda/sheet OK). Maar het dashboard
  toonde het oude aanbod als losse kale "verlopen"-kaart naast de boeking.
- FIX (sonty-website ff78b24 + sonty-platform f36443a):
  (1) controlelijst dashboard verbergt verlopen aanbiedingen met een nieuwer voorstel
  of een bestaande boeking (afgehandeld = weg); (2) API bewaart `verlopenReden` bij
  elke verlopen-markering (PATCH-body `reden`); (3) alle 5 verloopplekken (planner 24u/
  laatste-woord/botsing, replies ander-moment/pingpong) sturen nu een reden mee;
  (4) chip toont "verlopen — <reden>" en wrapt op mobiel.
- Regressie gedraaid op echte KV-historie (49 aanbiedingen, 44 boekingen): controle-
  lijst 11→9 kaarten, Jaap's oude kaart weg, geen enkele "verlopen" meer naast een
  boeking. Laura Idzinga blijft terecht zichtbaar (wilde ander moment, geen nieuw
  voorstel gekomen — mens nodig / nakijken waarom stuur-aanbod niet volgde).
- Let op: lokale .env-KV zit op maandlimiet (dev/build geeft UpstashError); productie-KV
  werkt gewoon. Dev-test van dit dashboard kan dus alleen tegen productie.
- VERVOLG (Daimy: "je kan toch gewoon in oktober inplannen?"): oorzaak gevonden —
  werkdagenVoor keek max 15 roosterdagen vooruit (tot ~9-17 sep), dus "vanaf 5 okt"
  gaf altijd "geen enkele plek". FIX (f361159): horizon begint bij de vanaf-datum die
  de klant noemt + vakantievenster rekt mee (70 → 70+dagen-tot-vanaf). Daemon
  nl.sonty.inmeet-verzoeken herstart met nieuwe code; Laura's stuur-aanbod (vanaf
  2026-10-05, bevestigd in haar WhatsApp 15-08 14:40) opnieuw in de rij gezet.

## 15-08: TWEE PRODUCTIE-INCIDENTEN OPGELOST
- **OWA-token/planner plat**: Microsoft vernieuwde de loginpagina (formulier in gesloten
  shadow-DOM) → fill() in owaSessie kwam nooit aan → token verliep 14-08 11:17 → planner
  weigerde (vakanties onbekend, veiligheidsklep) → winkel zag "laatste ronde 54 min
  geleden". FIX (commit b057db6): selector-vrije login in planning-mail-daemon.js: wacht
  tot login.microsoftonline, dan blind keyboard.type(email)/Enter/type(wachtwoord)/Enter
  (autofocus vangt het op, werkt op oude én nieuwe pagina). Token ververst, daemons
  herstart, verweesd planning-mail.lock (dode pid) opgeruimd, ronde 12:59 klaar.
- **KV-maandlimiet vol (14-08)**: Upstash 500k/500k → site traag, offerte-/planningstool
  haperden in de winkel, leads konden tijdelijk niet opgeslagen. Teller is gereset
  (15-08 werkt alles, doorgemeten). Verbruik verlaagd: pollers (belscherm/inmeet-
  dashboard/systemen) pauzeren op onzichtbare tabs, systemen-poll 1→2 min. OPEN: V12
  bij Daimy (betaald KV-plan ~€10-20/mnd) en evt. audit grootste KV-vreters.
- Telegram-poller hing 2x (kickstart-fix gebruikt); databot-inbox al 2+ dagen stil
  (launchctl list | grep databot nog checken).

## 13-08: MAILMARKETING/KLAVIYO GESTART (doel Daimy: alles leren + bot + flows)
- Doel: extreem goed worden in mailmarketing, Klaviyo volledig inrichten, daarna wekelijks
  sturen op Klaviyo- plus conversiedata met nieuwe flows. Regel Daimy: ALTIJD Sonty-stijl
  en regels (product, levertijd, garantie) → memory feedback_mailmarketing_sonty_stijl.
- Gebouwd in `~/sonty/email-marketing/`: KENNISBANK.md (benchmarks 2026, kernflows,
  deliverability-eisen Gmail/Yahoo, Klaviyo API-mogelijkheden, lead-gen nurturing),
  SONTY-MAILSTIJLGIDS.md (alle vaste feiten: 3/5/7 garantie, 8-10 wk, 5 werkdagen, €75,
  40/60, verboden frasen), FLOW-PLAN.md (5 flows in prioriteit, waarschuwingen dubbele
  mails), flows/offerte-opvolgflow-copy.md (3 mails concept, wacht op akkoord).
- Scripts (herbruikbaar, alleen-lezen): ~/ander-project/email-marketing/scripts/klaviyo-stand.js
  en klaviyo-week-rapport.js (reporting-API per flow/campagne met omzet en spamrate).
- Klaviyo Create Flow API is GA (revision 2026-07-15): bot kan zelf flows bouwen, 100/dag.
- **Key gekregen van Daimy (13-08)**: ~/sonty/scripts/.klaviyo-private-key.txt. Daarna
  ONTDEKT: het systeem bestond al in scripts/email/ (27-28 juli, launchd-sync 06:30,
  12k profielen in segmenten, 18 templates actueel in Klaviyo, flows bewust UIT, zie
  scripts/email/FLOWS.md). Memory-index had er geen pointer naar → nu wel
  (project_sonty_email). Backfill die Daimy vroeg was dus al gedaan.
- **Opdracht Daimy 13-08**: alles mag ingericht, maar NIETS versturen; eerst controleert
  Claude elke mail, daarna checkt Daimy mail voor mail. GEDAAN: 3 adversariële reviewers
  vonden 30+ fouten (o.a. Tanya-notitie als productnaam, dode reviewlink, openingstijden
  9:00 i.p.v. 9:30, kapotte "daar"-fallback, congruentiefouten, receptiefoto als
  showroom). Alles gefixt: aanhef nu als sync-veld sonty_aanhef (16.516 profielen
  bijgewerkt), netProduct filtert notities, echte Google-reviewlink (cid 6570478327481950083),
  4 nieuwe visueel geverifieerde foto's op CDN, akkoord-stap afgevinkt, routetip in
  uitnodiging. Herkeuring: GOEDGEKEURD, alle 13 punten opgelost. Templates gesynct naar
  Klaviyo, flows UIT. Alle 18 mails als screenshot naar Daimy (13-08 ~19:00) met vragen
  V4-V7 (cijferclaims 3000+/10+jr/24u, 24-uursbelofte welkom, officiële reviewlink,
  voorraad-3-weken-claim). WACHT OP: akkoord per mail van Daimy, dan flows bouwen in
  volgorde uit scripts/email/FLOWS.md. LET OP voor de flowbouw: mails met offertekaart
  die direct na een event triggeren (RP1/G1) kunnen kaartvelden missen tot de nachtsync
  gedraaid heeft; event-properties gebruiken of verzendmoment na de sync leggen.
- **Weekbot LIVE (15-08)**: scripts/email/week-bot.js draait elke maandag 08:30 (launchd
  nl.sonty.email-weekbot): Klaviyo-cijfers per flow/campagne naast de benchmarks,
  gezondheidsalarmen (spam >0,1% / afmeldingen >0,3%), conversie uit de sheet (methode
  Daimy), voorstellen alleen ter goedkeuring. Testrun --dry succesvol (conversie W32 3,5%,
  W33 3,7%). Daarmee is de /goal-keten compleet: kennisbank -> stijlgids -> 25 templates
  (dubbel gekeurd) -> productvarianten -> fotokiezer -> weekbot. Flows AAN zetten blijft
  wachten op akkoorden Daimy (per mail + V4-V8).
- **13-08 avond: PRODUCTRELEVANTIE + FOTOKIEZER + BOUWVAK**. C1-reactivering heeft nu 4
  varianten (screens/rolluiken/binnen/basis) met productspecifieke echte reviews en visueel
  geverifieerde foto's; flow kiest via conditional split op sonty_product_kort (zie
  scripts/email/FLOWS.md). S1 "Na de bouwvak"-mail klaar (details andere terminal → V8 aan
  Daimy). Masterplan: email-marketing/MASTERPLAN.md. FOTOKIEZER live:
  /admin/mailfotos (sonty-website) — per mail fotoslots, kiezen uit 897 gecategoriseerde
  website-foto's, volledige mailpreview per flow (public/mail-previews, export via
  scripts/email/export-mailpreviews.js). Keten: keuzes in KV → haal-fotokeuzes.js →
  foto-keuzes.json → fotos-uploaden.js (zet keuze om naar JPEG op Klaviyo-CDN) →
  bouw-templates.js (slotFoto). 22 templates in Klaviyo, alles nog UIT.
- **13-08 laat: RELEVANTIE PER CATEGORIE + SONTY-VERHAAL**. C1-reactivering nu 7 varianten
  (screens/rolluiken/knikarm/pergola/markies/binnen/basis), elk met visueel geverifieerde
  productfoto en passende echte review; flow-split in scripts/email/FLOWS.md. 25 templates
  in Klaviyo. LET OP: 'uitvalscherm-balkon.webp' toont een knikarmscherm (naam liegt).
  Geen schone uitvalscherm/horren-foto's → die groepen krijgen de basisvariant. Het
  Sonty-verhaal (concept op geverifieerde feiten uit over-ons: Joey Engelen 2013, Daimy
  erbij 2024, 15 man, 150m2 showroom) staat op Telegram TER VERBETERING bij Daimy; daarna
  verwerken in verhaal-mail + welkomstmail. Uploader-quirk: /api/images-check pagineert
  niet → uploadt alles opnieuw bij verse run (duplicaten op CDN, onschuldig).
- REGEL Daimy 13-08: op deze computer niks meer met ander-project, alleen Sonty. De tijdelijke
  ~/ander-project/email-marketing-map is verwijderd; de leestools staan nu in
  ~/sonty/email-marketing/scripts/ met de Sonty-key als default.

## 13-08: BOEKEN LOOPT NU VIA MICROSOFT BOOKINGS — DE ENIGE JUISTE MANIER
- **Les van vandaag (grote fout hersteld)**: de planner maakte kale agenda-afspraken.
  Gevolg: klant kreeg GEEN bevestigingsmail (die loopt via Bookings), geen medewerker-
  koppeling (alles "geen medewerker"/Bezet in de Bookings-weergave), geen adres in het
  locatieveld. 43 afspraken met terugwerkende kracht gemigreerd naar echte Bookings-
  afspraken onder Joey/Sjoerd; klanten kregen daarbij de normale Bookings-bevestiging.
- **Structureel**: alle boekingen via `scripts/lib/inmeet-boeken.js` → Bookings-API
  (business SontyMontage1, dienst "Inmeten Sonty" fd1a8a20, staff Joey 445fbea9 /
  Sjoerd 60ebce1b, locatie=klantadres). Kale afspraak alleen nog als vangnet MET alarm.
- **Disney 7-8 sep**: 12 klanten verplaatst (alle op 13/18/20/24/25/27 aug + 14/16 sep,
  Mandy keuzelink 12 okt); DISNEY-blokken heten nu "Vakantie - Disney (Joey)" zodat de
  planner de dagen blokkeert. Pingpong-rem in aanbod-replies: afgewezen tijden stapelen,
  max 2 auto-voorstellen per klant per dag.
- **Telegram-poller**: harde 60s-noodrem (hing 22 uur na een dode request).
- **OPEN**: Connie Biermann wacht op antwoord "plaatsing vóór 26 sep?" — beleidsvraag
  aan Daimy (V1), inmeten was 13-08 12:55.

## STAND 11-08 (agenda-schoonmaakdag): ALLES SYNCHROON, DIT IS DE NIEUWE BASIS
- **Outlook ↔ Planado is nu TWEE richtingen, elke 10 minuten** (was 30 min, één richting).
  Nieuw in Outlook → Planado; nieuw in Planado → agenda-afspraak (nieuw, gat-Franken);
  tijden ÉN duren worden bijgewerkt; geannuleerde Outlook-bron → Planado-kopie weg;
  optie-blokken van niet-meer-open aanbiedingen worden elke run geveegd (Daimy: tijd
  moet direct vrijkomen). Geverifieerd 11-08: beide richtingen 100% (189 en 194 items).
- **Buffertijden**: Daimy heeft alle Bookings-buffers uit Outlook gehaald; sync heeft
  duren in Planado mee verkort. Overlappingen van 43 → 5, en die 5 zijn door Daimy
  GEACCEPTEERD (wo 19 aug winkeldag Joey + 3 inmetingen = bewust personeel; Mandy/Colijn
  8 sep = jongens regelen zelf; Edwin/Max 11 aug = voorbij). Voorgemeld in
  data/dubbelboeking-gemeld.json zodat de ochtendcontrole er niet over blijft beginnen.
- **Wachters**: ochtendcontrole 07:45 (cron-planado-outlook-check: beide richtingen +
  dubbelboekingen + optie-veger), uur-zelfcontrole (schijn-boekingen), gesprek-lab 07:30
  (beslisketen over echte gesprekken), sync elke 10 min.
- **Telegram-poortwachter** (lib/telegram-filter.js in planningTelegram): alleen vragen,
  boekingen, rapporten, leervragen en alarmen (1x/6u per soort) bereiken Daimy; rest naar
  logs/telegram-onderdrukt.log. Ochtend-/avondrapport samengevoegd: ÉÉN akkoord-getal
  (handtekeningen + chat-akkoorden, ontdubbeld, met bron) + conversieblok (sheet-methode).
- **Terminal-claim** (scripts/telegram-claim.js + memory-regel): één sessie antwoordt
  Daimy op Telegram; check/claim/release vóór je reageert.
- **Aankomstmarge**: alle klantcommunicatie over inmeten/montage meldt "kan door de route
  een uur eerder/later worden" (behalve showroom). Marge-templates bij Meta: 244680 +
  244682 PENDING; template-wachter sluit ze aan.
- **Nieuwe inmeter start 14 SEPTEMBER** (niet 1 sep); naam/rooster volgt van Daimy.
- **Nog open van Daimy**: niets. Geen montage plannen (blijft verboden).

## Ouder (08-08), nog relevant
- **ROOT CAUSE van "opties bovenop bestaande afspraken" + "Planado anders dan Outlook"**:
  de Outlook→Planado-sync keek maar 42 dagen vooruit; alles daarna stond alleen in
  Outlook en was onzichtbaar voor de planner (haalAgenda leest ALLEEN Planado).
  Venster nu 100 dagen; achterstand gesynct (12 jobs t/m 15 okt).
- **Esra Dinckan 422 OPGELOST (07-08 ochtend)**: de job die haar external_id vasthield is
  (handmatig) verwijderd; de sync van 09:20 heeft haar netjes aangemaakt — Planado serial
  453, Joey 18 sep, 150 min, adres+telefoon+Gripp 6405+meetbon-link compleet geverifieerd.
  Zelfde run meldde 3 nieuwe wezen (Sjoerd: Vitaal Zorggroep-montage 11/8, 2x Stoffering
  14/8 uit Outlook verdwenen) — al aan Daimy gemeld, beleid = nooit auto-delete.
- **Sjoerd is NIET vrij op 21 sep** (Daimy expliciet); mijn tijdelijke blokkade is
  weer verwijderd. Het probleem was de rommel hierboven, niet Sjoerds rooster.
- **Hendrik-Jan Colijn**: geboekt op zijn geaccepteerde keuze di 8 sep 13:00 (Planado
  #451, Gripp 6413, sheet Aug r299, meetbon). GEEN berichten meer naar hem sturen.
  LET OP: overlapt bewust met Mandy Princen 11:30-14:30 (Daimy's aanwijzing) — kantoor
  schuift zo nodig.
- **Hans Erik Hazelhorst**: geboekt ma 21 sep 13:55 bij Sjoerd (Gripp 6412) — 13:55 is
  vrij, alleen 9-11 was al bezet; boeking staat, niets aan doen tenzij Daimy anders zegt.
- **Vaste regel (memory: bevestiging-na-boeking)**: klant krijgt pas een bericht als de
  boeking aantoonbaar rond is; afketsen = automatisch excuus-bericht + kaart terug op
  dashboard. Monitor kickstart de verwerker bij een keuze.
- **1-moment-aanbod**: instelling aantalTijden (1/3) bestaat; templates 244121/244125
  PENDING bij Meta; template-wachter sluit ze aan en zet de instelling om zodra ACCEPTED.
- **Open**: GitHub Actions deploy kapot (handmatig: vercel build --prod + vercel deploy
  --prebuilt --prod --archive=tgz in ~/sonty-website); planning@sonty.nl-kanaal;
  Vas Verhage moet nog een offerteversie tekenen (Gripp-skip); Vas' mailadres bounced
  (vamaja@casema.nl) — adres in RP checken.

## COMBI-DAGEN GEBOUWD (07-08, akkoord Daimy 06-08)
- **scripts/lib/combi-dag.js — zoekCombiDag()**: per cluster (onderling ≤20 min) de
  VROEGSTE dag over de verlengde horizon (30 roosterdagen) waarop de hele groep achter
  elkaar past; alle aangeboden tijden op DIE ene dag (klantkeuze = tijdstip, niet dag).
  Kostenregel: duurste lid mag kosten wat hij kost (die klant moet er sowieso heen,
  dag-4-regel), elk EXTRA lid moet binnen de normale omrij-grens (30 min) ernaast passen.
  Bij lange klussen eten 3 opties per lid de dag op → terugval naar 2 of 1 tijd per lid.
- **Integratie combiPas** (cron-inmeten-planner.js): combi-dag eerst, oude losse
  mechaniek als vangnet; dashboard-kaart krijgt status 'combi-dag' + reden "combi-dag
  <datum> met <namen>" + de tijden. LIVE-pad stuurt via maakEnVerstuurAanbod.
- **Lab**: onderdelen/combi-dag.js (24 scenario's, scherpe verwachting: haalbaar ⇒ combi
  MOET er komen op de vroegste vrije dag — ving 2 echte ontwerpfouten: grens×n verwierp
  elk echt ver cluster, en 3 opties/lid maakte lange-klus-dagen onhaalbaar). Totaal lab
  572, 0x stil. keten-regressie 22 groen.
- **LAB-CACHEBUG GEFIXT**: offerte-cache (639fe48) is per lead-id op schijf; het lab
  draaide 80 scenario's op hetzelfde nep-id → 33x FOUT-STIL én nepdata in de echte cache.
  Nu: RP_OFFERTE_CACHE_PAD injecteerbaar, lab gebruikt wegwerpbestand + wist per
  scenario; nep-key 'lc-1' uit data/rp-offerte-cache.json verwijderd.
- **WERKDAG = KLANTTIJD (Daimy 07-08, doorgevoerd)**: "plan gerust zo dat ze om 9:00 bij
  de eerste klant staan en om 15:00 bij de laatste weggaan." Slotzoeker: aanrit naar de
  eerste klus valt vóór dagstart, terugrit na dageinde; alleen ritten tussen klanten
  kosten dagtijd. Rijtijd telt WEL mee in de omrij-afweging (extraRijtijdMin) — hij is
  niet gratis, hij past alleen niet in het klantvenster. Effect: meer capaciteit per dag
  en verre combi-dagen (eerste klant 09:00 in Gouda) worden veel eerder haalbaar.
- **15-10-VRAAG DAIMY (07-08) → V1 AKKOORD + DOORGEVOERD**: dashboard toonde 15 okt
  bovenaan. Oorzaak dubbel: (1) agenda echt vol t/m eind aug + Sjoerd-vakantie;
  (2) keuze sorteerde puur op minste omrijden, en de 100-dagen-sync zette verre ankers
  neer waar de planner goedkoop naast plakt (Josua 15 okt +9 vs 23 sep +13). Fix in
  kiesAanbod: BINNEN de omrij-grens wint de vroegste datum (rijtijd is scheidsrechter
  bij gelijke datum); boven de grens blijft goedkoopste-eerst (dag-4-route).
  Regressietest 23 = de echte Josua-casus. Bewijs: Marjolein 21 sep → 31 aug bovenaan,
  Matijn 15 okt → 21 sep.

## 10-08: AUTONOOM WERKEND MAKEN (opdracht Daimy "ik kan er niet op vertrouwen")
- **PLANNING-RESPONDER** (scripts/lib/planning-antwoord.js): elke klantreactie op een
  voorstel wordt geduid met Haiku (akkoord / ander-moment / vraag / klacht). Bij
  ander-moment gaan de door de klant genoemde dagen mee als voorkeurDagen naar de
  verwerker en krijgt hij binnen minuten nieuwe tijden; bij vraag/klacht krijgt hij
  meteen een ontvangstbevestiging en Daimy een concept-antwoord. Geen stilte meer.
  Getest op de echte berichten van Rick, Katuscha, Rita, Natalie.
- **OPVOLGING BIJ GEEN REACTIE**: 4 uur vóór verlopen één herinnering, na verlopen
  automatisch verse tijden (ronde 2), daarna stoppen en naar het belscherm
  (state.opvolging per rpItemId).
- **HARDE STOP**: nooit een aanbod naar iemand met een lopende afspraak (incident Eric
  van der Meer, door mijn eigen verkeerde rpItemId).
- **WA-TICKETZOEKER BREED**: Trengo vindt een nummer alleen op de opgeslagen notatie;
  zoeken op de laatste 9 cijfers gaf NUL hits → elke verzending opende een nieuw
  ticket (Katuscha). Nu +31/0031/31/0/laatste-9 geprobeerd, met terugval op gesloten
  gesprekken voor de monitor. Samengevoegde tickets (404) worden automatisch herzocht.
- **TELEGRAM-SPLITSING ECHT DICHT**: negen scripts stuurden rechtstreeks naar de
  planning-groep. Alles loopt nu via planningTelegram(); alleen de boekingsmelding
  heeft { boeking: true }. Groep = uitsluitend geboekte afspraken.
- **KETEN-ZELFCONTROLE** (scripts/cron-keten-zelfcontrole.js, launchd elk uur):
  controleert 7 invarianten die stuk voor stuk uit een echt incident komen — dubbele
  boeking, botsend aanbod, aanbod naast bestaande afspraak, klant zonder antwoord
  (>2u), dood gesprek, vergeten lead (>5 dagen), verlopen zonder vervolg. Meldt alleen
  NIEUWE afwijkingen (12u-dedup) en onderscheidt rate-limits van echte problemen.
- **KAPOTTE DAEMONS GEREPAREERD**: (1) `node` bestaat niet in het launchd-PATH →
  process.execPath (8 scripts, maandrapport/maandag-data lagen stil); (2) maandtabs
  waren hardcoded en braken elke maandwissel — 'Juli 2026 ' heeft een spatie en
  'Aug 2026' ontbrak → scripts/lib/maandtabs.js leest ze uit de sheet, met
  uitsluitlijst voor dubbeltellende tabs en retry bij Google-rate-limits;
  (3) OWA-token atomisch schrijven + terugval op een geldig token bij mislukte
  browser-login; (4) dashboard-update: eerst committen, dan pullen (stash-beschermd),
  push mag falen zonder de taak te breken.
- **EINDSTAND**: alle launchd-daemons exit 0, 32 regressietests groen, 596 lab-scenario's
  0x stil, 23 komende afspraken met 0 conflicten, zelfcontrole 1 open punt
  (Marjolein Nunnink: offerte op naam van haar man — ligt bij Jorren en Tanya, WhatsApp
  buiten 24u-venster dus bellen/mailen).

## 09-08 SLOT: DAGVULLING, RITA-LES, DAMSTEEG
- **LEGE DAGEN BLEVEN LEEG (Daimy "dagen bij die gasten vol krijgen, 100% efficiënt")**:
  ontwerpfout in de kostenformule. extraRijtijdMin = heen + terug - direct; op een
  LEGE dag is direct = 0 (magazijn→magazijn), dus telde de hele reis als "extra" en
  viel élke klant buiten de 30-min-grens. Sjoerd had 24/28/29/30 sep + 1 okt op NUL
  klussen terwijl 4 klanten wachtten. FIX: slots op een dag zonder klussen krijgen
  `dagOpener: true` en overleven het grens-filter in kiesAanbod (regressietest 31:
  dagopener blijft, dure invoeging op een volle dag valt nog steeds af). Dashboard
  toont "opent een lege dag" i.p.v. een misleidende +175m. Resultaat: Marco,
  Ashutosh, Connie en Timo hebben nu alle vier tijden.
- **scripts/dagvulling-analyse.js** (read-only): per dag de vrije minuten + per
  wachtende klant zijn goedkoopste plek. Gebruik dit bij de vraag "waarom staat die
  dag leeg".
- **RITA VAN SCHAGEN — BOEKING DOOR MIJN EIGEN FIX**: zij schreef "Ja doe dat maar.
  Maar ik had het wel op prijs gesteld dat je dit eerlijk zou zeggen. Sorry maar van
  3 naar 6 weken vind ik wel veel." Mijn Marjolein-uitbreiding (acceptatie mét extra
  tekst) las dat als akkoord → geboekt + opgewekte bevestiging. GEFIXT: onvrede-regex
  (vind ik wel veel / niet blij / sorry maar / op prijs gesteld / dat is wel lang …)
  blokkeert automatisch boeken; haar echte bericht is regressietest.
  Ook: bot beloofde standaard "2-3 weken" (stond hard in system-prompt) terwijl het 6
  werd → leest nu data/actuele-wachttijd.json (planner schrijft de vroegste plek weg).
  En een aanbod ≥3 weken vooruit opent niet meer met "goed nieuws".
- **OFFERTE-KEUZE MAG NU MEERDERE NUMMERS ZIJN**: data/offerte-keuze-override.json
  accepteert een lijst. Damsteeg → beide offertes in Gripp (6447 €5.151 + 6448 €8.422,
  één klant 99739). LET OP: eerste poging maakte een dubbele company/offerte aan
  (99738 + 6446) — opgeruimd via company.delete/offer.delete. Waarschuwing blijft:
  "Product niet gevonden: ROMA buitenjaloezie".

## 09-08 AVOND: SUNNY-TOEWIJZING + DASHBOARD-TIJDEN
- **SUNNY WEES ALLES AAN JORREN TOE (Daimy)**: de regel "gesloten door een mens =
  klaar, bot pakt het daarna zelf op" (Daimy 03-08) stond er wél, maar checkte
  `t.closed_by` — dat veld zit ALLEEN in de detail-call `/tickets/{id}`, niet in de
  lijst waarmee de daemons werken. Daardoor was de regel altijd uit. GEFIXT: nu
  `closed_by || closed_at` (closed_at zit wél in de lijst) én de eis dat het
  klantbericht ná het sluiten kwam. Zelfde regel toegevoegd aan de MAIL-kant
  (email-daemon.js: `nieuweVraagNaSluiting` blokkeert de collega-toewijzing).
- **DASHBOARD-TIJDEN (Daimy "dezelfde tijden bij meerdere mensen, en 2 of 4 keuzes")**:
  (1) zorgVoorDrieOpties haalt slots opnieuw op → hetzelfde moment kwam terug als een
  ANDER object, filteren op identiteit werkte niet → nu `ontdubbelSlots()` op
  inmeter+aankomsttijd (regressietest 30);
  (2) kaarten toonden dezelfde tijd aan verschillende klanten → getoonde opties worden
  nu binnen de ronde gereserveerd in `agenda`, net als verstuurde aanbiedingen.
  Geverifieerd op het live dashboard: 0 dubbel, 0 botsend.
- **GEVOLG (eerlijk, geen bug)**: 3 klanten hebben nu <3 opties (Ashutosh 2, Ana 2,
  Rita 1 — Ter Aar). De agenda zit tot half oktober vol; vroeger vulden die kaarten
  zich met momenten die óók aan een andere klant werden getoond. Aanvulling gebouwd:
  getrapte horizon (30 → 60 roosterdagen) en als laatste redmiddel plekken bóven de
  omrij-grens (winkel ziet de +minuten op de knop). Blijft er dan te weinig over, dan
  is dat een capaciteitssignaal.

## 09-08 LATER: EBRU-GAT, AVONDRIT NA 15:00
- **EBRU KILINC bijna kwijtgeraakt**: zij appte 07-08 14:32 "laten we ma 12 okt 12:40
  doen" en bleef 2 dagen liggen. Oorzaak: ik had die tijd HANDMATIG voorgesteld,
  buiten een aanbod-record om → de reply-monitor kon haar ja nergens aan koppelen.
  De aan-zet-watchdog zág het wel, maar zijn meldingen stonden uit. Nu geboekt
  (ma 12 okt 12:40 Joey, Gripp 6442) + op de eerder-willen-lijst.
  **LES: een tijd voorstellen doe je NOOIT los; altijd via een aanbod-record
  (POST /api/inmeet-aanbod of stuur-aanbod met slots), anders landt het antwoord nergens.**
- **WATCHDOG-MELDBELEID**: van "uit" naar één gerichte melding per dag (ochtendronde,
  naar de DATA-BOT): alleen akkoord/klacht of wie >24u wacht, max 12 regels. Volledige
  lijst blijft in het logboek. Uitzetten kan met TELEGRAM=0.
- **AVONDRIT NA 15:00 (Daimy)**: "dicht bij de laatste opdracht of op de weg naar
  huis mag ná 15:00 bij Sjoerd en Joey." In slotzoeker: extra slot aansluitend op de
  LAATSTE klus van de dag, alleen als de omweg ≤ AVOND_MAX_EXTRA_MIN (15 min) is
  t.o.v. de rit die hij toch al naar huis maakt, aankomst ≤ 90 min na dienst, en er
  die dag al een klus staat. Slot krijgt `naDienst: true`. Lab-onderdeel avondrit.js
  (24 scenario's): lege dag → nooit, verre klant → nooit, om-de-hoek → 14:40
  aansluitend. Totaal lab nu 596, 0 stil.
- **Winkel-keuzelijst nogmaals bevestigd** (Daimy herhaalde het): ALLE dashboard-kaarten
  3 tijden; 5 keuzes uitsluitend via het vak "Klant net akkoord in de winkel?".
  Mijn twee testkaarten (Marco, Ashutosh) met DELETE /api/inmeet-dashboard opgeruimd;
  geverifieerd: 10 kaarten × 3 tijden, geen enkele met meer.

## 09-08: WINKEL-KEUZELIJST, GRIP-INVULLEN OPGELOST, TELEGRAM GESPLITST
- **WINKEL-KEUZELIJST (Daimy "gewoon alle beschikbare tijden zien, zeg 5")**:
  `kiesWinkelOpties(slots, 5)` in slotzoeker.js — 5 gevarieerde opties, chronologisch,
  met labels `vroegste` en `minste rijtijd` (kunnen samenvallen). Omrij-grens filtert
  hier bewust NIET (winkel moet haast kunnen bedienen). Gebruikt door de reken-route
  (verzoek-daemon, kijkt 30 dagen vooruit als er <5 gaten zijn). **ALLEEN DAAR**:
  correctie Daimy 09-08 — de gewone dashboard-kaarten blijven op 3 tijden zoals ze
  waren; 5 keuzes gelden uitsluitend voor een klant die de winkel zelf invult bij
  "Klant net akkoord in de winkel?". UI: gelabelde knoppen groen. Live geverifieerd
  (Marco Klok 5 opties via het reken-vak, overige kaarten 3; iPhone 12, 0 overflow).
  Regressietests 28-29.
- **"5 op grip invullen" UITGEZOCHT**: 3 waren allang klaar (Gripp-offerte bestond),
  alleen de RP-status bleef staan. Twee oorzaken: (1) cron las `?limit=200` van een
  backlog met 18.752 items → Q Tacken (25-07) en Wilte Zijlstra (21-07) werden nooit
  gezien; (2) wie al een marker had werd overgeslagen, dus toen Rene ná zijn
  Gripp-run opnieuw geboekt werd (status terug op grip invullen) bleef hij hangen.
  FIX: zuinig ophalen (1 pagina van 1000 + gerichte volglijst op id in
  data/gripp-invullen-volglijst.json — Daimy: "niet de hele RP-database, dat geeft
  gezeur"), ZELFHERSTEL (marker met grippOfferId → status alsnog Afgerond) en een
  melding voor iedereen die hier >7 dagen staat.
- **KANTOOR-KEUZE OFFERTEVERSIE**: `data/offerte-keuze-override.json`
  ({rpItemId of lcId: offertenummer}) laat het kantoor bepalen welke versie geldt als
  er meerdere ongetekende zijn. Gebruikt in inmeten-planner-lees.js (cache wordt dan
  overgeslagen) en cron-gripp-invullen.js. Toegepast op Vas Verhage → 202610307,
  Gripp-offerte 8984, status Afgerond. Nog open op grip invullen: alleen B Damsteeg.
- **TELEGRAM GESPLITST (Daimy)**: planning-GROEP (-5131873789 "Planning bot groep") =
  ALLEEN boekingen; al het andere → data-bot (@Sontydatabot). In
  lib/telegram-planning.js: `planningTelegram(tekst, { boeking: true })` gaat naar de
  groep, zonder optie naar de data-bot (veilige default: geen ruis in de groep).
  Boekingsmelding heeft nu één vaste opmaak (naam, plaats, dag+tijd, inmeter, duur,
  adres, herkomst, samenvatting). Volledige lijst van 18 boekingen ter controle in de
  groep gezet.

## STORING 09-08: UPSTASH-LIMIET BEREIKT (database plat, opgelost in code)
- **Symptoom**: alles wat KV gebruikt gaf HTTP 500 (aanbod-API, dashboard-API,
  mutatie-API); inmeet-verwerker exit 1; planner meldde "aanbod-register onbereikbaar,
  kan dubbel aanbod niet uitsluiten" (= de veiligheidsstop DEED zijn werk).
- **Oorzaak**: Upstash-limiet 500.000 requests/maand OP. Grootverbruiker was onze eigen
  code: `GET /api/inmeet-mutatie?status=open` deed 1 smembers + N gets over ALLE
  mutaties ooit, en de verzoek-daemon pollde dat elke 10 s (~440k calls/dag).
- **GEFIXT (code, gedeployd)**:
  1. `inmeetmutatie:open` set + `inmeetaanbod:actief` set — poll leest alleen lopende
     items (in rust 1 request). Zelfherstellend: wat niet meer open/actief is valt eruit.
     Eenmalige vulling via `?migreer=1` op beide routes (staat klaar in een wachter).
  2. Verzoek-daemon pollt adaptief: 10 s zolang er werk is (5-min-venster), anders 60 s.
  3. Reply-monitor: 1 request (`?actief=1`) i.p.v. 4 volledige lijsten per ronde.
- **OPGELOST 09-08 ±10:30, GRATIS**: geen upgrade nodig — nieuwe gratis Upstash-database
  `upstash-kv-almond-lens` (store_NWFTKRcUuOXaoFNL). Daimy maakte hem aan; de
  project-koppeling liep vast op een naamconflict (oude env-vars). Opgelost door:
  (1) oude resource `upstash-kv-yellow-paddle` loskoppelen via
  `vercel integration-resource disconnect`, (2) nieuwe koppelen via de Vercel-API:
  `POST /v1/storage/stores/<storeId>/connections?teamId=<team>` body `{projectId}`
  (CLI heeft GEEN connect-commando — dit is de werkende route), (3) `vercel env pull`,
  build + deploy, migraties gedraaid, daemons gekickstart.
  LET OP: KV was leeg na de wissel → instelling `aantalTijden: 1` handmatig
  teruggezet (stond alleen in KV). Geverifieerd: dashboard 18 boekingen + 11 leads,
  API's 200, verwerker schoon.
- **Stand keten tijdens storing (lokaal geverifieerd)**: 18 boekingen, 0 dubbelboekingen,
  0 wachtende klantberichten. Manon (17 sep 09:00 Sjoerd) en Franken (31 aug 14:00)
  zijn 07-08 's avonds nog automatisch geboekt na klantreactie.
- **Ook gefixt**: databot-poller crashte op elke ECONNRESET (long-poll-hikje) → alleen
  echte fouten sluiten nu af; aan-zet-watchdog stond volledig UIT (plist .disabled na
  Daimy's "dit bericht hoef ik niet meer") → weer actief maar STIL (log only, Telegram
  alleen met TELEGRAM=1).

## EIND VAN DE MIDDAG 07-08 (Daimy "wat gaat hier weer verkeerd, maak alles kloppend")
- **DUBBEL-SLOT-BUG GEFIXT**: verwerkReken (snelle reken-route in de verzoek-daemon)
  riep voegAanbiedingenToe NIET aan → Manon, Franken en Marco kregen alle drie
  17 sep 09:00 Sjoerd als "beste". Manon (eerst verstuurd) houdt hem; fix zit erin,
  Franken opnieuw gerekend → ma 31 aug 14:00 Joey, keuzelink met exact dat slot.
- **EBRU**: mijn fout — wensdag-tijden gestuurd zonder agenda-check; systeem wees ze
  TERECHT af (20 aug dagvullend blok, 3 sep vol, 7 sep-gaatje was al van Christian).
  Eerlijk antwoord gestuurd (kan niet op haar dagen; wel 12 okt of alsnog 31 aug
  14:25) + op eerder-willen-lijst (wilEerderDan 12 okt). LES: nooit slots gokken,
  altijd eerst reken-route.
- **CHRISTIAN**: verzending klopte (WA+mail, alles in één ge-merged ticket 972485801;
  oude 971319449 bestaat niet meer door de bundelaar — bedoeld gedrag). "Mens nodig"-
  note 13:49 was RUIS: bot-daemon zag samengevoegde oude berichten voor nieuw aan
  (merge-echo, bekende open ruisbron). Zijn 7 sep 14:40 klopt echt met de agenda.
- **Mail-threading verbreed**: zoekMailTicket pakt nu ook GESLOTEN tickets (bericht
  heropent het oude gesprek); bewijs live: Manons keuzelink-mail zit in haar
  bestaande akkoord-ticket 971139731.
- **Christian+Manon keuzelinks verstuurd 13:32/13:33** (WA+mail, ticket-ids in state).

## MIDDAG-ACTIES NA AUDIT (07-08, antwoorden Daimy V1-V6)
- **RENE GEBOEKT ✓ (07-08 ±15:30)**: ma 10 aug 15:00 Joey (Gripp 6421, sheet Aug r309,
  meetbon, bevestiging automatisch). Route: 16:00-boeking stil teruggedraaid → wegvaller-
  VRAAG (Daimy checkte 15:00 bij Joey) → "Is goed" → keten boekte. INCIDENT onderweg:
  eerste keuze-poging faalde op netwerkfout en gemeld-dedup blokkeerde herkansing →
  monitor-fix: keuze-poging herhaalt elke run zolang aanbod open, melding blijft eenmalig.
  Rooster-vraag Daimy (wo 12 aug-gaten): wo/vr blijven vrije dagen, zijn eigen regel 04-08
  bevestigd; sync-cadence uitgelegd (Outlook→Planado 30 min, planner 30 min, kliks vers).
- **MARJOLEIN NUNNINK GEBOEKT**: haar "Dat is prima!" van 11:32 was door de strenge
  regex blijven liggen (audit-gat). Keuze vastgezet → keten boekte ma 31 aug 09:45
  Joey (Gripp 6422). Haar 2e-offerte-vraag beantwoord (klantlink) + note/taak Jorren.
  **leesKeuze-fix**: acceptatie mét extra tekst boekt nu (eerste-zinnen-check);
  afspraak-twijfel (ander moment/andere dag/liever/kan niet) blijft ALTIJD naar mens.
  Haar echte bericht is regressietestgeval.
- **MANON VAN DER KNAAP + CHRISTIAN TAMMINGA** (akkoorden, inmeten=mijn domein per
  Daimy V3; montage-planning NIET): beantwoord als Nanny, RP → Inmeten inplannen,
  Christians dakkapel-wens als planning-opmerking in de lead, reken-verzoeken gedraaid.
- **Tickets**: 4 geboekte klanten dicht (alleen als wij het laatst spraken), 7 lege
  bug-tickets dicht (cron-keten-tickets-sluiten.js herbruikbaar).
- **Verzoek-daemon**: poort-/mens-nodig-fouten zijn nu DEFINITIEF (geen retry-loop —
  incident: wilEerder-verzoek herhaalde elke minuut).
- Daimy V4 (nieuwe inmeter): volgt later. V5 (planning@-kanaal, Vas): doet Daimy. V6
  (prijsplan): uitleg gegeven, wacht op go.

## SAMENHANG-AUDIT ULTRACODE (07-08 middag, opdracht Daimy "alles moet samenwerken")
- **16 agents, alle hoog/middel-bevindingen adversarieel geverifieerd in echte
  tickets+code.** Kerndiagnose: bot-werk functioneert; overdracht aan een MENS was
  het einde van elke bewaking (note/@tag telde als afgehandeld). 31 klantberichten
  lagen open, waaronder 2 akkoorden (Manon Prins 971139731, Christian Tamminga
  971319449), Henk van Weers (8 wkn screens, 971508158) en RENE BLAUW die om 11:08
  zijn ORDER ON HOLD zette. Acuut geëscaleerd naar Daimy (bellen).
- **GEFIXT vandaag**: (1) scripts/cron-aan-zet-watchdog.js + launchd
  nl.sonty.aan-zet-watchdog (elk uur): laatste ECHTE bericht van klant + >4u stil =
  wij aan zet → lijst naar planning-bot, AKKOORD/KLACHT bovenaan, notes tellen NIET,
  team Mens nodig telt WEL mee; melding bij lijstwijziging + vaste rondes 9:00/16:00;
  message-cache op updated_at (state data/aan-zet-state.json). (2) email-daemon
  VvE-note pas na geverifieerde assignment (geval Deborah Loocks: note zei toegewezen,
  user was null).
- **FIXLIJST OPEN (V1 bij Daimy)**: belofte-bewaking ("collega komt terug" max 1x →
  escalatie met deadline); tickets sluiten na boeking + ~45 ruis/lege tickets opruimen
  (o.a. 7 lege van de geldigUren-bug); /admin/aan-zet-pagina; reply-monitor 429-zuinig.
  Overige geverifieerde punten: wachtdagen-teller herstart 06-08 (5-dagen-belofte
  meet te kort), acceptatie-regex eist exact match (vrije-tekst-akkoord blijft open),
  bevestiging alleen via WA (mail-klant krijgt niets), status 'verwerkt' dubbelzinnig
  op dashboard, telegram-poll 46 herstarts + databot-poll crashloop.
- **Systeemadvies (architect)**: GEEN nieuwe inbox naast Trengo; de watchdog is de
  bewaker van de uitkomst. Elke overdracht = startpunt van bewaking, niet eindpunt.
- Volledige data: /tmp taskfile w5ejsmk10 + journal wf_d2ce9d49-06f.

## PLANNING-BOT @PlanningSontyBOT LIVE (07-08, opdracht Daimy)
- Alle planning-/inmeetmeldingen via de nieuwe bot: lib scripts/lib/telegram-planning.js
  (leest data/telegram-planning.json PER CALL — tokenwissel zonder herstart; config
  ontbreekt = terugval hoofdbot, nooit stilte). 10 scripts omgezet: planner,
  outlook-sync, herinneringen, aanbod-replies, inmeet-mutatie, aanbod-versturen,
  planado-webhook, gripp-invullen, sandbox, trengo-bundel.
- Lezer: scripts/read-planning-telegram.js → planning-inbox.txt (offset-state in
  data/planning-tg-offset.json). REGEL: derde lezer bij elk Daimy-bericht (memory).
- Testbericht verstuurd en config gecommit (chat-id 1700128390, zelfde Joris-chat).

## TRENGO-VERSNIPPERING (07-08, Daimy "zelfde contact moet onder 1 ticket")
- **Meting 30 dgn** (data/trengo-dubbel-30dgn.json): 716 tickets, 41 klanten met
  meerdere tickets (Colijn 4x mail, Carlo 3x WA, Rene Blauw 2x WA). Open-only was
  maar 1 groep — het probleem zit in de opeenvolging open/closed.
- **BRON-FIX GEDAAN**: stuurMail maakte ALTIJD een nieuw ticket per keuzelink-mail
  (en sloot het direct). Nu: eerst zoekMailTicket (actief e-mailticket zelfde adres
  op ons kanaal) → daarin antwoorden; hergebruikt ticket wordt NIET gesloten.
  WA deed dit al sinds 06-08 (ticket_id-param).
- **BUNDELAAR LIVE (V2 akkoord Daimy in chat)**: scripts/trengo-bundel.js + launchd
  nl.sonty.trengo-bundel (elke 15 min): actieve tickets (OPEN/ASSIGNED) van zelfde
  contact + zelfde kanaaltype → merge naar keten-ticket (state.aanbodTickets
  waTicket/mailTicket, LET OP: objecten, geen kale ids) of anders oudste actieve.
  CLOSED blijft staan. Eerste ronde: 3 merges (Eric, Rene, Nagra). --droog = testen.
- **RENE BLAUW (V1 = a+b, akkoord Daimy)**: oud aanbod op verlopen gezet, vers
  stuur-aanbod-verzoek b424b83f5fafb456 in de rij (nieuwe regels). Rene staat op de
  ANNULERINGSLIJST (scripts/lib/eerder-willen.js + data/eerder-willen.json):
  muteerBoeking meldt bij elke vrijgekomen plek wie eerder wil (winkel klikt, klant
  krijgt niets automatisch); registreerBoeking haalt geboekte klanten van de lijst.
  Lab-pad EERDER_WILLEN_PAD geïnjecteerd; regressietest 26.
- **Franken**: adres Houtrijk 10, 2151DV Nieuw-Vennep (BAG-bevestigd; offerte had
  verkeerde straatnaam) staat in RP; tijden volgen bij de volgende planner-ronde
  (Nieuw-Vennep ligt dicht bij Uithoorn/Rene — mogelijke combi).
- **DAIMY KLIKTE 4 KEUZELINKS (07-08 10:41-10:44)**: Ebru + Marjolein (31 aug!),
  Josua + Jan (17 sep, exact de combi-tijden — slots-doorgave werkt live). Aanbiedingen
  gaan nu met 1 tijd (1-moment-template 244121/244125 ACTIEF).
- **INCIDENT RENE (07-08 ±12u, "dit mag echt niet gebeuren")**: klant vroeg "kan het
  eerder dan 17 sep", vers aanbod gaf WEER 17 sep (09:00 i.p.v. 09:55) en werd toch
  verstuurd. Oorzaken: (1) datumfix verstopt eerdere-maar-duurdere plekken (buiten
  omrij-grens) volledig; (2) geen poort die checkt of een eerder-verzoek ook echt
  eerder oplevert. GEFIXT: kiesAanbod optie negeerGrens (puur vroegste, grens telt
  niet — "klant kwijtraken kost meer dan omrijden"); mutatie-API + verwerker kennen
  wilEerder/eerderDan met harde poort (niet eerder = niets versturen + melding);
  dashboard-nood-kaart toont de absoluut vroegste plek als die ≥7 dagen eerder is.
  Regressietest 27. V1 bij Daimy open: persoonlijk bericht naar Rene of winkel belt.

## ADRES-VANGNET UIT OFFERTE-PDF (07-08, opdracht Daimy "zorg dat je dit zelf kunt")
- **Geval Franken/Kenny**: winkel-/telefoonleads hebben soms geen adresvelden in de
  lead-tekst en item.fields.address is leeg. Het adres staat NERGENS in de RP-API
  (quotation-JSON, lead-endpoints: leeg/400) — alléén in het gerenderde offerte-PDF:
  `document.reuzenpanda.nl/renderer/v1/{pid}/quotations/{documentId}/artifact.pdf`
  (publiek, geen auth). **scripts/lib/offerte-adres.js**: PDF → pdftotext → adresregel
  (Sonty's eigen blok overgeslagen; dubbele komma's en spatie-postcodes getolereerd).
- leesOfferte geeft nu ook documentId; leesLeadCompleet vult het adres automatisch
  als de lead er geen heeft. **UITZONDERING**: staat er een adres-CORRECTIE in de
  lead (Franken: "moet zijn Houtrijk 10, NIET Haarlemmermeer 10" — het offerte-adres
  is daar dus FOUT), dan blijft de kaart op geen-adres met een duidelijke reden;
  mens beslist. Regressietests 24/25 op de echte teksten. Kenny (Texellaan 22,
  Gouda) kan hierdoor mee in het Gouda-combi-cluster.

## INMEET-DASHBOARD RONDE (07-08, opdracht Daimy "visueel en functies nog kut")
- **Herbouwd** (app/admin/inmeet-dashboard/page.tsx, live geverifieerd op iPhone 12 +
  desktop, 0 overflow, 0 console-fouten): status-chips i.p.v. zwevende tekst, flex-
  headers, knoppen full-width op mobiel, leesbare datums ("wo 17 sep"), telefoon
  (tel:-link) + adres op elke kaart, combi-dag-kaarten (paars) met uitleg en gedeelde
  tijden, keuzelink kopieerbaar (kaart + controlelijst), stale-waarschuwing als de
  laatste planner-ronde >45 min oud is, meldingkleur-bug gefixt, komende inmetingen
  met bellen + meetbon-links (grippNr/telefoon nu in dash.boekingen).
- **stuur-aanbod kan dashboard-tijden meekrijgen** (route + verwerker): combi-dag-klik
  stuurt exact de voorgestelde tijden (na verse botsingscontrole), anders zou de
  verwerker opnieuw rekenen en de combi-dag weggooien. Losse kaarten blijven vers rekenen.
- Deploy handmatig (GH Actions nog kapot): vercel build --prod + vercel deploy
  --prebuilt --prod --archive=tgz.


## INMEET-KETEN: EERSTE VOLLEDIG AUTOMATISCHE BOEKING GELUKT (6 aug 23:15)
- **Vas Verhage end-to-end zonder handwerk**: WA-template met 3 tijden → klant koos "Optie 1"
  → monitor las uit + WA-bevestiging (mét inmeternaam) → boeking: Planado #447 als
  "Inmeet afspraak" bij Joey (di 15 sep 11:25), Outlook, sheet Juli r1593. Gripp-nr volgt via cron.
- **Eric Van der Meer**: geboekt Joey di 18 aug 11:05 (Planado #432). Jorren belt hem vr 10:00.
- **Open aanbiedingen** (klant moet kiezen): Julia, Carlo (nieuw WA-ticket 972328089!),
  Irene (Daimy greep zelf in om 21:12), Sofie. **Hendrik-Jan Colijn**: alle tijden pasten niet,
  gevraagd welke dagen wél (ticket 972337979) — bij antwoord nieuwe tijden voorstellen.
- **Vas' mailadres bounced** (vamaja@casema.nl geweigerd door casema) — adres in RP checken.

## GEVONDEN + GEFIXT IN DE AUDIT (6 aug avond, ultracode-verificatie 16 agents)
1. **Mails gingen NOOIT weg**: ReferenceError `geldigUren` in stuurMail, stil opgeslikt.
   Gefixt; alle 6 open klanten hebben de keuzelink-mail alsnog (mailTickets in state).
2. **Keuze-PATCH bewaarde gekozenIndex niet** (server) → verwerker crashte op Eric en de hele
   wachtrij lag stil. Route gefixt + verwerker-guard (kapot record = melden, niet crashen).
3. **"onze inmeter undefined"** in klantbericht: publieke GET stripte de naam; met meet-code
   komt nu het volledige record. Guard: naam alleen tonen als hij bestaat (regressietest 21).
4. **AI praatte over het aanbod heen** (Irene): guard geldt nu voor ÁLLE berichten op een nummer
   met lopend aanbod (<48u), óók @sonny-feedbackpad, óók e-mail (email-live.js), match op
   telefoon én e-mail. TDZ-dode-fallback opgeruimd (helper lopendInmeetAanbod).
5. **Monitor wiste concurrent state-updates** (schreef stale aanbodTickets terug) → nu alleen
   eigen opruiming toepassen (merge i.p.v. overschrijven).
6. **Trengo term-search is onbetrouwbaar per nummer** (Hendrik-Jan/Vas: 0 hits) → wa_sessions
   ticket_id uit de respons wordt nu vastgelegd; template gaat bovendien in het BESTAANDE
   gesprek (ticket_id-param) als dat er is — geen onvindbare naamloze tickets meer.
7. **Planado "Opdracht"**: API negeert platte template_uuid/type_uuid stil; het moet als
   object (template:{uuid}, job_type:{code}) en KAN ALLEEN BIJ AANMAKEN. Planner + outlook-sync
   gefixt; 13 toekomstige jobs herbouwd (scripts/planado-herbouw-publiek.js, rescue in
   data/herbouw-rescue.jsonl). PATCH kan het type nooit wijzigen.
8. **Daimy Boot testboeking 45aeb252**: Planado-job bleek (handmatig) verwijderd → record op
   geannuleerd gezet.

## INFRA
- **GitHub Actions deploy is KAPOT** (runs hangen ~20 min, nieuwe pushes triggeren niets —
  vermoedelijk minuten op). Deploy nu handmatig: `vercel build --prod` +
  `vercel deploy --prebuilt --prod --archive=tgz` in ~/sonty-website. Structurele fix open.
- **Dashboard verduidelijkt + live** (visueel geverifieerd): 4 groepen op "wie is aan zet",
  tellers bovenaan, tijdlijn per klant (verstuurd/gekozen/geboekt), controlelijst met afvinken.
- Na ELKE keten-codewijziging: `scripts/herstart-keten-daemons.sh` (nu ook email-daemon).


## PLAN PRIJSOVERTUIGING KLAAR (5 aug, opdracht Daimy "mentaal voorbereiden vóór de prijsvraag")
- **`docs/PLAN-prijsovertuiging-2026.md`** — volledige uitwerking, NIETS staat live.
- Basis: ultracode-workflow (15 agents: 4.163 gesprekken, 89 prijsbezwaren, 281 offertes)
  + eigen onderzoek neuromarketing/sales (SPIN, Challenger, Cialdini, peer-reviewed papers).
- Vier principes akkoord Daimy: (1) nooit onszelf duur noemen, Challenger-toon;
  (2) alle investering vóór het bedrag (70% van bezwaren = eerste inbound bericht);
  (3) showroom vóór korting; (4) vergelijken nooit zelf uitnodigen — les-vorm.
- Teksten A t/m J definitief in het plan; invoervolgorde in 6 blokken (blok 1 = onware
  claims weg, blok 2 = meereken-blok netto laten rekenen); 7 beslispunten voor Daimy
  (o.a. permanente 15%, openingstijden showroom die op 5 plekken verschillen, levertijd
  3 versies); meetplan met 5 nieuwe meters naast het weekrapport.
- Volgende stap: Daimy's go per blok, dan bouwen.

## WEBSITEPRIJZEN LIEPEN ACHTER OP DE PRIJSVERHOGING (5 aug, vraag Daimy)
- **De verhoging van 3 aug zat wél in alle prijsmotoren maar niet in de publieke productpagina's.**
  Die rekenen niet, ze lazen `data/sunmaster-prices.json` rechtstreeks, en daar zit de oude
  opslag (1,10) in verwerkt. De meetlat mat alleen motoren, dus niets sloeg alarm.
  **Les: bij een prijswijziging ook de presentatielaag meten, niet alleen wat rekent.**
- Gefixt en live geverifieerd op sonty-website.vercel.app:
  1. **9,1% te laag op alle vanaf-prijzen en prijstabellen.** SunEye 269×250 stond op €2.662,
     de offerte rekent €2.904. De pagina bevraagt nu de prijsmotor in plaats van de JSON.
     Gemeten: 370 van 370 voorbeeldprijzen gelijk aan de motor.
  2. **Screen square / zipscreen / rolluik S-37 weken verder af**, tot €341 op één scherm,
     want daar leest de motor een volledige prijstabel en toonde de pagina een samenvatting.
     Zipscreen 300×300 stond zelfs €341 te hóóg.
  3. **Montage uitvalscherm €195 → €220** (v4 factureert 220; de configurator rekende ook 25 te
     weinig). Daimy bevestigd 5 aug: 220 is juist.
  4. **Markiezen stonden €480 te laag**: site vanaf €660, v4 factureert €1.074. Kwamen uit een
     andere bron dan het Markiezen Nederland-boek én gingen door de Sunmaster-opslag terwijl
     ze de markiezenfactor (1,31) volgen. Nu 30 maten als eindprijs uit dezelfde berekening
     als v4, grenen als vanaf-materiaal. `markies` is uitgezonderd van `metActueleMarkup`.
  5. **`interpolateByArea` matchte op oppervlakte in plaats van breedte × hoogte.** Maten met
     gelijke oppervlakte kregen elkaars prijs: 38 botsingen over 12 producten, ergste SunEye XL
     700×250 (€6.640) tegen 500×350 (€4.563). Exacte maat-match staat nu vooraan.
- **Geborgd:** `scripts/tests/website-toont-offerteprijs.js` controleert dat de keuzegids uit de
  motor leest, dat de montageprijzen gelijk zijn aan v4 en dat de markiezenprijzen kloppen.
  Draait mee als stap 4 in `kruiscontrole-dagelijks.js` (07:45). Getest tegen de oude situatie:
  faalt daarop, dus geen lege test.
- **Nieuw bestand:** `sonty-website/lib/prijspeil.ts` — de enige plek waar de prijspeil-correctie
  gedefinieerd staat; motor en presentatielaag gebruiken hem allebei.

## KETENONDERZOEK PLANADO + MEETBON (4 aug, opdracht Daimy "hele keten moet kloppen")
- **BESLUIT Daimy: Planado BLIJFT** (app + monteur-tracking). Eis: alles moet goed samenwerken vóórdat het live gaat.
- **Gewenste keten**: RP-status "inmeten inplannen" → planningsbot plant in → inmeter krijgt alle Gripp-info + meetbonnen van gekozen producten (+ product toevoegen) → op locatie eindofferte in Gripp maken én laten ondertekenen → aanbetalingsfactuur automatisch → betaald → meetbonnen naar besteller → alles door naar de monteurs.
- **Stand (read-only geverifieerd)**: meetbon-app werkt maar NUL productie (log 68x "0 complete meetbonnen"); Planado 82 jobs, allemaal inmeten, 0 ooit afgemeld, **sync staat in geen plist dus Planado loopt 7 aug leeg**; 1 van 82 jobs heeft een meetbon-link; monteur krijgt alleen agenda-afspraak met naam/adres/tijd.
- **Blokkers**: (1) geen gedeelde sleutel — afspraak draagt RP-nummer 20267876, meetbon staat op Gripp 1008; (2) "advies/weet nog niet" is geldig eindantwoord op beslissende velden, bon geldt dan tóch als compleet; (3) meetbon-data bereikt monteur nooit (Planado-veld "Meetgegevens (van inmeet)" wordt door geen code gevuld); (4) validatie alleen client-side, PUT accepteert lege bon; (5) geen gereedmelding.
- **GEFIXT + GEPUSHT**: aanbetalingsfactuur werd gezocht op `%Aanbetaling%(<nr>)%` en pakte blind rows[0]; die searchname bevat zowel offerte- als factuurnummer. Scan echte historie: **248 botsingskandidaten, 210x factuur van een ándere klant, 3x ander betaaloordeel** — doorzetter kon bestellen op andermans betaling. Nu: eerste haakjesgroep = offertenummer, creditfacturen uitgesloten, betaalde treffer boven eerste. `lib/meetbon/server.ts`, build groen.
- **Harde beperkingen**: Planado-rapportvelden alleen via browser (`/v2/custom_fields` bestaat niet) en worden bij aanmaak gekopieerd + losgekoppeld → sjabloon eerst goed, dán jobs aanmaken. `offer.update` bestaat niet: wijzigen = delete+create, wist offertenummer én historie. RP heeft geen webhook → polling 10-15 min (`?limit=200`, clientside filteren). Meetbon werkt niet offline (dirty-vlag wordt gewist vóór versturen).
- **Wel bewezen mogelijk**: RP uitlezen 0,6s/call; Bookings boeken via `scripts/bookings-api.js` boek(); `offer.create` met `signingenabled:true` draait al in productie; Gripp-viewer heeft echt krabbelformulier; eigen ondertekenflow live sinds 8 juli; betaling staat mediaan binnen 0,5 dag in Gripp.
- **OPEN V2 bij Daimy**: welke 2 inmeters starten, en vullen zij nog iets in de Planado-app zelf in of is de webbon de enige waarheid (nu vragen bestaande jobs om maten die nergens heen gaan).

## PLANADO OVERSTAP-KLAAR + E2E-KETEN GELOPEN (5 aug middag)
- **E2E-TEST GESLAAGD**: RP testlead → aanbod (3 tijden, mail via aanvragen@) → Daimy koos → Planado-opdracht 83 (Joey, 24 sept, type Inmeting) → RP 'grip invullen'→'Afgerond' → Gripp klant 99688 + offerte 6392 → meetbon 6392 voorgevuld (3 producten). 6 bugs gevonden+gefixt onderweg (o.a. klantkeuze-overschrijving → keuze is nu heilig in aanbod-API; mapper-accessoirebug; assignee {worker:{uuid}}; type_uuid Inmeting).
- **AANBOD-SYSTEEM LIVE**: /api/inmeet-aanbod + keuzepagina /inmeten/<token> (24u-klok, keuze onoverschrijfbaar); verzending WhatsApp (vrij bericht of template 243999 'inmeetafspraak_kiezen', wacht op Meta) + mail via aanvragen@ (scripts/lib/aanbod-versturen.js). Verwerker: cron-inmeten-planner.js --verwerk-aanbod (nog handmatig; launchd pas na goedkeuring Daimy).
- **CLUSTEREN**: kiesAanbod rangschikt altijd op marginale rijtijd; open aanbiedingen = ankers+bezet; middag-variant bij ruime gaten; ronde 5-min-tijden (rondAf5, naar boven); horizon 56d/24 werkdagen. Vertrek/eind per inmeter: Joey Molenbrink 36 Den Haag → winkel Frijdastraat 8F; Sjoerd Amsteloord 14 Woerden beide kanten (data/inmeters-rooster.json).
- **OUTLOOK→PLANADO-SYNC LIVE** (nl.sonty.outlook-planado-sync, elke 30 min): alle afspraken Joey+Sjoerd 6 wkn vooruit, juiste type/persoon/duur/adres + TELEFOON uit het Outlook-opmerkingenveld als contact. Dedup op ol-<sha1> én starttijd+inmeter (numeriek!). Verdwenen = melding, nooit auto-delete. Eerste vulling: 160 nieuw, 0 fouten. Reparatie bestaand: 133 nummers gevuld (match op tijd+inmeter — alleen-tijd gaf verkeerde nummers!), 12 echte inmeet-klanten zonder nummer in opmerkingen.
- **SHIFTS + VAKANTIES** (planado-shifts-rooster.js, launchd nl.sonty.planado-shifts ma 07:45): rooster 09-15 per werkdag, vakanties uit Outlook = niet-werkend. GEVONDEN: Sjoerd 3 wkn vakantie 24 aug-11 sept (+14/21 aug) — inmeten draait dan op alleen Joey 3 dgn/wk; nieuwe inmeter 1 sept precies op tijd.
- tests/keten-regressie.js: 16 groen. Volgende blok: eindofferte-knop (offerprojectline.update, prijsrem), aanbetaling, montagebon.
- **GRIPP-VERRIJKING PLANADO (5 aug avond)**: `planado-gripp-verrijken.js` — sleutel-ladder adres (pc+huisnr) → telefoon (laatste 9, LIKE) → NAAM-vangnet (achternaam, alleen bij 1 ondubbelzinnige kandidaat; Daimy: "alles moet bij iedereen ingevuld staan"). In elke inmeet-opdracht: Gripp-nr + productregels in omschrijving ÉN detailvelden **"In te meten" (field_type input)** + **"Meetbon" (field_type link, tikbaar)** — LET OP: PATCH custom_fields VERVANGT de hele array, altijd beide meesturen (helper veldenVoor). Zelfde velden in post-create van de sync. Types: POST én PATCH negeren type_uuid stil — type alleen via browser te zetten.
- **AUDIT 5 aug**: 100/101 gekoppelde hard bevestigd (adres of telefoon), enige twijfel #71 Jeanette de Jong (kaart zonder adres, door Daimy bevestigd; kantoor moet adres+echt nummer aanvullen). 38 niet-gekoppeld: oorzaak = verrijking draaide VÓÓR de telefoonreparatie, dus tel-vangnet had nooit data; herkoppelronde + naam-vangnet lopen (log /tmp/verrijk-backfill.log). Richard de Mos, Elio, "dhr+mevr de Ha", 4x JOEY WINKEL blijven terecht leeg. Planado-zoekfunctie vindt gesyncte klanten NIET (zoekt op klantveld, naam staat alleen in omschrijving) — serial meegeven aan Daimy.
- **GETEKENDE OFFERTE IS LEIDEND (5 aug avond, geval Wilco Vendrig #74)**: klant kan meerdere RP-offertedocumenten hebben; ACCEPTED wint. Meerdere docs zonder ACCEPTED = AMBIGU → planner én gripp-invullen stoppen + melding ("klant moet er zelf één tekenen"). `inmeten-planner-lees.js` is nu de ENIGE bron (leesOfferte met status/ambigu; planner-eigen kopie verwijderd). Specs per product: maat + kleur (Frame/Pantser/Doek) + BEDIENING. Wilco's geval: SENT €11.4k en ACCEPTED €27.5k met identieke timestamp — "nieuwste wint" was een gok.
- **ABSOLUTE-KORTING-BUG gripp-invullen**: groupDiscount type ABSOLUTE (vast bedrag) werd stil weggegooid — Gripp-offerte dan te hoog (Wilco: 33.666 i.p.v. 27.500). Gefixt (kortingsregel product 103, bedrag/1.21). **Gripp 6228 handmatig bijgewerkt** naar de getekende versie: productcorrecties via offerprojectline.update (76→319 ROMA, 145→150 Suneye XL) + kortingsregel −5096.08 → exact €27.500,00. Snapshot in data/snapshot-offer-6228-*.json. offer.update accepteert GEEN offerlines-array (regels = losse offerprojectline-entiteiten).
- **PLANADO INTERN ENDPOINT ONTDEKT (5 aug avond)**: web-app praat met sonty.planadoapp.com/jobs (cookie-login daimy@sonty.nl, GEEN csrf nodig). Intern POST /jobs ZET type_uuid + template_uuid wél (publiek negeert beide, ook bij PATCH; bewerk-modal heeft geen typeveld → type kan ALLEEN bij aanmaken). Sjabloon "Inmeet afspraak" = 1f11c802-65cd-6aa0-9d06-7e73cee772e4. Intern DELETE /jobs/<uuid> werkt. Body-eisen: scheduled_at ISO, scheduled_duration seconden (getal), assignees [{uuid,type:'user',access:'edit'}]. `planado-type-herbouw.js`: herbouwt verkeerd-getypte jobs (create nieuw MET type → velden overzetten → verifiëren → oude delete; external_id verhuist mee, volgnummer verandert). Playwright headless voor de cookie-sessie.
- **In te meten-veld**: max 200 tekens (Planado-limiet, kortVeld met "+N meer"); --ververs bouwt bestaande velden opnieuw op met kleur+bediening. RP-kruischeck (`planado-rp-kruischeck.js`): vergelijkt veld met getekende RP-offerte, patcht bij afwijking + waarschuwing in omschrijving.
- **EINDSTAND 5 aug ±23:30 (alles gemeld aan Daimy)**: 164/164 herbouwd met juist type (volgnummers veranderd: testopdracht #83→#398, morgen=#395–#407); sync-controle na herbouw 168/168, 0 dubbel, 0 wees; kruischeck: 34 klopten, 58 velden op RP-versie gezet (38 = alleen naamverschil), **9 echte prijsafwijkingen Gripp vs getekend** (o.a. Alexandra Kassing morgen 11.250 vs 9.250; Max Beije #375 hangt vermoedelijk aan een OUDE Gripp-offerte 4372) en **5 klanten met inmeetafspraak die nog geen enkele offerteversie tekenden** (de Gunst #347, Haakman #290, Burke #287, Morgun #270, van Luxemburg #262) → kantoor. Lijsten in /tmp/prijsafwijkingen.json + /tmp/kruischeck.log.
- **LET OP herbouw-gevolgen**: rescue-data in data/herbouw-rescue.jsonl; aanbod-register/meetbon verwijzen op Gripp-nr (ongewijzigd), maar alles wat oude Planado-uuid's of serials bewaarde is verouderd.

## INSTELLINGEN + HERINNERINGEN + SHOWROOM-GAT (6 aug middag)
- **/admin/inmeet-instellingen** (LIVE): herinneringsmomenten (standaard 7+1 dagen vooraf), keuzelink-geldigheid, contact-deadline, max omrijden — winkel stelt zelf in, crons lezen elke run via /api/inmeet-instellingen (KV, defaults in route).
- Herinneringen-cron: loopt alle momenten af, dedup per job+moment, week-tekst vs dag-tekst. Dry-run bewezen op echte afspraken.
- **SHOWROOM-DUBBELBOEKINGSGAT (Daimy)**: MS Bookings staat los van Sonty Montage; Joey kon showroom + inmeting tegelijk krijgen. haalAgenda telt nu Bookings-afspraken van inmeters mee als bezet (staff-naam-mapping, winkeladres als anker); Bookings onleesbaar = waarschuwing maar geen stop. Andersom: definitieve inmeting stuurt Joey een agenda-uitnodiging zodat Bookings hem bezet ziet; optie-vensters gedekt door de keuze-hercontrole (zelfde haalAgenda).
- Planning-afzender = Nanny (memory feedback_planning_afzender); planning@-Trengo-kanaal maakt Daimy later aan, id dan in data/planning-kanaal.txt.
- Boekingsketen E2E met Daimy zelf bewezen: keuzelink, keuze, Planado #420 + Outlook + RP + sheet juni-r357 (telefoon-match op zijn testrij) + boekingsrecord + bevestiging. WA-template 243999 nog PENDING bij Meta; beleid = template eerst, vrij bericht vangnet.

## REPLIES + SAMENLOOP + MELDINGEN-AUDIT (6 aug slot)
- **Reply-monitor** nl.sonty.aanbod-replies (10 min): elk klantantwoord op een keuzelink letterlijk naar Daimy (ticket-ids per aanbod in state.aanbodTickets + telefoon-vangnet, dedup per bericht). Geen AI ertussen.
- **Samenloop-fix**: voegAanbiedingenToe() — ook losse stuur-aanbod/boek-routes tellen openstaande aanbiedingen als bezet; 1 aanbod per klant; daemon strikt sequentieel. Massaal keuzelinks sturen is nu veilig.
- **Showroom-beleid Daimy**: losse Bookings-afspraak blokkeert NIET (winkel vangt op); alleen JOEY WINKEL-dienstblokken blokkeren. Bookings-blok uit haalAgenda verwijderd.
- Meldingen-audit: wees-dedup (eenmalig, mét naam), wachtlijst opgepakt-detectie (notitie na klantbericht) + eenmaal-per-bericht, webflow niet naar Mens nodig, Koeleman-dedup-fix (opExtId over ALLE jobs — verplaatsing uit het verleden), planhorizon 15 roosterdagen. 3 verouderde JOEY WINKEL-wezen verwijderd; Dimashi Sigera (15/9, uit Outlook verdwenen) wacht op kantoor.
- Quinten de Bondt #431: RP-lead heet Megan de Bondt en staat nog op Offerte verstuurd → keten kan pas vullen na status-doorzet (kantoor gevraagd); telefoons al op de job.
- **gripp-invullen van 1x/dag (18:00) naar 7x/dag (08:30-20:00)** — anders duurde keuze→Gripp-offerte tot een dag.

## INSTELLINGEN-HUB ECHT AANGESLOTEN + ROADMAP (6 aug eind)
- **3 dode knoppen gerepareerd** (inventaris-agent ving het): maxOmrijdenMin + contactDeadlineDagen (via kiesAanbod-opts), aanbodGeldigUren (aanbod-API verlooptOp + Outlook-optie-vervaltijd + klanttekst "De tijden staan X uur vast" beweegt mee). lib/instellingen.js = centrale lezer (60s cache, defaults). Nieuw veld bevestigingSturen (standaard UIT — Outlook-uitnodiging is de bevestiging; schakelaar op de instellingen-pagina).
- Admin-menu: 3 planning-tegels bovenaan (dashboard / afspraak wijzigen / instellingen). Keuzepagina /inmeten: cookiebanner onderdrukt → 0 uitgaande links (live gemeten) zolang het vercel-domein is.
- **ROADMAP instellingen-hub** (inventaris 06-08, 40 parameters, zie agent-rapport): grootste kanshebbers = AI-KS reactietijden/werktijden (config.js, HERSTART nodig), showroom-openingstijden (staan op 3 plekken los!), werkgebied-grens offerte-controle (125km/60km+7500), opvolgings-dagen, combi-grens 20 min, aantal keuzetijden, inmeetduur-normen. Regel: elke nieuwe parameter hoort in de hub, niet hardcoded.

## BALIE-TEST DAIMY + 3 FIXES (6 aug middag)
- Race gefixt: reken-kaarten via extraLead-sleutel (TTL 45 min) + server-side merge in GET — de 30-min-ronde overschreef Daimy's kaart.
- **VAKANTIE-GAT gedicht**: laadVakanties() (Outlook, subject vakantie/verlof/vrij, 70 dgn) blokkeert dagen in werkdagenVoor; vakanties onbekend = NIET plannen (harde stop). Bewezen: Sjoerd-slot 24/8 (vakantie!) verdween bij hertest.
- **Meet-code was fout**: API verwacht 2288 (MEETBON_CODE), planner stuurde sonty2288 → alle registercalls waren STILLE 401-nullen. Code gefixt + 401 is nu harde stop. Dashboardcode voor winkel = 2288.
- TG-beleid: schaduwronde meldt alleen nieuwe leads + 🚨; state.gemeld per lead.
- Capaciteitssignaal: eerste vrije plek nieuwe klant = 31 aug (agenda vol + Sjoerd-vakantie); nieuwe inmeter 1 sep precies op tijd.
- TODO lab: vakantie-dimensie in planner-aanbod-onderdeel.

## PLAN-DASHBOARD (6 aug nacht, vraag Daimy "dashboard voor inmeten, later ook montage")
- **/admin/inmeet-dashboard** (LIVE, zelfde code): wachtende leads met de beste 3 tijden al berekend, één klik = ECHT boeken (klant aan de lijn) of keuzelink sturen; komende inmetingen eronder; link naar verzetten/annuleren. Data uit KV (/api/inmeet-dashboard), gepubliceerd door elke planner-ronde.
- **Verzoek-flow**: dashboard-klik → /api/inmeet-mutatie (types boek/stuur-aanbod erbij) → verwerker (launchd nl.sonty.inmeet-verwerker, elke 5 min) → verwerkDashboardVerzoek: verse agenda + botsingscontrole → verwerkLead + Outlook + boekingsrecord + bevestiging. stuur-aanbod rekent verse slots (wachtDagen 999: winkel vroeg erom, dus altijd tijden).
- **nl.sonty.inmeet-dashboard** (elke 30 min): schaduw-planner ververst het overzicht; Telegram alleen bij veranderde inhoud (hash-dedup in state.laatsteRapportHash).
- **Adres-cache** data/planner-adres-cache.json (uuid → adres): run van 20 min → ~2 min na eerste vulling. Veilig: verzetten = nieuwe job = nieuw uuid.
- Let op semantiek schaduw: de BOT stuurt nog niks uit zichzelf; dashboard-kliks zijn mens-geïnitieerd en worden WEL echt uitgevoerd (dat is precies de winkel-wens).
- Montage later: zelfde scherm, extra bron + montagetijden-normen (lib/meetbon/montagetijd.ts ligt er al).

## MUTATIE-MOTOR + LEVENSCYCLUS (6 aug avond, ultracode)
- **Ultracode-verkenning** (5 agents): 54 levenscyclus-gebeurtenissen in 3 bakken (nu bouwen / melding+mens / later) + rollback-analyse. Kern-gat gedicht: er werd GEEN sleutel bewaard bij boeking. Nu: data/inmeet-boekingen.json (registreerBoeking in verwerker: planadoJobUuid, outlookEventId, grippNr, sheet{tab,rij,kolomInkoop}, token).
- **lib/inmeet-mutatie.js — DE motor**: muteerBoeking(rpItemId,'verzet'|'annuleer'): Outlook weg VÓÓR Planado (anders hersynct de wees), job DELETE (publieke API kan dat: 200), sheet-cellen leeg (V3 Daimy), verzet → RP terug naar Inmeten inplannen + verse 5-dagen-klok → planner stuurt vanzelf nieuw aanbod; annuleer → RP blijft (V2, kantoor beslist) + nette afscheidsapp. Deels-mislukt is altijd zichtbaar (stappenlijst + Telegram). Paden injecteerbaar (INMEET_BOEKINGEN_PAD / INMEET_PLANNER_STATE_PAD) voor het lab.
- **Mutatie-wachtrij**: sonty-website /api/inmeet-mutatie (POST/GET/PATCH, x-meet-code) — één ingang voor winkel/AI/klant-reply; verwerker consumeert hem in --verwerk-aanbod. **Winkel-scherm /admin/inmeet-mutatie** (zelfde code als belscherm): klant + verzetten/annuleren + reden, motor doet de rest. LIVE op de site.
- **V1 Daimy**: intent-vraag (afzeggen of verzetten?) hoort bij de AANLEIDING — de AI-KS-tool (reply-detectie, één responder via bestaande agent per workflow-advies) is het volgende blok; system-prompt.js:86 (escalatie-gebod inmeten) pas aanpassen bij livegang.
- Verrijker draait nu vast (nl.sonty.gripp-verrijken 07:50+13:50) — geval Ron Duyvestein: kantoor-afspraak zonder Gripp-offerte wordt vanzelf nagekoppeld zodra gripp-invullen klaar is.
- Lab: mutatie-motor-onderdeel (30 scenario's: volgorde, V2/V3-beleid, deels-falen zichtbaar, idempotent). Totaal 548, 0 stil.

## WINKEL ↔ BOT HARMONIE (6 aug, vraag Daimy "wat als de winkel zelf plant?")
- **lib/outlook-opties.js**: elk verstuurd aanbod zet 3 "OPTIE bot <inmeter> — klant (vervalt …)"-afspraken (ShowAs Tentative, GEEN deelnemers → sync slaat ze over) in Sonty Montage; kantoor plant eromheen. Keuze klant → gekozen optie wordt echte Outlook-afspraak (mét inmeter-deelnemer, bestaand formaat — daarvoor was een bot-boeking ONZICHTBAAR in Outlook!), rest verwijderd. Verlopen → opties weg. state.opties[token]=eventIds in planner-state.
- **Spoedje wint altijd**: plant kantoor tóch door een optie heen → hercontrole bij klantkeuze vangt het → aanbod op verwerkt, opties weg, lead automatisch terug in de wachtrij → volgende planner-run stuurt VERS aanbod (wachttijd telt door). Telegram-melding, geen handwerk.
- OWA-token kan events aanmaken/verwijderen (getest 201/204).

## SHEET + COMBI + ADRES-HERSTEL (6 aug middag)
- **Sheet-koppeling (Daimy)**: bij boeking → inkoop "1" + inmeetdatum + inmeter in de offerte-sheet. Sleutel-volgorde NA correctie Daimy: **RP-offertenummer (kolom "RP offerte") → telefoon → Gripp-nummer** — Gripp bestaat op dat keten-moment meestal nog niet! leesOfferte geeft nu ook alle RP-nummers (quotationNumber + titelnummer); rpNummers reizen mee in het aanbod-register. Kolommen per tab uit headerrij (rij 3); range A1:AH6000 (juli heeft 2000+ rijen!); zoekvenster 6 maandtabs; niet gevonden = nieuwe rij + melding. Bewijs: 10/11 echte leads read-only gevonden (Marjolein Nunnink staat er echt niet in → vangnetroute). LES in scenario-lab-skill: dimensie "keten-moment" (wat bestaat al?) is verplicht.
- **Combi-pas**: wachtende leads ≤20 min van elkaar delen omrij-kosten (grens × groepsgrootte), oudste eerst, slots worden ankers voor de rest. Lab-invariant: haalbare combi ⇒ combi-aanbod.
- **ADRES-INCIDENT herbouw**: interne create negeert address stil → 164 herbouwde jobs zonder navigatie-adres; eindcheck lette er niet op (eigen fout, gemeld aan Daimy). Herstel uit data/herbouw-rescue.jsonl draait; herbouw-script zet adres nu via publieke PATCH na create + checkt het. Publieke PATCH address werkt gewoon.
- RP-status na boeking (→ Gripp invullen) zat al in verwerkLead.

## PLANNINGSBOT DOORGELICHT + DRUKTEBESTENDIG (6 aug, vraag Daimy "wat als er 20 man staan?")
- **3 gaten gevonden en gedicht in cron-inmeten-planner**: (1) leads kregen binnen één run hetzelfde gat aangeboden → nu reserveert elke aanbieding het slot voor de rest van de run én tellen open/gekozen aanbiedingen als bezet (register onbereikbaar = VEILIGHEIDSSTOP); (2) verwerker boekte zonder hercontrole → nu verse-agenda-overlapcheck vóór boeken, conflict = melding + niet boeken (Planado weigert overlap zelf niet!); (3) LIVE boekte direct zonder klantkeuze (oude testroute) → LIVE verstuurt nu het keuze-aanbod (mail+WA via maakEnVerstuurAanbod), boeken kan alleen via --verwerk-aanbod na klantkeuze.
- **5-DAGEN-BELOFTE (Daimy)**: klant krijgt te horen "planning neemt binnen 5 dagen contact op". Deadline in code = dag 4 (MAX_WACHT_DAGEN in slotzoeker, kalenderdagen; planner telt vanaf state.gezien, oudste lead eerst). Tijd niet nodig = direct aanbod; wachten is alleen voor dure routes; dag 4 = beste beschikbare toch sturen; agenda vol op dag 4 = 🚨-escalatie.
- **Agenda-ophaler was STUK na de herbouw**: 10 pagina's cursor miste de (nieuwste) opdrachten én 429's zonder wachttijd lieten 162/167 afspraken stil wegvallen → 40 pagina's, retry met backoff, dekkinsgcontrole (<80% adres = weiger te plannen) en lege-agenda-stop. Schaduwrun draait ±20 min door de rate-limits (167 details à ~8s).
- Lab-uitbreiding: planner-drukte (8/20/40 leads × rustig/halfvol/vol × dichtbij/ver): geen dubbel aanbod, nooit stilte, dichtbij nooit onbediend. Stub-reistijd (deterministisch, geen TomTom) vóór alle onderdelen geladen. Totaal 490 scenario's, 0 stil.

## SCENARIO-LAB (6 aug, opdracht Daimy "structuur voor 500 scenario's, altijd gebruiken")
- **scenario-lab/**: matrix.js (dimensies → alle combinaties), runner.js (echte code, nepdata, vier bakken: OK / terecht-geblokkeerd / fout-zichtbaar / FOUT-STIL), onderdelen/ (offerte-keuze, koppel-ladder, planner-aanbod), run.js (exitcode 1 bij ook maar 1x stil). Skill: ~/.claude/skills/scenario-lab. Eerste run: 472 scenario's → 53x stil fout gevonden → 2 echte fixes: (1) naam-vangnet verwerpt nu kaarten met TEGENSPREKEND adres + exacte-naam-voorrang bij naamgenoten; (2) verre-klant-regel: max 5 werkdagen wachten op een buur (MAX_WACHT_WERKDAGEN in slotzoeker, planner geeft wachtWerkdagen door uit state.wachtend). Eindstand: 472/472, 0x stil.

## VEILIGHEIDSPOORTEN + PLANNER GEBOUWD (4-5 aug, opdracht Daimy "niks mag fout gaan")
- **Inmeters**: Sjoerd + Joey starten (V2 beantwoord); 3e inmeter per 1 SEPT (naam onbekend). Roosters in `data/inmeters-rooster.json` (Joey ma/di/do 09-15, wo vrij + vr TIJDELIJK vrij; Sjoerd ma-do 09-15) — LEIDEND boven agenda-patronen.
- **Planner-kern LIVE in repo**: `scripts/lib/reistijd.js` (TomTom, key stond al in scripts/.tomtom-api-key.txt, x1,22 deur-tot-deur uit 26 echte ritten, cache per postcodepaar+uur, 429-retry), `scripts/lib/inmeetduur.js` (17,3+4,9/product uit 43 echte metingen; maat-toeslag 3/4/6m; zelflerend via herijk()), `scripts/lib/slotzoeker.js` (marginale rijtijd; bezetteBlokken() voegt OVERLAPPENDE afspraken samen), `scripts/cron-inmeten-planner.js` (RP-poller, schaduw default, --live vereist --alleen=<naam>), `scripts/inmeten-sandbox.js` (tegen ECHTE Outlook-agenda, per inmeter, alle 254 afspraken bezetten tijd, alleen Sjoerd/Joey plannen).
- **LET OP agenda**: oude planning zette reistijd IN de blokken → geen berekende meerprijs zolang agenda vuil is (agendaOnbetrouwbaar=true, +20 min buffer); kostenfilter gaat vanzelf aan voor eigen geplande afspraken. Werkelijke uitkomst testlead: 0 plekken in 6 weken = capaciteitsprobleem (samen 42 u/wk, 47 inmetingen/wk = 54 min/stuk incl. rijden = 100% bezet; +24 u/wk vanaf 1 sept).
- **Meetbon verbeterd (alles LIVE)**: opent MET producten uit offerte (lib/meetbon/offerte-map.ts, product.searchname → 13 typen; 2-woorden-labellijst voor specs-parsing), inklapbaar per product met "nog N"-teller, "Klant bestelde"-blok + automatische maat-afwijkingsmelding (>10mm), FotoTekenen.tsx (tekenen op situatiefoto), montagetijd door SYSTEEM geschat (lib/meetbon/montagetijd.ts uit montagetijden-v1) ipv inmeter-invul, montagevoorbereiding-velden (parkeren/aanvoer/toegang/letop), lege-bon-zelfherstel bij Gripp-storing.
- **VEILIGHEIDSPOORTEN (5 aug)**: (1) server-side validatie `lib/meetbon/validatie.ts` — PUT status=compleet met ontbrekende velden = 422, getest op prod + tegen 3 echte bonnen (0 vals-positief); (2) advies-poort in cron-meetbon-doorzetten.js — "weet niet/advies" in bon = NIET automatisch bestellen, 1x Telegram; (3) `tests/keten-regressie.js` 11 tests (overlap-merge, roosters, maat-toeslag, maatstaffel-parser, advies-regex) — BIJ ELKE PLANNERWIJZIGING DRAAIEN.
- **Gripp bewezen via probe**: offer.update + offerprojectline.update/.delete BESTAAN (entity heet offerprojectline) → eindofferte = bestaande offerte BIJWERKEN met behoud nummer (eis Daimy), snapshot vooraf. Daimy: Gripp online ondertekenen kan; geen pin/contant. Aanbetalingsfacturen kunnen via Gripp verzonden worden (Daimy 4-8).
- **NOG NIET BEWEZEN**: OWA-bestelmail nooit live verstuurd; advies-poort nog geen echte run; boeken (--live) bewust uit tot Daimy schaduwvoorstellen goedkeurt. Testlead "Daimy TEST GRIP" staat op Inmeten inplannen (3 producten: Zip Design 1500, SunEye XL 4500, SunControl 8000 = 55 min).
- **Volgende blok**: eindofferte-knop (meetbon → Gripp offerprojectline.update, prijsrem: >drempel of onbekend product = kantoor), daarna hele keten 1x schaduw kop-tot-staart met testlead. Ontwerp: docs/keten-ontwerp.md.


## A/B-EINDRAPPORT INGEPLAND: 8 AUGUSTUS 09:30 (afspraak Daimy 3 aug)
- Daimy wil op 8 augustus het EINDrapport van de A/B-test offerte-WhatsApp via Telegram, om dan de keuze te maken.
- Gebouwd: `scripts/ab-test-eindrapport.js` (volledige looptijd i.p.v. 24u, z-toets per variant, betrouwbaarheidsmarges, concreet advies wel/geen winnaar). Verzendingen jonger dan 3 dagen tellen niet mee (reactievenster nog open).
- Ingepland via launchd `nl.sonty.ab-eindrapport` (eenmalig 8 aug 09:30). **NA VERZENDING OPRUIMEN**: `launchctl bootout gui/501/nl.sonty.ab-eindrapport` (anders draait hij volgend jaar opnieuw).
- Stand 3 aug (alle 400, incl. verse): totaal 28,5%; inmeten 38,6% (n=83), garantie/check 27,4%, kortweg 22,9%. Alleen rijpe verzendingen (n=269): inmeten 35,3%, check 31,5%, garantie 28,8%, kortweg 25,0%. Nog geen significante winnaar (z inmeten = 2,28, drempel 2,5 bij 4 varianten).


## AKKOORD-MAIL + TOTAALREGEL-FIX (31 juli, laatste blok)
- Akkoord-bevestigingsmail gebouwd: na online ondertekenen krijgt de klant direct "Je akkoord is binnen, we gaan voor je aan de slag" via aanvragen@ (template akkoordMail, toggle automation melding-na-akkoord, best-effort in sign-route). End-to-end getest: S26-1005 ondertekend → Trengo-ticket 970646763 naar joey@sonty.nl. NB: Daimy's eerdere akkoord (S26-1004, 13:42) was vóór deze mail bestond, daarom kreeg hij toen niks.
- Totaalregel brak op mobiel (bedrag wrapte onder het label): kort label + nowrap + schaalbare fontgrootte. Live gecheckt.

## OFFERTEPAGINA MOBIEL AANGESCHERPT (31 juli laat)
- Daimy vond mobiel nog niet fijn. Gemeten: 12 schermen lang, totaal op 47%, ondertekenen op 64%. Fixes live: sticky onderbalk (totaal + Onderteken online, IntersectionObserver verbergt hem bij het tekenblok; WhatsAppWidget BAR_SELECTOR uitgebreid met .offerte-sticky-cta), ondertekenen direct na de offerte, hero compacter met "Bekijk je offerte"-anker, productregels met foto+naam+prijs op één kopregel en uitleg full-width eronder.

## OFFERTEPAGINA IN BROCHURE-STIJL + V4-VERRIJKING INGEBOUWD (31 juli avond)
- Offertepagina (/offerte/<token>) volgt nu de brochure: donkere cover-hero met stats en categoriebalk, offerte-kaart met productfoto per regel, zo werkt het (HIER STA JE NU), online ondertekenen, zekerheden, echte reviews, FAQ, showroom, donkere slotfooter. Mobiel gecheckt (iPhone 12, geen h-scroll).
- **V4-logica nu STANDAARD ingebouwd** (lib/offerte-tool/verrijking.ts, eis Daimy): goedgekeurde Waarom-blokken (uit beschrijving.ts), productinfo (kast/profiel/cassette/motor), garantie 3/5/7 per product, montage-specificatie (eigen monteurs/klein materiaal/afstellen/opruimen), accessoire-uitleg, én "Liever een ander model of andere bediening?" met echte engineprijzen. Op pagina (uitklapbaar) en in de PDF.
- **Gedachtestreepjes overal uit klantteksten** (eis Daimy, geldt voortaan voor al het klantmateriaal; memory bijgewerkt).
- Daimy heeft S26-1004 zelf online ondertekend (13:42) — de klantflow werkt bij hem.

## BROCHURE-OFFERTE-PDF LIVE (31 juli avond, react-pdf)
- Daimy wees de RP "compleet"-PDF aan als voorbeeld (12 pag. brochure). Nagebouwd en verbeterd met react-pdf, server-side op /api/offerte/[token]/pdf: donkere cover met klantnaam/offertenummer, "zo werkt het" (stap 3 = online ondertekenen, HIER STA JE NU), nette offertetabel (regels/korting/totalen/KvK/BTW), pagina met persoonlijke offerte-link, assortiment buiten+binnen, voor wie, over ons, ECHTE Google-reviews (uit het RP-voorbeeldmateriaal), FAQ, showroom, slotpagina. Eigen foto's uit public/images (geconverteerd naar JPG).
- **Lessen**: (1) react-pdf + Figtree/Satoshi = accent-bug (fontkit zet elk accent 1 glyph naar rechts, "één"→"eéń") → Inter gebruiken; (2) react-pdf kan geen WebP → sips-conversie; (3) dynamisch fs-pad naar public/ laat de Next-tracer heel public/ bundelen (339MB, deploy faalt op 250MB-limiet) → assets in lib/offerte-pdf/assets (functie nu 16MB).
- Download-knop op de offertepagina wijst nu naar deze route (jsPDF-versie vervangen). Getest lokaal + op productie (S26-1004, 12 pag., 5MB, ±5s).

## KLANTFLOW COMPLEET + OFFERTEPAGINA UITGEBREID (31 juli eind van de middag)
- Feedback Daimy: flow moet 100% kloppen (eerst bevestiging zonder prijs, later offerte per mail+WA, dan herinneringen) en de offertepagina miste download/doorsturen.
- **Gebouwd en live**: (1) bevestigingsmail "Bedankt voor je aanvraag" (zonder prijzen) direct na configurator-aanvraag, automation-toggle `aanvraag-bevestiging`; (2) verstuur-eigen stuurt na de mail ook de WhatsApp-offerte (zelfde goedgekeurde template als V4, 235187 offerte_met_link, kanaal 1359857) met de eigen link — in testmodus bewust overgeslagen (verzonnen 06-nummers); (3) offertepagina: Download PDF (client-side generator, logo-glitch gefixt: WebP→PNG via canvas), doorsturen via WhatsApp/mail/link kopiëren, offertedatum, garantie 3/5/7, KvK 70927618 + BTW NL858524468B01 in de footer.
- **Getest op productie**: aanvraag-submit → bevestiging in daimyboot@gmail.com (`bevestiging: true`); offertepagina alle knoppen zichtbaar; PDF echt gedownload en visueel gecheckt (10 pag., cover met logo, KvK/BTW).
- **Nog te testen door Daimy**: WhatsApp-template end-to-end (testmodus uit + eigen echte 06 op een testlead). Cosmetisch open: kortingregel krijgt eigen productpagina in de PDF; logo op cover is oranje-op-oranje.

## MAIL-KOPPELING EIGEN WEBSITE / CUTOVER-FUNDAMENT LIVE (31 juli middag)
- Opdracht Daimy: alle mailstromen alvast aan de nieuwe website koppelen zodat de RP-cutover een kwestie van omschakelen is.
- **Gebouwd en live**: verzendcentrum (/admin/verzendcentrum) heeft nu naast de RP-lijst een "Eigen offertes"-sectie (offerte-tool-dossiers uit leads-KV) met preview/verstuur: mail via aanvragen@sonty.nl met de EIGEN offerte-link (sonty.nl/offerte/<token>, online ondertekenen bestaat al). Herinneringen-cron (dag 3/6) handelt eigen entries af (stopt op ondertekend/afgewezen/verlopen via de lead). Bron-schakelaar "Reuzenpanda | Eigen website" in settings = de cutover-knop. Zelfde testmodus (mails naar joey@/daimy@) en dubbel-verstuur-beveiliging (409).
- **Testdossiers voor Daimy/Joey (31 jul)**: S26-1004 (Test Daimy, daimyboot@gmail.com) en S26-1005 (Test Joey, joey@sonty.nl) — elk 3 rolluiken + SunEye, €6.396,17, gemaild via verzendcentrum (testmodus even uit/aan). Herinneringen AAN gezet (dag 3/6, raakt door testmodus alleen test-klanten). Nog niet ondertekend.
- **End-to-end RP-loos getest (óók ondertekenen)**: S26-1003 via eigen-modus offerte-tool → verzendcentrum-mail → klantpagina → online ondertekend → status akkoord, cron-status ACCEPTED. Testroute voor Daimy: offerte-tool knop "+ Nieuwe offerte in eigen systeem" → "Offerte opslaan + Sonty-klantlink" → verzendcentrum Eigen offertes → mail (testmodus) → link ondertekenen.
- **Getest op productie**: test-dossier S26-1003 (Test Mailkoppeling) → mail verstuurd via Trengo (ticket 970608521) naar joey@/daimy@, eigen link in mail, geen RP-verwijzing; klantpagina 200; 409 bij tweede keer; admin-UI visueel gecheckt.
- **BELANGRIJK gevonden+gefixt**: de TRENGO_TOKEN op Vercel was verlopen (401) — het HELE verzendcentrum (ook RP-pad) kon dus niet meer mailen. Werkend token uit ~/sonty/scripts/.trengo-api-token.txt (AI-KS) op Vercel gezet + redeploy. Bij 401 op mail: token vergelijken met dat bestand.
- **Dubbel-mail-waarschuwing**: Klaviyo-automation "offerte-mail-bij-delen" moet UIT als je via het verzendcentrum mailt (verzendcentrum onderdrukt zelf de status-mail al bij versturen).
- **Blijft op RP tot de offerte-flow-cutover**: winkelmail-queue (RP-doclink) en de V4-WhatsApp-flow. Die gaan mee zodra de offerte-tool volledig eigen offertes maakt i.p.v. RP-documenten.


## CONFIGURATOR-AUDIT + PRIJSFIXES LIVE (31 juli, commit 0532ccd)
- Aanleiding Daimy: windsensor stond als extra bij rolluiken. Volledige audit configurator (sonty-website) gedaan.
- **Gefixt en live op sonty-website.vercel.app**: (1) windsensor-upsell weg bij rolluik/markies/pergola, blijft bij knikarmschermen mét garantie-uitleg; (2) doekkleur-tekst werd als framekleur geprijsd → onterechte RAL-meerprijs bij screens/knikarm/uitval/markies/pergola/serre (UI + submit-route); (3) submit telde kleurMeerprijs dubbel; (4) hor-standaardkleuren "RAL 7016/9005 structuur" kregen onterecht +€100 (structuur vs STR); (5) keuze-indicaties op knoppen misten ×1,1 markup; (6) LED SunElite stond als bediening-keuze (rekende als io zonder LED-prijs) → nu aparte optie op aanvraag; (7) upsell-uitleg (windsensor/Tahoma/Roma-hor) = echte Sonty-uitleg uit de kennisbank.
- Verificatie: 9 kleur-regressiecases via engine, build groen, headless Playwright op rolluik+knikarm-flow, live API-check op productie (hor structuur → standaard €0; Suneye doekkleur → standaard €0).
- **Vervolg (zelfde dag, commit 3c52dc2)**: mandje, live-schatting en keuze-indicaties bleken nog op de oude interpolatie-engine te rekenen (pergola −85%, markies −36/−40%, Roma −10/−19%, Suncube +48% t.o.v. echte prijs). Alles nu via `calculateItemPriceCentraal` (centrale engine, oude engine alleen vangnet); knop-indicaties incl. montageverschil per bediening; uitbouw-optie knikarm telt door (€325). Live geverifieerd: rolluik-draaischakelaar toont −€219 (was −€165 zonder montageverschil).
- **Open**: Roma .XP insectenrolhor-upsell telt in het winkelmandje als €0 (echte meerprijs op maat staat wél in de uitleg + offerte); V1 aan Daimy gesteld of windsensor bij markiezen echt weg moest (gedaan o.b.v. kennisbank, makkelijk terug te zetten).


## VVE-RADAR V1 LIVE (30 juli) — VvE's actief benaderen als vaste zonweringspartner
- **Strategie (akkoord Daimy)**: eigenaar mag niet zomaar zonwering aan gemeenschappelijke gevel → Sonty stelt gratis zonweringsprotocol + ALV-besluit op met Sonty als vaste leverancier → elke eigenaar loopt daarna de facto via ons. Regio: heel Zuid-Holland. Route naar schaal: VvE-beheerders (raamcontract).
- **Tool**: sonty-website `/admin/vve-radar` (code sonty2288, PR #47). Scan per plaats/kaartgebied → complexen met score 0-100 (woningen + zon beste gevel uit pand-polygon + CBS-koop% + bouwjaar), luchtfoto, opvolgstatus per gebouw in KV (`vvestatus`), CSV met "Aan het bestuur van de VvE". Delft-test: 668 complexen / 29.842 woningen in ~3 s.
- **PDOK-lessen**: WFS-URL max ±4 KB (20 ids per Or-filter-batch), elk antwoord max 1000 records → pagineren met startIndex (helper `wfsAll` in de route).
- **KvK LIVE (3 aug)**: key in `scripts/.kvk-api-key.txt` (niet in git). Zoeken-API is GRATIS, Basisprofiel kost €0,02/bevraging, max 300k/mnd en 100/sec. Zoeken geeft max 1000 treffers (10 pag. x 100).
- **BUG GEFIXT (3 aug)**: PDOK WFS is naar camelCase gegaan (`openbareRuimte`, `aantalVerblijfsobjecten`). Daardoor gaf de VvE-radar bij ELK complex "(adres onbekend)" en lag de nieuwbouw-scan stil; de WFS-filters werkten nog, dus het viel niet op in de aantallen. Opgelost met `lib/bag.ts` (leest beide schrijfwijzen). Zonradar gebruikt de OGC-API (nog snake_case) en was niet geraakt — geverifieerd, 292 rijen rond Rozenboomlaan.
- **KvK-koppeling in de radar (3 aug)**: `scripts/kvk-vve-koppel.js` → KV `vvekvk`, toont officiële VvE-naam + KvK-nummer + correspondentieadres per complex, ook in de CSV-aanhef. NIET op plaats filteren (VvE's staan op het adres van hun beheerder: dat kostte 47 van de 50 koppelingen); plaats wordt bewezen via de naam, het eigen adres of een PDOK-straatnaamcontrole. Voorburg: 85 van 211 complexen gekoppeld, 32 zeker.
- **AANSCHRIJFLIJST LIVE (3 aug)**: `/admin/vve-lijst` + `/api/vve-lijst` (KV `vvelijst`), vullen met `scripts/kvk-vve-gemeente.js <plaats>`. Idee: een VvE mét beheerder staat op het kantooradres, een VvE zónder beheerder op haar eigen complex — meestal het huisnummer van de voorzitter. Voorburg: 998 VvE's ingeschreven, 608 zelfbeheerd, 250 profielen opgehaald (€5,00) → 250 met straatadres+postcode, **162 op non-mailing (niet koud aanschrijven), 88 direct aanschrijfbaar**. Nog 358 te doen (~€7,20).
- **Mail-jacht met KvK-naam**: `vve-mailjacht.js --hernieuw` zoekt op de officiële naam i.p.v. alleen het adres → 3 mails uit 25 tegenover 3 uit 211. Wat het vindt zijn vooral beheerdersmails; eigen VvE-mailadressen bestaan bij complexen ≥10 woningen zelden.
- **NIET gecontroleerd**: VvE's die op hun eigen complex staan maar de straatnaam niet in hun naam hebben, vallen buiten de zelfbeheer-selectie (vals-negatief, omvang onbekend). Of 65% non-mailing ook buiten Voorburg geldt is niet gemeten.
- **WACHT OP DAIMY**: (1) rest van Voorburg + andere gemeenten doorzetten (€0,02 per VvE); (2) postbode.nu saldo vóór echte brieven.
- **Mail-jacht LIVE (31 jul)**: mailveld in radar (KV `vvemail`, PR #50) + batch `~/sonty/scripts/vve-mailjacht.js` (haiku web_search per gebouw). Voorburg/Leidschendam gedaan: 211 doorzocht → 3 directe VvE-mails (Arcade, Prinsenhof, Hofvliet) + 23 VvE-namen/beheerders in de radar. **LET OP: 19 gebouwen wachten op API-limiet-reset (key op limiet tot 1 aug 00:00 UTC)** → daarna `node scripts/vve-mailjacht.js Voorburg 10 40` opnieuw draaien.
- **Beheerders-overzicht LIVE (31 jul, PR #51)**: /admin/vve-beheerders — acquisitie-pijplijn (te benaderen→gemaild→gebeld→afspraak→pilot→raamcontract) met 11 geseede kantoren, notities, KV `vvebeheerders`. Beheerder-mail v2 klaar in docs/vve/mail-beheerder.md — WACHT OP AKKOORD DAIMY + verzendkanaal (info@) + telefoonnummer voor onder de mail.
- **Nog te bouwen (afgesproken)**: brief-flow via postbode, KvK-verrijking + cron nieuwe VvE's.
- **Nieuwbouw-detectie LIVE (PR #48/#49)**: knop "Komende VvE's" = BAG-panden vergund/bouw gestart met 10+ won (Zoetermeer: 10 complexen/683 won, o.a. 228-won-toren 2026). BAG-jaartal = GEPLANDE oplevering; verlopen jaar → label "oplevering loopt uit, nu benaderen" (vraag Daimy). Belangen-vraag Daimy beantwoord met VvE-recht-bronnen: bestuur vreest wildgroei maar mag niet totaal verbieden → protocol is hun uitweg, ons aanbod.

## WINSTPLAN VERSTUURD (1 aug, opdracht Daimy: "onderzoek in 1 terminal, zo veel mogelijk winst")
- Stand: 259k winst op 2,9M ex (8,9%) jan-jul; lasten groeien even hard als omzet (+43%), geen schaalvoordeel; conversie gehalveerd door overvolume.
- Keuzes op impact: (1) conversie-herstel: +1pp = 145k/7mnd, naar 12% = ~390k — via instroom terug naar 280-350/wk; (2) ad-herallocatie Meta-Rolluiken → Google S+S/Meta Screens (60-90k/jr); (3) +1 montageteam (77k marge/mnd doorzet vs 9k loon, W33+ leeg); (4) belblok oude plank (~34k/ronde); (5) gratis kanalen opschalen (Zonradar + referral, 50-100k/jr); (6) RP eruit (12k/jr); (7) prijstest 2% = alleen op Daimy's zeggen.
- Advies: 1+2+3 als één beweging (~400-500k/jr). WACHT OP DAIMY: welke punten → dan per punt draaiboek. Ook open: mix-kolom in dashboard-maandtabel (aangeboden 31-07).

## WINST-PER-BRON COMPLEET (31 juli, slot): sheet x ads x lasten in één model
- `campagne-rendement.js` is het hart: campagne-spend (Meta-CSV's + Google-screenshots, data/campagne-spend-*.json) x sheet-orders (echte akkoordbedragen; €1-inkoop geschat via productratio ~53%) x echte maandlasten (lasten-blok per maandtab via `lasten-import.js`, = alles behalve ad spend). Alles ex btw.
- Dashboard: "Winst per bron" (Meta 23,7k | Google 17,2k | buren 58,8k | anders 61,0k | onbekend 98,8k | BEDRIJF 259,4k jan-jul), netto per maand per bron, per campagne. Juni-test sloot exact aan op Daimy's eigen blok (verschil = zijn 50% marge-aanname vs gemeten 47,5% + narijping).
- Kernconclusies: Meta-Rolluiken -36,7k (enige grote lek, 75% Meta-budget); Google Schermen+Screens +87k (topper); pergola-ads netto positief (correctie op eerder advies); "Onbekend" (147 orders zonder afkomst) is grootste winstbron -> afkomst-kolom laten invullen. Advies-5-punten 31-07 in databot.
- Marketing-mix erkend: directe toerekening is ondergrens voor ads (buren=echo, onbekend deels ads); campagne-vergelijkingen blijven geldig (zelfde meetsysteem). Mix-effect wordt zichtbaar via weekrapporten na de Meta-Rolluiken-afbouw.

## CAMPAGNE-INZICHT (31 juli, vervolg): landing-proxy live, UTM ontbreekt
- Daimy wil kosten+opbrengst per CAMPAGNE, niet maandtotalen. Leads hebben GEEN utm/campagne-data (alleen zelfgerapporteerd "hoe komt u bij ons terecht").
- **Proxy live in dashboard**: `scripts/landing-analyse.js` — productregel uit leadomschrijving = landing/campagne-familie; leads/akkoord/waarde 45 dgn (rolluik 10,4% vs pergola 3,0% vs Sunelite 2,6%). Wekelijks mee in update-dashboard.sh.
- **Nog nodig**: (1) rapportmails op campagneniveau (instructie bij Daimy), (2) UTM-doorsluizing in Webflow-formulieren (bureau/Daimy, half uur) óf ads naar de nieuwe site laten landen, (3) naamconventie campagne=product als tussenstap. Zodra kosten per campagne binnenkomen: matchen op label/naam → €/lead en €/order per campagne in dashboard.

## AD-SPEND-ADMINISTRATIE + RENDEMENT IN DASHBOARD (31 juli)
- `scripts/ad-spend.js` -> `data/ad-spend.json`: spend per maand per platform uit (1) `data/ad-spend-handmatig.json` en (2) sheet-tab "conversie %". Draait wekelijks mee in update-dashboard.sh. Dashboard toont rendement-blok: €/offerte, €/order, oordeel tegen break-even €513-592/order.
- **Meta**: echte account "Sonty.nl | Creditcard" (1633352477464320) staat bij Meta nog op "gradually being rolled out" voor de ads-MCP — PERIODIEK HERCHECKEN in sessies (kan niet via cron, MCP is sessiegebonden). Alternatief: Daimy maakt system-user-token met ads_read → directe Graph-API-collector bouwen.
- **Google Ads**: geen API-koppeling; beste route = gescheduelde maandrapport-mails uit beide platforms naar facturen@sonty.nl → parser bouwen zodra Daimy ze aanzet (voorstel ligt bij hem). NB: sonty.nl draait nog Webflow; admin/dashboard leven op sonty-website.vercel.app.

## DASHBOARD LIVE + A/B-BASELINE GECORRIGEERD (31 juli)
- **Conversie-dashboard**: sonty.nl/dashboards/conversie.html (code = belscherm). Per maand x platform en x productgroep, jaartabs 2024-2026, rijpheidsmarkering. Ververst zichzelf elke ma 07:45 (nl.sonty.dashboard-update: verse extractie -> bouw -> git push -> Vercel). Generator: scripts/bouw-conversie-dashboard.js.
- **A/B-correctie**: de "15%" baseline in ab-test-rapport.js was hardcoded zonder meting. Echt gemeten (identieke methode, 3-dagenvenster): oude template 26,8% (n=82), nieuwe templates 28,9% (n=235) — GEEN aantoonbaar verschil in reply rate; verdubbel-claim ingetrokken bij Daimy. Baseline in het rapport vervangen door gemeten waarde. Beslismoment = akkoorden per variant, uitgerijpt ~half augustus.

## VANGNET ONBEANTWOORDE KLANTMAIL + VVE/ZAKELIJK-FILTER (30 juli)
- **Casus Niels Pompe**: churn-mail 23-07 op aan-Daimy-toegewezen ticket bleef 5 dagen onzichtbaar (bot blijft terecht van mens-gesprekken af, maar geen vangnet) → klant annuleerde 28-07; die escalatie ging wél goed naar Mens nodig maar lag 2 dagen stil. NIEUW in email-daemon: klantmail op mens-gesprek 4u onbeantwoord → team Mens nodig + notitie; bij annuleer/klacht-signalen direct Telegram-alarm naar Daimy. Bot antwoordt daar nooit zelf.
- **Zakelijk-filter** (verduidelijking Daimy): mails van zakelijke aanvragers (namens VvE/bestuur/beheer, "VvE <Eigennaam>", vastgoed-/gebouwbeheer, gemeente/school, kantoor-/bedrijfspand, X woningen) → automatisch aan Daimy, bot beantwoordt niet. Particulier die zijn vve alleen noemt blijft bij de bot. 8 testcases groen.
- Ticket 970211967 (Esther, VvE Weidse Weelde) aan Daimy toegewezen; Sunny had al geantwoord vóór de regel bestond.

## OPVOLGING 24U-VENSTER AANGEZET (30 juli, opdracht Daimy)
- Terugblik AI-gesprekken: 6 persoonlijke follow-ups lagen klaar binnen het 24u-venster, 1 verstuurd. Oorzaak gemiste 5: avond-kandidaten kregen buiten bot-uren een beoordeling → state.beoordeeld → ochtendrun blokkeerde ze ("vandaag al beoordeeld").
- Fix in opvolging-daemon.js: snel-kandidaat buiten bot-uren = overslaan ZONDER state-write, ochtendrun pakt hem vers. Mens-nodig/toegewezen blijft geblokkeerd (grootste groep: 645 blokkades/3 dgn — volume ligt bij het team). Daimy's 23-07-regel (na offerte zelfde dag niet pushen) blijft in de AI-beoordeling staan.

## GRIPP-KOPPELING GELEGD (30 juli): openstaand-rapport + opruimlijst (item 14)
- Gripp offer-API werkt (alleen-lezen key uit secrets.js). **Definitie "openstaand" = Daimy's scherm: status Verzonden (9) + archived=false, bedragen EX btw** (API /1,21). Alleen op status filteren telt gearchiveerde mee (750/€3M vs echte 162/€623k).
- `gripp-open-offertes.js` (ma 08:35): 162 open = 17 opruimkandidaten (andere offerte zelfde maand geaccepteerd, €45k) + 13 twijfel (€43k) + **9 status-fouten (offerte zélf geaccepteerd maar staat op Verzonden, €31k)** + 123 echt open (€504k). Volledige lijst met nummers is 30 juli naar Daimy gestuurd; team ruimt op (key is read-only).
- Kruischeck sheet-akkoorden vs Gripp (V2) kan nu — nog niet gedaan.

## OPSCHONING UITGEVOERD + VERKOOPBELEID HANDBEDIENING (30 juli, "doe wat jij wijs vindt")
- Nul-meldingen UIT (wachtlijst-ok, A/B-leeg, geen-AI-gesprekken → log-only). Oud weekrapport (nl.sonty.weekrapport) UIT: bron rp-archief bevroor 16 juli. Maandag-script doet nu EERST verse sheet-extractie.
- Rapporten 5/6/7 LIVE: conversie-per-bron (ma 08:35), openstaande-offertes 14-60 dgn in leeftijdsbuckets (ma; €9,2 mln bruto werkvoorraad!), maandrapport 1e vd maand 08:50 (afgesloten maand vs zelfde maand vorig jaar). Lijst: docs/rapportage-lijst.md.
- **VERKOOPBELEID (Daimy): GEEN HANDBEDIENING meer verkopen** — band/slinger = blijvend gat in kozijn/muur; minimaal draaischakelaar adviseren. Verwerkt in ai-ks/system-prompt.js (klant die erop staat → Mens nodig; horren uitgezonderd) en sonty-website keuzehulp.ts (gepusht, Vercel deployt). Memory: feedback_geen_handbediening.
- Montage-rapport na audit: kop = gemonteerd vorige week + ingepland 3 wkn vooruit, voor montage én inmeten; maandtabel toont afspraken én unieke opdrachten (289 vs 274 in juli).

## AKKOORD-DEFINITIE GECORRIGEERD + MELDINGEN-OPSCHONING LOOPT (30 juli)
- **Correctie Daimy verwerkt (28-jul-bericht, 2 dagen blijven liggen door dode databot-poller)**: akkoord = inkoopkolom gevuld (ook €1-placeholder) OF akkoord-blok. 2026 gaat van 6,3% naar 9,3%; jan-apr-vergelijking is nu 16,8% (2025) tegen 10,7% (2026). Juni 2026 = 187 (Daimy telde ~190). Beide rapport-artifacts bijgewerkt, zelfde links. Alle scripts (capaciteitsmonitor, seizoensplan, breakeven, tabellen) op de nieuwe definitie.
- **Waarom het bleef liggen + fix**: poller ving het bericht wel, maar geen sessie las mee. Nu: (1) persistente Monitor op beide inboxen in de actieve sessie, (2) health-check alarmeert hard op ongelezen Daimy-berichten >60 min én doet een 409-test op de databot-poller.
- **MONTAGE-RAPPORT LIVE (30 juli, #13)**: `scripts/montage-rapport.js` telt de Outlook-agenda "Sonty Montage" (OWA-route; Planado is vrijwel leeg, 20 testjobs). Juni 188 montages/mnd -> juli 289 (65/wk). Tegen juli-prognose 234-335 orders: plafond ~280/mnd, ruim scenario = ~1 extra 2-mans team. Draait ma 08:35 mee.
- **RAPPORTAGELIJST LIVE (30 juli)**: `docs/rapportage-lijst.md` = levend overzicht "wat wil Daimy weten". Draait ma-ochtend in de databot: capaciteit (08:30), kanaal mail/WA + productgroep-14-dagen (08:35, nl.sonty.maandag-data), cohort (08:45). WACHT OP DAIMY (V2): welke van voorstellen 5-12 erbij (advies: 5 bron-conversie, 6 maandrapport, 7 openstaande offertes >14 dgn).
- **Kanaal-rapport les (30 juli)**: mail-vs-WA alleen zuiver op online rijen met geldig 06 — rijen zonder bruikbaar nummer (akkoord-rijen!) en winkel converteren 55-77% en vervuilen anders "mail". Zuiver wint WhatsApp (W28 8,1 vs 5,7; W29 8,9 vs 5,6; juni 6,3 vs 5,6). WA-log = bord-item-ids (niet document-ids), koppeling op telefoon, log bestaat sinds 29 juni.
- **MELDINGEN-OPSCHONING — WACHT OP DAIMY (V1)**: voorstel verstuurd: alarmen direct/los, alle rapporten in één ochtenddigest 08:30, nul-meldingen weg ("geen klant wacht", "geen AI-gesprekken", "nog geen A/B-offertes", losse ✅ per follow-up). Open vragen: (a) digest 1x of ochtend+avond, (b) datarapporten naar databot?, (c) iets uit de weg-lijst houden? Inventarisatie: ~20 zendende jobs, ochtendspits is 6-8 losse berichten.

## CONVERSIEANALYSE 2025 OPGELEVERD + NIEUWE DATA-BOT (27 juli)
- Rapport: https://claude.ai/code/artifact/4537e5dc-c46c-43da-83f3-789532aab308 (bron: `data/conversie-2025-rapport.html`, gegenereerd door `scripts/bouw-conversie-rapport.js` uit `data/conversie-2025-tabellen.json` — nooit handmatig cijfers overtypen).
- Pijplijn: `scripts/conversie-2025-sheet.js` (leest de 12 maandtabs 2025) → `data/conversie-2025-raw.json` (NIET in git, bevat namen/telefoonnummers) → `scripts/conversie-2025-analyse.js` en `scripts/conversie-2025-investering.js`.
- **KRITIEK — de vinkjeskolom "Akkoord" in het offerteregister is onbruikbaar**: 313 akkoorden voor heel 2025, terwijl juni op 0 staat bij 1.221 offertes en mei op 1. Het akkoord-BLOK (Gripp-nummer / akkoorddatum / akkoordbedrag) is wel consistent: 1.089 akkoorden = 11,8%. Gevalideerd tegen Daimy's eigen tab "conversie %" (maart 625 vs 627, april 907 vs 896, mei 1.240 vs 1.227). Elk dashboard dat op de vinkjeskolom stuurt zit een factor 3,5 te laag.
- **Afkomst-labels zijn medio 2025 omgezet**: t/m aug heette Meta-traffic "Facebook", vanaf sep "Instagram" (FB zakt 558→4, IG springt 63→345). Altijd samenlezen als Meta.
- Tab "2025 alles bij elkaar" is een deelkopie (jan t/m 18 mrt) → overslaan, anders dubbeltelling. "Augustus 2025" is een lege dubbele tab naast "Aug 2025".
- Uitkomsten 2025: 9.198 offertes, 1.089 akkoord (11,8%), €4,07 mln omzet, €1,84 mln productmarge. Google 14,5% vs Meta 6,8%. Winkel 67,1% vs online 10,0% (301 offertes = 3,3% maar 24% van de omzet). Zomerdip jun-aug 9,2% vs jan-mei 15,2% = ~€400k gemiste marge. Pergola+voorraadscherm 1.610 offertes voor 38 akkoorden.
- **Nieuwe data-bot @Sontydatabot** (apart van de gewone bot): poller `tools/sonty-data-poll.js` via launchd `nl.sonty.databot-poll`, inbox `sonty-data-inbox.txt`, lezen met `node scripts/read-sonty-data.js`, sturen met `node scripts/sonty-data-send.js "tekst"`. Chat_id staat NIET hardcoded maar in `.sonty-data-chat.json` (vastgelegd bij Daimy's eerste bericht, id 1700128390). Alle Sonty-datavragen gaan hierlangs.
- **2026 TOEGEVOEGD (27 juli)**: extractie is nu jaar-onafhankelijk (`node scripts/conversie-sheet.js --jaar 2026` → `maak-conversie-tabellen.js --jaar 2026` → `bouw-conversie-rapport.js`; vergelijking los via `conversie-vergelijk.js`). **Jan t/m apr, in beide jaren uitgerijpt: 2.192 → 4.532 offertes (+107%), 367 → 417 akkoorden (+14%), conversie 16,7% → 9,2%.** De daling zit bij ELK kanaal: Google 19,8→8,2%, Meta 11,1→6,8%, buren/bekenden 55,2→25,0%, showroom 70→52%. Dat wijst op verwerkingscapaciteit, niet op leadkwaliteit. Pergola+voorraadscherm 2026: 2.938 offertes (29% van alles) voor 60 akkoorden (9%).
- **ADVERTEERPLAN AUG-FEB (28 juli)**: https://claude.ai/code/artifact/ed482277-3ca2-477e-9cee-847c4f2b6d16 (bron `data/adverteerplan.html` via `scripts/bouw-adverteerplan.js` uit `scripts/seizoensplan.js` -> `data/seizoensplan.json`). 2024 (mei t/m dec) is toegevoegd aan de extractie, dus aug-dec staat op twee seizoenen.
  - **Rangschikt op MARGE PER OFFERTE**, niet op conversie of omzet: de schaarse hulpbron is offertecapaciteit (~35 orders/wk), niet advertentiegeld. Pergola levert 3.500 marge per order maar sluit op 2,5% = 89 euro per offerte, de slechtste besteding.
  - Per kanaal aug-feb: buren/bekenden €634, Anders €357, Google €232, Meta €112 per offerte. Google verslaat Meta in ALLE 7 maanden.
  - Per product: raamdeco binnen €367, knikarm €307, reparatie €287, zonwering buiten €239, screens €204, rolluiken €186, voorraadscherm €91, pergola €89.
  - **53,9% van de capaciteit gaat naar combinaties onder €140/offerte (€367k marge); 33,5% naar boven €230 (€678k).** Meta-Rolluiken alleen is 24,7% van de capaciteit à €131; via Google €237.
  - Seizoen: zonwering buiten = aug t/m okt (51% van najaarsvraag in aug, dood in nov); raamdeco binnen + reparatie = winterwerk; rolluiken enige met volume elke maand. November is de beste maand per offerte (€255) en krijgt nu het minste volume.
- **NAKOMERS GEKWANTIFICEERD**: op een volledig uitgerijpt cohort (jan-apr 2025) zag je op dag 89 al 97,8% van het eindtotaal. Jan-apr 2026 staat nu op dag 89, dus 9,2% wordt hooguit ~9,4%. Nakomers verklaren 0,2pp van een gat van 7,5pp.
- **AI-KS EFFECT NOG NIET MEETBAAR**: log start 3 juli 2026, juli-offertes zijn niet uitgerijpt. Eerste eerlijke meting half oktober (augustus op dag 45 = 96,5% rijp), dan aug 2026 tegen aug 2025 op hetzelfde rijpingspunt. AI-KS eigen tellers over 10 dagen: 213 geholpen, 63 akkoord inmeten, 21 showroomafspraken, 34 overtuigd — zit nog in de pijplijn. WACHT OP DAIMY of ik die meting klaarzet.
- **CAPACITEITSMONITOR LIVE (27 juli)**: `scripts/capaciteitsmonitor.js` draait wekelijks via launchd `nl.sonty.capaciteit` (ma 08:30) en post OPSCHALEN/VASTHOUDEN/AFSCHALEN in de data-bot. Leest de sheet live (huidig + vorig jaar). Drempels in `data/capaciteit-config.json`, laatste stand in `data/capaciteit-laatste.json`. Handmatig: `node scripts/capaciteitsmonitor.js [--stuur]`.
  - **Kerngetal: het team sluit max ~35 orders/week** (beste 4 aaneengesloten weken, 2026-W13..W16). Dat plafond bewoog niet tussen 2025 en 2026 terwijl de instroom verdubbelde. Capaciteit wordt gemeten als beste-4-weken, niet aangenomen.
  - Stand 27-07: instroom 500 offertes/wk, verwerking 25 orders/wk, ratio 15,0 (gezond = 8), verzadiging 177% → AFSCHALEN naar ~282/wk. Output is gezakt (25 vs 35 gehaald) terwijl instroom steeg = te volle wachtrij.
  - Omslagpunt is uit de historie gemeten, niet aangenomen: tot 150/wk ratio 7,5 · 150-250 8,1 · 250-300 9,6 · 300-350 10,1 · 350-500 12,8. Tot ~250/wk gezond.
- **RIJPHEID-REGEL**: mediaan 24 dagen tussen offerte en akkoord, 90% binnen ~51 dagen. Een maand is pas bruikbaar als hij ~60 dagen achter ons ligt. Juli 2026 stond op 8 akkoorden bij 1.861 offertes — nooit als echt cijfer lezen. Jaarvergelijkingen altijd op jan t/m apr.
- WACHT OP DAIMY (V2): akkoorden jan-apr 2026 tegen Gripp aanhouden? Enige manier om te weten of de conversiedaling echt is of een registratieprobleem. (V3): kostenkolom in tab "conversie %" aanvullen voor 2026.
- OPEN: advertentiekosten zijn alleen voor maart t/m mei ingevuld in de tab "conversie %" — de rest van 2025 is leeg, dus CPA/rendement is niet voor het hele jaar te berekenen. Zou goed zijn als Daimy die aanvult.

## GECORRIGEERD (24-07 ~15:45, Daimy): de 102 WhatsApps waren de BEDOELDE te-ver-correctierun van gisteren — GEEN incident. V4 is weer AAN (bootstrap gedaan). Enige echte fout: Ton (+31628840611) — zijn oude 2025-dossier zat in de correctie-batch en de WA-stap checkt de leeftijd van het DOSSIER, niet van de OFFERTE → 2025-offerte geappt. Nieuwe offerte (4 schermen, inmeet 23-07) moet Joey nog maken. FIX-voorstel (1 regel, wacht op Daimy: hier of andere chat): alleen appen als offerte zelf < 14 dagen oud.

## (ACHTERHAALD — zie correctie hierboven) INCIDENT: V4 OFFERTE-WHATSAPP MASSA-VERZENDING — DAEMON GESTOPT (24 juli ~15:15)
- 102 offerte-WhatsApps verstuurd op 24-07 in twee bursts (V4-runs 9:30 + 13:00). Oorzaak-keten: WA-stap in cron-offerte-controle-v4-combined.js triggert op RP-items met timestamp_updated < 2 dagen; iets (sync/migratie/verrijking) heeft massaal items aangeraakt → honderden matches → per klant de nieuwste SENT/ACCEPTED-offerte geappt, OOK ALS DIE OEROUD IS (klant Ton +31628840611 kreeg offerte 202516635 uit 2025 terwijl gisteren was ingemeten; escalatie liep goed, mens heeft gecorrigeerd).
- ACTIE: `launchctl bootout gui/501/nl.sonty.offerte-v4` — V4 draait NIET meer (ook prijscontroles niet!) tot fix. Herladen: `launchctl bootstrap gui/501 ~/Library/LaunchAgents/nl.sonty.offerte-v4.plist`.
- FIX NODIG (waar: Daimy beslist, andere chat werkt aan offerte-flow): (1) WA alleen als de OFFERTE ZELF recent is (quotationCreationTimestamp < X dagen), (2) noodrem max N WhatsApps per run + alert, (3) uitzoeken wat alle RP-items touchte. Verzendlog: scripts/.wa-offerte-sent.json (documentIds+tijd).
- Ook vandaag: Berner-nieuwsbrief kreeg AI-antwoord (redenering als mail verstuurd; ticket gesloten; fix = nieuwsbrief-filter in email-daemon, andere chat gevraagd) en Bink-offerte aangemaakt zonder gevraagde afwijkende demontageprijs (tool-beperking; handmatig corrigeren vóór maandag).

## OPVOLGING DEELS LIVE (23 juli ~17:00, mandaat Daimy)
- opvolging-daemon draait nu ELK UUR (was 1x/dag) en verstuurt ECHT binnen mandaat: (1) WA-gesprekken waar klant niet reageerde op ons laatste bericht, niet toegewezen/niet Mens nodig -> follow-up VOOR het 24u-venster sluit (4-20u stilte-check bestond al); (2) e-mail idem na 3 tot 4,5 dagen stilte. Alleen binnen bot-uren; alle andere gevallen blijven SCHADUW-voorstel. Volledig schaduwrapport alleen nog in de 10-uur-run; live-verzendingen worden per run gemeld. Vinkje-notitie op ticket per verzending.
- Ook vandaag: verse @sonny-opdracht op collega-tickets wordt echt uitgevoerd; bij dicht 24u-venster valt elk bot-vervolgbericht terug op goedgekeurde template 236108.

## PLANNING-TAB IS NU "2026 goed" + NIEUWE MAILAFHANDELING (23 juli ~16:10, opdracht Daimy)
- Tab "Claude ai test" heet nu **"2026 goed"** (zelfde sheetId 273253041; oude tab blijft "2026"). Nieuw tabblad **"Retouren"** (sheetId 111815888): retourmeldingen komen daar als rij (datum/leverancier/referentie/omschrijving), niet meer in de hoofdtab; bestaande retour SN82606373 verhuisd.
- Mailafhandeling: GOED verwerkte mails zet de daemon nu op GELEZEN (PATCH IsRead). Onverwerkbare leveranciersmail: Telegram-melding naar Daimy + mail blijft ONGELEZEN (state.gemeld voorkomt herhaal-meldingen), geen handmatig-bekijken-rijen meer. Ongelezen in de inbox = actie nodig.
- LET OP incident vandaag: daemon-bestand viel 2x terug naar oudere versie (kruising met parallelle sessie in dezelfde repo); schrijfblok opnieuw opgebouwd (A..Q). Bij daemon-werk: eerst verifieren dat het bestand de verwachte versie is (grep op recente feature).

## TE VER-HERSTEL LOOPT (23 juli ~15:30, akkoord Daimy: optie A + sorry-mail)
- Sorry-mail naar ALLE 98 verstuurd (98/98, 0 fouten; script scripts/sorry-mail-tever.js, dedupe data/sorry-mail-verzonden.json, tickets direct gesloten). Tekst: excuus "foutje met de locatie-instelling in het nieuwe systeem", offerte wordt doorgeappt, WhatsApp-ons-knop ZONDER nummer, ondertekend Sunny.
- Batch 1 (50) staat in OC voor de v4-run; batch 2 (48) wordt automatisch teruggezet na de run (wachter draait). Automatische offerte-links gaan daarna vanzelf (keuze A Daimy).
- NOG TE DOEN: na de runs register-correctie (TE VER -> echte bedragen), steekproef 5 offertes, eindrapport.
- FEEDBACK-GAP GEFIXT (~15:45): WA-daemon las geen @sonny-notities op mens-toegewezen tickets (dagstand-feedback Daimy gemist) — nu wel (alleen notities, nooit antwoorden). Dagstand-leerpunt geborgd in data/ai-ks/leerpunten.md + ✅-notitie op ticket 968268085.

## TE VER-HERCHECK JULI: 98 ONTERECHTE AFWIJZINGEN (23 juli ~14:45, alleen gecheckt, NIETS verstuurd)
- Van de 230 TE VER-mails in juli waren er met Gouda-basis 98 ONTERECHT (allemaal < 60 km van Gouda = altijd-bedienen-zone; 132 wel terecht; 0 onherleidbaar). Volledige lijst: data/tever-hercheck-juli.json (naam, plaats, km, datum, e-mail).
- Grootste clusters: Almere (14), Tilburg (10), Amersfoort (6), Zeist (6), Purmerend, Kaatsheuvel, Waalwijk, Den Bosch, Bussum. Klanten kregen "buiten ons werkgebied"-mail namens Joey.
- WACHT OP DAIMY: of/hoe deze 98 alsnog benaderd worden (excuus + alsnog offerte?). NB: dedupe in .tever-sent.json voorkomt dat ze bij een nieuwe aanvraag opnieuw gemaild worden, maar hun bord-items staan op TE VER.

## TE VER-BASIS = GOUDA (23 juli ~14:15, correctie Daimy "het is niet Rijswijk, Gouda als basis")
- SONTY_LAT/LON in v2/v3/v4 stond op RIJSWIJK; nu GOUDA (52.0116, 4.7104). Regels ongewijzigd: >125km te ver; 60-125km alleen bij >= EUR 7.500; <60km altijd. Vanaf Gouda: Bunnik 34km, Utrecht 29km, Amsterdam 42km — allemaal binnen. Regressietest 127/127. Dit was de ECHTE oorzaak van de De Wolf-afwijzing (59km vanaf Rijswijk, 34km vanaf Gouda).
- MOGELIJK VERVOLG (vraag aan Daimy open): eerdere TE VER-afwijzingen herevalueren met Gouda-basis — er kunnen klanten onterecht afgewezen zijn.

## V4: TE VER NA VERWERKING + OFFERTE 202610173 AF (23 juli ~13:50, opdracht Daimy)
- v4-combined aangepast: TE VER-items krijgen nu EERST de volledige verwerking (prijscorrectie + verrijking + opslaan) en gaan daarná pas naar TE VER (mail + status). Regressietest 127/127 groen. Reden: handmatig teruggehaalde te-ver-klanten (casus de Wolf) hebben dan een kloppende offerte.
- Offerte 202610173 is nu volledig v4-af: Waarom Sonty-blok stond er al (verify keek eerder op de verkeerde plek), kleur-annotaties, profiel-info, upgrade-blokken, correcte prijzen (rolluiken 784,30/1.002,10, SunEye XL 6.459,20), nette regelvolgorde. Wacht bij Tanya op klantoverleg over de XL-maat vóór versturen.

## OFFERTE 202610173: ROOT CAUSE + VOLLEDIGE V4-RUN (23 juli ~13:30)
- ROOT CAUSE "geen v4-run": V4 routeerde het item op 21-07 17:01 naar TE VER (Bunnik buiten werkgebied) — klant kreeg toen automatisch een afwijzingsmail! Team zette het item 22-07 10:05 handmatig door naar Gecontroleerd → keten verstuurde de ONGECONTROLEERDE offerte. Mijn her-run 23-07 routeerde opnieuw naar TE VER (geen 2e mail dankzij dedupe); status teruggezet naar Offerte verstuurd.
- Daarna volledige v4-verwerking los op deze offerte gedraaid (scratchpad v4-op-202610173.js, backup gemaakt): rolluiken naar tabelprijs (784,30/1.002,10 met draaischakelaar-minderprijs), Suneye 6098mm > max 6000 -> SunEye XL €6.459,20 (was €3.443). Nieuw totaal met 15%: €7.768,66 (was 5.315,39). Teamnotitie op ticket 968268085: eerst met klant overleggen (6000mm = standaard Suneye ±3.451) vóór versturen; klant kreeg 21-07 ook de TE VER-mail, excuus op zijn plaats.
- OPEN BESLISPUNTEN Daimy: (a) werkgebied/TE VER-regels (Bunnik?), (b) verzend-gate zodat ongecontroleerde offertes nooit meer verstuurd worden, (c) stil-overslaan altijd loggen. NB: Waarom Sonty-blok faalde stil in de losse run (minor).

## OFFERTE 202610173 GEFIXT + FOUTEN-SCAN ALLE OFFERTES (23 juli ~13:00, opdracht Daimy)
- Offerte F. de Wolf bijgewerkt (backup 202610173-fix-*.json): pantser 2x RAL 7016 -> 9010, montageregel rolluiken 2x EUR 225 toegevoegd; nieuw totaal EUR 5.315,39. NIET naar klant gestuurd; teamnotitie op ticket 968268085 met resterende checks (dagstand bevestigen, Suneye 6098>6000mm, keukendeur).
- SCAN 3.545 offertes (alleen-lezen, uit offerte-backups): (1) rolluik zonder montageregel: 14; (2) pantser != framekleur: 546 (default-fout automation — configurator vraagt geen pantserkleur); (3) >=3 NTB-velden in klanttekst: 2.686 (structureel opmaakprobleem); (4) maat boven prijstabel-max: 28 (vooral Suneye >6000mm, tot 10.000mm — mogelijk gekoppelde uitvoeringen, prijs dan niet uit tabel). Lijsten in scratchpad-scanoutput/chat 23-07. NIETS aangepast behalve 202610173 (expliciete opdracht).

## MENS-GESPREK-GUARD IN BEIDE DAEMONS (23 juli ~11:20, opdracht Daimy)
- Regel: stuurt een COLLEGA (bv. Nanny, niet het Sonny-account 747786) het laatste uitgaande bericht in een gesprek (WhatsApp of mail), dan wordt het ticket aan die collega toegewezen, gaat het uit AI-beheer en blijft de bot er definitief vanaf — ook als de klant later antwoordt.
- Zit in daemon.js (verwerkTicket, vroege guard, incl. verwijderen uit actieve-tickets) en email-daemon.js (na notitie-verwerking). Beide herstart; eerste rondes rustig, geen toewijzings-golf.

## COMPLEET-FIX + HERGROEPEREN (23 juli ~10:45, feedback Daimy)
- FOUT hersteld: compleet-check telde een TOEKOMSTIGE leverdatum (bv. 27-09) als "binnen". Nieuwe regel: "Geleverd op" telt alleen als echte datum <= vandaag (tekst zoals "week 32" telt niet). 15 onterechte markeringen teruggedraaid; echt compleet nu: 5576 (2 leveringen) + 4 losse orders. 5930 is terecht NIET compleet (3 toekomstige datums).
- HERGROEPEREN: AI-rijen met zelfde ref worden onder de bestaande groep van dat nummer gezet (5930-Velux naar rij 1378, van-huis-orderbevestiging naast de eerste bevestiging). Daemon doet dit nu elke ronde (max 10 verplaatsingen, alleen AI-rijen).

## LEVERANCIERSMAILS ECHT LEZEN (23 juli ~10:15, feedback Daimy "alles wordt op ref besteld")
- Nieuwe parsers in de daemon: (1) **Sunmaster Afleverbon** ("Afleverbon NNN uw referentie X ons ordernr. NNN") = LEVERSIGNAAL -> Geleverd op = maildatum; (2) **webshop-bevestigingen** (Markiezen Nederland + Poedercoating Culemborg, zelfde sjabloon): referentie/orderdatum/bestelling uit de MAILTEKST ("Uw referentie van huis (5859, SPOED)").
- 4 "handmatig bekijken"-rijen gerepareerd: 1404 (Markiezen van huis 5859 spoed), 1407 (G.F. Development BV spoed, poedercoat), 1408 (Petrovic spoed, poedercoat), 1413 (Sunmaster afleverbon 29240 Versluis nabestelling, order 2609209, geleverd 22-07).

## MAGAZIJN-INDELING + COMPLEET-SIGNAAL (23 juli ~09:50, spec Daimy)
- Nieuwe kolommen (door Daimy): E=Gripp-nummer, F=Naam, G=Opmerking bestelling. Alle 1.255 rijen gesplitst (nummer/naam/toevoeging), 66 nabestellingen ROOD in G. Daemon volledig omgebouwd (A..Q-indexen) en splitst nieuwe namen zelf.
- REGEL: nabestelling = VOORRANG (rood in G + prefix in B). Per levering één rij; zelfde Gripp-nr = zelfde klant.
- VERWACHTE LEVERINGEN: bij een hoofdbestelling kijkt de daemon in de Gripp-offerte; wijzen de productregels op een leverancier (Sunmaster/Unilux-mapping, conservatief) waarvan nog geen rij bestaat, dan maakt hij alvast een rij "verwachte levering — nog geen bevestiging" aan.
- COMPLEET: hebben álle rijen van een Gripp-nr een "Geleverd op", dan zet de daemon "✔ compleet (N leveringen binnen)" in B + groene E-cel. Eenmalige run markeerde 15 rijen (o.a. 5930 vd heijden = 3 leveringen compleet). Check draait elke ronde mee.

## DOORBRAAK: KLANTNR = GRIPP-OFFERTENUMMER (23 juli)
- Het nummer in de sheetnaam ("Hachioui 6018") is het Gripp-OFFERTEnummer; offer.get op number geeft de company (exacte plaats) én de volledige hoofdbestelling-regels (ook combi-orders over meerdere leveranciers).
- Daemon: plaats/regio nu EERST via offernummer (100% zeker), naam-zoek alleen als fallback; 's-Gravenhage/DenHaag-alias naar Den Haag. 7 eerder-lege rijen exact gevuld (o.a. van der Lans=Wateringen, Meijer=Nootdorp).
- REGEL Daimy: hoofdbestelling komt altijd uit Gripp; naam + "nabestelling" = nálevering en heeft ALTIJD VOORRANG → daemon zet "VOORRANG (nabestelling) —" voor de Ai-opmerking (5 bestaande rijen gebackfilld).
- VOLGENDE STAP (voorstel, wacht op vorm-keuze Daimy): compleet-geleverd-check = Gripp-offerteregels (excl. montage/korting) afvinken tegen binnengemelde leveranciersorders/laadmeldingen per klantnr.

## PLANNING-TAB: NIEUWE KOLOMMEN C+D (23 juli, opdracht Daimy)
- Daimy voegde kolommen toe; indeling nu: A checkbox | B Ai opmerking (KORT, alleen de wijziging) | C Datum aanpassing | D leverancier | E naam | F Plaats | G Regio | H Ordernummer | I Besteld | J Geleverd op | K gepland | L Teams | M Team opm | N Wat besteld | O formule.
- Daemon omgebouwd (alle indexen +2, korte B-teksten, C/D automatisch gevuld); alle 42 bestaande AI-rijen geconverteerd (B ingekort, C=22-07, D=leverancier). Testrun groen.

## ADMIN-WACHTWOORD GEWIJZIGD (22 juli avond, opdracht Daimy): nieuw ww bij Daimy bekend; ADMIN_PASSWORD als Vercel-env (prod+dev), hardcoded fallback VERWIJDERD (fail closed), website-scripts lezen secrets.js, secrets.js + scripts/.sonty-admin-pw.txt bijgewerkt, status-push geverifieerd (200).

## MONTAGE-DASHBOARDS LIVE IN ADMIN (22 juli avond, opdracht Daimy "alleen dashboards, rest nog niks")
- sonty-website: `/admin/montage` (hub: orderketen-cirkel 8 stappen + analysecijfers), `/admin/montage/tijden` (beheer basistijden+toeslagen, seed uit historie, solar apart met norm-Daimy 45/10 geel gemarkeerd, lege regels rood), `/admin/montage/personeel` (teams+skills aan/uit, rollen, toevoegen/verwijderen; hoofdinmeter-rij klaar).
- API: /api/admin/montagetijden + /api/admin/personeel (KV, keys montage:tijden / montage:personeel, seeds in lib/montage/defaults.ts). Backend getest (GET/POST/auth-block), visueel gecheckt met Playwright-screenshots (ook naar Daimy op Telegram), build groen, gepusht → Vercel.
- Ketenstappen tonen eerlijk "nog niet gekoppeld" — geen verzonnen data. Wacht op feedback Daimy wat er mist.
- Montage/inmeet-TIJDEN: Daimy komt erop terug (hoofdinmeter vult lijst in, staat klaar op Telegram 6934). NIETS anders bouwen tot akkoord.

## MONTAGETIJDEN + ROUTE-ANALYSES AF, ROUTE-MOTOR LIVE (22 juli middag/avond, opdracht Daimy)
- **Alle analyses klaar** (read-only, rapporten in sessie-scratchpad `montagetijden-uit-bookings.md` + `reistijden-analyse.md`, kerncijfers ook op Telegram):
  montagetijden per product uit 2 jr Bookings (3850 klussen, bruto incl. verstopte reistijd — 81% rug-aan-rug gepland);
  solar vs bedraad (historisch amper verschil gepland, alleen 2+ stuks ~30 min);
  reistijd (definitief, exact adres + TomTom-gekalibreerd): 14,3 u/wk rijden → herpland 10,2 u/wk, 29% besparing, ~2,1 extra klussen/wk, efficiëntie 79%→84%; TomTom-key in scripts/.tomtom-api-key.txt (gitignored), echte spitsfactor ~1,15;
  magazijn: Berkel = plek 7-9 van 11, Rijswijk-hoek/Westvlietweg scheelt ~2 u/wk (LET OP: magazijn zit in BERKEL, niet Rijswijk — zie memory);
  skills-matrix per team uit historie (Mick/Tygo nog nooit pergola/markies).
- **Route-motor**: OSRM 26.7.3 native via Homebrew + NL-kaart verwerkt (scratchpad), server 127.0.0.1:5000 handmatig gestart (max-table 8000). NIET permanent (geen launchd, bewust). VROOM nog niet: Docker/Rosetta kapot op deze Mac → later vanaf source bouwen. TomTom-key nog nodig voor echte file-laag (nu aanname spits ×1,35).
- **`data/montagetijden/montagetijden-v1.json`** in repo: geleerde tijden + staffels + skills, status "wacht op akkoord Daimy", nergens actief.
- **Plan**: docs/montagetijden-overzicht-plan.md (v2: Bookings-bron, leverings-trigger+datumkeuze, netto tijd + expliciete reistijd, smal aankomstvenster, Planado pas als alles staat).
- **Wacht op Daimy** (gevraagd via Telegram 6889): V11 magazijnadres Berkel; V6 geleverd-signaal; V12 skills bevestigen; werkkaders teams (starttijd/eindtijd/max klussen); V7 vaste regio-dagen; V8/V9 akkoord tijden-lijst + solar-kolom; TomTom-key; akkoord WhatsApp-vangnet meten. Zodra V11 + werkkaders binnen zijn: schaduwplanner bouwen (2 wkn schaduw naast Marijn).

## VACATUREMAIL: NOTIFICATIE-FIXES + EIGEN-MAIL-GUARD (22 juli ~20:15)
- Toegewezen-mails naar Daimy kwamen door: (1) toewijzen bij verzenden (weggehaald), (2) stil mislukte closes (429) waarna de guard open tickets toch aan Daimy toewees. Nu: close met retry, en de e-maildaemon-guard wijst ALLEEN bij een echt menselijk antwoord aan Daimy toe (afwezigheid/bounce herkent hij en sluit stil); vacature-tickets zonder antwoord veegt hij dicht. Bot pakt vacature-tickets nooit op.
- Eerste opt-out verwerkt (roderick.holewijn@gmail.com, data/vacaturemail-optout.txt) — bij afmeldingen: adres in optout-bestand + state.
- BOOKINGS-LOOP GEDICHT: Sunny beantwoordde op info@ een Bookings-notificatie van ons eigen adres met zijn interne notitie (2 tickets, gesloten). email-live.js: mail van @sonty.nl/@sontymontage.nl wordt alleen gesloten, nooit beantwoord; en blokhaak-notities ("[...]") kunnen nooit meer als mail verstuurd worden.
- Batch 1 loopt door (121+ van 1744 op ~20:15); daarna dagelijks 10:30. NB: ADMIN_PASSWORD in secrets.js is gewijzigd (door Daimy/andere sessie) — status-push gebruikt hem, check of Vercel-env meeloopt als dashboard-push 401 geeft.

## SERVICE-HEROPENING → DIRECT MENS NODIG (22 juli ~19:45, regel Daimy n.a.v. Nele +31648700375)
- Probleem: bot bleef meepraten op een geëscaleerd servicegesprek (Nele 966428536, kozijn/vensterbank) — klantreacties na overdracht gingen zo bijna verloren.
- Fix in daemon.js (verwerkTicket, vroege guard): WA-gesprek met een eerdere overdracht-notitie van de bot + NIEUWER klantbericht => direct team Mens nodig (assign + label + tag-notitie), uit actieve-tickets, bot antwoordt NIET. Ligt het al in Mens nodig, dan blijft de bot er stil vanaf. Nele's ticket uit AI-beheer gehaald (ligt bij Tanya, door Daimy toegewezen). Daemon herstart.

## VACATUREMAIL LIVE (22 juli ~18:55, akkoord Daimy)
- Batch 1 (150 van 1.744) draait; daarna dagelijks 10:30 150 stuks via launchd `nl.sonty.vacaturemail` (`scripts/vacaturemail-batch.js`, state data/vacaturemail-verzonden.json, kill-switch data/kill/nl.sonty.vacaturemail). Definitieve mail v7 = zonder handtekening (Outlook plakt zelf), WhatsApp-formulier + doorstuur-knop zonder bonus.
- Reacties: elk verzonden ticket toegewezen aan Daimy (736327) + gesloten; guards in email-daemon (subject "nieuwe collega"/"interesse in de vacature") en WA-daemon (inbound "interesse in de vacature"/"Ik kom via:") wijzen reacties aan Daimy toe, bot antwoordt NIET. Beide daemons herstart + in health-check/dashboard/SYSTEMEN.md.

## VACATUREMAIL-LIJST VOORBEREID (22 juli, opdracht Daimy — NIETS versturen)
- UPDATE ~16:30: doelgroep gefilterd op wens Daimy (2024-2026 + afgeronde opdrachten): **1.744 adressen** in `data/vacaturemail-doelgroep.csv` (602 met lopende order uitgesloten). Concept-mail + verzendplan in `docs/vacaturemail-plan.md` (vacatures: 1 servicemonteur, 2 monteurs, 2 inmeters, 1 winkelmedewerker wo/vr/za; aanbrengbonus EUR 1.000 na proeftijd). Wacht op: onderwerpregel, tekst-akkoord, afzender, startdatum.
- Doel: vacaturemail naar alle klanten waar gemonteerd/geleverd is. Bron: Gripp (alleen-lezen) — relaties met >=1 factuur + e-mail = 2.780 unieke adressen (1.005 laatste factuur 2026, 877 uit 2025, 464 uit 2024, rest t/m 2021). Leveranciers/partners/eigen adressen gefilterd.
- CSV: `data/vacaturemail-lijst.csv` (naam;email;plaats;type;aantal_facturen;laatste_factuur) — staat in .gitignore (persoonsgegevens). Bouwscript: scratchpad (vacature-lijst-bouw.js), zo nodig opnieuw te draaien.
- WACHT OP DAIMY: doelgroep (alles of 2024-2026 = 2.346), afzender (info@/werving@), verzendwijze (batches/mailtool — 2.780 in 1x vanaf Outlook = spamrisico), en de mailtekst (concept aangeboden). NIETS versturen zonder akkoord.

## SYSTEMEN-BEHEER FASE 1 LIVE (22 juli ~15:30, opdracht Daimy "veilig managen, niks kapot maken")
- **SYSTEMEN.md** (repo-root): register van alle 22+ diensten — wat het doet, ritme, log, impact bij uitval, stop/herstart-instructies. Bijwerken bij elke nieuwe dienst.
- **Dashboard sonty-website.vercel.app/admin/systemen** (admin-wachtwoord): live status per dienst, gegroepeerd (Klantgericht/Planning/CRM/Bewaking/Rapportage/Infra), met laatste logregel en log-leeftijd. Read-only. Data: `scripts/status-collect.js` (launchd `nl.sonty.status-push`, elke 10 min) → POST /api/admin/systemen (KV-snapshot). Geverifieerd met screenshots desktop+mobiel.
- **Kill-switch-patroon**: `touch ~/sonty/data/kill/<label>` = dienst slaat rondes over; eerste drager: planning-mail-daemon. **Audit-log**: `scripts/audit.js` → logs/audit.jsonl; planning-daemon logt er al naartoe. **Secrets**: scripts/secrets.js (gitignored) uitgebreid (Telegram/Gripp/OWA/admin); planning-daemon + status-collect lezen eruit. NIETS aan bestaande daemons veranderd.
- OPEN vervolgstappen (akkoord Daimy nodig): oude scripts migreren naar secrets.js + keys roteren (historie bevat ze), audit-log in Sonny/e-mail-daemon, dashboard-knoppen voor kill-switches, cloud-migratie kritieke flows.
- **VANGST dashboard**: `nl.sonty.sonny-rapport` (ochtendrapport 08:30) heeft sinds de reboot van 21-07 niet gedraaid (never exited, log leeg sinds 17-07) — checken of Daimy vanochtend een rapport kreeg; zo nee: kickstart.

## PLANNING-MAIL-DAEMON DEFINITIEF + IN HEALTH-CHECK (22 juli, akkoord Daimy "vast inbouwen")
- Plist `nl.sonty.planning-mail`: RunAtLoad=true (start ook na reboot/crash direct; lockfile voorkomt dubbele runs). In `cron-health-check.js` opgenomen met maxLogAgeH 2 (logt elke 30-min-ronde).
- Health-run 13:06: alle daemons groen incl. planning-mail; V4 self-check gaf exit 1 door een tijdelijke RP-504 om 11:30 (transient, herstelt zelf).
- OPEN (idee-fase, NIET uitvoeren zonder akkoord): Daimy vraagt om een plan om alle daemons veilig/overzichtelijk te managen — voorstel gedaan (zie chat 22-07: register + status-dashboard + secrets centraliseren + kill-switches + audit-log + cloud-redundantie).

## PLANNING-MAIL-DAEMON: PLAATS/REGIO + OPMERKINGEN ZONDER STEMPEL (22 juli ~13:45, feedback Daimy)
- **Plaats (D)**: Gripp-naamzoek op achternaam (alleen-lezen, 1 batch-call/ronde); alleen invullen als álle matches dezelfde plaats hebben — liever leeg dan fout. **Regio (E)**: plaats->regio-mapping opgebouwd uit de bestaande sheetrijen (161 plaatsen). Backfill gedaan: 14 van 22 rijen gevuld; 8 blijven leeg (naam te algemeen: Bosman/Meijer/Rai/Kreuger/Wijsman/van der lans/Sjoerd/vd heijden — meerdere Gripp-klanten in verschillende plaatsen). NB: klantnrs (6018 e.d.) zijn NIET Gripp-customernumber en niet in RP-backlog te vinden; als Daimy zegt waar die nummers vandaan komen kan dekking naar 100%.
- **Opmerkingen (B)**: geen "[22-07 12:46 Claude]"-stempels meer (feedback Daimy); alle bestaande stempels weggepoetst.
- **Besteldatum-check**: G stond overal als echte datum (behalve bewust leeg bij retour/onbekende laadmelding); alleen de weergave wisselde — G/H van onze rijen nu uniform dd-mm zoals de rest van de sheet.

## PLANNING-MAIL-DAEMON: PDF-BIJLAGEN WORDEN GELEZEN (22 juli ~13:00)
- **`scripts/planning-pdf-parse.js`**: leest PDF-bijlagen uit (pdftotext -layout) van Sunmaster (producten, orderdatum, leverdatum uit OB), Toppoint, Unilux (vertrekdatum!), Velux (klantref + afleverdatum), Markiezen Nederland. Daemon verrijkt er nieuwe rijen mee (naam/ordernr/besteld/geleverd/producten in L) — placeholders "zie PDF" zijn verleden tijd waar een leesbare PDF bestaat.
- Alle bestaande rijen zijn ge-backfilled met echte productdata (o.a. Sjoerd 2607506: besteld 19-06, levering 20-08; Velux = vd heijden 5930, levering 29-07; gewijzigde bevestiging 2606004 = 2x 7 Suneye 5000x3000, aantallen wijken af van sheet-regel — controleren).
- **Fixes na eerste uren draaien**: (1) paginering — inbox had >50 ongelezen waardoor nieuwste mails buiten beeld vielen; (2) lockfile `data/planning-mail.lock` — launchd + handmatige run schreven tegelijk dubbele rijen (1409-1411 verwijderd); (3) state/dedupe op InternetMessageId i.p.v. Outlook-Id (zelfde mail kan in beide mailboxen zitten); (4) ronde-dedupe alleen op echt ordernr (2 mails zonder ordernr vielen tegen elkaar weg); (5) poedercoat toegevoegd aan leveranciersfilter.
- Mails zonder bijlage (Markiezen/poedercoater "Bevestiging van bestelling", body-only) blijven "handmatig bekijken"-rijen; body-parsing is een mogelijke vervolgstap.

## PLANNING-MAIL-DAEMON LIVE (22 juli, "blijf die mailbox maar bijwerken")
- **launchd `nl.sonty.planning-mail`** (elke 30 min): `scripts/planning-mail-daemon.js` verwerkt ongelezen mails uit de Inbox van orders@sonty.nl ÉN info@sonty.nl (via joey's OWA-token, alleen-lezen — mails blijven ONGELEZEN) in tab "Claude ai test". Daimy heeft kolom B "Ai opmerking" toegevoegd (alles 1 kolom opgeschoven: C=naam, F=ordernr, G=besteld, H=geleverd op); opmerkingen gaan als tekst in kolom B (celnotities van de eerste batch zijn daarheen verplaatst), aangeraakte rijen worden blauw.
- Herkent: Sunmaster portaal-/order-/gewijzigde bevestigingen (subject), NE-laadmeldingen (aankomstdatum -> H), ROMA-levermeldingen (multi-order), Toppoint/Velux/Unilux-bevestigingen, retourmeldingen; overige leveranciersmail -> "handmatig bekijken"-rij; klantmail wordt overgeslagen. Idempotent (state `data/planning-mail-state.json`, geseed met de 42 al verwerkte mails; H-update alleen als datum anders is). Telegram-melding alleen bij wijzigingen.
- Testrun 11:45 verwerkte direct 3 verse mails (rij 1401-1403). PDF-bijlagen worden nog NIET uitgelezen (productdetails ontbreken dus). Tab 2026 blijft onaangeraakt tot akkoord Daimy.

## PLANNING: TAB "CLAUDE AI TEST" GEVULD (22 juli)
- Opdracht Daimy: alle mails uit de Inbox van orders@sonty.nl (42 ongelezen) verwerken in de nieuwe tab "Claude ai test" (kopie van tab 2026, rijnummers lopen 1-op-1 gelijk); mails op ONGELEZEN laten, elke aangeraakte rij blauw (#CFE2F3) + celnotitie in kolom A wat er gebeurd is.
- Gedaan: 11 bestaande rijen bijgewerkt ("Geleverd op" o.b.v. 22 NE-laadmeldingen Unilux/Toppoint -> 22-07 en ROMA-levermelding -> 23-07; Voorraad 2606004 alleen notitie: gewijzigde bevestiging in PDF) + 18 nieuwe rijen op 1383-1400 (13 Sunmaster-portaalbevestigingen, Toppoint 26084369, Toppoint-laadmelding 82605208 NIET in sheet gevonden, Unilux Adriaans, Velux 1090-5031824825, retour-actiepunt SN82606373). Alles blauw + notitie, geverifieerd via API-teruglezing.
- Beperking: product-/leverdetails van Sunmaster/Toppoint/Unilux/Velux zitten in PDF-bijlagen — niet uitgelezen; staat zo in de notities. Scripts: `scripts/planning-orders-fetch.js` (Inbox ophalen, read-only) + `scripts/planning-orders-verwerk-22-07.js` (eenmalige verwerking, met dubbel-checks tegen dubbele ordernrs).
- Tab 2026 zelf is NIET aangeraakt.

## INFO@ IN DE MAIL-DAEMON (22 juli, opdracht Daimy "zelfde regels als de rest")
- info@sonty.nl is door Daimy aan Trengo gekoppeld: kanaal "info@ mailbox" (id 1364806), ontvangt live mail (geverifieerd 22 juli).
- `email-daemon.js`: kanaalfilter is nu een lijst `KANALEN = ['Aanvragen', 'info@ mailbox']` — verder identieke regels (alleen open tickets van Sunny/niemand, reactietijd 90-120 min, bot-uren, @sonny-notities, Mens nodig-escalatie). Daemon gekickstart, ziet info@-ticket 968111180 en respecteert de reactietijd.
- LET OP voor scripts: het `channel_id`-filter op Trengo's /tickets-lijst werkt NIET (geeft alle kanalen gemixt terug) — altijd client-side filteren op `t.channel.id`/`t.channel.title`.

## QA-VANGNET + BOOKINGS IN HEALTH-CHECK (21 juli)
- **QA-vangnet**: keurt de kwaliteitspoort een antwoord 2x af, dan krijgt de klant voortaan een neutraal wachtbericht ("ik leg dit even bij een collega neer") i.p.v. stilte; de stille overdracht naar Mens nodig blijft. Aanleiding: 3x klant-stilte op 21 juli.
- **Health-check**: cron-health-check.js test nu ook de MS Bookings API (services-call met 30s timeout) — alarm als het refresh-token stuk is.
- **Open punten uit risico-overzicht 21 juli**: capaciteit per specialist (parallel Nanny + zonwering)? wie leest de Bookings-bevestigingsmailbox? feestdagen/uren staan hardcoded; persoonlijke Outlook-agenda's blijven onzichtbaar zonder admin-consent; herinneringsmails bij API-boekingen nog niet geverifieerd.

## SHOWROOMAFSPRAKEN DOOR DE AI (21 juli)
- **Nieuwe tools** `showroom_beschikbaarheid` + `showroom_afspraak_boeken` (tools.js) voor WhatsApp- én mail-daemon: bot vraagt dagvoorkeur, stelt 2-3 vrije tijden voor en boekt ECHT in MS Bookings. Boekingslink alleen nog als klant zelf online wil kiezen.
- **Kalender**: `SontyMontage1@sontymontage.nl` (dé operationele kalender — daar staan ook inmeten/montage), service "Afspraak showroom Frijdastraat" `b3b00294-076c-43b4-858c-76332f08d775`, 45 min. NIET AfspraakshowroomSonty@sonty.nl (vrijwel leeg).
- **Slot-logica**: `scripts/ai-ks/showroom-booking.js` — boekbare dagen DI t/m ZA (Daimy 21 juli: showroom open di-za, inplannen mag op elke open dag; op wo/vr/za voor bezoekers uitsluitend op afspraak — oude wo/vr/za-only regel van 17 juli is hiermee vervangen), uurgrid vanaf 09:30 (laatste start di-vr 15:30, za 14:30), min. 8u vooruit (policy PT8H), capaciteit 1 (slot vervalt als er al een showroomafspraak overlapt). Verzetten/annuleren via wijzigShowroom → tool showroom_afspraak_wijzigen (nieuwe eerst boeken, oude daarna annuleren). Routetip hoort bij elke bevestiging: "Navigatie? Stel in op Frijdastraat 6E, rij het hofje in, eerste rechts, wij zitten op de hoek." Graph `getStaffAvailability` kan NIET met delegated token (403) — daarom zelf berekend uit service-uren minus bestaande afspraken; persoonlijke agenda's van staff zien we dus niet.
- **VOLLEDIGE KLANTDATA (fix 21 juli, feedback Daimy "nu blanco afspraak")**: boek() maakt/zoekt eerst een echte bookingCustomer-klantkaart (vindOfMaakKlant; let op: `phones`-lijst, geen `phone`-veld) en boekt met dat customerId; de notitie gaat naar serviceNotes (team ziet hem bij de afspraak) én de verplichte custom vraag "Telefoonnummer" (questionId 14affa07-0ce8-4ec3-a573-3646acb0dc5d) wordt gevuld. Zonder echte klantkaart maakt Graph een synthetisch customerId en oogt de afspraak blanco in de Bookings-UI. Daimy's testafspraak 29/7 14:30 is geannuleerd + opnieuw geboekt met volledige data.
- **bookings-api.js**: `annuleer()` toegevoegd (POST /cancel, mailt klant) + `serviceId` in afspraken(). Boeken zonder staff-toewijzing; Bookings mailt klant bevestiging + eigenaar (sendConfirmationsToOwner). E2E getest 21 juli: geboekt op echt slot → in agenda geverifieerd → geannuleerd (testmails naar clawtje94@proton.me).
- **Medewerker-toewijzing (21 juli, regels Daimy)**: per soort bezoek — BINNENRAAMDECORATIE (gordijnen/vitrage/jaloezieën/plissé/shutters) ALTIJD Nanny; al het andere eerste vrije van Jorren > Joey > Jaimy (POOLS in showroom-booking.js; tool-param `binnendecoratie` op alle 3 showroom-tools, ook in beschikbaarheid meegewogen). Getest 21 juli: zonwering→Jorren, gordijnen→Nanny. Daimy's testafspraak 29/7 14:30 → Nanny toegewezen (was vóór deze regel).
- **QA-datumfix (21 juli)**: Haiku-QA keurde 2x af met "23 juli ligt in het verleden" (vandaag=21 juli) → klant kreeg stilte. QA-prompt aangescherpt: datums op/na vandaag zijn toekomst, bij datumtwijfel OK, agendatijden niet op beschikbaarheid beoordelen. NB: de blanco showroomafspraak 29/7 09:00-11:00 (Joey) is van 13 juli, niet door de AI gemaakt.
- Beide daemons herstart met de nieuwe tools (nl.sonty.sonny + nl.sonty.email).
- **LIVE VOOR IEDEREEN (Daimy 21 juli ~15:15, "je mag die showroom afspraak inboeken in de daemons zetten whatsapp en mail")**: scripts/ai-ks/.showroom-live staat er → alle klanten kunnen via de bot boeken/verzetten/annuleren (WhatsApp + mail). Weghalen van dat bestand + kickstart = terug naar boekingslink-flow.
- **Capaciteit parallel (Daimy 21 juli)**: afspraken mogen tegelijk zolang de juiste specialist vrij is (pool-check i.p.v. capaciteit-1); een showroomafspraak zonder toegewezen medewerker claimt 1 vrij poollid.
- **Bookings-bevestigingsmail**: klant-reacties daarop komen binnen op info@sontymontage.nl — blijft bij het personeel, AI kijkt daar niet (Daimy 21 juli).

## WHITELIST-VOORRANG + QA-LEERLUS (21 juli)
- **Whitelist-voorrang** (Daimy: "op mij en Joey z'n nummer mag je direct antwoorden"): daemon.js sorteert de wachtrij nu op whitelist eerst, dan verse @sonny-notities, dan de rest. Overige klanten ongewijzigd qua tijden/snelheid (REPLY_DELAY blijft uit, e-mail 90-120 min blijft).
- **QA-leerlus** (Daimy: "leert die QA-poort zich ook te verbeteren?"): agent.js logt elke QA-afkeuring naar data/ai-ks/qa-afkeuringen.jsonl; `qa-leren.js` (launchd nl.sonty.qa-leren, dagelijks 07:45) destilleert met Sonnet terugkerende patronen (≥2x, nog niet gedekt, max 3/dag) tot leerpunten in leerpunten.md (= direct in de system-prompt) + Telegram-melding aan Daimy zodat hij kan schrappen. Drempel: min. 3 afkeuringen/7 dagen.

## ABSOLUTE GRENS SHOWROOM-TOOLS (Daimy 21 juli, "extreem belangrijk")
- De afspraken-tools mogen ALLEEN showroomafspraken plannen/verzetten/annuleren — NOOIT montage/inmeten/vakantie/anders. 3 lagen: (1) boeken kan alleen met het hardcoded showroom-serviceId, (2) wijzigen/annuleren zoekt uitsluitend binnen showroom-service-afspraken, (3) veiligAnnuleren (showroom-booking.js) haalt de afspraak vóór elke annulering vers op bij Bookings en blokkeert als de service niet de showroom-service is (fail-closed). Promptregel: montage/inmeet-verzoeken altijd via escaleren_naar_mens. Getest 21 juli: montage-afspraak → poort blokkeert; showroom → doorlaten.

## CRASH + DAEMON-LES (21 juli)
- Mac mini kernel-panicked 21 juli 10:06 (zone map exhausted, kalloc.1024 20GB — macOS-geheugenlek na 11 dagen uptime). Auto-reboot 10:07. macOS-update staat sinds 14 juli klaar; Daimy wil later installeren+herstarten.
- LES: oude Telegram-berichten ("Mail deamon stoppen", 19 juli) zijn geen actuele opdracht — mail-daemon was bewust weer aan; niet meer stoppen o.b.v. oude inbox-regels (memory feedback_oude_telegram_berichten).

## E-MAIL-KLANTENSERVICE LIVE (19 juli)
- **E-mail-daemon draait permanent**: launchd `nl.sonty.email` (KeepAlive, elke 90s) → `scripts/ai-ks/email-daemon.js`. Verwerkt open Aanvragen-tickets die aan Sunny of aan NIEMAND toegewezen zijn; **team-toegewezen tickets (bv. Mens nodig 431872) blijft hij af** (filter: `user===SONNY || (!user && !team)`). Antwoorden → in-thread + toewijzen aan Sunny (747786) + sluiten; kan-niet → team Mens nodig + label. Toegevoegd aan health-check (`nl.sonty.email`, maxLogAgeH 1) en aan het dagrapport (e-mail logt naar log.jsonl met `email:true`).
- **Kanaal-bewuste offerte-aflevering**: e-mailofferte krijgt de link nu ook echt PER MAIL nagestuurd (daemon `verwerkPendingOffertes`, e-mail-tak); Sunny belooft "per mail" i.p.v. "op WhatsApp" (system-prompt EMAIL-blok + tools kanaal-bewust). `registreerPending` slaat `kanaal` op.
- **@sonny-notities** worden nu ook op e-mailtickets gelezen (email-live geeft ze door als teamNotities).
- **Webflow FIX (belangrijk)**: in-thread antwoorden op webflow ging naar `no-reply@webflow` (contact-swap plakt niet in Trengo) → klant kreeg niets. Nu: lead + concept (schaduwmodus) naar team Mens nodig, mens stuurt zelf. Zie memory [[reference-trengo-webflow-noreply]]. 3 fout-gesloten tickets (Ted Kolman/Roosenberg/Henk Smoor) heropend + naar Mens nodig met waarschuwing.
- **Credits-check**: niet stuk; Mac stond ~2,5 dag uit → 2-uurs-job vuurde niet → health meldde "oud". Gekickstart (groen) + health-drempel 5u→14u.
- **OPEN**: RP-status-ID voor "geen herinnering meer" (opt-out) nog nodig — wacht op 1 anker-klant van Daimy. Dan opt-out afbouwen (status zetten + klant mailen dat uitschrijving verwerkt is).



## EIGEN OFFERTE-SYSTEEM / OVERSTAP VAN REUZENPANDA (16 juli, PR #40, live)

Opdracht Daimy: alles bouwen zodat we binnenkort van RP af kunnen. Stand:
- **Eigen S-nummers** (S26-1001, ...) uit KV-teller, los van RP. Eerste testnummer S26-1001 is gebruikt en verwijderd; reeks loopt door.
- **Offerte-tool**: knop "Nieuwe offerte in eigen systeem (zonder Reuzenpanda)" = geen RP-lead, geen wachttijd; opslaan = eigen store + Sonty-klantlink. Upsert: opnieuw opslaan houdt hetzelfde S-nummer en dezelfde link (geen duplicaten). Eigen offertes heropenen: zoek op S-nummer (verliesloos via offerte.toolLines).
- **Klantflow**: /offerte/[token] (bestond al) toont de offerte, klant tekent online (canvas-krabbel + IP + tijdstip), status → akkoord, automation "akkoord-naar-inmeten" verplaatst hem op het bord. E2E getest op iPhone 12 (16 juli): publiceer → upsert → klantpagina → sign → akkoord. Testlead daarna verwijderd; er is toen 1 Telegram-melding "TEST negeren aub" afgegaan.
- **/admin/offertes**: overzicht eigen offertes (S-nummer, RP-referentie, status, getekend, openen-in-tool).
- **/api/admin/offertes**: GET lijst/zoek (?nummer=, ?since=, ?q=, ?status=) — dit is de adapter waar sheet-sync/automations na de overstap op moeten; POST bulk-import (max 50/batch) die BEWUST via storeLead gaat, NOOIT via createLead (die vuurt Telegram + Klaviyo-events af = potentieel klantmails bij massa-import!).
- **Migratie**: `~/sonty/scripts/migreer-rp-offertes.js`. `--archief` gedraaid: alle 18.218 RP-offertes staan in `~/sonty/data/rp-archief/quotations-{jaar}.jsonl`. Bulk-import BEWUST NIET gedraaid: 3.049 open offertes sinds 1 juni zouden het bord onbruikbaar maken. Strategie = migratie-bij-aanraking: RP-offerte openen in de tool + Sonty-link maken → automatisch eigen S-nummer met rpNummer-referentie (dedupe ingebouwd). Bulk kan later alsnog per periode (--import --sinds=... --live).

**Overschakel-runbook (wat er nog moet vóór RP opgezegd kan):**
1. Team went in de winkel aan "eigen systeem"-knop (parallel draaien, RP blijft vangnet).
2. Verzendcentrum-mails de Sonty-link laten sturen i.p.v. de RP-link (lib/verzendcentrum), testmodus pas uit na akkoord Daimy.
3. Automations omhangen: sheet-sync, WA-opvolging en Gripp-facturatie van RP-API naar GET /api/admin/offertes?since= (velden staan klaar).
4. v4-prijscontrole: draait op RP-documenten; na overstap alleen nog nodig als validatie in de tool zelf (prijzen komen al uit dezelfde engine).
5. Configurator-embed (Reuzenpanda-widget op de site) vervangen door eigen formulier.
6. Laatste bulk-import van dan nog open offertes + RP-abonnement opzeggen (archief staat al veilig).

> **REGEL (Daimy 2026-07-10): dit bestand na ELK afgerond werkblok direct bijwerken** — als zijn pc uitvalt moet de laatste stand er altijd in staan.

**PRIJZEN BOEK-GEVERIFIEERD (14 juli):** alle prijsboeken naast v4/offerte-tool/configurator gelegd. Gefixt (alleen nieuwe offertes): markies-motoren zijn in het boek KAAL, zender nu ingeprijsd (IO 575 / Brel Solar 620 / Somfy Solar 745 excl btw); rolluik-solar +239 → +315 (verplichte handzender, boek p37/38); screens Brel-solar +59 → +135 (boek: incl. handzender); knikarm-minima nu per uitval (SunEye uitval+19, XL +49, SunElite +65, SunBasic +30); configurator-bedieningen gelijkgetrokken. Roma klopte (tabelprijs incl. Smoove-zender). Details: memory prijsboek-verificatie-2026-07. Website live via PR #38/#39; v4 lokaal aangepast (draait vanavond met nieuwe bedragen). LET OP: de v4-regressietest (`scripts/tests/verify-fixes.js` + `baseline.json`) bevat verwachte PRIJZEN — bij een bewuste prijswijziging ook de baseline bijwerken, anders draait run-v4-safe.sh stil de oude versie en krijgt Daimy een Telegram-alert (gebeurde 14 juli; opgelost, 124/124 groen). Follow-up WhatsApp definitief uit de health check (Daimy: gaat nooit meer aan).

> Dit document is het startpunt voor een nieuwe Claude-sessie (welk Anthropic-account dan ook).
> Lees dit eerst, daarna de memory-index. Alle code staat in git (beide repos gepusht).

## ACTIEVE GESPREKKEN — AI beheert 21 klantgesprekken live (16 juli, opdracht Daimy)
Daimy: "handel de 21 open WA-tickets af, daarna weer uit, maar blijf vervolgvragen van die personen beantwoorden, geen Sonny-intro". Gebouwd + uitgevoerd:
- `data/ai-ks/actieve-tickets.json` = door AI beheerde klantgesprekken. Daemon beantwoordt overdag: whitelist (Sonny-persona) + actieve tickets (JAIMY-persona, geen intro, geen kunstvertraging). Nieuwe tickets blijven voor het team.
- Batch `scripts/ai-ks/afhandelen-open-tickets.js` gedraaid 16 juli ~19:15-19:50: 21 tickets, 17 AI-antwoorden live verstuurd (incl. eerste vervolgvragen), 3 stille escalaties naar Telegram (2x Vruchi/Jorren-lead Engels, 1x Gunther mail+10cm-vraag), rest overgeslagen (laatste woord was al aan ons). 1x Trengo-429 (Vruchi) → verwerkt-marker gewist + retry OK. Elk AI-antwoord heeft interne notitie "🤖 AI-KS (actief gesprek)".
- Leerpunt toegevoegd: nooit "neef"/straattaal (Jorren kreeg "He neef!").
- Vervolgvragen-watcher draait (watch 240 min, daarna launchd 5-min). Ochtendrapport telt actieve gesprekken nu mee.

## SONNY PERMANENT + IN DE HEALTH CHECK (17 juli ~08:00, opdracht Daimy: "moet gewoon altijd aanstaan")
- nl.sonty.sonny is nu een PERMANENTE launchd-dienst: `daemon.js --watch 0 --sonny-only` met KeepAlive (crash of reboot = automatisch herstart binnen 15s). GEEN losse nohup-watches meer starten — de dienst draait altijd; herstart na code-wijziging: `launchctl kickstart -k gui/501/nl.sonty.sonny`.
- Health check (2x/dag) bewaakt nu ook: SONNY (log max 1u stil), ochtendrapport, dagrapport, credits-watchdog, Telegram-poller (slimme check: 409 op getUpdates = poller leeft; wachtende berichten = poller dood) en alarmeert als de OUDE sales-bot ooit weer aan zou staan.
- Status opvragen: `node scripts/sonny-status.js` of Daimy vraagt "sonny status". Poller herstart zichzelf nu bij elke fout (exit → KeepAlive).
- Onderhandel-mandaat compleet in prompt: eerst waarde/15%, dan actief tegenbod max 2,5% (totaal 17,5%), bij 5-10 producten alternatief 1x montage gratis of gratis Tahoma, pas daarna escaleren. DOEL: altijd zo min mogelijk korting.
- **Korting-format (Daimy 17 juli ~08:45)**: extra korting NOOIT als losse minregel maar zichtbaar in de kortingsregel zelf. Tool: offerte_aanpassen sonnyKorting {percentage} → groupDiscount wordt bv. "17,5% kortingsaanbod Sonny" (hard gemaximeerd op 17,5; afwijkende bestaande korting zoals voorraad-20% = fout terug + escaleren); of {gratis:'tahoma'|'montage'} (grote orders) → item op €0 met "— gratis (aanbod Sonny)" in de titel + kortingsregel "15% tijdelijke actie + gratis Tahoma/1x gratis montage — Sonny". Montage: goedkoopste montageregel; bij units>1 wordt er 1 afgesplitst. Oude kortingRegel-param bestaat nog in pasOfferteAan maar is uit het toolschema. Joeys offerte 20269902 is 17 juli ~08:52 omgezet naar dit format (17,5%-regel, -211 eruit, nieuw totaal €8.193,07; Joey zag eerder 8.229 in WA en 8.262 in de mail — Daimy beslist of Sonny het kloppende bedrag proactief appt).
- LED-verlichting SunElite overal kiesbaar: AI (vaste post), v4-optieblok, winkel-offerte-tool (accessoire, deployed).

## DAGRAPPORT-CIJFERS + INMEET-NOTITIE IN RP (17 juli ~12:30)
- **Dagrapport (07:45, cron-getekend-rapport.js Deel 2)**: geeft nu harde aantallen via Haiku-classificatie: geholpen / wilden_akkoord / overtuigd (+ details wie&hoe) / afspraken, plus cumulatief totaal in data/ai-ks/conversie-stats.json. Deel 1 (getekende offertes uit RP ACCEPTED-diff) blijft. Dit is het "1x per dag conversie-overzicht" dat Daimy vroeg.
- **Inmeet-notitie in RP (gap gevonden door Daimy)**: inmeet_afspraak_voorstellen verzette wel de RP-status naar "Inmeten inplannen" maar zette de planner-notitie (bv. "pas na 28 juli bellen") ALLEEN in de Trengo-comment, niet in RP. Nu: de tool voegt de notitie TOE aan de RP item-description (append, nooit herbouwen — RP-regel) zodat de planner het ziet. Eveline Bos (item 905dd61a-...) retroactief bijgewerkt.

## PERMANENTE KWALITEITSBORGING — MONTAGE SAMENVOEGEN + ESCALATIE-COMMENT (17 juli ~11:30)
- **Principe (Daimy: "ik ga niet heel de tijd controleren")**: harde regels horen in CODE met regressietest, NIET (alleen) in de AI-prompt. De AI kan een prompt-regel af en toe missen; code niet.
- **Montage samenvoegen**: reorderAndMerge (cron-offerte-controle-v4-combined.js) voegt nu identieke montageregels (zelfde titel + prijs) samen tot 1 regel met opgeteld aantal. Geldt voor de v4-offertecontrole ÉN de AI-offertes (v4-pricing.js evalt dezelfde bron). Getest via beide routes + 124 regressietests groen. Hijmens offerte 20269854 rechtgezet (2x montage screen → 1 regel ×2).
- **Escalatie-comment verwijderen**: als de AI ná een overdracht de klant tóch zelf helpt (antwoord zonder nieuwe escalatie), verwijdert hij zijn eigen achterhaalde "@jorren @tanya ⚠️ De AI kan dit niet afhandelen"-notitie. Route: DELETE /tickets/{id}/messages/{msgId} (getest, 200; andere delete-routes geven 405). Hijmens achterhaalde comment (4307748093) handmatig verwijderd.

## BOT-BEDRIJFSUREN + MERKKENNIS ROMA/TOPPOINT (17 juli ~11:00)
- **Bot-uren ma-zo 08:00-21:00** (CFG.BOT_UREN + CFG.binnenBotUren): binnen dit venster pakt de bot ALLE nieuwe WA-gesprekken op en werkt de hele dag door (nieuweTicketsToegestaan() = binnenBotUren() OR handmatig .nieuwe-tickets-tot-venster). Buiten de uren: alleen lopende AI-gesprekken + whitelist. sonny-status toont "dagritme 08:00-21:00".
- **Roma-advieskennis** (data/prijsboeken/roma-advies.md, in prompt): bot biedt Roma nu actief aan bij kust/zeelucht/veel wind/premium (dubbel gepoedercoat, hogere windklasse, poedercoat vs natlak, garantie 5/7jr). Volledige Roma-extract (828 KB) past niet in prompt → advieslaag gedestilleerd; Roma-prijzen via escalatie (prijs_berekenen kent Roma niet).
- **Toppoint binnen-raamdecoratie** (data/prijsboeken/toppoint-binnen.md, uit website lib/diensten.ts): rolgordijnen/duo/plissé+honingraat/jaloezieën/verticaal/vouwgordijn/bamboe + gordijnen (OpenWave) + binnenshutters. 7jr garantie, EasyClick boorloos, elektrisch/app/stem, kindveilig. Prijzen = maatwerk → showroom/offerte, niet zelf rekenen. Loader in system-prompt pikt het bestand automatisch op.
- **Unilux (horren)**: zat al volledig geladen; bot noemt/gebruikt het nu ook actief als merk.
- **QA + herhaal-fix**: QA-poort laat bevestiging van net-uitgevoerde actie door (blokkeerde LED-bevestiging); na @sonny-notitie mag de bot niet meer herhalen wat hij al zei, alleen NIEUWE info toevoegen.
- **Menselijke reactietijd**: alleen Daimy+Joey (FEEDBACK_PHONES) direct; overige klanten 3-5 min stabiele wachttijd (hash van ticket+tijd).

## OFFERTE-MAIL IN EIGEN HUISSTIJL + HARD VERBOD DOORVERWIJZEN (17 juli ~08:40)
- **Offerte-mail Sonty-stijl**: templates/emails/03-definitieve-offerte.html + `scripts/send-offerte-mail-owa.js` (Playwright/Outlook Web, want SMTP AUTH staat UIT op de tenant — nodemailer-variant send-offerte-mail.js faalt met 535). Verstuurt vanaf joey@sonty.nl (OWA-alias van joey@sontymontage.nl, wachtwoord in scripts/.outlook-joey-pass.txt, gitignored). Compose via deeplink https://outlook.office.com/mail/deeplink/compose (de "Nieuw"-knop kan in de Nieuwsbrieven-app landen). Eerste test naar Joey (20269902, €8.262) verstuurd + visueel gecheckt. OPEN VRAAG bij Daimy: mailen als vaste AI-tool inbouwen? En: offerte toont €8.262 vs €8.229 beloofd in WA (oude minregel-methode; omzetten naar nieuw format aangeboden).
- **HARD VERBOD (Daimy, woedend)**: NOOIT naar een ander bedrijf/partij/extern adres verwijzen zonder zijn expliciete toestemming (bot verwees Rob naar info@service-nodi.nl — patroon kwam uit teams eigen oude Outlook-mails, ≥5x in data/outlook-all-emails.json). Staat nu in system-prompt (# STIJL) + leerpunten. Rob-gesprek (966698111): bericht was al verstuurd, Daimy beslist of we rechtzetten.

## BOOKINGS-KOPPELING (17 juli ~09:05, vraag Daimy "hebben we een api van bookings?")
- Geen officiële Graph-API mogelijk zonder eenmalige app-registratie in M365-beheer (getest: afgevangen tokens geven 401 op graph.microsoft.com). Interne app draait op OWA service.svc + GraphQL-gateway (bookings.cloud.microsoft), niet praktisch te replayen.
- WERKENDE route: `scripts/bookings-afspraken.js [--dagen 30] [--json]` — Playwright-login joey@sontymontage.nl → Bookings → "Afspraak showroom Sonty" → Agenda → Exporteren-knop → BookingsReportingData.tsv parsen. Alleen-lezen, ~1 min. Getest: 3 afspraken incl. klantnaam/mail/tel/medewerker. Booking-mailbox: AfspraakshowroomSonty@sonty.nl.
- OPEN bij Daimy: als agenda-tool aan de bot hangen?
- **ECHTE API GEBOUWD (17 juli ~09:10, "laten we de api ff bouwen")**: `scripts/bookings-api.js` = MS Bookings Graph-API zonder browser. Eigen Azure-app "Sonty AI Bookings" (appId f98569ca-d983-4838-9e02-0a8af70acb44, delegated Bookings-scopes). joey is GEEN admin → app-only kon niet; opgelost met delegated + self-consent (Bookings-perms vereisen geen admin). Auth = ROPC + refresh-token (scripts/.bookings-refresh-token.txt, gitignored). Getest: businesses/afspraken/services/staff werken, boeken kan via boek(). Details + id's in memory reference_sonty_bookings_api. TODO evt: als tool aan de klantenservice-bot hangen.

## VOLLEDIGE BOEKEN IN DE BOT (16 juli ~23:30, eis Daimy: "er mag NIKS meer ontbreken")
Samenvattingen lieten details vallen (bv. LED "(kleur en wit)"). Nu zit de VOLLEDIGE ruwe tekstlaag in de systemprompt: data/prijsboeken/sunmaster-2026-tekst.txt (pdftotext van Downloads/"Sunmaster 2026 goed.pdf"), data/prijsboeken/unilux-2026-tekst.txt (adviesprijslijst) en docs/roma-prijsstructuur-2025.md. Prompt nu ~123k tokens (1h-cache; ±$0,19/antwoord aan reads). Regels: producttotalen ALTIJD via prijs_berekenen (tabellen in ruwe tekst zijn rommelig); details/opties/doeken uit de boektekst; Roma apart systeem. Detailtest OK (LED kleur+wit, Starlight Blue 80% petflessen). Kwaliteitspoort (QA-check elke uitgaande tekst, Haiku) + Trengo-429-retry + claim-early dedupe + datumbesef zitten er ook in sinds vanavond.

## TRENGO-TOKENS (16 juli ~21:15, LET OP)
Daimys persoonlijke Trengo-token werd 401 (ongeldig; kopie in scripts/.trengo-api-token-daimy-ongeldig.txt). Alle scripts draaien nu op het SONNY-token (user 747786): scripts/.trengo-api-token.txt = kopie van scripts/ai-ks/.trengo-sonny-token.txt. Gevolg: ook v4's offerte-link-WhatsApps en overige Trengo-acties staan op naam van Sonny Sonty. Wil Daimy team-scripts weer onder eigen naam → nieuwe token van zijn account aanleveren en in scripts/.trengo-api-token.txt zetten. Telegram-intake: webhook was weggevallen; berichten komen via launchd nl.sonty.telegram-poll in telegram-inbox.txt; read-telegram-webhook.js toont nu ALTIJD de laatste 3 regels (leespositie werd door meerdere processen gedeeld waardoor een bericht stil verdween).

## WERKMODUS KLANTENSERVICE (besluit Daimy 16 juli, avond)
- **Toewijzingsregel (bevestigd door Daimy 16 juli ~23:45)**: de bot behandelt ALLEEN onbehandelde tickets (status OPEN) in de WhatsApp-inbox. Aan een mens toegewezen of gesloten tickets blijven van hem af. Wil het team dat de bot een gesprek (weer) oppakt: toewijzing eraf / terug op OPEN, binnen 30s opgepakt.
Doorgaan op de huidige manier: AI antwoordt als JAIMY, géén Sonny-vermelding of intro richting klanten. Sonny-avonddienst (.sonny-enabled) blijft UIT tot Daimy anders zegt. Daimy leest elke ochtend alle antwoorden terug en geeft per chat/notitie feedback; die wordt via leerpunten verwerkt. Ochtendrapport 08:30 dekt actieve gesprekken + kosten.

## @sonny-NOTITIES & TERUGKOMERS (16 juli, werkwijze Daimy)
- **NOTITIE-VOORRANG (17 juli ~08:20, eis Daimy: "notities zien als nieuwe berichten, gelijk reactie")**: pollRonde haalt berichten van alle kandidaten in één pre-pass op (t._msgs, hergebruikt door verwerkTicket), zet gesprekken met een verse @sonny-notitie VOORAAN, en verwerkt 3 tickets parallel (claim-early + merge-on-save maken dat veilig). Actief-sweep elke 2 min (was 5). Verwachte reactietijd op een notitie: 1-3 min. Notitie-commando-herkenning op INHOUD, niet auteur: /@sonny(?!\d)/ zonder ✅ — nodig omdat Claude opdrachten via het Sonny-token injecteert (auteur-filter blokkeerde die op 17 juli, waardoor Joeys tegenbod bleef liggen; tegenbod ~€8.229 is alsnog verstuurd).
- **@sonny-notities in Trengo-gesprekken** (alleen AI-beheerde tickets + whitelist; sweep elke 2 min): STOP-woorden ("niet verder"/"stop met dit gesprek"/"neem over") = gesprek uit AI-beheer; al het andere = ALTIJD leerpunt (vaste kennis) ÉN de bot beoordeelt ZELF of het lopende gesprek nog een klant-bericht vraagt (agent antwoordt GEEN_BERICHT als niet nodig/verwarrend). Altijd ✅-notitie terug met terug-tag van de auteur (tagVoor: @{voornaam}{userId} via /users API). LET OP: los "stop" is GEEN stopwoord (stopcontact-valkuil).
- **Terugkomers**: klant belooft terug te komen (TERUGKOM_PATROON) → na ~22u stilte één vriendelijke reminder (tekst Daimy: "kleine reminder vanaf mijn kant..."), nog binnen het 24u-venster; klant al gereageerd = vervalt; venster gemist = Telegram "bellen is enige route". State: data/ai-ks/terugkomers.json. Dit is BEWUST géén bulk-reminderdaemon (die blijven uit).
- **Trengo-notities plaatsen**: POST /tickets/{id}/notes bestaat NIET (405); enige werkende vorm = POST /tickets/{id}/messages met {internal_note:true, message:...} (plaatsNotitie). Mentions: "@daimy736327"-formaat werkt en geeft echte melding.
- **Sonny-account LIVE (16 juli ~20:30)**: alle AI-antwoorden en notities gaan nu vanuit Trengo-user "Sonny Sonty" (id 747786, clawtje94@proton.me). Token staat in scripts/ai-ks/.trengo-sonny-token.txt (daemon pakt hem automatisch; fallback = Daimys token). Login Sonny-webaccount: clawtje94@proton.me / zie Daimy. Geverifieerd: notities krijgen user_id 747786.

## SONNY — WhatsApp-AI buiten openingstijden (16 juli, gebouwd, WACHT OP AAN-KNOP)
Opdracht Daimy: buiten openingstijden reageert de AI live op ALLE WhatsApp-klanten, stelt zich eerlijk voor als digitale medewerker "Sonny" en helpt VOLLEDIG (ook offertes aanmaken/aanpassen, "dat gaan we juist checken"). Gebouwd in `scripts/ai-ks/`:
- Openingstijden di-vr 9:30-17:00, za 9:30-16:00, ma+zo dicht (config.OPENINGSTIJDEN, tz-vast Europe/Amsterdam); daarbuiten is Sonny actief.
- Vaste intro (config.SONNY.INTRO) wordt door de daemon vóór Sonny's eerste bericht in een gesprek geplakt; prompt-addendum (system-prompt.js sonnyBlok) zorgt dat hij als Sonny ondertekent en niet dubbel groet.
- Reactievertraging 45-180s (menselijk tempo, bundelt snelle vervolgberichten), max 10 NIEUWE gesprekken per dag (lopende maakt hij af), alleen WhatsApp (geen e-mail in testfase). Escalaties (klacht/foto/korting/twijfel) blijven stil naar Telegram gaan.
- launchd `nl.sonty.sonny` (elke 5 min `daemon.js --sonny-only`): buiten openingstijden Sonny voor iedereen (mits aan-knop), **binnen openingstijden whitelist-nummers live** (trainen overdag, opdracht Daimy 16 juli) — geen schaduwnotities in deze modus. Plus `nl.sonty.sonny-rapport` (08:30, ochtendrapport nachtgesprekken naar Telegram).
- **AAN-KNOP (alleen Daimy)**: `scripts/ai-ks/.sonny-enabled` aanmaken met inhoud `JA ECHT`. Uitzetten = bestand weggooien. Status 16 juli ~12:45: nog NIET aan; wacht op Daimy's "JA ECHT SONNY AAN".
- API-tegoed: bijgeladen 16 juli (watchdog bevestigt OK). **Credits-watchdog**: `scripts/check-anthropic-credits.js` (launchd nl.sonty.credits-check, elke 2 uur, mini-ping) → luid Telegram-alarm zodra credits op zijn + herstelmelding; daemon alarmeert óók direct als een klantgesprek stilvalt op credits (dedupe via data/ai-ks/credits-state.json).
- Nog niet end-to-end getest met een echt gesprek (kan pas met tegoed); eerste avond na aanzetten actief monitoren via logs/sonny.log en data/ai-ks/log.jsonl (entries sonny:true).
- **Feedback-kanaal via WhatsApp (16 juli)**: een whitelist-nummer kan in het gesprek zelf `feedback: <uitleg>` appen. De daemon slaat dat op in `data/ai-ks/leerpunten.md` (met datum), bevestigt op WhatsApp + Telegram, en `system-prompt.js` leest dat bestand bij ELKE agent-aanroep vers in als blok "LEERPUNTEN VAN DAIMY" (overrulet andere regels). ALLEEN Daimy + Joey (CFG.FEEDBACK_PHONES: 31683500506, 31628209480; Jarne bewust NIET — Daimy 16 juli) — klanten mogen de bot niet kunnen herprogrammeren. Periodiek consolideren van leerpunten in de hoofdprompt is handwerk voor een Claude-sessie.
- **Prijsboek volledig ingeleerd (16 juli, opdracht Daimy)**: `data/sunmaster-pricing-2026.md` (het geverifieerde boek-extract, zelfde bron als v4) zit nu integraal in de systemprompt met gebruiksregels (boekprijs ×1,10; producttotalen ALTIJD via prijs_berekenen; solar=verplichte handzender; LED alleen SunElite; Roma nooit mengen). Kennistest 16 juli: LED SunElite en verlengde muursteunen exact goed beantwoord incl. juiste beperkingen. Systemprompt nu ~50k tokens.
- **Kosten**: cache-TTL naar 1 uur (reads 0,1×): eerste antwoord van een avond ~$0,38, daarna ~$0,08-0,15 per antwoord. Ochtendrapport toont voortaan max-kosten per nacht. OUDE `nl.sonty.sales-bot` (elke 60s, voorloper AI-KS, logde sinds 12 juli niets maar draaide wel) op 16 juli UITGEZET → plist in ~/Library/LaunchAgents/uitgeschakeld/. NIET heraanzetten: AI-KS/Sonny vervangt hem.
- Garantiebeleid vastgesteld door Daimy (16 juli): 3 jaar montage / 5 jaar product / 7 jaar motor — doorgevoerd in v4-markiezenblok, cron-markiezen.js en trengo-kennisbank.md (zeiden 2/3/5).

## Visualisatie-tool: stand-keuze open/ingerold (16 juli, live)
Klacht Daimy: AI koos zelf de stand (dicht knikarmscherm; rolluiken opgerold zonder product voor de ramen). Fix in ~/sonty-website (commit 824ef4e, branch verzendcentrum, gedeployed):
- Per product (knikarm, screens, rolluiken, uitvalschermen) een expliciete stand-keuze in de UI: "Uitgeklapt/Neergelaten (product zichtbaar)" (standaard) of "Ingerold (alleen cassette/kast)". Pergola en markiezen bewust niet (vaste vorm).
- Stand = {{stand}}-token in de prompt met keiharde MUST-instructies; bij ingerold geen doekkleur-instructie (verleidde model om toch doek te tekenen).
- Responsive gecheckt op iPhone 12 (audit OK, screenshot geverifieerd). LET OP: publieke tool draait op sonty-website.vercel.app; sonty.nl wijst nog NIET naar Vercel (bekende open taak).

## Prijs-steekproef & V4-prijscontrole gefixt (16 juli, commit 404413b)
Daimy kreeg dagenlang Telegram-alerts "prijzen kloppen niet". Uitkomst onderzoek:
- 6 van 10 meldingen (7-16 juli) waren VALS: het steekproef-script had een eigen kopie van de kleurlogica zonder trendkleuren (RAL 9007/7021). Fix: steekproef rekent nu via v4's eigen `correctProductPrice` (dry-run), kan niet meer uit de pas lopen.
- Voorraadschermen (handmatige actieprijs) worden nu ook herkend aan de zin "Direct leverbaar uit voorraad" in de tekst (titel mist soms het woord, bv. #20269669) — v4 corrigeert ze niet meer weg, steekproef slaat ze over.
- Prijsboekfixes van 13/14 juli stonden alleen LOKAAL (nooit gecommit): rolluik solar + verplichte handzender, screen Brel 135, markies-motor incl. zender, Roma duo UIT. Nu gecommit. Offertes van vóór 14 juli zijn dus met oude solar-regel geprijsd (−€83,60, o.a. #20269689, #20269614, #20269631) — Daimy: klanten NIET corrigeren, alleen ons systeem.
- Echte fouten die verstuurd zijn (geen actie richting klant, besluit Daimy 16 juli): Van Mourik #20268691 +€150 te duur, Dimashi #20269689 −€83,60, Dijkhuizen #20269191 −€7,60. Regressietest: 124/124 groen.

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

## Gevel-visualisatietool LIVE (9 juli)
sonty-website.vercel.app/visualisatie (header-nav "Op jouw gevel"): klant uploadt gevelfoto → Gemini 2.5 Flash Image rendert gekozen product (knikarm/screens/rolluiken/markiezen/uitvalschermen) + doek-/framekleur fotorealistisch op de foto (~4ct/render). E-mail-gate → lead type `visualisatie` (Telegram-melding), 12/dag per IP + 400/dag globaal via KV. GEMINI_API_KEY in Vercel prod env (billing door Daimy aangezet 9 juli); echte renders getest op prod. PR #9 ready-for-review (mergen = git en prod gelijk); duplicaat-PR #7 gesloten. Details: memory project_sonty_gevel_visualisatie.md.

## Verzendcentrum LIVE in testmodus (10 juli) — offertes versturen zonder RP-automation
`/admin/verzendcentrum` (sonty-website, branch `verzendcentrum`, 2 commits boven main: 4abea5c + 03ccb30):
- Offertes versturen via Trengo "Aanvragen" (aanvragen@sonty.nl) i.p.v. de RP-automation; enkel- én duo-mail (Roma) met FAQ-blok en Sonty-opmaak.
- **Testmodus staat AAN**: testmails gaan ALTIJD naar joey@sonty.nl + daimy@sonty.nl (afspraak Daimy), nooit naar het adres van de test-lead; echte klanten kunnen in testmodus niet gemaild worden.
- Dashboard-statistiekenbalk: wachtrij, vandaag/totaal verstuurd, herinneringen vandaag, laatste cron-run (OK/fouten), foutenlog (laatste 25 in KV).
- Herinneringscron `/api/cron/offerte-herinneringen` (Vercel cron, dagelijks 08:00) — staat standaard UIT via settings.herinneringenAan en respecteert testmodus.
- **WhatsApp-knop in alle mails voorgevuld** (wens Daimy 10 juli): wa.me-link met offertenummer(s), naam en adres voor-ingevuld zodat het team direct ziet wie er appt (`lib/verzendcentrum/mail-templates.ts` waLink, ook in de herinneringscron).
- **504-fix (10 juli)**: RP backlog-endpoint geeft ALTIJD alle 16,9k items (30-55s, geen filter-params — getest) → route maxDuration 300 + RP-calls parallel (16 workers) + KV-cache (TTL 6u): cache wordt direct geserveerd en bij >3 min oud NA de response ververst via `after()` + KV-lock; `?vers=1` = synchroon vers. Prod-getest: vers ~48s, cache-hit ~1s, 358 items. Bedragen altijd 2 decimalen. Branch bevat nu ook main (gemerged) — deployen vanaf deze branch is veilig; staat live op prod.
- LET OP: op 10 juli draaiden er twee Claude-sessies tegelijk in sonty-website (overschreven elkaars bestanden — bron van "er gaat steeds wat mis"). Vraag aan Daimy gesteld om er één te sluiten.
- Volgende stap: Daimy laten testen op prod, daarna testmodus uit + branch mergen.

## Visualisatie app-look + mobiel menu LIVE (11 juli)
Branch `feature/visualisatie-mobiel` (worktree .claude/worktrees/visualisatie-mobiel), prod draait op deze branch (bevat ook verzendcentrum + main):
- App-look visualisatie (10 juli, andere sessie): één foto-knop, swipe, e-mail verplicht. Stond op de branch maar was nooit gedeployed — 11 juli live gezet.
- Stapkaartjes 1-2-3: cijfer naast de tekst (verticaal gecentreerd) i.p.v. erboven — compacter op iPhone (wens Daimy).
- **Mobiel menu herbouwd** (wens Daimy "echt kut"): fullscreen overlay met eigen logo+sluitknop, groepen Aanbod/Sonty (secundaire links in 2 kolommen), CTA + bel/WhatsApp-knoppen onderaan. Alles past op één iPhone-scherm zonder scrollen. LES: banner (.top-bar-wrapper---brix) heeft z-index 9999 en header zit in eigen stacking context — fullscreen menu werkt alleen als banner+contactbalk verborgen worden zolang het menu open is (mobileOpen-state). Desktop onaangetast (visueel geverifieerd).
- Deploy-werkwijze: committen in de worktree, dan in hoofdcheckout `git switch --detach <commit>` → vercel build+deploy → terug naar verzendcentrum (worktree heeft geen node_modules).

## Maandacties LIVE (11 juli) + CTA's naar configurator
Branch `feature/visualisatie-mobiel`, live op prod:
- **Alle prijsindicatie-knoppen → /configurator** (wens Daimy): homepage, contact, blog, diensten, categorie, portfolio, reviews, zonwering/[city], zon/[code], 404, header-CTA, footer, WhatsApp-widget, showcases. Zakelijk + admin blijven bewust op /offerte-aanvragen (zakelijk loopt niet via configurator); GevelVisualisatie-CTA ook (stuurt gekozen producten mee). /offerte-aanvragen-pagina zelf blijft bestaan (SEO/ads).
- **Maandacties** (wens Daimy 11 juli): `lib/acties/maandactie.ts` — kalender met 12 seizoensacties (jan Nieuwjaarsactie ... juli Hoogzomer-actie ... dec Eindejaarsactie), ALLE op 15% default (= bestaande actie, geen prijswijziging). Per maand naam/slogan/pct aanpasbaar via KV `crm:maandacties` (nog geen admin-UI). Verwerkt in: sitebanner (naam+pct+geldig t/m), offerte-tool standaardkorting (groupDiscount-naam bevat geldigheid; voorraadscherm blijft 20%), verzendcentrum-mails (geldigheidszin), share-links/leads geldigTot = einde maand. Regel: <7 dagen tot maandeinde → geldig t/m einde vólgende maand. LET OP: v4-offertes (RP-flow) houden de oude "15% tijdelijke actie" — v4 mag niet meer aangepast worden (regel 9 juli), maandactie leeft in de eigen tool.

## Site-verbeterronde (11 juli, opdracht Daimy) — taak 1-4 LIVE, fact-check loopt
Alles op branch `feature/visualisatie-mobiel`, prod = deze branch:
1. ✅ "Vanaf op aanvraag incl montage"-blokken weg (diensten-hero, pricing-CTA nu "Benieuwd wat dit kost?", badges op keuzekaarten, assortiment-kaarten).
2. ✅ Mobiel compacter: globals.css utility `.m-grid2` (beeldkaart-grids 2 kolommen <640px, .m-card-img 110px, .m-card-pad, .m-mobiel-weg voor detailregels). Toegepast: diensten (producttypes/raamdeco-hub/projectfotos/cross-sell), homepage (portfolio-teaser/productcategorieën), assortiment (productgrid, features mobiel verborgen). Dienstenpagina 17441→15169px op 390px.
3. ✅ Nummers/emoji's links naast tekst: homepage 5-stappen, offerte-aanvragen stappen, visualisatie-fotoknop (📷 inline).
4. ✅ Roma site-breed: zat al in lib/diensten.ts (boek-feiten); toegevoegd aan homepage (A-merken-bullet) + over-ons (merkenalinea met 209 kleuren/5jr fabrieksgarantie). Bron: docs/roma-prijsstructuur-2025.md.
5. ✅ Fact-check AF + LIVE (44 blogs + vaste pagina's + posts.json, ~200 fixes, commit "Fact-check site-breed"): alle prijzen zonder bron → configurator-verwijzing; verzonnen onderzoek (TNO/Wageningen/TU Eindhoven/KNMI), nep-metingen ("200+ Sonty-huizen") en nep-klantcases verwijderd; niet-gevoerde merken weg (Brustor/Becker/Selve/Sunbrella/Verosol; Blend/Brel/Motion blijven — wél gevoerd); kortings-/subsidie-/BTW-claims weg; Sonty-garantiejaren overal verwijderd (alleen Somfy 7jr + Roma-fabrieksgarantie blijven); bron-correcties: TaHoma €195, rolluiken tot 30% winter, screens duurder dan rolluiken, niet-windvast max windkracht 2-3, ZIP max 280cm, levertijd 8-10 wkn, inmeting 30-45 min, hoogwerker €600-650, doekvervanging ±€1.600, oprichter = Daimy Boot (was "Joey Engelen 2014").
   NIEUWE vragen voor Daimy uit de fact-check: (a) onderhoudscontract-tiers (Basis/Comfort/Premium €295-1495/jr) stonden op de site maar bestaan nergens — blog herschreven zonder tiers; echt product van maken? (b) Luxaflex staat op over-ons als raamdecoratie-merk — klopt dat (binnen loopt via Toppoint)? (c) "Somfy Pro Partner"-claim verwijderd — bestaat die certificering? (d) subsidie-blog is nu bewust dun; aparte research-ronde met echte RVO/gemeente-bronnen gewenst?
- Maandactie-bevestigingen Daimy 11 juli: laatste-week-regel (geldig t/m einde volgende maand) akkoord; v4 niet wijzigen tot volledige overgang.

## Volledige mobiele ronde 2 + subsidie-blog (11 juli, na terechte feedback Daimy "geen volledige check gedaan")
3 deliverable-reviewers auditeerden alle 20 pagina's op 390px (screenshots in job-tmp), daarna 4 fixers + eigen werk. LIVE op prod:
- Nummers/pills/iconen overal links naast tekst; 24 verzonnen klantcases (Familie Janssen e.d.) generiek gemaakt; zakelijk-stap3 sticky-knop-bug opgelost (root cause: position sticky binnen kaart); homepage kaarttitels leesbaar (gradient), stats 2x2, maps-iframe → foto; reviews woordgrens-clamp; tabellen sticky eerste kolom + veeg-hint; hub-dubbelsecties ontdubbeld.
- Paginahoogtes 390px vóór→ná: blog 27,9k→9,6k; portfolio 19,6k→6,8k; horren 18,2k→12,6k; markiezen 24,9k→20,0k; knikarm 25,1k→21,9k; home 13,3k→11,9k.
- **Footer mobiel herbouwd (wens Daimy)**: inklapbare <details>-kolommen (server component, geen JS), bel/WhatsApp/route-knoppen, compacte merk-sectie, gecentreerde onderbalk — ~2.700px → ~800px. Desktop pixelgelijk.
- **Oprichter-correctie (Daimy 11 juli)**: Sonty is opgericht door JOEY ENGELEN (2014), Daimy kwam er in 2024 bij — kennisbank zei het verkeerd om en is gecorrigeerd (data/trengo-kennisbank.md), over-ons klopt nu.
- **Subsidie-blog herschreven op echte bronnen** (RVO/Belastingdienst/6 gemeentesites, checkdatum 11-7): GEEN subsidie voor particulieren op zonwering; BTW 21% (9%-claim was fout); zakelijk alleen EIA-code 210400 (met isolerende beglazing, rolluiken uitgesloten). Bronvermelding per sectie in de blog.
- Antwoorden Daimy: onderhoudscontracten "misschien later" (blog blijft zonder pakketten), Luxaflex leveren we wel (blijft op over-ons).

## Herstelronde na feedback Daimy (11 juli avond)
- **Hub-navigatie-bug (oorzaak "kan niet doorklikken")**: fixer had op hub-pagina's mobiel de grote kaarten MÉT links verborgen en de linkloze "Welke variant"-kaarten (oranje linkerrand → leken kapotte knoppen) laten staan. Omgedraaid: link-kaarten compact zichtbaar (m-grid2, details verborgen), linkloze sectie op hub-pagina's mobiel weg.
- **m-grid2 overflow-fix**: kaart-min-content duwde kolommen breder dan het scherm (body 459px op 390px viewport) → `.m-grid2 > * { min-width: 0 }`. Site-breed geverifieerd: body weer 390px.
- **Homepage-kaarttekst onleesbaar**: content stak boven kaart/gradient uit op 2-koloms mobiel → kaarten vierkant, alleen titel+CTA in de gradient (.home-product-card).
- **Deploys geverifieerd**: vercel ls toont alleen eigen geslaagde deploys; "lege beeldvakken" uit audits zijn native lazy-loading (laden wél bij echt scrollen — met stapsgewijze scroll-test bevestigd, 0 kapotte beelden).
- **ROMA als echte producten LIVE**: components/RomaModellen.tsx — donkere merksectie op /diensten/rolluiken (3 kaarten: .XP, .P geëxtrudeerd, .P gerolvormd) en /diensten/screens (zipSCREEN.2), boek-feiten + vanaf-prijzen uit de centrale engine (bv. .XP €1.049 o.b.v. 100×100 incl montage), CTA naar configurator. Foto's: public/images/roma/.

## Planning-dashboard (19 juli, PROTOTYPE LIVE v6, wacht op oordeel Daimy)
UPDATE v6 (19 juli, na keuzevragen aan Daimy — antwoorden: gebruikt op COMPUTER, stoort: bediening onlogisch + rommelig, startbeeld: de hele sheet): sheet is nu hét scherm. Grote proef-banner vervangen door "proef"-chip + voetnoot; uitleg = één legenda-regel; zebra-rijen; echte checkbox-kolom; kleinere subtiele SERVICE/afgeroepen-badges. ALLE acties (inplannen, afroepen, service, afronden, weghalen/terugzetten) zitten nu in een zijpaneel rechts dat opent bij klik op een regel (Esc of overlay-klik sluit) — geen inline uitklappende tabelrijen meer. Zelfde zijpaneel in alle views. Playwright-getest, live geverifieerd.
UPDATE v5 (19 juli, wensen Daimy): (a) weghalen mét terugzetten op elke order (override verwijderd, telt niet mee, badge "weggehaald" onder Toon afgerond); (b) leverweek-blokken in-/uitklapbaar (klik op blokkop, "Alles in-/uitklappen", volledig afgeronde blokken standaard dicht, keuze onthouden in localStorage); (c) direct afvinken via checkbox-kolom; (d) AFROEPEN: binnengekomen order naar een gekozen leverweek schuiven (komende 10 donderdagen, badge "afgeroepen") — sluit aan op de echte flow (afroep-model nu, straks weer vaste leverdata op de bon); (e) SERVICE-vlag met voorrang: automatisch herkend op nabestelling/garantie/retour/reparatie/etc (51 hits) + handmatig markeren, sorteert bovenaan in werklijsten; (f) laatste tab + toon-afgerond onthouden. Alles Playwright-getest, live geverifieerd.
UPDATE v4 (19 juli, wens Daimy "afronden en verbergen maar ook opnieuw openen, heel overzichtelijk"): afgeronde orders standaard verborgen in alle views; toggle "Toon afgerond (356)" rechts in de tabbalk; blokkop toont "X afgerond (verborgen)"; klik op afgeronde order → "↩ Opnieuw openen" (valt terug naar ingepland of te plannen, override afgerond:false in localStorage); weekview-kaarten togglen Afronden/Opnieuw openen. Playwright-getest incl. heropen-flow.
UPDATE v3 (19 juli, na feedback "visueel niet lekker + niet alle knoppen doen het"): volledig visueel herontwerp. Eén tabbalk met tellers (KPI-tegels en dubbele knopprij weg — dat was de verwarring), sheet-rijen nu klikbaar met inplan-paneel (montagedatum+team, ook afronden), afgeronde orders bewust niet-klikbaar, "Alles"-kaarten klikbaar, rustig warm-grijs palet met plan-* CSS (geen emoji-knoppen meer), NL-dagnamen in weekview, teamchips met kleurstip. Interactietest via Playwright: alle tabs, inplannen vanuit sheet én lijst, afronden (50 knoppen), teamchip-toggle, zoeken — alles werkend, geen JS-errors.
UPDATE v2 (19 juli, na feedback Daimy "moet direct te snappen zijn voor sheet-gewende planner"): nieuwe standaardview "📄 Zoals de sheet" — exact de sheet-indeling (leverweek-blokken, rode BINNENGEKOMEN-streep, zelfde kolommen/volgorde). Deliverable-reviewer draaide 10 bevindingen op, alle gefixt: terminologie overal "Binnengekomen" (was mix Onderweg/onder de streep), weekview-filter miste 8 orders met geplande datum zonder team (nu getoond met ⚠ geen team), teamkleuren onderscheidbaar (Yudi&Nick teal), vrije tekst in datumkolom niet meer groen, opmerkingen los van teamnaam, veeg-hint mobiel, NL-datumhint, enkelvoud "1 order". Commit(s) op branch claude/planning-dashboard, prod-deploy geverifieerd met screenshots.
Vraag Daimy: planningsheet (Drive) vervangen door dashboard in eigen admin. Gebouwd: **sonty-website.vercel.app/admin/planning** (admin-wachtwoord), branch `claude/planning-dashboard` (op basis van verzendcentrum), commit 0b8c99b. Views: Te plannen (111, urgentie-gesorteerd), Onderweg (197, wachtrij onder de rode lijn), Weekplanning per team (5 teams incl. Frenk en Dennis), Alles/zoeken. Data = snapshot uit de sheet (`data/planning-import.json`, peildatum 19-07, 1160 orders; importscript-logica: scratchpad-sessie). Inplannen/afvinken werkt maar alleen lokaal (localStorage) — sheet blijft leidend. Analyse mailbox orders@sonty.nl (19 juli): ~15 mails/dag; Sunmaster portaalbevestigingen (klantnr in onderwerp), NE DistriService laadmeldingen (exacte leverdatum in tekst), Toppoint/Unilux/Roma/Markiezen/poedercoater bevestigingen. Klantnummer = koppel-sleutel. Vervolg (na akkoord): mail-watcher die intake automatisch vult + opslaan server-side i.p.v. localStorage.

## Trengo ↔ Outlook sync stuk (21 juli, DIAGNOSE klaar, fix morgen met Nanny)
Daimy klaagt: mail staat "dubbel" in Inbox én Trengo open. Geverifieerd: geen echte dubbelen (0 overlap op message-ID). Trengo maakt nog direct tickets aan (zelfde minuut), maar de Outlook-opruiming is stuk: orders@ sinds zo 20-07 06:14Z niks meer naar map "Trengo open" verplaatst (alles blijft in Inbox), info@ half (deel gaat wel, 29 blijven hangen), Trengo assigned/closed overal leeg (status-sync dood). Oorzaak: Microsoft 365-koppeling per Trengo-kanaal (autorisatie waarschijnlijk verlopen); emailSettings via API leeg, fix zit in Trengo-beheer UI: per kanaal (Orders 1364889, info@ 1364806) Microsoft-koppeling opnieuw verbinden. Trengo API-token: scripts/.trengo-api-token.txt. NIETS aangepast, wacht op Daimy (vanavond met beheerlogin of morgen met Nanny).

## Trengo open → planningssheet (21 juli, GEPAUZEERD op verzoek Daimy)
Opdracht Daimy: ongelezen mails uit map "Trengo open" (orders@sonty.nl, via joey@-OWA-login) als orderregels onderaan tab 2026 van de échte Planning-sheet (Drive, ID `1xkQaLKgAgvhP46JtZWRRj2zWpqr5_J5z9xTiiqT9lvs`, tabs 2023-2026 + Afgerond 2026 + Voorraad schermen), vanaf rij 1377, exact bestaande opmaak (A checkbox FALSE, B naam+klantnr, E ordernr, F besteld, G geleverd op, K wat besteld, L formule met rij-offset +1060 → H{rij+1060}).
Analyse 14 ongelezen (20-07): 3 nieuwe orders → van der Tak 5401 (FAKRO26012480), de Groot 5919 (ABZ D26-001239A), Dijk 5442 (Sunmaster 2607947, spoed week 32, "op de lijst in de mail zetten"); 3 al in sheet (Vlught 8644843=rij 1373, Dijkhuizen 8644832=rij 1371, Zwieten 5985=rij 1369); 8 geen order: leverdatum-wijziging Oldenburger (rij 1334, nieuwe datum in pdf), antwoord Sunmaster Dijk, ANNULERING Rangelova-nabestelling (rij 1352 vervalt!), retour Toppoint (NE, afhaaldag bevestigen), Roma retourbon Kreukniet, 2x afleverbon (levering 22-07), Unilux nieuwsbrief.
Status: service-account (sonty-automation@vital-pillar-498815-e5.iam.gserviceaccount.com) door Daimy als bewerker toegevoegd. NIETS geschreven, mails NIET op gelezen gezet — Daimy: Nanny (planning) trekt eerst zelf de mail leeg, morgen (22-07) samen kijken of dit automatisch kan. Scripts klaar: `scripts/planning-trengo-fetch.js` (ongelezen mails ophalen) en `scripts/planning-trengo-schrijf.js` (3 rijen schrijven mét lege-rij-check; NIET draaien zonder akkoord — Nanny heeft de sheet mogelijk al gevuld, eerst opnieuw fetchen+vergelijken).
BESLUIT Daimy (21-07 avond): automatisering wordt een POLLER (geen webhook): elke 5-10 min orders@-mailbox lezen, nieuwe orderbevestigingen onderaan tab 2026 in bestaande opmaak, verwerkte mails op gelezen. Bouwen op 22-07 ná overleg met Nanny (zij trekt eerst handmatig de mail leeg). Let op: eerst sheet-stand opnieuw inlezen (Nanny kan rijen 1377+ al gevuld hebben) en dedupe op ordernummer kolom E.

## Openstaand / wacht op Daimy

10. **WhatsApp-template "we hebben gebeld" klopt niet (16 juli, wacht op nieuwe tekst)**: Daimy meldt dat de belscherm-template niet klopt. Huidige tekst Trengo-template "Gemist gesprek verkoper" (ID 239344, gebruikt door `app/api/belscherm/resultaat/route.ts` bij 1e belpoging geen gehoor/voicemail): "Hoi {{1}} 👋 Je spreekt met {{2}} van Sonty. Ik heb je net geprobeerd te bellen voor het maken van een inmeetafspraak, maar kreeg je niet te pakken. Wanneer kan ik je het beste terugbellen?" Probleem: "voor het maken van een inmeetafspraak" klopt meestal niet (1e belpoging gaat over aanvraag/prijsindicatie). Vraag om gewenste tekst staat op Telegram (16 juli ~13u, 6,5u gepolld, geen antwoord). Na antwoord: nieuwe template aanmaken in Trengo (Meta-goedkeuring nodig), daarna `TRENGO_TPL_GEMIST` in `sonty-website/lib/belscherm.ts:47` omzetten. Er bestaat ook "Gemist gesprek inmeten" (239343, zonder bellersnaam).
9. **TO DO: onzekerheden website bevestigen (2026-07-09, lijst op Telegram gestuurd, Daimy komt erop terug)**: garantiejaren (site inconsistent: FAQ 5j+7j, over-ons 5j, offertes 3j montage), "12 jaar ervaring", 15%-kortingsbalk (geldig? einddatum?), vacature monteur salaris 2800-3600, openingstijden di-vr 9:30-17/za 9:30-16, "reactie binnen 24 uur", FAQ-antwoorden zonder bron, blogpost-prijzen (AI-onderzoek), portfolio echte fotos?, zakelijk-sectorpaginas onbevestigd, dubbele privacy-paginas (/privacy-beleid + /privacyverklaring), BTW-nummer ontbreekt, levertijden-pagina verwijderd door andere sessie (bevestigen dat dat klopte).
0. **WA verkeerde offerte-link (6 juli)**: 13 klanten kregen de Roma duo-link i.p.v. hun hoofdofferte (WA-cron pakte nieuwste SENT offerte; duo-batch van 09:32 was nieuwer). Bug gefixt (duo-docIds uitgesloten, commit dc2fdc0). Lijst: `data/wa-verkeerde-link-2026-07-06.json`. GEEN nieuwe WhatsApp sturen (expliciete opdracht Daimy). Voorstel dat openstaat: inhoud van die 13 Roma-documenten vervangen door de hoofdofferte zodat de al-gedeelde link de juiste offerte toont — wacht op ja/nee.
0b. **Roma duo solar-bug (6 juli)**: duo-script pakte altijd de bedrade .XP/zipSCREEN-matrix, ook bij solar-hoofdoffertes. Script gefixt én alle bestaande duo-documenten herberekend met `herbereken-roma-duos.js` (69 in-place bijgewerkt, akkoord Daimy). 3 skips: zipscreens 4267-5000mm breed — Roma solar-zipscreen gaat maar tot 4000mm, daar blijft de bedrade duo-variant staan (Gerrit Boogaardt, Ertugrul Selat, marthijn middelkoop).
0c. **Duo-offerte automatische mail (vraag Daimy 6 juli)**: verzendkanaal = Trengo "Aanvragen" (aanvragen@sonty.nl, kanaal 1363384). Module klaar: `scripts/duo-mail.js` (contact → ticket → mail → ticket sluiten; `--test` stuurt naar daimy@sonty.nl, getest OK). Nog NIET gekoppeld aan v4. Wacht op Daimy: akkoord op de maildtekst (testmail in zijn inbox) + scope: alleen nieuwe duo's of ook inhaalslag bestaande duo-klanten (die inhaalslag zou meteen de 13 verkeerde-link-klanten van punt 0 hun hoofdofferte geven).
0d. **DUO-AANMAAK UITGEZET + inhaalslag gedaan (13 juli, opdracht Daimy)**: live-check wees uit dat bij 73 klanten alléén de Roma-duo op SENT stond en de Sunmaster-hoofdofferte op DRAFT (klant kreeg dus nooit zijn Sunmaster-offerte; lijst: `data/duo-verzendstatus-2026-07-13.json`). (a) Inhaalslag: `scripts/inhaal-sunmaster-mail.js` mailt die klanten beide offertes naast elkaar via Trengo Aanvragen en zet de Sunmaster daarna op SENT; log in `data/inhaal-sunmaster-log.json`. API-valkuil: status wijzigen vereist ZOWEL quotationStatus ALS documentStatus in de PUT (alleen quotationStatus wordt stil genegeerd); de 35 gemailde offertes zijn achteraf alsnog op SENT gezet en per stuk geverifieerd. STAND: 35 van 72 gemaild, toen door Daimy GESTOPT met nieuwe harde regel: nooit meer klantcontact zonder eerst voorbeeld + expliciet akkoord (zie memory nooit-klantcontact-zonder-akkoord). De overige 37 wachten op zijn akkoord; script is idempotent (log-dedupe), gewoon opnieuw met --live draaien na akkoord. Rina Wenig overgeslagen (had de Roma-duo 20269183 al GEACCEPTEERD — team moet met haar de Sunmaster-vergelijking nog bespreken). (b) Duo-aanmaak staat UIT via `ROMA_DUO_AAN = false` in `cron-offerte-controle-v4-combined.js` (stap 6). Weer aanzetten mag pas als de verstuurstap gefixt is zodat altijd de hoofdofferte verstuurd wordt.
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

## HANY-ANALYSE + @sonny-TAG FIX + SHOWROOM-AFSPRAAK + 21:00-RAPPORT (17 juli ~15:00)
- **@sonny-notitie met user-id werd genegeerd (ROOT CAUSE)**: mijn anti-loop-filter `/@sonny(?!\d)/` negeerde elke "@sonny" gevolgd door cijfers — dus juist de correcte Trengo-mention "@sonny747786" die Daimy gebruikt. Daardoor kreeg hij geen ✅-reactie (ticket 966969445). Fix: `/@sonny/i` (met of zonder id); anti-loop blijft via ✅-uitsluiting + teamNotities-markerfilter.
- **Hany's echte fout**: bot herhaalde "planning neemt binnen 3 werkdagen contact op" en las niet dat het gesprek al verder was (klant al gebeld/getekend). Promptregel toegevoegd: proces-belofte niet herhalen, meegaan met "planning had je al te pakken".
- **Stijl**: elke "zonnig"-opsmuk ("zonnige zaken" ging fout bij Hany) nu hard verboden in prompt + QA.
- **Pure bevestiging** (duimpje/"ga ik doen"/bedankt zonder vraag) → geen antwoord/escalatie/ruisnotitie meer (gaf bij Hany schaduwmodus-escalaties).
- **Showroom-afspraak**: prompt zegt nu — binnenlopen mag, maar afspraak heeft voorkeur; stuur de Bookings-link om te plannen.
- **Dagrapport**: verplaatst van 07:45 → **21:00** (einde shift, launchd nl.sonty.getekend-rapport). Nieuwe telling: akkoord=inmeten (1 ding), showroom apart, overtuigd als subset. Extra sectie "veelvoorkomende problemen waar klanten hulp bij nodig hadden" (Haiku-thema's + escalaties). Cumulatief in data/ai-ks/conversie-stats.json.

## OPVOLGING — SCHADUWWEEK LOOPT (21-28 juli)
- Plan: docs/opvolging-plan.md. Schaduw-daemon `scripts/ai-ks/opvolging-daemon.js` draait 3x per dag om 10:30/14:30/18:30 (launchd nl.sonty.opvolging-schaduw, in health-check) — verstuurt NIETS, logt voorstellen in data/ai-ks/opvolging-voorstellen.jsonl en stuurt Daimy per run het zou-sturen-rapport op Telegram.
- Sinds 22 juli (opdracht Daimy n.a.v. Gino Kos) twee vensters: regulier 3-14 dagen stil (max 15/run) én SNEL/24u: WA-gesprekken 4-24u stil waarvan het WhatsApp 24-uursvenster nog open is (laatste klantbericht < 20u, marge op 24u) — zelfde-dag opvolger zonder betaald template, extra kort bericht, max 10/run nieuwste eerst. State (opvolging-state.json) voorkomt nu dubbele beoordelingen: zelfde ticket max 1 beoordeling per 24u, positief voorstel = 30 dagen rust. LET OP bij go-live: state bevat schaduw-voorstellen (schaduw:true); besluiten of die rustperiode dan gereset moet worden.
- Afspraak Daimy 21 juli: week schaduwdraaien + verbeteren, rond 28 juli SAMEN evalueren; daarna pas beslissen over live (aan-knop .opvolging-live bestaat nog niet). Openstaand onderzoek: hoe komen v4's proactieve offerte-link-WhatsApps door het 24-uursvenster (template of sessie)?

## LINKEDIN PERSOONLIJK (JOEY) — ADMIN-TOOL (21 juli ~14:50)
- Joey's persoonlijke LinkedIn gescraped (publieke view, geen login nodig): 7 echte posts + stijlregels vastgelegd in `~/sonty-website/data/joey-linkedin-scrape-2026-07.json`. Inzicht: persoonlijke posts (sport/gezin/balans) scoren 64-87 reacties, vacature/bedrijf 25-45.
- Nieuwe admin-tool `/admin/linkedin-personal` (tegel "LinkedIn persoonlijk 🚀" op dashboard, zakelijke tegel hernoemd naar "LinkedIn zakelijk"): 16 seed-posts in Joey's stijl (`data/linkedin-personal-seed.json`, generator-aanpak met unicode-bold openers), pijlers persoonlijk/ondernemen/team/groei/vacature, 30-dagen flow 2x/week (di zakelijk, do persoonlijk), foto-picker, autosave. KV-key `sonty:linkedin-personal`, lib `lib/linkedin-personal-posts.ts`, API `/api/admin/linkedin-personal`.
- 6 posts hebben ⚠ [haken]-placeholders (needsRealDetail) — nooit zomaar plaatsen, echt detail eerst.
- Getest: build groen, iPhone 12 geen overflow, live geverifieerd op sonty-website.vercel.app (16 posts laden na login). Gecommit + gepusht (branch claude/planning-dashboard) + prod-deploy.
- Let op: sonty.nl wijst nog steeds naar de oude site (Cloudflare), Next.js-site draait op sonty-website.vercel.app. Domein koppelen blijft openstaand punt.

## WEEKRAPPORT CONVERSIE (21 juli)
- `scripts/weekrapport-conversie.js` — elke maandag 08:15 (launchd nl.sonty.weekrapport, --stuur) naar Daimy's Telegram: nieuwe leads, akkoorden (= Inmeten inplannen/Gripp invullen/Afgerond), conversie %, waarde, per status en per productcategorie (categorie via offerteregels van de lead_configuration), plus referentie zelfde venster vorige maand. Losse runs: --van/--tot. Zie ook scripts/bord-conversie.js (cohorten per maand) en scripts/conversie-rapport.js (digitaal getekend, uit rp-archief).
- Kanttekening in elk rapport: jonge leads converteren nog door; afgeronde items van oude maanden worden van het bord opgeschoond (oude cohorten dus onderteld).

## 2026-07-23 (avond): follow-ups zelfde ticket + klant-moment-plannen
- Follow-up-template (24u dicht, hsm 236108) maakte een LOS ticket: gefixt. daemon.js merget het nieuwe template-ticket nu direct in het originele ticket (POST /tickets/{id}/merge, source_ticket_id). Casus Mark Gaerthé (+31634925602) handmatig samengevoegd; hij reageerde al positief op de follow-up.
- Gedachtestreepjes (—) uit alle uitgaande daemon-teksten (36 stuks, 7 bestanden); verbod ook in de opvolg-prompt.
- NIEUW in opvolging-daemon.js (akkoord Daimy): noemt de klant zelf een moment ("dit weekend") dan haalt de AI terugkomMoment (YYYY-MM-DD) uit het gesprek en wordt de follow-up GEPLAND i.p.v. direct/te vroeg gestuurd. verwerkGeplande() voert ze uit zodra de datum bereikt is (binnen bot-uren): venster open = vrij bericht, dicht = template 236108 + merge in hetzelfde ticket. Fail-safes: klant reageerde intussen / mens / getekend => plan vervalt; max 21 dagen vooruit; max 5 per run.
- --scenario flag = dry-run zonder verzenden en zonder state-writes; --ticket <id> forceert een ticket. Scenario-run gedraaid: Mark wordt maandag 2026-07-27 opgevolgd (vanavond plant de echte run hem automatisch).
- NIEUWE WERKREGEL Daimy: voor nieuw automatisch gedrag altijd eerst scenario-run + rapport, dan pas bouwen/live.
- CORRECTIE (Daimy 23-07 avond): zelfde-dag WA-follow-up na net gestuurde offerte was te snel (+31617682103, 5,5u na offerte). Gefixt: "offerte/prijs vandaag gestuurd" is nu expliciet NIET gepast voor zelfde-dag opvolging (die loopt via de normale opvolging na een paar dagen), SNEL_MIN_STIL_UREN 4 -> 6. Scenario-geverifieerd op het misgegane ticket. LET OP: dag-3 WA-follow-up is nog SCHADUW; vraag bij Daimy uit of die live mag via template+merge (V2 open).
- NACHT 23->24-07: Mark (966941272) werd NIET automatisch ingepland. Twee oorzaken gevonden en gefixt: (1) opvolg-daemon draaide maar 3x/dag (plist StartCalendarInterval), nu echt elk uur (StartInterval 3600); (2) kandidaten-verhongering: 56 snel-kandidaten bij cap 10, geblokkeerde kandidaten kregen geen state en bezetten elke run dezelfde cap-plekken. Fix: state-filter voor de cap + 6u "gecheckt"-cooldown voor geblokkeerden + cap naar 15. Mark staat nu ECHT gepland (state gepland 2026-07-27, geverifieerd). Template-voornaam valt terug op Trengo-contactnaam.

## Voicebot BAS (2026-07-24) — pilot live en zwaar getest
- ElevenLabs Agents (Creator, daimy@sonty.nl): agent "Bas" (agent_1801ky9nc0fef7c91h0kpc0whmx4),
  stem Ido, Claude-brein + kennisbank + live prijs-tool naar sonty-website offerte-API.
  Test-link: https://elevenlabs.io/app/talk-to?agent_id=agent_1801ky9nc0fef7c91h0kpc0whmx4
- Getest: 51 basis (48 goed) + 163 persona (149 goed) tekstgesprekken + 100 echte gesproken
  gesprekken, teruggeluisterd via STT-audio-analyse (81 schoon, 0 echte uitspraakfouten).
- Volledige status en open punten: docs/voicebot-pilot-plan.md. Scripts: scripts/sunny-testbank.js,
  scripts/bas-voicetest-runner.js, scripts/bas-audio-analyse.js.

## 2026-07-28: go-live audit sonty.nl -> Vercel (alles geverifieerd, nog NIETS gefixt)
Volledige A-tot-Z check gedaan op ~/sonty-website. Geen code gewijzigd, alleen vastgesteld.

WERKT AANTOONBAAR: `npm run build` exit 0; 38/38 smoketests desktop en 38/38 mobiel; alle hoofdpagina's 200; admin-API's 401; configurator 11/11 producten groen + flow handmatig doorlopen zonder console-/HTTP-fouten; configurator-backend maakt echte leads in KV met complete prijsregels (8 stuks); securityheaders, robots, sitemap, schema.org, cookiebanner-met-consent aanwezig.

BLOKKERS (geverifieerd, niet beredeneerd):
1. `/api/bellijst` publiek open -> 50 KB echte klantnamen/telefoons/mails. HubSpot-token hardcoded in app/api/bellijst/route.ts:3, lib/belscherm.ts:5, scripts/belscherm-sim.mjs:15. Token roteren.
2. `/api/offerte-tool` GET+POST zonder auth: prijsopbouw, klant-PDF's via ?action=pdf, offertes aanmaken.
3. CRON_SECRET ontbreekt; UA-fallback "vercel-cron" is spoofbaar (getest: 200 vs 401). Winkelmail + offerte-herinneringen sturen echte klantmails.
4. HUBSPOT_TOKEN ontbreekt in prod -> leads komen NIET in HubSpot (createHubSpotContact returnt leeg).
5. KLAVIYO_PRIVATE_KEY ontbreekt -> 0 van 42 leads heeft klaviyoProfileId. Offerte-mail naar klant loopt UITSLUITEND via Klaviyo (shareOfferte -> trackKlaviyoEvent "Offerte Online Verzonden"), dus nooit verstuurd. Tijdlijn schrijft wel `email_triggered` (lib/leads.ts:384) -> admin liegt over verzonden mails bij 12 echte leads.
6. TELEGRAM_BOT_TOKEN/CHAT_ID ontbreken -> geen leadmelding.
7. NEXT_PUBLIC_SITE_URL ontbreekt (lib/leads.ts:468 valt terug op vercel.app) + hardcoded stagingslinks lib/notifications.ts:67,79 en lib/lead-store.ts:272.

TRACKING (grootste blinde vlek): huidige Webflow-site draait op SERVER-SIDE tagging via `sst.sonty.nl/hip7aki0th.html?tg=MLLGCPR` (eigen nginx/PHP, 136.144.178.249, eigen A-record) plus HubSpot-script js-eu1.hs-scripts.com/147970649.js. De nieuwe site laadt geen van beide. Nieuwe site heeft alleen client-side gtag G-S480E56ZQE + Meta pixel 1180729206424422 met ALLEEN PageView: nul conversie-events (geen enkele fbq/gtag-call buiten components/Analytics.tsx), geen Consent Mode v2, geen AW-conversie-ID.

DNS: sonty.nl bij Neostrada, nu A @ 198.202.211.1 + www CNAME cdn.webflow.com (Webflow). Alleen die twee wijzigen. MOETEN BLIJVEN: MX Outlook, SPF, DKIM selector1/2, _dmarc, autodiscover, klaviyo-site-verification, A-record sst.sonty.nl. Er is een wildcard *.sonty.nl -> 185.94.230.197. Keuze nog open: www of apex als hoofdadres (code gaat nu uit van apex).

OVERIG: /diensten/vloeren en /aanvraag-transport (staan in live footer) geven 404 -> redirect nodig; sitemap bevat /diensten/pergola-zonwering die 308 redirect; geen reCAPTCHA en geen rate limit op publieke formulieren (oude site had wel reCAPTCHA); reviews vast op 4.9/597 (GOOGLE_PLACES_API_KEY+PLACE_ID ontbreken) terwijl dat aantal in de AggregateRating staat; hardcoded fallbacks MONTEUR_PIN "2288", BELSCHERM_CODE "sonty2288", FINANCIERING_PASSWORD "Daimy2102!"; footer zegt Sunmaster dealer 2022 t/m 2025; tests/configurator-full-flow.spec.ts faalt op een oud knoplabel (site is goed, test is oud).

LET OP: er komen NU AL echte leads binnen op sonty-website.vercel.app. 24 echte leads sinds april, nieuwste 2026-07-25. Die landen alleen in KV, zonder HubSpot, zonder mail, zonder melding. Dat loopt dus al mis, niet pas na de domeinswitch.

## 2026-07-28: cohortrapport conversie + zaterdagbezetting showroom
- NIEUW `scripts/weekrapport-cohorten.js` + launchd `nl.sonty.cohortrapport` (maandag 08:45, `--stuur` naar de databot). Per ISO-week: offertes eruit en welk deel nu akkoord (Inmeten inplannen / grip invullen / Afgerond), minimaal 4 weken terug, standaard 6, plus lopende en vorige maand. State in `data/weekrapport-cohorten-state.json` zodat elke run de verschuiving t.o.v. vorige week toont. Stand 28-07: wk26 7,0% · wk27 6,1% · wk28 8,7% · wk29 11,3% · wk30 8,2% · juni 7,3% · juli 8,7%.
- BELANGRIJK: RP is GEEN historisch archief. April 2026 staat op 10x Afgerond bij 1.539 leads (0,8%) tegen juni 101 en juli 120; 229 april-items zijn gearchiveerd. Oude akkoorden worden opgeschoond, dus conversie uit RP is alleen bruikbaar voor de laatste ~6-8 weken. Voor echte historie blijft de offerte-sheet (akkoord-blok) de bron; die loopt weken achter omdat hij pas bij de Gripp-administratie gevuld wordt.
- Validatie van de akkoord-status: van de 55 akkoord-leads sinds 16 juli hebben er 43 (78%) een echte inmeet- of montage-afspraak in Bookings. De status is dus echt.
- `scripts/ai-ks/showroom-booking.js`: ZATERDAG-pools toegevoegd (Daimy 28-07). Op zaterdag alleen Joey en Jaimy in de winkel, dus max 2 afspraken tegelijk; Nanny is er niet en binnenraamdecoratie loopt altijd via Nanny, dus die zijn op zaterdag niet meer boekbaar. Geverifieerd op de echte agenda: binnendecoratie geeft 0 zaterdagslots, zonwering nog wel (1 en 8 en 15 augustus).

## 2026-07-30: "vandaag zit vol"-fout showroom-bot gefixt (casus Gary, ticket 970191250)
- Gary (+31622971064, SunEye voorraadscherm) wilde donderdagmiddag langskomen; de bot zei "voor vandaag krijg ik je er niet meer tussen" en schoof hem naar vrijdag. Oorzaak: MIN_VOORUIT_MS (8u aanlooptijd) laat alle slots van vandaag wegvallen, de tool zei er niet bij waarom, en de bot maakte er "vol" van. Op di/do is een afspraak niet eens verplicht (alleen wo/vr/za), dus binnenlopen kon gewoon.
- FIX (akkoord Daimy): (1) `showroom_beschikbaarheid` in tools.js meldt nu expliciet dat vandaag door de 8-uursregel ontbreekt en biedt op di/do de inloop-optie tot sluitingstijd aan (wo/vr/za: escaleren_naar_mens); (2) system-prompt.js regel 76: nooit "vol" zeggen tenzij de tool dat letterlijk meldt. Live getest op donderdag, commit 0e99f1c.
- Tweede fout in dat gesprek (zelf hersteld door de bot na correctie van de klant): 8-10 weken productietijd genoemd bij een VOORRAADscherm; na correctie excuses + 2-3 weken. QA-poort keurde beide concepten vóór verzending af en de bot herschreef ze; de herschrijving loste het "vol"-probleem alleen niet op omdat de kennis over de 8-uursregel ontbrak (nu dus wel in de tool-output).
- Aan Daimy gevraagd of iemand Gary nog appt voor vanmiddag (warme klant, wilde vandaag komen).

## 2026-07-30 (middag): prijsbezwaar-fix (Edwin) + volledige gespreksaudit
- Casus Edwin (+31683665159, ticket 969318231): "Aardig aan de prijs als je het mij vraagt" gelezen als compliment → "leuk dat de prijs je bevalt" + tekenverzoek + 75-euroregel, live verstuurd; klant sindsdien stil. Opvolging las het OOK als positief, QA keurde niets af. FIX commit 87bb4a2: system-prompt 3b (prijsbezwaar-uitdrukkingen herkennen, dan geen tekenvraag/75 euro maar erkennen + waarde + alternatief), QA-check punt 9, opvolgings-prompt. Daimy gevraagd Edwin menselijk op te volgen (prijsgericht).
- Prompt-tegenstrijdigheid gefixt (commit 50158ff): vast antwoord reparatie-elders verwees nog naar service-nodi terwijl het verbod van 17-07 alle doorverwijzingen verbiedt; is 17-07 1x live gebeurd (Rob, 966698111). Verwijzing eruit.
- VOLLEDIGE AUDIT alle AI-gesprekken 3-30 juli (1.487 berichten, 588 tickets, 782 live): rapport naar Daimy via databot. Goed: tools kloppen, escalaties eerlijk (149, claims geverifieerd), korting binnen mandaat (max 17,5%, 7 tickets), zonnig/gedachtestreepjes-correcties houden stand, QA vangt verzonnen context, slotvraag-regel werkt (41%→28% zonder slotvraag). Slecht + status: "vandaag zit vol" 3x (gefixt 30-07), prijsbezwaar (gefixt 30-07), dubbele afspraak Sofie (NOG OPEN: klant-heeft-al-afspraak-check in boekShowroom), QA is nakijker geen rem bij actieve gesprekken (NOG OPEN), 28% zonder slotvraag (voorstel: QA-punt), verzonnen context = grootste QA-categorie (structureel: betere historie meesturen). Prioriteitsvoorstel bij Daimy.

## 2026-07-30 (namiddag): auditfixes 3 en 6 gebouwd, fix 7 wacht op scenario-run
- Commit 76b3448: (1) `boekShowroom` heeft nu een dubbele-afspraak-check op klant-e-mail (casus Sofie); verzettingen via `wijzigShowroom` gaan er bewust langs met `_negeerBestaande`. Live getest zonder te boeken: bestaand adres geweigerd met bestaande tijd in de melding, onbekend adres strandt netjes op de slot-validatie. (2) QA-punt 10 in agent.js: concept in lopend verkoopgesprek zonder afsluitende keuzevraag wordt afgekeurd (uitzonderingen: afscheid, klacht, escalatie, duimpje).
- Fix 7 (QA als rem vóór actie-tools bij actieve gesprekken, i.p.v. nakijker) is een daemon-verbouwing: actie-tools voeren nu uit tijdens de agent-loop, vóór het QA-oordeel. Conform de werkregel "scenario-run eerst" NIET blind gebouwd; volgende stap is een ontwerp + scenario-run op echte historie. Het directe Sofie-risico is intussen afgedekt door de dubbele-afspraak-check.
- Openstaand groter werk: contextkwaliteit (verzonnen context is grootste QA-categorie; betere gespreksgeschiedenis meesturen).

## 2026-07-30 (avond): PRIJSTABELLEN S-42/S-37/ZIPSQUARE WAREN CORRUPT — GEFIXT
- Ontdekt door Daimy: offerte 202610203 hoorde 2.126,40 te zijn, alle systemen zeiden 1.658,80. Oorzaak: de PDF-extractie van 28 juni heeft tabellen deels GETRANSPONEERD ingelezen in data/sunmaster-prices-2026.json.
- Alle 13 tabellen cel-voor-cel naast de boekpagina's (als afbeelding gerenderd) gelegd. Corrupt: rolluikS42 p37 (113/154 cellen te laag, 7 niet-bestaande maten), rolluikS37 p38 (90 cellen; nieuw 118/118 gelijk aan de handgebouwde configurator-tabel van 24-07), zipSquare85100 p9 (53 fout, 8 onbestaand, kolommen 360-400 misten). Correct: screenSquare, zipDesign110 (p10+11), suncube150, sunproject100, suncontrol150/165ZIP/pergola, alle 5 knikarm-tabellen.
- Doorgevoerd in ~/sonty (06c5d6b) en sonty-website (51b9876, gedeployed + live geverifieerd: API geeft 2126,40). Regressie-baseline bijgewerkt (de 6 falende tests verwachtten oude foute waarden): 128/128 groen, dus v4 draait vanavond gewoon.
- IMPACT: 903 van 5.120 v4-offertes bevatten een S-42. Van 1.433 S-42-regels met maat bleef 509 gelijk (kleine maten waren goed); mediaan verschil 0, max 363 euro per stuk te laag; opgeteld ~40.150 euro te goedkoop geoffreerd sinds 29 juni. Grote maten (280-400 breed) raakten het hardst. S-37 en ZipSquare kwamen in de praktijk vrijwel niet voor in offertes.
- Openstaand voor Daimy: (1) Easton tekende 1.559 na korting voor Cremewit terwijl RAL 7047 voor 1.841 was bevestigd; (2) beleid voor reeds verstuurde te-goedkope offertes (prijs staat zwart-op-wit bij de klant).

## 2026-07-30 (avond, deel 2): prijsfix openstaande offertes UITGEVOERD + alles-overal-check
- Opdracht Daimy: "in die 288 de prijs goedzetten en meer niet doen". Uitgevoerd met scripts/prijsfix-288.js: 281 SENT-offertes (7 intussen van status veranderd) naar boekprijs, delta-methode, samen +27.772,80. 11 stonden iets te hoog en zijn omlaag gezet (goedzetten = boekprijs). Getekende 38 bewust ongemoeid. Backups in data/prijsfix-288-backups/, log in data/prijsfix-288-log.json, steekproef 5/5 vers uit RP geverifieerd.
- LES: eerste dry-run zonder scope-filter pakte 3.340 documenten (alle SENT S-42 ooit, ook 2025 met ander prijsboek). Scope hard begrensd tot nummers uit de v4-offerte-backups.
- Alles-overal-check prijsdata: v4 ok (128/128), website offerte-tool live ok (2126,40), configurator ok (+ zipscreen h340-rij gefixt, screens-cel 360x220 aangevuld), AI-bot en e-maildaemon HERSTART (draaiende processen hielden de oude tabel in geheugen: nl.sonty.sonny PID 63609, nl.sonty.email PID 63611), voicebot via website-API ok. RP Sonty-test: rolluik-samples ok, screens-artikelen verouderd maar testprofiel = laten staan (Daimy: verder niets doen).

## 2026-07-31: casus Eveline (+31618553742) — keten van fouten + 6 fixes live
- Keten: 17-07 bot zei "in orde gemaakt" bij wat een VOORSTEL was; terugbel-op-28-07 nergens geborgd (Daimy vroeg er die dag al naar); opvolging plande 28-07 wel maar keurde op de dag zelf af met verzonnen "klant bevestigde dat planning contact had opgenomen"; klant boekte zelf (terecht, winkelbezoek naast inmeet is normaal - correctie Daimy) een showroomafspraak voor 31-07 09:30; stond om 09:54 bij het pand, kon het niet vinden, en kreeg GEEN adres/routetip omdat de QA-slotvraag-regel van 30-07 twee behulpzame concepten afkeurde; escalatienotitie beweerde onterecht dat adres al gestuurd was.
- FIXES (commit 74b630f, daemons herstart): (1) klant_opzoeken toont komende showroomafspraak (komendeAfspraak() op mail, vooraan in resultaat wegens 6000-tekens-afkap, live getest op Eveline); (2) klant-staat-ergens = altijd direct adres+routetip; (3) "in orde gemaakt" alleen na DOORGEVOERD/GEBOEKT; (4) nooit eigen tijdsbeloftes ("we bellen je vandaag") - alleen het vaste 3-werkdagen-proces (regel Daimy 31-07); (5) QA-spoeduitzondering op de slotvraag-regel + QA-punt 11 (valse beloftes afkeuren); (6) opvolging: eigen beloftes zijn geen bewijs van contact, bij bereikt terugkommoment zonder klantbevestiging juist opvolgen.
- Menswerk dat blijft: checken of Eveline vanmorgen goed geholpen is + inmeten thuis alsnog inplannen.

## 2026-07-31 (middag): QA-poort gekalibreerd na casus Bianca (+31623078300)
- Bianca gaf 09:33 akkoord (omzetten naar bedraad + inmeten plannen). Bot voerde de omzetting CORRECT door (202610723 staat bedraad in RP, 2.363,85 na korting, tarieven nagerekend en juist) maar QA keurde beide goede antwoorden af op de slotvraag-regel van 30-07; na 2 afkeuringen viel de bot terug op het kale wachtbericht, 2x hetzelfde (09:33 en 11:07). QA verzon bij ronde 2 bovendien een eis ("link zou vernieuwd moeten zijn" - onjuist, zelfde link is correct).
- FIXES (commit na 74b630f, daemons herstart): (1) slotvraag alleen afkeuren als er NERGENS een vraag staat + tweede stijl-afkeuring wordt genegeerd (antwoord gaat gewoon uit); (2) na gelukte actie altijd resultaat+link+vervolgstap delen, fallback zegt eerlijk dat de aanpassing gelukt is; (3) nooit 2x hetzelfde wachtbericht (dan stille escalatie); (4) QA-instructie: geen eigen eisen verzinnen.
- OPEN VOOR TEAM: Bianca wacht sinds 09:33; omgezette offerte + link + tekenvraag sturen en inmeten doorzetten. Checkpunt: ze wil beide rolluiken op 1 afstandsbediening, er zitten nu 2 handzenders in de prijs (~70 euro).

## 2026-07-31 (namiddag): casus Katie (+31617515718) — klacht 3 dagen onbeantwoord, vangnet verscherpt
- Katie van der Klaauw (offerte 20267204, aanbetaling 9 juli): klaagde 28-07 18:26 op WA (geen bevestiging aanbetaling, geen bestelupdate) en bleef 3 dagen onbeantwoord tot Daimy hem 31-07 10:15 zelf oppakte. Oorzaken geverifieerd: (1) de bot-daemon scant per ronde 12 pagina's = 300 recentst-bijgewerkte tickets; haar juni-ticket zakte daar direct uit (getest: valt NU buiten de range) en de bot heeft het ticket nooit gezien (0 log-vermeldingen); (2) de onbeantwoord-wachtlijst zag haar wel (30 en 31-07) maar pas na het sluiten van het WA-venster, als 1 regel in het 2x-daagse verzamelrapport; (3) zij zat 29-06 ook al in de spam-batch. Achterliggend proces-gat: aanbetaling zonder bevestiging/bestelcommunicatie (team/Gripp, geen botfout).
- FIX (commit 06a0f4d): wachtlijst stuurt nu een EIGEN spoed-alarm per WA-klant die 4+ uur wacht zolang het 24u-venster open is (max 5/run, dedupe 12u, KLACHT-kop bij aanbetaling/klacht/niets-gehoord-signalen); cron van 2x naar 7x per dag (08:30-20:00). Dry-run raakt state niet meer.
- OPEN: (a) scan-diepte bot-daemon fixen met scenario-run (oud ticket + nieuw klantbericht mag nooit onzichtbaar zijn; kandidaat: zelfde diepe scan als wachtlijst of intake via wachtlijst-resultaat); (b) proces aanbetalingsbevestiging (team); (c) Katie zelf ligt bij Daimy (ticket toegewezen 10:15).

## 2026-07-31 (eind van de dag): wachtlijst omgebouwd op verzoek Daimy — GEEN alarmen, wel team-toewijzing
- Daimy: "geen spoed-alarmen, heel mijn Telegram is een zooi; tickets moeten gewoon naar het Mens nodig-team". Antwoord op zijn vraag: nee, Katies ticket is bij haar nieuwe bericht NOOIT aan het Mens nodig-team toegewezen; dat deed alleen de bot bij escalatie en die zag het ticket niet, Trengo heropent als kaal OPEN.
- Ombouw (commit na 06a0f4d): spoed-Telegram-alarmen ERUIT; elke wachtlijst-run (7x/dag) wijst wachtende klanten (4+ uur, geen agent, nog niet in team 431872) automatisch toe aan het Mens nodig-team + label 1821764. Verzamelrapport alleen nog in de 08- en 16-uur-run. Eerste echte run: 14 klanten naar het team gezet.
- Nog open: scan-diepte bot-daemon (scenario-run), aanbetalingsproces (team), Katie bij Daimy.

## 2026-07-31 (avond): eerst maten + indicatie, dan pas inmeten (casus Sahadet, +31614692562)
- Sahadet Bakiman (horren Unilux, 2 tuinschuifdeuren + ~10 ramen, Monster, ticket 970530861) vroeg zelf om opmeting aan huis; bot zette het inmeten in gang ZONDER maten te vragen of een prijs te noemen (75-regel noemde hij wel, akkoord was echt). Prompt beschreef de volgorde maar dwong hem niet af bij een directe inmeetvraag.
- FIX (commit db9e0a2, daemons herstart): harde promptregel "eerst globale maten + prijsindicatie, dan pas inmeten, ook als de klant zelf om inmeting vraagt" (uitzondering service/reparatie) + QA-punt 12 dat inmeten-zonder-indicatie afkeurt.
- Sahadet zelf staat al in Inmeten inplannen + escalatie naar team; de planning kan bij het belletje alsnog een indicatie afstemmen (of team stuurt vooraf een indicatie via de offerte-tool).

## 2026-07-31: Bas-testversie op OpenAI Realtime API gebouwd (vergelijking met ElevenLabs)
- Aanleiding Daimy: ChatGPT-voice klonk super goed; dat is OpenAI's speech-to-speech realtime model (geen STT->LLM->TTS-keten zoals ElevenLabs-Bas). Actuele modellen: gpt-realtime-2.1 en -2.1-mini (juli 2026).
- Gebouwd: `voicebot-openai/` — server.js (poort 3131: mint ephemeral key via /v1/realtime/client_secrets, prijs-proxy naar sonty-website offerte-API) + index.html (WebRTC-belpagina met transcript-log, stemkeuze marin/cedar/alloy, tool-afhandeling prijs_berekenen + end_call). Zelfde prompt (data/sunny-prompt.txt) + kennisbank (data/trengo-kennisbank.md) als ElevenLabs-Bas.
- Getest ZONDER key: server start, pagina laadt, prijs-proxy OK (rolluikS42 2000x2000 io = 1416 totaal uit live API). NOG NIET getest: de echte realtime-verbinding — wacht op OpenAI API-key van Daimy (geen key gevonden in memory/.env's). Gevraagd via Telegram 31-07.
- Na key: .env vullen (zie .env.example), `node server.js`, http://localhost:3131, eerst zelf scenario-run (regel) vóór Daimy-oordeel stem/latency.

## 2026-07-31 (vervolg): OpenAI-Bas WERKT — getest en klaar voor Daimys luistertest
- Key + tegoed van Daimy ontvangen (key in voicebot-openai/.env, NIET in git). Tier 1-limiet (40k tokens/min) maakte volledige kennisbank-in-prompt onbruikbaar (~16,7k tokens per antwoord = 2 antwoorden/min). Opgelost met RAG-aanpak: kennisbank_opzoeken-tool (keyword-zoeker over ###-secties, bas-config.js) → nog ~1,8k tokens instructies, hele scenario-run met maar 1 rate-limit-hapering.
- gpt-realtime-2.1-mini AFGEKEURD als brein: verzon "1616 euro" waar de tool 1416 zei. Alleen gpt-realtime-2.1 gebruiken.
- Scenario-run (7 beurten, tekstmodus tegen echt model) GOED: S-42-bevestigingsvraag, prijs 1416→"veertienhonderd twintig" afgerond op tientjes + herhaalregel, garantie 3/5/7, showroom za op afspraak, doekuitleg uit kennisbank, bestaand dossier → doorverwijzen zonder korting, end_call bij afscheid.
- WebRTC-belflow headless getest (Playwright, nepmicrofoon + testvraag via datakanaal): sessie/SDP/datakanaal/audio-transcript/toolcalls allemaal OK; bug gefixt (2 toolcalls in 1 beurt gaf "active response"-fout, nu 1 response.create na alle tooluitkomsten). Screenshot-check gedaan.
- Server DRAAIT (nohup, poort 3131). Daimy testen: http://localhost:3131 → stem kiezen (marin/cedar/alloy) → Bel Bas. Kosten ±€0,30/belminuut totaal.
- Open punten: stem/latency-oordeel Daimy (A/B tegen ElevenLabs-Bas), daarna beslissen over overstap; bij echte uitrol: tier-upgrade of RAG houden, telefonie via SIP, en kennisbank-zoeker evt. slimmer maken.

## 2026-07-31 (later): OpenAI-Bas nu op Vercel — /admin/voicebot (Daimys Mac is remote, localhost ging niet)
- sonty-website: app/admin/voicebot (client, codegate = belscherm-code via localStorage "belscherm-code"), app/api/voicebot/session + /kennisbank (x-bel-code verplicht, 401 zonder), lib/voicebot/config.ts + data.json (kopie sunny-prompt + trengo-kennisbank; bron blijft ~/sonty/data). Prijs-tool via bestaand /api/offerte-tool (same origin). OPENAI_API_KEY staat als Vercel production-env (via CLI).
- BUG ONDERWEG GEVONDEN: site-brede Permissions-Policy blokkeerde microphone → mic-fix: microphone=(self) alleen op /admin/voicebot (next.config.ts). Ook: responsive-audit gaf eerst VALS OK omdat er nog een oude dev-server op 3123 hing (gekilld, herstart, opnieuw geauditeerd: echt OK).
- Live geverifieerd op productie: pagina + codegate OK, session-API mint ephemeral key, kennisbank-API zoekt goed, headless Playwright-beltest verbindt echt ("Verbonden"), screenshots gecheckt. Commits c0a72df + header-fix, deploys success.
- Daimy testen (ook op telefoon): https://sonty-website.vercel.app/admin/voicebot — code sonty2288, stem kiezen, Bel Bas, mic toestaan.

## 2026-07-31 (avond): voicebot-feedback Daimy verwerkt (nam niet op + Engelse stemmen)
- Bas neemt nu ZELF op bij verbinding (response.create bij dc.open + OPNEMEN-instructie); live geverifieerd op productie: "Goedemiddag, je spreekt met Bas van Sonty. Waar kan ik je vandaag mee helpen?"
- Harde TAAL/ACCENT-instructie toegevoegd (uitsluitend Nederlands, native accent). EERLIJKE BEPERKING: OpenAI heeft géén native Nederlandse stemmen (marin/cedar/alloy zijn meertalig, accent kan doorklinken); ElevenLabs heeft wel echte NL-stemmen (Ido). Accent-oordeel = Daimy.
- Zelfde wijzigingen in ~/sonty/voicebot-openai (bas-config.js + index.html) gesynct. Website-commit f34e342, deploy success.
- Vervolg stemmen: alle 10 API-stemmen in het menu (cedar* default, marin, ash, ballad, coral, echo, sage, shimmer, verse, alloy), live geverifieerd na inlog. Uitleg aan Daimy: ChatGPT-voice = zelfde techniek maar eigen stemmenset + eigen taalsturing; cedar/marin zijn de nieuwste API-stemmen en Daimys eerste test was vóór de accent-instructie. Plan B als accent stoort: OpenAI-brein + ElevenLabs NL-stem combineren.

## 2026-07-31: WACHTLIJST-meldingen uitgezet (verzoek Daimy)
- Daimy wil de "⏳ WACHTLIJST"-Telegram-rapporten niet meer ontvangen. launchd nl.sonty.wachtlijst uitgezet (bootout), plist hernoemd naar .disabled. Script blijft bestaan; handmatig: node scripts/ai-ks/onbeantwoord-wachtlijst.js --dry.
- LET OP: dit was het vangnet voor klanten die stilvallen bij toegewezen collega's (aanleiding: Herman van Kaam/Pim, 2 dagen onbeantwoord). Alternatief (bv. 1x per dag kort, of alleen bij WA-venster-verloop) voorgesteld aan Daimy, wacht op antwoord.
- ✅-commitberichten (ander-project keepalive) waren al gestopt per prompt-regel 30-07.
- 31-07 avond: Sunmaster-BESTELportaal (portal.sunmaster.nl, ISP-Vision) ontsloten via zichtbaar CDP-venster (poort 9333, launchd-loze achtergrondtaak, 6u open; Daimy logt in, sessie is memory-only dus venster NIET sluiten). Artikellijst geoogst (18 producten, data/meetinstructies/sunmaster-artikelen.json) + veldstructuur Zipscreen 85-configurator. VOLGENDE: per artikel alle custom-dropdown-OPTIES oogsten (klik-per-veld), zelfde voor Toppoint/Markiezen/ROMA/Velux; daarna Planado-tekstvelden omzetten naar keuzelijsten. NOOIT offerte opslaan/versturen in portalen.
- Sunmaster dropdown-oogst COMPLEET: alle 18 artikelen, opties per veld in data/meetinstructies/sunmaster-dropdowns.json (o.a. 77-88 doekkleuren, 21-24 kapkleuren, geleiders, bediening, montage). Route per Daimy: raadplegen order > Nieuwe order > artikel; script sun-oogster.js (scratchpad) klikt alleen velden + Annuleren, raakt Ok/Opslaan nooit. Ruis: eerste regel per lijst is soms de productnaam, filteren bij omzetten naar Planado-keuzelijsten. VOLGENDE: zelfde oogst Toppoint/Markiezen/ROMA/Velux, daarna Planado-keuzelijsten.
- MEETBON 2.0 KLAAR IN PLANADO (opdracht Daimy): 9 keuzelijsten aangemaakt (Producttype, Montage, Bediening, Bedieningszijde, Elektra, Ondergrond, Bereikbaarheid, Kleur kap/frame RAL 45 stuks, Doekkleur Sunmaster/ROMA 173 stuks) en in het Inmeet-sjabloon 10 oude tekstvelden vervangen door 12 gekoppelde keuzelijst-velden + 2 nieuwe tekstvelden (kleuren overig). Visueel geverifieerd na herladen. Testopdracht "TEST MEETBON 2.0" staat voor Daimy klaar. Sunmaster-oogst: def-bestand na 3 rondes (v3 vult maten in voor afhankelijke velden; 24 velden verbeterd; 68 kleine/afhankelijke lijstjes blijven leeg of 1-optie = deels legitiem, deels bestellers-detail). Lijstenbouwer: scratchpad/planado-lijsten-bouw2.js; ombouw: planado-ombouw.js.
- TOPPOINT-OOGST INGANG GEVONDEN: /authorized/orders/order toont na login (Orders@sonty.nl) productknoppen: Gordijn, Insectenwering, Jaloezie, Outdoor screen (met sub-dropdowns), Plissé/Iso Plissé, Azibi, Versus, Lamel/OpenWave, Rolgordijn, Duorolgordijn, Vouwgordijn, Artikel. Elk opent een eigen configurator = oogstdoel per producttype (zelfde aanpak als sun-oogster: velden + optielijsten dumpen, NOOIT versturen; let op dat Toppoint concept-orders bewaart onder "Niet verzonden orders", dus ook geen concept laten slingeren). Screenshot: data/meetinstructies/toppoint/order-form.png.
- TOPPOINT-MECHANICA gedocumenteerd: productmenu = Kendo/Telerik (span.k-menu-link, submenu's via .dropdown-menu/k-popup); configurator per product = TEGELS (Model/Uitvoering als plaatjes) + maatvelden met min/max-hints; vervolgvelden (stof/kleur/bediening) verschijnen pas na model+maten. LET OP: bij openen productinvoer maakt Toppoint direct een concept-ordernummer aan ("Order nr ... Nieuwe positie 1"); zonder regels wordt dit NIET bewaard (geverifieerd: probe-order 1374210 staat niet bij Niet verzonden orders), maar bij de echte oogst ALTIJD via de Annuleer-knop uitstappen en daarna Niet-verzonden-orders controleren; concepten van het team (1327252 e.a.) NOOIT aanraken. Oogster-basis: scratchpad/toppoint-oogster.js (klik-helper moet naar span.k-menu-link).
- 01-08 MEETBON PER PRODUCT (feedback Daimy: "kies product -> alleen velden van dat product, moet logisch zijn"): GEVERIFIEERD dat Planado GEEN conditionele velden binnen 1 sjabloon kan (rapportveld heeft alleen verplicht+prullenbak, veldtypes Foto/Tekst/JaNee/Keuzelijst/Actie/Barcode/Bestand/Handtekening, geen secties/afhankelijkheid). Oplossing = per producttype een eigen sjabloon. Voorbeeld gebouwd: "Inmeet Rolluik" (sjabloon 1f18d731-a3f6-6190-84cd-2ecba127ce30), 20 rolluik-only velden, 8 gekoppelde keuzelijsten (Type rolluik, Kastuitvoering, Kapmaat, Montage, Bediening, Bedieningszijde, Rolluik kleur x2, Elektra, Ondergrond, Bereikbaarheid). Testopdracht "TEST Inmeet Rolluik" vandaag 12:00. Dataruis gevonden+gefixt: eerste optie per Sunmaster-lijst lekte naburig veld ("60 mm Hoog Met Rubber RS42"), gefilterd. WACHT OP DAIMY: (1) akkoord per-product sjablonen voor alle types? (2) multi-product woning: aparte opdracht per producttype OF breed "Inmeet afspraak"-sjabloon behouden voor gemengd? Rolluik-lijsten-script: scratchpad/planado-rolluik-lijsten.js; sjabloon-bouwer: planado-sjabloon-rolluik.js.

## 2026-08-01: banen confectie uitvalschermen toegevoegd + prijscheck op de rest
- BANEN CONFECTIE (bevestigd Daimy): boekkolom naast de schermprijs (p43 SunCube, p44 SunProject) zat wel in de configurator maar niet in offerte-tool/v4/bot. Toegevoegd als `banenConfectie` per doek in sunmaster-prices-2026.json (beide repos) en opgeteld in lookupPrice (v4 `cron-offerte-controle-v4-combined.js` + website `lib/offerte-tool/pricing.ts`). Bot laadt v4-code in, dus gedekt. SunProject doek 225 uitgezonderd ("doek in banen niet mogelijk i.v.m. oproldiameter"). Onafhankelijk gevalideerd: 126/126 configurator-samples exact gelijk aan scherm+banen ×1,10. Baseline + 8 checks + M1-overrides bijgewerkt, 128/128 groen. Commits 9150e85 (sonty) en 1cb26f3 (website), live geverifieerd: 2380×135 SunCube = 2138,40 + 220 montage = 2358,40.
- CHECK OP DE REST (geen aanpassingen, opdracht Daimy): tabellen/bedieningstoeslagen/rolluik- en serre-kleurpercentages allemaal correct. NIEUW GAT GEVONDEN: kleurmeerprijs-tabellen (Trend/RAL per breedte) ONTBREKEN bij suncube150 (p43), sunproject100 (p44), sunbasic + sunbasicCassette (p25) en sunelite (p31) — daar wordt een afwijkende RAL nu op €0 gerekend. Wel aanwezig bij screenSquare85100, zipSquare85100, zipDesign110, suneye, suneyeXL. Omvang: 417 offerte-backups met een van die 5 producten, 107 daarvan met niet-standaard framekleur; tot ~458 euro per scherm bij SunCube. WACHT OP AKKOORD DAIMY.

## 2026-08-01 (deel 2): kleurmeerprijs uitvalschermen + correctierun openstaande offertes
- KLEURTABELLEN toegevoegd voor suncube150 (p43), sunproject100 (p44), sunelite (p31): meerprijsTrend/meerprijsRAL per breedte ontbraken, afwijkende kleur werd op EUR 0 gerekend. Beide repos, commits 8aac6b6 (sonty) + 1a35b53 (website). CORRECTIE op mijn eerdere melding: SunBasic/SunBasicCassette hebben in het boek GEEN kleurmeerprijs (alleen 2 voorraadkleuren, p25) - dat was een vals alarm van mijn regex.
- CORRECTIERUN `scripts/prijsfix-uitvalscherm.js` (opdracht Daimy: "de send offerte graag aanpassen, de rest zo laten"): 149 SENT-offertes uit 2026 gecorrigeerd voor banen confectie EN kleurmeerprijs, samen +54.365,30 (144 banen-regels, 70 kleur-regels). ACCEPTED/DRAFT/REJECTED ongemoeid. Backups per offerte in data/prijsfix-uitvalscherm-backups/.
- FOUT GEMAAKT EN HERSTELD: 5 offertes uit 2025 (202516185, 202514887, 202514034, 202512105, 202511335) zaten in scope omdat de backup-map ook 2025-nummers bevat; die hebben een ander prijsboek. Teruggedraaid uit backup (-1.505,90) en het scope-filter in het script beperkt nu hard tot nummers die met 2026 beginnen.
- VERIFICATIE: 40 offertes vers uit RP, elke regel rekenkundig tegen het boek: 17 exact gelijk (scherm+banen+bediening), 22 hoger (kleurmeerprijs), 0 onder het boekminimum.
- TWEE OPEN OORDELEN VOOR DAIMY: (1) "Technisch aluminium" (27 offertes, EUR 10.059) reken ik als afwijkende kleur omdat hij niet bij de voorraadkleuren staat - is het een standaardkleur, dan die 27 terugdraaien; (2) structuur-kleuren als "RAL 9010 structuur": v4 ziet ze als trendkleur, het correctiescript als standaard - inconsistent, conservatieve kant gekozen, vaste lijst gewenst?
- CORRECTIE (Daimy 01-08): TNA / "Technisch aluminium" is bij UITVALSCHERMEN de standaardkleur, geen meerprijs. Toegevoegd aan standaardKleuren van suncube150 + sunproject100 in beide repos (v4/bot/offerte-tool zien het nu als standaard), en de uitzondering in prijsfix-uitvalscherm.js aangepast. De 33 regels in 27 openstaande offertes die vanmiddag onterecht de RAL-toeslag kregen zijn teruggedraaid: -10.323,50, alleen het kleurdeel (banen-confectie blijft staan). Alle betrokken regels waren uitvalschermen (28 SunCube, 5 SunProject), geen knikarmschermen. Commits 098feb7 (sonty) + 1ffe10c (website). NETTO EINDSTAND correctierun: 149 offertes, +44.041,80.
- 01-08 vervolg meetbon per product: tweede product-sjabloon gebouwd "Inmeet Screen (zip)" (1f18d9e0-07d0-6630-9313-667cfa38cf30, 20 velden) + 3 nieuwe keuzelijsten (Type zipscreen/screen, Zijgeleiding zipscreen, Aandrijving screen). App-instelling "opdrachten aanmaken vanuit mobiele app" AAN op beide product-sjablonen (geverifieerd via screenshot). ANTWOORD op Daimy's "waar voeg ik extra product toe": geen knop IN de opdracht; extra product = losse opdracht via groene knop "Opdracht toevoegen" -> productkeuze (dropdown toont nu Inmeet Rolluik + Inmeet Screen), of in de app door de inmeter (instelling aan). Screenshot: planado-opdracht-toevoegen-menu.png. Nog te bouwen na akkoord: knikarm/SunEye, uitvalscherm, markies, pergola, hor, binnenzonwering, gordijn, velux. Oud breed "Inmeet afspraak"-sjabloon staat nog (V2-keuze open: behouden voor gemengd of weg).
- SUNEYE XL ALLEEN ELEKTRISCH (Daimy 01-08, boek p28 heeft geen draaistang-minderprijs): geblokkeerd in v4 (calculateCorrectPrice -> null, dekt ook de SunEye->XL maat-fallback), bot-prijstool (duidelijke melding + alternatief) en website-offerte-tool (err met uitleg); regel in system-prompt. Getest: XL+io en SunEye+handbediend blijven werken. 0 bestaande offertes met XL handbediend, dus geen correctierun nodig. 128/128 groen.

## 01-08: MEETBON-KETEN COMPLEET (opdracht Daimy: "hele keten moet kloppen, pas melden als af")
Digitale meetbon op sonty.nl (Planado kan geen conditionele velden; eigen app = producten toevoegen + per product juiste velden):
- ~/sonty-website: lib/meetbon/producten.ts (13 producttypen, velden uit ECHTE bestelformulieren + oogst; conditionele velden via toonAls), lib/meetbon/server.ts (KV, Gripp READ-ONLY offer+company+invoice, Planado-job), app/admin/meetbon (dashboard: inplannen op Gripp-nr + overzicht) en app/admin/meetbon/[gripp] (mobiele meetbon: voorvulling offerte-regels, + Product toevoegen, foto-upload Blob, autosave, afronden pas als compleet, doorgezet=bevroren). Auth: zelfde code als belscherm (sonty2288, header x-meet-code); daemon-routes ADMIN_PASSWORD Bearer. Env-vars GRIPP_API_KEY + PLANADO_TOKEN op Vercel gezet (production).
- KETEN: dashboard /admin/meetbon → "Inmeten inplannen" (Gripp-nr+datum) → Planado-job (Inmeet afspraak-sjabloon, beschrijving bevat meetbon-link, external_id meetbon-<nr>) → inmeter vult meetbon op telefoon → afronden → cron-meetbon-doorzetten.js (elk uur, launchd nl.sonty.meetbon-doorzetten) checkt Gripp-aanbetalingsfactuur ("Aanbetaling...(<nr>)", betaald = totalopen 0 + totalpayed>0) → mail naar orders@sonty.nl + Telegram + status doorgezet. Fail-safes: geen factuur na 14d compleet → 1x Telegram; mailfout → niet markeren + Telegram; Gripp onbereikbaar → fail-closed.
- OWA-token gedeeld: planning-mail-daemon schrijft nu scripts/.owa-token.txt; doorzetter mailt daarmee (/me/sendmail). LET OP: owaSessie faalt af en toe ("geen OWA-token", herstelt meestal zelf volgende run).
- GETEST: Gripp-voorvulling (1004 Liotard: adres/tel/3 regels OK; let op offer.get geeft company kaal → company.get erbij), mobiele UI met 2 producten + missend-teller (screenshots data/meetinstructies/meetbon-ui-*.png), plan-flow → echte Planado-job aangemaakt en verwijderd, doorzet-dry-run (0 complete bonnen). NOG NIET LIVE GETEST: sendmail via OWA-token (token was er nog niet). Bon 1004 staat als demo-concept in KV.
- Planado OPGERUIMD: product-sjablonen Inmeet Rolluik/Screen verwijderd, alle 4 testopdrachten weg, breed Inmeet-sjabloon gestript van 36 meetbon-velden (blijft: begroeten/monsters/offerte besproken/opmerkingen/+30min-checkbox) en beschrijving verwijst naar de app.
- 01-08 vervolg: sonty.nl draait nog op WEBFLOW → alle meetbon-links omgezet naar sonty-website.vercel.app (keten + rapporten). VANGNET toegevoegd in cron-meetbon-doorzetten.js: handmatig in Planado aangemaakte inmeet-afspraken zonder meetbon-link krijgen hem automatisch (detail-fetch per komende job; Gripp-nr uit "Gripp <nr>" of "(nr)" in omschrijving; geen nr = 1x Telegram). E2E getest (link toegevoegd aan testjob, daarna opgeruimd). Leeg testrestant #88 verwijderd.
- 02-08 nacht: het zichtbare Sunmaster-CDP-venster (poort 9333) is na de 24u-timer netjes gesloten. Sunmaster-oogst was al compleet, dus geen verlies. Bij nieuw Sunmaster-portaalwerk: venster opnieuw openen met scratchpad-script sunmaster-cdp-venster.js en Daimy 1x laten inloggen (sessie is memory-only; venster daarna NIET sluiten zolang het werk loopt).

## 2026-08-02: akkoord bleef liggen achter een duimpje (Els Brand, ticket 970642693)
- Els gaf 1 aug 08:05-08:08 akkoord in vier berichten ("Dus zet het sws maar in gang", "Ik zal die voorlopige offerte iig even ondertekenen") en sloot af met ✅. De bot zweeg; haar akkoord is nooit doorgezet naar de planning en het ticket stond ruim een dag zonder team/agent.
- OORZAAK 1 (daemon): `wijVroegenIets` keek naar `slice(-200)` van ons eigen bericht. De vraag stond in het midden met procesuitleg erachter, dus gold het als "wij vroegen niets" -> bevestigings-uitzondering greep. OORZAAK 2 (daemon): de check keek alleen naar het LAATSTE klantbericht, niet naar de vier inhoudelijke ervoor. OORZAAK 3 (wachtlijst): filterde het ticket óók weg als "pure bevestiging", dus het vangnet ving het evenmin.
- FIX: hele bericht scannen op een vraagteken; alleen zwijgen als ALLE onbeantwoorde klantberichten bevestigingen zijn; wachtlijst doet één extra call per bevestigings-ticket om te zien of er meer onbeantwoorde klantberichten staan. Getest: Els komt nu door het vangnet.
- Els doorgezet naar Mens nodig-team + interne notitie met de openstaande actie, haar wens om gebeld te worden, de haast (markies 3 hoog kan niet omhoog) en de extra ramen die ze wil laten adviseren.
- CORRECTIE op mijn eigen conclusie: bij Els was het inmeten WEL al in gang gezet. De echte misser is dat zij na haar akkoord/ondertekening nooit een bedankje kreeg. Promptregel toegevoegd: na akkoord of tekenen ALTIJD eerst warm bedanken ("bedankt voor het tekenen, leuk dat we je mogen helpen"), ook als er verder niets te doen is. LET OP: haar WhatsApp-venster is dicht (27 uur), dus dat bedankje kan alleen nog telefonisch of via template.
- CASUS MEVR. LANGENBERG (hlangenberg03@gmail.com, tickets 970863017 + 970849450): Sunny beantwoordde de website-lead (reparatie hordeur, valt onder service) per mail met de belofte "onze serviceafdeling neemt persoonlijk contact met je op" en sloot daarna het ticket zonder toewijzing. Niemand had het, en gesloten tickets vallen ook buiten de onbeantwoord-wachtlijst. Beide tickets heropend + naar Mens nodig-team + notitie. FIX (commit cdc35e1): in email-live.js wordt een lead-antwoord met een contact-belofte niet meer gesloten maar naar Mens nodig gezet.

## 2026-08-02: ONTWERPFIX — een klantticket gaat alleen dicht als aantoonbaar niets openstaat
- Daimy's vraag: "hoe KAN dit misgaan, iemand met een kapot product hoort gewoon naar Mens nodig". Terecht: ik had drie keer een symptoom gepatcht. Het ontwerp was omgekeerd — sluiten was de default, escaleren de uitzondering, en of het goed ging hing af van welke route de bot toevallig koos.
- GEMETEN: 625 gesloten tickets doorzocht; 11 met service-signaal door de AI gesloten, waarvan 9 Bookings-systeemmails (onschuldig) en 3 ECHTE klanten die stillagen: mevr. Langenberg 970863017 (hordeur uit de rails), Victor-Hugo Scholten 970702399 (rolluik gaat niet omlaag), De Bie 970482921 (screens; kreeg zelfs letterlijk het vangnetbericht "ik leg dit even bij een collega neer" en werd toen gesloten). Alledrie heropend, naar Mens nodig, met notitie + gegevens.
- FIX (commit a017c67): nieuw `scripts/ai-ks/mag-sluiten.js` — één poort voor alle sluit-plekken. Dicht mag alleen als er GEEN service/reparatie/garantie/klacht-signaal in het klantbericht staat, GEEN belofte van contact in ons antwoord, en geen escalatie. Anders: open + Mens nodig + notitie met de reden. Systeemmail (Bookings, eigen adressen, ads-rapporten) valt er bewust buiten via `systeemMail: true`. Ingebouwd in email-live.js (website-lead + gewone mail) en daemon.js (WhatsApp). Getest: de 3 casussen blijven open, een prijsvraag en een bedankje gaan gewoon dicht.

## 2026-08-03: sheet-dedupe las tot rij 2000, schreef tot 3000 -> dubbele rijen in het offerte-register
- Daimy vroeg waarom het v4-bericht "87 aangepast, 8 gerouted" meldt maar "Sheet: 122 rijen". Antwoord: dat zijn twee losse tellingen (verwerkingsstap vs. registerschrijfstap, die 7 dagen terugkijkt over 6 statussen). MAAR 122 bleek een uitschieter door een echte bug.
- BUG: dedupe op offertenummer las `G4:G2000` terwijl de maandtabs 2997 rijen hebben en de schrijfstap `A4:X3000` leest. Alles voorbij rij 2000 was onzichtbaar voor de dedupe en werd elke run opnieuw toegevoegd. Sheet-teller liep op: 23, 28, 31, 29, 38, 23, 30, 44, 50, 46, 60, 122.
- SCHADE: 143 dubbele rijen in Juli 2026, 37 in Juni 2026, 1 in Nov 2025; sommige offertes tot 6x. Dit vervuilt het offerte-register dat als brondata voor conversiecijfers dient.
- FIX: leesbereik naar `G4:G5000`. LET OP: de bestaande dubbele rijen zijn NIET opgeruimd — dat is een aparte actie en raakt brondata, dus alleen op akkoord van Daimy.
- OPGERUIMD (akkoord Daimy 03-08): 214 dubbele rijen in het offerte-register leeggemaakt via `scripts/sheet-dubbelen-opruimen.js --echt` (177 Juli 2026, 37 Juni 2026). Verificatie: 0 duplicaten over, 0 offertenummers verdwenen (2065 voor en na in juli). 5 rijen gespaard met administratie erin: 202610727 (van Boxtel), 202610796 + 202610798 (Horchner), 202610806 (Kampherbeek), 202626858 (Sofyan El Hajjami) — daar staan 2 rijen met verschillend bedrag, Daimy kijkt zelf. LET OP bij hergebruik van dat script: (1) kolomzoeker moet EXACT matchen op 'nummer' anders pakt hij 'Telefoon nummer' en beschermt hij alles (eerste dry-run gaf 937 i.p.v. 214); (2) rijen VERWIJDEREN kan niet, de tabs hebben beveiligde kolommen vanaf AB — daarom A:Y leegmaken, v4 hergebruikt lege rijen vanzelf.
- CONVERSIE METEN, DEFINITIEF (Daimy 03-08): noemer = ALLE rijen met een datum in de maandtab (niet filteren op offertenummer! 101 akkoorden in juni hebben wel een Gripp-nummer en echte inkoop maar geen RP-offertenummer). Teller = rijen met een BEDRAG IN DE INKOOPKOLOM, ook de EUR 1,00-placeholder. Tel per TABBLAD, niet op de datum in de cel (145 juni-datums staan als "2026-06-03 11:49:36"). Cijfers: april 1.581/149 = 9,4% | mei 1.835/131 = 7,1% | juni 1.889/192 = 10,2% | juli 2.102/174 = 8,3% (pas 3 dgn oud) | aug 132/2. Per periode: 1-28 juni 9,4% (36 dgn), 29 juni-15 juli 8,9% (19 dgn), 16-26 juli AI-bot 9,9% (8 dgn!), vanaf 27 juli 3,4% (0 dgn). Harde meetpunten: 14 aug (bot 30 dgn), 26 aug (knop-templates).
- AKKOORD-DEFINITIE (Daimy 03-08, HARD): een offerte telt als akkoord zodra er een BEDRAG IN DE INKOOPKOLOM staat ("inkooop incl btw"), ook als dat de €1,00-placeholder is. NIET het akkoord-blok (T/U/V) gebruiken — dat gaf juli op 0,4% terwijl het 6,8% is. Conversie juni t/m nu met de juiste maatstaf: 1-28 juni 6,5% (36 dgn oud), 29 juni-15 juli 6,4% (19 dgn), 16-26 juli (AI-bot live) 8,2% (8 dgn), vanaf 27 juli 3,2% (0 dgn). Beste week: 12-18 juli met 9,5%, precies de week dat de AI-bot live ging. Kanttekening: bij de inkoop staat geen datum, dus exact op gelijke rijpheid vergelijken kan niet; harde meetpunten zijn 14 augustus (bot, 30 dgn) en 26 augustus (knop-templates).

## 15-08 middag: herhaalberichten + annulering-na-boeking geborgd
- Jan van Wageningen (+31681026324): kreeg 2x exact dezelfde ontvangstbevestiging in 4 min → magBevestigen-cooldown in cron-aanbod-replies.js (max 1 bevestiging per gesprek per 2 uur, alle 4 call-sites bewaakt).
- Ana Franca (anacaroline0204@gmail.com): annuleerde 13-08 per mail, bot beloofde "vandaag terugkomen", niets gebeurde, afspraak do 10 sep 15:20 (Joey, Gripp 6443) staat NOG in Planado/Outlook. Intent 'annuleren' toegevoegd (planning-antwoord.js), naboeking-branch stuurt eerlijk antwoord + alarm + zet op data/annuleringen-open.json; keten-zelfcontrole piept elk uur tot de afspraak weg is en stuurt daarna de klantbevestiging (stil-lijst-poort).
- KS-guard (ai-ks/daemon.js lopendInmeetAanbod): geboekte klanten blokkeren Sunny niet meer, productvragen na boeking krijgen weer echt antwoord.
- Tests: 46 groen (testsamenvatting stond midden in het bestand, nieuwe tests telden niet mee → naar einde verplaatst). Gepusht.
- AFGEROND 15-08 ~14:30 (Daimy: "ja, overal verwijderen"): Ana's afspraak geannuleerd in Bookings (met MS-annuleringsmail), Planado (404 geverifieerd), Outlook (0 events over), administratie status geannuleerd, sheet Aug 2026 r320 inkoop/datum/inmeter leeg. Klant kreeg Nanny-bevestiging via de nieuwe zelfcontrole-flow (bewees zichzelf op het echte geval). Annuleren-branch zet ticket nu ook op Mens nodig (label 1821764 + teamnotitie), op Daimy's vraag.

## 15-08 namiddag: Ganesh/sheet-vervolg
- Ganesh ≠ Bansidhar (r861 teruggedraaid). Ganesh: RP-offertes 202610225/202610224 (22 juli, ACCEPTED, cache-key = zijn lead-config), maar V4 maakte destijds geen sheet-rij. Meting: 117/118 AI-offerte-kaarten sinds 1 juli staan WEL in de sheet; alleen Ganesh + Thomas van Dop (19-07) misten. V4 niet aangepast (regel).
- Ganesh in sheet-wachtrij met echte RP-nummers; Thomas van Dop handmatig als offerte-rij toevoegen zodra rechten open (TODO).
- Ganesh is Engelstalig (mailt Engels met Sunny) maar geboekt bij Joey — VRAAG aan Daimy: omboeken naar Sjoerd? KS-daemon zet nu zelf de Engels-vlag (taal-voorkeur) bij Engelse klantberichten; vlag voor Ganesh handmatig gezet.
- WACHT OP DAIMY: (1) sheet-rechten service-account, (2) Ganesh naar Sjoerd ja/nee.


## 17-08 avond: Sunny-weetjesbot gebouwd (akkoord V16)
- NIEUW `scripts/sunny-weetje.js` + launchd `nl.sonty.sunny-weetje` (ma-vr 20:00): Sunny stuurt dagelijks een weetje in de Sonty toppers-groep. 2 berichten: stoere opener (8 rouleren) + weetje via Haiku (thema rouleert: zonwering/dieren/bier/lichaam/techniek, historie in data/sunny-weetjes.json tegen herhaling en dubbel sturen). Grapverzoeken: DMs aan het Sunny-nummer van de laatste 24u gaan als inspiratie mee (Daimy 17-08), filter: nooit discriminerend/seksueel/politiek/gemeen.
- Eerste weetje staat in de groep (17-08, slijpschijf-weetje; had nog dubbel "WISTEN JULLIE DATTTTT" — gefixt met harde strip).
- VERZENDING `scripts/wa-stuur.jxa.js` + `scripts/bin/wa-type` (gecompileerd, bron wa-type.m): WhatsApp Catalyst accepteert chatwissels alleen frontmost. Achtergrond-AXPress, CGEvent-muisklik naar pid en verborgen vensters bleken allemaal wankel (Catalyst gooit verborgen vensters weg). Dus: idle-wacht (>=3 min geen input, checken tot 22:30, anders overslaan + melding), dan ~1 min overnemen, daarna WhatsApp verbergen + vorige app focus terug. Veiligheid: chatrij-klik + header-verificatie vóór er iets getypt wordt, typen via unicode-CGEvents naar pid (geen klembord), versturen via echte Stuur-knop, teruglezen dat vak leeg is, daarna nog DB-check in sunny-weetje.js.
- wa-type modi: tekst, --enter, --wis (cmd+A+delete), --klik x y, --keycode N [cmd].
- data/sunny-medewerkers.txt (nog niet aangemaakt) = team-weetjes voer voor grappen; Daimy bood aan die te leveren (V17 uitstaand).
- WACHT OP DAIMY: V17 team-weetjes; verzendtest naar +31683500506 draait zodra hij van de computer wegloopt (achtergrondjob b80w4g51b).
- 17-08 later: morning motivation erbij (akkoord Daimy, "wel goed" + tijd 07:30): zelfde script met --ochtend, launchd nl.sonty.sunny-ochtend ma-vr 07:30. Nieuws uit NOS-feeds (algemeen/sport/opmerkelijk), alleen luchtig (nooit politiek/misdaad/leed), anders pure motivatie. Idle-deadline ochtend 09:30. Historie met type-veld. --proef genereert zonder te sturen. Verzendtest naar Daimy geslaagd 21:04. Popup-kwestie: advies = 1x Sta toe op de macOS-popup (smal, alleen WhatsApp-data), GEEN volledige schijftoegang (Daimy vond dat terecht link).

## 18-08 middag: C-reactivering live (opdracht Daimy) + oplevercheck achteraf
- Daimy: 30-dagen-flows mochten aan ("lul niet"). C-flow live gezet; oplevercheck DAARNA gedraaid en een echt gat gevonden: geen uitstap-conditie (akkoord-klant zou C2/C3 nog krijgen). API kan definities niet updaten -> nieuwe flow "Sonty C | Reactivering (met uitstap-conditie)" (UNqirZ) aangemaakt met profile_filter (mag_mail=ja EN fase=koud), live; oude (Sgdw5z) terug naar concept; 0 ontvangers tijdens de wissel (gemeten via flow-values-report).
- GEMETEN OK: segment RNmH4n = mag_mail ja + fase koud + offerte-link aanwezig (5.391 profielen); bepaalFase geeft akkoord voorrang (klant), koud = 60-365 dgn; C1-template: aanhef/offerte-link/unsubscribe aanwezig, geen streepjes/overkapping/prijsstijging/placeholders; smart sending aan.
- NOG OPEN in de flow: C2/C3 zonder open/klik-voorwaarde (iedereen die koud blijft krijgt alle 3), productvarianten-split ontbreekt (C1 basis voor iedereen; varianten zitten WEL in de blok-campagnes), verzendvenster 09:00-20:00 niet via API instelbaar. A-flow bewust UIT (zit bovenop lopende botgesprekken).
- WACHT OP DAIMY: V22 GO voor eerste backlog-blok van 200 (5.391 in koud-segment; flow pakt alleen nieuwe instroom). V20 (nachtvergrendeling Mac voor 07:30-app), V17 (team-weetjes), V19 (Sta toe-popup).
- 18-08 later: Daimy verduidelijkte de 30-dagen-opdracht: ALLEEN mensen die vanaf nu de 30-dagengrens passeren, nooit de 30+/40+ backlog (blok-200-voorstel vervallen). Herbouwd: sync schrijft sonty_offerte_dagen (dagteller), segment UcPfT2 "Sonty | C-start (vandaag 30 dagen)" (mag_mail ja + dagen >29 en <31 + offerte-link), flow RPYzWM "Sonty C | Reactivering op dag 30" LIVE (C1 direct, C2 +7d, C3 +14d, profile_filter mag_mail ja EN fase lopend/koud dus stopt bij akkoord). 60-dagen-versies (Sgdw5z, UNqirZ) op concept, 0 ontvangers ooit. Vandaag 9 personen op dag 30; die zaten al in het segment voor de flow live ging en triggeren dus mogelijk niet (vraag bij Daimy of ze eenmalig alsnog moeten). Eerste automatische lichting: morgen na de 06:30-sync. LET OP: sync moet dagelijks slagen, anders mist een dagcohort (bewuste keuze, venster is exact dag 30).
- 18-08 einde middag: dag-30-cohort VOLLEDIG gemaild en geverifieerd via events (metric Received Email, flow RPYzWM): 36/36 mailbaar kregen C1 (27 automatisch om 11:08 + 9 nagekomen via dagteller-truc), 6 akkoord-klanten door profile_filter overgeslagen, 3 opt-outs niet gemaild; 27+9+6=42 = segment, sluit. LES: Klaviyo-segmentherberekening na property-wijziging duurt 4-6 min; wissel-truc (dagen 28 -> wachten tot ECHT uit segment -> 30) werkt alleen met membership-polling per stap, eerste snelle poging deed niets. Flow-values-report loopt uren achter; aantallen ALTIJD via events API checken. Eindrapport naar Daimy gestuurd. Morgen na 06:30-sync checken of de nieuwe lichting vanzelf loopt.
- 18-08 avond: (1) volledige inhoudscheck 27 Sonty-templates in Klaviyo: 0 fouten (afmeldlink, aanhef, links, reviewlink, garantie 3/5/7, levertijd, geen streepjes/overkapping/prijsstijging/placeholders; Tekenbonus-aanhef via event-data is bewust). (2) Fotokiezer: keuze direct zichtbaar in Bekijk mail-voorbeeld (data-slot-markers in bouw-templates + live swap in iframe, sonty-website 38059bd+copy-commit, deploy geverifieerd op headSha, E2E bewezen met echte keuze zonder opslaan). (3) WAARSCHUWING aan Daimy: fotos via de kiezer, niet in Klaviyo-editor (sync overschrijft). (4) KV WEER op 500k-limiet (buildlogs); API werkte nog bij test; V12 betaald plan urgent. Koppeling Sunny-WhatsApp (V24) uitgesteld door Daimy naar later; koppel-wachter gestopt.
- 18-08 later: formaat-keuze in fotokiezer (Daimy: "niet alles hoeft story-formaat"): waarde "src::formaat" (16x9/4x3/1x1/4x5), chips per slot, uitsnede live in voorbeeld (aspect-ratio+cover), API-validatie aangepast; build: slotFoto parseert formaat, fotoVoorSlot pakt gecropte CDN-variant (sleutel naam--formaat), fotos-uploaden.js maakt echte center-crops via sips (schalen tot dekking, dan -c crop; getest 1067x1600 -> 1056x594). Beide repos gepusht, deploy op headSha geverifieerd, chips visueel bevestigd. KV-database-uitleg naar Daimy (Upstash via Vercel Storage-tab, pay-as-you-go advies).
- 18-08 namiddag: C-BACKFILL live (Daimy: "kunnen we deze flows gaan backfillen?"). scripts/email/c-backfill.js + launchd nl.sonty.c-backfill (ma-vr 10:00, blok 200, nieuwste eerst). Doelgroep: laatste offerte 31-365 dgn, uniek per mail; eruit: 562 akkoord, 587 mag-niet, >365 dgn, al-C1 (events-dedupe tegen flow RPYzWM). 6.837 kandidaten bij start; proefblok 25 gedraaid (0 fouten), rest ~200/werkdag = ~7 weken. Flow-tijdlijn geverifieerd: C1 dag 0, C2 dag 7, C3 dag 21, per mail uitstap-check (mag_mail + fase lopend/koud). Mechanisme = dagteller op 30 (bewezen). Overzicht met alle aantallen naar Daimy. Previews: per productvariant passende voorbeeldklant (screens-gevoel verklaard: vaste voorbeeldklant Marleen had screens; echte verdeling 25% rolluiken/11% screens/9% knikarm/7% pergola, rest zonwering).
- Proefblok backfill geverifieerd: 24/25 C1 verstuurd; de ene misser is dfsdfsdfdsfd@gmail.com (nep-adres, door Klaviyo geweigerd/gebounced — gewenst gedrag, geen actie). Succesmelding automatisch naar Daimy. Morgen 10:00 eerste blok van 200.
- Sync-waakhond toegevoegd (nl.sonty.sync-waakhond, dagelijks 08:00): alarm naar Daimy als rp-export ouder dan 26 uur is (anders mist het dag-30-cohort stil zijn mail). Getest: export 9,5 uur oud, geen alarm. Eindbevestiging aan Daimy: alles draait zonder handwerk; bij hem liggen alleen nog andere flows aanzetten, KV betaald plan (V12) en evt. C2-openers-vinkje in de Klaviyo-UI.
- 18-08 einde middag: ALLE gebouwde flows live op Daimy's opdracht, elk als nieuwe versie met profile_filter (API kan definities niet updaten): A XS8ubM (mag_mail+vers/lopend), W1 WncBUm / W2 QPEsG8 / W3 W3FAwM (mag_mail+vers/lopend/koud), D R8atVb en E RzUZR2 (mag_mail+klant), RP1 WaV754 / RP4 SqNPmi / RP5 U3YcaZ (mag_mail; SLAPEND tot ons systeem de RP-metrics afvuurt). Oude concepten blijven als draft staan. G Welkom bewust NIET aan: triggert op lijst R76XQg = dezelfde als de live 2024-flow -> dubbele welkomst; keuze bij Daimy (V25). RP-DUBBEL geanalyseERD op Daimy's vraag: RP-herinneringen dag 6 en dag 10 zijn echt dubbel met A (dag 7/28) -> mogen uit in RP; RP's offerte-verstuurd-mail en akkoord/afwijzing-mails LATEN AANSTAAN tot wij de RP1/4/5-events bouwen. Weekbot bewaakt spam/afmeldingen per mail vanaf maandag.
- Daimy zag een live flow-mail die niet in zijn fotokiezer-checklijst stond: verklaard (8 mails hebben bewust geen eigen fotoblok, alleen gedeeld showroom-blok + logo: sonty-offerte/herinnering-1/2/afsluiter/weer-hitte/rp-offerte/akkoord/bouwvak) en gefixt: manifest-veld zonderSlots + sectie "Mails zonder eigen fotoblok" met Bekijk mail-knoppen in /admin/mailfotos. Deploy op headSha geverifieerd.

## 19-08 ochtend: fotokeuzes-verlies verklaard + naar Blob
- Daimy's fotokeuzes "verdwenen": KV-maandlimiet -> lees-misser gaf lege keuzes; kiezer toonde leeg EN kwartier-bouw kon met lege keuzes de mails naar standaard terugzetten. FIX: keuzes-opslag van KV naar Vercel Blob (admin/mailfoto-keuzes.json, allowOverwrite, cache 60s), KV alleen nog als eenmalig migratie-vangnet. Gemigreerd en geverifieerd: 12 keuzes identiek na schrijf/teruglees. Uploads-route (sonty:media-uploads, 473 beoordelingen) gecheckt: throw-gebaseerd, geen wipe-gevaar, alleen mogelijke hapering tot V12 betaald plan.

## 19-08 middag: flows toonden oude fotos -> kloon-probleem opgelost
- OORZAAK (Daimy zag het goed): Klaviyo KLOONT de template in de flow-mail bij aanmaken; de kloon staat niet in /api/templates (404) en flow-messages zijn onwijzigbaar (PATCH 405). Fotokeuzes bereikten dus wel de master-templates maar nooit de live flows.
- FIX: scripts/email/flows-verversen.js (herbruikbaar): elke live Sonty-flow -> nieuwe versie [vMMDD] met verse klonen van de actuele masters, oude naar concept. Alle 10 ververst; klaviyo-sync werkt nu ook alle naamgenoten bij (flow-klonen blijven onbereikbaar, vandaar het verversen).
- IN-FLIGHT netjes geregeld: inhaal-flow TVqSmQ (segment U248He op sonty_c_inhaal=ja): C2 na 6 dgn (25-08) en C3 +14 dgn (08-09) voor het C1-cohort van 18-08; herinstroom.js (scratchpad) stempelt het cohort en laat A-instroom sinds 18-08 15:30 en 18-08-akkoorden opnieuw instromen via fase-flip met membership-polling.
- LET OP VOORTAAN: fotowijziging in flow-mails = flows-verversen.js draaien (kwartier-cron doet dat NIET automatisch; bewuste keuze, in-flight vergt oordeel).

## 19-08 middag: Sunny volledig op de directe WhatsApp-koppeling
- QR-koppeling gelukt (code-route faalde; QR via Telegram-fotos, scan met Sunny's tel, 515-herstart afgehandeld; nummer bevestigd +31657141132). isGekoppeld herkent nu ook QR-koppeling (creds.me).
- NIEUW scripts/wa-luisteraar.js + launchd nl.sonty.wa-luisteraar (KeepAlive): permanente verbinding; groepsfotos -> triage -> Klaviyo-CDN -> Uploaden-tab; DMs -> data/email/wa-grapverzoeken.jsonl (weetjesbot leest daar); versturen via outbox data/wa-outbox (wa-verstuur.js kiest die route automatisch als de daemon draait, pid-check; nooit 2 sockets op 1 sessie). Twee verzendtests geslaagd (direct + via wachtrij).
- ChatStorage-lezen definitief uit (macOS-popups voorbij); weetje 20:00 en morning motivation 07:30 lopen via de verbinding, schermvergrendeling niet meer relevant voor versturen.
- 19-08 later: read-only collega-assistent op Sunny's WhatsApp (Daimy): ALLEEN Joey 31628209480 en Sjoerd 31641102319 krijgen antwoord op opzoekvragen; scripts/lib/collega-antwoord.js (sonnet + tools gripp_offerte (alleen-lezen sleutel, offer.get+company.get) en rp_zoek (rp-export: naam/tel/plaats/product/status/bedrag)); afgehandeld in wa-luisteraar DM-branch; elke Q&A gespiegeld naar Daimy's Telegram; andere nummers -> alleen grapverzoeken-log. Getest: RP-nummer en Gripp 6443 (Ana Franca) beide correct. Herinstroom-draaiboek afgerond: C-inhaal gestempeld, A-cohort opnieuw ingestroomd, 4/6 akkoorden terug in D/E.
- 19-08 einde middag: koppeling verbroken geweest (401 na ~4 min, WhatsApp-verificatie op verse sessie) -> QR-herkoppeling (sessie 3). LES: berichten komen binnen met geanonimiseerd @lid-adres; echte nummer zit in m.key.senderPn/remoteJidAlt; zonder vertaling ziet de daemon prive-berichten NIET (Daimy's test). Gefixt + antwoord naar het originele adres. Bewezen: Daimy's vraag (gegevens 4684) herkend en beantwoord. Sjoerd-intro verstuurd. Stabiliteitscheck 12 min loopt; bij nieuwe 401 eerst met Daimy overleggen (niet blijven herkoppelen, nummer-risico).

## 19-08 middag/avond: WhatsApp weigert 1-op-1 van Sunny's sessie -> reserve-route gebouwd
- GEMETEN (na proef A t/m E): elke DM van de gekoppelde sessie krijgt status 0 (server-weigering); binnenkomend en GROEP werken normaal. Oorzaak: anti-spam op vers nummer + meerdere herkoppelingen vandaag. Baileys geupgraded 6.7.24 -> baileys@7.0.0-rc14 (requires omgezet), loste het niet op; NIET blijven testen (nummer-risico), advies aan Daimy: nummer paar dagen menselijk gebruiken.
- Reserve-route: dm-uit-vlag data/wa-dm-uit.txt; collega-antwoorden gaan dan naar data/wa-desktop-queue/ en worden door scripts/wa-desktop-queue.js (launchd elke 5 min) via WhatsApp DESKTOP verstuurd zodra scherm ontgrendeld + 2,5 min idle (wa-stuur.jxa.js, doel = contactnaam: Daimy Boot/Joey Engelen/Sjoerd).
- Zelfherstel in daemon: bezorg-acks bewaakt (messages.update); status 0 op een direct antwoord -> vlag automatisch aan + via reserve; dagelijkse probe (na 08:15) aan Daimy -> ack status 3 = vlag eraf + melding "directe route werkt weer".
- LES: 1-op-1-bezorging ALTIJD via ack-status verifieren, "verstuurd" zonder ack zegt niks.

## 20-08 avond: Planado-opdrachten compleet gemaakt (852/855, omschrijving, adres)
- #852 (naamloos "Montage Sonty"-blok, morgen Mick): stond nog op eventtijd 07:00 want naam-matching kon niks; sync heeft nu TWEEDE koppelstap: naamloze blokken matchen op staff-mail (event-attendee = Bookings-staffmail) binnen het eventvenster, alleen bij precies 1 kandidaat. #852 nu 08:00 NL, plus Marvin 09-09 ook gefixt.
- Omschrijvingen: Planado negeert description/contacts in POST met template -> na-PATCH bij aanmaak; eenmalige backfill (scratchpad/backfill-teamjobs.js) heeft ALLE 119 toekomstige team-opdrachten de Outlook-kern gegeven (onderwerp + klantnaam + reserveringsgegevens uit de body, boilerplate eruit, Gripp-blok behouden).
- Adressen (Daimy: "hard adres, geen coordinaten"): sync zet adres altijd als tekst (event-Location, anders Bookings-locatie, alleen mits er een cijfer/huisnummer in zit). Eindstand: 100 klantopdrachten met echt straatadres, 19 zonder (interne magazijn/vrij-blokken of nergens adresdata); 10 onzin-adressen ("Niets plannen", "Tygo magazijn", plaats-zonder-straat) geschoond naar leeg. 0 coordinaten aangetroffen.
- Tel-normalisatie: Bookings levert "106 22750496" (verdwaalde 1 voor 06) -> normTel in sync + backfill, contacten staan als 06/+316.
- LES: Planado LIST-endpoint geeft GEEN address terug, alleen het detail-endpoint — nooit op de lijst concluderen dat adressen leeg zijn.
- Noodrem data/outlook-schrijf-uit staat NOG AAN (wacht op Daimy). Sync gepusht (34e362f).
- 20-08 avond (vervolg): veld "Wie heeft deze fout gemaakt" uit de werkbon op Daimy's verzoek. Montage-template via Planado-UI (Playwright headless) 19->18 velden; LET OP: has-text("Verwijderen") matcht ook de rode sjabloon-verwijderknop, bijna sjabloon weggegooid — dialoog "Sjabloon verwijderen?" blokkeerde gelukkig alles; nieuwe aanpak: prullenbak exact binnen de veldrij via evaluate. Daarna eerst 1 proefjob (#895 Haasnoot) herbouwd en gecheckt, toen de overige 118: verwijderd + sync-herbouw. Eindstand geverifieerd op alle 119: 18 velden, 0x wie-fout, omschrijving 109 (10 kale interne blokken), adres 103, contact 100. Opdrachtnummers zijn NIEUW (herbouw). cron-werkbon-afhandeling.js VELDEN aangepast (gepusht). 76 "fouten" in herbouwlog = 10-min-daemon draaide tegelijk, geen gevolgen, geen dubbelen.
- 21-08: NOODREM ERAF op Daimy's akkoord ("planado naar outlook weer aanzetten, alleen nieuw niet wijzigingen"): data/outlook-schrijf-uit verwijderd. Terugweg voldoet al aan die eis: heelt ALLEEN Planado-opdrachten zonder agenda-afspraak (nieuw), duwt nooit wijzigingen naar Outlook (verplaatsing = melding, annulering = Outlook leidend). Dry-run vooraf: 0 heel-acties, 0 annuleringen, 0 opties. Eerste echte cyclus schoon (nieuw 1: van der Linde montage 25-08 Mick, dat is de heenweg). Optie-veger daarmee ook weer actief. Eerder die ochtend: Planado-Outlook-controle gaf 7 valse alarmen (klanttijd vs gebufferde bloktijd) -> checker matcht nu eerst op ol-koppel-id, en haalt omschrijving per afwijker op via detail-endpoint (lijst heeft geen description).
- 21-08 middag: werkbon VERSIMPELD (Daimy: "alleen de versimpelde, niet meer die uitgebreide"): 10 checklist-velden uit het montage-sjabloon via Playwright (18->8), alleen Daimy's 8 velden over (werk gereed, waarom niet, wat nodig, kleur, producten bij klant, uren herstel, foto niet-gereed, uitleg volgende service). Proef 1 (#1022 Haasnoot) -> rest: 114 herbouwd. Eindcontrole alle 117: 8 velden overal, 0 dubbelen, omschrijving/adres/contact intact. Nummers WEER nieuw. 30 "fouten" in herbouwlog = daemon-race, zonder gevolgen. LET OP: er is nu GEEN verplicht veld meer in de werkbon (de 4 verplichte zaten in de verwijderde checklist); V2a (Werk gereed verplicht maken?) staat nog open bij Daimy.
- 21-08 middag: meeneem-melding-daemon van 1x/dag 17:00 naar ELK UUR (StartInterval 3600 + RunAtLoad): avond-annulering ruimt de meeneem-notitie van de volgende ochtend nu wel op tijd op. Script was al idempotent + heeft eigen opruimstap (bron = Planado zelf). Bewezen: ruimde direct oude testnotitie op.
- 21-08 middag: 35x-spam "Aanbod NIET verstuurd" opgelost: (1) alarm nu max 1x/24u per klant (state.nietBezorgdAlarm, opschoning 7 dgn), poging zelf blijft zodat aanbod vanzelf gaat zodra blokkade wegvalt; (2) Keuzelink uit het alarm (record is dan al op verlopen gezet, link was altijd dood - Daimy: "die link klopt niet"); (3) GROTE VONDST: sinds 10-08 (commit 707a9ea) crashte ELK vers eerste aanbod op "m is not defined" (regel 813 verwees naar antwoord-pad-variabele) -> null doorgeven, vers-aanbod-pad werkt weer; (4) POORT_OVERRIDE=1 env voor bewuste handmatige runs (stil-lijst blijft ALTIJD gelden), daemons zetten die nooit. Cases: Dennis Hendriks aanbod verstuurd 12:27 (di 22 sep 11:45, wa+mail, via dag-4-mechanisme want +33 min omrijden; gezien-datum bewust teruggezet); Mirjam Boom-Looij bewust NIET nogmaals (vanochtend 10:22 al netjes geantwoord met wedervraag welke dag past; 3e identieke voorstel = spam).
- 21-08 (vervolg spam): Daimy kreeg NA de fix nog steeds alarmen -> dader was inmeet-verzoek-daemon (KeepAlive, requires cron-inmeten-planner.js): had de oude planner-code in het geheugen, 67 pogingen in de log. Herstart via launchctl kickstart; bewezen: 1 alarm door de dedupe (state.nietBezorgdAlarm gevuld 10:37Z), rest stil. LES: na elke edit aan cron-inmeten-planner.js OOK nl.sonty.inmeet-verzoeken kickstarten (daemon houdt de module vast).
- 22-08: klant-sms naar showroomafspraken gestopt (Daimy). Oorzaak: Planado "SMS-notificatie voor klanten" (/admin/settings) is GLOBAAL (herinnering + onderweg-bericht) zonder type-filter; elke opdracht met telefooncontact krijgt hem. Fix: sync zet geen contact meer op soort winkel (winkel/showroom/telefonisch), POST en na-PATCH; bestaand geval #600 contact leeggehaald en bewezen dat de sync hem niet terugzet. Inmeet/montage houden de sms bewust. Let op: "Robbert Winkel" als klantnaam is geen winkel-soort (inmeet-regex wint), filter alleen op soort().
- 22-08: offerte-tool nummer-zoek gefixt (Daimy: 202612018 wel via postcode, niet via nummer). Oorzaak: nummer-zoek leunde op (a) eenmalige gebundelde offerte-index.json (nooit ververst) en (b) scan over slechts 600 nieuwste bordkaarten terwijl het bord 19.440 heeft; postcode-zoek filtert wel alles. RP-quotations-endpoint kent GEEN paginatie/filters (alle params genegeerd; volle lijst = 8,7 MB / ~20s / 20.412 offertes). Fix in sonty-website (2a8fb9b): (1) /api/cron/offerte-index ververst elk half uur een nummer->documentId index in Blob (admin/offerte-index.json, nieuwste wint bij dubbele nummers); (2) zoek-actie: Blob-index -> bundel-index -> volle-lijst-fallback (maxDuration 60) ipv 600-scan. Bewezen: API 2s raak, browsertest opent Anneke Maljaars #202612018.
- 22-08 middag: (1) PHULL VOLLEDIG OPGERUIMD op Daimy's opdracht: motor-annulering (Outlook, Planado, sheet, boekingsrecord), Bookings-afspraak 15 sep geannuleerd, Gripp-concept 6523 verwijderd (bewezen weg), tel 625303790 op stil-lijst (kaart staat NOG op Inmeten inplannen; kantoor moet status zetten), klant kreeg bevestigingsmail op zijn afzeg-ticket (975494338, stond 27u open). (2) NIEUW: elke annulering/verzetting van een inmeetafspraak gaat nu ook naar de planning-bot-groep (in muteerBoeking; Daimy 22-08). (3) Dashboard geen-adres-gevallen: rijswijk-bug in offerte-adres.js (filter voor Sonty-blok gooide elke Rijswijkse klant weg, geval van Beek) + nieuw PDOK-vangnet voor adresregels zonder postcode boven het mailadres in de PDF (Hoogeveen/Van leeuwen/vd zwaan). Bewezen: 0 geen-adres in dashboard, alle 4 op wachtend met plaats. Regressietest uitgebreid; 2 al bestaande rode tests (bevestig-cooldown, terugkom-belofte) staan nog open, NIET door dit werk.
- 22-08 einde middag: "heel veel zonder 1 tijd" in inmeet-dashboard OPGELOST. Echte oorzaak: TomTom-tegoed OP (routing 403 InsufficientFunds; geocode werkt nog) -> elke niet-gecachte route faalde stil en het gat werd overgeslagen -> 9 leads met 0 tijden. Fix 1: OSRM-terugval in lib/reistijd.js (bij 403; zelfde resultaatvorm, fileVertraging 0, bron osrm, zelfde cache). Fix 2: horizon-verlenging (zorgVoorDrieOpties 30/60 wd) nu OOK bij 0 slots, behalve bij bewust omrij-wachten (beste.length>0). Eindstand bewezen: 11/12 leads met 3 tijden (12e = aanbod-loopt, hoort zo). V5 open bij Daimy: TomTom-tegoed bijkopen voor file-bewuste rijtijden. LES herhaald: verzoek-daemon kickstarten na elke planner/lib-edit.
- 22-08 avond: OSRM-fallback ERUIT op Daimy's verzoek ("niet een fallback, ik wil een melding"). Nieuw gedrag: TomTom-403 = hard falen + alarm naar hoofdchat (max 1x per 6 uur, stempel data/tomtom-tegoed-melding.txt) met koopinstructie; 814 osrm-routes uit reistijden-cache.json geschoond; verzoek-daemon herstart. Planner kan dus NIET plannen tot Daimy tegoed koopt op developer.tomtom.com (V5). Bewezen: proefroute gaf alarm + nette fout.
- 22-08 avond: TomTom-tegoed door Daimy opgewaardeerd; doorvoer duurde ~2 min (eerst nog 403). Volledige planner-run met file-bewuste routes: 11/12 leads met 3 tijden en nette omrij-minuten (+4 tot +21), 12e = J Verheus met lopend aanbod (hoort zo); Sander vd zwaan op bewust omrij-wachten (+46 min, dag-4-mechanisme geeft hem uiterlijk over 4 dagen de goedkoopste plek). Dashboard gepubliceerd 16:21Z.
- 22-08 avond: Joey vakantie 2 t/m 11 okt in Outlook gezet (agenda Sonty Montage, onderwerp "Vakantie", Joey als genodigde conform conventie; via uitnodiging ook in Joeys eigen agenda). Planner herladen: Joey 2->12 vakantiedagen geblokkeerd; volledige herreken: 11/12 leads met tijden en 0 voorstellen bij Joey in 2-11 okt. Bestaande afspraak in het venster: Laura Idzinga inmeten 5 okt 09:00 - kantoor verplaatst zelf (Daimy).
- 22-08 avond (2): aanbod-alarm verder ingeperkt (Daimy: "1x is genoeg", kreeg 3 losse alarmen op een middag): per klant max 1 melding ooit (nietBezorgdAlarm, opschoning 30 dgn) en meerdere klanten gebundeld in 1 bericht per 6 uur (alarmWachtrij + alarmDigestOp in planner-state). Digest-stempel direct gezet zodat de 3 al gemelde (Mirjam, Scholten, Van leeuwen) niet dubbel komen. Scholten-geval zelf: kreeg 21-08 al 2 aanbiedingen binnen 80 min (!), reageerde nog niet; poort blokkeerde 3e terecht; niks verstuurd, geen actie gedaan. Verzoek-daemon herstart.
- 22-08 laat: "Verzoek ververs/stuur-aanbod mislukt: Planado 400" meldingen = PLANADO-ONDERHOUD (aangekondigd 19-21 UTC; API gaf zelfs rauwe AWS-fouten). Verzoeken blijven open en verwerken vanzelf na afloop. Daemon-fix: identieke storing per verzoek max 1x per uur melden (in-memory dedupe). Daemon herstart.
- 22-08 nacht: meldbeleid verzoek-daemon per Daimy: storing per verzoek max 1x per 12u + belofte "je hoort het als het gelukt is"; bij succes-na-storing automatisch een ✅-melding (storingGemeld-map wordt dan geschoond). SYSTEMEN-rood komt al alleen bij kleurwissel. Geverifieerd: klant-keuzes tijdens Planado-storing zijn veilig (register op Vercel, los van Planado; aanbod blijft "gekozen", verwerker retryt elke 5 min, bevestiging pas na complete boeking). Planado-terug-wachter loopt (btkh0qh3i).
- 22-08 nacht: Planado terug om 21:34 (onderhoud korter dan aangekondigd venster). Sync direct schoon (0 fouten, 291 afspraken), 0 gekozen aanbiedingen blijven hangen. Open verzoeken: alleen de 3 poort-geblokkeerden (Mirjam 2x verzoek, Scholten, Van leeuwen) die op de weekgrens wachten. Opgelost-melding naar Daimy gestuurd zoals beloofd.
- 23-08: gesprek-lab aangescherpt (Daimy): (1) FOUT-STIL wordt NIET meer gemeld als het ticket bij team Mens nodig (431872) ligt - mens kijkt al; (2) dupe-bug: Telegram-rapport pakte de ruwe lijst ipv de gededupede (daarom stond Van leeuwen 2x in het rapport) - nu uit uniek; (3) afsluitwoorden aangevuld (blij/mee/ben/ik/wacht/af/hartelijk, geval Van leeuwen). Teams gecheckt: Phull en vd zwaan lagen bij Mens nodig, Van leeuwen was een afsluiter. Bewijsrun: schoon.
- 23-08: vals alarm Planado-Outlook-controle gefixt: meeneem-* opdrachten (ophaal-herinneringen, bewust Planado-only per Daimy 16-08) worden niet meer als "mist in Outlook" gemeld. Bewijsrun: 293 opdrachten, 0 zonder Outlook-afspraak (en passant 1 verlopen OPTIE-blok geveegd).
- 23-08: A/B-test offerte-templates BEEINDIGD (Daimy: "we zijn klaar met testen, eindrapport hoef ik niet meer"): nl.sonty.ab-rapport en nl.sonty.ab-eindrapport unloaded, plists naar ~/Library/LaunchAgents/uit/, uit systemen-register en system-status (geen verdwenen-alarm). LET OP uitslag: nieuwe template 18% reply (n=17) vs oude 26,8% (n=82) - kleine steekproef maar wijst richting OUDE template; ab-template-verdeler draait nog met alleen inmeten-template. V7 open: terug naar de oude template of huidige laten staan?
- 23-08 ochtend: health-check-klachten Daimy: (1) "Gripp invullen log 12u oud" = VALS: kalenderjob 7x/dag, laatste 20:00, eerste 08:30 -> nachtgat 12,5u > maxUur 5; maxUur naar 14, health nu 64 diensten 0 meldingen. (2) databot-ongelezen was TERECHT: 2 berichten (Scholten-klacht, dubbel gestuurd) stonden ongelezen omdat de databot-lezer niet bij elk bericht werd gedraaid; nu gelezen, teller geschoond. LES: bij ELK Daimy-bericht alle drie de lezers draaien (regel bestond al).
- 23-08 middag: V8 AKKOORD van Daimy + uitbreiding: niet direct tijden sturen maar EERST de klant vragen vanaf wanneer het uitkomt (in gesprek, wens ophalen) en dan pas een passend voorstel. Te bouwen (scenario-run eerst!): (1) klantwens-antwoord telt niet als voorstel voor max-2; (2) wachtrij-dedupe zelfde verzoek per klant; (3) pauze na wedervraag van ons; (4) herhaalvoorstel nooit identiek; (5) NIEUW eerste-contact-flow: wens-vraag voor het eerste aanbod. Van leeuwen: boek-verzoek ec46251b ingediend voor 21 sep 17:00 NL bij Sjoerd (25 min, direct na Hoogeveen = de zoon, 10 min rijden); wachter bketd9pk8 bewaakt de verwerking.
- 23-08: Van leeuwen GEBOEKT: Sjoerd ma 21 sep 17:00 (25 min), direct na de zoon (Hoogeveen 15:40-16:45, 10 min rijden), Outlook+Planado+Gripp 6540+meetbon+sheet r1177. Klantbevestiging apart gestuurd met thuisblijf-venster 16:00-18:30 (het dashboard-boekpad stuurt zelf geen bevestiging - rekent op winkel; LET OP voor de V8-bouw: bevestiging in dat pad automatisch maken of expliciet houden?). Zijn oude stuur-aanbod-verzoek wordt door "heeft al een afspraak"-guard vanzelf afgewezen.
- 23-08 middag: van Beek (Marcel, wildcart@me.com) inmeet-aanbod verstuurd op Daimy's opdracht: 2 vrijdagochtenden bij Joey (vr 25 sep en vr 16 okt, 09:00, 35 min) - bewust verder weg (hypotheek loopt, RP-notitie) en vrijdag omdat klant dan thuiswerkt. Joey werkt normaal GEEN vrijdag (rooster null) - bewuste uitzondering van Daimy. Vakantie 2-11 okt ontweken, beide ochtenden leeg. Poort blokkeerde (telling 2 door eerdere onbezorgde pogingen) -> POORT_OVERRIDE, wa+mail bezorgd (tickets 975696390/975702531), aanbodTickets+aangeboden bijgewerkt (monitor volgt). BOUWLIJST: aanhef-bug "Hoi van" bij achternaam-only leads; standaardtekst "eerste moment" klopt niet bij bewust-ver-weg (toelichting nagestuurd, retry loopt wegens Trengo 429).
- 23-08 avond: kansberekening plaats-frequentie op RP-historie (Daimy's idee): 6.977 aanvragen / 491 akkoorden laatste 180 dgn. AANVRAGEN: 39 plaatsen (56% volume) hebben >=60% kans op buur-aanvraag binnen 4 dgn. Maar op AKKOORDEN (wat je echt inmeet): alleen Den Haag 76%, Rotterdam 55%, Zoetermeer 59% halen >=50%; samen 23% van de akkoorden; Utrecht/Maassluis/Barendrecht 0%. Conclusie: vaste 4-dagen-omrij-wachtregel loont alleen in DH/Rdam/Zmeer (+Delft 47%), elders direct plannen. Tabel opgeslagen als data/plaats-wachtkansen.json (akkoorden+aanvragen per plaats) voor de V8-bouw. V9 open: wachttijd plaats-afhankelijk maken?
- 23-08 avond: besluitrichting Daimy: ZELFDE DAG als akkoord al plannen. Analyse: kan prima samen met clusteren omdat aanbieden en afspraakmoment 3-6 weken uit elkaar liggen; clusteren gebeurt op het afspraakmoment via ankers, en na-komende akkoorden plakken zich eraan vast (bewezen: Van leeuwen na Hoogeveen). 4-dagen-wachtregel wordt daarmee vrijwel overal overbodig; plaats-wachtkansen.json stuurt voortaan de ANKERKEUZE (lage-frequentie-plaats = strak tegen bestaande routedag, hoge frequentie = vrij). Onderdeel van de V8/V9-bouw, scenario-run eerst.
- 23-08 avond: SYSTEMEN-rood sync = Planado rate limit ("Rate Limit Exceeded" als kale tekst -> JSON.parse crash). Fix: planadoJson()-helper in de sync (tekst lezen, JSON proberen, 5 pogingen met oplopende wachttijd) op de jobs-lijst en alle detail-GETs. Bewijsrun schoon (297 aanwezig, 0 fouten). Zelfde patroon zat al in andere scripts, sync was vergeten.
- 24-08: REGEL Daimy: veel minder Telegram-berichten + telefoon-leesbaar. Vastgelegd in memory (feedback_telegram_kort): alleen vragen/blok-afrondingen/urgent, bundelen, max ~10 korte regels, details in chat/HANDOFF. Per direct toegepast; V7 en V9 staan nog open bij Daimy.
- 24-08: SYSTEMEN-rood inmeet-dashboard = Planado 429 in planner's planado()-helper (crashte zonder retry). Zelfde fix als de sync: 5 pogingen met oplopende wachttijd + tekst-parse. Bewijsrun schoon, verzoek-daemon gekickstart.
- 25-08: Planado-omschrijvingen inmeters (Daimy: "te vaak alleen motor + afstandbediening"): scan 90 inmeet-jobs -> 10 echte zonder productblok = klanten ZONDER Gripp-offerte (winkel/nog niet getekend). Fix in planado-gripp-verrijken: (1) RP-terugval (rp-export match op tel/naam -> board-item -> productregels; blok "RP-offerte: nr (nog geen Gripp)"), wordt automatisch vervangen zodra Gripp-offerte bestaat; (2) regelsUitLeadTekst leest subregels (hoogte/breedte/framekleur/bediening) - "1x Rolluik" werd "1x Rolluik 1400x1470 RAL 7016 Somfy IO solar"; (3) rate-limit-bestendige planadoJson ook hier. Gevuld: Michiel van Andel, Cas Voskuyl (9 regels), Luuk Post, Steven Burke + Tass Kop alsnog Gripp-koppeling. Handwerk blijft: DISNEY, "Inmeten - klant", Charentestroom, Roland Sars (niet in RP-export), JOEY WINKEL-blokken (intern, ok). Daemon draait dit voortaan automatisch.
