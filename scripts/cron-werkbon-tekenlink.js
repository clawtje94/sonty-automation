#!/usr/bin/env node
// WERKBON-TEKENLINK-WACHTER (Daimy 03-09-2026: "in opdracht 1316 staat die niet"): ELKE toekomstige Planado-opdracht met een
// werkbon-sjabloon (Montage particulier/zakelijk, Service, Onderhoud, Reparatie) krijgt onderaan de omschrijving de tekenlink
// voor de klant-werkbon — ongeacht wie hem maakte (Outlook-sync, kantoor in Planado, planner) of aan wie hij hangt.
// Alleen de omschrijving wordt aangevuld (lib/planado-verfris.js metTekenLink). State per opdracht (updated_at) zodat er maar
// één detail-call per nieuwe/gewijzigde opdracht nodig is. Elke 10 min via launchd nl.sonty.werkbon-tekenlink (+ interval-runner).
// --dry = niets schrijven.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { planadoFetch } = require('./lib/planado-fetch.js');
const { metTekenLink, TEKEN_KOP } = require('./lib/planado-verfris.js');
const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const STATE = path.join(__dirname, '..', 'data', 'werkbon-tekenlink-state.json');
const DRY = process.argv.includes('--dry');
const WERKBON_SJABLOON = /montage|service|onderhoud|reparatie/i;
const MAX_PER_RUN = 40;
const link = (uuid) => { const t = crypto.createHmac('sha256', require('./secrets.js').ADMIN_PASSWORD).update('werkbon:' + uuid).digest('hex').slice(0, 24); return `https://sonty-website.vercel.app/werkbon/${uuid}?t=${t}`; };
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
/** Pure: welke opdrachten uit de lijst moeten bekeken worden. */
function kandidaten(jobs, state, nu = Date.now()) {
  return (jobs || []).filter((j) => j && j.uuid && j.scheduled_at && Date.parse(j.scheduled_at) > nu - 3600e3
    && WERKBON_SJABLOON.test(j.template_name || '') && !/^(meeneem|voorbeeld)-/i.test(j.external_id || '') && !/^(canceled|cancelled|deleted)$/i.test(j.status || '')
    && !(state[j.uuid] && state[j.uuid].heeft && state[j.uuid].updated_at === j.updated_at));
}
async function main() {
  let state = {}; try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* eerste run */ }
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) { const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json(); const l = d.jobs || []; if (!l.length) break; jobs.push(...l); after = l[l.length - 1].uuid; await wacht(2600); }
  const lijst = kandidaten(jobs, state);
  let had = 0, gezet = 0, fout = 0;
  for (const j of lijst.slice(0, MAX_PER_RUN)) {
    const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json(); const h = det.job || det; await wacht(2600);
    const desc = String(h.description || '');
    if (desc.includes(TEKEN_KOP)) { had++; state[j.uuid] = { heeft: true, updated_at: j.updated_at, op: new Date().toISOString() }; continue; }
    if (DRY) { gezet++; console.log('  [dry] #' + h.serial_no, (h.template_name || j.template_name || ''), desc.split('\n')[0].slice(0, 40)); continue; }
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'PATCH', headers: PH, body: JSON.stringify({ version: h.version, description: metTekenLink(desc, link(j.uuid)) }) });
    if (r.ok) { gezet++; state[j.uuid] = { heeft: true, updated_at: null, op: new Date().toISOString() }; console.log('  + #' + h.serial_no, (j.template_name || ''), desc.split('\n')[0].slice(0, 40)); }
    else { fout++; console.log('  FOUT #' + h.serial_no, r.status); }
    await wacht(2600);
  }
  // opgeruimd: alleen toekomstige uuid's bewaren
  const levend = new Set(jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > Date.now() - 7 * 864e5).map((j) => j.uuid));
  for (const u of Object.keys(state)) if (!levend.has(u)) delete state[u];
  if (!DRY) fs.writeFileSync(STATE, JSON.stringify(state));
  console.log(`${new Date().toISOString()} werkbon-tekenlink: ${jobs.length} opdrachten, ${lijst.length} te bekijken, had al ${had}, gezet ${gezet}, fouten ${fout}, volgende run ${Math.max(0, lijst.length - MAX_PER_RUN)}${DRY ? ' (dry)' : ''}`);
}
module.exports = { kandidaten };
if (require.main === module) main().catch((e) => { console.error(new Date().toISOString(), 'werkbon-tekenlink FOUT:', e.message); process.exit(1); });
