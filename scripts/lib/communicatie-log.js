// COMMUNICATIE-LOGBOEK (Daimy 04-09-2026): elk bericht aan een klant vanaf de Mac wordt hier gemeld, lokaal in
// data/communicatie-log.jsonl én naar de website (/api/communicatie, admin) voor /admin/communicatie. Fire-and-forget.
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, '..', '..', 'data', 'communicatie-log.jsonl');
function meld(e) {
  const entry = { op: new Date().toISOString(), bron: 'mac', ...e, tekst: e.tekst ? String(e.tekst).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600) : undefined };
  try { fs.appendFileSync(LOG, JSON.stringify(entry) + '\n'); } catch { /* log is best effort */ }
  try {
    const SECRETS = require('../secrets.js');
    fetch('https://sonty-website.vercel.app/api/communicatie', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD }, body: JSON.stringify({ log: [entry] }), signal: AbortSignal.timeout(8000) }).catch(() => {});
  } catch { /* geen website: lokaal blijft staan */ }
  return entry;
}
module.exports = { meld, LOG };
