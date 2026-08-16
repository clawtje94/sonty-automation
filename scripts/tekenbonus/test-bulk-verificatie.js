// BULK-VERIFICATIE V9-guard (vraag Daimy: "weten we 100000% zeker dat akkoord-klanten
// nooit een bonus-mail krijgen?"). Adversarieel: we voeren ALLE bekende akkoord-klanten
// als kandidaat aan de guard en tellen hoeveel er (fout) doorheen zouden komen.
// Bronnen: RP-items op stop-status (60 dgn), alle inmeet-boekingen, alle getekend-gemeld.
const fs = require('fs');
const CFG = require('/Users/clawdboot/sonty/scripts/ai-ks/config.js');
const { magBenaderd } = require('/Users/clawdboot/sonty/scripts/tekenbonus/mag-benaderd.js');
const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const STOP = new Set(['2e9819bd-26f0-4082-8f18-32bb48f87f54', 'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846', '2082ad8a-517c-4e24-8c0f-a5be69b1588a']);

(async () => {
  const items = (await (await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`, { headers: H })).json()).items || [];
  const D60 = Date.now() - 60 * 86400000;
  const testset = new Map(); // itemId -> bron

  for (const i of items) {
    if (STOP.has(i.status_id) && i.timestamp_updated > D60) testset.set(i.id, 'stop-status');
  }
  const boek = JSON.parse(fs.readFileSync('/Users/clawdboot/sonty/data/inmeet-boekingen.json', 'utf8'));
  for (const id of Object.keys(boek)) if (!testset.has(id)) testset.set(id, 'boeking');
  // getekend-gemeld: documentId -> item via klantnaam-match op summary (best effort, alleen extra dekking)
  const getekend = JSON.parse(fs.readFileSync('/Users/clawdboot/sonty/data/getekend-gemeld.json', 'utf8'));
  let getekendGevonden = 0;
  for (const g of Object.values(getekend)) {
    const naam = String(g.klant || '').toLowerCase().trim();
    if (!naam) continue;
    const it = items.find((i) => String(i.summary || '').toLowerCase().trim() === naam);
    if (it && !testset.has(it.id)) { testset.set(it.id, 'getekend-gemeld'); getekendGevonden++; }
  }
  console.log(`testset: ${testset.size} akkoord-dossiers (stop-status/boeking/getekend; +${getekendGevonden} via getekend-lijst)`);

  let geweigerd = 0; const doorgelaten = [];
  let n = 0;
  for (const [id, bron] of testset) {
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    n++;
    const r = await magBenaderd(item, items, { zonderTrengo: true }); // Trengo-laag overslaan: scheelt 500+ API-calls en is een EXTRA laag bovenop wat we hier testen
    if (r.mag === false) geweigerd++;
    else doorgelaten.push({ naam: item.summary, id: id.slice(0, 8), bron });
    if (n % 50 === 0) console.log(`  ...${n} gedaan`);
  }
  console.log(`\nRESULTAAT: ${geweigerd} van ${n} geweigerd`);
  if (doorgelaten.length) {
    console.log('DOORGELATEN (FOUT):');
    for (const d of doorgelaten) console.log(' -', d.naam, d.id, d.bron);
  } else {
    console.log('0 doorgelaten. Geen enkele akkoord-klant zou een mail krijgen.');
  }
})();
