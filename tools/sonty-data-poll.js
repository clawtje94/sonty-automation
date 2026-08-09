// Polling-daemon voor de Sonty DATA-bot (@Sontydatabot) — apart van de gewone Sonty-bot.
// Alles in deze bot gaat per definitie over Sonty-data (conversie, omzet, offertes,
// afkomst, productgroepen). Nieuwe berichten komen in sonty-data-inbox.txt.
//
// Het chat_id staat NIET hardcoded: een bot mag geen gesprek starten, dus het eerste
// bericht van Daimy bepaalt het chat_id. Dat wordt weggeschreven naar .sonty-data-chat.json
// zodat de zender (scripts/sonty-data-send.js) hem daarna kan gebruiken.
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '7775843600:AAHsz7X9ypMXxzQLquoMW1bVf037-WRsEeU';
const INBOX_FILE = path.join(__dirname, '..', 'sonty-data-inbox.txt');
const STATE_FILE = path.join(__dirname, '..', '.sonty-data-state.json');
const CHAT_FILE = path.join(__dirname, '..', '.sonty-data-chat.json');
const POLL_INTERVAL = 5000;
// Zelfde fallback-IP als de gewone poller: DNS-resolved IP is hier soms onbereikbaar.
const TELEGRAM_FALLBACK_IP = '149.154.167.220';

let lastUpdateId = 0;
if (fs.existsSync(STATE_FILE)) {
  try { lastUpdateId = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).lastUpdateId || 0; } catch {}
}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify({ lastUpdateId }));

function bekendeChats() {
  try { return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8')); } catch { return { chats: [] }; }
}
function onthoudChat(chat, from) {
  const st = bekendeChats();
  if (!st.chats.some(c => c.id === chat.id)) {
    st.chats.push({
      id: chat.id,
      naam: [from.first_name, from.last_name].filter(Boolean).join(' ') || chat.title || '',
      username: from.username || chat.username || '',
      type: chat.type,
    });
    fs.writeFileSync(CHAT_FILE, JSON.stringify(st, null, 2));
    console.log(`nieuw chat_id vastgelegd: ${chat.id} (${st.chats[st.chats.length - 1].username || 'geen username'})`);
  }
}

function getUpdates() {
  const urlPath = `/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30&allowed_updates=["message"]`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: TELEGRAM_FALLBACK_IP, port: 443, path: urlPath, method: 'GET',
      headers: { Host: 'api.telegram.org' }, rejectUnauthorized: false, timeout: 40000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function appendMessage(text, wie) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  fs.appendFileSync(INBOX_FILE, `[${ts}] ${wie}: ${text}\n`);
  console.log(`NIEUW van ${wie}: ${text}`);
}

async function poll() {
  const data = await getUpdates();
  if (!data.ok || !data.result || !data.result.length) return;
  for (const u of data.result) {
    if (u.update_id > lastUpdateId) lastUpdateId = u.update_id;
    const m = u.message;
    if (!m || !m.chat || (m.from && m.from.is_bot)) continue;
    onthoudChat(m.chat, m.from || {});
    let text = m.text || '[geen tekst]';
    if (m.photo && m.photo.length) {
      text = `[foto file_id:${m.photo[m.photo.length - 1].file_id}]`;
      if (m.caption) text += ` ${m.caption}`;
    }
    if (m.document) text = `[document ${m.document.file_name} file_id:${m.document.file_id}]${m.caption ? ' ' + m.caption : ''}`;
    appendMessage(text, (m.from && m.from.first_name) || 'onbekend');
  }
  saveState();
}

(async () => {
  console.log('Sonty data-bot poller gestart ->', INBOX_FILE);
  while (true) {
    try {
      await poll();
    } catch (err) {
      // Netwerkhikjes horen bij long-polling (Telegram verbreekt de verbinding na
      // een tijdje). Daar hoefde nooit een herstart voor: de poller lag daardoor
      // steeds even stil en berichten van Joris kwamen te laat binnen (08-08).
      // Alleen bij een ECHTE fout afsluiten zodat launchd vers opstart.
      const netwerk = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|timeout/i.test(err.message || '');
      console.error('poll-fout:', err.message, netwerk ? '(netwerkhikje, gewoon doorgaan)' : '(afsluiten voor herstart)');
      if (!netwerk) process.exit(1);
      await new Promise((r) => setTimeout(r, 5000));
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
})();
