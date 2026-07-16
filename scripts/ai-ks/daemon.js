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

function isWaTicket(t) {
  return t.channel?.id === CFG.WA_CHANNEL_ID || t.channel?.type === 'WA_BUSINESS';
}

function isRelevantTicket(t) {
  if (isWaTicket(t)) return true;
  return CFG.EMAIL_CHANNEL_NAMES.includes(t.channel?.title);
}

// ---- SONNY: buiten openingstijden live voor ALLE WhatsApp-klanten (config.SONNY) ----
function loadSonnyState() {
  try { return JSON.parse(fs.readFileSync(CFG.SONNY.STATE_FILE, 'utf8')); } catch { return { introTickets: {}, dagTeller: {}, lastRapport: null }; }
}
function saveSonnyState(s) {
  fs.mkdirSync(path.dirname(CFG.SONNY.STATE_FILE), { recursive: true });
  fs.writeFileSync(CFG.SONNY.STATE_FILE, JSON.stringify(s));
}
function sonnyActiefNu() {
  return CFG.SONNY.enabled && CFG.isBuitenOpeningstijden();
}
// Credits op terwijl een klant op antwoord wacht = klantenservice staat stil → luid alarm.
// Dedupe 1x/uur via hetzelfde state-bestand als de 2-uurlijkse watchdog (check-anthropic-credits.js).
const CREDITS_STATE = path.join(path.dirname(CFG.SONNY.STATE_FILE), 'credits-state.json');
async function alertCreditsOp() {
  let s;
  try { s = JSON.parse(fs.readFileSync(CREDITS_STATE, 'utf8')); } catch { s = { status: 'ok', laatsteAlert: 0 }; }
  if (Date.now() - (s.laatsteAlert || 0) < 3600000) return;
  await telegram('🚨🚨 ANTHROPIC CREDITS OP — er wacht NU een klant op antwoord en de AI-klantenservice staat stil!\n\nBijladen: console.anthropic.com/settings/billing → Buy credits.');
  fs.writeFileSync(CREDITS_STATE, JSON.stringify({ status: 'op', laatsteAlert: Date.now() }));
}

async function sendSonnyReply(t, tekst) {
  // Eigen verdedigingslagen (los van de whitelist): alleen WhatsApp, alleen als Sonny
  // aan staat én het buiten openingstijden is, nooit leeg.
  if (!sonnyActiefNu()) throw new Error('sendSonnyReply geblokkeerd: Sonny niet actief (binnen openingstijden of .sonny-enabled ontbreekt)');
  if (!isWaTicket(t)) throw new Error('sendSonnyReply geblokkeerd: geen WhatsApp-ticket');
  if (!tekst || !tekst.trim()) throw new Error('sendSonnyReply geblokkeerd: leeg antwoord');
  return tPost(`/tickets/${t.id}/messages`, { message: tekst, type: 'OUTBOUND' });
}

