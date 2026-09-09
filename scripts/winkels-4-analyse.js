#!/usr/bin/env node
// Winkelnetwerk-onderzoek: 4 winkels van 175-250 m² naast showroom Rijswijk.
// Bronnen: data/winkel-leads.json (offerte-register), data/winkel-geo.json (PDOK-geocode per woonplaats),
// data/winkels-4/cbs-wijken-2024.json (CBS 85984NED), cbs-sted.json, centroids.json (PDOK), plaats-gemeente.json (PDOK).
// Output: data/winkels-4/resultaat.json
const fs = require('fs');
const D = __dirname + '/../data/';
const leads = require(D + 'winkel-leads.json');
const geo = require(D + 'winkel-geo.json');
const cbsRows = require(D + 'winkels-4/cbs-wijken-2024.json');
const sted = require(D + 'winkels-4/cbs-sted.json');
const cent = require(D + 'winkels-4/centroids.json');
const plaatsGm = require(D + 'winkels-4/plaats-gemeente.json');

const RIJSWIJK = { lat: 52.0365, lon: 4.3253, naam: 'Showroom Rijswijk' };
const BERKEL = { lat: 51.9917, lon: 4.4790, naam: 'Magazijn Berkel en Rodenrijs' };
const JAAR_TABS = ['Sep 2025', 'Okt 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Maart 2026', 'April 2026', 'Mei 2026', 'Juni 2026 ', 'Juli 2026 ', 'Aug 2026'];
const RUIS = new Set(['nb', 'onbekend', '-', 'x', 'test', '']);
const CURVE = [{ tot: 10, conv: 0.266 }, { tot: 20, conv: 0.151 }, { tot: 30, conv: 0.107 }, { tot: 50, conv: 0.079 }, { tot: 80, conv: 0.040 }, { tot: 9999, conv: 0.016 }];
const ORDERWAARDE = 3609, MARGE = 0.458, CATCHMENT_KM = 20, MIN_AFSTAND_WINKELS = 18, MIN_AFSTAND_RIJSWIJK = 15;

