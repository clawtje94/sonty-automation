# Geheugen Fenna

## Lopende zaken
- 2026-09-09: gripp-facturen-open.json/orders-vs-plafond.json nog steeds niet opgeleverd (bestanden nog
  1-9). Mats vond de echte oorzaak: opdrachtqueue aan 'claude' pakt geen backlog op, vereist levende
  sessie. Zette zelf fix door (opdracht itf2311c aan 'claude'), nog niet uitgevoerd. GEEN 4e delegatie
  door mij nodig — dit is nu correct bij Techniek belegd, alleen morgen checken of itf2311c is opgepakt
  en bestanden ververst zijn. Als dat ook faalt: dan pas apart melden aan Daimy (infra/proces boven
  Techniek's mandaat).
- 6489 (Martin Valentin) nu 11 dagen onbetaald, Sam noemt hem weer expliciet (was gisteren onterecht
  zorg dat hij verdween — vals alarm, hij staat gewoon in elk rapport). V-vraag herhaald: vervaldatum +
  herinneringsschema. 6332 (Sjoerd van Marum) zelf afgehandeld: Sam maakt aanbetalingsfactuur, geen
  klantbelcontact (BESLIST ZELF).
- Instroom 7 dagen: 9-9 t/m 13-9 leeg (2e dag op rij dit patroon over een langere periode), pas 14/15/
  16-9 gevuld (7, Joey 4 Sjoerd 3). Joey was wel gewoon beschikbaar die dagen. Als dit patroon een 3e
  dag blijft (lege eerste helft van het venster ondanks capaciteit), dit expliciet als risico-signaal
  benoemen ipv alleen melden.
- Nieuwe naam "Patrick" als inmeter in inmeet-boekingen.json (1 boeking, 21-9). Niet eerder gezien naast
  Joey/Sjoerd — navragen bij Pip of dit een nieuwe inmeter is of een foutieve invoer.
- Data-afwijking gevonden (oplevercheck-regressiecheck): Pip's rapport claimt "2 afspraken geboekt
  vandaag, 10-9 middag" maar beide 10-9-records in inmeet-boekingen.json staan op status "geannuleerd".
  Navragen bij Pip, niet zelf gecorrigeerd in haar cijfer.
- V137 (montage vs plafond, nu 92% niet-compleet, was 93%) staat sinds ca. 05-09 bij Daimy, dag 5-6
  zonder antwoord. Blijven herhalen, materialiteit hoog. Als morgen weer geen reactie: laatste keer
  herhalen en dan aannemen dat het geaccepteerde backlog is (aangekondigd in vandaag's V-vraag).
- Alarmen: 4 (03-09) → 4 → 6 → 8 (08-09) → 7 (09-09, 4 midden/3 laag). Lichte daling, 0 hoog/kritiek.
  Geen actie, blijven volgen.
- Luuk Post (ongetekende offerte, V135) niet gecheckt vandaag (Bram's rapport ontbrak) — morgen weer
  meenemen als Bram's rapport er is.

## Structuur / bronnen die werken
- Directeurscijfers boekingen: data/inmeet-boekingen.json (velden: geboektOp, aankomst, inmeter,
  status). ALTIJD status "geannuleerd" uitsluiten. Veldvolgorde varieert per record (sheet-blok
  verschilt in lengte) — gebruik bij multi-veld Grep een ruime window ([\s\S]{0,400}?) of haal gewoon
  met -A/-B losse regelcontext op i.p.v. te vertrouwen op één grote regex-join; die mist regelmatig
  matches door variabele afstand tussen velden.
- Wachtrijen/alarmen/stil-lijst: data/brein/snapshot.json — 1 lange regel JSON. Veld "ernst" (niet
  "niveau") geeft de ernst van een alarm. Velden bevestigd: wachtrijen.openAanbod, wachtrijen.claims,
  wachtrijen.stilLijst (+stilNamen), mutaties.open/items. Geen apart "voorstellen"-veld in snapshot;
  montage-voorstellen komt uit Pip's eigen bron (montage-voorstellen.log), niet uit snapshot.
- Delegeren: node scripts/brein-sessie.js opdracht <slug> "<tekst>" (max 3/dag). Check ALTIJD volgende
  dienst of er een opdracht-log verscheen. Structurele blokkade nu WEL gevonden en bij Techniek belegd
  (zie Lopende zaken) — dus niet blind een 4e keer delegeren, eerst check of Mats' fix werkt.
- Bram (medewerkers/bram/dagrapport/) bundelt V-vragen richting Daimy — lees dit erbij voor V-status.
  Vandaag ontbrak dit rapport (net als bij mijn eigen team een afwijking zou zijn, maar Bram is geen
  eigen medewerker dus niet als afwijking gemeld, wel als beperking genoteerd).
- gripp-alle-facturen.json: 4,6MB, gedateerd 3 juli — niet bruikbaar tot Mats ververst.
- gripp-open-opdrachten.json: gedateerd 7 juli — nodig voor V106, check of ververst.

## Bijscholing/feedback toegepast
- Rapport teruggebracht naar ~30 regels na feedback Ori (was 39) — kort houden, geen dubbeling tussen
  CIJFERS en VRAGEN.
- Oplevercheck-skill toegepast: geboekt-cijfer eerst fout opgeschreven (zelf tegensprekend "0" vs "3
  stuks"), gecorrigeerd voor opleveren. Montage-noemer niet zelf herberekend (voorkomt verzonnen getal),
  Pip's eigen 92% overgenomen met bronvermelding.
- Regressie tegen echte data (ipv aanname) leverde een echte afwijking op: Pip's "2 geboekt 10-9" vs
  data die "geannuleerd" toont. Dit soort kruischeck blijven doen, kost weinig en vindt echte fouten.
