#!/usr/bin/env node
// Planado-jobs-cache (22-08, voor Sunny's collega-vragen "wie heeft bij X gemonteerd?").
// De Planado-API kent geen datum/zoekfilters (geprobeerd 24-08: alle query-params worden
// genegeerd), dus: alle opdrachten één keer per run doorbladeren (rustig, 2,6 s per
// pagina) en compact wegschrijven. Alleen-lezen.
const fs = require('fs');
const path = require('path');
const K = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + K };
const UIT = path.join(__dirname, '..', 'data', 'planado-jobs-cache.json');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const jobs = [];
  let after = null;
  for (let i = 0; i < 80; i++) {
    // rate limits netjes uitzitten: Planado geeft dan een tekst-body i.p.v. JSON
    let d = null;
    for (let poging = 0; poging < 6 && !d; poging++) {
      const r = await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: H });
      const tekst = await r.text();
      try { d = JSON.parse(tekst); } catch { console.log('pagina ' + i + ': ' + tekst.slice(0, 40) + ' — ' + (30 + poging * 30) + 's wachten'); await wacht((30 + poging * 30) * 1000); }
    }
    if (!d) throw new Error('Planado blijft rate-limiten');
    const l = d.jobs || [];
    if (!l.length) break;
    for (const j of l) {
      jobs.push({
        uuid: j.uuid, scheduled_at: j.scheduled_at || null,
        assignee: j.assignee?.worker_uuid || null,
        omschrijving: String(j.description || '').slice(0, 400),
        adres: j.site?.formatted_address || j.address?.formatted || null,
        status: j.status || null, external_id: j.external_id || null,
      });
    }
    after = l[l.length - 1].uuid;
    await wacht(3500);
  }
  fs.writeFileSync(UIT, JSON.stringify({ ts: Date.now(), aantal: jobs.length, jobs }));
  console.log(new Date().toISOString(), 'planado-jobs-cache:', jobs.length, 'opdrachten');
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
