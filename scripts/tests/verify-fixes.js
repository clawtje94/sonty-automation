#!/usr/bin/env node
// Verifieert de v4-fixes: (a) regressie — alle baseline-waarden binnen tabelbereik ongewijzigd,
// (b) nieuw gedrag per fix (K1/K2/K3/K4/K5/H1/H2/M4).
const fs = require('fs');
const SRC = '/Users/clawdboot/sonty/scripts/cron-offerte-controle-v4-combined.js';
const src = fs.readFileSync(SRC, 'utf8');
const code = src.slice(src.indexOf('const MK_UITVAL_COLS'), src.indexOf('// ============ MAIN ============'));
const SUNMASTER_PRICES = JSON.parse(fs.readFileSync('/Users/clawdboot/sonty/data/sunmaster-prices-2026.json', 'utf8'));
const MARKUP = 1.10;
const api = eval(code + `;({mkLookupMarkies, mkLookupBovenkap, mkLookupZijkap, mkTotaalExcl, mkBuildOptiesBlok, MK_GRENEN, MK_ALUMINIUM, MK_HARDHOUT,
  findNearest, lookupPrice, calculateCorrectPrice, correctProductPrice, getProductKey, getCategory, getBedType, getMontagePrice, getMontageCategory,
  adjustMontageInPlace, extractMaatFromDesc, processMarkiezen, addV4Enhancements})`);

const baseline = JSON.parse(fs.readFileSync(__dirname + '/baseline.json', 'utf8'));
let pass = 0, fail = 0;
function check(naam, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else { fail++; console.log('  FAIL ' + naam + ': verwacht ' + JSON.stringify(expected) + ', kreeg ' + JSON.stringify(actual)); }
  return ok;
}

// ============ A. REGRESSIE: baseline-waarden moeten EXACT gelijk blijven ============
// Uitzondering (M1, bevestigd door Daimy 2026-07-02): uitvalschermen met uitval >95cm krijgen
// nu de juiste doektabel (200/225) i.p.v. hardcoded 165 — die drie baseline-waarden wijzigen BEWUST.
const M1_OVERRIDES = {
  'suncube150/350//115': 1835,        // was 1763 (doek 165) → doek 200
  'suncube150/140//135': 1430,        // was 1373 → doek 225
  'sunproject100/300//135': 1350,     // was 1274 → doek 225
};
const M1_CC_OVERRIDES = {
  'suncube150/350//115/handbediend': Math.round((1835 - 299) * 1.10 * 100) / 100,          // 1689.6 (was 1610.4)
  'suncube150/350//115/afstandsbediening': Math.round((1835 + 60 + 76) * 1.10 * 100) / 100, // 2168.1 (was 2088.9)
  'sunproject100/300//135/afstandsbediening': Math.round((1350 + 134 + 76) * 1.10 * 100) / 100, // 1716 (was 1632.4)
  'sunproject100/300//135/draaischakelaar': Math.round(1350 * 1.10 * 100) / 100,            // 1485 (was 1401.4)
};
console.log('=== A. REGRESSIE (binnen tabelbereik → prijs ongewijzigd; M1-cases bewust nieuw) ===');
for (const [key, expected] of baseline.lookupPrice) {
  const args = key.split('/').map(x => x === '' ? null : parseFloat(x) || x);
  const exp = key in M1_OVERRIDES ? M1_OVERRIDES[key] : expected;
  check('lookupPrice ' + key + (key in M1_OVERRIDES ? ' [M1 bewust gewijzigd]' : ''), api.lookupPrice(args[0], args[1], args[2], args[3]), exp);
}
for (const [key, expected] of baseline.calculateCorrectPrice) {
  const p = key.split('/');
  const exp = key in M1_CC_OVERRIDES ? M1_CC_OVERRIDES[key] : expected;
  check('calcCorrectPrice ' + key + (key in M1_CC_OVERRIDES ? ' [M1 bewust gewijzigd]' : ''), api.calculateCorrectPrice(p[0], parseFloat(p[1]) || null, parseFloat(p[2]) || null, parseFloat(p[3]) || null, p[4]), exp);
}
check('mkTotaal alu4000/1000', api.mkTotaalExcl('Aluminium', 4000, 1000), baseline.markies[0][1]);
check('mkTotaal grenen4200/2000', api.mkTotaalExcl('Grenen', 4200, 2000), baseline.markies[1][1]);
check('mkTotaal hardhout3000/1500', api.mkTotaalExcl('Hardhout', 3000, 1500), baseline.markies[2][1]);
check('mkTotaal alu5000/1000', api.mkTotaalExcl('Aluminium', 5000, 1000), baseline.markies[3][1]);
check('mkLookup grenen3000/1000', api.mkLookupMarkies(api.MK_GRENEN, 3000, 1000), baseline.markies[4][1]);
for (const [key, expected] of baseline.montage) {
  const p = key.split('/');
  check('montage ' + key, api.getMontagePrice(p[0], p[1], false), expected);
}
{
  const line = { description: 'Zip Design 110\nBreedte: 3000 mm\nHoogte: 2500 mm\nFrame kleur: RAL 7016 structuur\nBediening: Motor + afstandsbediening', pricePerUnit: 2338, units: 1 };
  api.correctProductPrice(line, 'zipDesign110', 300, 250, null);
  check('correctProductPrice zipDesign 300x250', line.pricePerUnit, baseline.cppZipDesign);
}
{
  const line = { description: 'SunElite\nBreedte: 6000 mm\nUitval: 3000 mm\nFrame Kleur: RAL 7016 structuur\nBediening: Draaischakelaar', pricePerUnit: 4930.9, units: 1 };
  api.correctProductPrice(line, 'sunelite', 600, null, 300);
  check('correctProductPrice sunelite 600', line.pricePerUnit, baseline.cppSunelite);
}
{
  const desc = '2x Markiezen\nkies_materiaal: Aluminium\nbreedte: 3000\nuitval: 1000\nwelk_type_bediening_wil_je?: Motor + afstandsbediening\nframekleur: RAL 9001\ndoekkleur: Geel';
  const r = api.processMarkiezen(desc, []);
  check('markies geldige desc: geen issues', r.issues, []);
  check('markies geldige desc: prijzen gelijk', r.lines.map(l => [l.description.split('\n')[0], l.pricePerUnit, l.units]), baseline.markiesProces);
}

