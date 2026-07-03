#!/usr/bin/env node
// Verificatie van data/roma-prices-2025.json tegen de bron-markdown-extracties.
// Trekt per product 25 willekeurige (hoogte, breedte)-paren, zoekt de cel onafhankelijk
// op in de bron-markdown (regex per rij, kolomindex via de tabelkop) en vergelijkt
// exact met de JSON. Rapporteert N/25 per product.
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', '..');
const SRC = path.join(BASE, 'data', 'prijsboeken', 'roma-extract');
const json = JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'roma-prices-2025.json'), 'utf8'));

const md = {
  zip: fs.readFileSync(path.join(SRC, 'roma-10b-zipscreen2-matrix.md'), 'utf8'),
  zsol: fs.readFileSync(path.join(SRC, 'roma-10c-zipscreen2-solar-matrix.md'), 'utf8'),
  vxp: fs.readFileSync(path.join(SRC, 'roma-04-voorzetrolluiken.md'), 'utf8'),
  tre: fs.readFileSync(path.join(SRC, 'roma-05-gerolvormd-trendo.md'), 'utf8'),
};

// Onafhankelijke bron-lookup: pak de sectie na `heading`, vind de kopregel
// ("| Hoogte\Breedte |..." of "| Hoogte \ Breedte |...") voor de kolomindex en
// de rij die met "| <hoogte> |" begint. Kolomkoppen mogen een suffix hebben,
// zoals "3600 (As ø63)".
function sourceCell(text, heading, height, width) {
  const start = text.indexOf(heading);
  if (start < 0) throw new Error('Heading niet gevonden: ' + heading);
  const section = text.slice(start);
  const headerLine = section.split('\n').find((l) => /^\|\s*Hoogte\s*\\\s*Breedte\s*\|/.test(l.trim()));
  if (!headerLine) throw new Error('Tabelkop niet gevonden onder: ' + heading);
  const cols = headerLine.trim().replace(/^\||\|$/g, '').split('|')
    .map((s) => s.trim().replace(/\s*\(.*\)$/, ''));
  const colIdx = cols.indexOf(String(width));
  if (colIdx < 1) throw new Error(`Breedte ${width} niet in kop van "${heading}"`);
  const rowRe = new RegExp('^\\| ' + height + ' \\|.*$', 'm');
  const m = section.match(rowRe);
  if (!m) throw new Error(`Hoogte ${height} niet gevonden onder "${heading}"`);
  const cells = m[0].trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
  return cells[colIdx];
}

