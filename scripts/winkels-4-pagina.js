#!/usr/bin/env node
// Bouwt de HTML-pagina (kaart + ranking + scenario's + gemeentevergelijking) uit data/winkels-4/*.json.
// Output: --artifact <pad> (volledige pagina met <title>) en sonty-website/data/winkels-4.html (body voor /admin/winkels-4).
const fs = require('fs');
const D = __dirname + '/../data/winkels-4/';
const r = require(D + 'resultaat.json'); const rt = require(D + 'rijtijden.json'); const vp = require(D + 'cbs-verkoopprijs.json').perGemeente;
const cap = (s) => String(s).replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/ Aan /g, ' aan ').replace(/ Den /g, ' den ').replace(/ De /g, ' de ').replace(/ En /g, ' en ');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nl = (n, d = 0) => Number(n).toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n) => (n < 0 ? '−€ ' : '€ ') + nl(Math.abs(Math.round(n)));
const eurK = (n) => (n < 0 ? '−€ ' : '€ ') + nl(Math.abs(Math.round(n / 1000))) + 'k';
const pct = (x, d = 1) => nl(x, d) + '%';
const ADVIES = r.scenarios.find((s) => /^H/.test(s.label));
const ZOEK = { 'Rotterdam – Feijenoord': { kop: 'Rotterdam-Zuid/Oost langs de A16', sub: 'IJsselmonde · Feijenoord · Kralingen · Ridderkerk/Barendrecht (Cornelisland-Reijerwaard scoort gelijk)' }, 'Amsterdam – De Aker': { kop: 'Haarlemmermeer / Amsterdam Nieuw-West bij A4-A9', sub: 'Badhoevedorp · Osdorp · De Aker · Hoofddorp-Noord' }, 'Zuidplas': { kop: 'Zuidplas / Rotterdam-Noordoost aan de A20', sub: 'Nieuwerkerk aan den IJssel · richting Gouda en Lansingerland' }, 'Utrecht – Wijk 02 Noordwest': { kop: 'Utrecht-West aan de A2', sub: 'Leidsche Rijn · Noordwest · richting Maarssen en Nieuwegein' } };
const ROBUUST = (w) => w.gevoeligheid.worst > 0 ? ['robuust', 'good'] : w.econ.nettoZicht200 > 0 ? ['basis positief', 'warn'] : ['alleen met inloop', 'bad'];
const rtIdx = (n) => rt.punten.findIndex((p) => p.naam === n);
const minuten = (van, naar) => { const a = rtIdx(van), b = rtIdx(naar); return a >= 0 && b >= 0 ? rt.minuten[a][b] : null; };

