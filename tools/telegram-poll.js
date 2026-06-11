// Telegram polling daemon — draait op achtergrond en schrijft nieuwe berichten naar een bestand
// Claude checkt dit bestand periodiek

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT_ID = '1700128390';
const INBOX_FILE = path.join(__dirname, '..', 'telegram-inbox.txt');
const POLL_INTERVAL = 5000; // 5 seconden

let lastUpdateId = 0;

// Lees laatste update_id uit bestand als het bestaat
const STATE_FILE = path.join(__dirname, '..', '.telegram-state.json');
if (fs.existsSync(STATE_FILE)) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    lastUpdateId = state.lastUpdateId || 0;
  } catch (e) {}
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastUpdateId }));
}

// Fallback IP voor als DNS-resolved IP (149.154.166.110) niet bereikbaar is
const TELEGRAM_FALLBACK_IP = '149.154.167.220';

function getUpdates() {
  const urlPath = `/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: TELEGRAM_FALLBACK_IP,
      port: 443,
      path: urlPath,
      method: 'GET',
      headers: { 'Host': 'api.telegram.org' },
      rejectUnauthorized: false,
      timeout: 40000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

async function poll() {
  console.log(`[telegram-poll] Started. Polling every ${POLL_INTERVAL/1000}s. Inbox: ${INBOX_FILE}`);

  while (true) {
    try {
      const data = await getUpdates();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          const msg = update.message;
          if (!msg || msg.from.is_bot) continue;

          lastUpdateId = update.update_id;
          saveState();

          const timestamp = new Date(msg.date * 1000).toISOString();
          const text = msg.text || msg.caption || (msg.photo ? '[foto]' : msg.sticker ? '[sticker]' : msg.voice ? '[spraakbericht]' : msg.document ? `[bestand: ${msg.document.file_name || 'onbekend'}]` : '[geen tekst]');
          const line = `[${timestamp}] ${msg.from.first_name}: ${text}\n`;

          // Download voice/audio berichten
          if (msg.voice || msg.audio) {
            const fileId = (msg.voice || msg.audio).file_id;
            try {
              const fileData = await getUpdates(); // reuse connection pattern
              const fileUrl = `https://${TELEGRAM_FALLBACK_IP}/bot${TOKEN}/getFile?file_id=${fileId}`;
              const fileReq = await new Promise((resolve, reject) => {
                const req = https.request({ hostname: TELEGRAM_FALLBACK_IP, port: 443, path: `/bot${TOKEN}/getFile?file_id=${fileId}`, headers: { 'Host': 'api.telegram.org' }, rejectUnauthorized: false }, (res) => {
                  let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
                }); req.on('error', reject); req.end();
              });
              if (fileReq.ok && fileReq.result.file_path) {
                const dlPath = `/file/bot${TOKEN}/${fileReq.result.file_path}`;
                const voiceDir = path.join(__dirname, '..', 'voice-messages');
                if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });
                const ext = fileReq.result.file_path.split('.').pop() || 'ogg';
                const outFile = path.join(voiceDir, `voice-${Date.now()}.${ext}`);
                const dlReq = https.request({ hostname: TELEGRAM_FALLBACK_IP, port: 443, path: dlPath, headers: { 'Host': 'api.telegram.org' }, rejectUnauthorized: false }, (res) => {
                  const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
                    fs.writeFileSync(outFile, Buffer.concat(chunks));
                    console.log(`[telegram-poll] Voice saved: ${outFile}`);
                    fs.appendFileSync(INBOX_FILE, `[${timestamp}] ${msg.from.first_name}: [spraakbericht opgeslagen: ${outFile}]\n`);
                  });
                }); dlReq.on('error', e => console.error('[telegram-poll] Voice download error:', e.message)); dlReq.end();
              }
            } catch (e) { console.error('[telegram-poll] Voice error:', e.message); }
          }

          // Append naar inbox bestand
          fs.appendFileSync(INBOX_FILE, line);
          console.log(`[telegram-poll] Nieuw bericht: ${text}`);
        }
      }
    } catch (e) {
      console.error(`[telegram-poll] Error: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

poll();