function normNumber(raw) {
  let s = raw.trim();
  if (s === '' || s === '–' || s === '—' || s === '-' || s === '[?]' || s.includes('[?]')) return null;
  if (s.startsWith('*B*')) s = s.slice(3);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('Onleesbare broncel: "' + raw + '"');
  return n;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function samplePairs(coords, n) {
  const out = new Set();
  while (out.size < n) out.add(JSON.stringify(pick(coords)));
  return [...out].map((s) => JSON.parse(s));
}

const results = [];
function report(name, checks) {
  const ok = checks.filter((c) => c.match).length;
  results.push({ name, ok, total: checks.length });
  console.log(`\n=== ${name}: ${ok}/${checks.length} exact match ===`);
  for (const c of checks.filter((x) => !x.match)) {
    console.log(`  MISMATCH h=${c.h} b=${c.w}: bron=${JSON.stringify(c.src)} json=${JSON.stringify(c.js)}`);
  }
}

// ---- zipscreen2 ------------------------------------------------------------
{
  const p = json.zipscreen2;
  // alleen coördinaten die door een brontabel gedekt worden
  const coords = [];
  for (const h of p.heightsMM) for (const w of p.widthsMM) {
    if ((h <= 5200 && w <= 5000) || (h <= 3500 && w >= 5100) || (h >= 5300 && w <= 3300)) coords.push([h, w]);
  }
  const heading = (h, w) =>
    h <= 5200 && w <= 3000 ? '## Tabel 1' :
    h <= 5200 && w <= 5000 ? '## Tabel 2' :
    h <= 3500 ? '## Tabel 3' : '## Tabel 4';
  const checks = samplePairs(coords, 25).map(([h, w]) => {
    const src = normNumber(sourceCell(md.zip, heading(h, w), h, w));
    const js = p.prices[p.heightsMM.indexOf(h)][p.widthsMM.indexOf(w)];
    return { h, w, src, js, match: src === js };
  });
  report('zipscreen2', checks);
}

// ---- zipscreen2_mini (geen matrix in bron: verifieer meerprijzen) ----------
{
  const p = json.zipscreen2_mini;
  const checks = [
    { h: '-', w: 'mini-geleider/zijde', src: /Meerprijs per Mini-geleider: 196,00 €\/stuk/.test(md.zip + fs.readFileSync(path.join(SRC, 'roma-10-screens-zipscreen.md'), 'utf8')) ? 196 : NaN, js: p.extras['mini_geleider_per_zijde_EUR'] },
    { h: '-', w: 'smalle geleider 24x62', src: /Smalle geleider 24 x 62 mm met uitvulprofiel 25 x 10 mm[\s\S]{0,120}\| 24,00 \|/.test(fs.readFileSync(path.join(SRC, 'roma-10-screens-zipscreen.md'), 'utf8')) ? 24 : NaN, js: p.extras['smalle_geleider_24x62_met_uitvulprofiel_25x10_per_geleider_EUR'] },
    { h: '-', w: 'plafondbeugel', src: /Plafondbeugel \(Bevestiging naar boven\) voor Vrijstaande geleider of Mini-geleider \| Stuk \| 40,00/.test(fs.readFileSync(path.join(SRC, 'roma-10-screens-zipscreen.md'), 'utf8')) ? 40 : NaN, js: p.extras['plafondbeugel_per_st_EUR'] },
  ].map((c) => ({ ...c, match: c.src === c.js }));
  console.log('\n=== zipscreen2_mini: geen eigen prijsmatrix in bron (prijs = zipscreen2-matrix + meerprijs/zijde) ===');
  report('zipscreen2_mini (meerprijzen)', checks);
}

// ---- zipscreen2_solar --------------------------------------------------------
{
  const p = json.zipscreen2_solar;
  const coords = [];
  for (const h of p.heightsMM) for (const w of p.widthsMM) coords.push([h, w]);
  const heading = (h, w) => (w <= 3000 ? '## Tabel 1' : '## Tabel 3');
  const checks = samplePairs(coords, 25).map(([h, w]) => {
    const src = normNumber(sourceCell(md.zsol, heading(h, w), h, w));
    const js = p.prices[p.heightsMM.indexOf(h)][p.widthsMM.indexOf(w)];
    return { h, w, src, js, match: src === js };
  });
  report('zipscreen2_solar', checks);
}

// ---- voorzetrolluik_xp ------------------------------------------------------
{
  const p = json.voorzetrolluik_xp;
  const coords = [];
  for (const h of p.heightsMM) for (const w of p.widthsMM) {
    if (w <= 2300 || h <= 3100) coords.push([h, w]);
  }
  const heading = (h, w) => (w <= 2300
    ? '### Tabel A — breedte 800 t/m 2300 mm (bron: p70)'
    : '### Tabel B — breedte 2400 t/m 4000 mm (bron: p71)');
  const checks = samplePairs(coords, 25).map(([h, w]) => {
    const src = normNumber(sourceCell(md.vxp, heading(h, w), h, w));
    const js = p.prices[p.heightsMM.indexOf(h)][p.widthsMM.indexOf(w)];
    return { h, w, src, js, match: src === js };
  });
  report('voorzetrolluik_xp', checks);
}

// ---- voorzetrolluik_xp_solar -------------------------------------------------
{
  const p = json.voorzetrolluik_xp_solar;
  const coords = [];
  for (const h of p.heightsMM) for (const w of p.widthsMM) coords.push([h, w]);
  const heading = (h, w) => (w <= 2300
    ? '### Tabel A — breedte 800 t/m 2300 mm (bron: p72)'
    : '### Tabel B — breedte 2400 t/m 4000 mm (bron: p73)');
  const checks = samplePairs(coords, 25).map(([h, w]) => {
    const src = normNumber(sourceCell(md.vxp, heading(h, w), h, w));
    const js = p.prices[p.heightsMM.indexOf(h)][p.widthsMM.indexOf(w)];
    return { h, w, src, js, match: src === js };
  });
  report('voorzetrolluik_xp_solar', checks);
}

// ---- trendo (elke cel = 3 waarden, alle 3 moeten kloppen) -------------------
{
  const p = json.trendo;
  const coords = [];
  for (const h of p.heightsMM) for (const w of p.widthsMM) coords.push([h, w]);
  const heading = (h, w) => (w <= 1600
    ? '### P100 — Elementbreedte 900 t/m 1600 mm'
    : '### P101 — Elementbreedte 1700 t/m 2500 mm');
  const checks = samplePairs(coords, 25).map(([h, w]) => {
    const raw = sourceCell(md.tre, heading(h, w), h, w);
    const parts = raw.split('/').map((s) => normNumber(s));
    if (parts.length !== 3) throw new Error('TRENDO-broncel zonder 3 waarden: ' + raw);
    const hi = p.heightsMM.indexOf(h), wi = p.widthsMM.indexOf(w);
    const js = [p.pricesTrendo[hi][wi], p.pricesCombiBoven[hi][wi], p.pricesCombiOnder[hi][wi]];
    const match = parts.every((v, i) => v === js[i]);
    return { h, w, src: parts, js, match };
  });
  report('trendo (3 prijzen per cel)', checks);
}

console.log('\n--- TOTAAL ---');
let allOk = true;
for (const r of results) {
  console.log(`${r.name}: ${r.ok}/${r.total}`);
  if (r.ok !== r.total) allOk = false;
}
process.exit(allOk ? 0 : 1);
