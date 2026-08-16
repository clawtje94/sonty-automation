#!/usr/bin/env node
// Dagelijkse opruimer van de tekenbonus-campagne (draait vóór de verzendrun):
//  - verstuurde bonus die inmiddels GETEKEND is → status "getekend" (meting)
//  - deadline verstreken zonder handtekening → bonusregel uit de offerte, originele
//    groepskorting exact terug, status "verlopen-opgeruimd"
// Coulance-afspraak Daimy: wie nét te laat tekent krijgt de bonus alsnog; daarom
// ruimen we pas op ná de deadline-DAG (23:59), niet op het uur.
const fs = require('fs');
const path = require('path');
const CFG = require('../ai-ks/config.js');
const { ruimOp } = require('./offerte-prep.js');
const { BONUS_LOG } = require('./mag-benaderd.js');

const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const TG = { token: '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40', chat: 1700128390 };
const telegram = (tekst) => fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: TG.chat, text: tekst.substring(0, 4000) }),
}).catch(() => {});

(async () => {
  if (!fs.existsSync(BONUS_LOG)) { console.log('geen log'); return; }
  const log = JSON.parse(fs.readFileSync(BONUS_LOG, 'utf8'));
  let getekend = 0, opgeruimd = 0; const fouten = [];
  for (const [docId, e] of Object.entries(log)) {
    if (e.status !== 'verstuurd') continue;
    let doc;
    try { doc = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations/${docId}`, { headers: H })).json(); }
    catch { continue; /* volgende run opnieuw */ }
    const status = String(doc?.quotationData?.quotationStatus || '');
    if (/ACCEPTED|SIGNED/i.test(status)) {
      e.status = 'getekend'; e.getekendGezienOp = new Date().toISOString(); getekend++;
      continue;
    }
    const eindeDag = new Date(e.deadline); eindeDag.setHours(23, 59, 59, 999);
    if (Date.now() > eindeDag.getTime()) {
      const r = await ruimOp(docId, e.origineleGroupDiscount).catch((err) => ({ fout: err.message }));
      if (r.getekend) { e.status = 'getekend'; getekend++; }
      else if (r.opgeruimd) { e.status = 'verlopen-opgeruimd'; e.opgeruimdOp = new Date().toISOString(); opgeruimd++; }
      else fouten.push(`${e.naam} (${e.nummer}): ${r.fout || 'onbekend'}`);
    }
  }
  fs.writeFileSync(BONUS_LOG, JSON.stringify(log, null, 1));
  console.log(`getekend: ${getekend} | opgeruimd: ${opgeruimd} | fouten: ${fouten.length}`);
  if (getekend || opgeruimd || fouten.length) {
    await telegram(`🧹 Tekenbonus-opruimer: ${getekend} getekend, ${opgeruimd} verlopen bonus(sen) uit offertes gehaald.${fouten.length ? '\n⚠️ ' + fouten.slice(0, 5).join('\n⚠️ ') : ''}`);
  }
})();
