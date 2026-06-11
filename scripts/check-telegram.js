// Check for new Telegram messages
// Does NOT consume messages - they stay available until ack-telegram.js is called
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT_ID = 1700128390;
const INBOX_FILE = path.join(__dirname, 'telegram-inbox.txt');

(async () => {
  // Use timeout=2 for quick check
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=2`;
  const res = await fetch(url);
  const data = await res.json();

  const messages = [];
  if (data.ok) {
    for (const u of data.result) {
      if (u.message && u.message.chat.id === CHAT_ID && !u.message.from.is_bot) {
        const t = u.message.text || '[geen tekst]';
        const ts = new Date(u.message.date * 1000).toISOString().slice(0, 19).replace('T', ' ');
        messages.push({ id: u.update_id, ts, text: t });
      }
    }
  }

  if (messages.length === 0) {
    console.log('(geen nieuwe berichten)');
  } else {
    // Save to inbox file
    const lines = messages.map(m => `[${m.ts}] ${m.text}`).join('\n') + '\n';
    fs.writeFileSync(INBOX_FILE, lines);
    // Print to console
    messages.forEach(m => console.log(`[${m.ts}] ${m.text}`));
    console.log(`\n${messages.length} bericht(en). Run 'node scripts/ack-telegram.js' om te markeren als gelezen.`);
  }
})();
