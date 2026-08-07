#!/usr/bin/env node
// Keten-tickets netjes afsluiten (audit 07-08, Daimy's klacht "er blijven berichten
// open staan"): een klant met een GEBOEKTE inmeetafspraak hoort niet als open
// gesprek in Trengo te blijven hangen. Sluit het WA-/mailticket van geboekte
// klanten, maar ALLEEN als het laatste echte bericht van ONS is — heeft de klant
// daarna nog iets gevraagd, dan blijft het ticket gewoon open (de watchdog bewaakt).
const fs = require('fs');
const path = require('path');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function tFetch(ep, opties = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: H, ...opties });
    if (r.status === 429) { await wacht(4000 + i * 4000); continue; }
    return r;
  }
  return { ok: false, status: 429 };
}

(async () => {
  const boekingen = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
  let state = {};
  try { state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeten-planner-state.json'), 'utf8')); } catch { /* geen state */ }
  const perToken = state.aanbodTickets || {};

  let gesloten = 0, overgeslagen = 0;
  for (const [rpItemId, b] of Object.entries(boekingen)) {
    if (b.status !== 'geboekt' || !b.aanbodToken) continue;
    const entry = perToken[b.aanbodToken];
    if (!entry) continue;
    for (const ticketId of [entry.waTicket, entry.mailTicket].filter(Boolean)) {
      const tr = await tFetch(`/tickets/${ticketId}`);
      if (!tr.ok) continue;
      const t = (await tr.json());
      const status = String(t.status || t.data?.status || '').toUpperCase();
      if (!['OPEN', 'ASSIGNED'].includes(status)) continue;
      await wacht(800);
      const mr = await tFetch(`/tickets/${ticketId}/messages`);
      if (!mr.ok) continue;
      const echt = ((await mr.json())?.data || []).filter((m) => (m.message_type || m.type) !== 'NOTE')
        .sort((a, b2) => String(a.created_at).localeCompare(String(b2.created_at)));
      const laatste = echt[echt.length - 1];
      if (!laatste || (laatste.message_type || laatste.type) === 'INBOUND') { overgeslagen++; continue; } // klant sprak het laatst: open laten
      const cr = await tFetch(`/tickets/${ticketId}/close`, { method: 'POST', body: '{}' });
      if (cr.ok) { gesloten++; console.log(`gesloten: #${ticketId} (${b.naam}, geboekt ${String(b.aankomst).slice(0, 10)})`); }
      await wacht(800);
    }
  }
  console.log(`klaar: ${gesloten} gesloten, ${overgeslagen} open gelaten (klant sprak het laatst)`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
