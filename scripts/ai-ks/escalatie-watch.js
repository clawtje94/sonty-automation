#!/usr/bin/env node
// ESCALATIE-WACHTER (Daimy 30-08-2026: "we moeten echt zorgen dat dingen niet stil blijven").
// Casus John van Krimpen: Sunny escaleerde 28-08 en 29-08 naar een collega (interne notitie met
// @-mention, label Urgent), maar niemand deed iets en de klant wachtte 2 dagen. Deze wachter kijkt
// elk uur naar alle escalaties van de afgelopen 7 dagen in data/ai-ks/log.jsonl en controleert in
// Trengo of een MENS (niet Sunny) daarna iets naar de klant stuurde of het ticket sloot. Zo niet
// na 4 werkuren (ma-vr 08-18): alarm op Telegram (hoofdchat), daarna elke 24 uur opnieuw tot het
// is opgepakt. State in data/ai-ks/escalatie-watch-state.json. Draait via launchd nl.sonty.escalatie-watch.
const fs = require('fs');
const path = require('path');
const CFG = require('./config.js');
const { getToken } = require('../trengo-api.js');
const SUNNY_USER_ID = 747786;
const LOG = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'log.jsonl');
const STATE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'escalatie-watch-state.json');
const DAGEN = 7, WERKUREN_GRENS = 4, HERHAAL_UUR = 24;
const DRY = process.argv.includes('--dry');

function werkuren(van, tot) {
  let uren = 0; const d = new Date(van);
  while (d < tot) { const dag = d.getDay(), uur = d.getHours(); if (dag >= 1 && dag <= 5 && uur >= 8 && uur < 18) uren += 1; d.setHours(d.getHours() + 1, 0, 0, 0); }
  return uren;
}
async function telegram(text) {
  if (DRY) { console.log('[dry] telegram:', text); return; }
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: text.substring(0, 4000) }) }).catch(() => {});
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
    const [tk, ms] = await Promise.all([
      fetch(`https://app.trengo.com/api/v2/tickets/${e.ticket}`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => null),
      fetch(`https://app.trengo.com/api/v2/tickets/${e.ticket}/messages?page=1`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => null),
    ]);
    if (!tk || tk.status === 'CLOSED') { delete state[e.ticket]; continue; }
    // Trengo-berichten: type INBOUND (klant) / OUTBOUND (medewerker of Sunny) / NOTE (intern); user_id = afzender.
    const mensNa = (ms?.data || []).some(m => Date.parse(String(m.created_at || '').replace(' ', 'T') + 'Z') > e.t - 60e3 && m.type === 'OUTBOUND' && m.user_id && m.user_id !== SUNNY_USER_ID);
    if (mensNa) { delete state[e.ticket]; continue; }
    const uren = werkuren(e.t, new Date());
    if (uren < WERKUREN_GRENS) continue;
    const last = state[e.ticket]?.laatsteAlarm || 0;
    open.push({ ...e, uren, alarmNodig: Date.now() - last >= HERHAAL_UUR * 36e5 });
  }
  // Eén gebundeld bericht (regel Daimy 24-08: minder berichten, bundelen), alleen als er iets nieuws
  // of iets ouder dan 24 uur is; alle open gevallen staan erin zodat het overzicht compleet is.
  if (open.some(o => o.alarmNodig)) {
    const regels = open.map(o => { const dagen = Math.round((Date.now() - o.t) / 864e5 * 10) / 10; return `• ${o.naam || 'klant'}${o.phone ? ' ' + o.phone : ''} (${o.kanaal}, ${dagen} dg / ${o.uren} werkuren): ${o.reden.slice(0, 110)}\n  https://app.trengo.com/tickets/${o.ticket}`; });
    await telegram(`🚨 ${open.length} escalatie(s) zonder reactie van een collega na ${WERKUREN_GRENS} werkuren. Sunny heeft deze klanten beloofd dat iemand terugkomt:\n${regels.join('\n')}\n(Komt elke 24 uur terug tot een collega heeft geantwoord of het ticket dicht is.)`);
    for (const o of open) if (o.alarmNodig) state[o.ticket] = { laatsteAlarm: Date.now(), naam: o.naam, sinds: o.t };
  }
  if (!DRY) fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`${new Date().toISOString()} escalatie-watch: ${perTicket.size} escalaties bekeken, ${open.length} zonder menselijke reactie na ${WERKUREN_GRENS} werkuren${open.length ? ': ' + open.map(o => `${o.ticket} ${o.naam || ''} ${o.uren}u`).join(', ') : ''}`);
})().catch(e => { console.error('escalatie-watch fout:', e.message); process.exit(1); });
