# Vakkennis Sam — Facturatie en debiteuren (bijgewerkt 2026-09-07)

## Zo werken de besten (10-15 concrete regels)
1. Koppel elke deelfactuur aan een meetbaar mijlpaal (getekend, gemonteerd), nooit aan een datum.
2. Stuur de factuur direct na het mijlpaal; milestone-facturen mogen een kortere vervaltermijn hebben
   (bijv. 7-10 dagen) dan een normale factuur van 30 dagen, juist omdat de klant net iets tastbaars
   heeft ontvangen (bqe.com/depositfix, milestone billing).
3. Elke factuur toont: totaalbedrag order, al gefactureerd, openstaand saldo — voorkomt onduidelijkheid.
4. Begin de opvolging vóór de vervaldatum: een check-in bij het versturen werkt beter dan pas actie
   na het verstrijken van de termijn (aging best practices, Stripe/Emagia).
5. Herinneringen zijn een vaste reeks met vaste termijnen (bijv. dag 0, +7, +14), geen ad hoc actie;
   automatiseer de reeks maar houd menselijk oordeel bij strategische accounts (Resolut AI).
6. Aging-overzicht (0-30 / 30-60 / 60-90 / 90+ dagen) wekelijks doorlopen; hoe ouder de post, hoe
   kleiner de kans op betaling — na 90 dagen nog maar circa 18% kans (Emagia/Stripe).
7. Signaleer afwijkingen vroeg: een order die getekend is maar geen aanbetalingsfactuur heeft, is een
   procesfout, geen debiteurenprobleem — dat verschil moet in het rapport blijven staan.
8. Splits altijd per stap in de keten (getekend → aanbetaling → montage → eindfactuur); meng geen
   totalen van verschillende stadia.
9. Segmenteer debiteuren op risico en belang (betaalgedrag, factuurkwaliteit, account-omvang), niet
   op factuurbedrag alleen — behandel een vaste goede klant anders dan een chronische wanbetaler
   (Resolut AI, intelligent risk segmentation).
10. Nooit zelf coulance, kwijtschelding, betalingsregeling of vroegbetalingskorting toezeggen: een
    korting mag pas als de marge op accountniveau dat kan dragen — dat is een beslissing, geen
    registratie (Resolut AI).
11. Digitale betaalmogelijkheden (iDEAL-link, klantportaal met factuurinzage) verkleinen de afstand
    tussen levering en betaling; vermeld dat als voorstel, niet als eigen actie.
12. Wekelijks/maandelijks ritme: operationeel (nieuwe achterstanden, opvolging) wekelijks, KPI's
    (DSO, CEI, bad debt ratio) maandelijks voor strategische besluiten.
13. Bewaar brondiscipline: een bedrag of dag-telling zonder brondocument wordt "onbekend", nooit
    geschat of afgerond.
14. Bind milestones aan een aantoonbaar, controleerbaar resultaat (getekende offerte, afgetekende
    werkbon), niet aan een geplande datum — dat voorkomt discussie met de klant over of de stap al
    "af" is (bqe.com/procore, milestone billing).

## Dagelijkse routine van een topper (kort, in volgorde)
1. Aging-overzicht/register doorlopen: wat is sinds gisteren bijgekomen of verschoven.
2. Vier controlepunten checken: getekend zonder aanbetalingsfactuur, aanbetaling >7 dagen onbetaald,
   factuur >14 dagen open, gemonteerd zonder factuur.
3. Afwijkingen per klant/order vastleggen met brondatum, niet met een geschat bedrag.
4. Alleen registreren en signaleren; opvolgacties (bellen, herinneren, regeling, korting) naar de
   beslisser.
5. Rapport bijwerken met cijfers + noemer, vragen aan de baas puntsgewijs.

## Cijfers waarop de besten sturen (KPI's en normen, met bron)
- DSO (Days Sales Outstanding): algemeen gezond onder 45 dagen; sectorbenchmarks lopen sterk uiteen
  — bouw/installatie ligt van nature hoger, rond 50-60 dagen, door langere projectcycli
  (accounting.events, credit control metrics 2026).
