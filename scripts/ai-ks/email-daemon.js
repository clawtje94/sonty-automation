#!/usr/bin/env node
// DOORLOPENDE e-mailverwerking voor aanvragen@ (net als de WhatsApp-daemon, maar voor e-mail).
// Pakt elke ronde de open Aanvragen-tickets op die aan Sunny toegewezen of niet-toegewezen zijn
// en waar de klant het laatste bericht stuurde, en verwerkt ze met dezelfde agent-logica:
// beantwoorden + aan Sunny toewijzen + sluiten, of naar team Mens nodig. Human-toegewezen
// tickets blijft hij af. State per ticket+laatste-berichttijd voorkomt dubbel verwerken.
// Gebruik: node email-daemon.js --watch 0   (permanent; launchd KeepAlive herstart bij crash)
const fs = require('fs');
const path = require('path');
const { verwerk, tGet, verwerkNotities } = require('./email-live.js');
const CFG = require('./config.js');

const AANVRAGEN_KANAAL = 'Aanvragen';
const SONNY_USER = 747786;
const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-verwerkt.json');
// Per ticket de laatst geziene updated_at, zodat we berichten alleen ophalen als er iets
// veranderd is (429-vriendelijk) — nodig omdat we voor @sonny-notities ALLE Aanvragen-tickets
// volgen, ook gesloten en aan het team toegewezen.
const SCAN_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-notitie-scan.json');
// Tickets die Daimy met "@sonny stop/neem over" uit AI-beheer haalde (gevuld door email-live).
const STOP_FILE = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'email-stop.json');
const INTERVAL_MS = 90 * 1000;

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s) { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }

// Leeftijd van een Trengo-timestamp in minuten. Trengo geeft Amsterdamse wandkloktijd
// ("2026-07-20 09:07:04"); vergelijk met "nu" in dezelfde tijdzone-notatie zodat het ook
// klopt als de Mac zelf in een andere tijdzone staat.
function leeftijdMin(createdAt) {
  const nu = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  return (Date.parse(nu.replace(' ', 'T')) - Date.parse(String(createdAt).replace(' ', 'T'))) / 60000;
}

// Wachttijd per ticket: vast punt in het 1,5-2u-venster, deterministisch op ticket-id
// (verspringt dus niet per ronde). Zie CFG.EMAIL_REPLY_DELAY.
function wachttijdMin(ticketId) {
  const { minMin, maxMin } = CFG.EMAIL_REPLY_DELAY;
  return minMin + (Number(ticketId) % (maxMin - minMin + 1));
}

function loadJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } }

async function ronde() {
  const state = loadState();
  const scan = loadJson(SCAN_FILE);
  const stop = loadJson(STOP_FILE);
  // Zelfde bedrijfsuren als de WhatsApp-bot (Daimy 20 juli): buiten 08:00-21:00 geen klantmails
  // beantwoorden — wat 's nachts binnenkomt, wacht tot de ochtend. @sonny-notities van het team
  // verwerken we WEL de klok rond (net als de WA-daemon): dat is interne sturing, geen klantmail.
  const binnenUren = CFG.binnenBotUren();
  // ALLE Aanvragen-tickets ophalen — doorpaginaren tot leeg (cap 25 pagina's). Eerder werden
  // maar 4 pagina's gescand, waardoor OUDERE aan-Sunny/niemand-toegewezen tickets nooit werden
  // opgepakt en open bleven staan (Daimy 19 juli). Óók gesloten en aan team/mens toegewezen
  // tickets komen mee: daar tagt Daimy juist vaak @sonny op (beantwoorden doen we er niet).
  let tickets = [];
  for (let p = 1; p <= 25; p++) {
    const d = await tGet(`/tickets?page=${p}`);
    const data = d?.data || [];
    tickets.push(...data.filter(t => t.channel?.title === AANVRAGEN_KANAAL));
    if (!data.length) break;
  }
  const teDoen = [];
  for (const t of tickets) {
    // Beantwoord-kandidaat = open én aan Sunny toegewezen, OF echt aan niemand (geen user én
    // geen team). Aan een TEAM toegewezen (bv. "Mens nodig") = human-wachtrij, daar blijft de
    // daemon qua beantwoorden vanaf (notities scannen mag wel).
    const kandidaat = t.status !== 'CLOSED' && (Number(t.user_id) === SONNY_USER || (!t.user_id && !t.team_id));
    const gewijzigd = scan[t.id] !== String(t.updated_at);
    // Berichten alleen ophalen als er iets kan spelen: het ticket is gewijzigd (mogelijk een
    // nieuwe @sonny-notitie of klantmail), of het is een kandidaat die op zijn reactietijd wacht.
    if (!gewijzigd && !(kandidaat && binnenUren)) continue;
    const md = await tGet(`/tickets/${t.id}/messages`);
    const rowsAll = md?.data || [];
    scan[t.id] = String(t.updated_at);
    // 1) @SONNY-NOTITIES (Daimy 20 juli): altijd en direct verwerken — geen wachttijd, geen
    //    bot-uren-check. Leerpunt + ✅-terugkoppeling + eventuele actie/mail via email-live.
    try { await verwerkNotities(t, rowsAll); } catch (e) { console.error(`  [${t.id}] notitie FOUT: ${e.message}`); }
    // 2) KLANTMAILS: alleen kandidaten, binnen bot-uren, en niet op stopgezette tickets.
    if (!kandidaat || !binnenUren || stop[t.id]) continue;
    const rows = rowsAll.filter(m => m.type === 'INBOUND' || m.type === 'OUTBOUND')
      .sort((a, b) => String(b.created_at).localeCompare(a.created_at));
    const laatste = rows[0];
    if (!laatste || laatste.type !== 'INBOUND') continue; // niks te beantwoorden
    // webflow-formulieren worden door verwerk() zelf afgehandeld (→ team Mens nodig met gegevens)
    const sleutel = `${t.id}:${laatste.created_at}`;
    if (state[sleutel]) continue;
    // REACTIETIJD (Daimy 20 juli): klantmails pas na 1,5-2 uur beantwoorden — direct antwoorden
    // voelt als een bot. Webflow-leads slaan dit over: daar gaat alleen een interne notitie naar
    // het team (hoe eerder die de lead ziet, hoe beter), geen mail naar de klant.
    const isWebflow = /no-reply@webflow/i.test(t.contact?.email || '') || /New form submission/i.test(t.subject || '');
    if (!isWebflow) {
      const oud = leeftijdMin(laatste.created_at);
      const wacht = wachttijdMin(t.id);
      if (oud < wacht) { console.log(`  [${t.id}] wacht op reactietijd: ${Math.round(oud)}/${wacht} min`); continue; }
    }
    teDoen.push({ id: t.id, sleutel });
    await new Promise(r => setTimeout(r, 120));
  }
  fs.writeFileSync(SCAN_FILE, JSON.stringify(scan));
  if (!teDoen.length) { console.log(`[${new Date().toLocaleTimeString()}] geen nieuwe e-mail te verwerken${binnenUren ? '' : ' (buiten bot-uren; alleen notities gescand)'}`); return; }
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