// ============ B. FIX-GEDRAG ============
console.log('=== B. K1: knikarm breder dan tabel → null (was: stil 600cm-prijs) ===');
check('suneye 610.5cm → null', api.lookupPrice('suneye', 610.5, null, 250), null);   // echte offerte 202626910
check('suneye 725cm → null', api.lookupPrice('suneye', 725, null, 200), null);        // echte offerte 20268189
check('suneye 580cm uitval300 (tabel300 max 550) → null', api.lookupPrice('suneye', 580, null, 300), null);
check('suneyeXL 745cm (=max) blijft werken', api.lookupPrice('suneyeXL', 745, null, 250), 6278);
check('calcCorrectPrice suneye 725 → null', api.calculateCorrectPrice('suneye', 725, null, 200, 'afstandsbediening'), null);

console.log('=== B. K3: Zip Design tableSmall bereikbaar; buiten alle tabellen → null ===');
check('zipDesign 100x150 → tableSmall 1039 (was 1302)', api.lookupPrice('zipDesign110', 100, 150), 1039);
check('zipDesign 150x150 → tableSmall 1194 (was 1302)', api.lookupPrice('zipDesign110', 150, 150), 1194);
check('zipDesign 180x200 → tableSmall 1355 (was 1484)', api.lookupPrice('zipDesign110', 180, 200), 1355);
check('zipDesign 200x150 → tableLarge 1302 (ongewijzigd)', api.lookupPrice('zipDesign110', 200, 150), 1302);
check('zipDesign 550cm (>500) → null (was 500-prijs)', api.lookupPrice('zipDesign110', 550, 200), null);
check('zipDesign 300x300 (hoogte>270) → null (was 270-prijs)', api.lookupPrice('zipDesign110', 300, 300), null);
check('zipSquare 350cm (>340) → null (was 340-prijs)', api.lookupPrice('zipSquare85100', 350, 200), null);
check('rolluikS42 450cm (>400) → null (was 400-prijs)', api.lookupPrice('rolluikS42', 450, 150), null);

