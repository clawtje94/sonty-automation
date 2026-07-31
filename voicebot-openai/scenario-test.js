// Scenario-run voor Bas op OpenAI Realtime (tekstmodus via WebSocket, zelfde model/brein).
// node scenario-test.js
const fs = require('fs');
const path = require('path');
const { MODEL_DEFAULT, leesInstructies, TOOLS, prijsBerekenen, kennisbankOpzoeken } = require('./bas-config');

const ROOT = __dirname;
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const MODEL = process.env.BAS_REALTIME_MODEL || MODEL_DEFAULT;

const BEURTEN = [
  'Hoi, ik wil graag weten wat een rolluik kost.',
  'Twee meter breed en twee meter hoog, elektrisch graag. Doe maar die stevige uitvoering.',
  'En hoeveel garantie krijg ik eigenlijk?',
  'Kan ik ook op zaterdag bij jullie in de showroom terecht?',
  'Wat voor doek zit er eigenlijk op zo\'n zonnescherm, kan ik kleuren kiezen?',
  'Ik heb vorige week al een offerte van jullie gekregen, kan die honderd euro goedkoper?',
  'Nee hoor, verder niks. Bedankt, doei!',
];

const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, {
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
});

let wachters = [];
function wachtOp(type) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout wachtend op ${type}`)), 90000);
    wachters.push({ type, resolve: (m) => { clearTimeout(t); resolve(m); } });
  });
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'error') console.log('[API-ERROR]', JSON.stringify(msg.error || msg));
  wachters = wachters.filter((w) => {
    if (w.type === msg.type) { w.resolve(msg); return false; }
    return true;
  });
};
ws.onerror = (e) => { console.log('[WS-ERROR]', e.message || e); process.exit(1); };

async function beurt(tekst) {
  console.log(`\nKLANT: ${tekst}`);
  ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: tekst }] } }));
  ws.send(JSON.stringify({ type: 'response.create' }));
  for (;;) {
    const done = await wachtOp('response.done');
    const status = done.response && done.response.status;
    if (status === 'failed') {
      const err = ((done.response.status_details || {}).error) || {};
      if (err.code === 'rate_limit_exceeded') {
        const m = /try again in ([\d.]+)s/.exec(err.message || '');
        const wacht = m ? Math.ceil(Number(m[1])) + 2 : 15;
        console.log(`(rate limit, ${wacht}s wachten en opnieuw...)`);
        await new Promise((r) => setTimeout(r, wacht * 1000));
        ws.send(JSON.stringify({ type: 'response.create' }));
        continue;
      }
      console.log('FAILED:', JSON.stringify(done.response.status_details).slice(0, 400));
      break;
    }
    const out = (done.response && done.response.output) || [];
    let toolGedaan = false;
    for (const item of out) {
      if (item.type === 'message') {
        const t = (item.content || []).filter((c) => c.type === 'output_text' || c.type === 'text').map((c) => c.text).join(' ');
        if (t) console.log(`BAS:   ${t}`);
      } else if (item.type === 'function_call') {
        const args = JSON.parse(item.arguments || '{}');
        console.log(`TOOL:  ${item.name} ${JSON.stringify(args)}`);
        if (item.name === 'end_call') { console.log('TOOL:  (gesprek zou hier ophangen)'); continue; }
        let uit;
        if (item.name === 'prijs_berekenen') uit = await prijsBerekenen(args);
        else if (item.name === 'kennisbank_opzoeken') uit = { resultaat: kennisbankOpzoeken(args.vraag) };
        else uit = { error: 'onbekende tool' };
        console.log(`TOOL:  → ${JSON.stringify(uit).slice(0, 160)}`);
        ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(uit) } }));
        toolGedaan = true;
      }
    }
    if (!toolGedaan) break;
    ws.send(JSON.stringify({ type: 'response.create' }));
  }
}

(async () => {
  await wachtOp('session.created');
  ws.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', output_modalities: ['text'], instructions: leesInstructies(), tools: TOOLS } }));
  await wachtOp('session.updated');
  const tok = Math.round(leesInstructies().length / 4);
  console.log(`Verbonden met ${MODEL}, sessie geconfigureerd (~${tok} tokens instructies).`);
  for (const b of BEURTEN) await beurt(b);
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
