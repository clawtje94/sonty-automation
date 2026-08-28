# Sunny plant inmeten zelf — ontwerp + orakel (28-08-2026)

Opdracht Daimy (28-08, /goal): "Sunny zelf, zodra iemand op Inmeten inplannen komt, op een
menselijke manier de beste tijd aanbieden en inboeken, zoals nu met het inmeet-dashboard is
gedaan. Er mogen geen dubbele mails en dubbele berichten komen."
Dit is V7 (eerste aanbod automatisch bij nieuwe kaart, open sinds 26-08) + V8 (23-08:
wens ophalen) in één, uitgevoerd door Sunny in het gesprek.

## Wat er al is (hergebruik, niet herbouwen)
- Detectie: verzoek-daemon (RP-scan, `reken`-route) + 30-min schaduwplanner zetten kaarten
  op het dashboard met `top` (beste tijden, aantalTijden=1 = één beste tijd).
- Verzenden: `maakEnVerstuurAanbod` → `lib/aanbod-versturen.js` (WA vrij bericht binnen 24u,
  anders template; mail via aanvragen@), poort `lib/verzend-poort.js` (stil-lijst,
  mens-actief 1,5u/24u, max 2 voorstellen/week, fail-closed bij Trengo-storing).
- Gesprek: Sunny-tools `inmeet_tijden`/`inmeet_boeken`/`inmeet_annuleren` (akkoord-citaat-guard),
  gesprek-claims (30 min) houden aanbod-replies + laatste-woord-check weg.
- Boeken: `/api/inmeet-mutatie` type `boek` → verzoek-daemon → dubbelboek-controle, Outlook,
  Planado, 1x bevestiging, register `data/inmeet-boekingen.json`, nacontrole elke 30 min.
- Dashboard: `/api/inmeet-dashboard` (extraLead, status), klik "ECHT boeken"/"keuzelink".

## Wat er bij komt (de bouw)
1. **Automatische start** (V7): nieuwe kaart op Inmeten inplannen → binnen de verzendvenster
   (08:30–20:00, anders wachtrij tot 08:30) stuurt de keten ZELF het eerste voorstel.
   Idempotent op `rpItemId`: één open voorstel per klant, write-ahead vastgelegd VÓÓR verzenden.
2. **Sunny als afzender in het gesprek**:
   - WA-gesprek met klantbericht < 24u → Sunny schrijft het voorstel zelf (menselijk, één beste
     tijd + "past dat, of vanaf wanneer komt het uit?"), stuurt OUTBOUND, claimt het gesprek.
   - WA-gesprek ouder dan 24u → goedgekeurde template met de tijd (Meta-regel; geen keuze),
     daarna neemt Sunny het gesprek over bij het eerste antwoord.
   - Geen WA → mail (menselijk geschreven, één beste tijd, antwoorden = gewoon terugmailen);
     antwoord loopt via de mail-daemon met Sunny.
3. **Antwoorden**: bestaand — akkoord (citaat) → `inmeet_boeken`; ander moment → nieuw
   voorstel (max 2 herplans/dag); annuleren/klacht/ander adres → mens. Geen keuzelink meer
   nodig in het Sunny-pad.
4. **Dashboard**: kaart toont "Sunny: voorstel gestuurd <tijd>" i.p.v. "aanbod-mogelijk";
   kantoor kan nog steeds ECHT boeken (klant aan de telefoon) → Sunny's voorstel wordt
   ingetrokken en Sunny meldt dat niet dubbel.

## ORAKEL — wat er HOORT te gebeuren (beleid, los van de code)
O1  Eén klant krijgt op één dag hooguit ÉÉN voorstel, tenzij de klant zélf om een ander moment
    vroeg (dan max 2 herplans/dag). Nooit twee voorstellen binnen 1 uur, uit welke route dan ook.
O2  Eén open voorstel per klant over ALLE routes (Sunny, dashboard-klik, schaduwplanner,
    aanbod-replies, herplan). Een tweede route ziet het open voorstel en doet NIETS (zichtbaar
    gelogd, niet stil).
O3  Eén bevestiging per boeking. Nacontrole stuurt alleen als er aantoonbaar géén is.
O4  Nooit een tweede bericht in hetzelfde gesprek binnen 60 s (race-slot: write-ahead sleutel).
O5  Kanaalkeuze: WA-gesprek < 24u → vrij Sunny-bericht; WA > 24u → template; geen WA → mail.
    Nooit WA én mail tegelijk voor hetzelfde voorstel (Daimy: "dubbele mails en berichten").
O6  Mens-actief (collega schreef < 1,5 u geleden) → Sunny stuurt niets, kaart blijft staan met
    reden. Stil-lijst → nooit. Max 2 voorstellen/week → mens nodig, geen retry-spam.
O7  Verzendvenster 08:30–20:00 NL-tijd, ma–za. Daarbuiten wachten, niet vergeten.
O8  Taal: Engels-vlag → alles Engels (voorstel, template, mail, bevestiging).
O9  Klant zonder telefoon én zonder e-mail → mens nodig, zichtbaar.
O10 Klant die al een boeking heeft (geboekt, niet geannuleerd) → geen voorstel; kaart weg.
O11 Klant in RP terug van Inmeten inplannen (status weg) → open voorstel intrekken, niets sturen.
O12 Geen slot binnen de horizon → eerlijk bericht "we bellen/appen je zodra er ruimte is" 1x,
    daarna mens nodig; geen herhaling.
O13 Akkoord van de klant telt alleen als het na het voorstel kwam en dezelfde dag/tijd noemt of
    kaal "ja" is; een andere dag noemen = herplan-wens, geen boeking (26-08-les).
O14 Sunny's voorstel wint niet van een lopend keuzelink-aanbod: bestaat er al een aanbod met
    token, dan doet Sunny niets tot dat is afgehandeld/verlopen.
O15 Crash halverwege (na write-ahead, vóór verzenden) → volgende ronde stuurt ALSNOG 1x, niet 0x
    en niet 2x (verzendstatus expliciet: 'gepland' → 'verstuurd' → 'beantwoord').
O16 Alles wat NIET verstuurd wordt, is zichtbaar (dashboard-reden + planning-overzicht 17:30);
    stilte is een fout.

## Dimensies voor het lab (matrix)
- kanaal: wa<24u | wa>24u | wa-gesloten | alleen-mail | geen-contact
- taal: nl | en
- bestaand: niets | open-keuzelink | open-sunny-voorstel | geboekt | geannuleerd | max-voorstellen
- mens-actief: nee | 20min | 2u | 25u ; stil-lijst: nee | ja
- tijd: 07:00 | 09:00 | 19:59 | 20:01 | zondag
- slot: 1 | 0 | ver-weg(>3wk) ; klantgegevens: compleet | geen-tel | geen-mail | geen-adres
- samenloop: dashboard-klik tegelijk | schaduwronde tegelijk | aanbod-replies tegelijk | crash-na-writeahead
- klantantwoord: ja | ja+andere-dag | ander moment | annuleren | vraag | stilte 24u | EN-ja
- keten-moment: kaart net nieuw | kaart 3 dgn | RP-status weer weg

Rapportvorm: totaal, per bak (OK / TERECHT-GEBLOKKEERD / FOUT-ZICHTBAAR / FOUT-STIL), alleen afwijkingen.
