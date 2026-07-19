#!/usr/bin/env node
// DOORLOPENDE e-mailverwerking voor aanvragen@ (net als de WhatsApp-daemon, maar voor e-mail).
// Pakt elke ronde de open Aanvragen-tickets op die aan Sunny toegewezen of niet-toegewezen zijn
// en waar de klant het laatste bericht stuurde, en verwerkt ze met dezelfde agent-logica:
// beantwoorden + aan Sunny toewijzen + sluiten, of naar team Mens nodig. Human-toegewezen
// tickets blijft hij af. State per ticket+laatste-berichttijd voorkomt dubbel verwerken.
// Gebruik: node email-daemon.js --watch 0   (permanent; launchd KeepAlive herstart bij crash)
const fs = require('fs');
const path = require('path');
const { verwerk, tGet } = require('./email-live.js');

const AANVRAGEN_KANAAL = 'Aanvragen';
const SONNY_USER = 747786;
const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-verwerkt.json');
const INTERVAL_MS = 90 * 1000;

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }

async function ronde() {
  const state = loadState();
  // ALLE open Aanvragen-tickets ophalen — doorpaginaren tot leeg (cap 25 pagina's). Eerder werden
  // maar 4 pagina's gescand, waardoor OUDERE aan-Sunny/niemand-toegewezen tickets nooit werden
  // opgepakt en open bleven staan (Daimy 19 juli). Nu vallen die ook binnen.
  let tickets = [];
  for (let p = 1; p <= 25; p++) {
    const d = await tGet(`/tickets?page=${p}`);
    const data = d?.data || [];
    tickets.push(...data.filter(t => t.channel?.title === AANVRAGEN_KANAAL && t.status !== 'CLOSED'));
    if (!data.length) break;
  }
  // Alleen aan Sunny toegewezen, OF echt aan niemand (geen user én geen team). Aan een TEAM
  // toegewezen (bv. "Mens nodig") = human-wachtrij, daar blijft de daemon vanaf.
  const kandidaten = tickets.filter(t => Number(t.user_id) === SONNY_USER || (!t.user_id && !t.team_id));
  const teDoen = [];
  for (const t of kandidaten) {
    // laatste bericht van de klant? en nog niet verwerkt op die tijd?
    const md = await tGet(`/tickets/${t.id}/messages`);
    const rows = (md?.data || []).filter(m => m.type === 'INBOUND' || m.type === 'OUTBOUND')
      .sort((a, b) => String(b.created_at).localeCompare(a.created_at));
    const laatste = rows[0];
    if (!laatste || laatste.type !== 'INBOUND') continue; // niks te beantwoorden
    // webflow-formulieren worden door verwerk() zelf afgehandeld (→ team Mens nodig met gegevens)
    const sleutel = `${t.id}:${laatste.created_at}`;
    if (state[sleutel]) continue;
    teDoen.push({ id: t.id, sleutel });
    await new Promise(r => setTimeout(r, 120));
  }
  if (!teDoen.length) { console.log(`[${new Date().toLocaleTimeString()}] geen nieuwe e-mail te verwerken`); return; }
  // Batch-limiet per ronde: nooit tientallen tegelijk afvuren (dat gaf 429-rate-limits en
  // onterecht overgeslagen tickets). Rustig 1 tegelijk, max 12 per ronde; de rest komt de
  // volgende ronde. Zo blijft de API-belasting en het uitgaande mailvolume beheersbaar.
  const batch = teDoen.slice(0, 12);
  console.log(`[${new Date().toLocaleTimeString()}] ${teDoen.length} te doen — nu ${batch.length} verwerken`);
  for (const job of batch) {
    try {
      const r = await verwerk(job.id);
      // ALLEEN als verwerkt markeren bij een écht afgehandeld resultaat. Bij "ticket niet
      // gevonden" (bv. transient/verwijderd) NIET markeren, zodat het niet stil verdwijnt.
      if (r && !/niet gevonden/i.test(r.resultaat || '')) { state[job.sleutel] = new Date().toISOString(); saveState(state); }
      console.log(`  [${job.id}] ${r.resultaat} — ${r.klant || ''}`);
    } catch (e) { console.error(`  [${job.id}] FOUT: ${e.message}`); }
    await new Promise(r => setTimeout(r, 800)); // adempauze tussen zware agent-runs
  }
  saveState(state);
}

(async () => {
  const watch = process.argv.includes('--watch');
  console.log('E-mail-daemon gestart' + (watch ? ' (permanent, elke 90s)' : ' (eenmalig)'));
  do {
    try { await ronde(); } catch (e) { console.error('ronde FOUT:', e.message); }
    if (watch) await new Promise(r => setTimeout(r, INTERVAL_MS));
  } while (watch);
})();
