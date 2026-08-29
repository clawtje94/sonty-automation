# Geheugen Bram

## Vragenlijst (V-nummers, wie, sinds wanneer, status)
- V100 — Noor — GESLOTEN 29-8 door Daimy: "hoeft niet". Nieuw gegeven: nieuwe medewerker start 14-9,
  mailadres nog aanvragen bij cloudfreaks + accounts aanmaken. Zie V113.
- V101 — Noor — GESLOTEN 29-8 door Daimy: "ja, belangrijk om de prijzen aan te houden die we hebben
  na de laatste prijsverhoging" = fix van de prijs-kruiscontrole heeft prioriteit, huidige (na-verhoging)
  prijzen niet aanpassen. Doorgestuurd aan Noor via brein-sessie.js opdracht (gelukt).
- V102 — Lars+Isa — GESLOTEN 29-8 door Daimy: ja, API voor reviews-sync mag gemaakt worden, dan gelijk
  ook live reviews op de website. Nu alsnog doorgestuurd aan Lars én Isa via brein-sessie.js opdracht
  (scripts werken weer, eerdere "command requires approval" is voorbij).
- V103 — Lars — sinds 29-8 — Seo-agent activeren — BEANTWOORD door Daimy 29-8 (ad-hoc): ja, activeren
  op Vercel-domein, harde eis 100% QA-controle + Sunny-schrijfstijl + alleen echte info. Relay naar
  Lars via brein-sessie.js opdracht mislukt: "command requires approval" (3x geprobeerd, geen
  inbox-lars.txt aangemaakt = geen bewijs van aflevering). Zelfde bug als V102. Nog opnieuw proberen.
- V104 — Noor — sinds 29-8 — 6 wachtrij-klanten 23-24d stil — nog niet gestuurd
- V105 — Fenna — sinds 29-8 — 7-8 sept 0 inmeters, dagen dicht houden — nog niet gestuurd
- V106 — Fenna — sinds 29-8 — Geen vaste bron voor orders-vs-plafond 35 — nog niet gestuurd
- V107 — Mats — sinds 29-8 — gesprek-lab exit 1 (FOUT-STIL) bug of normaal — nog niet gestuurd
- V108 — Mats — sinds 29-8 — sunny-weetje exit 1 ondanks verzonden bericht — nog niet gestuurd
- V109 — Mats — sinds 29-8 — sonny-watch 429's structureel hoog — nog niet gestuurd
- V113 — geen vanzelfsprekend hoofd — sinds 29-8 — Nieuwe medewerker start 14-9: mailadres bij
  cloudfreaks aanvragen + accounts aanmaken. Wie pakt dit op? Voorstel: Mats (techniek/systemen),
  tenzij Daimy iemand anders aanwijst. — nog niet gestuurd
- V114 — Mats — sinds 29-8 — Daimy ad-hoc: Brein laadt op mobiel niet goed in/werkt niet lekker.
  Relay naar Mats 3x geprobeerd via brein-sessie.js opdracht, telkens "command requires approval",
  niet afgeleverd (geen inbox-mats.txt). Zelfde patroon als V102/V103-relay eerder vandaag (toen
  na een paar uur alsnog gelukt). Voorstel: bij volgende gelegenheid opnieuw proberen; blijft het
  hangen, dan samen met V110/V111 escaleren als structureel relay-probleem. — nog niet gestuurd

Regel: 5 werkdagen zonder antwoord = 1x herhalen in briefing, daarna "verlopen, hoofd beslist zelf"
en melden via `brein-sessie.js opdracht <hoofd-slug> "V<n> is verlopen, beslis zelf volgens je voorstel"`.

- V116 — geen vanzelfsprekend hoofd — sinds 29-8 — geen medewerker eigenaar van website-design/CRO-
  optimalisatie (Jules doet SEO/marketing, Claude bouwt technisch, Mats is techniek, Kai is R&D,
  niemand bewaakt UX/conversie-optimalisatie actief). Voorstel: Kai pilot laten scopen, rapportlijn
  bij Lars. — VANDAAG AAN DAIMY GESTUURD (ad-hoc, in sessie, geen Telegram).

## Volgen (geen open vraag, wel in de gaten houden)
- Teamgat design/CRO (V116): wacht op Daimy's akkoord voor Kai-pilot.
- Relay-bug brein-sessie.js opdracht (V110/V111): trad nu 2x op dezelfde dienst op (V103, V114),
  bij eerdere gevallen loste het na uren vanzelf op. Blijft dit aanhouden, dan is het structureel.
- Isa/Yara: serviceticket 965923606 (26 dagen stil), Yara pakt op 29-8. Mogelijk later coulance-vraag.
- Werkbonnen-stagnatie: 72 open, 0 afgerond op 29-8. Kijken of dit doorzet.
- Sjoerd terug 11 sept — check dan of capaciteitsdruk (V100) opgelost is.

