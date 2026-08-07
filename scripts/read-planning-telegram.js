#!/usr/bin/env node
// Lezer voor @PlanningSontyBOT (Daimy 07-08: alle planning via de nieuwe bot).
// getUpdates met offset-state; nieuwe berichten komen in planning-inbox.txt én op
// stdout. Zelfde patroon als de andere lezers: draai dit bij elk nieuw bericht.
const fs = require('fs');
const path = require('path');

const CONFIG_PAD = path.join(__dirname, '..', 'data', 'telegram-planning.json');
const OFFSET_PAD = path.join(__dirname, '..', 'data', 'planning-tg-offset.json');
const INBOX = path.join(__dirname, '..', 'planning-inbox.txt');

let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_PAD, 'utf8')); } catch {
  console.log('(planning-bot nog niet ingericht — data/telegram-planning.json ontbreekt)');
  process.exit(0);
}

(async () => {
  let offset = 0;
  try { offset = JSON.parse(fs.readFileSync(OFFSET_PAD, 'utf8')).offset || 0; } catch { /* eerste keer */ }
  const r = await fetch(`https://api.telegram.org/bot${config.token}/getUpdates?offset=${offset}&timeout=2`);
  const d = await r.json();
  if (!d.ok) { console.log('planning-bot fout:', JSON.stringify(d).slice(0, 120)); process.exit(1); }
  const nieuw = [];
  for (const u of d.result || []) {
    offset = Math.max(offset, u.update_id + 1);
    const m = u.message;
    if (!m?.text) continue;
    const regel = `[${new Date(m.date * 1000).toISOString()}] ${m.from?.first_name || '?'}: ${m.text}`;
    nieuw.push(regel);
    fs.appendFileSync(INBOX, regel + '\n');
  }
  fs.writeFileSync(OFFSET_PAD, JSON.stringify({ offset }));
  if (nieuw.length) { console.log(`${nieuw.length} nieuw(e) planning-bericht(en):`); nieuw.forEach((r2) => console.log('  ' + r2)); }
  else {
    const staart = fs.existsSync(INBOX) ? fs.readFileSync(INBOX, 'utf8').trim().split('\n').slice(-3) : [];
    console.log('(geen nieuwe planning-berichten' + (staart.length ? ` — laatste ${staart.length}:\n  ` + staart.join('\n  ') : ')'));
  }
})();
