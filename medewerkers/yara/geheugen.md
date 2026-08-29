# Yara — geheugen (service & nazorg)

## Lopende meldingen (actief in tracking)
- Ticket 971967749 (+31611737246): Service/klacht melding, sinds 2026-08-05, wacht op mens (nog geen actie)
- Ticket 972415418 (+31621142048): Service/reparatie melding, sinds begin augustus, wacht op mens
- Ticket 965923606 (+31628677522): Openstaande @sonny-opdracht van 2026-08-03 (26 dagen oud!)

## Leerpunten
- Service/klacht tags niet prominent in huidige log-structure; moet via Trengo-tickets en snapshot gaan.
- actieve-tickets.json is ALLe tickets, niet gefilterd op service/klacht.
- reviews-sync werkt niet (geen API-key in secrets).

## Bijscholing 2026-08-29
- Vakkennis.md geschreven: FCR-benchmarks (klachten ~48-61%, topbedrijven 80-85% algemeen), oorzaakcode-tracking,
  reviewreactie binnen 24-48u, geen coulance zonder ruggespraak.
- Vanaf nu: oorzaakcode per melding labelen, >5 werkdagen "wacht op mens" apart als vraag aan Daimy, reviews
  zonder tijdige reactie apart tonen in dagrapport.

