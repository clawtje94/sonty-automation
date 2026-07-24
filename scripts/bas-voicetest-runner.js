#!/usr/bin/env node
// Bas voice-testrunner: voert echte gesprekken met de ElevenLabs-agent waarbij Bas
// ECHT spreekt (audio wordt server-side opgenomen). De klant praat via tekst
// (haiku-simulator). Daarna kan bas-audio-analyse.js de opnames "terugluisteren".
// Gebruik: node scripts/bas-voicetest-runner.js [aantal] [offset] [parallel]
const fs = require('fs');
const path = require('path');
const WebSocket = require(path.join(process.env.HOME, 'sonty-website', 'node_modules', 'ws'));

const AKEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
const AGENT = 'agent_1801ky9nc0fef7c91h0kpc0whmx4';
const AANTAL = parseInt(process.argv[2] || '10');
const OFFSET = parseInt(process.argv[3] || '0');
const PARALLEL = parseInt(process.argv[4] || '3');
const MAX_TOTAAL_SEC = 150 * 60; // veiligheidsplafond belminuten

const VRAGEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sunny-testvragen-uitgebreid.json'), 'utf8'));

async function haiku(system, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': AKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, system, messages }),
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 120));
  return j.content.filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
}

function gesprek(tc, idx) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT}`);
    const klantSysteem = `Je bent een Nederlandse klant die Sonty (zonwering) belt. Doel: ${tc.vraag}.${tc.persona ? ' Karakter: ' + tc.persona + '.' : ''} Praat kort en natuurlijk (1-2 zinnen). Maximaal 1 vervolgvraag, daarna afronden. Antwoord alleen met wat je zegt; als je klaar bent antwoord exact EINDE`;
    const klantMsgs = [];
    let convId = null, beurten = 0, laatsteAgent = '', bezig = false, klaarTimer = null;
    const start = Date.now();
    const stop = (reden) => {
      clearTimeout(klaarTimer);
      try { ws.close(); } catch {}
      resolve({ idx, convId, duurSec: Math.round((Date.now() - start) / 1000), beurten, reden });
    };
    const totaalTimeout = setTimeout(() => stop('timeout'), 150000);

    async function klantBeurt() {
      if (bezig) return; bezig = true;
      try {
        klantMsgs.push({ role: 'user', content: 'De assistent zei: "' + laatsteAgent.slice(0, 500) + '". Wat zeg jij? (of EINDE)' });
        const tekst = await haiku(klantSysteem, klantMsgs);
        klantMsgs.push({ role: 'assistant', content: tekst });
        if (/^EINDE/i.test(tekst) || beurten >= 3) { clearTimeout(totaalTimeout); setTimeout(() => stop('klaar'), 4000); return; }
        beurten++;
        ws.send(JSON.stringify({ type: 'user_message', text: tekst }));
      } catch (e) { clearTimeout(totaalTimeout); stop('klantfout: ' + e.message.slice(0, 80)); }
      bezig = false;
    }

    ws.on('open', () => ws.send(JSON.stringify({ type: 'conversation_initiation_client_data' })));
    ws.on('message', (raw) => {
      let d; try { d = JSON.parse(raw); } catch { return; }
      if (d.type === 'ping') { ws.send(JSON.stringify({ type: 'pong', event_id: d.ping_event?.event_id })); return; }
      if (d.type === 'conversation_initiation_metadata') { convId = d.conversation_initiation_metadata_event?.conversation_id; return; }
      if (d.type === 'agent_response') {
        laatsteAgent = d.agent_response_event?.agent_response || '';
        // wacht tot de audio grotendeels gegenereerd is voor natuurlijke pacing
        clearTimeout(klaarTimer);
        klaarTimer = setTimeout(klantBeurt, Math.min(2000 + laatsteAgent.length * 30, 9000));
      }
    });
    ws.on('error', (e) => { clearTimeout(totaalTimeout); stop('ws-fout: ' + e.message.slice(0, 80)); });
    ws.on('close', () => { clearTimeout(totaalTimeout); resolve({ idx, convId, duurSec: Math.round((Date.now() - start) / 1000), beurten, reden: 'gesloten' }); });
  });
}

(async () => {
  const cases = VRAGEN.slice(OFFSET, OFFSET + AANTAL);
  const uit = [];
  let totaalSec = 0;
  for (let i = 0; i < cases.length; i += PARALLEL) {
    if (totaalSec > MAX_TOTAAL_SEC) { console.error('VEILIGHEIDSPLAFOND belminuten bereikt, stop bij', i); break; }
    const batch = cases.slice(i, i + PARALLEL).map((tc, k) => gesprek(tc, OFFSET + i + k));
    const res = await Promise.all(batch);
    for (const r of res) { uit.push(r); totaalSec += r.duurSec || 0; }
    process.stderr.write(`[${Math.min(i + PARALLEL, cases.length)}/${cases.length}] totaal ${Math.round(totaalSec / 60)} min\n`);
  }
  const dir = path.join(__dirname, '..', 'data', 'sunny-testbank');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `voicerun-${Date.now()}.json`), JSON.stringify(uit, null, 1));
  console.log(`\nVOICERUN KLAAR: ${uit.length} gesprekken, ${Math.round(totaalSec / 60)} belminuten, ${uit.filter(r => r.convId).length} opgenomen`);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