// ---- kaart ----
const LON0 = 3.95, LON1 = 5.45, LAT0 = 51.55, LAT1 = 52.55; const W = 640, KX = W / (LON1 - LON0), KY = KX * 1.62, H = Math.round((LAT1 - LAT0) * KY);
const X = (lon) => ((lon - LON0) * KX).toFixed(1), Y = (lat) => ((LAT1 - lat) * KY).toFixed(1); const kmPx = (km) => (km / 111 * KY).toFixed(1);
const gms = r.gemeenten.filter((g) => g.lon >= LON0 && g.lon <= LON1 && g.lat >= LAT0 && g.lat <= LAT1);
const maxLeads = Math.max(...gms.map((g) => g.jaarLeads));
const kleurRes = (g) => g.jaarLeads < 15 ? 'var(--dot)' : g.penResidu >= 40 ? 'var(--good)' : g.penResidu <= -40 ? 'var(--bad)' : 'var(--warn)';
let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kaart Randstad met gemeenten, showroom Rijswijk en de vier zoekgebieden">`;
svg += `<rect width="${W}" height="${H}" fill="var(--map)"/>`;
for (const w of ADVIES.winkels) svg += `<circle cx="${X(w.lon)}" cy="${Y(w.lat)}" r="${kmPx(15)}" fill="var(--accent)" fill-opacity="0.07" stroke="var(--accent)" stroke-opacity="0.35" stroke-dasharray="4 4"/>`;
svg += `<circle cx="${X(4.3253)}" cy="${Y(52.0365)}" r="${kmPx(15)}" fill="var(--ink)" fill-opacity="0.05" stroke="var(--ink)" stroke-opacity="0.3" stroke-dasharray="4 4"/>`;
for (const g of gms.sort((a, b) => b.jaarLeads - a.jaarLeads)) { const rr = 2 + 11 * Math.sqrt(g.jaarLeads / maxLeads); svg += `<circle cx="${X(g.lon)}" cy="${Y(g.lat)}" r="${rr.toFixed(1)}" fill="${kleurRes(g)}" fill-opacity="0.75" stroke="var(--panel)" stroke-width="0.6"><title>${esc(g.gemeente)}: ${g.jaarLeads} leads/jr, ${g.penResidu != null ? (g.penResidu > 0 ? '+' : '') + g.penResidu + '% t.o.v. afstand' : 'te weinig leads'}, koop ${g.koop}%</title></circle>`; }
const label = (lon, lat, txt, dx = 8, dy = 4, cls = 'lbl') => `<text x="${(+X(lon) + dx).toFixed(1)}" y="${(+Y(lat) + dy).toFixed(1)}" class="${cls}">${esc(txt)}</text>`;
for (const g of gms.filter((g) => ['Rotterdam', "'s-Gravenhage", 'Amsterdam', 'Utrecht', 'Haarlem', 'Leiden', 'Dordrecht', 'Gouda', 'Breda', 'Almere', 'Zoetermeer', 'Haarlemmermeer', 'Alphen aan den Rijn'].includes(g.gemeente))) svg += label(g.lon, g.lat, g.gemeente === "'s-Gravenhage" ? 'Den Haag' : g.gemeente === 'Haarlemmermeer' ? 'Hoofddorp' : g.gemeente, 9, 4, 'lbl');
svg += `<path d="M${X(4.3253)},${(+Y(52.0365) - 9).toFixed(1)} l2.6,5.4 6,0.8 -4.3,4.2 1,5.9 -5.3,-2.8 -5.3,2.8 1,-5.9 -4.3,-4.2 6,-0.8z" fill="var(--ink)" stroke="var(--panel)" stroke-width="1"/>` + label(4.3253, 52.0365, 'Showroom Rijswijk', 11, -6, 'lbl strong');
svg += `<rect x="${(+X(4.479) - 4).toFixed(1)}" y="${(+Y(51.9917) - 4).toFixed(1)}" width="8" height="8" fill="var(--ink)" stroke="var(--panel)"/>` + label(4.479, 51.9917, 'Magazijn Berkel', 8, 12, 'lbl');
ADVIES.winkels.forEach((w, i) => { svg += `<circle cx="${X(w.lon)}" cy="${Y(w.lat)}" r="11" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/><text x="${X(w.lon)}" y="${(+Y(w.lat) + 4.5).toFixed(1)}" class="num">${i + 1}</text>` + label(w.lon, w.lat, ZOEK[w.naam].kop.split(' langs')[0].split(' bij')[0].split(' aan de')[0], 15, -8, 'lbl strong'); });
svg += '</svg>';

// ---- secties ----
const kaarten = ADVIES.winkels.map((w, i) => { const [rob, cls] = ROBUUST(w); const z = ZOEK[w.naam]; return `<article class="w4-store"><div class="w4-store-top"><span class="w4-rank">${i + 1}</span><span class="pill ${cls}">${rob}</span></div><h3>${esc(z.kop)}</h3><p class="sub">${esc(z.sub)}</p><dl><div><dt>Extra akkoorden/jr</dt><dd>${w.econ.realistischAkkoord} <small>realistisch (vol ${w.extraAkkoord})</small></dd></div><div><dt>Netto/jr zonder inloop</dt><dd class="${w.econ.nettoZicht200 >= 0 ? 'pos' : 'neg'}">${eurK(w.econ.nettoZicht200)} <small>slechtst ${eurK(w.gevoeligheid.worst)}</small></dd></div><div><dt>Netto/jr met 25% inloop</dt><dd class="${w.econ.nettoInloop25 >= 0 ? 'pos' : 'neg'}">${eurK(w.econ.nettoInloop25)} <small>aanname</small></dd></div><div><dt>Leads/jr binnen 20 km</dt><dd>${nl(w.jaarLeadsCatchment)} <small>onbenut +${nl(w.latentLeads)}</small></dd></div><div><dt>Koopwoning-index</dt><dd>${w.koopIndex15} <small>Rijswijk-kern = 100</small></dd></div><div><dt>Rijtijd</dt><dd>${minuten('Magazijn Berkel', w.naam) ?? '–'} min <small>magazijn · ${minuten('Showroom Rijswijk', w.naam) ?? '–'} min Rijswijk</small></dd></div></dl><p class="top">Grootste winst: ${w.topCatchment.slice(0, 4).map((c) => esc(cap(c.plaats)) + ' (' + c.jaarLeads + ' leads, ' + nl(c.huidigeConv, 1) + '→' + nl(c.nieuweConv, 1) + '%)').join(', ')}.</p></article>`; }).join('');