- Average Days Delinquent (ADD = DSO minus best haalbare DSO, dus de "vermijdbare" vertraging):
  onder 10 dagen is sterk, boven 20 dagen wijst op een procesprobleem (accounting.events).
- Collection Effectiveness Index (CEI): boven 80% is voldoende, boven 90% is sterk, wereldklasse
  organisaties zitten boven 95% (accounting.events / Esker-achtige benchmarks).
- Bad debt ratio: bij goed presterende organisaties onder 1,5%, sterk sectorafhankelijk (IT <5%,
  bouw soms >14%) (accounting.events, invensis.net).
- Invoice dispute percentage: hoe vaak een factuur betwist wordt vóór betaling — vroege indicator
  voor procesfouten in de keten (invensis.net).

## Valkuilen die de besten vermijden
- Wachten tot na de vervaldatum om iets te doen: dan is het al een probleem in plaats van een check-in.
- Bedragen/percentages door elkaar rapporteren zonder aan te geven uit welk stadium (aanbetaling vs
  eindfactuur) ze komen.
- Zelf coulance, afschrijving of vroegbetalingskorting toepassen zonder mandaat en zonder marge-check
  — credit control registreert en signaleert, beslist niet.
- Eén totaalcijfer noemen zonder noemer (bijv. "5 open" zonder "van de 40 lopende orders").
- Facturatie laten liggen tot een vast maandmoment in plaats van direct na het mijlpaal te sturen.
- Alle debiteuren gelijk behandelen in de herinneringsreeks in plaats van te segmenteren op risico
  en klantbelang (Resolut AI).

## Wat ik hiervan vanaf morgen anders doe (3 punten, concreet)
1. Ik voeg ADD (vermijdbare vertraging) toe als denkkader naast DSO/CEI in mijn wekelijkse duiding,
   zodra er genoeg brondata is om een DSO-basislijn te berekenen (nu nog niet: bron ontbreekt).
2. Ik blijf de vier controlepunten elke dienst in dezelfde volgorde en noemer rapporteren, en noem
   er expliciet bij welke sector-context (installatie/bouw) een hogere DSO normaal maakt, zodat
   Daimy geen paniek krijgt van een cijfer dat op zich binnen de branche normaal is.
3. Bij elke ## VRAGEN AAN DAIMY over coulance, korting of regeling zet ik zowel een termijnvoorstel
   (dag 0/+7/+14) als een risicosegment-opmerking (vaste klant vs eenmalig, bedrag) neer, zodat
   Daimy in één oogopslag kan beslissen.

## Bronnen
- [The Credit Control Metrics That Actually Matter (2026, with Benchmarks)](https://accounting.events/resources/credit-control-metrics/) — DSO/ADD/CEI/bad debt met sectorbenchmarks 2026, basis voor de cijfersectie hierboven.
- [10 B2B Collections Best Practices for 2026 — Resolut AI](https://www.resolutai.com/blog/b-2-b-collections-best-practices) — segmentatie, automatisering met menselijk oordeel, vroegbetalingskorting alleen bij marge-ruimte.
- [Milestone Billing 101 — BQE](https://www.bqe.com/blog/what-is-milestone-billing-why-your-firm-may-need-a-phased-billing-model) en [Milestone Billing: The Complete Guide for Contractors — Depositfix](https://www.depositfix.com/blog/milestone-billing) — mijlpalen koppelen aan deliverables, kortere vervaltermijn voor milestone-facturen.
- [Credit controller functieomschrijving — Indeed](https://nl.indeed.com/personeel/functiebeschrijving/credit-controller) — wat Nederlandse werkgevers vragen van deze functie (taken, ervaring, VVCM-lidmaatschap).
- [Vereniging Voor Credit Management — opleidingen](https://verenigingvoorcreditmanagement.nl/opleidingen/certified-credit-manager/) — Nederlandse branchevereniging, erkende opleidingslijn Certified Credit Practitioner/Controller/Manager.
- [Accounts receivable aging explained — Stripe](https://stripe.com/resources/more/accounts-receivable-aging-explained-what-it-is-how-it-works-and-how-to-calculate-it) — onderbouwing dat kans op betaling sterk daalt naarmate een post ouder wordt (~18% kans na 90 dagen).
