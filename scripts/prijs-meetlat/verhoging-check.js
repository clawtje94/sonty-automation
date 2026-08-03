#!/usr/bin/env node
/**
 * VERHOGING-CHECK — controleert of een prijswijziging in ELK systeem precies goed doorkomt.
 *
 * De meetlat bewijst dat er niks verandert. Deze controle doet het omgekeerde: hij eist dat
 * alles wat mee HOORT te bewegen exact met de juiste factor meebeweegt, en dat alles wat
 * NIET mee hoort te bewegen ook echt blijft staan. Beweegt er iets half, dan is dat een
 * plek die zijn prijs nog ergens anders vandaan haalt.
 *
 * Alleen-lezen; draait op de nulmeting op schijf en een verse meting in het geheugen.
 *
 * Gebruik: node scripts/prijs-meetlat/verhoging-check.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const E = require('./engines.js');

const ROOT = E.ROOT;
const SNAP = path.join(ROOT, 'data', 'prijs-meetlat', 'nulmeting.json.gz');
const OUD_CFG = JSON.parse(fs.readFileSync('/tmp/prijsconfig-oud.json', 'utf8'));
const NIEUW_CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prijsconfig.json'), 'utf8'));

// NIET afronden: 1,31/1,21 is 1,0826446... en op vijf decimalen afgekapt loopt dat op
// grote bedragen enkele centen mis. Dan meld je fouten die er niet zijn.
const f = (a, b) => b / a;
const FACTOR = {
  sunmaster: f(OUD_CFG.sunmasterMarkup, NIEUW_CFG.sunmasterMarkup),
  roma: f(OUD_CFG.romaOpslag, NIEUW_CFG.romaOpslag),
  markies: f(OUD_CFG.markiezenFactor, NIEUW_CFG.markiezenFactor),
  onveranderd: 1,
};

/** Welke factor hoort bij deze sleutel? Per leverancier een eigen bodem, dus ook een
 *  eigen factor — en horren, voorraadschermen en montage horen helemaal niet te bewegen. */
const ROMA_PROD = /^roma/i;
const MARKIES_PROD = /^markies/i;
const HOR_PROD = /^hor/i;
function verwachteFactor(sleutel, soort) {
  if (soort === 'sunmaster') return FACTOR.sunmaster;
  if (soort === 'roma') return FACTOR.roma;
  if (soort === 'markies') return FACTOR.markies;
  const prod = String(sleutel).split('|')[2] || '';
  if (soort === 'offerte-tool') {
    if (ROMA_PROD.test(prod)) return FACTOR.roma;
    if (MARKIES_PROD.test(prod)) return FACTOR.markies;
    if (HOR_PROD.test(prod)) return FACTOR.onveranderd;      // Unilux: opslag zit al in de data
    if (prod === 'suneyeVoorraad') return FACTOR.onveranderd; // vaste actieprijs
    return FACTOR.sunmaster;
  }
  if (soort === 'configurator') {
    if (/markies/i.test(prod) || /raamdeco|shutter|gordijn|behang|horren/i.test(prod)) return FACTOR.onveranderd;
    return FACTOR.sunmaster;
  }
  return FACTOR.sunmaster;
}

