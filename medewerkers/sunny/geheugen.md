# Geheugen Sunny — Klantenservice

## Leermomentenauto
- Snapshot.json: sleutel voor real-time status (wachtrijen, alarmen, tijdlijn) — grep gericht (te groot om full te lezen).
- Dagrapport verleden: check recente .md's in /medewerkers/sunny/dagrapport/ voor trend.
- Logs analyseren: grep "ACTIEF antwoord", "429", "FOUT" ipv alles lezen (7.3MB+).
- Gesprek-claims.json: bron voor boekingen/claims die Sunny deed.

## BLOKKEREND (vandaag 9-9)
1. **Anthropic credits OPGELOST**: credits-check.log toont "OK" vandaag 01:00, 03:00, 05:00. Crisis van 8-9 voorbij.
2. **John van Krimpen ESCALATIE URGENT**: Offerte 202612048 (EUR 3051,20) 12 dagen stil. Root cause: eerdere Claude-delegaties vastgelopen. Opdracht 5xo3pxhk naar Claude geplaatst. Wacht op afronding vandaag.
3. **Tickets-rapport daemon NIET GELADEN**: draait niet sinds 6-9 nacht. Geen vandaag-cijfers beschikbaar. Techniek-prioriteit — restart nodig.
4. **Trengo 429-overload + Planado sync**: backoff actief, maar nog niet opgelost. Cumulatief ~50.409. Techniek-prioriteit.

## Lopende zaken
- Do-not-contact-lijst (sinds 3-9): Christian Keus, Shammi Phull, Lotte Vos, +1 (bewust geen contact).
- Boekingen vandaag (8-9): 2 (claim 979001323 op 04:57, claim 979015487 eerder van 7-9).
- Ticket 979001323: buiten verzendvenster wacht tot 08:00, daarna verzenden als credits bijgevuld.

## Volgende diensten (9-9+)
- Anthropic credits: OPGELOST (OK vandaag 01:00+). Tickets kunnen nu verstuurd worden.
- Hans de Lamboij: wacht op Isa-rapport/update (bel was target 11:00 op 8-9).
- Tickets-rapport daemon: wacht op techniek-herstart. Daarna dagcijfers van 8-9 en 9-9 beschikbaar.
- Stille-klanten do-not-contact (Keus, Phull, Vos, +1) handhaven: niet bereiken.

## REGELS (sinds 3-9 Daimy-opdracht)
- Stille-klanten-drempel: WhatsApp/chat >2u, mail >24u.
- Do-not-contact-lijst: Keus, Phull, Vos, +1 — niet monitoren, niet bereiken.
- Hans de Lamboij: uitzondering, blijft top-item tot Isa hem belt.
- Escalatietriggers scherper toepassen: (1) expliciet — klant vraagt om mens, (2) vertrouwen — ik twijfel, (3) context — frustratie/geld/prijs/herhaald. Bij twijfel over prijs/coulance meteen escaleren.

## Bijscholing 2026-09-07, update 2026-09-08, status 2026-09-09
- Vakkennis.md ververst: WhatsApp-norm scherper (20-60 sec, was 1-2 min), mail <4u, FCR 70-85% als kernmetriek.
- Nieuw: "context package" bij overdracht naar Daimy/Isa (vraag+geprobeerd+beslissing), i.p.v. los transcript.
- Escalatietriggers expliciet benoemd — **INGEGAAN SINDS 8-9** (was voorstel, nu regel).
- Nieuw: bij drukte eerst wachtrij/snapshot checken, niet op laatste losse bericht reageren.
- **Feedback Ori (8-9)**: bugfixes (credits, daemon, Planado) direct naar Techniek als opdracht, niet als V-vragen.
- **Status 9-9**: credits opgelost ✓, daemon nog steeds down, rapport max 25 regels nu bereikt (was 31 gisteren).
