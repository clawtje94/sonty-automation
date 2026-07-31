// Leest de PDF's uit 'Bonnen materialen' en haalt artikelregels (aantal + omschrijving + netto) op.
// Layouts: Wurth, Isero, Berner. Overige leveranciers -> 'onbekend' voor handmatige check.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname + '/pdfs/Bonnen_materialen';
const num = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));

function text(f) {
  try { return execFileSync('pdftotext', ['-layout', f, '-'], { maxBuffer: 40e6 }).toString(); }
  catch { return ''; }
}

function supplier(t) {
  if (/W(ü|u)rth/i.test(t)) return 'Würth';
  if (/Isero/i.test(t)) return 'Isero';
  if (/Berner/i.test(t)) return 'Berner';
  const m = t.match(/^\s*([A-Z][\w .&'-]{3,40})\s*$/m);
  return 'overig:' + (m ? m[1].trim() : '?');
}

// ---- Würth: "1   019005030   005   500   500   9,85   100   68   15,75" + omschrijving op regel eronder
function parseWurth(t) {
  const L = t.split('\n'), out = [];
  for (let i = 0; i < L.length; i++) {
    const m = L[i].match(/^\s*(\d{1,3})\s+(\d{6,12})\s+(\d{3})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s+([\d.,]+)?\s*([\d.,]+)\s*$/);
    if (!m) continue;
    const desc = (L[i + 1] || '').replace(/^\s*\d+\s*/, '').trim();
    out.push({ art: m[2], oms: desc, aantal: num(m[5]), netto: num(m[9]) });
  }
  return out;
}

// ---- Isero: "190379  Rolbandmaat ...  Stanley  1,00  29,00  1,00  29,00  ACTIE  29,00"
function parseIsero(t) {
  const L = t.split('\n'), out = [];
  for (const line of L) {
    const m = line.match(/^\s*(\w{5,12})\s{2,}(.+?)\s{2,}([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(?:[\d.,]+%|NETTO|ACTIE)?\s*([\d.,]+)\s*$/);
    if (!m) continue;
    const a = num(m[3]);
    if (!(a > 0)) continue;
    out.push({ art: m[1], oms: m[2].replace(/\s{2,}.*$/, '').trim(), aantal: a, netto: num(m[7]) });
  }
  return out;
}

// ---- Berner: "600  SPAANPLSCH..." dan "85502-300  2,97  2  17,82  ...  17,82"
function parseBerner(t) {
  const L = t.split('\n'), out = [];
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i].match(/^\s{5,}([\d.]+)\s{2,}([A-Z0-9][^\s].{3,60}?)\s*$/);
    if (!a) continue;
    const b = L[i + 1].match(/^\s+([\w-]+)\s{2,}([\d.,]+)\s+(\d+)\s+([\d.,]+)(?:\s+[\d.,]+)?\s+([\d.,]+)\s*$/);
    if (!b) continue;
    out.push({ art: b[1], oms: a[2].trim(), aantal: num(a[1]), netto: num(b[5]) });
  }
  return out;
}

const index = JSON.parse(fs.readFileSync(__dirname + '/pdf-index.json', 'utf8'));
const meta = {}; for (const r of index) meta[path.basename(r.file)] = r;

const rows = [], stats = {};
for (const f of fs.readdirSync(DIR).filter(x => /\.pdf$/i.test(x))) {
  const t = text(path.join(DIR, f));
  if (!t.trim()) { stats['leeg/scan'] = (stats['leeg/scan'] || 0) + 1; continue; }
  const s = supplier(t);
  const lines = s === 'Würth' ? parseWurth(t) : s === 'Isero' ? parseIsero(t) : s === 'Berner' ? parseBerner(t) : [];
  stats[s] = (stats[s] || 0) + 1;
  if (!lines.length && !s.startsWith('overig')) stats['GEEN REGELS: ' + s + ' ' + f] = 1;
  const d = (meta[f]?.date || f.slice(0, 10)).slice(0, 10);
  for (const l of lines) rows.push({ ...l, leverancier: s, datum: d, bestand: f });
}

fs.writeFileSync(__dirname + '/materiaal-regels.json', JSON.stringify(rows, null, 1));
console.log('FACTUREN PER LEVERANCIER:'); console.log(stats);
console.log('REGELS:', rows.length, '| totaal netto EUR', rows.reduce((a, b) => a + (b.netto || 0), 0).toFixed(2));
