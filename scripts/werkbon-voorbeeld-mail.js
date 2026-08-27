#!/usr/bin/env node
// Eenmalig: VOORBEELD-werkbonmail naar een opgegeven adres (Daimy 2026-08-27: "kun je een
// voorbeeld sturen naar daimy@sonty.nl"). Pakt een echte geplande bus-opdracht (of --job <serial>),
// vult de werkbon-velden met duidelijk gemarkeerde voorbeeldantwoorden en mailt hem.
// Gebruik: node scripts/werkbon-voorbeeld-mail.js --aan daimy@sonty.nl [--job 1067] [--nee]
const fs = require('fs');
const path = require('path');
const { bouwWerkbonMail, verstuurWerkbonMail } = require('./lib/werkbon-mail.js');
let planadoFetch; try { ({ planadoFetch } = require('./lib/planado-fetch.js')); } catch { planadoFetch = (u, o) => fetch(u, o); }

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const AAN = arg('--aan'); const SERIAL = arg('--job'); const NEE = process.argv.includes('--nee');
if (!AAN) { console.error('gebruik: --aan <mailadres> [--job <serial>] [--nee]'); process.exit(1); }
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim() };
const BUSSEN = { '1f19ca1a-5a2d': 'Bus 1 | Frenk & Dennis', '1f122f72-777f': 'Bus 2 | Tygo & Kevin', '1f122f37-76db': 'Bus 3 | Yudi & Nick', '1f19ca1c-8ecb': 'Bus 4 | Marvin & Bart', '1f19ca1d-fec8': 'Bus 5 | Marvin & Moa', '1f19ca28-ce10': 'Bus 6 | Arnold' };

(async () => {
  let after = null, gekozen = null, busNaam = 'Bus';
  for (let i = 0; i < 30 && !gekozen; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break;
    for (const j of l) {
      const bus = Object.keys(BUSSEN).find((p) => (j.assignee?.worker_uuid || '').startsWith(p));
      if (!bus) continue;
      if (SERIAL ? String(j.serial_no) === String(SERIAL) : (j.scheduled_at || '') >= '2026-08-26') { gekozen = j; busNaam = BUSSEN[bus]; break; }
    }
    after = l[l.length - 1].uuid;
  }
  if (!gekozen) { console.error('geen bus-opdracht gevonden'); process.exit(1); }
  const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + gekozen.uuid, { headers: PH })).json();
  const job = JSON.parse(JSON.stringify(det.job || det));

  // Voorbeeldantwoorden op de echte werkbon-velden (duidelijk gemarkeerd)
  const nu = new Date().toISOString();
  const vb = NEE ? {
    'werk gereed': false, 'waarom niet': 'VOORBEELD: doek van scherm 2 heeft een krasje, klant wil vervanging',
    'herstellen': 'VOORBEELD: nieuw doek bestellen (Sunmaster, 4500 mm)', 'kleur': 'VOORBEELD: RAL 7016 structuur',
    'producten bij de klant': true, 'hoeveel uur': 'VOORBEELD: 1,5 uur', 'uitleg': 'VOORBEELD: doek wisselen, ladder 6 m nodig',
  } : {
    'werk gereed': true, 'waarom niet': null, 'herstellen': null, 'kleur': 'VOORBEELD: RAL 7016 structuur',
    'producten bij de klant': true, 'hoeveel uur': null, 'uitleg': 'VOORBEELD: n.v.t., alles gemonteerd en getest',
  };
  for (const f of (job.report_fields || [])) {
    const n = (f.name || '').toLowerCase();
    const k = Object.keys(vb).find((key) => n.includes(key));
    if (k !== undefined) { f.value = vb[k]; if (vb[k] !== null && vb[k] !== undefined) f.filled_at = nu; }
    else if (f.data_type === 'boolean') { f.value = true; f.filled_at = nu; }
  }
  job.status = 'finished';
  job.timestamps = { ...(job.timestamps || {}), started_at: nu, finished_at: nu };

  const mail = bouwWerkbonMail(job, busNaam, { voorbeeld: true });
  fs.writeFileSync(path.join(__dirname, '..', 'logs', 'werkbon-voorbeeld-laatste.html'), mail.html);
  const ok = await verstuurWerkbonMail(mail, [AAN]);
  console.log(`${ok ? 'verstuurd' : 'MISLUKT'}: "${mail.onderwerp}" → ${AAN} (opdracht #${job.serial_no}, ${busNaam}, ${(job.report_fields || []).length} velden)`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