console.log('=== B. K4: knikarm minderprijs uitval 150/200 ===');
// suneye 400cm: tabel-250 = 2778; uitval200 -160; uitval150 -180; IO +76; ×1.10
check('suneye 400/uitval200 IO = 2963.4 (was 3139.4)', api.calculateCorrectPrice('suneye', 400, null, 200, 'afstandsbediening'), 2963.4);
check('suneye 400/uitval150 IO = 2941.4 (was 3139.4)', api.calculateCorrectPrice('suneye', 400, null, 150, 'afstandsbediening'), 2941.4);
check('suneye 400/uitval250 IO ongewijzigd 3139.4', api.calculateCorrectPrice('suneye', 400, null, 250, 'afstandsbediening'), 3139.4);
check('sunbasicCassette 400/uitval200 = geen tabel-300 val; 250-tabel -150', api.calculateCorrectPrice('sunbasicCassette', 400, null, 200, 'afstandsbediening'),
  Math.round(((api.findNearest(SUNMASTER_PRICES.sunbasicCassette.tables['250'], 400).value) - 150 + 76) * 1.10 * 100) / 100);
// sunelite heeft geen uitval-minderprijzen → gedrag ongewijzigd (250-tabel)
check('sunelite 500/uitval200 = als 250-tabel (geen minderprijs in JSON)', api.calculateCorrectPrice('sunelite', 500, null, 200, 'draaischakelaar'),
  Math.round(((api.findNearest(SUNMASTER_PRICES.sunelite.tables['250'], 500).value) - 51) * 1.10 * 100) / 100);

console.log('=== B. M1: uitvalscherm doekmaat volgt uitval (95→165, 115→200, 135→225) ===');
// suncube150 B=350cm (tabel rondt af naar 360)
check('suncube 350/uitval95 → doek165 = 1763 (regressie: gelijk aan oud)', api.lookupPrice('suncube150', 350, null, 95), 1763);
check('suncube 350/uitval115 → doek200 = 1835', api.lookupPrice('suncube150', 350, null, 115), 1835);
check('suncube 350/uitval135 → doek225 = 1872', api.lookupPrice('suncube150', 350, null, 135), 1872);
// sunproject100 B=300cm
check('sunproject 300/uitval95 → doek165 = 1274 (regressie: gelijk aan oud)', api.lookupPrice('sunproject100', 300, null, 95), 1274);
check('sunproject 300/uitval115 → doek200 = 1329', api.lookupPrice('sunproject100', 300, null, 115), 1329);
check('sunproject 300/uitval135 → doek225 = 1350', api.lookupPrice('sunproject100', 300, null, 135), 1350);
// randen
check('uitval 0/ontbrekend → doek165 (huidig gedrag)', api.lookupPrice('sunproject100', 300, null, null), api.lookupPrice('sunproject100', 300, null, 95));
check('uitval 96 → doek200 (grens)', api.lookupPrice('suncube150', 350, null, 96), 1835);
check('uitval 116 → doek225 (grens)', api.lookupPrice('suncube150', 350, null, 116), 1872);
check('uitvalscherm breder dan tabel (suncube 650>600) → null', api.lookupPrice('suncube150', 650, null, 95), null);
check('sunproject 800 (=max) blijft werken', api.lookupPrice('sunproject100', 800, null, 95), 2688);

console.log('=== B. K5: markies boven tabelbereik → null ===');
check('mkLookup grenen 4500mm → null (was 420-prijs 1212)', api.mkLookupMarkies(api.MK_GRENEN, 4500, 1000), null);
check('mkLookup grenen 5000mm → null', api.mkLookupMarkies(api.MK_GRENEN, 5000, 1000), null);
check('mkLookup alu 5000mm (=max) blijft werken', api.mkLookupMarkies(api.MK_ALUMINIUM, 5000, 1000), 1339);
check('mkLookup uitval 2100mm → null (was 200-kolom)', api.mkLookupMarkies(api.MK_ALUMINIUM, 3000, 2100), null);
check('mkTotaal grenen 4500 → null', api.mkTotaalExcl('Grenen', 4500, 1000), null);
check('mkTotaal alu 5000 werkt nog', typeof api.mkTotaalExcl('Aluminium', 5000, 1000), 'number');
// optieblok bij alu 4600 (grenen-alternatief valt buiten tabel → regel weggelaten, geen crash/NaN)
{
  const blok = api.mkBuildOptiesBlok('Handbediend', 'Aluminium', 4600, 1000);
  check('optieblok alu4600: geen NaN', blok.includes('NaN'), false);
  check('optieblok alu4600: grenen-alternatief weggelaten', blok.toLowerCase().includes('grenenhouten kap'), false);
  check('optieblok alu4600: hardhout-alternatief ook weg (max 420)', blok.toLowerCase().includes('hardhouten kap'), false);
}