const scenRows = r.scenarios.slice().sort((a, b) => b.totaal.nettoZicht200 - a.totaal.nettoZicht200).map((s) => `<tr class="${s === ADVIES ? 'hl' : ''}"><td>${esc(s.label)}${s === ADVIES ? ' <span class="pill accent">advies</span>' : ''}</td><td>${s.winkels.map((w) => esc(w.naam) + ' <span class="mut">+' + w.extraAkkoord + '</span>').join('<br>')}</td><td class="num">+${s.totaal.extraAkkoord}</td><td class="num">${eurK(s.totaal.extraOmzet)}</td><td class="num ${s.totaal.nettoZicht200 >= 0 ? 'pos' : 'neg'}">${eurK(s.totaal.nettoZicht200)}</td><td class="num ${s.totaal.nettoInloop25 >= 0 ? 'pos' : 'neg'}">${eurK(s.totaal.nettoInloop25)}</td><td class="num ${s.totaal.conservatief >= 0 ? 'pos' : 'neg'}">${eurK(s.totaal.conservatief)}</td><td class="num">${nl(s.totaal.latentLeads)}</td></tr>`).join('');

const seen = new Set(); const rank = []; for (const s of r.ranking) { if (seen.has(s.gm)) continue; seen.add(s.gm); rank.push(s); if (rank.length >= 20) break; }
const rankRows = rank.map((s, i) => `<tr><td class="num">${i + 1}</td><td>${esc(s.naam)}</td><td class="num"><span class="bar" style="--w:${s.score}%"></span>${s.score}</td><td class="num">+${s.uplift.extraAkkoordVol}</td><td class="num">${nl(s.uplift.jaarLeadsCatchment)}</td><td class="num">${nl(s.uplift.koopBinnen15)}</td><td class="num">${s.uplift.koopIndex15}</td><td class="num">${nl(s.uplift.latentLeads)}</td><td class="num">${s.lookalikeKlant ? s.lookalikeKlant.score : '–'}</td><td class="num">${s.kmBerkel}</td><td class="num ${s.econ.nettoZicht200 >= 0 ? 'pos' : 'neg'}">${eurK(s.econ.nettoZicht200)}</td></tr>`).join('');

const rw = r.rijswijk.gemeente; const gemRows = r.gemeenten.filter((g) => g.jaarLeads >= 60).slice(0, 45).map((g) => { const res = g.penResidu; return `<tr class="${g.code === 'GM0603' ? 'hl' : ''}"><td>${esc(g.gemeente === "'s-Gravenhage" ? 'Den Haag' : g.gemeente)}</td><td class="num">${g.km}</td><td class="num">${nl(g.jaarLeads)}</td><td class="num">${g.jaarAkkoord}</td><td class="num">${g.conv != null ? pct(g.conv) : '–'}</td><td class="num">${g.leadsPer1000hh != null ? nl(g.leadsPer1000hh, 1) : '–'}</td><td class="num ${res == null ? '' : res >= 40 ? 'pos' : res <= -40 ? 'neg' : ''}">${res == null ? '–' : (res > 0 ? '+' : '') + nl(res, 0) + '%'}</td><td class="num">${g.koop ?? '–'}%</td><td class="num">${g.eengezins ?? '–'}%</td><td class="num">${g.woz ? '€ ' + g.woz + 'k' : '–'}</td><td class="num">${vp[g.code] ? '€ ' + nl(Math.round(vp[g.code] / 1000)) + 'k' : '–'}</td><td class="num">${g.inkStd ? '€ ' + nl(g.inkStd, 1) + 'k' : '–'}</td><td class="num">${g.lookalikeKlant ?? '–'}</td></tr>`; }).join('');

