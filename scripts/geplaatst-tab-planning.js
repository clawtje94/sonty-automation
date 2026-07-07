#!/usr/bin/env node
// Definitieve versie van de tab "Geplaatst niet gefactureerd", nu op basis van
// Daimy's Planning-sheet (xlsx, tabs 2025+2026) i.p.v. agenda-naam-matching.
// Per open Gripp-opdracht (data/gripp-open-opdrachten.json):
//  - montagedatum(s) uit "Datum gepland" (verleden = geplaatst)
//  - openstaande planning-regels (toekomst of nog niet ingepland) = nalevering
//    of plaatsing die nog moet → APART: "NIET FACTUREREN"
// Gebruik: node scripts/geplaatst-tab-planning.js <pad-naar-lees-xlsx-dir> [--dry]

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const XLSX_DIR = process.argv[2];
if (!XLSX_DIR) { console.error('geef het pad naar de map met lees-xlsx.js + planning-x'); process.exit(1); }
const { leesSheet } = require(path.join(XLSX_DIR, 'lees-xlsx.js'));
const DRY = process.argv.includes('--dry');

const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TAB = 'Geplaatst niet gefactureerd';
const open = require(path.join(__dirname, '..', 'data', 'gripp-open-opdrachten.json'));

const VANDAAG_SERIAL = (Date.now() - Date.UTC(1899, 11, 30)) / 86400000;
const serialNaarDatum = (n) => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86400000).toISOString().slice(0, 10);
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. Planning-regels inlezen (tabs 2023 t/m 2026 = sheet1 t/m sheet4; incl. verborgen rijen)
const TABNAAM = { 1: '2023', 2: '2024', 3: '2025', 4: '2026' };
const planRegels = [];
for (const nr of ['1', '2', '3', '4']) {
  const rows = leesSheet(nr);
  rows.forEach((r, i) => {
    if (!r || !r[1] || !String(r[1]).trim() || i === 0) return;
    const naam = String(r[1]).trim();
    let gripNr = naam.match(/\b(\d{4})\b/)?.[1] || null;
    if (!gripNr && /^\d{4}(\.0)?$/.test(String(r[9] || '').trim())) gripNr = String(r[9]).trim().replace('.0', '');
    const geplandSerial = Number(r[7]) > 40000 ? Number(r[7]) : null;
    planRegels.push({
      tab: TABNAAM[nr], rij: i + 1, naam, naamNorm: norm(naam.replace(/\b\d{4}\b/, '')),
      plaats: String(r[2] || '').trim(), gripNr: gripNr ? Number(gripNr) : null,
      gepland: geplandSerial ? serialNaarDatum(geplandSerial) : null,
      inVerleden: geplandSerial ? geplandSerial <= VANDAAG_SERIAL : false,
      team: String(r[8] || '').trim(), opmerking: String(r[9] || '').trim(),
      besteld: Number(r[5]) > 40000 ? serialNaarDatum(r[5]) : '',
      wat: String(r[10] || '').trim(),
      isNalevering: /nalever|nabestell/i.test(naam + ' ' + (r[9] || '')),
    });
  });
}
console.log('Planning-regels ingelezen:', planRegels.length, '| met Gripp-nr:', planRegels.filter(p => p.gripNr).length);

// 2. Match per open opdracht
function naamDelen(klant) {
  const n = norm(klant);
  const woorden = n.split(' ').filter(w => w.length >= 4 && !['van', 'der', 'den', 'het', 'ten', 'ter'].includes(w));
  const delen = new Set();
  if (n.length >= 5) delen.add(n);
  const laatste = n.split(' ').slice(-2).join(' ');
  if (laatste.length >= 5) delen.add(laatste);
  if (woorden.length) delen.add(woorden[woorden.length - 1]);
  return [...delen];
}

