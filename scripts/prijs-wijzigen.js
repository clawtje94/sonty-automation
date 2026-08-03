#!/usr/bin/env node
/**
 * PRIJS WIJZIGEN — de enige manier waarop een opslag verandert.
 *
 * Doet in één keer alles wat er moet gebeuren en stopt zodra er iets niet klopt:
 *   1. nulmeting vastleggen op de HUIDIGE waarden (waar tegenaan gemeten wordt)
 *   2. de nieuwe waarden in data/prijsconfig.json zetten
 *   3. de kopie in sonty-website bijwerken (die staat los)
 *   4. de override in Vercel KV bijwerken — die wint op de live website van het bestand
 *   5. controleren dat élke prijs in élk systeem exact met de juiste factor meebeweegt
 *   6. controleren dat er nergens weer een los getal in de code staat
 * Faalt stap 5 of 6, dan wordt alles teruggedraaid en is er niets veranderd.
 *
 * Gebruik:
 *   node scripts/prijs-wijzigen.js --sunmaster 1.20 --roma 1.30 --markiezen 1.31
 *   node scripts/prijs-wijzigen.js --sunmaster 1.20 --echt      → daadwerkelijk doorvoeren
 *
 * Zonder --echt verandert er niets: hij zet de waarden, meet, en draait terug.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WEBSITE = path.join(ROOT, '..', 'sonty-website');
const CFG = path.join(ROOT, 'data', 'prijsconfig.json');
const CFG_WEB = path.join(WEBSITE, 'data', 'prijsconfig.json');
const BEWAARD = '/tmp/prijsconfig-oud.json'; // verhoging-check leest hier de oude waarden

const ARG = process.argv.slice(2);
const ECHT = ARG.includes('--echt');
const num = (naam) => { const i = ARG.indexOf('--' + naam); return i < 0 ? null : Number(ARG[i + 1]); };
const NIEUW = { sunmasterMarkup: num('sunmaster'), romaOpslag: num('roma'), markiezenFactor: num('markiezen') };

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...opts });
}

/** De live override in Vercel KV. Die wint op de website van het bestand, dus zonder deze
 *  stap blijft de offerte-tool op de oude opslag staan terwijl v4 en de bot al om zijn. */
async function kv(actie, waarde) {
  const env = Object.fromEntries(fs.readFileSync(path.join(WEBSITE, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
  const u = env.KV_REST_API_URL, t = env.KV_REST_API_TOKEN;
  if (!u || !t) throw new Error('geen KV-credentials in sonty-website/.env.local — de website-override kan niet mee');
  const H = { Authorization: 'Bearer ' + t };
  const huidig = JSON.parse((await (await fetch(u + '/get/crm:prijsconfig', { headers: H })).json()).result || '{}');
  if (actie === 'lees') return huidig;
  const nieuw = { ...huidig, ...waarde };
  const r = await fetch(u + '/set/crm:prijsconfig', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(nieuw) });
  if (!r.ok) throw new Error('KV bijwerken mislukt: ' + r.status);
  return nieuw;
}

async function main() {
  const oud = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  const wijzigingen = Object.entries(NIEUW).filter(([k, v]) => v && v !== oud[k]);
  if (!wijzigingen.length) { console.log('Niets te wijzigen. Gebruik --sunmaster / --roma / --markiezen.'); process.exit(1); }

  console.log(ECHT ? 'PRIJS WIJZIGEN — ECHT\n' : 'PRIJS WIJZIGEN — PROEF (alles wordt teruggedraaid)\n');
  for (const [k, v] of wijzigingen) console.log(`  ${k.padEnd(18)} ${oud[k]}  →  ${v}   (×${(v / oud[k]).toFixed(5)})`);

  const kvOud = await kv('lees');
  console.log(`  Vercel KV nu: ${JSON.stringify(kvOud)}`);

  console.log('\n1/6  nulmeting op de huidige waarden…');
  fs.writeFileSync(BEWAARD, JSON.stringify(oud, null, 2));
  run(process.execPath, [path.join(__dirname, 'prijs-meetlat', 'meetlat.js'), '--vastleggen'], { stdio: 'ignore' });

  console.log('2/6  nieuwe waarden in data/prijsconfig.json…');
  const nieuw = { ...oud, ...Object.fromEntries(wijzigingen), _gewijzigd: new Date().toISOString().slice(0, 10) + ' — ' + wijzigingen.map(([k, v]) => `${k}=${v}`).join(', ') };
  fs.writeFileSync(CFG, JSON.stringify(nieuw, null, 2));

  console.log('3/6  kopie in sonty-website bijwerken…');
  fs.copyFileSync(CFG, CFG_WEB);

  let terugdraaien = () => {
    fs.writeFileSync(CFG, JSON.stringify(oud, null, 2));
    fs.copyFileSync(CFG, CFG_WEB);
  };

  try {
    console.log('5/6  controleren of alles exact meebeweegt…');
    const uit = run(process.execPath, [path.join(__dirname, 'prijs-meetlat', 'verhoging-check.js')]);
    console.log(uit.split('\n').filter((l) => /systeem|^\w|✅|❌|═/.test(l)).join('\n'));

    console.log('6/6  controleren of er nergens een los getal staat…');
    run(process.execPath, [path.join(__dirname, 'tests', 'geen-losse-opslagen.js')]);
    console.log('     geen losse opslagen');
  } catch (e) {
    console.log('\n' + (e.stdout || '') + (e.stderr || ''));
    terugdraaien();
    console.log('\n❌ CONTROLE GEFAALD — alles teruggedraaid, er is niets gewijzigd.');
    process.exit(1);
  }

  if (!ECHT) {
    terugdraaien();
    console.log('\n✅ PROEF GESLAAGD — alles teruggedraaid. Draai opnieuw met --echt om het door te voeren.');
    return;
  }

  console.log('4/6  Vercel KV bijwerken (die wint op de live website)…');
  const kvNieuw = await kv('zet', { sunmasterMarkup: nieuw.sunmasterMarkup });
  console.log('     KV nu: ' + JSON.stringify(kvNieuw));

  console.log('\n✅ DOORGEVOERD. Nog te doen:');
  console.log('   • sonty-website committen en pushen (Vercel bouwt dan opnieuw)');
  console.log('   • daarna: node scripts/prijs-meetlat/kruiscontrole-dagelijks.js');
}

main().catch((e) => { console.error('\ngestopt:', e.message); process.exit(1); });
