#!/usr/bin/env node
// Handjes voor een Claude-sessie (of mens) om met het BREIN te praten. Gebruik:
//   node scripts/brein-sessie.js meld   <naam> "<taak>" [cse_id] — aanmelden / taak zetten (bij sessiestart; cse_id = Claude-Session-id uit je systeemprompt)
//   node scripts/brein-sessie.js status <naam> "<status>"      — bezig | wacht-op-daimy | klaar | "<vrije tekst>"
//   node scripts/brein-sessie.js klaar  <naam>                 — afmelden
//   node scripts/brein-sessie.js postvak <naam>                — nieuwe opdrachten tonen (en op 'gelezen' zetten)
//   node scripts/brein-sessie.js antwoord <opdracht-id> "<tekst>" — opdracht afronden met antwoord (komt op /admin/brein)
//   node scripts/brein-sessie.js log <naam> "<wat>"            — gebeurtenis in de tijdlijn
//   node scripts/brein-sessie.js opdracht <aan> "<tekst>"      — (voor Daimy/mens/andere sessie) opdracht geven
//   node scripts/brein-sessie.js wie                           — overzicht collega's
// Een sessie wordt wakker via de Monitor op data/brein/inbox-<naam>.txt (tail -f).
const B = require('./lib/brein.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
/** Welke Claude-sessie voert dit commando uit? Zonder env-variabele: het transcript dat NU wordt geschreven
 *  (meest recent gewijzigde .jsonl onder ~/.claude/projects). */
function huidigeSessionId(cse) {
  if (process.env.CLAUDE_SESSION_ID) return process.env.CLAUDE_SESSION_ID;
  // Betrouwbaarst: de sessie geeft haar Claude-Session-id (cse_…, staat in haar systeemprompt) mee;
  // het transcript bevat een regel {"type":"bridge-session","bridgeSessionId":"cse_…"}.
  if (cse && /^cse_/.test(cse)) {
    const root = path.join(os.homedir(), '.claude', 'projects');
    try {
      for (const map of fs.readdirSync(root)) {
        let files = []; try { files = fs.readdirSync(path.join(root, map)); } catch { continue; }
        for (const f of files) {
          if (!f.endsWith('.jsonl')) continue;
          const p = path.join(root, map, f);
          if (Date.now() - fs.statSync(p).mtimeMs > 6 * 3600000) continue;
          const kop = fs.readFileSync(p, 'utf8').slice(0, 20000);
          if (kop.includes(`"bridgeSessionId":"${cse}"`)) return f.replace('.jsonl', '');
        }
      }
    } catch { /* geen transcripten */ }
  }
  const root = path.join(os.homedir(), '.claude', 'projects');
  let best = null;
  try {
    for (const map of fs.readdirSync(root)) {
      let files = []; try { files = fs.readdirSync(path.join(root, map)); } catch { continue; }
      for (const f of files) { if (!f.endsWith('.jsonl')) continue; const st = fs.statSync(path.join(root, map, f)); if (!best || st.mtimeMs > best.m) best = { m: st.mtimeMs, id: f.replace('.jsonl', '') }; }
    }
  } catch { /* geen transcripten */ }
  return best && Date.now() - best.m < 5000 ? best.id : null; // alleen als hij NU schrijft (dit commando)
}
const [, , cmd, a, b] = process.argv;

function toon(x) { console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 1)); }
switch (cmd) {
  case 'meld': toon(B.meld(a, { taak: b || '', sessionId: huidigeSessionId(process.argv[5]) })); break;
  case 'status': toon(B.meld(a, { status: b || 'bezig' })); break;
  case 'klaar': B.afmelden(a); toon('afgemeld: ' + a); break;
  case 'postvak': {
    const lijst = B.opdrachtenVoor(a);
    if (!lijst.length) { toon('(geen nieuwe opdrachten voor ' + a + ')'); break; }
    for (const o of lijst) { B.markeer(o.id, 'gelezen'); toon(`OPDRACHT ${o.id} (${o.op.slice(0, 16)} van ${o.van}):\n${o.tekst}\n`); }
    break;
  }
  case 'antwoord': toon(B.markeer(a, 'klaar', b || '') || 'onbekende opdracht ' + a); break;
  case 'log': toon(B.gebeurtenis(a, b || '')); break;
  case 'opdracht': toon(B.nieuweOpdracht({ aan: a, tekst: b || '', van: process.env.USER || 'mens' })); break;
  case 'wie': {
    const s = B.sessies();
    for (const k of Object.keys(s)) toon(`${s[k].status.padEnd(14)} ${k.padEnd(24)} ${s[k].taak.slice(0, 70)}  (laatst ${s[k].laatst.slice(11, 16)})`);
    break;
  }
  default: console.error('gebruik: meld|status|klaar|postvak|antwoord|log|opdracht|wie'); process.exit(1);
}
