#!/usr/bin/env node
/**
 * SLOT OP DE ENE PLEK — faalt zodra er ergens weer een losse prijsopslag in de code staat.
 *
 * Op 2026-08-03 stonden de opslagen op 14 plekken. Ze zijn samengevoegd naar
 * data/prijsconfig.json. Zonder deze test sluipt er over een half jaar weer eentje in
 * en zijn we terug bij af — precies zoals het de vorige keer is gegroeid.
 *
 * Deze test draait mee in de pre-check van run-v4-safe.sh, dus v4 weigert te starten met
 * code waarin de opslag weer verspreid staat.
 *
 * Draait alleen-lezen over de bronbestanden.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WEBSITE = path.join(ROOT, '..', 'sonty-website');

// De bestanden waar prijzen berekend worden. Alleen dáár is een los getal een probleem;
// in rapportages of eenmalige correctiescripts mag het.
const BEWAAKT = [
  [ROOT, 'scripts/cron-offerte-controle-v4-combined.js'],
  [ROOT, 'scripts/ai-ks/v4-pricing.js'],
  [ROOT, 'scripts/ai-ks/roma-pricing.js'],
  [ROOT, 'scripts/roma-duo-offerte.js'],
  [ROOT, 'scripts/cron-prijs-steekproef.js'],
  [WEBSITE, 'lib/offerte-tool/pricing.ts'],
  [WEBSITE, 'lib/offerte-tool/prijsconfig.ts'],   // KV-defaults: stonden 2026-08-26 nog op 1,10/1,15 en wonnen live van de JSON
  [WEBSITE, 'lib/configurator/pricing.ts'],
];

// De getallen die een opslag zíjn. 1.21 staat erbij omdat de markiezenfactor (btw + opslag)
// anders stilletjes op de kale btw blijft staan als iemand hem terugzet.
// Ook de kleurpercentages: die stonden hardcoded in v4 (0.15/0.20) terwijl de website ze
// al uit de config las. Gevonden 2026-08-03 bij de boekcontrole van p51.
const VERDACHT = /(?<![\d.])1\.(?:1|10|15|20|21|25|30|31)(?![\d])|(?<![\d.])0\.(?:15|20|2)(?![\d])/;

/** Regels die geen code zijn of waar het getal onschuldig is. */
function magWel(regel) {
  const t = regel.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;   // commentaar
  if (/INGEBAKKEN_MARKUP\s*=/.test(t)) return true;   // gedocumenteerde historische waarde in de tabellen
  if (/prijsconfig|PRIJSCONFIG|rekenConfig/.test(t)) return true;                    // leest juist de config
  return false;
}

let fouten = 0;
for (const [basis, rel] of BEWAAKT) {
  const p = path.join(basis, rel);
  if (!fs.existsSync(p)) { console.log(`  ?  ${rel} — niet gevonden, overgeslagen`); continue; }
  const regels = fs.readFileSync(p, 'utf8').split('\n');
  const raak = [];
  regels.forEach((r, i) => { if (VERDACHT.test(r) && !magWel(r)) raak.push({ nr: i + 1, r: r.trim().slice(0, 100) }); });
  if (raak.length) {
    fouten += raak.length;
    console.log(`\n❌ ${rel}`);
    for (const x of raak) console.log(`   regel ${x.nr}: ${x.r}`);
  } else {
    console.log(`  ✓  ${rel}`);
  }
}

// De twee kopieën van de config moeten identiek zijn; ze staan los in beide repo's.
const a = path.join(ROOT, 'data', 'prijsconfig.json');
const b = path.join(WEBSITE, 'data', 'prijsconfig.json');
if (fs.existsSync(a) && fs.existsSync(b)) {
  if (fs.readFileSync(a, 'utf8') !== fs.readFileSync(b, 'utf8')) {
    fouten++;
    console.log('\n❌ data/prijsconfig.json verschilt tussen sonty en sonty-website');
    console.log('   De website rekent dan met andere opslagen dan v4 en de bot.');
  } else {
    console.log('  ✓  prijsconfig.json identiek in beide repo\'s');
  }
} else { fouten++; console.log('\n❌ prijsconfig.json ontbreekt in een van beide repo\'s'); }

console.log('\n' + '─'.repeat(60));
if (fouten) {
  console.log(`❌ ${fouten} losse prijsopslagen gevonden. Zet ze in data/prijsconfig.json.`);
  process.exit(1);
}
console.log('✅ Geen losse prijsopslagen — alles komt uit data/prijsconfig.json');
