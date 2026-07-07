#!/usr/bin/env node
// Stap A: haalt ALLE Gripp-opdrachten (projects) en facturen op (gebatcht, met
// beperkte velden) en kruist ze: welke opdracht heeft geen of onvolledige
// facturatie (alleen aanbetaling, geen eindfactuur)?
// Schrijft tussenresultaat naar data/gripp-open-opdrachten.json voor stap B
// (montagedatum uit de planning) en de sheet-tab.
// Gebruik: node scripts/geplaatst-niet-gefactureerd.js

const fs = require('fs');
const path = require('path');

const KEY = 'WZvM6r0bAGGONGRhrkWTxVrydXq9H2';

async function gripp(batch) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!r.ok) throw new Error('Gripp HTTP ' + r.status);
  return r.json();
}

async function haalAlles(entity, fields, filters) {
  const alles = [];
  let first = 0;
  while (true) {
    // 2 pagina's per HTTP-call om requests te sparen
    const batch = [0, 250].map((off, idx) => ({
      method: entity + '.get',
      params: [filters, { paging: { firstresult: first + off, maxresults: 250 }, fields }],
      id: idx + 1,
    }));
    const out = await gripp(batch);
    let klaar = false;
    for (const res of out) {
      if (res.error) throw new Error(entity + ': ' + JSON.stringify(res.error).slice(0, 120));
      const rows = res.result?.rows || [];
      alles.push(...rows);
      if (rows.length < 250) klaar = true;
    }
    process.stdout.write('\r' + entity + ': ' + alles.length + ' opgehaald...');
    if (klaar) break;
    first += 500;
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('');
  return alles;
}

(async () => {
  const projecten = await haalAlles('project',
    ['project.id', 'project.number', 'project.name', 'project.totalinclvat', 'project.company', 'project.createdon', 'project.startdate', 'project.phase'],
    [{ field: 'project.archived', operator: 'equals', value: false }]);

  await new Promise(r => setTimeout(r, 2000));
  const facturen = await haalAlles('invoice',
    ['invoice.id', 'invoice.number', 'invoice.subject', 'invoice.totalinclvat', 'invoice.totalpayed', 'invoice.company', 'invoice.date', 'invoice.status'],
    []);

  // Facturen koppelen: "(NNNN)" in subject = opdracht/offerte-nummer; anders via company
  const factByNummer = {}; // opdrachtnummer → [facturen]
  const factByCompany = {};
  for (const f of facturen) {
    const m = (f.subject || '').match(/\((\d{3,5})\)/);
    if (m) (factByNummer[Number(m[1])] = factByNummer[Number(m[1])] || []).push(f);
    const cid = f.company?.id;
    if (cid) (factByCompany[cid] = factByCompany[cid] || []).push(f);
  }

  const open = [];
  for (const p of projecten) {
    const totaal = Number(p.totalinclvat || 0);
    if (totaal <= 0) continue;
    let fs_ = factByNummer[p.number] || [];
    if (!fs_.length && p.company?.id) fs_ = factByCompany[p.company.id] || [];
    const gefactureerd = fs_.reduce((s, f) => s + Number(f.totalinclvat || 0), 0);
    const dekking = totaal > 0 ? gefactureerd / totaal : 1;
    if (dekking >= 0.95) continue; // volledig gefactureerd (eindfactuur is er)
    open.push({
      nummer: p.number,
      naam: p.name,
      klant: p.company?.searchname || '?',
      companyId: p.company?.id || null,
      opdrachtInclVat: totaal,
      gefactureerd: Math.round(gefactureerd * 100) / 100,
      dekkingPct: Math.round(dekking * 100),
      aantalFacturen: fs_.length,
      opdrachtDatum: p.createdon?.date?.slice(0, 10) || '',
      factuurDatums: fs_.map(f => (f.date?.date || '').slice(0, 10)).filter(Boolean),
    });
  }
  open.sort((a, b) => (a.opdrachtDatum || '').localeCompare(b.opdrachtDatum || ''));

  console.log('Opdrachten totaal:', projecten.length, '| facturen totaal:', facturen.length);
  console.log('NIET volledig gefactureerd (<95% dekking):', open.length);
  const metAanbetaling = open.filter(o => o.aantalFacturen > 0);
  console.log(' - met deelfactuur/aanbetaling maar geen eindfactuur:', metAanbetaling.length);
  console.log(' - helemaal geen factuur:', open.length - metAanbetaling.length);

  fs.writeFileSync(path.join(__dirname, '..', 'data', 'gripp-open-opdrachten.json'), JSON.stringify(open, null, 1));
  console.log('Weggeschreven: data/gripp-open-opdrachten.json');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
