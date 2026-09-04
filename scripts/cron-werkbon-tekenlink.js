#!/usr/bin/env node
// WERKBON-TEKENLINK-WACHTER — afspraak Daimy 03-09-2026 (avond): "die werkbon met werkbon tekenen moet gewoon onder RAPPORT staan",
// en 04-09: "alles zo zetten als gisteren besproken" nadat een andere terminal de link als DETAILS-veld + regel in de omschrijving
// had gezet. Dus per opdracht met een werkbon-sjabloon (Montage particulier/zakelijk, Service, Onderhoud, Reparatie):
//   1. rapportveld "Werkbon tekenen (klant)" (link) gevuld — bestaat het veld niet op de opdracht, dan wordt het toegevoegd
//   2. het foute DETAILS-veld met dezelfde naam verborgen (hidden: true; verwijderen kan de API niet)
//   3. de regel "WERKBON TEKENEN (klant tekent op je telefoon): <link>" uit de omschrijving gehaald
// Nooit: opdrachten aanmaken, ingevulde rapportvelden overschrijven, andere velden aanraken.
// State per opdracht (updated_at) zodat er maar één detail-call per nieuwe/gewijzigde opdracht nodig is.
// Elke 10 min via launchd nl.sonty.werkbon-tekenlink (+ interval-runner). --dry = niets schrijven, --max <n> = per run.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { planadoFetch } = require('./lib/planado-fetch.js');
const { zonderTekenLink, TEKEN_KOP } = require('./lib/planado-verfris.js');
const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const STATE = path.join(__dirname, '..', 'data', 'werkbon-tekenlink-state.json');
const DRY = process.argv.includes('--dry');
const MAX_PER_RUN = process.argv.includes('--max') ? Number(process.argv[process.argv.indexOf('--max') + 1]) : 40;
const WERKBON_SJABLOON = /montage|service|onderhoud|reparatie/i;
const VELD = 'Werkbon tekenen (klant)';
const link = (uuid) => { const t = crypto.createHmac('sha256', require('./secrets.js').ADMIN_PASSWORD).update('werkbon:' + uuid).digest('hex').slice(0, 24); return `https://sonty-website.vercel.app/werkbon/${uuid}?t=${t}`; };
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pure: welke opdrachten uit de lijst moeten bekeken worden (heeft = rapportveld gevuld, veld = details/omschrijving opgeruimd). */
function kandidaten(jobs, state, nu = Date.now()) {
  return (jobs || []).filter((j) => j && j.uuid && j.scheduled_at && Date.parse(j.scheduled_at) > nu - 36 * 3600e3
    && WERKBON_SJABLOON.test(j.template_name || '') && !/^(meeneem)-/i.test(j.external_id || '') && !/^(canceled|cancelled|deleted)$/i.test(j.status || '')
    && !(state[j.uuid] && state[j.uuid].heeft && state[j.uuid].veld && state[j.uuid].updated_at === j.updated_at));
}

/** Pure: de PATCH voor één opdracht (of null als alles al goed staat). */
function patchVoor(job, tekenLink) {
  const patch = {}; const redenen = [];
  const rapport = (job.report_fields || []).find((f) => f.name === VELD);
  if (!rapport) { patch.report_fields = [{ name: VELD, field_type: 'link', data_type: 'url', value: tekenLink }]; redenen.push('rapportveld toegevoegd'); }
  else if (!rapport.value) { patch.report_fields = [{ uuid: rapport.uuid, value: tekenLink }]; redenen.push('rapportveld gevuld'); }
  const fout = (job.custom_fields || []).filter((f) => f.name === VELD && !f.hidden);
  if (fout.length) { patch.custom_fields = fout.map((f) => ({ uuid: f.uuid, hidden: true })); redenen.push('detailveld verborgen'); }
  const desc = String(job.description || '');
  if (desc.includes(TEKEN_KOP)) { patch.description = zonderTekenLink(desc); redenen.push('regel uit omschrijving'); }
  return redenen.length ? { patch, redenen } : null;
}

async function main() {
  let state = {}; try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* eerste run */ }
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break; jobs.push(...l); after = l[l.length - 1].uuid;
    if (l.every((j) => j.scheduled_at && Date.parse(j.scheduled_at) < Date.now() - 36 * 3600e3)) break;
    await wacht(1300);
  }
  const lijst = kandidaten(jobs, state);
  let had = 0, gezet = 0, fout = 0;
  for (const j of lijst.slice(0, MAX_PER_RUN)) {
    const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json(); const h = det.job || det; await wacht(1500);
    const p = patchVoor(h, link(j.uuid));
    const kop = String(h.description || '').split('\n')[0].slice(0, 40);
    if (!p) { had++; state[j.uuid] = { heeft: true, veld: true, updated_at: j.updated_at, op: new Date().toISOString() }; continue; }
    if (DRY) { gezet++; console.log('  [dry] #' + h.serial_no, (j.template_name || ''), kop, '→', p.redenen.join(', ')); continue; }
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'PATCH', headers: PH, body: JSON.stringify(p.patch) });
    if (r.ok) { gezet++; state[j.uuid] = { heeft: true, veld: true, updated_at: null, op: new Date().toISOString() }; console.log('  + #' + h.serial_no, (j.template_name || ''), kop, '→', p.redenen.join(', ')); }
    else { fout++; console.log('  FOUT #' + h.serial_no, r.status, (await r.text()).slice(0, 120)); }
    await wacht(1500);
  }
  const levend = new Set(jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > Date.now() - 7 * 864e5).map((j) => j.uuid));
  for (const u of Object.keys(state)) if (!levend.has(u)) delete state[u];
  if (!DRY) fs.writeFileSync(STATE, JSON.stringify(state));
  console.log(`${new Date().toISOString()} werkbon-tekenlink: ${jobs.length} opdrachten, ${lijst.length} te bekijken, al goed ${had}, gezet ${gezet}, fouten ${fout}, nog te doen ${Math.max(0, lijst.length - MAX_PER_RUN)}${DRY ? ' (DRY)' : ''}`);
}
module.exports = { kandidaten, patchVoor };
if (require.main === module) main().catch((e) => { console.error(new Date().toISOString(), 'werkbon-tekenlink FOUT:', e.message); process.exit(1); });