function dist(a, b) { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
const norm = (p) => String(p || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/['’`]/g, "'").replace(/^den haag.*/, 'den haag').replace(/^'?s[- ]gravenhage$/, 'den haag').replace(/^hoek van holland.*/, 'hoek van holland');
const t = (s) => String(s || '').trim();
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- 0. herijk de curve op de nieuwe data (alle leads, afstand tot Rijswijk) ----------
const plaatsen = geo.filter((p) => !RUIS.has(p.plaats) && p.lat);
const curveMeting = CURVE.map((b, i) => { const van = i ? CURVE[i - 1].tot : 0; const rows = plaatsen.filter((p) => p.kmRijswijk >= van && p.kmRijswijk < b.tot); const L = rows.reduce((s, p) => s + p.leads, 0), A = rows.reduce((s, p) => s + p.akkoord, 0); return { band: van + '-' + (b.tot > 1000 ? '∞' : b.tot) + ' km', leads: L, akkoord: A, conv: L ? A / L : 0, curveOud: b.conv }; });
const curve = curveMeting.map((m, i) => ({ tot: CURVE[i].tot, conv: m.leads >= 200 ? m.conv : CURVE[i].conv }));
const curveAt = (km) => curve.find((b) => km < b.tot).conv;

// ---------- 1. jaarbasis per woonplaats ----------
const jaar = {};
for (const l of leads) { if (!JAAR_TABS.includes(l.tab)) continue; const p = norm(l.plaats); if (RUIS.has(p)) continue; const e = (jaar[p] = jaar[p] || { leads: 0, akkoord: 0, teVer: 0, omzet: 0, winkel: 0 }); e.leads++; if (l.akkoord) { e.akkoord++; e.omzet += l.omzet || 0; } if (l.teVer) e.teVer++; if (/winkel/i.test(l.kanaal)) e.winkel++; }
const jaarTotaal = Object.values(jaar).reduce((s, e) => ({ leads: s.leads + e.leads, akkoord: s.akkoord + e.akkoord, teVer: s.teVer + e.teVer }), { leads: 0, akkoord: 0, teVer: 0 });

// ---------- 2. CBS per gemeente + wijk ----------
const cbs = {}; const wijken = [];
for (const r of cbsRows) {
  const code = t(r.Codering_3); const s = sted[code] || {};
  const rec = { code, gemeente: t(r.Gemeentenaam_1).replace(/ \(.*\)$/, ''), soort: t(r.SoortRegio_2), inwoners: r.AantalInwoners_5, hh: r.HuishoudensTotaal_29, hhKind: r.HuishoudensMetKinderen_32, woningen: r.Woningvoorraad_35, woz: r.GemiddeldeWOZWaardeVanWoningen_39, eengezins: r.PercentageEengezinswoning_40, koop: r.Koopwoningen_47, corporatie: r.InBezitWoningcorporatie_49, oud: r.BouwjaarMeerDanTienJaarGeleden_51, zon: r.WoningenMetZonnestroom_59, inkOntv: r.GemiddeldInkomenPerInkomensontvanger_77, inkInw: r.GemiddeldInkomenPerInwoner_78, inkStd: r.GemGestandaardiseerdInkomen_83, hoog20: r.k_20HuishoudensMetHoogsteInkomen_85, vermogen: r.MediaanVermogenVanParticuliereHuish_86, autos: r.PersonenautoSPerHuishouden_107, sted: s.sted, oad: s.oad, land: s.land, dichtheid: r.Bevolkingsdichtheid_34 };
  rec.koopwoningen = rec.woningen && rec.koop != null ? Math.round(rec.woningen * rec.koop / 100) : null;
  if (rec.soort === 'Gemeente') { const c = cent.gemeenten[code]; if (c) Object.assign(rec, { lat: c.lat, lon: c.lon, km: c.km }); cbs[code] = rec; }
  else if (rec.soort === 'Wijk') { const c = cent.wijken[code]; if (c) { Object.assign(rec, { lat: c.lat, lon: c.lon, km: c.km, gm: c.gm, naam: c.naam }); wijken.push(rec); } }
}
const gemeenten = Object.values(cbs).filter((g) => g.lat);

// ---------- 3. vraag per gemeente (Sonty) + koppeling CBS ----------
const vraagGm = {};
for (const p of plaatsen) { const m = plaatsGm[p.plaats]; if (!m) continue; const e = (vraagGm[m.gm] = vraagGm[m.gm] || { leads: 0, akkoord: 0, omzet: 0, teVer: 0, jaarLeads: 0, jaarAkkoord: 0, jaarTeVer: 0, winkel: 0, plaatsen: [] }); e.leads += p.leads; e.akkoord += p.akkoord; e.omzet += p.omzet; e.teVer += p.teVer; e.winkel += p.winkelLeads; const j = jaar[p.plaats]; if (j) { e.jaarLeads += j.leads; e.jaarAkkoord += j.akkoord; e.jaarTeVer += j.teVer; } e.plaatsen.push(p.plaats); }
const gmRows = gemeenten.map((g) => { const v = vraagGm[g.code] || { leads: 0, akkoord: 0, omzet: 0, teVer: 0, jaarLeads: 0, jaarAkkoord: 0, jaarTeVer: 0, winkel: 0, plaatsen: [] }; return { ...g, ...v, conv: v.leads ? v.akkoord / v.leads : null, leadsPer1000hh: g.hh ? 1000 * v.jaarLeads / g.hh : null, akkoordPer1000koop: g.koopwoningen ? 1000 * v.jaarAkkoord / g.koopwoningen : null, curveConv: curveAt(g.km) }; });

// ---------- 4. regressie: wat verklaart Sonty-conversie naast afstand? ----------
function ols(X, y) { const n = X.length, k = X[0].length; const A = Array.from({ length: k }, () => Array(k + 1).fill(0)); for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; A[a][k] += X[i][a] * y[i]; } for (let c = 0; c < k; c++) { let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;[A[c], A[piv]] = [A[piv], A[c]]; for (let r = 0; r < k; r++) if (r !== c && A[c][c]) { const f = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j]; } } const beta = A.map((row, i) => row[k] / row[i]); const yh = X.map((x) => x.reduce((s, v, i) => s + v * beta[i], 0)); const ym = y.reduce((s, v) => s + v, 0) / n; const ssr = y.reduce((s, v, i) => s + (v - yh[i]) ** 2, 0), sst = y.reduce((s, v) => s + (v - ym) ** 2, 0); return { beta, r2: 1 - ssr / sst, n }; }
const regRows = gmRows.filter((g) => g.leads >= 40 && g.km < 80 && g.koop != null && g.woz && g.inkStd && g.eengezins != null);
const feats = [['const', () => 1], ['log_km', (g) => Math.log(g.km + 1)], ['koop%', (g) => g.koop], ['eengezins%', (g) => g.eengezins], ['woz_k', (g) => g.woz], ['inkStd_k', (g) => g.inkStd]];
const reg = ols(regRows.map((g) => feats.map(([, f]) => f(g))), regRows.map((g) => 100 * g.conv));
const regAfstand = ols(regRows.map((g) => [1, Math.log(g.km + 1)]), regRows.map((g) => 100 * g.conv));
const regressie = { n: reg.n, r2: r1(100 * reg.r2), r2AlleenAfstand: r1(100 * regAfstand.r2), coef: Object.fromEntries(feats.map(([n], i) => [n, +reg.beta[i].toFixed(3)])), toelichting: 'OLS op conversie% per gemeente (≥40 leads, <80 km); gewogen niet, alleen indicatief. Coëfficiënt = %-punt conversie per eenheid.' };
// regressie 2: penetratie (leads/jr per 1000 huishoudens, log) — waar komt Sonty's vraag vandaan, gecorrigeerd voor afstand?
const penRows = gmRows.filter((g) => g.jaarLeads >= 15 && g.km < 80 && g.hh && g.koop != null && g.woz && g.inkStd && g.eengezins != null);
const regPen = ols(penRows.map((g) => feats.map(([, f]) => f(g))), penRows.map((g) => Math.log(g.leadsPer1000hh)));
const regPenAfstand = ols(penRows.map((g) => [1, Math.log(g.km + 1)]), penRows.map((g) => Math.log(g.leadsPer1000hh)));
const regressiePenetratie = { n: regPen.n, r2: r1(100 * regPen.r2), r2AlleenAfstand: r1(100 * regPenAfstand.r2), coef: Object.fromEntries(feats.map(([n], i) => [n, +regPen.beta[i].toFixed(4)])), effectPer10punt: { 'koop% +10': r1(100 * (Math.exp(10 * regPen.beta[2]) - 1)), 'eengezins% +10': r1(100 * (Math.exp(10 * regPen.beta[3]) - 1)), 'woz +100k': r1(100 * (Math.exp(100 * regPen.beta[4]) - 1)), 'inkStd +10k': r1(100 * (Math.exp(10 * regPen.beta[5]) - 1)) }, toelichting: 'OLS op log(leads per 1000 huishoudens per jaar) per gemeente (≥15 leads/jr, <80 km). effectPer10punt = % meer leads per huishouden bij +10 punten, bij gelijke afstand.' };
for (const g of gmRows) if (g.leadsPer1000hh > 0) g.penResidu = r1(100 * (Math.exp(Math.log(g.leadsPer1000hh) - (regPenAfstand.beta[0] + regPenAfstand.beta[1] * Math.log(g.km + 1))) - 1));
// residu per gemeente: waar doet Sonty het beter dan de afstand voorspelt?
for (const g of gmRows) if (g.conv != null) g.residu = r1(100 * g.conv - (regAfstand.beta[0] + regAfstand.beta[1] * Math.log(g.km + 1)));

// ---------- 5. Rijswijk-referentieprofiel + lookalike ----------
const VARS = [['koop', 'Koopwoningen %', 0.30], ['eengezins', 'Eengezinswoningen %', 0.20], ['woz', 'WOZ-waarde (k€)', 0.15], ['inkStd', 'Gestandaardiseerd inkomen (k€)', 0.15], ['oud', 'Bouwjaar >10 jr %', 0.10], ['oad', 'Adressendichtheid', 0.10]];
const std = {}; for (const [k] of VARS) { const v = gemeenten.map((g) => g[k]).filter((x) => x != null); const m = v.reduce((s, x) => s + x, 0) / v.length; std[k] = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); }
const rijswijkGm = cbs['GM0603'];
const kernWijken = wijken.filter((w) => dist(w, RIJSWIJK) < 10 && w.hh);
const wavg = (rows, k) => { const r = rows.filter((x) => x[k] != null); const W = r.reduce((s, x) => s + x.hh, 0); return W ? r.reduce((s, x) => s + x[k] * x.hh, 0) / W : null; };
const profielKern = Object.fromEntries(VARS.map(([k]) => [k, r1(wavg(kernWijken, k))]));
// Sonty-kernklant: gemeenten met hoogste akkoord-penetratie per 1000 koopwoningen (min 30 akkoord), huishoud-gewogen
const topPen = gmRows.filter((g) => g.jaarAkkoord >= 25 && g.koopwoningen).sort((a, b) => b.akkoordPer1000koop - a.akkoordPer1000koop).slice(0, 12);
const profielKlant = Object.fromEntries(VARS.map(([k]) => [k, r1(wavg(topPen, k))]));
function lookalike(rec, ref) { let s = 0, w = 0; const per = {}; for (const [k, , g] of VARS) { if (rec[k] == null || ref[k] == null) continue; const z = Math.abs(rec[k] - ref[k]) / std[k]; per[k] = r1(z); s += g * Math.min(z, 3); w += g; } return w ? { score: r1(100 * (1 - (s / w) / 3)), per } : null; }

