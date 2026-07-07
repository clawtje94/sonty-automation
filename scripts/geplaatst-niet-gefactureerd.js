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

  // Facturen koppelen: "(NNNN)" in subject = opdracht/offerte-nummer; anders via company.
  // Facturen met nummer-match worden EXCLUSIEF aan die opdracht toegerekend; de rest
  // van de facturen van een klant wordt op KLANTNIVEAU vergeleken met de rest van de
  // opdrachten van die klant. Zo kan een klant met meerdere opdrachten nooit dubbel
  // tellen (waardoor een niet-gefactureerde opdracht onterecht uit de lijst zou vallen).
  const factByNummer = {}; // opdrachtnummer → [facturen]
  const factByCompanyRest = {}; // companyId → [facturen zonder herkenbaar opdrachtnummer]
  const projectNummers = new Set(projecten.map(p => p.number));
  for (const f of facturen) {
    const m = (f.subject || '').match(/\((\d{3,5})\)/);
    const nr = m ? Number(m[1]) : null;
    if (nr && projectNummers.has(nr)) {
      (factByNummer[nr] = factByNummer[nr] || []).push(f);
    } else {
      const cid = f.company?.id;
      if (cid) (factByCompanyRest[cid] = factByCompanyRest[cid] || []).push(f);
    }
  }

  const projPerCompany = {};
  for (const p of projecten) if (p.company?.id) (projPerCompany[p.company.id] = projPerCompany[p.company.id] || []).push(p);

  const open = [];
  for (const p of projecten) {
    const totaal = Number(p.totalinclvat || 0);
    if (totaal <= 0) continue;
    const direct = factByNummer[p.number] || [];
    const directBedrag = direct.reduce((s, f) => s + Number(f.totalinclvat || 0), 0);
    // Restfacturen van de klant naar rato verdelen over diens opdrachten ZONDER
    // volledige nummer-dekking (chronologie is niet betrouwbaar te herleiden).
    const rest = p.company?.id ? (factByCompanyRest[p.company.id] || []) : [];
    const restBedragKlant = rest.reduce((s, f) => s + Number(f.totalinclvat || 0), 0);
    const broersZonderDekking = (projPerCompany[p.company?.id] || []).filter(q => {
      const qDirect = (factByNummer[q.number] || []).reduce((s, f) => s + Number(f.totalinclvat || 0), 0);
      return qDirect / Number(q.totalinclvat || 1) < 0.95;
    });
    const totaalBroers = broersZonderDekking.reduce((s, q) => s + Number(q.totalinclvat || 0), 0) || 1;
    const isBroer = broersZonderDekking.some(q => q.number === p.number);
    const restAandeel = isBroer ? restBedragKlant * (totaal / totaalBroers) : 0;
    const gefactureerd = directBedrag + restAandeel;
    const dekking = totaal > 0 ? gefactureerd / totaal : 1;
    if (dekking >= 0.95) continue; // volledig gefactureerd (eindfactuur is er)
    const meerdereOpdrachten = (projPerCompany[p.company?.id] || []).length > 1 && restBedragKlant > 0;
    open.push({
      nummer: p.number,
      naam: p.name,
      klant: p.company?.searchname || '?',
      companyId: p.company?.id || null,
      opdrachtInclVat: totaal,
      gefactureerd: Math.round(gefactureerd * 100) / 100,
      dekkingPct: Math.round(dekking * 100),
      aantalFacturen: direct.length + (isBroer ? rest.length : 0),
      bedragNota: meerdereOpdrachten ? 'klant heeft meerdere opdrachten — bedrag naar rato, check' : '',
      opdrachtDatum: p.createdon?.date?.slice(0, 10) || '',
      factuurDatums: [...direct, ...(isBroer ? rest : [])].map(f => (f.date?.date || '').slice(0, 10)).filter(Boolean),
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