console.log('=== B. K2: alle bestaande markiesregels vervangen (geen dubbeltelling) ===');
{
  const desc = '3x Markiezen\nkies_materiaal: Aluminium\nbreedte: 3000\nuitval: 1000\nwelk_type_bediening_wil_je?: Handbediend';
  const existing = [
    { description: 'Markies\n- Breedte: 3000mm', pricePerUnit: 2757.83, units: 3 },   // geprijsde RP-regel (case 20266913)
    { description: 'Markies\n- Breedte: 3000mm', pricePerUnit: 0, units: 2 },          // units>1, prijs 0 (case 20266938)
    { description: 'Inmeten + montage markies (houten kappen)\n- montage', pricePerUnit: 300, units: 3 },
    { description: 'Tahoma Switch\n- app', pricePerUnit: 195, units: 1 },
  ];
  const r = api.processMarkiezen(desc, existing);
  check('geen issues', r.issues, []);
  const mkCount = r.lines.filter(l => l.description.split('\n')[0].toLowerCase().includes('markies') && !l.description.split('\n')[0].toLowerCase().includes('montage')).length;
  check('precies 1 markies-productregel (was 3: 2 oude + 1 nieuwe)', mkCount, 1);
  check('tahoma blijft behouden', r.lines.some(l => l.description.startsWith('Tahoma')), true);
  check('oude geprijsde regel weg', r.lines.some(l => l.pricePerUnit === 2757.83), false);
  const montageLines = r.lines.filter(l => l.description.split('\n')[0].toLowerCase().includes('montage markies'));
  check('precies 1 montageregel', montageLines.length, 1);
  check('montageregel units=3, prijs 275', [montageLines[0].units, montageLines[0].pricePerUnit], [3, 275]);
  check('oude montageregel (€300) weg', r.lines.some(l => l.pricePerUnit === 300), false);
}

console.log('=== B. M4: markies-validatie → issues (→ handmatig) ===');
{
  const r1 = api.processMarkiezen('1x Markiezen\nbreedte: 3000\nuitval: 1000\nwelk_type_bediening_wil_je?: Handbediend', []);
  check('materiaal ontbreekt → issue', r1.issues.length > 0 && r1.lines === null, true);
  const r2 = api.processMarkiezen('1x Markiezen\nkies_materiaal: Aluminium\nbreedte: 3000\nuitval: 1000', []);
  check('bediening ontbreekt → issue', r2.issues.some(i => i.includes('bediening')), true);
  const r3 = api.processMarkiezen('1x Markiezen\nkies_materiaal: Staal\nbreedte: 3000\nuitval: 1000\nwelk_type_bediening_wil_je?: Handbediend', []);
  check('onbekend materiaal → issue', r3.issues.some(i => i.includes('onbekend materiaal')), true);
  const r4 = api.processMarkiezen('1x Markiezen\nkies_materiaal: Grenen\nbreedte: 5000\nuitval: 1000\nwelk_type_bediening_wil_je?: Handbediend', []);
  check('grenen 5000mm buiten tabel → issue', r4.issues.some(i => i.includes('buiten prijstabel')), true);
  // Case-insensitief: veldnamen met hoofdletters + bediening in andere case
  const r5 = api.processMarkiezen('1x Markiezen\nKies_materiaal: aluminium\nBreedte: 3000\nUitval: 1000\nWelk_type_bediening_wil_je?: somfy io motor solar', []);
  check('case-insensitief parsen + bediening genormaliseerd', r5.issues, []);
  check('solar-bediening prijs meegenomen (745 excl, incl Situo-zender per boek 2026)', r5.lines[0].pricePerUnit,
    Math.round((api.mkLookupMarkies(api.MK_ALUMINIUM, 3000, 1000) + 745 + api.mkLookupBovenkap(3000, true) + api.mkLookupZijkap(1000, true)) * 1.21 * 100) / 100);
  const r6 = api.processMarkiezen('1x Markiezen\nkies_materiaal: Aluminium\nbreedte: 3000\nwelk_type_bediening_wil_je?: Handbediend', []);
  check('uitval ontbreekt → issue', r6.issues.some(i => i.includes('uitval')), true);
}

