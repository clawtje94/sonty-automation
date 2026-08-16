// Dag-30-selectie voor de tekenbonus-test: dossiers op "Offerte verstuurd" met een
// offerte van 30-60 dagen oud en geen akkoord. Elke kandidaat gaat daarna nog door de
// volledige V9-guard (mag-benaderd.js). Draai los voor een proeflijst: node selectie.js [n]
const CFG = require('../ai-ks/config.js');
const { magBenaderd } = require('./mag-benaderd.js');
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const OV = '15c4f0be-c6bf-447d-bf5f-a233c482eb53';
const AI_OV = 'dc0efe4f-2cd6-45d8-aeff-7f1c817a0fb2';

// Testdossiers horen NOOIT in een klantmailing (eindcheck 16-08 ving 5 stuks:
// 3x Daimy Boot, FGC SONTY, Playwright Testklant). Interne mailadressen ook niet.
const TESTPATROON = /daimy|playwright|testklant|\btest\b|sonty|proefklant/i;

async function kandidaten(items) {
  const nu = Date.now();
  // MAX op 75 dagen (was 60): de cap bouwt de eerste weken op (warm-up), en zolang
  // de wachtrij wordt ingehaald mag niemand stilletjes uit de selectie verouderen.
  const MIN = 30 * 86400000, MAX = 75 * 86400000;
  return items.filter((i) =>
    (i.status_id === OV || i.status_id === AI_OV) &&
    nu - i.timestamp_created >= MIN && nu - i.timestamp_created <= MAX &&
    !(i.technical_labels || []).some((l) => l.type === 'ITEM_ARCHIVED') &&
    !TESTPATROON.test(i.summary || '') &&
    !/@sonty\.nl/i.test(i.description || ''));
}

if (require.main === module) {
  (async () => {
    const n = parseInt(process.argv[2] || '15', 10);
    const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`, { headers: H })).json()).items || [];
    const kand = await kandidaten(items);
    console.log(`kandidaten (30-60 dagen, offerte verstuurd, niet gearchiveerd): ${kand.length}`);
    console.log(`steekproef van ${n} door de volledige V9-guard:`);
    let ja = 0, nee = 0;
    const stap = Math.max(1, Math.floor(kand.length / n));
    for (let i = 0; i < kand.length && ja + nee < n; i += stap) {
      const r = await magBenaderd(kand[i], items);
      r.mag ? ja++ : nee++;
      console.log(`  ${r.mag ? 'JA ' : 'nee'} ${(kand[i].summary || '?').slice(0, 30).padEnd(30)} ${r.mag ? '' : '— ' + r.reden}`);
    }
    console.log(`steekproef: ${ja} mailbaar, ${nee} geweigerd`);
  })();
}
module.exports = { kandidaten };
