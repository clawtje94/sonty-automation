// Schrijft 3 nieuwe orderrijen naar Planning-sheet tab 2026, rij 1377-1379.
// Weigert te schrijven als de rijen niet leeg zijn. Exit 0 = gelukt, 2 = geen
// schrijfrechten (nog), 1 = andere fout / rijen niet leeg.
const path = require('path');
const { google } = require('/Users/clawdboot/sonty/node_modules/googleapis');
(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: '/Users/clawdboot/sonty/data/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const ID = '1xkQaLKgAgvhP46JtZWRRj2zWpqr5_J5z9xTiiqT9lvs';
  let chk;
  try {
    chk = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: "'2026'!A1377:L1379" });
  } catch (e) {
    if (/permission|caller/i.test(e.message)) { console.log('nog geen (lees)rechten'); process.exit(2); }
    throw e;
  }
  if (chk.data.values && chk.data.values.some((r) => r.length)) {
    console.log('STOP: rijen 1377-1379 niet leeg:', JSON.stringify(chk.data.values));
    process.exit(1);
  }
  const F = (n) => `=IF(H${n + 1060}=TRUE; ""; IF(ISBLANK(F${n}); ""; DATEDIF(F${n}; TODAY(); "D")))`;
  const rows = [
    ['FALSE', 'van der Tak 5401', '', '', 'FAKRO26012480', '20-07-2026', '', '', '', '', 'Fakro dakraamproducten, zie bevestiging V2612088', F(1377)],
    ['FALSE', 'de Groot 5919', '', '', 'D26-001239A', '20-07-2026', '', '', '', '', 'Raamdecoratie binnen (ABZ)', F(1378)],
    ['FALSE', 'Dijk 5442', '', '', '2607947', '17-07-2026', 'week 32', '', '', 'Sunmaster: graag op de lijst in de mail zetten', 'Scherm, spoed (was vergeten te bestellen)', F(1379)],
  ];
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: ID, range: "'2026'!A1377:L1379",
      valueInputOption: 'USER_ENTERED', requestBody: { values: rows },
    });
  } catch (e) {
    if (/permission/i.test(e.message)) { console.log('nog geen schrijfrechten'); process.exit(2); }
    console.log('FOUT:', e.message); process.exit(1);
  }
  const back = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: "'2026'!A1377:L1379" });
  back.data.values.forEach((v, i) => console.log(1377 + i, JSON.stringify(v)));
  console.log('GESCHREVEN OK');
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });
