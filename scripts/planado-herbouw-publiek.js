#!/usr/bin/env node
// Toekomstige Planado-jobs met type "default" (app toont "Opdracht") herbouwen
// naar het juiste type via de PUBLIEKE API. Kan sinds 06-08: job_type/template
// moeten als OBJECT ({uuid}/{code}) in de POST — de platte *_uuid-velden worden
// stil genegeerd, en PATCH kan het type nooit meer wijzigen. Daarom: reddings-
// regel schrijven → oude weg → nieuwe aanmaken mét type (external_id verhuist mee
// zodat de Outlook-sync-dedup blijft werken). DRY-RUN zonder --execute.
const fs = require('fs');
const path = require('path');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const EXECUTE = process.argv.includes('--execute');
const RESCUE = path.join(__dirname, '..', 'data', 'herbouw-rescue.jsonl');
const TYPES = {
  inmeet: '1f11c802-6340-6680-9d06-7e73cee772e4',
  montage: '1f11c802-634b-6ef0-9d06-7e73cee772e4',
  winkel: '1f11c89f-35be-6820-831b-1d2c28c9b53e',
};
const TEMPLATE_INMEET = '1f11c802-65cd-6aa0-9d06-7e73cee772e4';
function soortUit(description) {
  const s = String(description || '').toLowerCase();
  if (/inmeet|inmeten/.test(s)) return 'inmeet';
  if (/montage/.test(s)) return 'montage';
  if (/winkel|showroom|telefonisch/.test(s)) return 'winkel';
  return null; // onbekend = niet aankomen
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(EXECUTE ? '=== HERBOUW (echt) ===' : '=== DRY-RUN (--execute om echt te herbouwen) ===');
  const jobs = [];
  let after = null;
  for (let i = 0; i < 30; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    jobs.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(800);
  }
  const nu = Date.now();
  const toekomst = jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > nu);
  let herbouwd = 0, alGoed = 0, overgeslagen = 0, fouten = 0;
  for (const kort of toekomst) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs/' + kort.uuid, { headers: PH })).json();
    const oud = d.job || d;
    await wacht(500);
    const soort = soortUit(oud.description);
    if (!soort) { overgeslagen++; continue; }
    if (oud.type?.code !== 'default') { alGoed++; continue; }
    const kop = String(oud.description || '').split('\n')[0].slice(0, 45);
    console.log(`  ~ #${oud.serial_no} [${soort}] ${kop}`);
    herbouwd++;
    if (!EXECUTE) continue;

    fs.appendFileSync(RESCUE, JSON.stringify({ op: new Date().toISOString(), oud }) + '\n');
    const worker = oud.assignee?.worker?.uuid || oud.assignees?.[0]?.worker?.uuid;
    const body = {
      job_type: { uuid: TYPES[soort] },
      ...(soort === 'inmeet' ? { template: { uuid: TEMPLATE_INMEET } } : {}),
      description: oud.description || '',
      scheduled_at: oud.scheduled_at,
      scheduled_duration: oud.scheduled_duration || { minutes: 60 },
      ...(worker ? { assignee: { worker: { uuid: worker } } } : {}),
      contacts: (oud.contacts || []).filter((c) => c.value).map((c) => ({ type: c.type || 'phone', name: c.name || '', value: c.value })),
      ...(oud.address?.formatted ? { address: { formatted: oud.address.formatted } } : {}),
      ...(oud.external_id ? { external_id: oud.external_id } : {}),
      custom_fields: (oud.custom_fields || []).filter((f) => f.value).map((f) => ({ name: f.name, field_type: f.field_type, value: f.value })),
    };
    const del = await fetch('https://api.planadoapp.com/v2/jobs/' + oud.uuid, { method: 'DELETE', headers: PH });
    if (!del.ok) { fouten++; console.log(`    DELETE-fout ${del.status} — job blijft staan`); continue; }
    await wacht(800);
    const r = await fetch('https://api.planadoapp.com/v2/jobs', { method: 'POST', headers: PH, body: JSON.stringify(body) });
    if (!r.ok) {
      fouten++;
      console.log(`    CREATE-fout ${r.status}: ${(await r.text()).slice(0, 150)} — HERSTEL uit rescue nodig (data/herbouw-rescue.jsonl)`);
      continue;
    }
    const nieuw = await r.json();
    const uuid = nieuw.job_uuid || nieuw.uuid;
    const chk = await (await fetch('https://api.planadoapp.com/v2/jobs/' + uuid, { headers: PH })).json();
    const job = chk.job || chk;
    console.log(`    → #${job.serial_no} type=${job.type?.code} tpl=${job.template?.name || '-'}`);
    await wacht(800);
  }
  console.log(`\n${herbouwd} herbouwd, ${alGoed} al goed, ${overgeslagen} onbekende soort, ${fouten} fouten`);
  if (fouten) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