// ---------- 6. kandidaten: gemeente-centroïden <75 km + wijken van grote gemeenten ----------
const kandidaten = [];
for (const g of gemeenten) { if (g.km > 75 || g.km < 8) continue; if (g.inwoners >= 120000) { for (const w of wijken.filter((w) => w.gm === g.code && w.hh >= 4000)) kandidaten.push({ id: w.code, naam: g.gemeente + ' – ' + w.naam, gemeente: g.gemeente, gm: g.code, lat: w.lat, lon: w.lon, km: w.km, cbs: w }); } else kandidaten.push({ id: g.code, naam: g.gemeente, gemeente: g.gemeente, gm: g.code, lat: g.lat, lon: g.lon, km: g.km, cbs: g }); }

// ---------- 7. uplift-model per kandidaat gegeven bestaand netwerk ----------
function uplift(k, netwerk) {
  const catch_ = []; let extra = 0, jaarLeads = 0, teVer = 0, huidigAkk = 0;
  for (const p of plaatsen) { const j = jaar[p.plaats]; if (!j) continue; const dK = dist(p, k); if (dK > CATCHMENT_KM) continue; const dBest = Math.min(...netwerk.map((n) => dist(p, n))); if (dK >= dBest) continue; const huidig = p.leads >= 10 ? p.akkoord / p.leads : curveAt(dBest); const nieuw = curveAt(dK); const up = Math.max(0, nieuw - huidig); const e = (j.leads - j.teVer) * up + j.teVer * nieuw; extra += e; jaarLeads += j.leads; teVer += j.teVer; huidigAkk += j.leads * huidig; catch_.push({ plaats: p.plaats, km: Math.round(dK), jaarLeads: j.leads, teVer: j.teVer, huidigeConv: r1(100 * huidig), nieuweConv: r1(100 * nieuw), extraAkkoord: r1(e) }); }
  // marktpotentieel: koopwoningen binnen 15 km die nu >20 km van elke winkel liggen (onbenut) + binnen 15 km totaal
  let koopBinnen15 = 0, koopOnbenut = 0, hhBinnen15 = 0, inkW = 0, latentW = 0, idxW = 0;
  for (const w of wijken) { const dK = dist(w, k); if (dK > 15 || !w.koopwoningen) continue; koopBinnen15 += w.koopwoningen; hhBinnen15 += w.hh || 0; if (w.inkStd) inkW += w.inkStd * (w.hh || 0); const dBest = Math.min(...netwerk.map((n) => dist(w, n))); const idx = penIndex(w); idxW += idx * w.koopwoningen; if (dBest > 20) { koopOnbenut += w.koopwoningen; latentW += w.koopwoningen * idx; } }
  return { extraAkkoord: extra, jaarLeads, teVer, huidigAkk, catchment: catch_.sort((a, b) => b.extraAkkoord - a.extraAkkoord), koopBinnen15, koopOnbenut, hhBinnen15, inkGem15: hhBinnen15 ? r1(inkW / hhBinnen15) : null, koopIndex15: koopBinnen15 ? r1(100 * idxW / koopBinnen15) : null, latentGewogen: latentW };
}
// koopkracht-/koopwoning-index per wijk: verwachte leads per huishouden t.o.v. de Rijswijk-kern bij gelijke afstand (uit penetratie-regressie)
function penIndex(rec) { const b = regPen.beta; const ref = profielKern; const d = (k) => (rec[k] != null && ref[k] != null ? rec[k] - ref[k] : 0); return Math.exp(b[2] * d('koop') + b[3] * d('eengezins') + b[4] * d('woz') + b[5] * d('inkStd')); }
// penetratie-referentie: leads/jaar per 1000 koopwoningen in de Rijswijk-kern (<10 km)
const kern10 = gmRows.filter((g) => g.km < 10 && g.koopwoningen);
const penKern = 1000 * kern10.reduce((s, g) => s + g.jaarLeads, 0) / kern10.reduce((s, g) => s + g.koopwoningen, 0);

