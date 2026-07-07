#!/usr/bin/env node
// Stap B+C: matcht de open Gripp-opdrachten (data/gripp-open-opdrachten.json)
// met montage-afspraken uit de Outlook-planning (data/outlook-events-2026.json)
// en schrijft de tab "Geplaatst niet gefactureerd" in het offerte-register.
// Match op achternaam/klantnaam in het event-subject ("Montage Sonty - <naam>").
// Alleen events in het VERLEDEN tellen als "geplaatst".
// Gebruik: node scripts/geplaatst-tab-bouwen.js [--dry]

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TAB = 'Geplaatst niet gefactureerd';
const DRY = process.argv.includes('--dry');

const open = require(path.join(__dirname, '..', 'data', 'gripp-open-opdrachten.json'));
const events = require(path.join(__dirname, '..', 'data', 'outlook-events-2026.json'));

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

// Montage-events uit het verleden, niet geannuleerd, geen interne (loods/training)
const nu = new Date();
const montages = events.filter(e =>
  /montage/i.test(e.subject || '') && !e.cancelled &&
  !/loods|training|somfy|voorraad|vrij|vakantie/i.test(e.subject || '') &&
  new Date(e.start) < nu
).map(e => ({ ...e, subjectNorm: norm(e.subject) }));
console.log('Montage-afspraken in het verleden (2026):', montages.length);

// Achternaam-kandidaten uit de Gripp-klantnaam: laatste woord + volledige naam
function naamDelen(klant) {
  const n = norm(klant);
  const woorden = n.split(' ').filter(w => w.length >= 3 && !['van', 'der', 'den', 'de', 'het', 'ten', 'ter'].includes(w));
  const delen = new Set();
  if (n.length >= 5) delen.add(n);
  const laatste = n.split(' ').slice(-2).join(' '); // bv "van dijk"
  if (laatste.length >= 5) delen.add(laatste);
  const laatsteWoord = woorden[woorden.length - 1];
  if (laatsteWoord && laatsteWoord.length >= 4) delen.add(laatsteWoord);
  return [...delen];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Woordgrens-match: "boon" mag niet matchen in "verboon"
const bevatAlsWoorden = (subjectNorm, deel) => new RegExp('\\b' + esc(deel) + '\\b').test(subjectNorm);

const rijen = [];
let metMontage = 0;
for (const o of open) {
  const delen = naamDelen(o.klant);
  const hits = montages.filter(m => delen.some(d => bevatAlsWoorden(m.subjectNorm, d)));
  const datums = [...new Set(hits.map(h => (h.start || '').slice(0, 10)))].sort();
  if (datums.length) metMontage++;
  // Match-kwaliteit: volledige klantnaam in het subject = exact; anders alleen achternaam
  const vol = norm(o.klant);
  const exact = hits.some(h => h.subjectNorm.includes(vol));
  rijen.push({
    ...o,
    montageDatums: datums,
    laatsteMontage: datums[datums.length - 1] || '',
    voorbeeldSubject: hits[0] ? hits[0].subject.slice(0, 60) : '',
    matchKwaliteit: datums.length ? (exact ? 'exact' : 'alleen achternaam — check') : '',
  });
}
console.log('Open opdrachten met montage-afspraak in het verleden:', metMontage, 'van', open.length);

// Sorteer: eerst met montage geweest (oudste montage eerst), dan de rest op opdrachtdatum
rijen.sort((a, b) => {
  if (!!a.laatsteMontage !== !!b.laatsteMontage) return a.laatsteMontage ? -1 : 1;
  return (a.laatsteMontage || a.opdrachtDatum).localeCompare(b.laatsteMontage || b.opdrachtDatum);
});

(async () => {
  if (DRY) {
    for (const r of rijen.filter(r => r.laatsteMontage).slice(0, 25))
      console.log(r.nummer, '|', r.klant.padEnd(28), '| montage', r.laatsteMontage, '| €' + r.opdrachtInclVat, '| gefact', r.dekkingPct + '%', '|', r.voorbeeldSubject);
    console.log('DRY-RUN: geen sheet geschreven.');
    return;
  }
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const bestaat = meta.data.sheets.some(s => s.properties.title === TAB);
  if (!bestaat) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } } }] } });
  }
  const header = ['Gripp nr', 'Klant', 'Opdrachtdatum', 'Opdracht incl BTW', 'Gefactureerd', 'Nog te factureren', 'Dekking %', 'Montage geweest op (agenda)', 'Match', 'Agenda-afspraak', 'Facturen op'];
  const values = [header, ...rijen.map(r => [
    r.nummer, r.klant, r.opdrachtDatum, r.opdrachtInclVat, r.gefactureerd,
    Math.round((r.opdrachtInclVat - r.gefactureerd) * 100) / 100, r.dekkingPct + '%',
    r.montageDatums.join(', '), r.matchKwaliteit, r.voorbeeldSubject, r.factuurDatums.join(', '),
  ])];
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1`, valueInputOption: 'RAW', requestBody: { values } });
  // kopregel vet
  const meta2 = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sid = meta2.data.sheets.find(s => s.properties.title === TAB).properties.sheetId;
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [
    { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
    { updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 220 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: 7, endIndex: 10 }, properties: { pixelSize: 240 }, fields: 'pixelSize' } },
  ] } });
  console.log('Tab "' + TAB + '" geschreven met', rijen.length, 'regels (waarvan', metMontage, 'met montage in het verleden).');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
