// Mark all current Telegram messages as read (consume them)
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';

(async () => {
  // Get current updates to find highest update_id
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=1`);
  const data = await res.json();

  if (data.ok && data.result.length > 0) {
    const maxId = Math.max(...data.result.map(u => u.update_id));
    // Set offset to maxId + 1 to consume all
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${maxId + 1}&timeout=1`);
    console.log(`${data.result.length} berichten gemarkeerd als gelezen.`);
  } else {
    console.log('Geen berichten om te markeren.');
  }
})();