// ---------- 8. kosten 175-250 m² ----------
// huurbandbreedtes uit docs/winkels-4/01-huurprijzen-bronnen.md (agent-onderzoek 09-09-2026); indien onvolledig: aannames, gemarkeerd.
const HUUR = { pdv: { laag: 90, mid: 120, hoog: 160, label: 'woonboulevard/PDV' }, zicht: { laag: 75, mid: 95, hoog: 125, label: 'bedrijventerrein zichtlocatie' }, centrum: { laag: 150, mid: 225, hoog: 350, label: 'centrum/aanloopstraat' } };
function kosten(m2, type, niveau = 'mid') { const huur = m2 * HUUR[type][niveau]; const service = Math.round(m2 * 35); const personeel = 72000; const marketing = 12000; const inrichting = Math.round((45000 + m2 * 250) / 5); return { m2, type: HUUR[type].label, huurM2: HUUR[type][niveau], huur, service, personeel, marketing, inrichtingJr: inrichting, totaal: huur + service + personeel + marketing + inrichting, eenmalig: 45000 + m2 * 250 }; }
const breakEven = (kost) => Math.ceil(kost.totaal / (ORDERWAARDE * MARGE));

// ---------- 9. scoren + selecteren ----------
function scoreKandidaat(k, netwerk) {
  const u = uplift(k, netwerk); const la = lookalike(k.cbs, profielKlant); const laR = lookalike(k.cbs, profielKern);
  const kmBerkel = dist(k, BERKEL);
  const v = vraagGm[k.gm] || {}; const gmRow = gmRows.find((g) => g.code === k.gm) || {};
  return { ...k, cbs: undefined, profiel: { koop: k.cbs.koop, eengezins: k.cbs.eengezins, woz: k.cbs.woz, inkStd: k.cbs.inkStd, oud: k.cbs.oud, oad: k.cbs.oad, sted: k.cbs.sted, hh: k.cbs.hh, koopwoningen: k.cbs.koopwoningen }, gemeenteVraag: { leads: v.leads || 0, akkoord: v.akkoord || 0, jaarLeads: v.jaarLeads || 0, jaarAkkoord: v.jaarAkkoord || 0, conv: gmRow.conv != null ? r1(100 * gmRow.conv) : null, residu: gmRow.residu ?? null, leadsPer1000hh: gmRow.leadsPer1000hh != null ? r1(gmRow.leadsPer1000hh) : null }, uplift: { extraAkkoordVol: Math.round(u.extraAkkoord), jaarLeadsCatchment: u.jaarLeads, teVer: u.teVer, huidigAkk: Math.round(u.huidigAkk), koopBinnen15: u.koopBinnen15, koopOnbenut: u.koopOnbenut, hhBinnen15: u.hhBinnen15, inkGem15: u.inkGem15, latentLeads: Math.round(u.latentGewogen * penKern / 1000), koopIndex15: u.koopIndex15 }, lookalikeKlant: la, lookalikeRijswijk: laR, kmBerkel: Math.round(kmBerkel), topCatchment: u.catchment.slice(0, 8) };
}
function composite(s, max) { const a = s.uplift.extraAkkoordVol / max.extra, b = s.uplift.koopBinnen15 / max.koop, c = (s.lookalikeKlant ? s.lookalikeKlant.score : 50) / 100, d = 1 - Math.min(s.kmBerkel, 70) / 70, e = s.uplift.latentLeads / max.latent; return r1(100 * (0.40 * a + 0.20 * b + 0.15 * e + 0.15 * c + 0.10 * d)); }
function econ(s) { const real = s.uplift.extraAkkoordVol * 0.75; const omzet = real * ORDERWAARDE, bw = omzet * MARGE; const k200 = kosten(200, 'zicht'), k250pdv = kosten(250, 'pdv'), k175 = kosten(175, 'zicht'), k175l = kosten(175, 'zicht', 'laag'); return { realistischAkkoord: Math.round(real), extraOmzet: Math.round(omzet), brutowinst: Math.round(bw), nettoZicht200: Math.round(bw - k200.totaal), nettoPdv250: Math.round(bw - k250pdv.totaal), nettoZicht175: Math.round(bw - k175.totaal), nettoZicht175laag: Math.round(bw - k175l.totaal), breakEven175laag: breakEven(k175l), breakEvenAkkoord: breakEven(k200), conservatief: Math.round(s.uplift.extraAkkoordVol * 0.5 * ORDERWAARDE * MARGE - k200.totaal), vol: Math.round(s.uplift.extraAkkoordVol * ORDERWAARDE * MARGE - k200.totaal) }; }

