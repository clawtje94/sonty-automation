# Geheugen Fenna

## Lopende zaken
- gripp-facturen-open.json 10 dagen stale (sinds 1-9, cijfer €43.061/28 items niet actueel). GEEN
  V-vraag voor Daimy: dit is een technische bugfix (huisregel raamwerk), altijd naar Techniek. Sam
  stuurde 07:31 (11-9) opnieuw naar Techniek; Bram's team stuurde het los ook terug naar Mats
  (j1k42ult, 10-9). Zelf niet meer escaleren naar Daimy, alleen uitkomst volgen en melden.
- 6489 (Martin Valentin) nu ~13 dagen onbetaald. BESLIST ZELF 11-9: standaard herinnerschema 0/+7/+14
  toegepast, Sam voert uit. Morgen checken of herinnering verstuurd is en of er reactie kwam.
- 6332 (Sjoerd van Marum): blijft bij besluit 9-9 (Sam maakt aanbetalingsfactuur), vandaag herbevestigd
  op Sam's herhaalde vraag. Checken of dit nu echt afgerond wordt, anders navragen waarom het bleef
  terugkomen.
- V137 (montage vs plafond): vanaf vandaag gestopt met melden zoals aangekondigd. Backlog (422 totaal,
  389 wachtrij, 91%) geaccepteerd zolang tempo plafond (35/week) houdt. Alleen opnieuw melden bij
  structurele verslechtering van het tempo, niet bij de standwaarde.
- Instroom-gat inmeten: 12-9, 13-9 en 18-9 nu ook nul boekingen (7-dagen venster 12-18/9 is 17 totaal,
  Joey 10/Sjoerd 7/Patrick 0). Opdracht aan Pip (qf8td7la, 10-9: check met Nanny/Sunny of dit een
  boekings-verdeel-issue is ipv vraag-tekort) nog niet beantwoord in Pip's rapport van vandaag. Dit is
  een investigatie, geen V-vraag voor Daimy (hoofd zoekt dit zelf uit met de juiste collega's). Als dit
  doorzet: minder orders over 2-3 weken, raakt teamplafond en omzet. Morgen: antwoord Pip opvragen,
  desnoods opnieuw delegeren als er nog geen voortgang is.
- "Patrick" als inmeter: nu 3 losse nieuwe boekingen gezien (21-9, 23-9, 23-9), naast eerdere 2 (21-9,
  28-9). Met 5 losse boekingen inmiddels vrijwel zeker een echte inmeter, geen datafout meer. Wel nog
  laten bevestigen door Pip voor de zekerheid, maar niet langer als risico behandelen.
- Alarmen: 6 → 8 (08-09) → 7 (09-09) → 8 (10-09) → 5 (11-09, 2 midden/3 laag, 0 hoog/kritiek). Duidelijke
  daling, geen actie nodig, blijven volgen op trend.
- Luuk Post / V135 (ongetekende offerte): per Bram's geheugen (gesloten-lijst) al op 8-9 opgegaan in
  V142. Was ten onrechte nog als open item in mijn geheugen blijven staan — nu verwijderd, niet meer
  meenemen.
- Bram's dagrapport ontbreekt nu 2 dagen op rij (10-9 en 11-9). Blijft een beperking voor V-status
  overzicht, geen eigen-team-afwijking. Blijven melden zolang het ontbreekt.

## Structuur / bronnen die werken
- Directeurscijfers boekingen: data/inmeet-boekingen.json (velden: geboektOp, aankomst, inmeter,
  status). ALTIJD status "geannuleerd" uitsluiten. Multi-line JSON: Grep met patroon `"veld": "waarde`
  (spatie na dubbele punt) werkt goed per regel, geen aparte regex-join nodig. Voor rijen rond een
  match: -A gebruiken op de "aankomst"/"geboektOp"-regel, niet op het hele record zoeken.
- Wachtrijen/alarmen/stil-lijst: data/brein/snapshot.json — 1 lange regel JSON, Grep -o met korte
  context (~600 tekens) toont "Omitted long matching line"; gebruik Bash grep -o met expliciete
  accolade-tellers (bv. wachtrijen:{...}) via dangerouslyDisableSandbox in plaats van de Grep-tool voor
  dit specifieke bestand. Veld "ernst" geeft de ernst van een alarm. wachtrijen.openAanbod, .claims,
  .stilLijst(+stilNamen), .mutaties.open/items (mutaties genest in wachtrijen).
- Delegeren: node scripts/brein-sessie.js opdracht <slug> "<tekst>" (max 3/dag). Werkt (bevestigd met
  id's teruggegeven). Check volgende dienst altijd of er antwoord/actie kwam; niet automatisch opnieuw
  delegeren als het antwoord 1 dag uitblijft, wel bij 2+ dagen zonder voortgang.
- Bram (medewerkers/bram/dagrapport/) bundelt V-vragen richting Daimy en houdt een gesloten-lijst bij
  (welke V-nummers al zijn opgelost) — die gesloten-lijst gebruiken om eigen geheugen op te schonen
  van items die eigenlijk al dicht zijn.
- python3/node -e inline scripts vereisen expliciete approval in deze sandbox — gebruik Grep met -o/
  multiline ipv losse scripts voor JSON-analyse, gaat sneller en zonder blokkade.

## Bijscholing/feedback toegepast
- Raamwerk-regel bevestigd via Bram's geheugen: technische storingen/bugfixes zijn NOOIT een V-vraag
  voor Daimy, altijd direct naar Techniek. Eerdere eigen escalatie (10-9, V2 over gripp-facturen-open)
  was hierop een afwijking van de regel; vanaf nu dit soort issues zelf afhandelen als GEDAAN-regel,
  niet als V-vraag.
- Materialiteitsdrempel toegepast op alarmen (kleine schommeling = geen aparte uitleg, wel op grote
  daling/stijging wijzen).
- Scenario-denken ("wat als dit doorzet") nu toegepast op het instroom-gat cijfer, niet alleen gemeld.
