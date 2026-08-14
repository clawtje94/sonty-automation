#!/usr/bin/env node
// Afspraak-herinneringen (Daimy 06-08): elke werkdag rond 17:00 krijgt elke klant met
// MORGEN een inmeetafspraak een herinnering via WhatsApp (en mail als er geen
// WhatsApp-gesprek is). Bron = Planado (type Inmeet afspraak, morgen, Joey/Sjoerd);
// het telefoonnummer staat als contact op de opdracht. Dedup via state-bestand.
// Standaard DRY-RUN (--execute om echt te sturen) — net als de rest van de keten
// blijft dit uit tot de keten live gaat.
const fs = require('fs');
const path = require('path');
const { herinneringTekst, zoekWaTicket, stuurMail } = require('./lib/aanbod-versturen');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY };
const EXECUTE = process.argv.includes('--execute');
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const STATE = path.join(__dirname, '..', 'data', 'inmeet-herinneringen-state.json');
const { planningTelegram } = require('./lib/telegram-planning.js');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function tFetch(ep, opties) {
  const TRENGO = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
  return fetch('https://app.trengo.com/api/v2' + ep, {
    ...opties,
    headers: { Authorization: 'Bearer ' + TRENGO, 'Content-Type': 'application/json', Accept: 'application/json' },
  });
}

async function haalInstellingen() {
  try {
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-instellingen', {
      headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' },
    });
    if (r.ok) return await r.json();
  } catch { /* val terug op standaard */ }
  return { herinneringDagen: [7, 1] };
}

async function main() {
  console.log(EXECUTE ? '=== HERINNERINGEN (echt) ===' : '=== DRY-RUN (--execute om echt te sturen) ===');
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { gestuurd: {} }; } })();
  // instelbaar via /admin/inmeet-instellingen (Daimy 06-08: "1 week ervoor en 1 dag
  // ervoor, en dit soort dingen zelf kunnen instellen")
  const { herinneringDagen } = await haalInstellingen();
  console.log('herinnering-momenten (dagen vooraf):', herinneringDagen.join(', ') || 'geen');
  const jobs = [];
  let after = null;
  for (let i = 0; i < 40; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    jobs.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(2600);
  }
  let gestuurd = 0, overgeslagen = 0, zonderKanaal = 0;
  const doel = [];
  for (const dagenVooraf of herinneringDagen) {
    const doeldatum = new Date(Date.now() + dagenVooraf * 24 * 3600000).toISOString().slice(0, 10);
    for (const j of jobs) {
      if (j.scheduled_at?.startsWith(doeldatum) && INMETERS[j.assignee?.worker_uuid]) doel.push({ j, dagenVooraf });
    }
  }
  console.log(`${doel.length} herinnering(en) te beoordelen`);

  for (const { j, dagenVooraf } of doel) {
    const sleutel = j.uuid + ':' + dagenVooraf;
    if (state.gestuurd[sleutel]) { overgeslagen++; continue; }
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);
    if (!/inmeet|inmeten/i.test((job.description || '').split('\n')[0])) continue;
    const tel = (job.contacts || []).find((c) => c.type === 'phone' && c.value && c.value !== '-');
    const naam = (tel?.name || (job.description || '').split('\n')[0].replace(/^.*?(—|-)\s*/, '')).trim();
    const slot = { aankomst: job.scheduled_at, inmeter: INMETERS[j.assignee.worker_uuid] };
    const duur = Math.round((job.scheduled_duration || 1800) / 60);
    if (require('./lib/klant-stil.js').klantStil(b.telefoon)) { console.log(`  stil-lijst: geen herinnering naar ${naam}`); continue; }
    const tekst = herinneringTekst(naam.split(' ')[0] || 'daar', slot, duur, dagenVooraf);
    console.log(`  ${naam}: ${tekst.slice(0, 70)}…`);
    if (!EXECUTE) continue;

    let bezorgd = false;
    if (tel) {
      const ticket = await zoekWaTicket(tel.value).catch(() => null);
      if (ticket) {
        const r = await tFetch(`/tickets/${ticket.id}/messages`, { method: 'POST', body: JSON.stringify({ message: tekst, type: 'OUTBOUND' }) });
        bezorgd = r.ok;
      }
    }
    if (bezorgd) { state.gestuurd[sleutel] = new Date().toISOString(); gestuurd++; }
    else zonderKanaal++;
  }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`\ngestuurd: ${gestuurd} | al eerder: ${overgeslagen} | geen kanaal (24u-venster/geen gesprek): ${zonderKanaal}`);
  if (EXECUTE && zonderKanaal) {
    await planningTelegram(`ℹ️ Inmeet-herinneringen: ${zonderKanaal} klant(en) van morgen niet bereikt via WhatsApp (geen open gesprek). Geen actie nodig, de afspraak staat gewoon.`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