// ronde 0: alle kandidaten t.o.v. alleen Rijswijk
const base = kandidaten.map((k) => scoreKandidaat(k, [RIJSWIJK])).filter((s) => s.uplift.jaarLeadsCatchment > 0);
const max0 = { extra: Math.max(...base.map((s) => s.uplift.extraAkkoordVol)), koop: Math.max(...base.map((s) => s.uplift.koopBinnen15)), latent: Math.max(...base.map((s) => s.uplift.latentLeads)) || 1 };
for (const s of base) { s.score = composite(s, max0); s.econ = econ(s); }
base.sort((a, b) => b.score - a.score);
const ok = (k, net) => net.every((n) => dist(k, n) >= (n === RIJSWIJK ? MIN_AFSTAND_RIJSWIJK : MIN_AFSTAND_WINKELS));

// greedy: 4 keer beste marginale kandidaat
const greedy = []; let netwerk = [RIJSWIJK];
for (let r = 0; r < 4; r++) { const ronde = kandidaten.filter((k) => ok(k, netwerk)).map((k) => scoreKandidaat(k, netwerk)).filter((s) => s.uplift.jaarLeadsCatchment > 0); for (const s of ronde) { s.score = composite(s, max0); s.econ = econ(s); } ronde.sort((a, b) => b.score - a.score); const win = ronde[0]; if (!win) break; win.ronde = r + 1; win.alternatieven = ronde.slice(1, 12).map((s) => ({ naam: s.naam, score: s.score, extraAkkoord: s.uplift.extraAkkoordVol, latentLeads: s.uplift.latentLeads, lookalike: s.lookalikeKlant?.score, koopIndex15: s.uplift.koopIndex15, kmBerkel: s.kmBerkel, netto200: s.econ.nettoZicht200, netto175laag: s.econ.nettoZicht175laag })); greedy.push(win); netwerk = [...netwerk, win]; }

