#!/usr/bin/env node
/**
 * RESERVE-ROUTE VOOR 1-OP-1-ANTWOORDEN (19-08): zolang WhatsApp de directe berichten van
 * Sunny's gekoppelde sessie weigert (data/wa-dm-uit.txt), zet de luisteraar antwoorden in
 * data/wa-desktop-queue/. Dit script verstuurt ze via WhatsApp DESKTOP (officiële client,
 * bezorgt wel) met de bewezen UI-route, maar ALLEEN als het scherm ontgrendeld is en
 * Daimy minstens 2,5 minuut niks doet; anders volgende ronde (launchd elke 5 min).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const QUEUE = path.join(__dirname, '..', 'data', 'wa-desktop-queue');

function vergrendeld() {
  try {
    return execFileSync('osascript', ['-l', 'JavaScript', '-e',
      'ObjC.import("CoreGraphics"); const d = ObjC.deepUnwrap($.CGSessionCopyCurrentDictionary()); (d && d.CGSSessionScreenIsLocked) ? "1" : "0"'],
      { timeout: 20000 }).toString().trim() === '1';
  } catch { return true; }
}
function idle() {
  try { return Number(execFileSync('sh', ['-c', "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'"]).toString().trim()) || 0; }
  catch { return 0; }
}

(async () => {
  if (!fs.existsSync(QUEUE)) return;
  const items = fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json')).sort();
  if (!items.length) return;
  if (vergrendeld() || idle() < 150) { console.log(`wachtrij ${items.length}, geen vrij scherm; volgende ronde`); return; }
  let klaar = 0;
  for (const f of items) {
    const p = path.join(QUEUE, f);
    let taak;
    try { taak = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fs.unlinkSync(p); continue; }
    try {
      execFileSync('osascript', ['-l', 'JavaScript', path.join(__dirname, 'wa-stuur.jxa.js'), taak.doel, taak.tekst], { timeout: 240000 });
      fs.unlinkSync(p);
      klaar += 1;
      console.log('via Desktop bezorgd aan', taak.doel);
    } catch (e) {
      console.error('Desktop-route faalde voor', taak.doel, String(e.message).split('\n')[0].slice(0, 80));
      break; // scherm situatie kan veranderd zijn; volgende ronde opnieuw
    }
  }
  if (klaar) {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: `📨 ${klaar} wachtend(e) WhatsApp-antwoord(en) alsnog bezorgd via de reserve-route (WhatsApp Desktop).` }),
    }).catch(() => {});
  }
})();
