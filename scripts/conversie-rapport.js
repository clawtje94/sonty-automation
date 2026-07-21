#!/usr/bin/env node
// Conversierapport op basis van het RP-offerte-archief (data/rp-archief/quotations-*.jsonl,
// aangemaakt door migreer-rp-offertes.js --archief). Conversie = digitaal getekende offertes
// (ACCEPTED) gedeeld door verstuurde offertes (SENT + ACCEPTED + REJECTED); DRAFT telt niet mee.
// LET OP: telefonisch/WhatsApp-akkoord zonder digitale handtekening blijft in RP vaak op SENT
// staan — de echte verkoopconversie ligt dus HOGER dan dit percentage (ondergrens).
// Gebruik: node scripts/conversie-rapport.js [--vanaf 2025-01]
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'rp-archief');
const vanafArg = process.argv[process.argv.indexOf('--vanaf') + 1];
const vanaf = /^\d{4}-\d{2}$/.test(vanafArg || '') ? vanafArg : '2025-01';

const perMaand = {};
for (const f of fs.readdirSync(DIR).filter(f => f.startsWith('quotations-'))) {
  for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').trim().split('\n')) {
    let q; try { q = JSON.parse(line); } catch { continue; }
    const st = q.quotationStatus;
    if (!['SENT', 'ACCEPTED', 'REJECTED'].includes(st)) continue; // DRAFT = nooit verstuurd
    const maand = new Date(q.quotationCreationTimestamp).toISOString().slice(0, 7);
    if (maand < vanaf) continue;
    const m = (perMaand[maand] = perMaand[maand] || { verstuurd: 0, getekend: 0, omzetGetekend: 0 });
    m.verstuurd++;
    if (st === 'ACCEPTED') { m.getekend++; m.omzetGetekend += q.pricing?.total || 0; }
  }
}

const maanden = Object.keys(perMaand).sort();
console.log('maand    | verstuurd | getekend | conversie | omzet getekend');
let totV = 0, totG = 0, totO = 0;
for (const m of maanden) {
  const d = perMaand[m];
  totV += d.verstuurd; totG += d.getekend; totO += d.omzetGetekend;
  console.log(`${m}  | ${String(d.verstuurd).padStart(9)} | ${String(d.getekend).padStart(8)} | ${((d.getekend / d.verstuurd) * 100).toFixed(1).padStart(8)}% | €${Math.round(d.omzetGetekend).toLocaleString('nl-NL')}`);
}
console.log(`TOTAAL   | ${String(totV).padStart(9)} | ${String(totG).padStart(8)} | ${((totG / totV) * 100).toFixed(1).padStart(8)}% | €${Math.round(totO).toLocaleString('nl-NL')}`);
console.log('\nNB: peildatum archief = laatste --archief-run; telefonische akkoorden zonder digitale');
console.log('handtekening staan in RP als SENT en tellen hier dus NIET als getekend (ondergrens).');