// combinatorisch: beste 4-set uit top-16 (op basisscore), marginaal doorgerekend, score = som extraAkkoord (marginaal) 
const perGm = {}; for (const s of base) if (!perGm[s.gm]) perGm[s.gm] = s; const top = Object.values(perGm).filter((s) => dist(s, RIJSWIJK) >= MIN_AFSTAND_RIJSWIJK).slice(0, 20); const combos = []; const setEval = (set) => { let net = [RIJSWIJK], tot = 0, latent = 0; for (const k of set) { const u = uplift(k, net); tot += u.extraAkkoord; latent += Math.round(u.latentGewogen * penKern / 1000); net = [...net, k]; } return { tot, latent }; };
for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) for (let c = b + 1; c < top.length; c++) for (let d = c + 1; d < top.length; d++) { const set = [top[a], top[b], top[c], top[d]]; let valid = true; for (let i = 0; i < 4 && valid; i++) { if (dist(set[i], RIJSWIJK) < MIN_AFSTAND_RIJSWIJK) valid = false; for (let j = i + 1; j < 4; j++) if (dist(set[i], set[j]) < MIN_AFSTAND_WINKELS) valid = false; } if (!valid) continue; const e = setEval(set); combos.push({ set: set.map((s) => s.naam), extraAkkoord: Math.round(e.tot), latentLeads: e.latent, kmBerkelMax: Math.round(Math.max(...set.map((s) => dist(s, BERKEL)))) }); }
combos.sort((a, b) => b.extraAkkoord - a.extraAkkoord);

