# Geheugen Bram

## Regel
5 werkdagen zonder antwoord = 1x herhalen in briefing, daarna "verlopen, hoofd beslist zelf" en
melden via `brein-sessie.js opdracht <hoofd-slug> "V<n> is verlopen, beslis zelf volgens je voorstel"`.

## Open vragenlijst (V-nummer — hoofd — sinds — status)
- V103/V104/V105/V112/V113/V114/V116/V117/V118/V120/V126 — diverse, 29-8/30-8, lage prio, nog op
  wachtlijst, ongewijzigd sinds vorige update (zie oude rapporten voor detail per nummer).
- V129 — Claude — 1-9 — mandaat-ladder-uitrol na proefgeval Mats — GESTUURD 1-9 (juzdepw1), nog
  geen antwoord. Proefgeval loopt nu goed, kan snel.
- V130 — Noor — 1-9 — Sjoerd weg tot 11-9, Joey solo — GESTUURD 1-9, geen antwoord; wachtrij
  stabiel, even geen actie nodig.
- V131 — Lars/Mats+Isa — 1-9 — Google Ads + reviews/Places API-sleutels — GESTUURD 1-9, nu dag 9
  geen antwoord, niet gestuurd 8-9 en 9-9 (cap vol, V133/V137/V142/V143 gingen voor), morgen weer
  proberen — blokkeert ads-cijfers en reviews-sync.
- V133 — Fenna+Noor — 2-9/3-9/7-9/8-9/9-9 — aanbetaling-cluster: 6332 opgelost (Sam factureert via
  Gripp, BESLIST ZELF Fenna), blijft open: 6489 (dag 11, nu met vraag om herinneringsschema
  dag 0/+7/+14), 6556/6560/6561 (test-orders, los issue) — GESTUURD 9-9, cashflow-risico,
  geld-klok 2-3 werkdagen.
- V137 — Fenna/Pip — 4-9/8-9/9-9 — montage 407/443 (92%) boven plafond 35/week — GESTUURD 9-9,
  dag 5-6, business-kritiek (plafond stuurt alles); Fenna geeft aan te stoppen met melden bij
  stilte (= geaccepteerde backlog).
- V138 — Noor — 7-9 — capaciteitsgat na vakanties (14-9) + NIEUW Dennis vakantie 30-9 t/m 14-10 —
  Noor stelt voor beide gaten in 1x te plannen — nog niet gestuurd, wachtlijst, deadline 14-9.
- V139 — Lars — 8-9 — Jules wil A/B-test offerte-opvolgingsmails (1 segment, 48u) — wachtlijst,
  reversibel/lage inzet, kan wachten.
- V140 — Lars — 8-9 — Bo wil VvE-pitchbrief naar Prins Constantijn Promenade sturen (extern,
  onomkeerbaar, layer-3) — wachtlijst, geen bekende deadline.
- V141 — Noor — 8-9 — Nanny wil cadans-SMS naar 3 stille wachtrij-klanten — wachtlijst,
  reversibel/lage inzet.
- V142 — Lars/Isa — 8-9/9-9 — Luuk Post (27d, 5e keer gevraagd, voorstel: bellen i.p.v. mailen) +
  Hans de Lamboij (21d) + Isa's vaste-regel-voorstel (>7d stil = automatisch naar mens) —
  GESTUURD 8-9, niet herhaald 9-9 (nog geen 2-3 werkdagen om sinds laatste send, laagprio-cat).
- V143 — Mats/Isa — 9-9 — NIEUW — WhatsApp-kanaal 24u+ plat (WA 401-sessiefout), herstel vraagt
  fysieke QR-herkoppeling op de telefoon, geen agent kan dat — GESTUURD 9-9, urgent (klantkanaal
  down), geen technische bugfix dus wel een Daimy-vraag (niet naar Techniek, want Techniek heeft
  geen handen).

Gesloten: V100-V102, V106, V107-V109, V110/V111/V127 (runaway-loop, gefixt 1-9), V119 (opgegaan in
V131), V121-V125, V128, V132 (opgegaan in V133), V135/V136 (opgegaan in V142, 8-9). Details in
git-historie van dit bestand indien nodig.

## Volgen
- Facturen-sync (gripp-facturen-open.json): nog gedateerd 1-9, Mats' fix (itf2311c) er nog niet op
  uitgevoerd — morgen weer checken.
- Werkbonnen: 116 open (was 113), 0 afgerond sinds 2-9, 7 werkdagen op rij, bij Mats (79jfm08q).
  Planado 429/outlook-422 wél op 0 op 9-9 (die kant lijkt opgelost), afronding zelf blijft stil.
- Inmeetcapaciteit 9-9: 50% (Joey terug, Sjoerd t/m 11-9), vol herstel 12-9. Montage 92% boven
  plafond (V137, licht dalend, binnen ruis).
- wa-luisteraar 9-9: nog steeds plat, 24u+, trekt sunny-ochtend/weetje mee om — vereist fysieke
  QR-herkoppeling (geen agent kan dat), daarom als V143 naar Daimy. Morgen checken of hersteld.
- Escalatie-watch (Isa): 6 van 85 casussen >4 dagen stil + Hans de Lamboij (V142); John van
  Krimpen (12d) 9-9 BESLIST ZELF door Isa naar Sunny gedelegeerd, volgen of dat lukt.
- Opdrachtqueue-bug itf2311c: Mats meldt OPGELOST 9-9 (0 vast, was 12), maar Isa zag 'm zelf nog
  24u op "nieuw" staan na de fix — stabiliteit nog niet zeker, blijven volgen.
- Google Ads/reviews-koppeling: klaar, wacht op sleutel (V131, dag 9).

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
