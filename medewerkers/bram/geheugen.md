# Geheugen Bram

## Regel
5 werkdagen zonder antwoord = 1x herhalen in briefing, daarna "verlopen, hoofd beslist zelf" en
melden via `brein-sessie.js opdracht <hoofd-slug> "V<n> is verlopen, beslis zelf volgens je voorstel"`.

## Open vragenlijst (V-nummer — hoofd — sinds — status)
- V103/V104/V105/V112/V113/V114/V116/V117/V118/V120/V126 — diverse, 29-8/30-8, lage prio, nog op
  wachtlijst, ongewijzigd sinds vorige update (zie oude rapporten voor detail per nummer).
- V129 — Claude — 1-9 — mandaat-ladder-uitrol na proefgeval Mats — GESTUURD 1-9 (juzdepw1), nog
  geen antwoord. Proefgeval loopt nu goed, kan snel.
- V130 — Noor — GESLOTEN 11-9 — Sjoerd was laatste vakantiedag 11-9, terug 12-9, vervalt vanzelf.
- V131 — Lars/Mats+Isa — 1-9 — Google Ads + reviews/Places API-sleutels — GESTUURD 1-9 én 11-9
  (herhaald), nu dag 11 zonder Ads-data en dag 21 zonder reviews-data, blokkeert ads-cijfers en
  reviews-sync. Nog geen antwoord.
- V133 — Fenna+Noor — grotendeels GESLOTEN 11-9: 6332 opgelost (BESLIST ZELF Fenna), 6489 loopt nu
  via herinneringsschema 0/+7/+14 (BESLIST ZELF Fenna), 6556/6560/6561 door Fenna bevestigd als
  testcases (negeren in rapportage) — opgegaan in V138 (Noor wil ze wél echt verwijderen uit Gripp).
- V137 — Fenna/Pip — GESLOTEN 9-9 — montage boven plafond, geaccepteerde backlog, geen meldplicht
  meer, alleen volgen in cijfers.
