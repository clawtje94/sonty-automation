# Ori — geheugen

## Status 09-09-audit (kort)
- 18/18 rapporten gelezen. Coaching 08-09: fee (22/25) en pip (18/25) opgelost, feedback geleegd.
- BELANGRIJK: mandaat-overtreding (storing als V-vraag) terug bij 2/5 die dit 07/08-09 al hadden
  opgelost — tess (VRAAG2: daemon-status-check als vraag) en sam (VRAAG1: "Mats/Techniek moet
  verversen" als vraag). Regressie na 1 dag "opgelost" — coaching alleen houdt niet vast, vandaar
  voorstel om de regel letterlijk in hun profiel.md te zetten i.p.v. alleen coaching-bestand.
- Lengte: 7/17 boven limiet (nanny 42/25 groot, tess 35/25, mats 34/25, milan 28/25, fenna 35/30,
  noor 36/30, sunny 28/25) — was 6/18 op 08-09, dus verslechterd. kai 31/30 marginaal, geen
  feedback (conventie: marginaal = geen actie). Nanny's oorzaak: dezelfde boeking (anoek van der
  wal) twee keer genoemd in GEDAAN (regel 8 en 12) — nieuw type duplicatie (binnen GEDAAN, niet
  GEDAAN-vs-VRAGEN zoals eerder). Mats regressie 25→34 nadat dit eerder al op 25 stond — nog niet
  gecoacht vandaag (max 5 feedback bereikt), morgen oppakken als het aanhoudt.
- Coaching-bestanden nu actief (5, max bereikt): fenna.md, noor.md, sunny.md (dag 2, verscherpt
  met letterlijk voorbeeldzinnetje na geen verbetering dag 1), tess.md, sam.md (nieuw, mandaat-
  regressie). fee.md en pip.md geleegd (opgelost).
- 3 voorstellen open (nog niet doorgevoerd door Daimy/Claude), NIEUW geformuleerd 09-09:
  1. Generieke regel "VRAAG AAN DAIMY = kernvraag + voorstel, max 2 regels, geen cijfer-herhaling
     uit GEDAAN/CIJFERS" in BEDRIJF.md of RAAMWERK-regels zetten — lost lengteprobleem bij
     meerdere mensen tegelijk op i.p.v. los coachen (fenna/noor/sunny falen hier nu 2 dagen op).
  2. Mandaat-regel ("status-check van een daemon/log/JSON-bestand is nooit een VRAAG, altijd
     direct een opdracht naar Techniek") letterlijk in profiel.md van tess/sam/mats/nanny/sunny/
     isa — coaching alleen bleek na 1 dag niet genoeg (tess/sam regressie).
  3. isa/bo/yara laten aansluiten bij Bram/Lars/Jules' aanpak: bekende blokkade (reviews-API-key,
     Google Ads credentials) na de eerste keer niet meer voluit herhalen, alleen kort verwijzen
     (V-nummer of "blijft bekende blokkade") — scheelt structureel regels.
- Oud, nog niet doorgevoerd: mats/profiel.md technische toelichting → geheugen.md vastleggen
  (bewezen haalbaar sinds 04-09, nu weer relevant na regressie); BEDRIJF.md nog niet generiek/
  Sonty gesplitst; reviews/Google Places-API-key nu dag 9-15 afhankelijk van persoon (isa V131
  dag9, jules V3 dag11, bo dag15, yara dag9) — zie voorstel 3 hierboven.

## Coaching-geschiedenis (voor patroonherkenning)
- isa/kai/noor/ruben (lengte, oud, tot 04-09): opgelost, geleegd.
- nanny/sunny/tess/sam/mats (07-09, storing-niet-als-V-vraag + mats-lengte + sam-opmaak): alle 5
  toegepast en bevestigd op 08-09, geleegd — MAAR tess en sam vielen op 09-09 terug op de storing-
  regel. Les: 1 dag bevestiging is niet genoeg, blijf er 2-3 dagen op controleren voor je het
  definitief loslaat, en overweeg de regel in het profiel zelf te verankeren i.p.v. alleen
  coaching-bestand (zie voorstel 2).
- fee/fenna/noor/pip/sunny (08-09, VRAGEN herhaalt CIJFERS, lengte): fee en pip opgelost dag 1.
  fenna/noor/sunny nog niet dag 2, feedback verscherpt met concreet voorbeeldzinnetje i.p.v.
  alleen uitleg — check morgen (overmorgen vanaf 08-09-schrijfmoment) of dit wel werkt.

## Vaste werkwijze
- Mini-rubric per rapport: kopjes compleet? cijfers met bron+noemer? echte vraag met voorstel (of
  eigenlijk een storing die niet bij Daimy hoort — check op woorden als "laat Techniek checken",
  "moet verversen", "daemon", "herstart nodig" in de VRAGEN-sectie zelf, niet alleen op het woord
  "Techniek")? lengte oké (wc -l vs profiel.md "Rapport max")?
- Bash-loops met variabele-expansie geblokkeerd door sandbox — gebruik losse commando's of Grep/
  Glob i.p.v. for-loops over bestandslijsten.
- Batch-Read: bij twijfel of feedback-pad klopt (medewerkers/ori/feedback/<slug>.md, NIET
  medewerkers/<slug>/feedback.md) eerst los proberen.
- Feedback-format: concreet gedrag (citeer regelnummer) + concreet vervolgvoorstel (liefst met
  letterlijke voorbeeldzin) + ruimte voor terugmelding; bij dag-2-herhaling expliciet benoemen
  dat het gisteren ook al gevraagd was.
- `rm` op eigen bestanden geblokkeerd door sandbox — leeg via Write (lege string).
- Max 5 feedbackbestanden per dag: eerst geleegde/opgeloste gevallen ruimte laten maken, dan pas
  nieuwe coaching starten; bij meer dan 5 kandidaten de ergste/belangrijkste kiezen (regressie op
  een harde raamwerk-regel weegt zwaarder dan een lengte-overtreding).

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