const curveRows = r.verificatie.curveMeting.map((m) => `<div class="curve-bar"><div class="fill" style="height:${Math.round(110 * m.conv / 0.2)}px"></div><b>${pct(100 * m.conv)}</b><span>${esc(m.band)}</span><small>n=${nl(m.leads)} · alle ${pct(100 * m.alleConv)}</small></div>`).join('');
const k = r.constanten.kostenVoorbeeld.zicht200; const be = r.constanten.breakEven;
const pen = r.regressiePenetratie.effectPer10punt;
const v = r.verificatie;

const body = `<div class="w4">
<header class="w4-head"><p class="eyebrow">Sonty · vestigingsonderzoek · ${esc(r.gegenereerd)}</p><h1>Vier winkels naast Rijswijk</h1><p class="lead">Waar 4 winkels van 175-250 m² het meeste opleveren, gerekend op ${nl(v.leadsTotaal)} Sonty-leads (mei 2024 t/m sep 2026), CBS-koopwoningen en -koopkracht per wijk, en echte rijtijden. Advies: <b>open Rotterdam-Zuid/Oost en daarna Haarlemmermeer/Amsterdam-West</b>; winkel 3 en 4 zijn alleen rendabel als een nieuwe winkel zelf inloop trekt, en dat moet winkel 1 eerst bewijzen.</p></header>

<section class="w4-stores">${kaarten}</section>
<p class="w4-total">Samen (scenario H): <b>+${ADVIES.totaal.realistischAkkoord} akkoorden/jr</b> uit online-leads die dichterbij komen · ${eurK(ADVIES.totaal.extraOmzet)} extra omzet · <b>${eurK(ADVIES.totaal.nettoZicht200)} netto/jr zonder inloop</b> · met 25% van de Rijswijkse inloop (${v.inloopRijswijk.akkoordJr} akkoorden/jr uit ${v.inloopRijswijk.winkelLeadsJr} winkelbezoekers) <b>${eurK(ADVIES.totaal.nettoInloop25)}</b> · conservatief (50% uplift, geen inloop) ${eurK(ADVIES.totaal.conservatief)}. Eenmalig ca. ${eurK(k.eenmalig)} inrichting per winkel (aanname).</p>

<section class="w4-map-wrap"><div class="w4-map">${svg}</div><aside class="w4-legend"><h2>Kaart lezen</h2><p>Elke stip is een gemeente, groot naar leads per jaar. Kleur: hoeveel leads per huishouden Sonty er haalt ten opzichte van wat de afstand tot Rijswijk voorspelt.</p><ul><li><i style="background:var(--good)"></i> ruim meer (+40% of hoger): de koop-suburbs</li><li><i style="background:var(--warn)"></i> rond verwachting</li><li><i style="background:var(--bad)"></i> ruim minder (−40% of lager): de grote steden</li><li><i style="background:var(--dot)"></i> te weinig leads om te zeggen</li></ul><p>Gestippelde cirkels: 15 km rond showroom en zoekgebieden. Sonty is een suburbane koopwoning-zaak: een winkel hoort aan de rand van een grote stad, met de koop-suburbs binnen 10 km.</p></aside></section>

<section><h2>Wat de Sonty-data zegt</h2><div class="w4-two"><div class="panel"><h3>Afstand bepaalt conversie (online-leads)</h3><div class="curve">${curveRows}</div><p class="mut">Online-conversie per afstandsband tot Rijswijk (${nl(v.leadsTotaal)} leads). De alle-kanalen-cijfers liggen hoger omdat winkelbezoekers (${pct(100 * v.curveMeting[0].winkelConv, 0)} conversie) vrijwel allemaal dichtbij wonen; het model rekent daarom met de online-curve en telt inloop apart. Afstand alleen verklaart ${nl(r.regressie.r2AlleenAfstand, 1)}% van het verschil tussen gemeenten; koop, WOZ, inkomen en eengezins voegen samen ${nl(r.regressie.r2 - r.regressie.r2AlleenAfstand, 1)} punt toe. Een lead die er is, converteert overal ongeveer even goed op gelijke afstand.</p></div><div class="panel"><h3>Koopwoningen bepalen hoeveel leads er komen</h3><p class="big">+10 punten koopwoningen = <b>${pen['koop% +10'] > 0 ? '+' : ''}${nl(pen['koop% +10'], 0)}%</b> meer leads per huishouden</p><p>Op gelijke afstand. Inkomen +€10k = ${pen['inkStd +10k'] > 0 ? '+' : ''}${nl(pen['inkStd +10k'], 0)}%; WOZ en eengezins doen er dan niets meer toe (regressie op ${r.regressiePenetratie.n} gemeenten, R² ${nl(r.regressiePenetratie.r2, 1)}%). Daarom telt de koopwoning-index per zoekgebied mee, en zit de winst in Barendrecht, Ridderkerk, Haarlemmermeer, Waddinxveen en Lansingerland, niet in de stadscentra.</p><p class="mut">Winkelbezoek converteert ${pct(100 * v.curveMeting[0].winkelConv, 1)} (dichtbij) tegen 8,6% online. Orderwaarde € ${nl(r.constanten.ORDERWAARDE)}, brutomarge ${pct(100 * r.constanten.MARGE)}.</p></div></div></section>

<section><h2>Vergelijking met Rijswijk</h2><p class="mut">Rijswijk-kern (CBS-wijken binnen 10 km, gewogen naar huishoudens): ${r.rijswijk.profielKern10km.koop}% koop · ${r.rijswijk.profielKern10km.eengezins}% eengezins · WOZ € ${r.rijswijk.profielKern10km.woz}k · inkomen € ${r.rijswijk.profielKern10km.inkStd}k. Gemeente Rijswijk: ${rw.koop}% koop, ${rw.eengezins}% eengezins, WOZ € ${rw.woz}k, verkoopprijs 2025 € ${nl(Math.round(vp['GM0603'] / 1000))}k, ${nl(rw.inwoners)} inwoners. Gemeenten met ≥60 leads/jr, gesorteerd op leads. "T.o.v. afstand" = leads per huishouden vergeleken met wat de afstand tot Rijswijk voorspelt. Lookalike = gelijkenis met het Sonty-klantprofiel (0-100).</p><div class="scroll"><table><thead><tr><th>Gemeente</th><th class="num">km</th><th class="num">Leads/jr</th><th class="num">Akk/jr</th><th class="num">Conv</th><th class="num">Leads/1.000 hh</th><th class="num">T.o.v. afstand</th><th class="num">Koop</th><th class="num">Eengezins</th><th class="num">WOZ</th><th class="num">Prijs 2025</th><th class="num">Inkomen</th><th class="num">Lookalike</th></tr></thead><tbody>${gemRows}</tbody></table></div></section>

<section><h2>Ranking van kandidaten (beste per gemeente, t.o.v. alleen Rijswijk)</h2><p class="mut">Score = 40% bewezen uplift · 20% koopwoningen binnen 15 km · 15% onbenut potentieel · 15% lookalike · 10% afstand magazijn. Netto = 200 m² zichtlocatie, 75% van de uplift. Alle ${v.kandidatenTotaal} kandidaten staan in resultaat.json.</p><div class="scroll"><table><thead><tr><th class="num">#</th><th>Kandidaat</th><th class="num">Score</th><th class="num">+Akk vol</th><th class="num">Leads 20 km</th><th class="num">Koopwoningen 15 km</th><th class="num">Koop-index</th><th class="num">Onbenut</th><th class="num">Lookalike</th><th class="num">km Berkel</th><th class="num">Netto/jr</th></tr></thead><tbody>${rankRows}</tbody></table></div></section>

<section><h2>Netwerkscenario's met 4 winkels</h2><p class="mut">Per scenario marginaal doorgerekend in volgorde (elke volgende winkel telt alleen wat de vorige nog niet dekt). Harde eisen: ≥18 km tussen winkels, ≥15 km van Rijswijk. Combinatorisch getoetst: ${v.kandidatenMetCatchment} kandidaten, ${r.combosTotaal} geldige 4-sets uit de top-20; beste = scenario B.</p><div class="scroll"><table><thead><tr><th>Scenario</th><th>Winkels (marginale akkoorden)</th><th class="num">Akk/jr vol</th><th class="num">Omzet real.</th><th class="num">Netto zonder inloop</th><th class="num">Met 25% inloop</th><th class="num">Conservatief</th><th class="num">Onbenut</th></tr></thead><tbody>${scenRows}</tbody></table></div><p>Winkel 1 en 2 zijn in elk scenario gelijk; de discussie gaat over 3 en 4, en die draaien alleen positief met inloop. Scenario I heeft het hoogste netto maar stapelt twee winkels in Amsterdam (30% koop, laagste koopwoning-index). Het advies kiest Utrecht: nieuwe regio, hoogste koopkracht-index, grootste onbenutte potentieel. Leiden valt af: 18 minuten van Rijswijk, negatief bij elke gevoeligheid.</p></section>

<section><h2>Kosten, break-even en gevoeligheid</h2><div class="w4-two"><div class="panel"><h3>Per winkel per jaar, 200 m² zichtlocatie</h3><table class="kv"><tr><td>Huur (€ ${k.huurM2}/m², bandbreedte € ${r.constanten.HUUR.zicht.laag}-${r.constanten.HUUR.zicht.hoog})</td><td class="num">${eur(k.huur)}</td></tr><tr><td>Servicekosten</td><td class="num">${eur(k.service)}</td></tr><tr><td>1,5 FTE verkoop</td><td class="num">${eur(k.personeel)}</td></tr><tr><td>Lokale marketing</td><td class="num">${eur(k.marketing)}</td></tr><tr><td>Inrichting € ${nl(k.eenmalig)} over 5 jaar</td><td class="num">${eur(k.inrichtingJr)}</td></tr><tr class="tot"><td>Totaal</td><td class="num">${eur(k.totaal)}</td></tr></table><p class="mut">Break-even in extra akkoorden per jaar: ${be.zicht175} bij 175 m² zicht · ${be.zicht200} bij 200 m² zicht · ${be.pdv250} bij 250 m² woonboulevard · ${be.centrum200} bij 200 m² centrum. Personeel is ${Math.round(100 * k.personeel / k.totaal)}% van de kosten: de bezetting weegt zwaarder dan de m².</p></div><div class="panel"><h3>Gevoeligheid (netto/jr, zonder inloop tenzij vermeld)</h3><div class="scroll"><table><thead><tr><th>Winkel</th><th class="num">Basis</th><th class="num">Huur +20%</th><th class="num">Uplift −20%</th><th class="num">Leads −30%</th><th class="num">Alles tegen</th><th class="num">Inloop 25%</th><th class="num">Inloop 50%</th></tr></thead><tbody>${ADVIES.winkels.map((w) => `<tr><td>${esc(ZOEK[w.naam].kop.split(' ')[0])}</td>${['basis', 'huurPlus20', 'upliftMin20', 'leadsMin30', 'worst'].map((key) => `<td class="num ${w.gevoeligheid[key] >= 0 ? 'pos' : 'neg'}">${eurK(w.gevoeligheid[key])}</td>`).join('')}<td class="num ${w.econ.nettoInloop25 >= 0 ? 'pos' : 'neg'}">${eurK(w.econ.nettoInloop25)}</td><td class="num ${w.econ.nettoInloop50 >= 0 ? 'pos' : 'neg'}">${eurK(w.econ.nettoInloop50)}</td></tr>`).join('')}</tbody></table></div><p class="mut">Huurbronnen en bandbreedtes: docs/winkels-4/01-huurprijzen-bronnen.md. Inrichting is een aanname.</p></div></div></section>

<section><h2>Fasering</h2><ol class="fase"><li><b>Nu: Rotterdam-Zuid/Oost.</b> Dichtst bij het magazijn, grootste bewezen vraag, positief in elk scenario. Het eerdere loods-onderzoek (Cornelisland/Reijerwaard) ligt in dit zoekgebied.</li><li><b>Na 6 maanden twee dingen meten.</b> Online-conversie binnen 10 km van winkel 1 moet van ~12% richting ${pct(100 * v.curveMeting[0].conv, 0)} gaan (is de curve causaal?), en hoeveel inloop de winkel zelf trekt tegenover Rijswijk (${v.inloopRijswijk.winkelLeadsJr} bezoekers/jr). Klopt het tweede op 25% of meer, dan zijn winkel 3 en 4 verantwoord.</li><li><b>Dan Haarlemmermeer / Amsterdam Nieuw-West</b> aan de A4/A9, bereikbaar voor Haarlem, Hoofddorp, Amstelveen en Amsterdam-West.</li><li><b>Winkel 3 en 4 alleen in klein format</b> (175 m², lage huur, 1 FTE op afspraak) met lokale marketing om het onbenutte potentieel aan te boren: Utrecht-West en Zuidplas.</li></ol></section>

<section><h2>Wat dit onderzoek niet kan zeggen</h2><ul class="lim"><li>Of de conversiecurve causaal is (winkel dichtbij → hogere conversie) of deels selectie. Bewijs komt uit winkel 1.</li><li>Hoeveel inloop een nieuwe winkel trekt. Rijswijk staat er jaren en heeft reviews; 25% is een aanname.</li><li>Den Haag zit als één woonplaats in het register (${nl(v.denHaagAlsEenPlaats)} leads/jr); wijken zijn niet te scheiden. Den Haag blijft hoe dan ook bij Rijswijk.</li><li>Concurrentiedichtheid is niet gemeten (geen betrouwbare bron per gebied); tellen bij de bezichtiging.</li><li>Huurprijzen zijn bandbreedtes uit rapporten en aanbod, geen offertes.</li><li>Seizoen: 63% van de leads valt in maart t/m augustus; een najaarsopening ziet de eerste 5 maanden weinig.</li><li>CBS-cijfers peiljaar 2024 (publicatie juni 2026), verkoopprijzen 2025.</li></ul></section>

<footer class="w4-foot">Bronnen: Sonty offerte-register (${nl(v.leadsTotaal)} leads, ${nl(v.plaatsenGeocodeerd)} woonplaatsen) · ${esc(v.cbsTabel)} · CBS 83625NED verkoopprijzen 2025 · ${esc(v.pdok)} · ${esc(rt.bron)} · model scripts/winkels-4-analyse.js · rapport docs/winkels-4/02-rapport.md</footer>
</div>`;

