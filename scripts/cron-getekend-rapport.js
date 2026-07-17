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
    // Harde aantallen die Daimy dagelijks wil (17 juli): hoeveel geholpen, hoeveel wilden akkoord,
    // hoeveel overtuigd vanuit twijfel, hoeveel afspraken. Haiku classificeert per gesprek en geeft JSON.
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': APIKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content:
          `Hieronder staan ${perTicket.size} AI-klantenservicegesprekken van Sonty (zonwering) van de afgelopen dag. Beoordeel ALLEEN op basis van wat er echt staat (niets verzinnen) en geef UITSLUITEND geldige JSON terug in dit formaat:\n` +
          `{\n  "geholpen": <aantal gesprekken waarin de AI de klant echt inhoudelijk verder heeft geholpen>,\n  "akkoord_inmeten": <aantal klanten dat AKKOORD is gegaan met de opdracht. LET OP: een klant die doorgezet is naar "inmeten inplannen" is per definitie akkoord — tel akkoord en inmeten dus als ÉÉN ding, elke klant maximaal 1x. NIET dubbeltellen>,\n  "showroom": <aantal klanten dat een SHOWROOMbezoek heeft afgesproken of daarnaar verwezen is. Dit staat LOS van akkoord: iemand komt naar de showroom om nog te beslissen>,\n  "overtuigd": <aantal twijfelaars dat de AI over de streep trok (subset van geholpen; alleen wie eerst duidelijk twijfelde op prijs/keuze)>,\n  "overtuigd_details": ["Klantnaam — in 1 zin hoe (alternatief/downgrade/uitleg/korting)"],\n  "samenvatting": "max 8 regels kwalitatief: aangeboden alternatieven, opvallende punten of gemiste kansen. Gebruik klantnamen als die er staan."\n}\n` +
          `Belangrijk tegen scheve data: akkoord_inmeten en showroom zijn aparte uitkomsten — tel een klant niet in beide. Geef alleen de JSON, geen tekst eromheen.\n\n${digest}` }],
      }),
    });
    const j = await resp.json();
    let raw = j?.content?.[0]?.text || '';
    let stats = null;
    try { stats = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch {}

    // Cumulatief totaal bijhouden zodat Daimy ook "totaal tot nu toe" ziet
    const STATS_FILE = path.join(__dirname, '..', 'data', 'ai-ks', 'conversie-stats.json');
    let cum = { geholpen: 0, akkoord_inmeten: 0, showroom: 0, overtuigd: 0, dagen: 0 };
    try { cum = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch {}

    if (stats) {
      cum.geholpen += stats.geholpen || 0;
      cum.akkoord_inmeten += stats.akkoord_inmeten || 0;
      cum.showroom += stats.showroom || 0;
      cum.overtuigd += stats.overtuigd || 0;
      cum.dagen = (cum.dagen || 0) + 1;
      fs.writeFileSync(STATS_FILE, JSON.stringify(cum, null, 1));

      const details = (stats.overtuigd_details || []).length ? '\n\nOvertuigd:\n' + stats.overtuigd_details.map(d => '• ' + d).join('\n') : '';
      await telegram(
        `🤖 AI-resultaten afgelopen dag (${perTicket.size} gesprekken gevoerd):\n\n` +
        `• Geholpen: ${stats.geholpen ?? '?'}\n` +
        `• Akkoord (= inmeten inplannen): ${stats.akkoord_inmeten ?? '?'}\n` +
        `• Showroomafspraken (los): ${stats.showroom ?? '?'}\n` +
        `• Waarvan overtuigd vanuit twijfel: ${stats.overtuigd ?? '?'}\n` +
        details +
        (stats.samenvatting ? `\n\n${stats.samenvatting}` : '') +
        `\n\n📊 Totaal tot nu toe (${cum.dagen} dagen): ${cum.geholpen} geholpen, ${cum.akkoord_inmeten} akkoord, ${cum.showroom} showroom, ${cum.overtuigd} overtuigd.`
      );
    } else {
      await telegram(`🤖 AI-resultaten: ${perTicket.size} gesprekken gevoerd (aantallen-classificatie mislukt: ${JSON.stringify(j).slice(0, 100)}).`);
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
