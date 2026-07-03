#!/usr/bin/env node
// AI-Klantenservice daemon — SCHADUWMODUS
// Pollt Trengo op nieuwe inkomende berichten (WA + Aanvragen/Klantenservice e-mail),
// laat de agent een concept-antwoord maken en plaatst dat als INTERNE NOTITIE bij het ticket.
// De klant ziet niets. Escalaties gaan óók naar Telegram.
//
// Draaien: node scripts/ai-ks/daemon.js            (één poll-ronde; zet in cron elke 5 min)
//          node scripts/ai-ks/daemon.js --ticket 963416960   (één specifiek ticket, voor test)
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');
const { beantwoord } = require('./agent.js');

const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };

async function tGet(ep) {
  const res = await fetch('https://app.trengo.com/api/v2' + ep, { headers: TH });
  if (!res.ok) return null;
  return res.json();
}
async function tPost(ep, body) {
  const res = await fetch('https://app.trengo.com/api/v2' + ep, { method: 'POST', headers: TH, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.text().catch(() => '') };
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(CFG.POLL_STATE_FILE, 'utf8')); } catch { return { verwerkt: {} }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(CFG.POLL_STATE_FILE), { recursive: true });
  fs.writeFileSync(CFG.POLL_STATE_FILE, JSON.stringify(s));
}
function log(entry) {
  fs.mkdirSync(path.dirname(CFG.LOG_FILE), { recursive: true });
  fs.appendFileSync(CFG.LOG_FILE, JSON.stringify({ tijd: new Date().toISOString(), ...entry }) + '\n');
}
async function telegram(text) {
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

const clean = b => (b || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function normPhone(p) {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('0031')) d = '31' + d.slice(4);
  if (d.startsWith('06') && d.length === 10) d = '31' + d.slice(1);
  if (d.startsWith('6') && d.length === 9) d = '31' + d;
  return d;
}

// Mag dit ticket een ÉCHT antwoord krijgen? Alleen als het contact-nummer exact op de
// whitelist staat. Dubbel gecheckt: hier én vlak voor verzending.
function isLiveTestContact(t) {
  const p = normPhone(t.contact?.phone);
  return !!p && CFG.TEST_LIVE_PHONES.includes(p);
}

async function sendLiveReply(t, tekst) {
  // Verdedigingslaag 2: nooit versturen als het nummer niet op de whitelist staat.
  if (!isLiveTestContact(t)) throw new Error('sendLiveReply geblokkeerd: contact staat niet op de live-test whitelist');
  if (!tekst || !tekst.trim()) throw new Error('sendLiveReply geblokkeerd: leeg antwoord');
  return tPost(`/tickets/${t.id}/messages`, { message: tekst, type: 'OUTBOUND' });
}

function isRelevantTicket(t) {
  if (t.channel?.id === CFG.WA_CHANNEL_ID || t.channel?.type === 'WA_BUSINESS') return true;
  return CFG.EMAIL_CHANNEL_NAMES.includes(t.channel?.title);
}

async function verwerkTicket(t, state) {
  const msgs = await tGet(`/tickets/${t.id}/messages`);
  const rows = (msgs?.data || []).map(m => ({
    van: m.type === 'INBOUND' ? 'klant' : 'sonty',
    tekst: clean(m.body || m.message),
    tijd: m.created_at,
    intern: !!m.internal_note || m.type === 'NOTE',
  })).filter(m => m.tekst && !m.intern);
  if (!rows.length) return;

  const laatste = rows[rows.length - 1];
  if (laatste.van !== 'klant') return; // alleen reageren als het laatste bericht van de klant is

  const sleutel = `${t.id}:${laatste.tijd}`;
  if (state.verwerkt[sleutel]) return; // al behandeld

  const gesprek = {
    kanaal: t.channel?.type === 'WA_BUSINESS' ? 'WA' : 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rows.slice(-25),
  };

  console.log(`Ticket ${t.id} (${gesprek.kanaal}, ${gesprek.klant.naam || 'onbekend'}): agent draait...`);
  const res = await beantwoord(gesprek);

  // Interne notitie samenstellen
  const acties = res.acties.length
    ? '\n\nActies die de AI zou uitvoeren:\n' + res.acties.map(a => '- ' + JSON.stringify(a)).join('\n')
    : '';

  const liveTest = isLiveTestContact(t);
  if (liveTest && res.antwoord) {
    // LIVE-TEST: alleen voor whitelist-nummers (Daimy's testnummer) — écht versturen
    const sendRes = await sendLiveReply(t, res.antwoord);
    console.log(`  → LIVE-TEST antwoord verstuurd naar ${t.contact?.phone}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status + ' ' + sendRes.body.substring(0, 200)}`);
    await tPost(`/tickets/${t.id}/notes`, { note: `🤖 AI-KS LIVE-TEST (whitelist ${t.contact?.phone})${acties}` });
    if (!sendRes.ok) await telegram(`⚠️ AI-KS live-test verzenden MISLUKT op ticket ${t.id}: ${sendRes.status} ${sendRes.body.substring(0, 200)}`);
  } else if (CFG.MODE === 'shadow') {
    const notitie = `🤖 AI-KLANTENSERVICE (schaduwmodus — NIET verstuurd)\n\nConcept-antwoord:\n${res.antwoord || '(geen antwoord — geëscaleerd)'}${acties}`;
    // Interne notitie op het ticket — team ziet het, klant niet
    const noteRes = await tPost(`/tickets/${t.id}/notes`, { note: notitie });
    if (!noteRes.ok) {
      // Fallback endpoint-vorm
      await tPost(`/tickets/${t.id}/messages`, { internal_note: true, body: notitie });
    }
  } else if (CFG.MODE === 'live') {
    // LIVE verzenden — pas actief als Daimy .live-enabled aanmaakt. Nog bewust niet geïmplementeerd.
    console.log('LIVE-modus nog niet vrijgegeven; er is niets verstuurd.');
  }

  const escalatie = res.acties.find(a => a.type === 'escalatie');
  if (escalatie) {
    await telegram(`⚠️ AI-KS escalatie (schaduw) — ticket ${t.id} (${gesprek.klant.naam || gesprek.klant.phone || gesprek.klant.email}):\n${escalatie.reden}\n\nLaatste klantbericht: ${laatste.tekst.substring(0, 300)}`);
  }

  state.verwerkt[sleutel] = { tijd: new Date().toISOString(), acties: res.acties.length };
  log({ ticket: t.id, kanaal: gesprek.kanaal, klant: gesprek.klant, laatsteKlantBericht: laatste.tekst.substring(0, 500), antwoord: res.antwoord, acties: res.acties, toolCalls: res.toolCalls, usage: res.usage, mode: CFG.MODE });
  console.log(`  → notitie geplaatst (${res.acties.length} acties, ${res.toolCalls.length} tool-calls)`);
}

async function pollRonde(state, { onlyTest }) {
  const specificTicket = process.argv.includes('--ticket') ? process.argv[process.argv.indexOf('--ticket') + 1] : null;

  let tickets = [];
  if (specificTicket) {
    const t = await tGet(`/tickets/${specificTicket}`);
    if (t) tickets = [t.data || t];
  } else {
    // Open tickets van de relevante kanalen, eerste 3 pagina's (nieuwste eerst)
    for (let page = 1; page <= 3; page++) {
      const data = await tGet(`/tickets?page=${page}`);
      const rows = (data?.data || []).filter(t => t.status === 'OPEN' && isRelevantTicket(t));
      tickets.push(...rows);
      if (!data?.links?.next) break;
    }
  }

  // --only-test: ALLEEN whitelist-tickets aanraken; alle andere volledig negeren (ook geen notities)
  if (onlyTest) tickets = tickets.filter(isLiveTestContact);

  console.log(`[${new Date().toLocaleTimeString()}] AI-KS (${CFG.MODE.toUpperCase()}${onlyTest ? ', ONLY-TEST' : ''}): ${tickets.length} kandidaat-tickets`);
  for (const t of tickets) {
    try { await verwerkTicket(t, state); }
    catch (e) { console.error(`Ticket ${t.id} FOUT:`, e.message); log({ ticket: t.id, fout: String(e.message || e) }); }
    saveState(state);
  }
  // State beperken tot laatste 2000 entries
  const keys = Object.keys(state.verwerkt);
  if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete state.verwerkt[k];
  saveState(state);
}

(async () => {
  const state = loadState();
  const onlyTest = process.argv.includes('--only-test');
  const watchIdx = process.argv.indexOf('--watch');
  const watchMin = watchIdx >= 0 ? parseInt(process.argv[watchIdx + 1] || '60', 10) : 0;

  if (watchMin > 0) {
    console.log(`Watch-modus: elke 30s pollen, ${watchMin} minuten lang${onlyTest ? ' (alleen whitelist-nummers)' : ''}.`);
    const tot = Date.now() + watchMin * 60000;
    while (Date.now() < tot) {
      await pollRonde(state, { onlyTest });
      await new Promise(r => setTimeout(r, 30000));
    }
    console.log('Watch-venster afgelopen.');
  } else {
    await pollRonde(state, { onlyTest });
    console.log('Klaar.');
  }
})();