// ---------- 9b. benoemde netwerk-scenario's: per winkel marginaal doorgerekend in volgorde ----------
function gevoeligheid(s) { const k = kosten(200, 'zicht'); const bw = (f) => s.uplift.extraAkkoordVol * 0.75 * f * ORDERWAARDE * MARGE; const basis = bw(1) - k.totaal; return { basis: Math.round(basis), huurPlus20: Math.round(basis - 0.2 * k.huur), huurMin20: Math.round(basis + 0.2 * k.huur), upliftMin20: Math.round(bw(0.8) - k.totaal), upliftPlus20: Math.round(bw(1.2) - k.totaal), leadsMin30: Math.round(bw(0.7) - k.totaal), leadsPlus30: Math.round(bw(1.3) - k.totaal), worst: Math.round(bw(0.8 * 0.7) - k.totaal - 0.2 * k.huur), breakEvenFactor: r1((k.totaal / (ORDERWAARDE * MARGE)) / (s.uplift.extraAkkoordVol || 1)) }; }
function evalSet(namen, label) { let net = [RIJSWIJK]; const winkels = []; for (const n of namen) { const k = kandidaten.find((x) => x.naam === n); if (!k) { console.error('scenario: kandidaat niet gevonden', n); continue; } const s = scoreKandidaat(k, net); s.score = composite(s, max0); s.econ = econ(s); winkels.push({ naam: s.naam, gemeente: s.gemeente, lat: s.lat, lon: s.lon, kmRijswijk: Math.round(s.km), kmBerkel: s.kmBerkel, extraAkkoord: s.uplift.extraAkkoordVol, jaarLeadsCatchment: s.uplift.jaarLeadsCatchment, latentLeads: s.uplift.latentLeads, koopIndex15: s.uplift.koopIndex15, koopBinnen15: s.uplift.koopBinnen15, lookalike: s.lookalikeKlant?.score, score: s.score, econ: s.econ, gevoeligheid: gevoeligheid(s), topCatchment: s.topCatchment.slice(0, 5) }); net = [...net, k]; } const tot = (f) => winkels.reduce((a, w) => a + f(w), 0); return { label, winkels, totaal: { extraAkkoord: tot((w) => w.extraAkkoord), realistischAkkoord: tot((w) => w.econ.realistischAkkoord), extraOmzet: tot((w) => w.econ.extraOmzet), nettoZicht200: tot((w) => w.econ.nettoZicht200), nettoZicht175laag: tot((w) => w.econ.nettoZicht175laag), conservatief: tot((w) => w.econ.conservatief), latentLeads: tot((w) => w.latentLeads) } }; }
const scenarios = [
  evalSet(greedy.map((g) => g.naam), 'A. Greedy op totaalscore'),
  evalSet(['Albrandswaard', 'Haarlem – Boerhaavewijk', 'Zuidplas', 'Diemen'], 'B. Max marginale akkoorden (combinatorisch)'),
  evalSet(['Rotterdam – Feijenoord', 'Haarlem – Boerhaavewijk', 'Diemen', 'Utrecht – Wijk 02 Noordwest'], 'C. Rotterdam + Amsterdam gesplitst + Utrecht'),
  evalSet(['Rotterdam – Feijenoord', 'Amsterdam – De Aker', 'Utrecht – Wijk 02 Noordwest', 'Dordrecht – Dubbeldam'], 'D. Rotterdam + Amsterdam-West + Utrecht + Drechtsteden'),
  evalSet(['Rotterdam – Feijenoord', 'Amsterdam – De Aker', 'Diemen', 'Utrecht – Wijk 02 Noordwest'], 'G. Rotterdam + Amsterdam-West + Amsterdam-Oost + Utrecht'),
  evalSet(['Rotterdam – Feijenoord', 'Amsterdam – De Aker', 'Utrecht – Wijk 02 Noordwest', 'Zuidplas'], 'H. Rotterdam + Amsterdam-West + Utrecht + Zuidplas'),
  evalSet(['Rotterdam – IJsselmonde', 'Amsterdam – De Aker', 'Zuidplas', 'Diemen'], 'I. Rotterdam-Zuid + Amsterdam-West + Zuidplas + Amsterdam-Oost'),
  evalSet(['Rotterdam – IJsselmonde', 'Zuidplas', 'Haarlemmermeer – Badhoevedorp', 'Leiden – Bos- en Gasthuisdistrict'], 'E. Rotterdam-Zuid + Zuidplas + Haarlemmermeer + Leiden'),
  evalSet(['Rotterdam – Feijenoord', 'Amsterdam – De Aker', 'Utrecht – Wijk 02 Noordwest', 'Leiden – Bos- en Gasthuisdistrict'], 'F. Rotterdam + Amsterdam-West + Utrecht + Leiden'),
];
console.log('\nSCENARIO\'S:'); for (const sc of scenarios) console.log(sc.label.padEnd(52), '+' + sc.totaal.extraAkkoord + ' akk (real ' + sc.totaal.realistischAkkoord + ')', 'omzet real €' + Math.round(sc.totaal.extraOmzet / 1000) + 'k', 'netto200 €' + Math.round(sc.totaal.nettoZicht200 / 1000) + 'k', 'netto175laag €' + Math.round(sc.totaal.nettoZicht175laag / 1000) + 'k', 'conserv €' + Math.round(sc.totaal.conservatief / 1000) + 'k', 'latent', sc.totaal.latentLeads, '\n   ', sc.winkels.map((w) => w.naam + ' +' + w.extraAkkoord + ' (netto ' + Math.round(w.econ.nettoZicht200 / 1000) + 'k)').join(' | '));
// ---------- 10. verificatie ----------
const verif = { leadsTotaal: leads.length, leadsMetPlaats: leads.filter((l) => l.plaats).length, plaatsenGeocodeerd: plaatsen.length, plaatsenMetGemeente: plaatsen.filter((p) => plaatsGm[p.plaats]).length, leadsInJaarbasis: jaarTotaal.leads, jaarAkkoord: jaarTotaal.akkoord, jaarTeVer: jaarTotaal.teVer, jaarTabs: JAAR_TABS, denHaagAlsEenPlaats: (jaar['den haag'] || {}).leads || 0, kandidatenTotaal: kandidaten.length, kandidatenMetCatchment: base.length, penKernLeadsPer1000Koop: r1(penKern), curveMeting, cbsTabel: '85984NED Kerncijfers wijken en buurten 2024 (opgehaald 2026-09-09)', pdok: 'locatieserver v3_1 (opgehaald 2026-09-09)' };