console.log('=== B. H1: correctProductPrice → priceUnknown ===');
{
  const line = { description: 'Suneye\nBreedte: 7250 mm\nUitval: 2000 mm\nBediening: Motor + afstandsbediening', pricePerUnit: 3500, units: 1 };
  const pc = api.correctProductPrice(line, 'suneye', 725, null, 200);
  check('suneye 725cm → priceUnknown=true', pc.priceUnknown, true);
  check('prijs NIET aangepast', line.pricePerUnit, 3500);
  const line2 = { description: 'Zip Design 110\nBreedte: 3000 mm\nHoogte: 2500 mm\nFrame kleur: RAL 7016 structuur\nBediening: Motor + afstandsbediening', pricePerUnit: 2338, units: 1 };
  const pc2 = api.correctProductPrice(line2, 'zipDesign110', 300, 250, null);
  check('normale regel → changed=true, priceUnknown=false', [pc2.changed, pc2.priceUnknown], [true, false]);
}

console.log('=== B. H2: montage-categorie uit titel ===');
check("getMontageCategory('inmeten + montage screen solar')", api.getMontageCategory('inmeten + montage screen solar'), 'screen');
check("getMontageCategory('inmeten + montage pergola')", api.getMontageCategory('inmeten + montage pergola'), 'pergola');
check("getMontageCategory('inmeten + montage rolluik solar')", api.getMontageCategory('inmeten + montage rolluik solar'), 'rolluik');
check("getMontageCategory('inmeten + montage knikarmscherm.')", api.getMontageCategory('inmeten + montage knikarmscherm.'), 'knikarmscherm');
check("getMontageCategory('inmeten + montage markies (houten kappen)')", api.getMontageCategory('inmeten + montage markies (houten kappen)'), 'markies');
check("getMontageCategory('inmeten + montage') → null (fallback lastCat)", api.getMontageCategory('inmeten + montage'), null);
// Simuleer de nieuwe hoofdloop-logica op combi [screen, pergola, montage screen, montage pergola]
{
  const lines = [
    { description: 'Zip Design 110\nBreedte: 3000 mm\nHoogte: 2500 mm\nBediening: Somfy IO motor solar', pricePerUnit: 2000, units: 1 },
    { description: 'Pergola 165 zip\nBreedte: 5000 mm\nUitval: 3500 mm\nBediening: Motor + afstandsbediening', pricePerUnit: 8000, units: 1 },
    { description: 'Inmeten + montage screen solar\n- Montage', pricePerUnit: 999, units: 1 },
    { description: 'Inmeten + montage Pergola\n- Montage', pricePerUnit: 999, units: 1 },
  ];
  let lastCat = null, lastBed = null; const catBed = {};
  for (let i = 0; i < lines.length; i++) {
    const firstLine = lines[i].description.split('\n')[0];
    const bediening = lines[i].description.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const cat = api.getCategory(firstLine);
    if (cat && lines[i].pricePerUnit > 0) { lastCat = cat; lastBed = api.getBedType(bediening, ''); catBed[cat] = lastBed; continue; }
    const d = firstLine.toLowerCase();
    if (d.includes('montage') || d.includes('inmeten')) {
      const mCat = api.getMontageCategory(d) || lastCat;
      if (mCat && mCat !== 'markies' && catBed[mCat] !== undefined) {
        api.adjustMontageInPlace(lines[i], mCat, catBed[mCat]);
      }
    }
  }
  check('montage screen solar → €175 (was €650 pergola-tarief)', lines[2].pricePerUnit, 175);
  check('montage pergola → €650', lines[3].pricePerUnit, 650);
}
// Montage zonder bijbehorend product in de offerte → NIET aanraken (geen gok)
{
  const l = { description: 'Inmeten + montage screen solar\n- Montage', pricePerUnit: 175, units: 1 };
  const catBed = { rolluik: 'draaischakelaar' };
  const mCat = api.getMontageCategory(l.description.split('\n')[0].toLowerCase());
  const touched = (mCat && mCat !== 'markies' && catBed[mCat] !== undefined);
  check('montage screen zonder screen-product → onaangeroerd', touched, false);
}

console.log('\n========================================');
console.log('RESULTAAT: ' + pass + ' geslaagd, ' + fail + ' gefaald');
process.exit(fail > 0 ? 1 : 0);
