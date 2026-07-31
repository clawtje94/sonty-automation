// Koppelt verkoop (Gripp) aan inkoop (Somfy + montagemateriaal) en rekent verbruik per product uit.
const fs = require('fs');
const G = require('./gripp-regels.json');
const S = require('./somfy-regels.json');
const M = require('./materiaal-regels.json');

const sum = (a) => a.reduce((x, y) => x + y, 0);
const prod = {};
for (const r of G) {
  const k = (r.product || '(geen)').replace(/\s*\(\d+\)\s*$/, '');
  (prod[k] = prod[k] || { n: 0, eur: 0 }); prod[k].n += r.aantal; prod[k].eur += r.aantal * r.prijs;
}
const q = (...namen) => sum(namen.map(n => prod[n]?.n || 0));

// ---------- 1. Verkochte producten (de noemer) ----------
const groepen = {
  'Rolluiken': ['Rolluik (RollSUPER)', 'Roma geëxrudeerd rolluik'],
  'Screens / zipscreens': ['Zip Design', 'Roma Zipscreen'],
  'Knikarmschermen': ['Suneye', 'Suncube 150'],
  'Uitvalschermen': ['Montage uitvalscherm'],
  'Horren': ['Inklemhor Unilux', 'Plisséhordeur Unilux', 'Rolhor Unilux'],
  'Raamdecoratie (plissé/jaloezie/gordijn)': ['Duo Plisse', 'Aluminium Jaloezie', 'Gordijn'],
};
console.log('=== VERKOCHT PER PRODUCTGROEP (12 mnd) ===');
let totaalUnits = 0;
for (const [g, ns] of Object.entries(groepen)) {
  const n = q(...ns); totaalUnits += n;
  console.log(String(Math.round(n)).padStart(6), g, ' <- ' + ns.join(' + '));
}
console.log(String(Math.round(totaalUnits)).padStart(6), 'TOTAAL gemonteerde eenheden');

// ---------- 2. Montage-regels apart (bevestigt volume) ----------
const montage = Object.entries(prod).filter(([k]) => /^montage|^demontage/i.test(k))
  .sort((a, b) => b[1].n - a[1].n);
console.log('\n=== MONTAGE-REGELS IN GRIPP ===');
montage.slice(0, 14).forEach(([k, v]) => console.log(String(Math.round(v.n)).padStart(6), k));
const montageTotaal = sum(montage.filter(([k]) => /^montage/i.test(k)).map(([, v]) => v.n));
console.log(String(Math.round(montageTotaal)).padStart(6), 'TOTAAL montage-eenheden');

// ---------- 3. Besturing: verkoop vs inkoop bij Somfy ----------
const somfyCat = {};
for (const r of S) {
  const s = r.oms.toUpperCase();
  const c = /SUNTEIS|EOLIS|SUNIS|THERMIS|SENSOR/.test(s) ? 'sensor'
    : /TAHOMA|CONNEXOON/.test(s) ? 'tahoma'
    : /SITUO|TELIS|SMOOVE|KEYGO|CHRONIS|NINA|\bAMY\b/.test(s) ? 'afstandsbediening'
    : /IRISMO|OXIMO|ALTUS|SONESSE|SUNEA|OREA|LT METEOR|RS100|IRI45/.test(s) ? 'motor' : 'overig';
  somfyCat[c] = (somfyCat[c] || 0) + r.geleverd;
}
const verkocht = {
  afstandsbediening: q('Situo 1 IO', 'Situo 5 IO', 'Smoove Origin IO (1-weg)'),
  tahoma: q('Tahoma', 'Tahoma switch'),
  sensor: q('Eolis 3D windsensor IO'),
};
console.log('\n=== BESTURING: VERKOCHT (Gripp) vs LOS INGEKOCHT BIJ SOMFY ===');
console.log('categorie            verkocht   somfy-inkoop   verschil (zit in productpakket)');
for (const k of ['afstandsbediening', 'tahoma', 'sensor']) {
  const v = Math.round(verkocht[k] || 0), i = somfyCat[k] || 0;
  console.log(k.padEnd(20), String(v).padStart(8), String(i).padStart(14), String(v - i).padStart(10));
}
console.log('motor'.padEnd(20), '       ?', String(somfyCat.motor || 0).padStart(14), '   (motor zit in rolluik/scherm)');

// ---------- 4. Montagemateriaal per gemonteerde eenheid ----------
const groep = (o) => {
  const s = o.toUpperCase();
  if (/SPAANPL|SPS |EASYTIMBER|SCHROEF|SPS EASY/.test(s)) return 'Schroeven';
  if (/PLUG/.test(s)) return 'Pluggen';
  if (/SLUITRING|GROTE RING|RING/.test(s)) return 'Ringen';
  if (/MOER/.test(s)) return 'Moeren';
  if (/TAPBOUT|HOUTDRAADBOUT|DRAADEIND|BRASSFIX|ANKERSTANG/.test(s)) return 'Bouten / draadeind';
  if (/INJECTIEHULS|MENGSPIRAAL|MENGBUIS|CARTRIDGE|CHEMISCH/.test(s)) return 'Chemisch ankeren';
  if (/BOOR|ROCKBEAVER|EXPRESSDRILL|SNIJSCHIJF|MES|ZAAG/.test(s)) return 'Boren / snijden (slijtage)';
  if (/AFDEKKAP|KAP/.test(s)) return 'Afdekkappen';
  return 'Overig';
};
const mg = {};
for (const r of M) { const g = groep(r.oms); (mg[g] = mg[g] || { n: 0, eur: 0 }); mg[g].n += r.aantal; mg[g].eur += r.netto || 0; }
console.log('\n=== MONTAGEMATERIAAL PER GEMONTEERDE EENHEID ===');
console.log(`(gedeeld door ${Math.round(totaalUnits)} verkochte eenheden)`);
console.log('  totaal      EUR   per eenheid   groep');
Object.entries(mg).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) =>
  console.log(String(Math.round(v.n)).padStart(8), String(v.eur.toFixed(0)).padStart(9),
    (v.n / totaalUnits).toFixed(1).padStart(12), '  ', k));
console.log('\nMateriaalkosten per gemonteerde eenheid: EUR',
  (sum(Object.values(mg).map(v => v.eur)) / totaalUnits).toFixed(2));

fs.writeFileSync(__dirname + '/analyse-output.json', JSON.stringify({ prod, mg, somfyCat, verkocht, totaalUnits }, null, 1));
