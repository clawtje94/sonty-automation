#!/usr/bin/env node
// Audit (Daimy 2026-08-05: "heeft iedereen de link naar de JUISTE meetbon?"):
// per verrijkte inmeet-opdracht controleren dat het Gripp-nummer in de opdracht
// hoort bij een klant op HETZELFDE adres als waar de inmeter naartoe rijdt.
// Postcode+huisnummer vergelijken; zonder postcode telefoonnummer. READ-ONLY.
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const GRIPP = require('./secrets.js').GRIPP_API_KEY;
const PH = { Authorization: 'Bearer ' + KEY };
const INMETERS = {
  '1f122cfa-17a2-6580-8257-7e80f004db9c': 'Joey',
  '1f122d19-e43e-6da0-8ffb-661a4ff9bb36': 'Sjoerd',
};
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function gripp(method, params) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + GRIPP, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ method, params, id: 1 }]),
  });
  return (await r.json())?.[0]?.result;
}

const pcVan = (s) => ((String(s || '').match(/(\d{4})\s*([A-Za-z]{2})/) || [])[0] || '').replace(/\s/g, '').toUpperCase();
const cijfers = (s) => String(s || '').replace(/\D/g, '').slice(-9);

async function main() {
  const jobs = [];
  let after = null;
  for (let i = 0; i < 30; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    jobs.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(2600);
  }
  const nu = Date.now();
  const doel = jobs.filter((j) => j.scheduled_at && Date.parse(j.scheduled_at) > nu && INMETERS[j.assignee?.worker_uuid]);

  let ok = 0, mis = 0, geenKoppeling = 0, nietTeChecken = 0;
  const missers = [];
  for (const j of doel) {
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);
    const nr = (String(job.description || '').match(/Gripp:\s*(\d+)/) || [])[1];
    const isInmeet = /inmeet|inmeten/i.test(job.description || '');
    if (!isInmeet) continue;
    if (!nr) { geenKoppeling++; continue; }

    const res = await gripp('offer.get', [
      [{ field: 'offer.number', operator: 'equals', value: Number(nr) }],
      { paging: { firstresult: 0, maxresults: 1 } },
    ]);
    await wacht(1600);
    const offerte = res?.rows?.[0];
    const compId = offerte?.company?.id;
    if (!compId) { nietTeChecken++; continue; }
    const c = await gripp('company.get', [
      [{ field: 'company.id', operator: 'equals', value: compId }],
      { paging: { firstresult: 0, maxresults: 1 } },
    ]);
    await wacht(1600);
    const comp = c?.rows?.[0] || {};

    const jobPc = pcVan(job.address?.formatted);
    const grippPc = pcVan(comp.visitingaddress_zipcode);
    const jobTel = cijfers((job.contacts || []).find((x) => x.type === 'phone')?.value);
    const grippTel = cijfers(comp.phone) || cijfers(comp.mobile);

    let oordeel;
    if (jobPc && grippPc) oordeel = jobPc === grippPc ? 'OK-adres' : 'MIS-adres';
    else if (jobTel && grippTel && jobTel.length === 9) oordeel = jobTel === grippTel ? 'OK-telefoon' : 'MIS-telefoon';
    else oordeel = 'niet-te-checken';

    if (oordeel.startsWith('OK')) ok++;
    else if (oordeel.startsWith('MIS')) {
      mis++;
      missers.push(`#${job.serial_no} ${(job.description || '').split('\n')[0].slice(0, 34)} | Gripp ${nr} (${comp.searchname}) | job-pc ${jobPc || '-'} vs gripp-pc ${grippPc || '-'}`);
    } else nietTeChecken++;
  }
  console.log(`\nAUDIT: ${ok} kloppen (adres of telefoon bevestigd) | ${mis} MOGELIJK FOUT | ${geenKoppeling} zonder koppeling | ${nietTeChecken} niet hard te checken`);
  if (missers.length) console.log('MOGELIJK FOUT:\n  ' + missers.join('\n  '));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
