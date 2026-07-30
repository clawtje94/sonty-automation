#!/usr/bin/env node
// MAANDRAPPORT (lijst-item 6): de afgesloten maand op alle assen tegen dezelfde
// maand vorig jaar. Draait op de 1e van de maand; de maand is dan nog jong
// (rijpt na), dus de vergelijking gebruikt het VORIGE-jaar-cijfer op eindstand
// en zegt dat er ook bij. Gebruik: node scripts/maandrapport.js [--stuur]
const fs = require('fs');
const { execFileSync } = require('child_process');
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const pct = (a, b) => b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—';
const BRON = r => { const t = String(r.afkomst || '').trim().toLowerCase();
  if (t.startsWith('face') || t.startsWith('insta')) return 'Meta';
  if (t.startsWith('goog')) return 'Google';
  if (t.includes('beken') || t.startsWith('buren')) return 'Buren/bekenden';
  return 'Anders'; };
const PROD = p => { const t = String(p || '').trim().toLowerCase(); if (!t || t === '(leeg)') return 'Niet ingevuld';
  if (t.startsWith('rolluik')) return 'Rolluiken';
  if (t.startsWith('screen')) return 'Screens';
  if (t.startsWith('knikarm')) return 'Knikarmscherm';
  if (t.startsWith('pergola')) return 'Pergola';
  if (t.startsWith('voorraad') || t.startsWith('vooraad')) return 'Voorraadscherm';
  if (t.includes('raamdeco') || t.includes('zonwering binnen')) return 'Raamdeco binnen';
  if (t.includes('zonwering buiten')) return 'Zonwering buiten';
  if (t.startsWith('repara')) return 'Reparatie';
  return 'Overig'; };

const nu = new Date();
const vm = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
const M = vm.getMonth() + 1, JR = vm.getFullYear();
const naam = vm.toLocaleString('nl-NL', { month: 'long' });

// verse extractie voor beide jaren
for (const j of [JR - 1, JR]) execFileSync('node', [__dirname + '/conversie-sheet.js', '--jaar', String(j)], { stdio: 'pipe' });
const laad = j => JSON.parse(fs.readFileSync(__dirname + `/../data/conversie-${j}-raw.json`, 'utf8')).rows.filter(r => r.maand === M);
const dit = laad(JR), vorig = laad(JR - 1);

const stat = rows => ({ n: rows.length, a: rows.filter(isAkk).length,
  w: rows.filter(isAkk).reduce((x, r) => x + (r.akkoordBedrag || r.bedrag || 0), 0) });
const t1 = stat(dit), t0 = stat(vorig);

const L = [];
L.push(`MAANDRAPPORT ${naam.toUpperCase()} ${JR} — tegen ${naam} ${JR - 1}`);
L.push(`(${naam} ${JR} is nog jong en rijpt na; ${naam} ${JR - 1} is eindstand)`);
L.push('');
L.push(`TOTAAL   ${JR}: ${t1.n} offertes, ${t1.a} akkoord (${pct(t1.a, t1.n)}), ${eur(t1.w)}`);
L.push(`         ${JR - 1}: ${t0.n} offertes, ${t0.a} akkoord (${pct(t0.a, t0.n)}), ${eur(t0.w)}`);
L.push('');
for (const [kop, fn] of [['PER BRON', BRON], ['PER PRODUCTGROEP', r => PROD(r.prod)]]) {
  L.push(kop);
  const keys = [...new Set([...dit, ...vorig].map(fn))];
  const rijen = keys.map(k => ({ k, d: stat(dit.filter(r => fn(r) === k)), v: stat(vorig.filter(r => fn(r) === k)) }))
    .filter(x => x.d.n >= 15 || x.v.n >= 15).sort((a, b) => b.d.n - a.d.n);
  for (const x of rijen)
    L.push(`  ${x.k.padEnd(16).slice(0, 16)} ${JR}: ${String(x.d.n).padStart(4)} off ${pct(x.d.a, x.d.n).padStart(6)} | ${JR - 1}: ${String(x.v.n).padStart(4)} off ${pct(x.v.a, x.v.n).padStart(6)}`);
  L.push('');
}
const tekst = L.join('\n');
console.log(tekst);
if (process.argv.includes('--stuur'))
  execFileSync('node', [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
