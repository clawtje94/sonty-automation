# SAM's GEHEUGEN

## Lopende zaaken

### Aanbetaling-blokkade: updates (2026-09-09)
**STATUS (09-09):**
- Gripp 6556 (Daimy TEST GRIP): **BEVESTIGDE TEST** — geen teller.
- Gripp 6489 (Martin Valentin): **ECHTE KLANT** — aanbetaling onbetaald sinds 29-08 (nu 11 dagen). Doorgezet naar orders@ 02-09. Wacht Daimy: vervaldatum + herinneringsschema.
- Gripp 6332 (Sjoerd van Marum): **NIEUW 08-09** — getekend maar GEEN aanbetalingsfactuur. Eigenaar (wie voert uit) TBD.
→ **Daimy nodig (09-09)**: (1) gripp-facturen-open.json vandaag verversen (Mats); (2) 6332 eigenaar; (3) 6489 vervaldatum + herinneringsschema.

### Controleverloop (4 punten):
1. **Getekend zonder aanbetalingsfactuur**: 2 testcases (6560, 6561) — geen live-afwijkingen 03-09 (bron: meetbon-doorzetten.log)
2. **Aanbetaling onbetaald >7 dagen**: 2 orders (6489 Martin, 6556 test) — bedragen onbekend, vervaldatums Daimy-nodig
3. **Factuur open >14 dagen**: **28 van 60 open** (€43.061) — bron: gripp-facturen-open.json 01-09 ✅ LIVE
4. **Gemonteerd zonder factuur**: onbekend (93 werkbonnen vs 60 facturen) — werkbon-daemon stuk, exact getal TBD

### Nieuw: gripp-facturen-open.json (Mats, 01-09)
- 1.4MB, 36.236 regels, vervangt 3.1MB+ gripp-alle-facturen.json
- Open: 60 (€105.979) | Open >14d: 28 (€43.061)

### Luuk Post in Gripp invullen (18 dagen)
- Sinds 13 aug, 2 offerteversies niet getekend
- Milan/Ruben volgen, niet mijn directe gebied

## Notities
- Diensten 29-08, 31-08, 01-09, 03-09 uitgevoerd
- Vier controlepunten: bronnen beschikbaar (behalve #4 = werkbon-daemon-afhankelijk)
- **Brondatabank OPGELOST**: gripp-facturen-open.json (Mats) werkt voor controlepunt 3

### Bijscholing 2026-09-07 (vervangt versie 29-08)
- Vakkennis ververst: sectorbenchmarks DSO (installatie/bouw ~50-60d, hoger dan gemiddeld is normaal),
  ADD (vermijdbare vertraging, norm <10d) toegevoegd, CEI >80% goed / >90% sterk, bad debt <1,5%
  sectorafhankelijk. Segmentatie op klantrisico toegevoegd; milestone-facturen mogen kortere
  vervaltermijn (7-10d) hebben dan reguliere 30d-factuur.
- Bronnen: accounting.events, Resolut AI, BQE/Depositfix, Indeed NL, VVCM, Stripe.
- Vanaf nu: ADD noemen naast DSO/CEI zodra brondata er is; sector-context bij cijfers vermelden.

### Vorige diensten
- 2026-08-29: Vakkennis vastgesteld
- 2026-08-31: Eerste rapport + vier controlepunten
- 2026-09-01: Brondatabank-probleem opgelost (Mats → gripp-facturen-open.json)
- 2026-09-02: Martin Valentin (6489) doorgezet naar orders@; werkbonnen 93 open
- 2026-09-03: Alle vier controlepunten met bronnen geverifieerd; wacht Daimy-besluit 6489/6560/6561
- 2026-09-04: Controle herhaal (snapshots 01-09 nog actueel; geen vandaags-updates gripp-facturen-open.json). Werkbon-daemon nog steeds stuk. Drie V-vragen aan Daimy gesteld.
- 2026-09-07: Wekelijkse bijscholing, vakkennis.md vernieuwd (zie hierboven); vier controlepunten geverifieerd, status ongewijzigd sinds 04-09. Werkbon-daemon nog offline.
- 2026-09-08: Controle herhaal (meetbon-doorzetten.log 08-09 07:01). NIEUW: Gripp 6332 (Sjoerd van Marum) zonder aanbetalingsfactuur gedetecteerd. gripp-facturen-open.json nog van 01-09 (STALE 7 DAGEN). Werkbon-daemon rapport bij Techniek.
- 2026-09-09: Logs gelezen (meetbon-doorzetten 05:01 = 0 entries), vier controlepunten geverifieerd. gripp-facturen-open.json CONFIRMED STALE (01-09 07:56, nu 8 dagen oud). Vraag aan Mats/Techniek voor vandaag-verversen. Gripp 6332 eigenaar TBD.
