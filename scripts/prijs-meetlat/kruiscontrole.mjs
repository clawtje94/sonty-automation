/**
 * KRUISCONTROLE — zeggen de vier prijsmotoren nu eigenlijk hetzelfde?
 *
 * WAAROM DIT IETS ANDERS IS DAN DE MEETLAT.
 * De meetlat bewijst dat een verbouwing niets verandert. Dat is bescherming tegen
 * kapotmaken. Maar hij bewijst NIET dat het nu goed staat: als een verbetering
 * destijds alleen in v4 is doorgevoerd en niet in de offerte-tool, dan legt de
 * meetlat dat verschil gewoon vast en keurt de verbouwing daarna netjes goed.
 *
 * Daarom deze tweede meting: dezelfde vraag aan v4 en aan de offerte-tool stellen en
 * kijken of er hetzelfde uitkomt. Verschillen hier zijn precies de plekken waar een
 * eerdere correctie maar half is geland — en die moeten opgelost zijn vóór je alles
 * op één basis zet, want anders kies je bij het samenvoegen ongemerkt een winnaar.
 *
 * Alleen-lezen.
 */
const stop = (w) => () => { throw new Error(`KRUISCONTROLE: ${w} geblokkeerd`); };
globalThis.fetch = stop('fetch');

const { createRequire } = await import('node:module');
const require = createRequire('/Users/clawdboot/sonty/scripts/prijs-meetlat/x.js');
const E = require('./engines.js');
const { bouwRaster, BEDS } = require('./raster.js');
const PRICES = require('/Users/clawdboot/sonty/data/sunmaster-prices-2026.json');

const ot = await import('/Users/clawdboot/sonty-website/lib/offerte-tool/pricing.ts');
const v4 = E.motorV4();

// v4 rekent in cm, de offerte-tool in mm. En bij knikarm/serre/pergola/uitvalscherm
// staat in het hoogte-veld van de offerte-tool de uitval. Extra val: bij serre en
// pergola staat de uitval in v4 al in MILLIMETERS (2500-4500), die moet je dus niet
// nog een keer met tien vermenigvuldigen.
const UITVAL_ALS_HOOGTE = new Set(['knikarmscherm', 'serre', 'pergola', 'uitvalscherm']);
const UITVAL_AL_IN_MM = new Set(['serre', 'pergola']);
const naarMM = (cat, v) => {
  if (!UITVAL_ALS_HOOGTE.has(cat)) return (v.hoogte || 0) * 10;
  const u = v.uitval ?? v.hoogte ?? 0;
  return u * 10; // v4 krijgt overal de uitval in cm, de tool wil mm
};

const raster = bouwRaster({ randen: false });
const perProduct = {};
const voorbeelden = [];

for (const v of raster.vragen) {
  const cat = PRICES[v.productKey]?.category;
  if (!cat) continue;
  const p = (perProduct[v.productKey] = perProduct[v.productKey] || { n: 0, gelijk: 0, anders: 0, alleenV4: 0, alleenOT: 0, maxVerschil: 0 });

  const pV4 = v4.prijs(v);
  const hoogteMM = naarMM(cat, v);
  let pOT = null;
  try {
    const r = ot.berekenPrijs(v.productKey, (v.breedte || 0) * 10, hoogteMM, v.bedType, 'standaard');
    pOT = r?.error ? null : (r?.productPrijs ?? null);
  } catch { pOT = null; }

  p.n++;
  if (pV4 === null && pOT === null) { p.gelijk++; continue; }
  if (pV4 !== null && pOT === null) { p.alleenV4++; continue; }
  if (pV4 === null && pOT !== null) { p.alleenOT++; continue; }
  const d = Math.abs(pV4 - pOT);
  if (d <= 0.011) { p.gelijk++; continue; }
  p.anders++;
  if (d > p.maxVerschil) p.maxVerschil = Math.round(d * 100) / 100;
  if (voorbeelden.length < 25) voorbeelden.push({ prod: v.productKey, b: v.breedte, h: v.hoogte, u: v.uitval, bed: v.bedType, v4: pV4, ot: pOT, verschil: Math.round(d * 100) / 100 });
}

console.log('KRUISCONTROLE v4  ↔  offerte-tool   (productprijs, standaardkleur, zonder montage)\n');
console.log('product              gemeten   gelijk   anders  alleen-v4  alleen-OT  max verschil');
let tot = { n: 0, gelijk: 0, anders: 0, alleenV4: 0, alleenOT: 0 };
for (const [k, p] of Object.entries(perProduct).sort()) {
  for (const f of ['n', 'gelijk', 'anders', 'alleenV4', 'alleenOT']) tot[f] += p[f];
  const vlag = p.anders || p.alleenV4 || p.alleenOT ? '  ⚠️' : '';
  console.log(`${k.padEnd(20)} ${String(p.n).padStart(7)} ${String(p.gelijk).padStart(8)} ${String(p.anders).padStart(8)} ${String(p.alleenV4).padStart(10)} ${String(p.alleenOT).padStart(10)}  ${p.maxVerschil ? '€' + p.maxVerschil : '—'}${vlag}`);
}
console.log('─'.repeat(90));
console.log(`${'TOTAAL'.padEnd(20)} ${String(tot.n).padStart(7)} ${String(tot.gelijk).padStart(8)} ${String(tot.anders).padStart(8)} ${String(tot.alleenV4).padStart(10)} ${String(tot.alleenOT).padStart(10)}`);

if (voorbeelden.length) {
  console.log('\nEERSTE VERSCHILLEN:');
  for (const x of voorbeelden.slice(0, 15)) {
    console.log(`  ${x.prod.padEnd(18)} b${x.b} h${x.h ?? '-'} u${x.u ?? '-'} ${x.bed.padEnd(18)} v4 €${x.v4}  ↔  tool €${x.ot}   (€${x.verschil})`);
  }
}

const schoon = tot.anders === 0 && tot.alleenV4 === 0 && tot.alleenOT === 0;
console.log('\n' + '═'.repeat(90));
console.log(schoon
  ? '✅ v4 en de offerte-tool zeggen overal hetzelfde. Samenvoegen tot één basis is veilig.'
  : `❌ ${tot.anders + tot.alleenV4 + tot.alleenOT} verschillen. Dit moet eerst opgelost, anders kies je bij het samenvoegen ongemerkt een winnaar.`);
