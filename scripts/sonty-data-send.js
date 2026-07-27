#!/usr/bin/env node
// Stuurt een bericht via de Sonty DATA-bot (@Sontydatabot).
// Gebruik: node scripts/sonty-data-send.js "tekst"   of   ... --file rapport.txt
// Chat_id komt uit .sonty-data-chat.json (gevuld door tools/sonty-data-poll.js zodra
// Daimy de bot voor het eerst aanspreekt). Telegram staat niet toe dat een bot zelf een
// gesprek opent, dus zonder dat eerste bericht kan er niets verstuurd worden.
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '7775843600:AAHsz7X9ypMXxzQLquoMW1bVf037-WRsEeU';
const CHAT_FILE = path.join(__dirname, '..', '.sonty-data-chat.json');
const TELEGRAM_FALLBACK_IP = '149.154.167.220';
const MAX = 3900; // Telegram-limiet is 4096; marge voor de code-fence

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
let tekst;
if (fileIdx >= 0) tekst = fs.readFileSync(args[fileIdx + 1], 'utf8');
else tekst = args.filter(a => !a.startsWith('--')).join(' ');
const alsCode = args.includes('--code');

if (!tekst || !tekst.trim()) {
  console.error('geen tekst opgegeven');
  process.exit(1);
}

let chats = [];
try { chats = (JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8')).chats || []); } catch {}
if (!chats.length) {
  console.error('Nog geen chat_id bekend voor de data-bot.');
  console.error('Daimy moet eerst /start sturen naar @Sontydatabot; de poller legt het id dan vast.');
  process.exit(2);
}

function verstuur(chatId, deel) {
  const body = JSON.stringify({
    chat_id: chatId,
    text: alsCode ? '```\n' + deel + '\n```' : deel,
    parse_mode: alsCode ? 'Markdown' : undefined,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: TELEGRAM_FALLBACK_IP, port: 443, path: `/bot${TOKEN}/sendMessage`, method: 'POST',
      headers: { Host: 'api.telegram.org', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false, timeout: 20000,
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { const j = JSON.parse(d); j.ok ? resolve(j) : reject(new Error(j.description)); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end(body);
  });
}

// Opsplitsen op regelgrenzen zodat tabellen niet middenin een rij worden afgekapt.
function knip(t) {
  const delen = []; let huidig = '';
  for (const regel of t.split('\n')) {
    if ((huidig + regel + '\n').length > MAX) { if (huidig) delen.push(huidig); huidig = ''; }
    huidig += regel + '\n';
  }
  if (huidig.trim()) delen.push(huidig);
  return delen;
}

(async () => {
  const delen = knip(tekst);
  for (const c of chats) {
    for (let i = 0; i < delen.length; i++) {
      await verstuur(c.id, delen.length > 1 ? `(${i + 1}/${delen.length})\n${delen[i]}` : delen[i]);
    }
    console.log(`verstuurd naar ${c.id} (${c.username || c.naam}) in ${delen.length} deel(en)`);
  }
})().catch(e => { console.error('fout:', e.message); process.exit(1); });
