#!/usr/bin/env node
// Sonny-ochtendrapport — vat alle Sonny-gesprekken van de afgelopen avond/nacht samen
// en stuurt dat naar Daimy op Telegram. Draait dagelijks om 08:30 (launchd nl.sonty.sonny-rapport).
// Stuurt niets zolang Sonny uit staat en er geen gesprekken waren.
const fs = require('fs');
const CFG = require('./config.js');

function loadSonnyState() {
  try { return JSON.parse(fs.readFileSync(CFG.SONNY.STATE_FILE, 'utf8')); } catch { return { introTickets: {}, dagTeller: {}, lastRapport: null }; }
}

async function telegram(text) {
  await fetch(`https://api.telegram.org/bot${CFG.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CFG.TG_CHAT, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

const kort = (s, n) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

(async () => {
  const state = loadSonnyState();
  const sinds = state.lastRapport ? new Date(state.lastRapport) : new Date(Date.now() - 24 * 3600000);

  let regels = [];
  try {
    regels = fs.readFileSync(CFG.LOG_FILE, 'utf8').trim().split('\n')
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && (e.sonny || e.actief) && new Date(e.tijd) > sinds);
  } catch {}

  if (!regels.length) {
    // Alleen een heartbeat sturen als Sonny überhaupt aan staat
    if (CFG.SONNY.enabled) await telegram('🌙 Sonny-ochtendrapport: rustige nacht, 0 gesprekken.');
    return;
  }

  // Per ticket het laatste log-entry (meest complete beeld van het gesprek)
  const perTicket = new Map();
  let capSkips = 0;
  for (const e of regels) {
    if (e.overgeslagen) { capSkips++; continue; }
    perTicket.set(e.ticket, e);
  }

  const blokken = [];
  let escalaties = 0, offerteActies = 0;
  for (const [ticket, e] of perTicket) {
    const wie = e.klant?.naam || e.klant?.phone || 'onbekend';
    const acts = (e.acties || []).map(a => a.type).filter(Boolean);
    escalaties += acts.filter(a => a === 'escalatie').length;
    offerteActies += acts.filter(a => a.startsWith('offerte')).length;
    blokken.push(`• ${wie} (ticket ${ticket})\n  Vraag: ${kort(e.laatsteKlantBericht, 120)}\n  Sonny: ${kort(e.antwoord, 160) || '(stil geëscaleerd)'}${acts.length ? '\n  Acties: ' + acts.join(', ') : ''}`);
  }

  // Kostenschatting (bovengrens): log telt cache-reads als input mee, dus echt is het lager.
  // Opus 4.8: $5/M input, $25/M output.
  let inTok = 0, outTok = 0;
  for (const e of regels) { inTok += e.usage?.input_tokens || 0; outTok += e.usage?.output_tokens || 0; }
  const kostenMax = (inTok / 1e6) * 5 + (outTok / 1e6) * 25;

  const kop = `🌙 Sonny-ochtendrapport: ${perTicket.size} gesprek(ken) vannacht, ${offerteActies} offerte-actie(s), ${escalaties} escalatie(s)${capSkips ? `, ${capSkips} overgeslagen (dagcap, team oppakken!)` : ''}. API-kosten: hooguit ~$${kostenMax.toFixed(2)}.\n\n`;
  await telegram(kop + blokken.join('\n\n') + '\n\nVolledige teksten: data/ai-ks/log.jsonl. Feedback? App het hier, dan stel ik Sonny bij.');

  state.lastRapport = new Date().toISOString();
  fs.writeFileSync(CFG.SONNY.STATE_FILE, JSON.stringify(state));
})();
