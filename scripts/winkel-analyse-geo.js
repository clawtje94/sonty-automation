#!/usr/bin/env node
// Winkellocatie-onderzoek stap 2: geocoderen (PDOK) + afstands-/conversie-analyse.
// Output: data/plaats-coords.json (cache) + data/winkel-geo.json
const fs = require('fs');

const leads = require('../data/winkel-leads.json');
const CACHE_FILE = __dirname + '/../data/plaats-coords.json';
const RIJSWIJK = { lat: 52.0365, lon: 4.3253 };

function norm(p) {
  return String(p || '').trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['’`]/g, "'")
    .replace(/^den haag.*/, 'den haag')
    .replace(/^'?s[- ]gravenhage$/, 'den haag')
    .replace(/^'?s[- ]gravenzande$/, "'s-gravenzande")
    .replace(/^'?s[- ]hertogenbosch$/, "'s-hertogenbosch")
    .replace(/^hoek van holland.*/, 'hoek van holland');
}

function dist(a, b) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function geocode(plaats) {
  const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=' +
    encodeURIComponent(plaats) + '&fq=type:woonplaats&rows=1&fl=weergavenaam,centroide_ll';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'sonty-analyse' } });
    if (!r.ok) return null;
    const j = await r.json();
    const doc = j.response && j.response.docs && j.response.docs[0];
    if (!doc || !doc.centroide_ll) return null;
    const m = doc.centroide_ll.match(/POINT\(([\d.]+) ([\d.]+)\)/);
    if (!m) return null;
    return { lon: parseFloat(m[1]), lat: parseFloat(m[2]), naam: doc.weergavenaam };
  } catch { return null; }
}

(async () => {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch {}

  // per genormaliseerde plaats aggregeren
  const perPlaats = {};
  for (const l of leads) {
    const p = norm(l.plaats);
    if (!p || p.length < 2) continue;
    const e = (perPlaats[p] = perPlaats[p] || { leads: 0, akkoord: 0, omzet: 0, teVer: 0, offerteWaarde: 0, winkelLeads: 0, winkelAkkoord: 0, onlineLeads: 0, onlineAkkoord: 0 });
    e.leads++;
    if (l.teVer) e.teVer++;
    if (typeof l.bedrag === 'number') e.offerteWaarde += l.bedrag;
    if (l.akkoord) { e.akkoord++; e.omzet += l.omzet || 0; }
    if (/winkel/i.test(l.kanaal)) { e.winkelLeads++; if (l.akkoord) e.winkelAkkoord++; }
    else if (/online/i.test(l.kanaal)) { e.onlineLeads++; if (l.akkoord) e.onlineAkkoord++; }
  }

  const plaatsen = Object.keys(perPlaats).sort((a, b) => perPlaats[b].leads - perPlaats[a].leads);
  console.log('unieke plaatsen:', plaatsen.length);

  // geocode alleen plaatsen met >= 3 leads (ruis/typo's eruit); rest hoort bij "overig"
  const target = plaatsen.filter((p) => perPlaats[p].leads >= 3);
  let done = 0, fail = 0;
  for (const p of target) {
    if (cache[p] !== undefined) continue;
    cache[p] = await geocode(p);
    if (!cache[p]) fail++;
    if (++done % 50 === 0) { console.log('geocoded', done, '/', target.length); fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); }
    await new Promise((r) => setTimeout(r, 60));
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  console.log('geocode klaar. nieuw:', done, 'mislukt:', fail);

  // afstand tot Rijswijk per plaats
  const rows = [];
  for (const p of target) {
    const c = cache[p];
    if (!c) continue;
    rows.push({ plaats: p, naam: c.naam, lat: c.lat, lon: c.lon, kmRijswijk: dist(c, RIJSWIJK), ...perPlaats[p] });
  }
  fs.writeFileSync(__dirname + '/../data/winkel-geo.json', JSON.stringify(rows));

  // conversie per afstandsband
  const banden = [[0, 10], [10, 20], [20, 30], [30, 50], [50, 80], [80, 999]];
  console.log('\nCONVERSIE PER AFSTAND TOT SHOWROOM RIJSWIJK:');
  for (const [lo, hi] of banden) {
    const sel = rows.filter((r) => r.kmRijswijk >= lo && r.kmRijswijk < hi);
    const L = sel.reduce((s, r) => s + r.leads, 0), A = sel.reduce((s, r) => s + r.akkoord, 0);
    const O = sel.reduce((s, r) => s + r.omzet, 0), T = sel.reduce((s, r) => s + r.teVer, 0);
    console.log(`${String(lo).padStart(3)}-${String(hi).padStart(3)}km: ${String(L).padStart(6)} leads | ${String(A).padStart(4)} akkoord | ${(100 * A / (L || 1)).toFixed(1).padStart(5)}% | omzet €${(O / 1000).toFixed(0)}k | TE VER: ${T}`);
  }

  // winkel vs online (showroom-effect)
  const W = rows.reduce((s, r) => s + r.winkelLeads, 0), WA = rows.reduce((s, r) => s + r.winkelAkkoord, 0);
  const O2 = rows.reduce((s, r) => s + r.onlineLeads, 0), OA = rows.reduce((s, r) => s + r.onlineAkkoord, 0);
  console.log(`\nWINKEL-leads: ${W} → ${WA} akkoord = ${(100 * WA / (W || 1)).toFixed(1)}%`);
  console.log(`ONLINE-leads: ${O2} → ${OA} akkoord = ${(100 * OA / (O2 || 1)).toFixed(1)}%`);

  // top plaatsen op afstand (kandidaat-regio's)
  console.log('\nTOP 25 PLAATSEN >20km (leads | conv | omzet | teVer | km):');
  rows.filter((r) => r.kmRijswijk > 20).sort((a, b) => b.leads - a.leads).slice(0, 25)
    .forEach((r) => console.log(r.plaats.padEnd(22), String(r.leads).padStart(5), (100 * r.akkoord / r.leads).toFixed(1).padStart(5) + '%', ('€' + (r.omzet / 1000).toFixed(0) + 'k').padStart(8), String(r.teVer).padStart(4), r.kmRijswijk.toFixed(0).padStart(4) + 'km'));
})();
