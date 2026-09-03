#!/usr/bin/env node
// ALLEEN LEZEN: dubbele/overlappende Planado-opdrachten per team (nu → +100 dagen). Daimy 03-09: "8 sep al een dubbele
// afspraak bij bus 5". Twee opdrachten van hetzelfde team die elkaar in tijd overlappen = dubbel (of een bewuste
// dubbelboeking die iemand moet zien). Uitvoer: lijst per team + JSON in data/planado-dubbel.json.
const fs = require('fs');
const path = require('path');
const { planadoFetch } = require('./lib/planado-fetch.js');
const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const BUS = { '1f19ca1a-5a2d': 'Bus 1 Frenk&Dennis', '1f122f72-777f': 'Bus 2 Tygo&Kevin', '1f122f37-76db': 'Bus 3 Yudi&Nick', '1f19ca1c-8ecb': 'Bus 4 Marvin&Bart', '1f19ca1d-fec8': 'Bus 5 Marvin&Moa', '1f19ca28-ce10': 'Bus 6 Arnold', '1f122cfa-17a2': 'Joey', '1f122d19-e43e': 'Sjoerd', '1f122cfa-4eba': 'Nanny', '1f122da2-8a5b': 'Jorren' };
const team = (u) => BUS[String(u || '').slice(0, 13)] || (u ? 'onbekend ' + String(u).slice(0, 8) : 'geen');
/** Pure: overlappende paren per team. */
function overlappen(jobs, { nu = Date.now(), dagen = 100 } = {}) {
  const per = new Map();
  for (const j of jobs) {
    if (!j || !j.scheduled_at) continue;
    const s = Date.parse(j.scheduled_at); if (!(s >= nu - 3600e3 && s < nu + dagen * 864e5)) continue;
    if (/meeneem-/.test(j.external_id || '')) continue;
    const e = s + ((j.scheduled_duration?.minutes) || 60) * 60e3;
    const k = j.assignee?.worker_uuid || 'geen';
    if (!per.has(k)) per.set(k, []);
    per.get(k).push({ uuid: j.uuid, nr: j.serial_no, s, e, ext: j.external_id || '-', kop: String(j.description || '').split('\n')[0].slice(0, 50), status: j.status });
  }
  const uit = [];
  for (const [k, l] of per) {
    l.sort((a, b) => a.s - b.s);
    for (let i = 0; i < l.length; i++) for (let m = i + 1; m < l.length && l[m].s < l[i].e; m++) uit.push({ team: team(k), a: l[i], b: l[m] });
  }
  return uit;
}
async function main() {
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: { Authorization: 'Bearer ' + KEY } })).json();
    const l = d.jobs || d.data || []; if (!l.length) break; jobs.push(...l); after = l[l.length - 1].uuid;
    await new Promise((r) => setTimeout(r, 2600));
  }
  const dub = overlappen(jobs);
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'planado-dubbel.json'), JSON.stringify({ gemaakt: new Date().toISOString(), jobs: jobs.length, dubbel: dub }, null, 1));
  const f = (t) => new Date(t).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  console.log(`${jobs.length} opdrachten, ${dub.length} overlappende paren`);
  for (const d of dub) console.log(`  ${d.team}: #${d.a.nr} ${f(d.a.s)}-${f(d.a.e).slice(-5)} "${d.a.kop}" (${d.a.ext})  ×  #${d.b.nr} ${f(d.b.s)}-${f(d.b.e).slice(-5)} "${d.b.kop}" (${d.b.ext})`);
}
module.exports = { overlappen };
if (require.main === module) main().catch((e) => { console.error('FOUT', e.message); process.exit(1); });