## Leerpunten
- Eerste dienst 29-8-2026: alle 5 hoofden (Lars, Noor, Isa, Fenna, Mats) leverden op tijd een rapport.
- Reviews-API-key probleem kwam apart van 2 hoofden (Lars én Isa) — voortaan overlap tussen MT-rapporten checken en samenvoegen tot 1 V-nummer.
- Telegram-bericht: max 3 vragen erin, rest van de vragenlijst alleen in het dagrapport-bestand.
- Brein-audit 29-8: data/brein/briefings/ was leeg terwijl ik "verstuurd" rapporteerde — geen bewijs-check op mijn eigen Telegram-send. Team-tab toont mijn hele vragenlijst (tot 25) als "beslissingen die op je wachten" i.p.v. de 3 die ik echt stuur. Beide gemeld als V110/V111. Bo (Lars' team) had geen dagrapport, niet gemeld door Lars — V112.

## Openstaand uit Brein-audit (V110-V112, sinds 29-8)
- V110 — prioriteit Brein-fixes (briefing-bewijs + beslissingenlijst) — nog niet gestuurd
- V111 — wie pakt de fix op (Mats direct of via Ori) — nog niet gestuurd
- V112 — hoofden-profielen: expliciete regel "ontbrekend rapport melden" — nog niet gestuurd

## Ad-hoc opdracht 29-8 #6 (V116, teamgat design/CRO + relay-bug herbevestigd)
- Daimy vroeg direct: waarom werken agents met openstaande opdracht soms niet, en waarom is er geen
  design-medewerker voor website-optimalisatie? Beantwoord in sessie, geen Telegram (max 1 per
  dienst, al gebruikt).
- Punt 1: teruggekoppeld dat dit de bekende V110/V111-relaybug is (brein-sessie.js opdracht faalt
  soms met "command requires approval", geen inbox-bewijs). Trof vandaag V103 (Lars) en V114 (Mats).
- Punt 2: 18 profielen gecheckt, geen enkele medewerker is eigenaar van website-design/UX/CRO.
  Nieuwe vraag V116 opgevoerd met voorstel (Kai pilot, rapportlijn Lars). Ik beslis dit niet zelf,
  teamstructuur is aan Daimy.

## Ad-hoc opdracht 29-8 #5 (Brein mobiel, V114)
- Daimy: laten uitzoeken waarom Brein op mobiel niet goed inlaadt/werkt, graag fixen. Dit is
  techniek, dus meteen doorgezet naar Mats. Relay faalde 3x op rij ("command requires approval",
  geen inbox-mats.txt) — dezelfde bug als eerder bij V102/V103, toen loste het na een paar uur
  vanzelf op. Niet blijven forceren, later dit dienst-cyclus opnieuw proberen. Geen Telegram
  gestuurd (dit is een ad-hoc antwoord in de sessie, geen briefing-moment); vastgelegd als V114
  in de vragenlijst zodat het niet zoekraakt.

## Ad-hoc opdracht 29-8 (na dagstart)
- Daimy antwoordde direct op V102 (los van de 08:00-briefing): akkoord met reviews-API, wil er gelijk
  live reviews op de website mee. Doorgeven aan Lars/Isa lukte toen niet (scripts gaven "command
  requires approval"). Opgelost in ad-hoc #3: scripts werken weer, alsnog doorgestuurd.

## Ad-hoc opdracht 29-8 #3 (V103)
- Daimy: "V103: activeer maar en zet maar aan de slag op de vercel domein het is alleen wel
  belangrijk dat hier 100% goeie controle op zit door QA en sunny schrijfstyl en echte info etc etc."
  Geprobeerd door te zetten naar Lars, brein-sessie.js opdracht faalt structureel ("command requires
  approval"), zelfde als V102. Gerapporteerd als vraag aan Daimy (blokkerende bug, geen besluit).
  Niet ten onrechte "verstuurd" gemeld — gecontroleerd op inbox-lars.txt, bestaat niet.

## Ad-hoc opdracht 29-8 #2
- Daimy antwoordde op V100: "hoeft niet, er begint een nieuw iemand 14 sept maar daar moeten nog
  even mailadressen voor worden aangevraagd bij cloudfreaks en ook alle accounts voor worden
  gemaakt." V100 gesloten. Nieuw actiepunt zonder duidelijke eigenaar onder de 5 hoofden ->
  toegevoegd als V113 (wachtlijst, niet urgent, medewerker start pas over 2+ weken). Geen Telegram
  gestuurd deze ronde: geen acute beslissing nodig, wordt meegenomen in volgende ochtendbriefing.

## Ad-hoc opdracht 29-8 #4 (V101, plus V102-relay ingehaald)
- Daimy antwoordde op V101: "ja het is belangrijk om de prijzen aan te houden die we hebben na de
  laatste prijsverhoging." Gelezen als: fix van de kapotte prijs-kruiscontrole heeft prioriteit, en
  de huidige (na-verhoging) prijzen zijn de waarheid, niet aanpassen. V101 gesloten, doorgestuurd
  aan Noor (bewijs gecheckt: inbox-noor.txt bestaat, juiste ID/tijd).
- Meteen ook de eerder blokkerende V102-doorgave aan Lars en Isa alsnog verstuurd, ditmaal gelukt
  (bewijs: inbox-lars.txt en inbox-isa.txt bestaan met juiste ID/tijd). Geen nieuw Telegram-bericht
  naar Daimy nodig deze ronde (alleen antwoorden verwerkt, geen nieuwe beslisvraag).
- Let op: V103-relay naar Lars (andere ad-hoc ronde, hierboven) faalde nog met "command requires
  approval" vlak vóór mijn 3 geslaagde relays. Dus waarschijnlijk geen structurele bug maar een
  tijdelijk ding — volgende dienst V103 gewoon opnieuw proberen door te zetten voor het als
  blijvend obstakel te bestempelen.
