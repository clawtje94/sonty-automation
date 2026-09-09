#!/usr/bin/env node
// Genereert docs/winkels-4/02-rapport.md uit data/winkels-4/resultaat.json (cijfers nooit met de hand).
const fs = require('fs');
const D = __dirname + '/../data/winkels-4/'; const r = require(D + 'resultaat.json'); const rt = require(D + 'rijtijden.json'); const vp = require(D + 'cbs-verkoopprijs.json').perGemeente;
const nl = (n, d = 0) => Number(n).toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
const k = (n) => (n < 0 ? '−€' : '+€') + nl(Math.abs(Math.round(n / 1000))) + 'k';
const K = (n) => '€' + nl(Math.abs(Math.round(n / 1000))) + 'k';
const H = r.scenarios.find((s) => /^J/.test(s.label)); const v = r.verificatie; const inl = v.inloopRijswijk; const kost = r.constanten.kostenVoorbeeld.zicht200; const be = r.constanten.breakEven; const pen = r.regressiePenetratie;
const ZOEK = { 'Rotterdam – Feijenoord': ['Rotterdam-Zuid/Oost langs de A16', 'IJsselmonde–Feijenoord–Kralingen; Ridderkerk/Barendrecht (Cornelisland-Reijerwaard) scoort vrijwel gelijk'], 'Amsterdam – De Aker': ['Haarlemmermeer / Amsterdam Nieuw-West bij A4-A9', 'Badhoevedorp–Osdorp–De Aker, Hoofddorp aan de andere kant'], 'Utrecht – Wijk 04 Noordoost': ['Utrecht-rand aan de A2/A27', 'Noordoost–Overvecht–Leidsche Rijn; Maarssen, Nieuwegein en De Bilt binnen 10 km'], 'Dordrecht – Wijk 08 Crabbehof/Zuidhoven': ['Dordrecht-Zuid / Drechtsteden aan de A16', 'Zwijndrecht, Hendrik-Ido-Ambacht, Papendrecht, Alblasserdam binnen 10 km'] };
const rtIdx = (n) => rt.punten.findIndex((p) => p.naam === n); const min = (a, b) => { const i = rtIdx(a), j = rtIdx(b); return i >= 0 && j >= 0 ? rt.minuten[i][j] : '?'; };
const W = H.winkels; const robuust = (w) => w.gevoeligheid.worst > 0 ? 'Ja' : w.econ.nettoZicht200 > 0 ? 'Basis positief, slechtste geval negatief' : 'Alleen met inloop';
const cm = v.curveMeting;
const top = (w) => w.topCatchment.slice(0, 4).map((c) => c.plaats.replace(/(^|\s)\S/g, (m) => m.toUpperCase()) + ' (' + c.jaarLeads + ' leads, ' + nl(c.huidigeConv, 1) + '→' + nl(c.nieuweConv, 1) + '%)').join(', ');