const rijen = [];
for (const o of open) {
  let regels = planRegels.filter(p => p.gripNr === o.nummer);
  let matchType = regels.length ? 'Gripp-nr' : '';
  if (!regels.length) {
    const delen = naamDelen(o.klant);
    regels = planRegels.filter(p => delen.some(d => new RegExp('\\b' + esc(d) + '\\b').test(p.naamNorm)));
    if (regels.length) {
      const volle = regels.filter(p => p.naamNorm.includes(norm(o.klant)));
      if (volle.length) { regels = volle; matchType = 'naam exact'; }
      else matchType = 'achternaam — check';
    }
  }
  const geplaatst = regels.filter(p => p.inVerleden);
  const openstaand = regels.filter(p => !p.inVerleden); // toekomst of nog niet ingepland
  const nalevering = openstaand.length > 0 && geplaatst.length > 0; // al iets geplaatst, maar er staat nog wat open
  const nogNiks = regels.length > 0 && geplaatst.length === 0;

  let status;
  if (!regels.length) status = 'niet in planning-sheet';
  else if (openstaand.length) status = nalevering ? 'NALEVERING OPEN — NIET FACTUREREN' : 'NOG NIET GEPLAATST — NIET FACTUREREN';
  else status = 'GEPLAATST — kan eindfactuur';
  if (nogNiks && !openstaand.length) status = 'NOG NIET GEPLAATST — NIET FACTUREREN'; // vangnet (regels zonder datum zitten in openstaand)

  rijen.push({
    ...o, status, matchType,
    geplaatstOp: [...new Set(geplaatst.map(p => p.gepland))].sort().join(', '),
    openstaandeRegels: openstaand.map(p => (p.gepland ? 'gepland ' + p.gepland : 'nog niet ingepland') + (p.isNalevering ? ' (nalevering)' : '') + (p.wat ? ': ' + p.wat.slice(0, 40) : '')).join(' | ').slice(0, 160),
    team: [...new Set(regels.map(p => p.team).filter(Boolean))].join(', ').slice(0, 40),
    opmerking: [...new Set(regels.map(p => p.opmerking).filter(o2 => o2 && !/^\d+(\.0)?$/.test(o2)))].join(' | ').slice(0, 120),
  });
}

const volgorde = ['GEPLAATST — kan eindfactuur', 'NALEVERING OPEN — NIET FACTUREREN', 'NOG NIET GEPLAATST — NIET FACTUREREN', 'niet in planning-sheet'];
rijen.sort((a, b) => volgorde.indexOf(a.status) - volgorde.indexOf(b.status) || (a.geplaatstOp || a.opdrachtDatum).localeCompare(b.geplaatstOp || b.opdrachtDatum));

const telling = {};
for (const r of rijen) telling[r.status] = (telling[r.status] || 0) + 1;
console.log('Per status:', JSON.stringify(telling, null, 1));
const klaar = rijen.filter(r => r.status === 'GEPLAATST — kan eindfactuur');
console.log('Klaar voor eindfactuur: €' + Math.round(klaar.reduce((s, r) => s + r.opdrachtInclVat - r.gefactureerd, 0)).toLocaleString('nl-NL'));

(async () => {
  if (DRY) {
    for (const r of rijen.slice(0, 20)) console.log(r.status.slice(0, 22).padEnd(24), '|', String(r.nummer).padEnd(5), '|', r.klant.slice(0, 24).padEnd(25), '|', r.geplaatstOp || '-', '|', r.openstaandeRegels || '');
    return console.log('DRY-RUN, geen sheet geschreven.');
  }
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const header = ['Status', 'Gripp nr', 'Klant', 'Geplaatst op', 'Nog open in planning', 'Opdracht incl BTW', 'Gefactureerd', 'Nog te factureren', 'Team', 'Opmerking planning', 'Opdrachtdatum', 'Match', 'Bedrag-notitie'];
  const values = [header, ...rijen.map(r => [
    r.status, r.nummer, r.klant, r.geplaatstOp, r.openstaandeRegels,
    r.opdrachtInclVat, r.gefactureerd, Math.round((r.opdrachtInclVat - r.gefactureerd) * 100) / 100,
    r.team, r.opmerking, r.opdrachtDatum, r.matchType, r.bedragNota || '',
  ])];
  // Oude inhoud wissen zodat er geen restjes van de vorige versie blijven staan
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:Z600` });
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1`, valueInputOption: 'RAW', requestBody: { values } });
  console.log('Tab herschreven met', rijen.length, 'regels.');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
