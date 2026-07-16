#!/usr/bin/env node
// Dagelijks AI-resultatenrapport (vraag Daimy 2026-07-16): elke ochtend 08:35 op Telegram:
// 1) hoeveel mensen de afgelopen dag hun offerte hebben ondertekend (RP → ACCEPTED-diff);
// 2) wat de AI-klantenservice bereikte: twijfelaars overtuigd (en hoe: downgrade, alternatief,
//    uitleg), showroom-verwijzingen, dossiers doorgezet naar inmeten, aangeboden alternatieven.
//    Samengevat door Haiku (goedkoop) op basis van de echte gesprekslogs.
// Eerste run = nulmeting (bestaande ACCEPTED worden gemarkeerd, niet gemeld).
const fs = require('fs');
const path = require('path');

const KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BOARD = 'edb9b0b7-b70e-4064-95b5-ec0d03357c0a';
const B = 'https://backend.reuzenpanda.nl';
const H = { Authorization: 'Bearer ' + KEY };
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;
const STATE_FILE = path.join(__dirname, '..', 'data', 'getekend-gemeld.json');
const MAX_LEEFTIJD_DAGEN = 45; // alleen recente leads scannen (90d = 5500+ leads = ~1 uur; 45d houdt de run behapbaar)

async function rpGet(ep) {
  const r = await fetch(B + ep, { headers: H });
  if (!r.ok) throw new Error('RP ' + r.status + ' op ' + ep);
  return r.json();
}
async function telegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

(async () => {
  console.log('[' + new Date().toISOString() + '] Getekend-rapport start');
  let state;
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { state = { gemeld: {}, nulmeting: false }; }
  const eersteRun = !state.nulmeting;

  const items = (await rpGet(`/contact-service/${PID}/boards/${BOARD}/items`)).items || [];
  const cutoff = Date.now() - MAX_LEEFTIJD_DAGEN * 86400000;
  const recent = items.filter(i => i.item_subject?.id && i.timestamp_created > cutoff);

  const nieuw = [];
  let gescand = 0;
  for (const item of recent) {
    let docs;
    try {
      docs = (await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${item.item_subject.id}`)).quotationDatas || [];
    } catch { continue; }
    gescand++;
    for (const d of docs) {
      if (d.quotationStatus !== 'ACCEPTED') continue;
      if (state.gemeld[d.documentId]) continue;
      state.gemeld[d.documentId] = { nummer: d.quotationNumber, klant: item.summary, gemeld: new Date().toISOString() };
      if (!eersteRun) nieuw.push({ nummer: d.quotationNumber, klant: item.summary });
    }
    await new Promise(r => setTimeout(r, 150));
  }
  state.nulmeting = true;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
  console.log(`Gescand: ${gescand} leads | nieuw getekend: ${nieuw.length}${eersteRun ? ' (nulmeting)' : ''}`);

  if (eersteRun) {
    await telegram(`✍️ Tekenrapport is ingesteld. Nulmeting gedaan (${Object.keys(state.gemeld).length} eerder getekende offertes gemarkeerd); vanaf morgen zie je hier elke ochtend hoeveel mensen de afgelopen dag hebben getekend.`);
  } else if (!nieuw.length) {
    await telegram('✍️ Tekenrapport: de afgelopen dag heeft niemand een offerte ondertekend.');
  } else {
    await telegram(`✍️ Tekenrapport: ${nieuw.length} offerte(s) ondertekend de afgelopen dag! 🎉\n\n` +
      nieuw.map(n => `- ${n.klant} (offerte ${n.nummer})`).join('\n'));
  }

  // ---- Deel 2: wat bereikte de AI de afgelopen dag (twijfelaars, showroom, inmeten) ----
  try {
    const LOG = path.join(__dirname, '..', 'data', 'ai-ks', 'log.jsonl');
    const sinds = Date.now() - 24 * 3600000;
    const entries = fs.readFileSync(LOG, 'utf8').trim().split('\n')
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.antwoord && new Date(e.tijd).getTime() > sinds && (e.actief || e.sonny));
    if (!entries.length) {
      await telegram('🤖 AI-resultaten: de afgelopen dag geen AI-gesprekken gevoerd.');
      return;
    }
    // Compacte digest per gesprek voor de samenvatter
    const perTicket = new Map();
    for (const e of entries) {
      const arr = perTicket.get(e.ticket) || [];
      arr.push(`KLANT: ${(e.laatsteKlantBericht || e.teamOpdracht || '').slice(0, 200)}\nAI: ${(e.antwoord || '').slice(0, 300)}\nACTIES: ${(e.acties || []).map(a => a.type).join(',') || '-'}`);
      perTicket.set(e.ticket, arr);
    }
    const digest = [...perTicket.entries()].map(([tid, arr], i) => `## Gesprek ${i + 1} (ticket ${tid})\n${arr.join('\n---\n')}`).join('\n\n').slice(0, 150000);
    const APIKEY = fs.readFileSync(path.join(__dirname, '.anthropic-api-key.txt'), 'utf8').trim();
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content:
          `Hieronder staan de AI-klantenservicegesprekken van Sonty (zonwering) van de afgelopen dag. Vat voor de eigenaar kort en puntsgewijs samen, in het Nederlands, ALLEEN op basis van wat er echt staat (niets verzinnen):\n1. Twijfelaars overtuigd of verder geholpen: wie twijfelde (prijs/keuze) en met welke aanpak hielp de AI (goedkoper alternatief/downgrade, productuitleg, vergelijking)?\n2. Showroom/winkel: wie is naar de showroom verwezen of bevestigde een showroombezoek?\n3. Akkoord/inmeten: wie is doorgezet naar inmeten inplannen?\n4. Aangeboden alternatieven of aanpassingen aan offertes.\n5. Opvallend of gemiste kans (max 2).\nGebruik klantnamen als die er staan. Max 15 regels totaal, geen inleiding.\n\n${digest}` }],
      }),
    });
    const j = await resp.json();
    const tekst = j?.content?.[0]?.text;
    if (tekst) {
      await telegram(`🤖 AI-resultaten afgelopen dag (${perTicket.size} gesprekken):\n\n${tekst}`);
    } else {
      await telegram(`🤖 AI-resultaten: samenvatting mislukt (${JSON.stringify(j).slice(0, 120)}). Wel ${perTicket.size} gesprekken gevoerd.`);
    }
  } catch (e) {
    console.error('samenvatting FOUT:', e.message);
    await telegram('⚠️ AI-resultaten-samenvatting gecrasht: ' + e.message.slice(0, 150));
  }
})().catch(async (e) => {
  console.error('CRASH:', e.message);
  await telegram('⚠️ Getekend-rapport gecrasht: ' + e.message.slice(0, 200));
  process.exit(1);
});
