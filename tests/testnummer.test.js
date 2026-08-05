#!/usr/bin/env node
/**
 * REGRESSIETEST testnummer (Daimy 2026-08-05).
 *
 * In scripts/ab1-activeren.js en scripts/ai-ks/reminder-template-wacht.js stond +31643473757 als
 * "testnummer van Daimy". Dat nummer bleek van Nikki Lutz te zijn, een echte klant met een eigen
 * dossier in Reuzenpanda. Zij kreeg daardoor twee testberichten: een prijsindicatie van 3.496 euro
 * die niet van haar was, aangesproken als "Daimy". Ze antwoordde "Ik ga niet akkoord".
 *
 * Daimy 2026-08-05: "+31683500506 is het enige testnummer wat je mag gebruiken."
 *
 * Deze test bewaakt twee dingen:
 *  1. het centrale testnummer klopt en staat op de live-whitelist;
 *  2. er staat nergens anders in de code een los telefoonnummer als testbestemming.
 *
 *   node tests/testnummer.test.js
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../scripts/ai-ks/config.js');

const HET_NUMMER = '+31683500506';
let fouten = 0;

console.log('Testnummer\n');

if (CFG.TESTNUMMER !== HET_NUMMER) {
  fouten++;
  console.log(`  FOUT: CFG.TESTNUMMER is ${JSON.stringify(CFG.TESTNUMMER)}, moet ${HET_NUMMER} zijn`);
} else console.log('  ok   het centrale testnummer klopt');

if (!CFG.TEST_LIVE_PHONES.includes(HET_NUMMER.replace(/\D/g, ''))) {
  fouten++;
  console.log('  FOUT: het testnummer staat niet op de live-whitelist, dan wordt verzenden alsnog geblokkeerd');
} else console.log('  ok   het staat op de live-whitelist');

// Scan de scripts op losse Nederlandse mobiele nummers. Alleen het centrale nummer en de
// whitelist mogen er staan; al het andere is een bestemming die niemand heeft gecontroleerd.
const TOEGESTAAN = new Set([HET_NUMMER.replace(/\D/g, ''), ...CFG.TEST_LIVE_PHONES]);
const VERDACHT = [];
function scan(dir, diep = 0) {
  if (diep > 2) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|dist|previews/.test(e.name)) scan(p, diep + 1); continue; }
    if (!e.name.endsWith('.js')) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const regel of src.split('\n')) {
      // Alleen regels die echt over een testbestemming gaan
      if (!/TESTNUMMER|recipient_phone|testnummer|naar Daimy/i.test(regel)) continue;
      if (/^\s*(\/\/|\*)/.test(regel)) continue;   // commentaar mag het oude nummer noemen als uitleg
      for (const m of regel.match(/\+?31\d{9}/g) || []) {
        const genormaliseerd = m.replace(/\D/g, '');
        if (!TOEGESTAAN.has(genormaliseerd)) {
          VERDACHT.push(`${p.replace(process.env.HOME, '~')}: ${regel.trim().slice(0, 90)}`);
        }
      }
    }
  }
}
scan(path.join(__dirname, '..', 'scripts'));

if (VERDACHT.length) {
  fouten += VERDACHT.length;
  console.log(`  FOUT: ${VERDACHT.length} regel(s) met een telefoonnummer dat geen goedgekeurd testnummer is:`);
  for (const v of VERDACHT) console.log(`     ${v}`);
} else console.log('  ok   nergens een los telefoonnummer als testbestemming');

console.log('');
if (fouten) { console.error(`GEFAALD: ${fouten} probleem(en). Een testbericht mag alleen naar ${HET_NUMMER}.`); process.exit(1); }
console.log(`GESLAAGD: testberichten kunnen alleen naar ${HET_NUMMER}.`);
