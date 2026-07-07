#!/usr/bin/env node
// Vult in de tab "Vertraging. " kolom L ("tijd aan het wachten sinds bestelling")
// met een zichzelf bijwerkende formule: weken sinds de Besteld-datum (kolom E).
// Datums als "1-12", "9-feb", "25-mrt" worden geparsed; nov/dec = 2025, rest 2026.
// Gebruik: node scripts/vertraging-wachtweken.js [--dry]

const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TAB = 'Vertraging. ';
const DRY = process.argv.includes('--dry');
const INTERN = /^(levering\b|somfy\b|voorraad\b|vriend joey|show jo\b|sjoerd prive|daimi$|marvin zzp|leco van zadelhoff)/i;

const MAANDEN = { jan: 1, feb: 2, mrt: 3, maa: 3, apr: 4, mei: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12 };

function parseBesteld(s) {
  if (!s) return null;
  const m = s.trim().toLowerCase().match(/^(\d{1,2})[-\/\s]([a-z]+|\d{1,2})$/);
  if (!m) return null;
  const dag = Number(m[1]);
  let maand = /^\d+$/.test(m[2]) ? Number(m[2]) : MAANDEN[m[2].slice(0, 3)];
  if (!maand || maand > 12 || dag < 1 || dag > 31) return null;
  // Geen jaartal in de sheet: maanden die nog niet geweest zijn dit jaar = vorig jaar
  const nu = new Date();
  const jaar = maand > nu.getMonth() + 1 ? nu.getFullYear() - 1 : nu.getFullYear();
  return { jaar, maand, dag };
}

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:L200` });
  const rows = res.data.values || [];

  const updates = [];
  let gevuld = 0, geenDatum = 0;
  rows.forEach((row, i) => {
    const rij = i + 1;
    if (rij === 1) return;
    const naam = (row[0] || '').trim();
    if (!naam || INTERN.test(naam)) return;
    const huidigeL = (row[11] || '').trim();
    if (huidigeL && !huidigeL.startsWith('#')) return; // kolom L al goed gevuld (foutcellen overschrijven)
    const d = parseBesteld(row[4]);
    if (!d) { if ((row[4] || '').trim()) console.log('  ? datum onleesbaar rij ' + rij + ' (' + naam + '): "' + row[4] + '"'); geenDatum++; return; }
    // Sheet staat op NL-locale: puntkomma als argumentscheider (komma gaf #ERROR!)
    const formule = `=ROUND((TODAY()-DATE(${d.jaar};${d.maand};${d.dag}))/7;0)&" weken"`;
    updates.push({ range: `'${TAB}'!L${rij}`, values: [[formule]] });
    const weken = Math.round((Date.now() - new Date(d.jaar, d.maand - 1, d.dag).getTime()) / (7 * 86400000));
    console.log('rij ' + String(rij).padEnd(4) + naam.padEnd(38) + ' besteld ' + `${d.dag}-${d.maand}-${d.jaar}`.padEnd(11) + ' → ' + weken + ' weken');
    gevuld++;
  });

  if (!DRY && updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
    });
    console.log('\nWeggeschreven: ' + updates.length + ' formules (werken automatisch bij met de dag).');
  } else if (DRY) console.log('\nDRY-RUN: niets weggeschreven.');
  console.log('Gevuld: ' + gevuld + ' | zonder besteldatum: ' + geenDatum);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
