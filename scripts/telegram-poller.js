const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT_ID = 1700128390;
const INBOX_FILE = path.join(__dirname, 'telegram-inbox.txt');
const STATE_FILE = path.join(__dirname, 'telegram-offset.txt');
const POLL_INTERVAL = 5000; // 5 seconds

function getOffset() {
  try {
    return parseInt(fs.readFileSync(STATE_FILE, 'utf8').trim()) || 0;
  } catch { return 0; }
}

function saveOffset(offset) {
  fs.writeFileSync(STATE_FILE, String(offset));
}

function appendMessage(text) {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const line = `[${timestamp}] ${text}\n`;
  fs.appendFileSync(INBOX_FILE, line);
  console.log(`NEW: ${text}`);
}

async function poll() {
  const offset = getOffset();
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30&allowed_updates=["message"]`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      let maxId = offset;
      for (const update of data.result) {
        if (update.update_id >= offset) {
          maxId = Math.max(maxId, update.update_id + 1);
        }
        if (update.message && update.message.chat.id === CHAT_ID && !update.message.from.is_bot) {
          let text = update.message.text || '[geen tekst]';
          // Foto's: bewaar het file_id van de grootste variant zodat een
          // sessie hem via getFile kan downloaden (anders alleen "[foto]").
          if (update.message.photo && update.message.photo.length) {
            const grootste = update.message.photo[update.message.photo.length - 1];
            text = `[foto file_id:${grootste.file_id}]`;
            if (update.message.caption) text += ` ${update.message.caption}`;
          }
          appendMessage(text);
        }
      }
      saveOffset(maxId);
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

async function run() {
  console.log('Telegram poller gestart. Berichten worden opgeslagen in:', INBOX_FILE);
  // Clear inbox for fresh start
  fs.writeFileSync(INBOX_FILE, '');

  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

run();
