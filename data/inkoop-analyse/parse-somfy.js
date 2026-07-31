// Somfy-facturen: artikelnr | omschrijving | besteld | geleverd | prijs | totaal
const fs = require('fs');
const { execFileSync } = require('child_process');
const num = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));

const ix = JSON.parse(fs.readFileSync(__dirname + '/pdf-index.json', 'utf8'));
const somfy = ix.filter(x => /somfy/i.test(x.from));
const rows = [];
let bad = 0;

for (const rec of somfy) {
  let t = '';
  try { t = execFileSync('pdftotext', ['-layout', __dirname + '/pdfs/' + rec.file, '-'], { maxBuffer: 40e6, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
  catch { bad++; continue; }
  let n = 0;
  for (const line of t.split('\n')) {
    // " 1870404   SITUO 1 RTS PURE II NE      1     1     40,40     40,40"
    // prijs/totaal ontbreken op garantie-/vervangingsfacturen -> optioneel
    const m = line.match(/^\s*(\d{6,8})\s{2,}(.+?)\s{2,}(-?\d+)\s+(-?\d+)(?:\s+([\d.,]+)\s+(-?[\d.,]+))?\s*$/);
    if (!m) continue;
    rows.push({
      art: m[1], oms: m[2].trim(), besteld: parseInt(m[3]), geleverd: parseInt(m[4]),
      prijs: m[5] ? num(m[5]) : 0, totaal: m[6] ? num(m[6]) : 0,
      gratis: !m[5], datum: rec.date.slice(0, 10), bestand: rec.file,
    });
    n++;
  }
  if (!n) bad++;
}

fs.writeFileSync(__dirname + '/somfy-regels.json', JSON.stringify(rows, null, 1));
console.log('Somfy facturen:', somfy.length, '| zonder regels:', bad, '| regels:', rows.length);

// categoriseren
const cat = (o) => {
  const s = o.toUpperCase();
  // volgorde telt: sensoren vóór Tahoma (SMOKE SENSOR TAHOMA PRO is een sensor)
  if (/SUNTEIS|EOLIS|SUNIS|THERMIS|SENSOR/.test(s)) return 'Zon-/windsensor';
  if (/TAHOMA|CONNEXOON/.test(s)) return 'Tahoma / smart hub';
  if (/SITUO|TELIS|SMOOVE|KEYGO|CHRONIS|NINA|\bAMY\b/.test(s)) return 'Afstandsbediening / wandzender';
  if (/IRISMO|OXIMO|ALTUS|SONESSE|MAESTRIA|ORIENA|GLYDEA|ILMO|SUNEA|OREA|LT METEOR|LT50|LT60|RS100|MOTOR|IRI45/.test(s)) return 'Motor';
  if (/ADAPTOR|KABEL|CABLE|LADER|CHARGER|BATTERY|ACCU|CONNECTIVITY KIT|SETTING TOOL/.test(s)) return 'Toebehoren (voeding/kabel/kit)';
  if (/TOESLAG|KORTING|VRACHT|TRANSPORT/.test(s)) return 'Toeslag / geen artikel';
  return 'Overig / onderdelen';
};

const agg = {}, byCat = {};
for (const r of rows) {
  const k = r.art + ' | ' + r.oms;
  (agg[k] = agg[k] || { n: 0, eur: 0, cat: cat(r.oms) });
  agg[k].n += r.geleverd; agg[k].eur += r.totaal;
  const c = cat(r.oms);
  (byCat[c] = byCat[c] || { n: 0, eur: 0 }); byCat[c].n += r.geleverd; byCat[c].eur += r.totaal;
}

console.log('\n=== SOMFY PER CATEGORIE (12 mnd) ===');
Object.entries(byCat).sort((a, b) => b[1].n - a[1].n)
  .forEach(([k, v]) => console.log(String(v.n).padStart(5), 'st  EUR', String(v.eur.toFixed(0)).padStart(7), ' ', k));

console.log('\n=== SOMFY TOP 30 ARTIKELEN ===');
console.log('  st      EUR   categorie                          artikel');
Object.entries(agg).sort((a, b) => b[1].n - a[1].n).slice(0, 30)
  .forEach(([k, v]) => console.log(String(v.n).padStart(4), String(v.eur.toFixed(0)).padStart(8), ' ', v.cat.padEnd(34), k));
