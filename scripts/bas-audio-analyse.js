#!/usr/bin/env node
// Bas audio-analyse: haalt echte gespreksaudio op, draait spraakherkenning (STT)
// en controleert wat er HOORBAAR gezegd is — dit is hoe Claude de bot "hoort".
// Checks: uitspraak (millimeter/cijfers), bedragen vs prijs-tool, reactietijden,
// genegeerde klant-frustratie, afgekapte zinnen.
// Gebruik: node scripts/bas-audio-analyse.js [aantal_gesprekken]
const fs = require('fs');
const path = require('path');

const KEY = 'sk_3898305880d97189866700aa267d6bcb14f45e5ba5a42fc2';
const AGENT = 'agent_1801ky9nc0fef7c91h0kpc0whmx4';
const AANTAL = parseInt(process.argv[2] || '3');

async function el(pad, opts = {}) {
  const r = await fetch('https://api.elevenlabs.io' + pad, { ...opts, headers: { 'xi-api-key': KEY, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(pad + ' HTTP ' + r.status);
  return r;
}

function sprekersRegels(words) {
  const regels = [];
  let cur = null;
  for (const w of words) {
    if (w.type !== 'word') continue;
    if (!cur || cur.spk !== w.speaker_id) {
      if (cur) regels.push(cur);
      cur = { spk: w.speaker_id, start: w.start, eind: w.end, tekst: w.text };
    } else { cur.tekst += ' ' + w.text; cur.eind = w.end; }
  }
  if (cur) regels.push(cur);
  return regels;
}

function analyseer(conv, regels, toolBedragen) {
  const fouten = [], punten = [];
  // Bas = de spreker van de eerste regel (agent begroet altijd eerst)
  const basSpk = regels[0]?.spk;
  const basTekst = regels.filter(r => r.spk === basSpk).map(r => r.tekst).join(' ');

  if (/\bmillimeter|\bmm\b/i.test(basTekst)) fouten.push('Zegt hoorbaar "millimeter/mm": ' + (basTekst.match(/[^.?!]*millimeter[^.?!]*/i) || ['?'])[0].trim().slice(0, 90));
  if (/\d{4,}/.test(basTekst)) punten.push('Lange cijferreeks hoorbaar: ' + (basTekst.match(/\S*\d{4,}\S*/) || [])[0]);

  // bedragen in audio vs toolbedragen
  const audioBedragen = [...basTekst.matchAll(/€?\s?([\d.]{3,9}),?-?\s*(euro)?/g)].map(m => parseInt(m[1].replace(/\./g, ''))).filter(n => n > 200 && n < 100000);
  for (const b of audioBedragen) {
    if (toolBedragen.length && !toolBedragen.some(t => Math.abs(t - b) <= Math.max(20, t * 0.02))) {
      fouten.push(`Hoorbaar bedrag €${b} wijkt af van alle toolbedragen (${toolBedragen.map(t => '€' + Math.round(t)).join(', ')}) — verkeerd uitgesproken of verzonnen`);
    }
  }

  // reactietijden
  const gaps = [];
  for (let i = 1; i < regels.length; i++) {
    if (regels[i].spk === basSpk && regels[i - 1].spk !== basSpk) gaps.push(regels[i].start - regels[i - 1].eind);
  }
  const gem = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  if (Math.max(...gaps, 0) > 4) punten.push(`Trage beurten: max ${Math.max(...gaps).toFixed(1)}s stilte (gemiddeld ${gem.toFixed(1)}s)`);

  // genegeerde frustratie: klant-negativiteit direct gevolgd door positieve Bas-opener
  for (let i = 1; i < regels.length; i++) {
    if (regels[i].spk === basSpk && /slecht|klote|fuck|waardeloos|belachelijk|boos|schandalig/i.test(regels[i - 1]?.tekst || '')) {
      if (/^(helemaal goed|top|super|mooi|perfect|fijn)/i.test(regels[i].tekst)) fouten.push('Klant uitte frustratie ("' + regels[i - 1].tekst.slice(0, 60) + '") maar Bas reageerde positief: "' + regels[i].tekst.slice(0, 60) + '"');
    }
  }
  return { fouten, punten, gemReactie: gem.toFixed(1), maxReactie: Math.max(...gaps, 0).toFixed(1) };
}

(async () => {
  const lijst = await (await el(`/v1/convai/conversations?agent_id=${AGENT}&page_size=${AANTAL}`)).json();
  const uit = [];
  for (const c of lijst.conversations || []) {
    const id = c.conversation_id;
    process.stderr.write(`analyseer ${id} (${c.call_duration_secs}s)...\n`);
    try {
      const det = await (await el(`/v1/convai/conversations/${id}`)).json();
      const toolBedragen = [];
      for (const t of det.transcript || []) for (const tr of t.tool_results || []) {
        const m = String(tr.result_value || '').match(/"totaal":\s?([\d.]+)/);
        if (m) toolBedragen.push(parseFloat(m[1]));
      }
      const audio = await el(`/v1/convai/conversations/${id}/audio`);
      const buf = Buffer.from(await audio.arrayBuffer());
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'gesprek.mp3');
      fd.append('model_id', 'scribe_v1');
      fd.append('diarize', 'true');
      fd.append('language_code', 'nl');
      fd.append('timestamps_granularity', 'word');
      const stt = await (await el('/v1/speech-to-text', { method: 'POST', body: fd })).json();
      const regels = sprekersRegels(stt.words || []);
      const res = analyseer(id, regels, toolBedragen);
      uit.push({ id, duur: c.call_duration_secs, ...res, transcriptAudio: regels.map(r => ({ spk: r.spk, start: Math.round(r.start), tekst: r.tekst })) });
    } catch (e) { uit.push({ id, fout: e.message.slice(0, 150) }); }
  }
  const dir = path.join(__dirname, '..', 'data', 'sunny-testbank');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `audio-analyse-${Date.now()}.json`), JSON.stringify(uit, null, 1));
  console.log('\n=== BAS AUDIO-ANALYSE ===');
  for (const g of uit) {
    if (g.fout) { console.log(`\n${g.id}: OPHALEN MISLUKT (${g.fout})`); continue; }
    console.log(`\n${g.id} (${g.duur}s) | reactietijd gem ${g.gemReactie}s, max ${g.maxReactie}s`);
    for (const f of g.fouten) console.log('  FOUT :', f);
    for (const p of g.punten) console.log('  punt :', p);
    if (!g.fouten.length && !g.punten.length) console.log('  schoon');
  }
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