async function verwerkTicket(t, state) {
  const msgs = await tGet(`/tickets/${t.id}/messages`);
  const rows = (msgs?.data || []).map(m => ({
    van: m.type === 'INBOUND' ? 'klant' : 'sonty',
    tekst: clean(m.body || m.message),
    tijd: m.created_at,
    intern: !!m.internal_note || m.type === 'NOTE',
  })).filter(m => m.tekst && !m.intern)
    .sort((a, b) => String(a.tijd).localeCompare(String(b.tijd))); // Trengo geeft nieuwste-eerst; wij willen oud → nieuw
  if (!rows.length) return;

  const laatste = rows[rows.length - 1];
  if (laatste.van !== 'klant') return; // alleen reageren als het laatste bericht van de klant is

  const sleutel = `${t.id}:${laatste.tijd}`;
  if (state.verwerkt[sleutel]) return; // al behandeld

  // FEEDBACK-KANAAL (Daimy 2026-07-16): "feedback: ..." in het WhatsApp-gesprek = leerpunt,
  // opslaan in data/ai-ks/leerpunten.md (gaat per direct mee in de systemprompt) en kort
  // bevestigen. ALLEEN de nummers van Daimy en Joey (CFG.FEEDBACK_PHONES) — Jarne en
  // klanten mogen de bot niet herprogrammeren.
  const feedbackMatch = laatste.tekst.match(/^\s*feedback\s*[:\-]\s*([\s\S]+)/i);
  if (feedbackMatch && CFG.FEEDBACK_PHONES.includes(normPhone(t.contact?.phone))) {
    const punt = feedbackMatch[1].trim();
    fs.appendFileSync(path.join(path.dirname(CFG.LOG_FILE), 'leerpunten.md'), `- (${new Date().toISOString().slice(0, 10)}) ${punt}\n`);
    log({ ticket: t.id, feedback: punt, klant: t.contact?.full_name || t.contact?.phone });
    try { await sendLiveReply(t, 'Feedback opgeslagen en direct actief. Vanaf mijn volgende antwoord doe ik het zo.'); } catch {}
    await telegram(`🎓 WhatsApp-feedback van ${t.contact?.full_name || t.contact?.phone} opgeslagen als leerpunt:\n"${punt.substring(0, 400)}"\n\n(Staat in data/ai-ks/leerpunten.md en zit per direct in de prompt.)`);
    state.verwerkt[sleutel] = { tijd: new Date().toISOString(), feedback: true };
    return;
  }

  // Debounce: wacht tot het laatste klantbericht ±45s oud is. Voorkomt dubbel antwoorden
  // als de klant meerdere berichten kort na elkaar stuurt (die pakken we dan in één keer mee).
  const leeftijdSec = (Date.now() - new Date(String(laatste.tijd).replace(' ', 'T'))) / 1000;
  if (isFinite(leeftijdSec) && leeftijdSec < 45) return; // volgende poll-ronde

  // SONNY: buiten openingstijden behandelen we WhatsApp-klanten live, eerlijk als AI.
  // Whitelist-testnummers krijgen ALTIJD de Sonny-persona (ook overdag, ook vóór de
  // aan-knop): dat is wat we testen en trainen (Daimy 2026-07-16).
  const sonnyMode = isWaTicket(t) && (sonnyActiefNu() || isLiveTestContact(t));
  const sonnyState = sonnyMode ? loadSonnyState() : null;
  const sonnyIntroNodig = sonnyMode && !sonnyState.introTickets[t.id];
  if (sonnyMode && sonnyIntroNodig && !isLiveTestContact(t)) {
    // Dagcap alleen voor NIEUWE gesprekken (lopende gesprekken maken we altijd af)
    const dag = CFG.amsterdamNu().datum;
    if ((sonnyState.dagTeller[dag] || 0) >= CFG.SONNY.MAX_GESPREKKEN_PER_DAG) {
      log({ ticket: t.id, sonny: true, overgeslagen: 'dagcap bereikt', klant: t.contact?.full_name || t.contact?.phone });
      state.verwerkt[sleutel] = { tijd: new Date().toISOString(), sonnyCap: true }; // team pakt het 's ochtends op
      return;
    }
  }

  const gesprek = {
    kanaal: t.channel?.type === 'WA_BUSINESS' ? 'WA' : 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rows.slice(-25),
    liveTest: isLiveTestContact(t) || sonnyMode, // actie-tools mogen echt uitvoeren
    sonny: sonnyMode,
    sonnyIntroNodig,
    ticketId: t.id,
  };

  console.log(`Ticket ${t.id} (${gesprek.kanaal}, ${gesprek.klant.naam || 'onbekend'}): agent draait...`);
  const res = await beantwoord(gesprek);

  // Interne notitie samenstellen
  const acties = res.acties.length
    ? '\n\nActies die de AI zou uitvoeren:\n' + res.acties.map(a => '- ' + JSON.stringify(a)).join('\n')
    : '';

  const liveTest = isLiveTestContact(t);
  if (sonnyMode && res.antwoord) {
    const antwoordTekst = (sonnyIntroNodig ? CFG.SONNY.INTRO + '\n\n' : '') + res.antwoord;
    // Rustig, menselijk tempo (±1-3 min)
    const d = Math.min(CFG.SONNY.DELAY.maxSec, Math.max(CFG.SONNY.DELAY.minSec, CFG.SONNY.DELAY.baseSec + res.antwoord.length * CFG.SONNY.DELAY.perCharSec));
    console.log(`  Sonny typ-vertraging ${Math.round(d)}s...`);
    await new Promise(r => setTimeout(r, d * 1000));
    const sendRes = liveTest ? await sendLiveReply(t, antwoordTekst) : await sendSonnyReply(t, antwoordTekst);
    console.log(`  → SONNY antwoord verstuurd naar ${t.contact?.phone}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status + ' ' + sendRes.body.substring(0, 200)}`);
    await tPost(`/tickets/${t.id}/notes`, { note: `🌙 SONNY (AI-avonddienst, buiten openingstijden) — live verstuurd${acties}` });
    if (!sendRes.ok) {
      await telegram(`⚠️ Sonny verzenden MISLUKT op ticket ${t.id}: ${sendRes.status} ${sendRes.body.substring(0, 200)}`);
    } else {
      if (sonnyIntroNodig) {
        sonnyState.introTickets[t.id] = new Date().toISOString();
        if (!liveTest) {
          const dag = CFG.amsterdamNu().datum;
          sonnyState.dagTeller[dag] = (sonnyState.dagTeller[dag] || 0) + 1;
        }
      }
      saveSonnyState(sonnyState);
    }
  } else if (liveTest && res.antwoord) {
    // Menselijke typ-vertraging (config REPLY_DELAY; uit tijdens test, aan bij livegang)
    if (CFG.REPLY_DELAY?.enabled) {
      const d = Math.min(CFG.REPLY_DELAY.maxSec, Math.max(CFG.REPLY_DELAY.minSec, CFG.REPLY_DELAY.baseSec + res.antwoord.length * CFG.REPLY_DELAY.perCharSec));
      console.log(`  typ-vertraging ${Math.round(d)}s...`);
      await new Promise(r => setTimeout(r, d * 1000));
    }
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
    const wie = gesprek.klant.naam || gesprek.klant.phone || gesprek.klant.email;
    if (escalatie.leervraag) {
      // Leervraag (instructie Daimy): vraag naar Telegram zodat het antwoord aangeleerd kan worden
      fs.appendFileSync(path.join(path.dirname(CFG.LOG_FILE), 'leervragen.jsonl'), JSON.stringify({ tijd: new Date().toISOString(), ticket: t.id, klant: wie, vraag: laatste.tekst.substring(0, 500), toelichtingAI: escalatie.reden, status: 'open' }) + '\n');
      await telegram(`🎓 LEERVRAAG van klant ${wie} (ticket ${t.id}):\n\n"${laatste.tekst.substring(0, 400)}"\n\nAI: ${escalatie.reden.substring(0, 400)}\n\nAntwoord hier op Telegram, dan leer ik het de AI aan en ${escalatie.stil ? 'beantwoorden we de klant (gesprek staat nog open)' : 'weet hij het voortaan zelf'}.`);
    } else {
      await telegram(`⚠️ AI-KS escalatie — ticket ${t.id} (${wie}):\n${escalatie.reden}\n\nLaatste klantbericht: ${laatste.tekst.substring(0, 300)}`);
    }
  }

  state.verwerkt[sleutel] = { tijd: new Date().toISOString(), acties: res.acties.length };
  log({ ticket: t.id, kanaal: gesprek.kanaal, klant: gesprek.klant, laatsteKlantBericht: laatste.tekst.substring(0, 500), antwoord: res.antwoord, acties: res.acties, toolCalls: res.toolCalls, usage: res.usage, mode: CFG.MODE, sonny: sonnyMode });
  console.log(`  → notitie geplaatst (${res.acties.length} acties, ${res.toolCalls.length} tool-calls)`);
}

