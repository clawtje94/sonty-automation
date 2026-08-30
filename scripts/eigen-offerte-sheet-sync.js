#!/usr/bin/env node
// EIGEN OFFERTES → OFFERTE-REGISTER (Sheet). Vervangt de Zapier-zap "RP Offerte → Sheets" voor offertes uit het eigen CRM.
// Draait elke 10 min (launchd nl.sonty.eigen-offerte-sheet): haalt eigen offertes op die de laatste 45 dagen verstuurd zijn
// (/api/eigen-crm?verstuurd=45) en zet voor elke nieuwe een rij in de maandtab. Stand in data/eigen-offerte-sheet.json.
//   node scripts/eigen-offerte-sheet-sync.js            → schrijven
//   node scripts/eigen-offerte-sheet-sync.js --dry-run  → alleen tonen wat er zou gebeuren
// Eerste 3 echte rijen worden op Telegram gemeld zodat Daimy ze kan nakijken (regel "eerst 1, dan de rest").
const fs = require('fs');
const path = require('path');
const { schrijfOfferteRij } = require('./lib/sheet-eigen-offerte.js');
const E = require('./lib/eigen-crm.js');

const DRY = process.argv.includes('--dry-run');
const STAND = path.join(__dirname, '..', 'data', 'eigen-offerte-sheet.json');
const LOG = path.join(__dirname, '..', 'data', 'eigen-offerte-sheet.log');
const log = (t) => { const r = `[${new Date().toISOString()}] ${t}`; console.log(r); try { fs.appendFileSync(LOG, r + '\n'); } catch { /* geen log */ } };

async function telegram(tekst) {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const tok = (env.match(/TELEGRAM_BOT_TOKEN=["']?([^"'\n]+)/) || [])[1];
    if (!tok) return;
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: 1700128390, text: tekst }) });
  } catch { /* melding is best effort */ }
}

(async () => {
  if (!E.bronAan()) { log('vlag data/.eigen-crm-bron uit: niets doen'); return; }
  let stand = {};
  try { stand = JSON.parse(fs.readFileSync(STAND, 'utf8')); } catch { stand = {}; }
  const items = await E.verstuurd(45);
  let nieuw = 0;
  for (const it of items) {
    const s = it.sheet || {};
    if (!s.nummer) continue;
    if (stand[s.nummer] && stand[s.nummer].status === 'geschreven') continue;
    const res = await schrijfOfferteRij({ ...s, datum: s.datum }, { dryRun: DRY });
    log(`${s.nummer} ${res.naam || ''}: ${res.status}${res.tab ? ` (${res.tab} rij ${res.rij})` : ''}${res.melding ? ' ⚠️' : ''}`);
    if (DRY) continue;
    if (res.status === 'geschreven' || res.status === 'bestaat') stand[s.nummer] = { status: 'geschreven', tab: res.tab, rij: res.rij, op: new Date().toISOString(), naam: res.naam };
    if (res.status === 'geschreven') {
      nieuw++;
      const geteld = Object.values(stand).filter((x) => x.status === 'geschreven').length;
      if (geteld <= 3) await telegram(`Offerte-register: eigen offerte ${s.nummer} (${res.naam}) op ${res.tab} rij ${res.rij} gezet. Klopt de rij? Dit is nr ${geteld} van de eerste 3 die ik meld.`);
    }
    if (res.melding) await telegram(`⚠️ Offerte-register: ${s.nummer} (${res.naam}) NIET geschreven: ${res.status}${res.maand ? ' (' + res.maand + ')' : ''}. Handmatig toevoegen of tab aanmaken.`);
  }
  if (!DRY) fs.writeFileSync(STAND, JSON.stringify(stand, null, 2));
  log(`klaar: ${items.length} verstuurde eigen offertes, ${nieuw} nieuwe rij(en)`);
})().catch((e) => { log('FOUT ' + e.message); process.exit(1); });