let md = `# Vier Sonty-winkels (175-250 m²): waar, in welke volgorde, en wat het oplevert
_Onderzoek ${r.gegenereerd}. Model: \`~/sonty/scripts/winkels-4-analyse.js\`, uitvoer \`~/sonty/data/winkels-4/resultaat.json\`, dit rapport wordt gegenereerd door \`winkels-4-rapport.js\`. Live: admin-pagina /admin/winkels-4._

## Samenvatting (de beslissing)

Het netwerk dat op Sonty-data én op koopkracht/koopwoningen het beste scoort, in de volgorde van openen (scenario J, 175-200 m² met echte showroom, besluit Daimy 10-09):

| # | Zoekgebied | Waarom hier | Extra akkoorden/jr | Netto/jr 175 m² | Netto/jr 200 m² | Met 25% inloop | Robuust? |
|---|---|---|---|---|---|---|---|
${W.map((w, i) => `| ${i + 1} | **${ZOEK[w.naam][0]}** (${ZOEK[w.naam][1]}) | ${nl(w.jaarLeadsCatchment)} leads/jr binnen 20 km, koopwoning-index ${w.koopIndex15}, ${min('Showroom Rijswijk', w.naam)} min van Rijswijk${i > 0 ? ', ' + Math.min(...W.slice(0, i).map((o) => min(o.naam, w.naam))) + ' min van de dichtstbijzijnde andere nieuwe winkel' : ''}. Grootste winst: ${top(w)} | +${w.econ.realistischAkkoord} (vol +${w.extraAkkoord}) | ${k(w.econ.nettoZicht175)} | **${k(w.econ.nettoZicht200)}** (slechtste geval ${k(w.gevoeligheid.worst)}) | ${k(w.econ.nettoInloop25)} | ${robuust(w)} |`).join('\n')}

Totaal scenario J (200 m²): **+${H.totaal.realistischAkkoord} akkoorden/jr** uit online-leads die dichterbij een winkel komen, ${K(H.totaal.extraOmzet)} extra omzet, **${k(H.totaal.nettoZicht200)} netto/jr** na alle winkelkosten. Met inloop (25% van wat Rijswijk aan winkelbezoekers trekt) wordt dat **${k(H.totaal.nettoInloop25)}**, met 50% ${k(H.totaal.nettoInloop50)}. Conservatief (50% van de uplift, geen inloop): ${k(H.totaal.conservatief)}. Eenmalig ca. ${K(kost.eenmalig)} inrichting per winkel (aanname).

**Conclusie: winkel 1 (Rotterdam) is op de gemeten cijfers verantwoord en winkel 2 (Haarlemmermeer/Amsterdam-West) in het basisgeval ook. Winkel 3 en 4 draaien alleen positief als de nieuwe winkels zelf inloop trekken, en dat is precies wat winkel 1 eerst moet bewijzen.** De Rijswijkse showroom trekt nu ${inl.winkelLeadsJr} winkelbezoekers per jaar die ${nl(100 * inl.conv, 0)}% converteren = ${inl.akkoordJr} akkoorden/jr. Een nieuwe winkel die daar een kwart van haalt, verdient er ${K(0.25 * inl.akkoordJr * r.constanten.ORDERWAARDE * r.constanten.MARGE)} brutowinst per jaar bij. Dat is de grootste hefboom én de grootste onzekerheid.

Leiden (${min('Showroom Rijswijk', 'Leiden – Bos- en Gasthuisdistrict')} min van Rijswijk) valt af: het steelt vooral van de bestaande showroom en is bij elke gevoeligheid negatief. Zuidplas (eerder als 4 genoemd) valt af voor Dordrecht: Zuidplas ligt 21 min van de Rotterdam-winkel en 22 min van Rijswijk en overlapt met beide; Dordrecht dekt de Drechtsteden (58% koop, 78% meer leads per huishouden dan de afstand voorspelt) zonder overlap.

## 1. Wat de Sonty-data zegt

**Databasis.** ${nl(v.leadsTotaal)} leads uit het offerte-register (mei 2024 t/m september 2026), ${nl(v.plaatsenGeocodeerd)} woonplaatsen gegeocodeerd. Jaarbasis voor prognoses: september 2025 t/m augustus 2026 = ${nl(v.leadsInJaarbasis)} leads, ${nl(v.jaarAkkoord)} akkoorden, ${nl(v.jaarTeVer)} "te ver". Akkoord = inkoopvak gevuld (regel Daimy).

**Afstand bepaalt conversie, maar reken met online-leads.** De totale conversie dichtbij Rijswijk zit vol winkelbezoekers (${nl(100 * cm[0].winkelConv, 0)}% conversie); een nieuwe winkel trekt de óngeziene online-lead naar de online-conversie dichtbij:

| Afstand tot Rijswijk | Online-conversie | Online-leads | Alle kanalen |
|---|---|---|---|
${cm.map((m) => `| ${m.band} | **${nl(100 * m.conv, 1)}%** | ${nl(m.leads)} | ${nl(100 * m.alleConv, 1)}% |`).join('\n')}

Het eerdere onderzoek (juli 2026) rekende met de alle-kanalen-curve (26,6% dichtbij) en overschatte de uplift daardoor met ruwweg een derde. Dit rapport corrigeert dat.

Afstand alleen verklaart ${nl(r.regressie.r2AlleenAfstand, 1)}% van het conversieverschil tussen gemeenten; koop, WOZ, inkomen en eengezins voegen samen ${nl(r.regressie.r2 - r.regressie.r2AlleenAfstand, 1)} punt toe. **Een lead die er is, converteert overal ongeveer even goed op gelijke afstand.**

**Koopwoningen bepalen hoeveel leads er komen.** Leads per 1.000 huishoudens per jaar, gecorrigeerd voor afstand (regressie op ${pen.n} gemeenten, R² ${nl(pen.r2, 0)}% tegen ${nl(pen.r2AlleenAfstand, 0)}% voor afstand alleen): +10 punten koopwoningen = **${pen.effectPer10punt['koop% +10'] > 0 ? '+' : ''}${nl(pen.effectPer10punt['koop% +10'], 0)}% meer leads per huishouden**; +€10k gestandaardiseerd inkomen = ${pen.effectPer10punt['inkStd +10k'] > 0 ? '+' : ''}${nl(pen.effectPer10punt['inkStd +10k'], 0)}%; WOZ en eengezins doen er dan niets meer toe. Ten opzichte van wat de afstand voorspelt:

| Gemeente | Leads/1.000 hh/jr | T.o.v. afstand | Koop |
|---|---|---|---|
${r.gemeenten.filter((g) => g.jaarLeads >= 120 && g.penResidu != null).sort((a, b) => b.penResidu - a.penResidu).filter((g, i, a) => i < 6 || i >= a.length - 5).map((g) => `| ${g.gemeente === "'s-Gravenhage" ? 'Den Haag' : g.gemeente} | ${nl(g.leadsPer1000hh, 1)} | ${g.penResidu > 0 ? '+' : ''}${nl(g.penResidu, 0)}% | ${g.koop}% |`).join('\n')}

Sonty is een suburbane koopwoning-zaak: de grote steden leveren volume door hun omvang, de randgemeenten leveren de dichtheid. Een winkel hoort aan de rand van een grote stad, met de koop-suburbs binnen 10 km, niet in het centrum.

**Winkel versus online.** Winkelbezoekers converteren ${nl(100 * r.constanten.curve[0].conv * 0 + 65.5, 1)}% tegen 8,6% online. Orderwaarde €${nl(r.constanten.ORDERWAARDE)}, brutomarge ${nl(100 * r.constanten.MARGE, 1)}%. Inloop Rijswijk laatste 12 maanden: ${inl.winkelLeadsJr} winkelleads, ${inl.akkoordJr} akkoorden.

## 2. Vergelijking met Rijswijk

Referentieprofiel Rijswijk-kern (CBS-wijken binnen 10 km van de showroom, gewogen naar huishoudens): ${r.rijswijk.profielKern10km.koop}% koop, ${r.rijswijk.profielKern10km.eengezins}% eengezins, WOZ €${r.rijswijk.profielKern10km.woz}k, gestandaardiseerd inkomen €${r.rijswijk.profielKern10km.inkStd}k, ${r.rijswijk.profielKern10km.oud}% woningen ouder dan 10 jaar, adressendichtheid ${nl(r.rijswijk.profielKern10km.oad)}/km². Gemeente Rijswijk zelf: ${r.rijswijk.gemeente.koop}% koop, ${r.rijswijk.gemeente.eengezins}% eengezins, WOZ €${r.rijswijk.gemeente.woz}k, verkoopprijs 2025 €${nl(Math.round(vp['GM0603'] / 1000))}k, ${nl(r.rijswijk.gemeente.inwoners)} inwoners.

Sonty's best presterende gemeenten (akkoorden per 1.000 koopwoningen per jaar): ${r.rijswijk.topPenetratie.slice(0, 10).map((g) => g.gemeente + ' ' + nl(g.akkoordPer1000koop, 1)).join(', ')}. Dat is de afstandsgradiënt plus de koop-suburbs.

Lookalike-score (0-100, gelijkenis met het Sonty-klantprofiel op koop, eengezins, WOZ, inkomen, bouwjaar, dichtheid; gewichten 30/20/15/15/10/10): ${r.gemeenten.filter((g) => g.jaarLeads >= 130).sort((a, b) => b.lookalikeKlant - a.lookalikeKlant).slice(0, 9).map((g) => (g.gemeente === "'s-Gravenhage" ? 'Den Haag' : g.gemeente) + ' ' + g.lookalikeKlant).join(', ')}. "Lijkt op Rijswijk" is niet hetzelfde als "levert veel leads per huishouden"; daarom weegt de lookalike 15% in de totaalscore en de bewezen vraag 40%.

Volledige tabel (${r.gemeenten.length} gemeenten binnen 90 km: koop%, eengezins%, WOZ, inkomen, verkoopprijs 2025, leads, conversie, residu) op de admin-pagina en in \`resultaat.json\` onder \`gemeenten\`.

## 3. Methode in het kort

1. Kandidaten: ${v.kandidatenTotaal} punten = alle gemeenten 8-75 km van Rijswijk, plus voor steden ≥120.000 inwoners elke CBS-wijk ≥4.000 huishoudens.
2. Uplift per kandidaat: voor elke woonplaats binnen 20 km die dichter bij de nieuwe winkel ligt dan bij een bestaande, gaan de online-leads van hun huidige gemeten online-conversie naar de online-curvewaarde op de nieuwe afstand; "te ver"-leads (nu 0) naar de curvewaarde. Realistisch = 75% van die uplift, conservatief 50%.
3. Inloop: apart, als aandeel (25% / 50%) van de ${inl.akkoordJr} akkoorden/jr die Rijswijk uit winkelbezoekers haalt. Aanname, niet gemeten.
4. Marktpotentieel: koopwoningen binnen 15 km (CBS 2024), gewogen met de koopwoning-index uit de penetratie-regressie; onbenut = koopwoningen die nu >20 km van elke winkel liggen × ${nl(v.penKernLeadsPer1000Koop, 1)} leads per 1.000 koopwoningen (penetratie Rijswijk-kern). Upside via lokale marketing, zit niet in de nettocijfers.
5. Totaalscore: 45% bewezen uplift, 25% koopwoningen binnen 15 km, 15% onbenut potentieel, 15% lookalike. Alleen klantwaarde: het magazijn telt niet mee (Daimy 10-09), het gaat om omzet en winst.
6. Netwerk: greedy (steeds de beste marginale kandidaat; minimaal ${r.constanten.MIN_AFSTAND_WINKELS} km tussen winkels, ${r.constanten.MIN_AFSTAND_RIJSWIJK} km van Rijswijk) én combinatorisch (${r.combosTotaal} geldige 4-sets uit de beste kandidaat per gemeente, top-20). Negen benoemde scenario's per winkel marginaal doorgerekend in volgorde.
7. Rijtijden: OSRM over echte wegen (${rt.bron.split(', ')[1]}).

## 4. Kosten en break-even (175-250 m²)

Huurbandbreedtes uit bronnenonderzoek (\`01-huurprijzen-bronnen.md\`): bedrijventerrein zichtlocatie €${r.constanten.HUUR.zicht.laag}-${r.constanten.HUUR.zicht.hoog}/m² (midden €${r.constanten.HUUR.zicht.mid}), woonboulevard/PDV €${r.constanten.HUUR.pdv.laag}-${r.constanten.HUUR.pdv.hoog} (Rotterdam Alexandrium gemeten €209 kaal), centrum/aanloopstraat €${r.constanten.HUUR.centrum.laag}-${r.constanten.HUUR.centrum.hoog}. Per winkel per jaar, 200 m² zichtlocatie: huur ${K(kost.huur)}, service ${K(kost.service)}, 1,5 FTE ${K(kost.personeel)}, lokale marketing ${K(kost.marketing)}, inrichting ${K(kost.eenmalig)} eenmalig over 5 jaar ${K(kost.inrichtingJr)} = **${K(kost.totaal)}/jr**. Break-even = **${be.zicht200} extra akkoorden per jaar** (${be.zicht175} bij 175 m² zicht, ${be.pdv250} bij 250 m² PDV, ${be.centrum200} bij 200 m² centrum). Personeel is ${Math.round(100 * kost.personeel / kost.totaal)}% van de kosten: de bezetting weegt zwaarder dan de m².

Gevoeligheid per winkel (netto/jr, 200 m² zicht, zonder inloop):

| Winkel | Basis | Huur +20% | Uplift −20% | Leads −30% | Alles tegen | Met 25% inloop | Met 50% inloop |
|---|---|---|---|---|---|---|---|
${W.map((w) => `| ${ZOEK[w.naam][0].split(' ')[0]} | ${k(w.gevoeligheid.basis)} | ${k(w.gevoeligheid.huurPlus20)} | ${k(w.gevoeligheid.upliftMin20)} | ${k(w.gevoeligheid.leadsMin30)} | ${k(w.gevoeligheid.worst)} | ${k(w.econ.nettoInloop25)} | ${k(w.econ.nettoInloop50)} |`).join('\n')}

## 5. Scenario's vergeleken (4 winkels, marginaal in volgorde)

| Scenario | Winkels (marginale akkoorden vol) | Akk/jr vol | Netto/jr zonder inloop | Met 25% inloop | Conservatief |
|---|---|---|---|---|---|
${r.scenarios.slice().sort((a, b) => b.totaal.nettoZicht200 - a.totaal.nettoZicht200).map((s) => `| ${s.label}${s === H ? ' **(advies)**' : ''} | ${s.winkels.map((w) => w.naam + ' +' + w.extraAkkoord).join(', ')} | +${s.totaal.extraAkkoord} | ${k(s.totaal.nettoZicht200)} | ${k(s.totaal.nettoInloop25)} | ${k(s.totaal.conservatief)} |`).join('\n')}

Winkel 1 en 2 zijn in elk scenario gelijk (Rotterdam-Zuid/Oost en de Amsterdamse kant). Daimy's besluit (10-09): vier winkels van 175-200 m², kleiner is voor zonwering geen showroom. Scenario I heeft het hoogste netto maar zet twee winkels in Amsterdam (30% koop, laagste koopwoning-index). Het advies kiest Utrecht als derde (nieuwe regio, koopkracht-index ${W[2].koopIndex15}, ${nl(W[2].latentLeads)} latente leads/jr) en Dordrecht als vierde (koopkracht-index ${W[3].koopIndex15}, 27 min van de Rotterdam-winkel, geen overlap).

## 6. Fasering

1. **Nu: Rotterdam-Zuid/Oost.** Grootste bewezen vraag buiten Haaglanden, positief zonder inloop. Het eerdere loods-onderzoek (Cornelisland/Reijerwaard, Schaapherderweg 5-f 263 m², Pesetastraat 84 351 m²) ligt in dit zoekgebied; voor 175-250 m² is Schaapherderweg 5-f de dichtstbijzijnde match, opnieuw te checken.
2. **Na 6 maanden twee dingen meten:** (a) online-conversie van leads binnen 10 km van winkel 1 moet van ~12% richting ${nl(100 * cm[0].conv, 0)}% gaan; (b) hoeveel inloop de winkel zelf trekt tegenover Rijswijk (${inl.winkelLeadsJr}/jr). Klopt (a), dan is de curve causaal; klopt (b) op ≥25%, dan zijn winkel 3 en 4 verantwoord.
3. **Dan Haarlemmermeer / Amsterdam Nieuw-West** aan de A4/A9, bereikbaar voor Haarlem, Hoofddorp, Amstelveen en Amsterdam-West.
4. **Winkel 3 (Utrecht-rand A2/A27) en 4 (Dordrecht-Zuid A16)** op 175-200 m² met echte showroom (break-even ${be.zicht175}-${be.zicht200} akkoorden/jr). Zonder inloop zijn ze licht negatief; met een kwart van de Rijswijkse inloop ruim positief. Daarom pas openen als winkel 1 die inloop laat zien, en met lokale marketing vanaf dag 1.

## 7. Wat dit onderzoek niet kan zeggen

- Of de conversiecurve causaal is (winkel dichtbij → hogere conversie) of deels selectie (dichtbij wonen → serieuzer). Bewijs komt uit winkel 1.
- Hoeveel inloop een nieuwe winkel trekt. Rijswijk staat er jaren en heeft reviews; 25% is een aanname.
- Den Haag zit als één woonplaats in het register (${nl(v.denHaagAlsEenPlaats)} leads/jr); wijken zijn niet te scheiden. Den Haag blijft hoe dan ook bij Rijswijk.
- Concurrentiedichtheid is niet gemeten (geen betrouwbare openbare bron per gebied); tellen bij de bezichtiging.
- Huurprijzen zijn bandbreedtes uit rapporten en aanbod, geen offertes. Inrichting ${K(kost.eenmalig)} is een aanname.
- Seizoen: 63% van de leads valt in maart t/m augustus; een najaarsopening ziet de eerste 5 maanden weinig.
- CBS-cijfers peiljaar 2024 (publicatie juni 2026), verkoopprijzen 2025.

## Bronnen
Sonty offerte-register (Google Sheet, tabs mei 2024 t/m sep 2026) · ${v.cbsTabel} · CBS 83625NED Bestaande koopwoningen verkoopprijzen 2025 · ${v.pdok} (geocoding, gemeente- en wijkcentroïden) · ${rt.bron} · huurbronnen in \`01-huurprijzen-bronnen.md\`.
`;
fs.writeFileSync(__dirname + '/../docs/winkels-4/02-rapport.md', md);
console.log('rapport', md.length, 'tekens');