function main() {
  console.log('VERHOGING-CHECK\n');
  console.log(`  Sunmaster  ${OUD_CFG.sunmasterMarkup}  →  ${NIEUW_CFG.sunmasterMarkup}   (×${FACTOR.sunmaster.toFixed(5)})`);
  console.log(`  Roma       ${OUD_CFG.romaOpslag}  →  ${NIEUW_CFG.romaOpslag}   (×${FACTOR.roma.toFixed(5)})`);
  console.log(`  Markiezen  ${OUD_CFG.markiezenFactor}  →  ${NIEUW_CFG.markiezenFactor}   (×${FACTOR.markies.toFixed(5)})\n`);

  const oud = JSON.parse(zlib.gunzipSync(fs.readFileSync(SNAP)).toString());
  // Verse meting via dezelfde weg als de meetlat.
  const meet = require('child_process').spawnSync(process.execPath,
    [path.join(__dirname, 'meet-nu.js')], { maxBuffer: 1024 * 1024 * 1024, encoding: 'utf8' });
  if (meet.status !== 0) throw new Error('verse meting mislukt: ' + (meet.stderr || '').slice(0, 400));
  const nu = JSON.parse(meet.stdout);

  const groep = {};
  const voorbeelden = [];
  for (const [k, a] of Object.entries(oud.prijzen)) {
    const b = nu.prijzen[k];
    const soort = a.soort || 'sunmaster';
    const g = (groep[soort] = groep[soort] || { totaal: 0, goed: 0, fout: 0, nvt: 0 });
    g.totaal++;
    if (!b) { g.fout++; continue; }

    const verw = verwachteFactor(k, soort);
    // Beide website-motoren leveren [totaal, productprijs, extra, montage]. Het totaal
    // slaan we over (dat is een optelling van iets dat wél en iets dat niet meebeweegt);
    // montage moet stilstaan, de rest moet met de juiste factor mee.
    const paren = Array.isArray(a.v4)
      ? [[a.v4[1], b.v4?.[1], verw], [a.v4[2], b.v4?.[2], verw], [a.v4[3], b.v4?.[3], 1]]
      : [[a.v4, b.v4, verw]];

    let ok = true, nvt = true;
    for (const [o, n, vf] of paren) {
      if (o === null || o === undefined || o === 0) { if (n !== o && !(o === 0 && n === 0)) ok = false; continue; }
      nvt = false;
      const doel = Math.round(o * vf * 100) / 100;
      // Roma rondt af op hele euro's (Math.round in roma-pricing), dus daar is een
      // cent-tolerantie te streng: round(x*1,30) is niet gelijk aan round(x*1,15)*1,1304.
      // Roma en de configurator ronden af op hele euro's; round(x×1,20) is dan niet gelijk
      // aan round(x×1,10)×1,0909. Daar mag maximaal een euro tussen zitten, verder niets.
      const heleEuros = soort === 'roma' || soort === 'configurator'
        || (soort === 'offerte-tool' && ROMA_PROD.test(String(k).split('|')[2] || ''));
      const speling = heleEuros ? 1.01
        // Twee keer afronden op centen (eerst bij de oude prijs, dan bij de nieuwe) kan
        // een paar cent schelen. Ruimer dan dat mag niet: dan verstop je echte fouten.
        : 0.03;
      if (Math.abs((n ?? NaN) - doel) > speling) ok = false;
    }
    if (nvt) { g.nvt++; continue; }
    if (ok) { g.goed++; continue; }
    g.fout++;
    if (voorbeelden.length < 12) voorbeelden.push({ k, soort, verw, oud: a.v4, nu: b.v4 });
  }

  console.log('systeem            gemeten    beweegt goed   FOUT   geen prijs');
  let totFout = 0;
  for (const [s, g] of Object.entries(groep).sort()) {
    totFout += g.fout;
    console.log(`${s.padEnd(18)} ${String(g.totaal).padStart(7)} ${String(g.goed).padStart(14)} ${String(g.fout).padStart(6)} ${String(g.nvt).padStart(12)}${g.fout ? '  ⚠️' : ''}`);
  }

  if (voorbeelden.length) {
    console.log('\nEERSTE FOUTEN:');
    for (const v of voorbeelden) console.log(`  ${v.k}\n     verwacht ×${v.verw}   was ${JSON.stringify(v.oud)}  →  nu ${JSON.stringify(v.nu)}`);
  }

  console.log('\n' + '═'.repeat(70));
  if (totFout === 0) {
    console.log('✅ ALLE SYSTEMEN VOLGEN DE CONFIG — elke prijs die mee hoort te bewegen doet dat');
    console.log('   met exact de juiste factor, en wat niet mee hoort te bewegen staat stil.');
  } else {
    console.log(`❌ ${totFout} prijzen bewegen niet zoals ze horen. Er zit nog een plek die zijn`);
    console.log('   prijs ergens anders vandaan haalt. NIET uitrollen.');
  }
  process.exit(totFout === 0 ? 0 : 1);
}

main();