// Pending offerte-creaties afronden: RP heeft ±5-7 min nodig om lead+offerte aan te maken;
// daarna vullen we de offerte met de echte producten, zetten de status en appen de link.
async function verwerkPendingOffertes() {
  const { loadPending, savePending } = require('./rp-offerte-create.js');
  const { pasOfferteAan, zetStatus } = require('./rp-offerte-edit.js');
  const pending = loadPending();
  const open = pending.filter(p => p.status === 'wachten');
  if (!open.length) return;

  const board = await (async () => {
    try {
      const res = await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/boards/${CFG.RP_BOARD}/items`, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } });
      return res.ok ? (await res.json()).items || [] : null;
    } catch { return null; }
  })();
  if (!board) return;

  for (const p of open) {
    if (Date.now() - p.aangemaakt > 25 * 60000) {
      p.status = 'timeout';
      await telegram(`⚠️ AI-KS: nieuwe offerte voor ${p.klantNaam} is na 25 min nog niet verschenen in RP (lcId ${p.lcId}). Handmatig checken.`);
      continue;
    }
    const item = board.find(i => i.item_subject?.id === p.lcId);
    if (!item) continue; // RP nog bezig
    let docs;
    try {
      docs = await (await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${p.lcId}`, { headers: { Authorization: 'Bearer ' + CFG.RP_API_KEY } })).json();
    } catch { continue; }
    const doc = (docs?.quotationDatas || [])[0];
    if (!doc) continue; // offerte nog niet gegenereerd

    // Placeholder eruit, echte producten erin (incl. v4-verrijking + 7 dagen geldigheid)
    const res = await pasOfferteAan({ documentId: doc.documentId, verwijderen: ['offerte op maat', 'shutter', 'winkel offerte'], toevoegen: p.producten });
    if (res.error) {
      p.status = 'fout';
      await telegram(`⚠️ AI-KS: offerte vullen mislukt voor ${p.klantNaam}: ${res.error}`);
      continue;
    }
    await zetStatus(item.id, CFG.RP_STATUS_AI_OFFERTE_VERSTUURD).catch(() => {});

    // Link appen op het oorspronkelijke ticket (met whitelist-check)
    const tRes = await tGet(`/tickets/${p.ticketId}`);
    const ticket = tRes?.data || tRes;
    // Link mag naar de klant bij: whitelist-test, of een Sonny-gesprek (buiten openingstijden
    // aangemaakt; de nalevering zelf mag ook net ná opening nog, klant verwacht hem).
    const magSonnyLeveren = p.sonny && CFG.SONNY.enabled && ticket && isWaTicket(ticket);
    if (ticket && (isLiveTestContact(ticket) || magSonnyLeveren)) {
      const voornaam = (p.klantNaam || '').split(' ')[0];
      const bericht = `Hi ${voornaam}, je offerte staat klaar. Je bekijkt hem hier: ${res.link}\n\nOffertenummer: ${doc.quotationNumber || ''}\nDe offerte is 7 dagen geldig. Neem hem rustig door en laat maar weten als je vragen hebt!`;
      const sendRes = isLiveTestContact(ticket)
        ? await sendLiveReply(ticket, bericht)
        : await tPost(`/tickets/${ticket.id}/messages`, { message: bericht, type: 'OUTBOUND' });
      console.log(`  → pending offerte geleverd aan ${p.klantNaam}: ${sendRes.ok ? 'OK' : 'FOUT ' + sendRes.status}`);
    }
    p.status = 'klaar';
    log({ pendingOfferte: p.lcId, klant: p.klantNaam, documentId: doc.documentId, regels: res.regelsNa, totaal: res.totaalIndicatie });
  }
  savePending(pending);
}

