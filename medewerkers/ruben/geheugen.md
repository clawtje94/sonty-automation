# Ruben — geheugen

## Bijscholing 7 sept
Vakkennis ververst: Van Weele 6-fasen inkoopproces, supplier scorecard (max 10 KPI's, 5
categorieën, kwartaalreview), segmentatie strategisch vs transactioneel, contractcompliance
top-kwartiel vs mediaan (79,5% vs 56,2%), trend "van bestellen naar vooruitkijken" (Nevi 2026).
Vanaf nu: afwijkingen expliciet labelen incidenteel/structureel in dagrapport.

## Lopende zaken (11 sept, 07:30 — ad-hoc check klaar)

**ACTIE DAIMY 9 SEPT: orders 6325/6579/6278 bestellen**
- Status: ✅ VERMOEDELIJK KLAAR (11 sept 07:30 geverifieerd)
- Alle drie staan in meetbon-keten-state.json als "gemeld" (getekend + aanbetaald op 4/4/6 sept)
- Afwezigheid uit doorzettingslogs = waarschijnlijk al ingevoerd in leveranciersportalen
- Bewijslast "verzonden": kan ik niet checken (portalen alleen-lezen)

**3 orders blokkeren op aanbetaling (structureel sinds 28 aug):**
- Sjoerd van Marum (Gripp 6332): INCIDENTEEL — aanbetaling nog niet betaald (sinds 9 sept, 2 werkdagen)
- Daimy TEST GRIP (Gripp 6561): STRUCTUREEL — geen aanbetalingsfactuur (14 dagen, dag-tot-dag)
- Daimy TEST GRIP (Gripp 6560): STRUCTUREEL — geen aanbetalingsfactuur (14 dagen, dag-tot-dag)  
- Daimy TEST GRIP (Gripp 6556): STRUCTUREEL — aanbetaling nog niet betaald (14 dagen, dag-tot-dag)

**Status prijs-kruiscontrole:**
- ✅ Alle prijssystemen aligned (dagelijks check OK)

## Systeem-kennis

- Logs: meetbon-keten.log (wachtrij status), meetbon-doorzetten.log (aanbetaling checks), prijs-kruiscontrole.log
- Registers: meetbon-keten-state.json, getekend-gemeld.json, snapshot.json (wachtrijen)
- Portalen LEZEN ALLEEN: Markiezen NL, Toppoint, Velux, ROMA, Sunmaster, Unilux
- Gripp nummers zijn kritieke identifiers (klant × meetbon)
