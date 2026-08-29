# Ruben — geheugen

## Lopende zaken (29 aug)

**4 orders blokkeren op aanbetaling:**
- Daimy TEST GRIP (Gripp 6561): geen aanbetalingsfactuur gevonden
- Daimy TEST GRIP (Gripp 6560): geen aanbetalingsfactuur gevonden  
- Daimy TEST GRIP (Gripp 6556): aanbetaling nog niet betaald
- Martin Valentin (Gripp 6489): status fluctueert (geen factuur ↔ niet betaald)

Symptoom: meetbon-doorzetten.log herhaalt elke minuut dezelfde 4 orders.

**DAIMY OPDRACHT (29 aug 21:52):**
- Morgen (30 aug) Gripp 6489 (Martin Valentin) en 6556 (Daimy TEST) nogmaals checken
- Als aanbetaling er nog niet is → **Ruben belt de klant zelf** voor status
- (6560 en 6561 buiten beschouwing — geen actie daar nu)

**Prijs-kruiscontrole technisch gebroken:**
- spawnSync npx ENOENT — live-API-meetlat kan niet draaien
- Risico: website en bot zeggen verschillende prijzen
- Meestal alle checks groen (prijssystemen aligned)

## Systeem-kennis

- Logs: meetbon-keten.log (wachtrij status), meetbon-doorzetten.log (aanbetaling checks), prijs-kruiscontrole.log
- Registers: meetbon-keten-state.json, getekend-gemeld.json, snapshot.json (wachtrijen)
- Portalen LEZEN ALLEEN: Markiezen NL, Toppoint, Velux, ROMA, Sunmaster, Unilux
- Gripp nummers zijn kritieke identifiers (klant × meetbon)
