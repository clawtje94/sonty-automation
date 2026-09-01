#!/usr/bin/env node
// MAANDTAB-MOVER (opdracht Daimy 01-09-2026: "wat in sep 2026 hoort daar in zetten en uit aug
// 2026 halen en nu gewoon verder gaan in sep 2026"). Vangnet voor de maandwissel: rijen in de
// oude maandtab waarvan de datum (kolom A, d-m-jj) in de NIEUWE maand valt, worden verplaatst
// naar de nieuwe maandtab (zelfde kolomvolgorde A:G, gecontroleerd: identiek in beide tabs).
// Werkwijze: eerst appenden in de doeltab, verifiëren, dán pas de bronrijen verwijderen —
// er kan nooit iets verloren gaan. Gebruik: node scripts/sheet-maand-mover.js [--droog]
//   BRON/DOEL hieronder per maandwissel aanpassen (of automatiseren als dit bevalt).
const { google } = require('googleapis');
const BRON = 'Aug 2026', DOEL = 'Sep 2026';
const HOORT_IN_DOEL = (d) => /^\d{1,2}-9-26$/.test(String(d || '').trim()); // september 2026
const DROOG = process.argv.includes('--droog');
const ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: 'data/google-service-account.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const bronId = meta.data.sheets.find((s) => s.properties.title === BRON)?.properties.sheetId;
  if (bronId === undefined) { console.error(`tab ${BRON} niet gevonden`); process.exit(1); }
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${BRON}'!A:G` });
  const rows = r.data.values || [];
  const verplaats = []; // {rij (1-based), data}
  rows.forEach((rij, i) => { if (HOORT_IN_DOEL(rij[0])) verplaats.push({ rij: i + 1, data: rij }); });
  console.log(`${BRON}: ${rows.length} rijen, ${verplaats.length} horen in ${DOEL}`);
  if (!verplaats.length) { console.log('niets te verplaatsen'); return; }
  verplaats.forEach((v) => console.log('  rij', v.rij, ':', JSON.stringify(v.data).slice(0, 110)));
  if (DROOG) { console.log('[droog] niets gewijzigd'); return; }
  // 1) toevoegen aan doel
  await sheets.spreadsheets.values.append({ spreadsheetId: ID, range: `'${DOEL}'!A:G`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: verplaats.map((v) => v.data) } });
  // 2) verifiëren dat ze in doel staan (op RP-nummer, kolom G)
  const check = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${DOEL}'!A:G` });
  const doelNrs = new Set((check.data.values || []).map((x) => String(x[6] || '')));
  const mis = verplaats.filter((v) => !doelNrs.has(String(v.data[6] || '')));
  if (mis.length) { console.error(`STOP: ${mis.length} rij(en) niet teruggevonden in ${DOEL} — bron NIET opgeschoond`); process.exit(1); }
  // 3) uit bron verwijderen, van onder naar boven (rijnummers verschuiven anders)
  const requests = verplaats.sort((a, b) => b.rij - a.rij).map((v) => ({
    deleteDimension: { range: { sheetId: bronId, dimension: 'ROWS', startIndex: v.rij - 1, endIndex: v.rij } } }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests } });
  console.log(`klaar: ${verplaats.length} rij(en) verplaatst naar ${DOEL} en uit ${BRON} gehaald`);
})();
