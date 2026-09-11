# Geheugen Sunny — Klantenservice

## Leermomentenauto
- Snapshot.json: sleutel voor real-time status (wachtrijen, alarmen, tijdlijn) — grep gericht (te groot om full te lezen).
- Dagrapport verleden: check recente .md's in /medewerkers/sunny/dagrapport/ voor trend.
- Logs analyseren: grep "ACTIEF antwoord", "429", "FOUT" ipv alles lezen (7.3MB+).
- Gesprek-claims.json: bron voor boekingen/claims die Sunny deed.

## BLOKKEREND (vandaag 11-9)
1. **Anthropic credits OPGELOST**: credits-check.log toont "OK" vandaag 01:00, 03:00, 05:00. Crisis voorbij.
2. **Tickets-rapport daemon NIET GELADEN**: draait niet sinds 6-9 nacht. Geen vandaag-cijfers beschikbaar. Techniek-prioriteit — restart nodig. Rapportage vervangen door handmatig tellen: gisteren (10-9) 5 claims in gesprek-claims.json.
3. **Trengo 429-rate limiting**: backoff actief, ~20+ retries vandaag. Impact: trage bericht-verwerking op /tickets/976126888, /tickets/976979121.
4. **ESCALATIE-BREAKAGE**: ticket 979406422 staat 1075+ min onbeantwoord NA overdracht naar mens (geen respons) — bot pakt het terug op. Teken dat overdrachten niet correct afgehandeld worden.

## Lopende zaken
- Do-not-contact-lijst (sinds 3-9): Christian Keus, Shammi Phull, Lotte Vos, Hans de Lamboij (bewust geen contact).
- Boekingen gisteren (10-9): 5 claims (tickets 978118850, 979541600, 979557888, 979597692, 979709789).
- Hans de Lamboij: wacht op Isa-update (bel target was 8-9 11:00, nu 36h+ stil).

## Volgende diensten (11-9+)
- Ticket 979406422: escalatie-breakage, 1075+ min zonder respons na overdracht → Daimy/Techniek onderzoeken.
- Tickets-rapport daemon: wacht op techniek-herstart (maandag controle voor weerapport?).
- Stille-klanten do-not-contact (Keus, Phull, Vos, Lamboij) handhaven: niet bereiken.

## REGELS (sinds 3-9 Daimy-opdracht)
- Stille-klanten-drempel: WhatsApp/chat >2u, mail >24u.
- Do-not-contact-lijst: Keus, Phull, Vos, +1 — niet monitoren, niet bereiken.
- Hans de Lamboij: uitzondering, blijft top-item tot Isa hem belt.
- Escalatietriggers scherper toepassen: (1) expliciet — klant vraagt om mens, (2) vertrouwen — ik twijfel, (3) context — frustratie/geld/prijs/herhaald. Bij twijfel over prijs/coulance meteen escaleren.

## Bijscholing 2026-09-07, feedback Ori 2026-09-09, status 2026-09-11
- Vakkennis.md ververst: WhatsApp-norm scherper (20-60 sec), mail <4u, FCR 70-85% als kernmetriek.
- Escalatietriggers: (1) expliciet, (2) vertrouwen, (3) context/frustratie/herhaald. **ACTIEF SINDS 8-9**.
- Feedback Ori: rapport max 25 regels, geen dubbel noemen (Hans de Lamboij slechts 1x).
- **Status 11-9 BIJGEWERKT**:
  - Ticket #977435053: 178u stilstand opgelost. Vraag: "is inmeten vrijblijvend?". Antwoord: gratis bij akkoord, EUR 75 anders. Via brein-delegatie verzonden.
  - Credits opgelost ✓, tickets-rapport-daemon nog down (5de dag!), Trengo 429 actief.

## Gelopen opdrachten (11-9)
- **Opdracht grv40y5u** (ad hoc van Daimy 05:51): Beantwoord ticket #977435053 — klant vraag inmeting. Regel toegepast: gratis bij akkoord, EUR 75. Delegatie gestuurd naar brein.
