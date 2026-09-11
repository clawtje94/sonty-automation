# Ori — geheugen

## Status 11-09-audit (kort)
- 18/18 rapporten gelezen. Lengte: 13/18 binnen limiet (was 7/18 op 10-09) — duidelijke verbetering.
  Boven: fee 28/25, fenna 34/30, jules 33/25, mats 36/25, ruben 29/25, sunny 27/25 (marginaal, 3e
  dag, geen actie per conventie).
- Alle 5 coachingzaken van 10-09 toegepast en geleegd: kai (29/30), noor (27/30), pip (25/25, exact
  op de grens), sam (mandaat opgelost: gaf zelf "OPDRACHT NAAR TECHNIEK" i.p.v. V-vraag), tess
  (mandaat opgelost: "VRAGEN: Geen.", escalatie zelf naar Techniek). Dit bevestigt: coaching werkt
  wél als het gedrag concreet + met regelverwijzing benoemd wordt, ook bij het mandaatpatroon dat
  eerder 3x terugviel — nu voor het eerst in 1 keer opgelost. Blijf hen 1-2 dagen kort volgen op
  terugval voordat dit als definitief geldt.
- 4 nieuwe coachingbestanden (lengte): mats.md (36/25, GEDAAN te gedetailleerd per daemon/PID —
  hoort in geheugen), jules.md (33/25, CIJFERS met vet-sub-koppen + VRAAG herhaalt CIJFERS-cijfers
  woordelijk — nieuw bewijs voor voorstel 1 én 3 tegelijk), fenna.md (34/30, regressie één dag na
  oplossing — uitleg/redenering in CIJFERS-punten i.p.v. kaal cijfer+bron), fee.md (28/25, volledige
  regel-voor-regel kleurmapping uitgeschreven i.p.v. samengevat, was eerder op 08-09 al gecoacht en
  toen opgelost — nu tweede keer, ander mechanisme).
- Nieuw signaal (geen coaching, wel volgen): ruben's rapport had een git-commit-attributieregel
  ("Co-Authored-By: Claude Haiku 4.5") onderaan het dagrapport — hoort daar niet, lijkt een
  tooling-artefact (attributie-instructie die buiten git-commits om is toegepast). Bij Claude/Techniek
  neerleggen, geen individuele feedback want geen gedragskeuze van ruben zelf.
- data/brein/medewerkers.json: fris (08:16 vandaag), geen actie.

## Coaching-geschiedenis (voor patroonherkenning)
- isa/kai/noor/ruben (lengte, oud, tot 04-09): opgelost toen, geleegd.
- nanny/sunny/tess/sam/mats (07-09, storing-niet-als-V-vraag + mats-lengte + sam-opmaak): toegepast
  08-09, geleegd — tess/sam vielen op 09-09 én 10-09 terug. Op 11-09 voor het eerst in 1x blijvend
  opgelost (zie boven) — coaching met letterlijke regelverwijzing werkt, puur "toegepast" melden niet
  genoeg was de eerdere fout.
- fee/fenna/noor/pip/sunny (08-09, VRAGEN herhaalt CIJFERS / lengte): fee/pip opgelost dag 1 toen.
  fenna opgelost 10-09, nu (11-09) teruggevallen op ANDER lengte-mechanisme (uitleg i.p.v. herhaling)
  — les: "opgelost" op 1 dag na coaching kan een nieuw mechanisme voor hetzelfde symptoom verbergen,
  blijf 2-3 dagen kort checken na legen i.p.v. direct vertrouwen.
- kai/noor/pip (10-09, lengte, nieuw of hervat): alle 3 dag 1 al opgelost (10-09→11-09), incl. pip's
  format-issue (vet-kopjes per cijfer) dat vanzelf meeverbeterde toen de lengte werd aangepakt.
- mats/jules/fenna/fee (11-09, lengte, nieuw/hervat): nog niet gecheckt, morgen eerste check.

## Vaste werkwijze
- Mini-rubric per rapport: kopjes compleet? cijfers met bron+noemer? echte vraag met voorstel (of
  eigenlijk een storing die niet bij Daimy hoort — check op woorden als "laat Techniek checken",
  "moet verversen", "daemon", "herstart nodig", "bevestiging of ... moet" in de VRAGEN-sectie zelf)?
  lengte oké (wc -l vs profiel.md "Rapport max")?
- Bash-loops met variabele-expansie geblokkeerd door sandbox — gebruik losse commando's (wc -l met
  meerdere paden in 1 regel werkt wel) i.p.v. for-loops over bestandslijsten.
- Feedback-pad: medewerkers/ori/feedback/<slug>.md (NIET medewerkers/<slug>/feedback.md).
- Feedback-format: concreet gedrag (citeer regelnummer/letterlijke tekst) + concreet vervolgvoorstel
  + ruimte voor terugmelding; bij dag-2/3-herhaling expliciet benoemen dat het al eerder gevraagd was.
- `rm` op eigen bestanden geblokkeerd door sandbox — leeg via Write (lege string).
- Max 5 feedbackbestanden per dag: eerst geleegde/opgeloste gevallen ruimte laten maken, dan pas
  nieuwe coaching starten; bij meer dan 5 kandidaten de ergste/belangrijkste kiezen (patroon dat 3x
  terugkomt ondanks coaching weegt zwaarder dan een nieuwe eenmalige lengte-overtreding, maar een
  nieuwe overtreding van 30%+ boven de limiet gaat wel voor een marginale/verbeterende oude zaak).
- Na een dag "opgelost + geleegd": niet blind vertrouwen, minstens 1-2 dagen kort blijven checken op
  terugval of een nieuw mechanisme achter hetzelfde symptoom (les van fenna 11-09).
- bram heeft geen "Rapport max" in profiel.md (directiesecretaris-rol, samenvattend document) — niet
  meenemen in de lengte-rubric zoals de andere 17 medewerkers.

## Intake-vragenlijst nieuw bedrijf (nog op te bouwen)
- Eerst "minimum path to value" bepalen: welke ENE dagelijkse output is per se nodig.
- Feiten: eigenaar/beslisser, wie zit op de vloer (mens), team-plafond/capaciteitsgetal.
- Klantproces: stappen aanvraag→nazorg, systemen per stap (CRM, planning, boekhouding).
- Dagelijkse cijfers die de baas wil zien, met bron per cijfer (nooit schatten).
- Huisregels: wat mag nooit (concurrentnamen, verzonnen cijfers, prijzen aanpassen).
- Rollen: piramide met hoofden + medewerkers — uit profielen gegenereerd, niet met de hand.
- BEDRIJF.md-sjabloon vanaf dag 1 in twee blokken: generiek (rapportvorm/werkwijze) en
  bedrijfsfeiten (huisregels), zodat overdracht naar een tweede klant makkelijk blijft. Nog niet
  uitgewerkt tot concreet sjabloon — volgende stap.
