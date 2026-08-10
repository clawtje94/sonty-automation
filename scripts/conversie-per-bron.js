#!/usr/bin/env node
// Conversie per BRON (Google/Meta/buren/anders), laatste 4 volle weken (lijst-item 5).
// Zelfde definities als overal. Gebruik: node scripts/conversie-per-bron.js [--stuur]
const fs = require('fs');
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const pd = t => { const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  return null; };
const wk = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const y = new Date(t.getFullYear(), 0, 4);
  return `${t.getFullYear()}-W${String(1 + Math.round(((t - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };
const BRON = r => { const t = String(r.afkomst || '').trim().toLowerCase();
  if (t.startsWith('face') || t.startsWith('insta')) return 'Meta';
  if (t.startsWith('goog')) return 'Google';
  if (t.includes('beken') || t.startsWith('buren')) return 'Buren/bek';
  return 'Anders'; };

const rows = JSON.parse(fs.readFileSync(__dirname + '/../data/conversie-2026-raw.json', 'utf8')).rows;
const nu = new Date();
const weken = [];
for (let i = 4; i >= 1; i--) { const d = new Date(nu); d.setDate(d.getDate() - 7 * i); weken.push(wk(d)); }
const per = {};
for (const r of rows) { const d = pd(r.celDatum); if (!d) continue;
  const w = wk(d); if (!weken.includes(w)) continue;
  const k = w + '|' + BRON(r);
  const m = (per[k] = per[k] || { n: 0, a: 0 }); m.n++; if (isAkk(r)) m.a++; }
const pct = (a, b) => b ? (a / b * 100).toFixed(0) + '%' : '—';
const L = [`CONVERSIE PER BRON — laatste 4 volle weken (jonge weken rijpen nog na)`, '',
  'week     |  Google   |   Meta    | Buren/bek |  Anders'];
for (const w of weken) {
  const c = b => { const m = per[w + '|' + b] || { n: 0, a: 0 }; return `${String(m.n).padStart(3)} ${pct(m.a, m.n).padStart(4)}`; };
  L.push(`${w} | ${c('Google')} | ${c('Meta')} | ${c('Buren/bek')} | ${c('Anders')}`);
}
const tekst = L.join('\n');
console.log(tekst);
if (process.argv.includes('--stuur'))
  require('child_process').execFileSync(process.execPath, [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