async function pollRonde(state, { onlyTest, sonnyOnly }) {
  // --sonny-only (AI-dienst-cron): buiten openingstijden bedient Sonny alle WA-klanten
  // (mits .sonny-enabled). Binnen openingstijden — of zolang Sonny uit staat — alleen de
  // whitelist-testnummers live, zodat we overdag doortrainen zonder dat klanten iets
  // merken (opdracht Daimy 2026-07-16). Geen schaduwnotities in deze modus.
  const sonnyNu = sonnyActiefNu();
  const effOnlyTest = onlyTest || (sonnyOnly && !sonnyNu);
  try { await verwerkPendingOffertes(); } catch (e) { console.error('pending-offertes FOUT:', e.message); }
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

  // whitelist-modus: ALLEEN whitelist-tickets aanraken; alle andere volledig negeren (ook geen notities)
  if (effOnlyTest) tickets = tickets.filter(isLiveTestContact);
  // --sonny-only: alleen WhatsApp (Sonny doet geen e-mail in de testfase)
  if (sonnyOnly) tickets = tickets.filter(isWaTicket);

  console.log(`[${new Date().toLocaleTimeString()}] AI-KS (${CFG.MODE.toUpperCase()}${effOnlyTest ? ', WHITELIST-ONLY' : ''}${sonnyNu ? ', SONNY ACTIEF' : ''}): ${tickets.length} kandidaat-tickets`);
  for (const t of tickets) {
    try { await verwerkTicket(t, state); }
    catch (e) {
      console.error(`Ticket ${t.id} FOUT:`, e.message);
      log({ ticket: t.id, fout: String(e.message || e) });
      if (/credit balance/i.test(String(e.message || e))) await alertCreditsOp();
    }
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
  const sonnyOnly = process.argv.includes('--sonny-only');
  const watchIdx = process.argv.indexOf('--watch');
  const watchMin = watchIdx >= 0 ? parseInt(process.argv[watchIdx + 1] || '60', 10) : 0;

  if (watchMin > 0) {
    console.log(`Watch-modus: elke 30s pollen, ${watchMin} minuten lang${onlyTest ? ' (alleen whitelist-nummers)' : ''}${sonnyOnly ? ' (alleen Sonny/WA)' : ''}.`);
    const tot = Date.now() + watchMin * 60000;
    while (Date.now() < tot) {
      await pollRonde(state, { onlyTest, sonnyOnly });
      await new Promise(r => setTimeout(r, 30000));
    }
    console.log('Watch-venster afgelopen.');
  } else {
    await pollRonde(state, { onlyTest, sonnyOnly });
    console.log('Klaar.');
  }
})();
