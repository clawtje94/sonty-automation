#!/usr/bin/env node
// Basislijn inmeettijden + reistijd-kalibratie uit de echte dagen van Daimy (juli 2026).
// READ-ONLY. Vergelijkt de werkelijke gaten tussen afspraken met TomTom-voorspellingen.
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, '.tomtom-api-key.txt'), 'utf8').trim();
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeettijden-basislijn.json'), 'utf8'));

const min = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const mediaan = (a) => { const s = [...a].sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

// ---------- 1. duur ----------
const duren = [];
for (const dag of DATA.dagen) {
  for (const a of dag.afspraken) {
    if (a.uitsluiten || !a.eind) continue;
    duren.push({ ...a, duur: min(a.eind) - min(a.start) });
  }
}
console.log(`\n=== INMEETDUUR (n=${duren.length}) ===`);
const alle = duren.map((d) => d.duur);
console.log(`mediaan ${mediaan(alle)} min | gemiddeld ${(alle.reduce((a, b) => a + b) / alle.length).toFixed(1)} | kortste ${Math.min(...alle)} | langste ${Math.max(...alle)}`);

const staffels = [
  { naam: '1 product', test: (n) => n === 1 },
  { naam: '2 producten', test: (n) => n === 2 },
  { naam: '3-4 producten', test: (n) => n >= 3 && n <= 4 },
  { naam: '5+ producten', test: (n) => n >= 5 },
];
console.log('\nper aantal producten:');
for (const s of staffels) {
  const g = duren.filter((d) => s.test(d.aantal));
  if (!g.length) continue;
  const v = g.map((d) => d.duur);
  console.log(`  ${s.naam.padEnd(14)} n=${String(g.length).padStart(2)}  mediaan ${String(mediaan(v)).padStart(4)} min  (spreiding ${Math.min(...v)}-${Math.max(...v)})`);
}

// lineaire fit duur = basis + perProduct * aantal
const n = duren.length;
const sx = duren.reduce((a, d) => a + d.aantal, 0);
const sy = duren.reduce((a, d) => a + d.duur, 0);
const sxy = duren.reduce((a, d) => a + d.aantal * d.duur, 0);
const sxx = duren.reduce((a, d) => a + d.aantal * d.aantal, 0);
const perProduct = (n * sxy - sx * sy) / (n * sxx - sx * sx);
const basis = (sy - perProduct * sx) / n;
console.log(`\nmodel: duur ≈ ${basis.toFixed(1)} min basis + ${perProduct.toFixed(1)} min per product`);
console.log('  voorbeeld: 1 product ->', Math.round(basis + perProduct), 'min | 3 producten ->', Math.round(basis + 3 * perProduct), 'min | 10 producten ->', Math.round(basis + 10 * perProduct), 'min');

const uitschieters = duren.filter((d) => Math.abs(d.duur - (basis + perProduct * d.aantal)) > 20);
if (uitschieters.length) {
  console.log('\nuitschieters (>20 min naast het model):');
  for (const u of uitschieters) console.log(`  ${u.klant} ${u.plaats}: ${u.duur} min voor ${u.aantal}x — ${u.producten}`);
}

// ---------- 2. reistijd ----------
const ritten = [];
for (const dag of DATA.dagen) {
  const geldig = dag.afspraken.filter((a) => a.eind && a.plaats);
  for (let i = 0; i < geldig.length - 1; i++) {
    const van = geldig[i], naar = geldig[i + 1];
    const gat = min(naar.start) - min(van.eind);
    if (gat <= 0 || gat > 90) continue; // negatief = parallelle inmeters, >90 = pauze
    ritten.push({ dag: dag.dag, van: van.plaats, naar: naar.plaats, vertrek: van.eind, gat });
  }
}
console.log(`\n=== REISTIJD: werkelijk vs TomTom (n=${ritten.length}) ===`);

const cache = new Map();
async function geocode(plaats) {
  if (cache.has(plaats)) return cache.get(plaats);
  const r = await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(plaats)}.json?key=${KEY}&countrySet=NL&limit=1`);
  const d = await r.json();
  const p = d?.results?.[0]?.position || null;
  cache.set(plaats, p);
  return p;
}
// departAt moet in de toekomst liggen; we projecteren op een vaste dinsdag.
const DATUM = '2026-08-11';

(async () => {
  const rijen = [];
  for (const rit of ritten) {
    const a = await geocode(rit.van), b = await geocode(rit.naar);
    if (!a || !b) continue;
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${a.lat},${a.lon}:${b.lat},${b.lon}/json?key=${KEY}&traffic=true&departAt=${DATUM}T${rit.vertrek}:00`;
    const r = await fetch(url);
    if (!r.ok) { console.log(`  ! ${rit.van} -> ${rit.naar}: HTTP ${r.status}`); continue; }
    const s = (await r.json())?.routes?.[0]?.summary;
    if (!s) continue;
    const voorspeld = Math.round(s.travelTimeInSeconds / 60);
    const km = +(s.lengthInMeters / 1000).toFixed(1);
    // Zelfde plaatsnaam -> TomTom voorspelt 0 min (identiek geocodepunt): geen bruikbare factor.
    // Ver uit de pas met de afstand -> vrijwel zeker een dubbelzinnige plaatsnaam
    // (Nieuwerkerk a/d IJssel vs Zeeland, Ouderkerk a/d Amstel vs a/d IJssel).
    const zelfdePunt = voorspeld === 0;
    const verdacht = !zelfdePunt && km > 45 && rit.gat < voorspeld * 0.7;
    rijen.push({ ...rit, voorspeld, km, zelfdePunt, verdacht, factor: zelfdePunt ? null : rit.gat / voorspeld });
    await new Promise((x) => setTimeout(x, 250));
  }
  console.log('  van -> naar'.padEnd(38), 'echt  TomTom  km   factor');
  for (const r of rijen) {
    const f = r.zelfdePunt ? 'zelfde plaats' : r.factor.toFixed(2) + (r.verdacht ? '  ? plaatsnaam' : '');
    console.log(`  ${(r.van + ' -> ' + r.naar).padEnd(36)} ${String(r.gat).padStart(4)} ${String(r.voorspeld).padStart(6)} ${String(r.km).padStart(6)}   ${f}`);
  }
  const bruikbaar = rijen.filter((r) => !r.zelfdePunt && !r.verdacht);
  const facs = bruikbaar.map((r) => r.factor);
  const zelfde = rijen.filter((r) => r.zelfdePunt).map((r) => r.gat);
  console.log(`\n  bruikbaar: ${bruikbaar.length} van ${rijen.length} ritten`);
  console.log(`     (${rijen.filter((r) => r.zelfdePunt).length}x zelfde plaats, ${rijen.filter((r) => r.verdacht).length}x dubbelzinnige plaatsnaam)`);
  console.log(`  mediane factor werkelijk/TomTom: ${mediaan(facs).toFixed(2)}`);
  console.log(`  gemiddeld verschil: ${(bruikbaar.reduce((a, r) => a + (r.gat - r.voorspeld), 0) / bruikbaar.length).toFixed(1)} min per rit`);
  if (zelfde.length) console.log(`  binnen dezelfde plaats: mediaan ${mediaan(zelfde)} min (ondergrens voor korte ritten)`);
  console.log(`\n  -> reken TomTom x ${mediaan(facs).toFixed(2)}, met een ondergrens van ${mediaan(zelfde) || 10} min per rit`);
  console.log('  LET OP: gegeocodeerd op PLAATSNAAM, niet op adres. Met de echte adressen uit Gripp wordt dit scherper.');
})();
