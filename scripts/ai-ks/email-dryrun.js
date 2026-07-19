#!/usr/bin/env node
// DROOGLOOP e-mail: laat Sunny de opgegeven Aanvragen-tickets beoordelen met exact dezelfde
// agent-logica als WhatsApp, maar VERSTUURT NIETS. Output = per ticket wat Sunny zou doen
// (antwoorden + concepttekst, of escaleren = 👤 Mens nodig, of met rust laten). Zo zien we
// vooraf precies wat er gebeurt en checken we de opmaak. Gebruik: node email-dryrun.js [id id ...]
const fs = require('fs');
const path = require('path');
const { beantwoord } = require('./agent.js');

const TT = (() => {
  try { return fs.readFileSync(path.join(__dirname, '.trengo-sonny-token.txt'), 'utf8').trim(); }
  catch { return fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim(); }
})();
const H = { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' };
const clean = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function tGet(ep) { const r = await fetch('https://app.trengo.com/api/v2' + ep, { headers: H }); return r.ok ? r.json() : null; }

async function dryrun(ticketId) {
  const t = (await tGet(`/tickets/${ticketId}`))?.data || await tGet(`/tickets/${ticketId}`);
  if (!t) return { ticketId, fout: 'ticket niet gevonden' };
  const msgs = await tGet(`/tickets/${ticketId}/messages`);
  const rijen = (msgs?.data || []).map(m => ({
    van: m.type === 'INBOUND' ? 'klant' : 'sonty',
    tekst: clean(m.body || m.message),
    tijd: m.created_at,
  })).filter(m => m.tekst).sort((a, b) => String(a.tijd).localeCompare(String(b.tijd)));

  const gesprek = {
    kanaal: 'EMAIL',
    klant: { naam: t.contact?.full_name || null, email: t.contact?.email || null, phone: t.contact?.phone || null },
    berichten: rijen.slice(-20),
    liveTest: false, // ECHTE droogloop: tools draaien in schaduwmodus (offerte/inmeten worden NIET
                     //  doorgevoerd, alleen voorgesteld). Zo verandert de droogloop niets in RP.
    sonny: false,
    ticketId: t.id,
  };
  const res = await beantwoord(gesprek);
  const escal = (res.acties || []).find(a => a.type === 'escalatie');
  return {
    ticketId, klant: gesprek.klant.naam || gesprek.klant.email,
    laatste: rijen.filter(r => r.van === 'klant').slice(-1)[0]?.tekst?.slice(0, 120) || '(geen)',
    besluit: escal ? '👤 MENS NODIG' : (res.antwoord ? '✅ SUNNY ANTWOORDT' : '— geen bericht'),
    concept: res.antwoord || (escal ? 'reden: ' + (escal.reden || '').slice(0, 200) : ''),
    acties: (res.acties || []).filter(a => a.type !== 'escalatie').map(a => a.type),
  };
}

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.log('Geef ticket-ids op.'); return; }
  for (const id of ids) {
    const r = await dryrun(id);
    console.log('\n========================================');
    console.log(`TICKET ${r.ticketId} — ${r.klant}`);
    console.log(`Klant vroeg: ${r.laatste}`);
    console.log(`Sunny's besluit: ${r.besluit}${r.acties?.length ? ' (acties: ' + r.acties.join(', ') + ')' : ''}`);
    console.log(`--- concept/reden ---\n${r.concept}`);
  }
  console.log('\n(DROOGLOOP — er is NIETS verstuurd of gewijzigd.)');
})().catch(e => console.error('FOUT:', e.message));
