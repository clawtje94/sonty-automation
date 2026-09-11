# Nanny — geheugen

**Laatst bijgewerkt**: 2026-09-11 07:00 (ochtendrapport)

## Lopende zaken

1. **Wachtrij-cleanup**: 4 reguliere klanten > 5 werkdagen wachtend (36 dgn vandaag 09-09):
   - Daimy TEST GRIP (sinds 4 aug — testdata; uitsluiten)
   - unknown×1 (sinds 5 aug; onverklaard)
   - Josua Lausberg (sinds 5 aug, **cadans week 2 — VANDAAG contact starten**)
   - Kirsten de Koning (sinds 5 aug, **cadans week 2 — VANDAAG contact starten**)
   - Marco Klok (sinds 5 aug, **cadans week 2 — VANDAAG contact starten**)
   → Status 09-09: Klaar voor week-2 contact (automatiek loopt; geen V meer nodig).

2. **Outlook-Planado SYNC-FOUTEN**: Structureel: FOUT 422 "external_id is used by another entity". Mats gemeld 07-09, Techniek-opdr. Status 09-09 04:53: 22 FOUTEN nog aanwezig. → Patroon houdt aan; monitoren.

3. **Boekingen afgelopen 24u**: anoek van der wal (ma 21 sep 08:00, Joey); Beuker (ma 28 sep 12:30, onbekend inmeter); Thea Kuiper (do 10 sep 15:30, Joey). Alle nacontroleerd → OK.

4. **Stil-lijst**: 5 klanten (30+ dgn geen contact)
   - Christian Keus: Sunny dag-3 check vorig weekend (31-08). Geen update 09-09 — VANAVOND bijzonder checken.
   - Shammi Phull, Hans de Lamboij, Lotte Vos, +1: no updates gisteren

## Systeem-notes (11-09)

- Aanbod openstaand: 6 klanten wachtend
- Aanbod verstuurd 24u (10-11 sept): 1 voorstel (Mirthe Kroon, 07:24 van 10-09)
- Aanbod klant-reacties 24u: 0 
- Nanny-daemons: OK (inmeet-verzoeken, aanbod-replies, boeking-nacontrole draaien)
- Sunny hartslag: onbekend (Yara rapport 10-09 geen update)
- **Techniek-alarmen**: outlook-planado-sync FOUTEN FOUT 422 patroon houdt aan (Mats genoteerd 07-09). HTTP 409 ronde-fout 10-09 16:11.

## Vakkennis (bijscholing 2026-09-07, vakkennis.md ververst)

- Wachtrij >5 werkdagen: cadans-check VÓÓR verlopen markering (meerdere contactmomenten over 2-3 weken nodig)
- Mislukte mutaties: uitgesplitst per oorzaak (klant stil / systeemfout / dubbele boeking)
- Boeking-zonder-bevestiging: apart melden als systeemmismatch (Outlook/Planado/Bookings sync-check)
- Nieuw: bij no-show-risico SMS voorstellen voor laatste herinnering (98% open rate vs 20-25% mail)
- Nieuw: vrijgekomen slot moet binnen minuten automatisch naar wachtlijst; afwijking apart melden
- Nieuw: geografische spreiding van boekingen (Joey/Sjoerd) als aandachtspunt signaleren, niet alleen "gepland" afvinken

## Feedback & Aanpassingen (Ori 08-09)

- **Tech-vragen NIET als V naar Daimy**: direct als "bugfix genoteerd voor Techniek" in GEDAAN
- **Check Mats' rapport EERST**: voordat je bekende storing opnieuw meldt
- **Ori feedback toegepast**: 
  1. Sync-fout genoteerd bij GEDAAN, NIET als V (Mats gemeld 07-09)
  2. Cadans-check: V aan Daimy voor ACTIE-plan (week 2 start), niet voor diagnostiek

## Vorige diensten

- **2026-09-11 07:00**: Monitoring. 1 annulering (Helma Blokzijl, Outlook-verwijdering 10-09). 1 aanbod verstuurd (Mirthe Kroon, 10-09). 0 klant-reacties. Cadans week-2 lopend. HTTP 409 fout gisteren 16:11; FOUT 422 Outlook-Planado patroon. 
- **2026-09-10 07:00**: Monitoring. 3 boekingen nacontroleerd (ok). 4 aanbodvoorstellingen openstaand (0 reacties). Sync-fouten FOUT 422 patroon houdt aan. Cadans week-2 contact gereed. Christian Keus wacht op bijzondere controle.
- **2026-09-09 07:00**: Monitoring. 1 boeking (anoek van der wal). Sync-fouten patroon. Cadans week 2 gereed.
- **2026-09-08 07:00**: 2 boekingen nacontroleerd (ok). Wuisman via Sunny. Dashboard ververst.
- **2026-09-07 07:00**: Wachtrij > 5 werkdagen gescand, cadans-check voorstel opgesteld.
