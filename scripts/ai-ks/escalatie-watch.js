#!/usr/bin/env node
// ESCALATIE-WACHTER (Daimy 30-08-2026: "we moeten echt zorgen dat dingen niet stil blijven").
// Casus John van Krimpen: Sunny escaleerde 28-08 en 29-08 naar een collega (interne notitie met
// @-mention, label Urgent), maar niemand deed iets en de klant wachtte 2 dagen.
// REGEL Daimy 02-09-2026 (na 4 alarmen op één dag met 13 klanten): herinnering PAS als er na 4 DAGEN
// niets is gedaan: geen collega-antwoord op enig ticket van de klant, ticket niet dicht, en geen interne
// notitie van een collega. Anders NIET. Besluit staat in escalatie-besluit.js (puur, getest); daarna
// elke 24 uur opnieuw tot het is opgepakt. State in data/ai-ks/escalatie-watch-state.json.
// Draait via launchd nl.sonty.escalatie-watch (elk uur).
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');
const { getToken } = require('../trengo-api.js');
const { beoordeel, DAGEN_GRENS } = require('./escalatie-besluit.js');
const LOG = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'log.jsonl');
const STATE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'escalatie-watch-state.json');
const DAGEN = 21; // terugkijkvenster: ruim boven de 4-dagengrens
const DRY = process.argv.includes('--dry');

async function telegram(text) {
  if (DRY) { console.log('[dry] telegram:', text); return; }
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: text.substring(0, 4000) }) }).catch(() => {});
}
async function trengo(url, token) {
  return fetch('https://app.trengo.com/api/v2' + url, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => null);
}
/** Alle tickets van de klant (contact) mét berichten; het escalatie-ticket zelf altijd erbij. */
async function ticketsVanKlant(ticketId, token) {
  const tk = await trengo(`/tickets/${ticketId}`, token);
  if (!tk || !tk.id) return null;
  const ids = new Set([Number(ticketId)]);
  const cid = tk.contact?.id;
  if (cid) { const lijst = await trengo(`/tickets?contact_id=${cid}`, token); for (const t of lijst?.data || []) ids.add(Number(t.id)); }
  const uit = [];
  for (const id of ids) {
    const t = id === Number(ticketId) ? tk : await trengo(`/tickets/${id}`, token);
    const ms = await trengo(`/tickets/${id}/messages?page=1`, token);
    if (t) uit.push({ id, zelf: id === Number(ticketId), status: t.status, closed_at: t.closed_at || null, messages: ms?.data || [] });
  }
  return uit;
}
(async () => {
  const sinds = Date.now() - DAGEN * 864e5;
  const perTicket = new Map();
  for (const l of fs.readFileSync(LOG, 'utf8').trim().split('\n')) {
    let j; try { j = JSON.parse(l); } catch { continue; }
    const t = Date.parse(j.tijd || ''); if (!t || t < sinds || !j.ticket) continue;
    const esc = (j.acties || []).find(a => a.type === 'escalatie'); if (!esc || esc.stil) continue;
    // EERSTE escalatie per ticket telt: een latere escalatie (bv. op zaterdag) mag de wachttijd niet
    // op nul zetten. Een menselijke reactie ná de eerste escalatie wist het geval toch.
    const prev = perTicket.get(j.ticket);
    if (!prev || t < prev.t) perTicket.set(j.ticket, { t, ticket: j.ticket, naam: j.klant?.naam || null, phone: j.klant?.phone || null, reden: String(esc.reden || '').replace(/\s+/g, ' ').slice(0, 220), kanaal: j.kanaal || '' });
  }
  let state = {}; try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* eerste run */ }
  const token = await getToken();
  const open = [];
  for (const e of perTicket.values()) {
    // Jonger dan de 4-dagengrens kan nooit een herinnering worden: geen Trengo-calls (21-dagenvenster
    // met alles ophalen liep in een dry-run tegen 4+ minuten).
    if (Date.now() - e.t < DAGEN_GRENS * 864e5) { delete state[e.ticket]; continue; }
    const tickets = await ticketsVanKlant(e.ticket, token);
    if (!tickets) { delete state[e.ticket]; continue; }
    const b = beoordeel({ escalatieT: e.t, tickets, laatsteAlarm: state[e.ticket]?.laatsteAlarm || 0 });
    if (!b.open) { delete state[e.ticket]; if (DRY) console.log(`  - ${e.ticket} ${e.naam || ''}: geen herinnering (${b.reden})`); continue; }
    open.push({ ...e, dagen: b.dagen, alarmNodig: b.alarm, tickets: tickets.length });
  }
  // Eén gebundeld bericht (regel Daimy 24-08: bundelen), alleen als er iets nieuws of iets ouder dan 24 uur is.
  if (open.some(o => o.alarmNodig)) {
    const regels = open.map(o => `• ${o.naam || 'klant'}${o.phone ? ' ' + o.phone : ''} (${o.kanaal}, ${o.dagen} dagen): ${o.reden.slice(0, 110)}\n  https://app.trengo.com/tickets/${o.ticket}`);
    await telegram(`🔔 ${open.length} klant(en) wachten al ${DAGEN_GRENS}+ dagen na een escalatie: geen antwoord van een collega, nergens anders geholpen en geen interne notitie.\n${regels.join('\n')}\n(Komt elke 24 uur terug tot iemand antwoordt, een notitie zet of het ticket sluit.)`);
    for (const o of open) if (o.alarmNodig) state[o.ticket] = { laatsteAlarm: Date.now(), naam: o.naam, sinds: o.t };
  }
  if (!DRY) fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`${new Date().toISOString()} escalatie-watch: ${perTicket.size} escalaties bekeken, ${open.length} na ${DAGEN_GRENS}+ dagen nog nergens geholpen${open.length ? ': ' + open.map(o => `${o.ticket} ${o.naam || ''} ${o.dagen}d`).join(', ') : ''}`);
})().catch(e => { console.error('escalatie-watch fout:', e.message); process.exit(1); });
