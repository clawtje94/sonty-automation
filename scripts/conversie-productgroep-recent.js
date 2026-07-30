#!/usr/bin/env node
// Conversie per productgroep over de afgelopen 14 dagen (opdracht Daimy 30 juli).
// Zelfde akkoord-definitie als overal: inkoopkolom gevuld OF akkoord-blok.
// Gebruik: node scripts/conversie-productgroep-recent.js [--dagen 14] [--stuur]
const fs = require('fs');
const DAGEN = +(process.argv[process.argv.indexOf('--dagen') + 1]) || 14;
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const pd = t => { const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  return null; };
const P = p => { const t = String(p || '').trim().toLowerCase(); if (!t || t === '(leeg)') return 'Niet ingevuld (vaak akkoord-rijen)';
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('knikarm')) return 'Knikarmscherm';
  if (t.startsWith('markiez')) return 'Markiezen';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('repara')) return 'Reparatie';
  if (t.includes('raamdeco') || t.includes('zonwering binnen')) return 'Raamdeco binnen';
  if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.startsWith('voorraad') || t.startsWith('vooraad')) return 'Voorraadscherm';
  if (t.startsWith('uitval')) return 'Uitvalscherm';
  if (t.startsWith('hor')) return 'Horren';
  return p.trim(); };

const rows = JSON.parse(fs.readFileSync(__dirname + '/../data/conversie-2026-raw.json', 'utf8')).rows;
const nu = new Date(); nu.setHours(0, 0, 0, 0);
const van = new Date(nu); van.setDate(van.getDate() - DAGEN);
const recent = rows.filter(r => { const d = pd(r.celDatum); return d && d >= van && d < nu; });
const per = {};
for (const r of recent) { const k = P(r.prod);
  const m = (per[k] = per[k] || { n: 0, a: 0, w: 0 });
  m.n++; if (isAkk(r)) m.a++; m.w += r.bedrag || 0; }
const pct = (a, b) => b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—';
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');

const L = [];
L.push(`CONVERSIE PER PRODUCTGROEP — laatste ${DAGEN} dagen (${van.toISOString().slice(0, 10)} t/m gisteren)`);
L.push('');
L.push('productgroep     |    n | akk |  conv% | offertewaarde');
const rijen = Object.entries(per).sort((a, b) => b[1].n - a[1].n);
let tn = 0, ta = 0, tw = 0;
for (const [k, m] of rijen) { tn += m.n; ta += m.a; tw += m.w;
  L.push(`${k.padEnd(16).slice(0, 16)} | ${String(m.n).padStart(4)} | ${String(m.a).padStart(3)} | ${pct(m.a, m.n).padStart(6)} | ${eur(m.w)}`); }
L.push(`${'TOTAAL'.padEnd(16)} | ${String(tn).padStart(4)} | ${String(ta).padStart(3)} | ${pct(ta, tn).padStart(6)} | ${eur(tw)}`);
L.push('');
L.push(`LET OP: deze offertes zijn 0-${DAGEN} dagen oud en dus nog lang niet uitgerijpt`);
L.push('(mediaan 24 dagen tot akkoord — er komt nog zeker de helft bij). De percentages');
L.push('zijn alleen ONDERLING vergelijkbaar, niet met een maand- of jaarcijfer.');
const tekst = L.join('\n');
console.log(tekst);
if (process.argv.includes('--stuur')) {
  require('child_process').execFileSync('node', [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
}