const css = `
.w4{--bg:#F4F2ED;--panel:#FFFFFF;--panel2:#FBFAF7;--ink:#1B1915;--mut:#6E685E;--line:#DDD8CF;--accent:#FF6B00;--accent-ink:#B54A00;--good:#2F8F5B;--warn:#C98A12;--bad:#C8402E;--dot:#B8B2A6;--map:#EDEAE2;
 font-family:Figtree,system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;font-size:15px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .w4{--bg:#12110F;--panel:#1C1A17;--panel2:#221F1B;--ink:#F1EDE6;--mut:#A39D92;--line:#2F2B26;--accent:#FF7A1F;--accent-ink:#FFA05C;--good:#5FC48A;--warn:#E0A83A;--bad:#EE6A55;--dot:#5A554D;--map:#181613}}
:root[data-theme="dark"] .w4{--bg:#12110F;--panel:#1C1A17;--panel2:#221F1B;--ink:#F1EDE6;--mut:#A39D92;--line:#2F2B26;--accent:#FF7A1F;--accent-ink:#FFA05C;--good:#5FC48A;--warn:#E0A83A;--bad:#EE6A55;--dot:#5A554D;--map:#181613}
.w4{max-width:1140px;margin:0 auto;padding:36px 22px 80px}
.w4 *{box-sizing:border-box}
.w4 h1{font-family:"Permanent Marker",Figtree,cursive;font-weight:400;font-size:clamp(34px,5vw,54px);line-height:1.05;margin:4px 0 14px;color:var(--accent);text-wrap:balance}
.w4 h2{font-size:22px;margin:0 0 8px;text-wrap:balance}
.w4 h3{font-size:16px;margin:0 0 8px}
.w4 section{margin-top:44px}
.w4 .eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--mut);margin:0}
.w4 .lead{font-size:17px;max-width:70ch;margin:0}
.w4 .mut{color:var(--mut);font-size:13.5px}
.w4 b{font-weight:700}
.w4 .pos{color:var(--good)} .w4 .neg{color:var(--bad)}
.w4 .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.w4 .pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;color:#fff}
.w4 .pill.good{background:var(--good)} .w4 .pill.warn{background:var(--warn)} .w4 .pill.bad{background:var(--bad)} .w4 .pill.accent{background:var(--accent)}
.w4-stores{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:28px}
.w4-store{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 18px 14px;display:flex;flex-direction:column;gap:6px}
.w4-store-top{display:flex;justify-content:space-between;align-items:center}
.w4-rank{font-family:"Permanent Marker",cursive;font-size:30px;color:var(--accent);line-height:1}
.w4-store h3{font-size:17px;margin:2px 0 0;text-wrap:balance}
.w4-store .sub{color:var(--mut);font-size:13px;margin:0 0 6px}
.w4-store dl{margin:0;display:grid;gap:7px;border-top:1px solid var(--line);padding-top:10px}
.w4-store dt{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.w4-store dd{margin:0;font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}
.w4-store dd small{font-size:12px;font-weight:400;color:var(--mut);margin-left:4px}
.w4-store .top{font-size:12.5px;color:var(--mut);margin:8px 0 0;border-top:1px solid var(--line);padding-top:8px}
.w4-total{margin:14px 0 0;font-size:15px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px 16px}
.w4-map-wrap{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,.8fr);gap:22px;align-items:start;margin-top:44px}
@media (max-width:760px){.w4-map-wrap{grid-template-columns:1fr}}
.w4-map{background:var(--map);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.w4-map svg{display:block;width:100%;height:auto}
.w4-map .lbl{font:12px Figtree,system-ui,sans-serif;fill:var(--ink);paint-order:stroke;stroke:var(--map);stroke-width:3px;stroke-linejoin:round}
.w4-map .lbl.strong{font-weight:700;font-size:13px}
.w4-map .num{font:700 12px Figtree,system-ui,sans-serif;fill:#fff;text-anchor:middle}
.w4-legend h2{font-size:17px}
.w4-legend ul{list-style:none;padding:0;margin:8px 0}
.w4-legend li{display:flex;gap:9px;align-items:center;font-size:13.5px;margin:5px 0}
.w4-legend i{width:12px;height:12px;border-radius:50%;flex:none;display:inline-block}
.w4-legend p{font-size:13.5px;color:var(--mut)}
.w4-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.w4 .panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
.w4 .big{font-size:20px;margin:0 0 8px}
.curve{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;align-items:end;height:170px;margin:8px 0 10px}
.curve-bar{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;height:100%}
.curve-bar .fill{width:70%;background:linear-gradient(180deg,#FF8A3D,var(--accent));border-radius:6px 6px 2px 2px;min-height:4px}
.curve-bar b{font-size:13px;margin-top:6px;font-variant-numeric:tabular-nums}
.curve-bar span{font-size:11px;color:var(--mut)} .curve-bar small{font-size:10px;color:var(--mut)}
.w4 .scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.w4 table{border-collapse:collapse;width:100%;font-size:13.5px}
.w4 th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);padding:10px 10px;border-bottom:1px solid var(--line);background:var(--panel2);white-space:nowrap}
.w4 td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.w4 tr:last-child td{border-bottom:0}
.w4 tr.hl td{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.w4 table.kv td{padding:6px 0} .w4 table.kv tr.tot td{font-weight:700;border-top:2px solid var(--line);border-bottom:0}
.w4 .bar{display:inline-block;width:56px;height:6px;background:var(--line);border-radius:3px;margin-right:8px;vertical-align:middle;position:relative;overflow:hidden}
.w4 .bar::after{content:"";position:absolute;inset:0;width:var(--w);background:var(--accent);border-radius:3px}
.fase{padding-left:22px;max-width:75ch} .fase li{margin:8px 0}
.lim{max-width:75ch;padding-left:20px} .lim li{margin:6px 0;font-size:14px}
.w4-foot{margin-top:44px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);padding-top:14px}
`;
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Permanent+Marker&display=swap">';
const arg = process.argv.indexOf('--artifact');
if (arg > 0) fs.writeFileSync(process.argv[arg + 1], `<title>Vier winkels naast Rijswijk</title>\n${fonts}\n<style>body{margin:0;background:#F4F2ED}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) body{background:#12110F}}:root[data-theme="dark"] body{background:#12110F}${css}</style>\n${body}`);
fs.writeFileSync('/Users/clawdboot/sonty-website/data/winkels-4.html', `<style>${css}</style>\n${body}`);
console.log('OK pagina gebouwd', H + 'px kaart', body.length, 'bytes');
