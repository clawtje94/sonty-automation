#!/usr/bin/env node
// Stuur tekst of foto naar Daimy (hoofdchat). Gebruik:
//   node scripts/telegram-stuur.js "tekst"
//   node scripts/telegram-stuur.js --foto pad.png "bijschrift"
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const g = k => (env.match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1];
const token = g('TELEGRAM_BOT_TOKEN'), chat = g('TELEGRAM_CHAT_ID');
const a = process.argv.slice(2);
(async () => {
  let r;
  if (a[0] === '--foto') {
    const fd = new FormData();
    fd.append('chat_id', chat);
    fd.append('photo', new Blob([fs.readFileSync(a[1])]), path.basename(a[1]));
    if (a[2]) fd.append('caption', a[2]);
    r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: fd });
  } else {
    r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: a[0] }) });
  }
  const j = await r.json(); console.log(j.ok ? 'verzonden' : 'FOUT ' + JSON.stringify(j));
})();
