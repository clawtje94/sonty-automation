#!/usr/bin/env node
// Enige Telegram-zender voor medewerker-agents (alleen wie het in zijn profiel heeft, nu: Bram).
// Gebruik: node scripts/brein-telegram.js "<tekst>"  — kort, telefoon-leesbaar, max ~12 regels.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const tok = (env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m) || [])[1];
const chat = (env.match(/^TELEGRAM_CHAT_ID=(.+)$/m) || [])[1] || '1700128390';
const tekst = process.argv.slice(2).join(' ').trim();
if (!tok || !tekst) { console.error('token of tekst ontbreekt'); process.exit(1); }
// SCHADUWSTAND (Daimy 29-08: "team even in de schaduw draaien"): vlag data/brein/.schaduw → briefing bewaren voor de
// Dagstart-tab en in de tijdlijn zetten, maar NIET naar Telegram. Daimy leest alles in het Brein.
if (fs.existsSync(path.join(__dirname, '..', 'data', 'brein', '.schaduw'))) {
  const B = require('./lib/brein.js');
  try { const dir = path.join(B.DIR, 'briefings'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }) + '.txt'), tekst); } catch { /* best effort */ }
  B.gebeurtenis('Bram', 'SCHADUW: briefing alleen in het Brein gezet (niet naar Telegram): ' + tekst.slice(0, 80));
  console.log('schaduwstand: bewaard, niet verstuurd'); process.exit(0);
}
(async () => {
  for (let poging = 1; poging <= 3; poging++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: tekst.slice(0, 3900) }), signal: AbortSignal.timeout(15000) });
      const d = await r.json();
      if (d.ok) {
        console.log('verstuurd');
        try { fs.appendFileSync(path.join(__dirname, '..', 'logs', 'telegram-verzonden.log'), `[${new Date().toISOString()}] (hoofdchat/Bram) ${tekst.replace(/\n/g, ' | ').slice(0, 300)}\n`); } catch { /* log blokkeert nooit */ }
        const B = require('./lib/brein.js');
        B.gebeurtenis('Bram', 'Telegram-bericht aan Daimy: ' + tekst.slice(0, 80));
        // briefing bewaren voor de Dagstart-tab in het Brein
        try { const dir = path.join(B.DIR, 'briefings'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }) + '.txt'), tekst); } catch { /* best effort */ }
        return;
      }
      throw new Error(JSON.stringify(d).slice(0, 120));
    } catch (e) { if (poging === 3) { console.error('mislukt: ' + e.message); process.exit(1); } await new Promise((r) => setTimeout(r, 3000 * poging)); }
  }
})();