const out = { gegenereerd: new Date().toISOString().slice(0, 10), constanten: { ORDERWAARDE, MARGE, CATCHMENT_KM, MIN_AFSTAND_WINKELS, MIN_AFSTAND_RIJSWIJK, curve, HUUR, kostenVoorbeeld: { zicht175: kosten(175, 'zicht'), zicht200: kosten(200, 'zicht'), pdv250: kosten(250, 'pdv'), centrum200: kosten(200, 'centrum') }, breakEven: { zicht175: breakEven(kosten(175, 'zicht')), zicht200: breakEven(kosten(200, 'zicht')), pdv250: breakEven(kosten(250, 'pdv')), centrum200: breakEven(kosten(200, 'centrum')) } }, rijswijk: { gemeente: rijswijkGm, profielKern10km: profielKern, profielSontyKlant: profielKlant, topPenetratie: topPen.map((g) => ({ gemeente: g.gemeente, akkoordPer1000koop: r1(g.akkoordPer1000koop), jaarAkkoord: g.jaarAkkoord, km: Math.round(g.km), koop: g.koop, eengezins: g.eengezins, woz: g.woz, inkStd: g.inkStd })) }, regressie, regressiePenetratie, gemeenten: gmRows.filter((g) => g.km < 90).map((g) => ({ code: g.code, gemeente: g.gemeente, km: Math.round(g.km), lat: g.lat, lon: g.lon, inwoners: g.inwoners, hh: g.hh, koop: g.koop, eengezins: g.eengezins, woz: g.woz, inkStd: g.inkStd, koopwoningen: g.koopwoningen, leads: g.leads, akkoord: g.akkoord, jaarLeads: g.jaarLeads, jaarAkkoord: g.jaarAkkoord, jaarTeVer: g.jaarTeVer, conv: g.conv != null ? r1(100 * g.conv) : null, curveConv: r1(100 * g.curveConv), residu: g.residu ?? null, penResidu: g.penResidu ?? null, leadsPer1000hh: g.leadsPer1000hh != null ? r1(g.leadsPer1000hh) : null, akkoordPer1000koop: g.akkoordPer1000koop != null ? r1(g.akkoordPer1000koop) : null, lookalikeKlant: lookalike(g, profielKlant)?.score ?? null })).sort((a, b) => b.jaarLeads - a.jaarLeads), ranking: base.slice(0, 40), greedy, scenarios, combos: combos.slice(0, 15), combosTotaal: combos.length, verificatie: verif };
fs.writeFileSync(D + 'winkels-4/resultaat.json', JSON.stringify(out, null, 1));

console.log('curve herijkt:', curveMeting.map((m) => m.band + ' ' + r1(100 * m.conv) + '% (n=' + m.leads + ')').join(' | '));
console.log('regressie R²', regressie.r2, '(alleen afstand', regressie.r2AlleenAfstand + ')', JSON.stringify(regressie.coef));
console.log('penetratie-regressie R²', regressiePenetratie.r2, '(alleen afstand', regressiePenetratie.r2AlleenAfstand + ')', JSON.stringify(regressiePenetratie.effectPer10punt));
console.log('profiel kern10', JSON.stringify(profielKern), '\nprofiel klant', JSON.stringify(profielKlant));
console.log('penetratie kern', r1(penKern), 'leads/1000 koopwoningen/jr');
console.log('\nTOP 15 basis (t.o.v. Rijswijk alleen):');
base.slice(0, 15).forEach((s, i) => console.log(String(i + 1).padStart(2), s.naam.padEnd(34), 'score', String(s.score).padStart(5), '| +akk', String(s.uplift.extraAkkoordVol).padStart(4), '| leads catch', String(s.uplift.jaarLeadsCatchment).padStart(5), '| koop15', String(s.uplift.koopBinnen15).padStart(7), '| latent', String(s.uplift.latentLeads).padStart(5), '| idx', s.uplift.koopIndex15, '| LA', s.lookalikeKlant?.score, '| Berkel', s.kmBerkel + 'km', '| netto200', s.econ.nettoZicht200));
console.log('\nGREEDY 4:'); greedy.forEach((g) => console.log(g.ronde, g.naam.padEnd(34), 'score', g.score, '+akk', g.uplift.extraAkkoordVol, 'netto200', g.econ.nettoZicht200, '\n     alt:', g.alternatieven.slice(0, 8).map((a) => a.naam + ' ' + a.score + ' (+' + a.extraAkkoord + ', idx ' + a.koopIndex15 + ', netto ' + Math.round(a.netto200/1000) + 'k)').join(' | ')));
console.log('\nBESTE 4-SETS (marginaal, beste per gemeente top-20, n=' + combos.length + '):'); combos.slice(0, 8).forEach((c, i) => console.log(i + 1, c.set.join(' + '), '→ +' + c.extraAkkoord + ' akk/jr, latent ' + c.latentLeads + ', max Berkel ' + c.kmBerkelMax + ' km'));
console.log('\nverificatie', JSON.stringify({ ...verif, curveMeting: undefined, jaarTabs: undefined }));
