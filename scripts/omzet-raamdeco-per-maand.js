#!/usr/bin/env node
// Omzet + brutowinst van de binnen-tak (raamdecoratie/gordijnen) per maand.
// Maandindeling = HET TABBLAD waarin de rij in de offerte-sheet staat (opdracht Daimy 2026-08-20).
// Akkoord-definitie zoals overal: inkoopkolom gevuld OF akkoordbedrag OF Gripp-nummer.
// Winst = verkoop min inkoop, dus brutomarge vóór montage-uren en overhead.
// Gebruik: node scripts/omzet-raamdeco-per-maand.js [--strikt] [--vanaf 2025-01] [--stuur]
const fs = require('fs');
const D = __dirname + '/../data/';
const STRIKT_MODE = process.argv.includes('--strikt');
const VANAF = (process.argv[process.argv.indexOf('--vanaf') + 1] || '2025-01').match(/^\d{4}-\d\d$/) ? process.argv[process.argv.indexOf('--vanaf') + 1] : '2025-01';

// Gripp-facturen per opdrachtnummer, voor het producttype
const byNr = {};
for (const f of JSON.parse(fs.readFileSync(D + 'gripp-alle-facturen.json', 'utf8'))) {
  const m = (f.subject || '').match(/\((\d{3,5})\)/);
  if (m) (byNr[m[1]] = byNr[m[1]] || []).push(f);
}
const GORDIJNSTOF = /overgordijn|inbetween|vitrage|gordijnstof|gordijnrail|wave.?plooi|plooiband|kobe|interstill/i;
const BINNEN = /rolgordijn|vouwgordijn|paneelgordijn|pliss|duette|jaloez|shutter|honingraat|verticale lamel|lamellen|raamdecoratie|\bgordijn(en)?\b/i;
const tekstVan = nr => (byNr[nr] || []).map(f => (f.subject || '') + ' ' + (f.lijnen || []).map(l => (l.desc || '') + ' ' + (l.extra || '')).join(' ')).join(' ');
function hoort(nr, prod) {
  const t = tekstVan(nr);
  if (STRIKT_MODE) return GORDIJNSTOF.test(t);
  return /raamdeco|zonwering binnen/i.test(prod || '') || BINNEN.test(t);
}

// maand = tabblad
const TAB = { jan: 1, feb: 2, maart: 3, mrt: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, aug: 8, augustus: 8, sep: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12 };
function tabMaand(r) {
  const t = String(r.tab || '').toLowerCase().trim();
  const k = Object.keys(TAB).sort((a, b) => b.length - a.length).find(x => t.startsWith(x));
  const jr = (t.match(/20\d\d/) || [])[0] || r.jaar;
  return k && jr ? jr + '-' + String(TAB[k]).padStart(2, '0') : null;
}

const jaren = [2024, 2025, 2026].filter(y => fs.existsSync(D + 'conversie-' + y + '-raw.json'));
const rows = [].concat(...jaren.map(y => JSON.parse(fs.readFileSync(D + 'conversie-' + y + '-raw.json', 'utf8')).rows));
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(String(r.nummer || '').trim());

const gezien = new Set();
const per = {};
let dubbel = 0;
for (const r of rows) {
  if (!isAkk(r)) continue;
  const nr = String(r.nummer || '').trim();
  if (!hoort(nr, r.prod)) continue;
  const m = tabMaand(r);
  if (!m || m < VANAF) continue;
  if (/^\d{3,6}$/.test(nr)) { if (gezien.has(nr)) { dubbel++; continue; } gezien.add(nr); }
  const verkoop = r.akkoordBedrag > 0 ? r.akkoordBedrag : (r.bedrag > 0 ? r.bedrag : 0);
  const inkoop = r.inkoop > 1 ? r.inkoop : 0;   // €1 = prognose-placeholder, geen echte inkoop
  const c = (per[m] = per[m] || { n: 0, omzet: 0, cOmzet: 0, cInkoop: 0, cn: 0 });
  c.n++; c.omzet += verkoop;
  if (verkoop > 0 && inkoop > 0) { c.cOmzet += verkoop; c.cInkoop += inkoop; c.cn++; }
}

const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const L = [];
L.push((STRIKT_MODE ? 'STOFFEN GORDIJNEN' : 'RAAMDECORATIE BINNEN (plissé, rolgordijn, jaloezie, shutter, gordijnen)') + ' — per maand van het sheet-tabblad, excl btw');
L.push('');
L.push('maand   | orders | omzet      | brutowinst | marge% | inkoop bekend');
const jr = {};
for (const m of Object.keys(per).sort()) {
  const c = per[m];
  const marge = c.cOmzet ? (c.cOmzet - c.cInkoop) / c.cOmzet : 0;
  const omzetEx = c.omzet / 1.21;
  const winst = marge ? omzetEx * marge : 0;
  const y = m.slice(0, 4);
  const j = (jr[y] = jr[y] || { n: 0, omzet: 0, cOmzet: 0, cInkoop: 0 });
  j.n += c.n; j.omzet += omzetEx; j.cOmzet += c.cOmzet; j.cInkoop += c.cInkoop;
  L.push(`${m} | ${String(c.n).padStart(6)} | ${eur(omzetEx).padStart(10)} | ${(marge ? eur(winst) : '—').padStart(10)} | ${(marge ? (marge * 100).toFixed(0) + '%' : '—').padStart(6)} | ${c.cn}/${c.n}`);
}
L.push('');
for (const [y, j] of Object.entries(jr)) {
  const marge = j.cOmzet ? (j.cOmzet - j.cInkoop) / j.cOmzet : 0;
  L.push(`${y}: ${j.n} orders | omzet ${eur(j.omzet)} | brutowinst ${eur(j.omzet * marge)} | marge ${(marge * 100).toFixed(0)}%`);
}
L.push('');
L.push(`Winst = verkoop min inkoop (brutomarge), vóór montage-uren en overhead.`);
L.push(`Waar de inkoop nog niet is ingevuld, is de maandmarge van de wél complete orders toegepast.`);
if (dubbel) L.push(`${dubbel} dubbele rij(en) op hetzelfde Gripp-nummer overgeslagen.`);
L.push(`De laatste 1-2 maanden zijn nog niet uitgerijpt (mediaan 24 dagen offerte→akkoord).`);

const tekst = L.join('\n');
console.log(tekst);
if (process.argv.includes('--stuur')) {
  require('child_process').execFileSync(process.execPath, [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
}
