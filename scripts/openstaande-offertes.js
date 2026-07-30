#!/usr/bin/env node
// GELD OP DE PLANK (lijst-item 7): offertes 14-60 dagen oud, geen akkoord en geen
// spoor van nabellen (kolom "Gebeld?" leeg of nee). Gebruik: [--stuur]
const fs = require('fs');
const isAkk = r => r.inkoop > 0 || r.akkoordBedrag > 0 || /^\d{3,6}$/.test(r.nummer || '') || !!r.akkoordDatum;
const pd = t => { const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  return null; };
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const rows = JSON.parse(fs.readFileSync(__dirname + '/../data/conversie-2026-raw.json', 'utf8')).rows;
const nu = new Date();
const dagen = d => Math.round((nu - d) / 864e5);
// TE VER = buiten werkgebied, geen echte open offerte. De kolom "Gebeld?" sterft uit
// (juli: 1 van 2.022 gevuld) dus opvolgstatus is uit de sheet NIET af te leiden.
const open = rows.filter(r => { const d = pd(r.celDatum); if (!d) return false;
  const lft = dagen(d);
  return lft >= 14 && lft <= 60 && !isAkk(r) && !/te ver/i.test(String(r.gebeld || '') + String(r.tel || '')); });
const som = a => a.reduce((x, r) => x + (r.bedrag || 0), 0);
const bucket = (lo, hi) => open.filter(r => { const l = dagen(pd(r.celDatum)); return l >= lo && l < hi; });
const L = [`GELD OP DE PLANK — offertes 14-60 dagen oud zonder akkoord (excl. TE VER)`, '',
  `totaal open: ${open.length} offertes, ${eur(som(open))} offertewaarde`, ''];
for (const [lo, hi] of [[14, 21], [21, 30], [30, 45], [45, 61]]) {
  const b = bucket(lo, hi);
  L.push(`  ${String(lo).padStart(2)}-${hi - 1} dagen: ${String(b.length).padStart(4)} offertes, ${eur(som(b))}`);
}
L.push('', 'Hoe ouder, hoe kleiner de kans dat hij nog sluit (na 45 dagen is 86% van wat',
  'ooit sluit al binnen). De oudste bucket is dus het urgentst om na te bellen.',
  'Opvolgstatus staat niet betrouwbaar in de sheet; dit is de bruto werkvoorraad.');
const tekst = L.join('\n');
console.log(tekst);
if (process.argv.includes('--stuur'))
  require('child_process').execFileSync('node', [__dirname + '/sonty-data-send.js', tekst], { stdio: 'inherit' });
