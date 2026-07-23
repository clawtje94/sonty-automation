#!/usr/bin/env node
// Dagrapport tickets (opdracht Daimy 23-07): elke ochtend een telling over GISTEREN —
// hoeveel tickets volledig door de AI zijn geholpen en hoeveel naar team Mens nodig gingen.
// Bron: data/ai-ks/log.jsonl (elke AI-interactie, WhatsApp + mail). Draait 08:15 (launchd).
const fs = require('fs');
const path = require('path');
const SECRETS = require('/Users/clawdboot/sonty/scripts/secrets.js');

const LOG = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'log.jsonl');

const gisteren = new Date(Date.now() - 86400000).toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 10);
const regels = fs.readFileSync(LOG, 'utf8').trim().split('\n')
  .map((r) => { try { return JSON.parse(r); } catch { return null; } })
  .filter((r) => r && String(r.tijd || '').startsWith(gisteren));

const geholpen = new Set(), escalatie = new Set();
for (const r of regels) {
  if ((r.acties || []).some((a) => a.type === 'escalatie')) escalatie.add(r.ticket);
  else if (r.antwoord && r.antwoord !== 'GEEN_BERICHT') geholpen.add(r.ticket);
}
for (const t of escalatie) geholpen.delete(t); // eerst geholpen, later toch escalatie => telt als Mens nodig

const wa = regels.filter((r) => !r.email).length;
const mail = regels.filter((r) => r.email).length;
const totaal = geholpen.size + escalatie.size;
const pct = totaal ? Math.round((geholpen.size / totaal) * 100) : 0;

const tekst = `📊 Tickets gisteren (${gisteren}):\n` +
  `• Volledig door de AI geholpen: ${geholpen.size}\n` +
  `• Naar team Mens nodig: ${escalatie.size}\n` +
  `• AI-aandeel: ${pct}%\n` +
  `• Interacties: ${regels.length} (WhatsApp ${wa}, mail ${mail})`;

console.log(tekst);
fetch(`https://api.telegram.org/bot${SECRETS.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: SECRETS.TELEGRAM_CHAT_ID, text: tekst }),
}).then((r) => console.log('telegram:', r.ok)).catch((e) => console.log('telegram-fout:', e.message));