- V138 — Noor — 7-9 — capaciteitsgat week 14-9 (deadline maandag) + Dennis vakantie 30-9 t/m 14-10,
  + testorders 6556/6560/6561 opschonen in Gripp (samengevoegd met Fenna's kant 11-9) — GESTUURD
  8-9 en 11-9 (herhaald, 4e keer gevraagd door Noor, deadline dichtbij). Nog geen antwoord.
- V139 — Lars — 8-9 — Jules wil A/B-test offerte-opvolgingsmails — wachtlijst, lage inzet.
- V140 — Lars — 8-9 — Bo wil VvE-pitchbrief extern sturen — wachtlijst, geen deadline.
- V141 — Noor — 8-9 — Nanny wil cadans-SMS naar 3 stille klanten — wachtlijst, lage inzet.
- V142 — Lars/Isa — 8-9 — Luuk Post (nu 29d, 7e keer gevraagd) + Hans de Lamboij (21d) + Isa's
  vaste-regel-voorstel (>7d stil = automatisch naar mens) — GESTUURD 8-9 én 11-9 (herhaald, was te
  lang blijven liggen, klantcontact-zaak had sneller dan 5 dagen moeten herhalen). Nog geen antwoord.
- V143 — Mats/Isa — GESLOTEN 11-9 — WA-storing: geen 401-crash meer sinds 10-9 11:41, Isa en Mats
  bevestigen onafhankelijk normale werking. Geen nieuwe melding nodig, blijft ter observatie.
- V144 — Noor — 10-9 — 3 getekende orders geblokkeerd door schrijfverbod leveranciersportalen
  (huisregel 9) — GESTUURD 10-9, niet herhaald 11-9 (geld-klok 2-3 werkdagen nog niet om + cijfer
  vandaag ambigu: 0 i.p.v. 3 in log, onduidelijk of al besteld). Morgen navragen en dan pas evalueren.
- V145 — Isa — 10-9 — John van Krimpen, order €3051 — GESTUURD 10-9, niet herhaald 11-9 (Isa ziet
  hem niet meer op "aan zet"-lijst, mogelijk zelf opgelost, nog niet bevestigd). Morgen bevestigen.

## Technisch (onderschept, niet naar Daimy, direct naar Mats)
- itf2311c: Mats meldde 9-9 "opgelost", maar Isa (queue 5xo3pxhk nog 24u+ op "nieuw") en Fenna
  (facturen-open.json nog 9 dagen stale) zagen 10-9 geen bewijs. Opdracht teruggestuurd naar Mats
  (j1k42ult, 10-9): opnieuw checken en pas terugkoppelen als het echt klopt.

Gesloten: V100-V102, V106, V107-V109, V110/V111/V127 (runaway-loop, gefixt 1-9), V119 (opgegaan in
V131), V121-V125, V128, V132 (opgegaan in V133), V135/V136 (opgegaan in V142, 8-9). Details in
git-historie van dit bestand indien nodig.

## Volgen
- Facturen-sync (gripp-facturen-open.json): nog 10 dagen stale (sinds 1-9), Sam stuurde 11-9 07:31
  weer naar Techniek, los van mijn j1k42ult-opdracht — morgen checken of nu echt opgelost.
- Werkbonnen: 130 open (was 121, +9), maar 5 afgerond op 10-9 (eerste na 8 werkdagen stilstand,
  daemon-herstel lijkt te werken) — morgen checken of dit een trend wordt of eenmalig was.
- Inmeetcapaciteit 11-9: 50% (Sjoerd laatste vakantiedag), vol herstel 12-9. Montage 91% boven
  plafond, geaccepteerde backlog (V137 gesloten), blijft alleen cijfer om te volgen.
- wa-luisteraar: sinds 10-9 11:41 geen 401-crash meer, Isa en Mats bevestigen normale werking
  (V143 gesloten 11-9). Nog 1-2 diensten extra volgen voor definitief zeker.
- planado-outlook: eenmalige "fetch failed" 10-9, 11-9 weer normaal gedraaid (zelf hersteld), geen
  actie nodig.
- Escalatie-watch (Isa): 7 van 327 actieve tickets >4 dagen stil. John van Krimpen niet meer op
  "aan zet"-lijst, mogelijk zelf opgelost (V145, morgen bevestigen). Nieuw: ticket 979406422,
  1075+ min stil ná overdracht naar mens — Isa's voorstel (bellen als vandaag niet opgepakt) is een
  operationele Isa/Noor-beslissing, geen Daimy-vraag, niet doorgezet.
- Orders-bestellen geblokkeerd (huisregel 9): cijfer 11-9 ambigu (0 i.p.v. 3 in log, onduidelijk of
  al besteld) — V144 niet herhaald, morgen navragen bij Noor/Ruben wat er echt gebeurd is.
- Google Ads/reviews-koppeling: klaar, wacht op sleutel (V131, dag 11/21, herhaald 11-9).
- Boekingsgat: 3 van 7 komende dagen (12-18/9) 0 nieuwe boekingen ondanks volle bezetting vanaf
  12-9 (Fenna, nieuw 11-9) — risico voor orderinstroom over 2-3 weken, geen V-vraag nu, morgen
  navragen of dit doorzet.
- Postvak "aan claude, status nieuw": 20 vast (was 18), groeiend, geen daemon verwerkt de queue
  (Mats' eigen bouwverzoek cqrzxh6i zit er ook al in) — technisch, bij Mats/Techniek, geen V-vraag.

## Leerpunten
- Bijscholing 7-9: escalatiesnelheid naar impact differentiëren, niet 1 vlakke 5-dagenklok —
  geld/personeel/onomkeerbaar sneller herhalen (2-3 werkdagen), laagprio-wachtlijst mag liggen.
  Elke V-vraag toetsen: moet Daimy dit weten / ligt dit te lang stil / is dit hét ding voor vandaag.
- Overlap tussen MT-rapporten vóór verzending samenvoegen tot 1 V-nummer.
- Altijd bewijs checken (log/bestand-timestamp) vóór "verstuurd" rapporteren, niet aannemen.
- Check/investigatie-vragen (geen binaire Daimy-beslissing, zoals V134 instroom) horen niet in
  VRAGEN AAN DAIMY maar als afwijking; hoofd zoekt zelf uit met de juiste collega's.
- Technische storingen/bugfixes zijn nooit een V-vraag, altijd terug naar Techniek (mandaat) —
  actief onderscheppen i.p.v. doorsturen. Uitzondering (nieuw 9-9): vereist de fix een fysieke
  handeling van een mens (bv. QR opnieuw scannen), dan kán Techniek het niet zelf, dus wél naar
  Daimy — met concreet voorstel wie het vandaag fysiek doet.
