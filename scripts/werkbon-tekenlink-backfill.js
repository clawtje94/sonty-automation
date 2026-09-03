#!/usr/bin/env node
// Eenmalig (03-09-2026): tekenlink voor de klant-werkbon in ALLE toekomstige bus-opdrachten (montage/service) die hem nog
// niet hebben. De verfris-stap in de sync doet dit alleen bij gewijzigde Outlook-events; bestaande opdrachten missen hem
// anders tot kantoor iets aanpast. Alleen de omschrijving wordt aangevuld (metTekenLink), niets anders. --dry = niet schrijven.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { planadoFetch } = require('./lib/planado-fetch.js');
const { metTekenLink, TEKEN_KOP } = require('./lib/planado-verfris.js');
const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const DRY = process.argv.includes('--dry');
const BUS = ['1f19ca1a-5a2d', '1f122f72-777f', '1f122f37-76db', '1f19ca1c-8ecb', '1f19ca1d-fec8', '1f19ca28-ce10'];
const link = (uuid) => { const t = crypto.createHmac('sha256', require('./secrets.js').ADMIN_PASSWORD).update('werkbon:' + uuid).digest('hex').slice(0, 24); return `https://sonty-website.vercel.app/werkbon/${uuid}?t=${t}`; };
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let after = null; const jobs = [];
  for (let i = 0; i < 40; i++) { const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json(); const l = d.jobs || []; if (!l.length) break; jobs.push(...l); after = l[l.length - 1].uuid; await wacht(2600); }
  const nu = Date.now();
  const kandidaten = jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > nu - 3600e3 && BUS.some((b) => String(j.assignee?.worker_uuid || '').startsWith(b)) && !/meeneem-/.test(j.external_id || ''));
  console.log(`${jobs.length} opdrachten, ${kandidaten.length} bus-opdrachten vanaf nu`);
  let had = 0, gezet = 0, over = 0, fout = 0;
  for (const j of kandidaten) {
    const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json(); const h = det.job || det; await wacht(2600);
    const desc = String(h.description || '');
    if (desc.includes(TEKEN_KOP)) { had++; continue; }
    if (/inmeten|winkel|showroom|telefonisch|stoffering|behangen/i.test(desc.split('\n')[0])) { over++; continue; }
    if (DRY) { gezet++; console.log('  [dry] #' + h.serial_no, desc.split('\n')[0].slice(0, 40)); continue; }
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { method: 'PATCH', headers: PH, body: JSON.stringify({ version: h.version, description: metTekenLink(desc, link(j.uuid)) }) });
    if (r.ok) gezet++; else { fout++; console.log('  FOUT #' + h.serial_no, r.status); }
    await wacht(2600);
  }
  console.log(`${new Date().toISOString()} tekenlink-backfill: had al ${had}, gezet ${gezet}, overgeslagen (geen montage/service) ${over}, fouten ${fout}${DRY ? ' (dry)' : ''}`);
})().catch((e) => { console.error('FOUT', e.message); process.exit(1); });
