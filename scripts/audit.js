// Centraal audit-log voor alle automatisering: elke actie die een bot naar buiten doet
// (mail, sheet-wijziging, offerte, afspraak, Telegram) hoort hier één regel te krijgen.
// Gebruik: const { audit } = require('./audit.js');
//          audit('planning-mail', 'sheet-rij-toegevoegd', { rij: 1410, ordernr: '1208307' });
// Log: ~/sonty/logs/audit.jsonl — één JSON-object per regel, append-only.
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', 'logs', 'audit.jsonl');

function audit(systeem, actie, details = {}) {
  try {
    const regel = JSON.stringify({
      tijd: new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }),
      systeem, actie, ...details,
    });
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, regel + '\n');
  } catch {} // audit-loggen mag nooit het echte werk breken
}

module.exports = { audit };
