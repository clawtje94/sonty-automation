// Verwerkt de 42 ongelezen orders@-mails (22-07-2026) in tab "Claude ai test":
// - bestaande orderrijen: "Geleverd op" bijwerken o.b.v. laadmeldingen/levermeldingen
// - nieuwe orders: rijen toevoegen vanaf rij 1383
// Elke aangeraakte rij wordt lichtblauw (#CFE2F3) en krijgt een celnotitie in kolom A.
// Dubbel-check vooraf: nieuwe ordernummers mogen nog niet in de tab staan.
const { google } = require('/Users/clawdboot/sonty/node_modules/googleapis');

const ID = '1xkQaLKgAgvhP46JtZWRRj2zWpqr5_J5z9xTiiqT9lvs';
const SHEET_ID = 273253041;
const BLAUW = { red: 0.812, green: 0.886, blue: 0.953 };
const STAMP = '22-07-2026 Claude (test): ';
const START_NIEUW = 1383;

// Bestaande rijen: [rij, nieuweG of null, notitie]
const UPDATES = [
  [1045, '22-07-2026', 'AANGEPAST: Laadmelding NE (Unilux 1202680001, 21/22-07): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" 21-07 -> 22-07.'],
  [1276, '22-07-2026', 'AANGEPAST: 6 laadmeldingen NE (Unilux 1192191001 t/m 006, 6 colli): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" 21-07 -> 22-07.'],
  [1346, '22-07-2026', 'AANGEPAST: 4 laadmeldingen NE (Unilux 1202793001 t/m 004): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" 21-07 -> 22-07.'],
  [1016, '22-07-2026', 'AANGEPAST: 3 laadmeldingen NE (Unilux 1202789004, 005 en CV1202789002): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" 21-07 -> 22-07.'],
  [1046, '22-07-2026', 'AANGEPAST: 4 laadmeldingen NE (Unilux 1195641001 t/m 004): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" 21-07 -> 22-07. Geplande datum 30-07 (Jorren & Marvin) ongewijzigd.'],
  [1307, '22-07-2026', 'AANGEPAST: 2 laadmeldingen NE (Unilux 1195672001, 002): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" 21-07 -> 22-07.'],
  [1054, '22-07-2026', 'AANGEPAST: Laadmelding NE (Unilux 1205584002, colli 2): verwachte aankomst wo 22 juli 08:00-11:00. "Geleverd op" stond op 17-07 -> 22-07. CONTROLEREN: mogelijk deellevering (colli 2 van eerdere order).'],
  [1262, '23-07-2026', 'AANGEPAST: ROMA levermelding (21-07): levering do 23 juli 09:00-11:30 bij BKW Groep, Berkel en Rodenrijs (order 8585407). "Geleverd op" 21-07 -> 23-07.'],
  [1055, '23-07-2026', 'AANGEPAST: ROMA levermelding (21-07): levering do 23 juli 09:00-11:30 (order 8630378). "Geleverd op" 24-07 -> 23-07.'],
  [1235, '23-07-2026', 'AANGEPAST: ROMA levermelding (21-07): levering do 23 juli 09:00-11:30 (order 8585400). "Geleverd op" 21-07 -> 23-07.'],
  [1068, null, 'GEEN VELDWIJZIGING, WEL ACTIE: Sunmaster stuurde 22-07 een GEWIJZIGDE orderbevestiging voor 2606004 (Voorraad schermen). De wijziging staat in de PDF-bijlage en is niet automatisch uit te lezen — handmatig PDF controleren.'],
];

// Nieuwe rijen: [A..K (11 kolommen), notitie]
const NIEUW = [
  [['FALSE','Hachioui 6018','','','2609516','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609516, referentie Hachioui (6018), mail 22-07. Productdetails in PDF-bijlage (niet uitgelezen).'],
  [['FALSE','Sjoerd (prive)','','','2607506','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster ORDERbevestiging 2607506, referentie Sjoerd (prive), mail 22-07. Stond nog niet in de sheet. Bevestigde leverdatum staat in de PDF-bijlage.'],
  [['FALSE','Bosman 5861','','','2609523','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609523, referentie Bosman (5861), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Wijsman 3432','','','2609526','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609526, referentie Wijsman (3432), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Groenendijk-Li 6014','','','2609530','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609530, referentie Groenendijk-Li (6014), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Teeninga 6278','','','2609531','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609531, referentie Teeninga (6278), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Boukes 6020','','','2609532','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609532, referentie Boukes (6020), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Rai 6029','','','2609533','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609533, referentie Rai (6029), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Zeestraten 5958','','','2609540','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609540, referentie Zeestraten (5958), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Hooijberg 6015','','','2609541','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609541, referentie Hooijberg (6015), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','van der lans 6138 (samenwerking)','','','2609543','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609543, referentie van der lans (6138, samenwerking), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','van nieuwenhoven 6092','','','2609545','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609545, referentie van nieuwenhoven (6092), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','Kreuger 5951','','','2609547','22-07-2026','','','','','Sunmaster, productdetails in PDF-bijlage'],
   'NIEUW: Sunmaster portaalbevestiging 2609547, referentie Kreuger (5951), mail 22-07. Details in PDF-bijlage.'],
  [['FALSE','(naam in PDF)','','','26084369','21-07-2026','','','','','Toppoint, orderbevestiging in PDF-bijlage'],
   'NIEUW: Toppoint orderbevestiging 26084369 (mail 21-07, "in productie genomen"). Klantnaam staat alleen in de PDF-bijlage. Ordernr niet gevonden in de sheet.'],
  [['FALSE','(niet gevonden in sheet)','','','82605208','','22-07-2026','','','','Toppoint Blinds, zie laadmelding'],
   'LET OP: Laadmelding NE voor Toppoint Blinds 82605208, verwachte aankomst wo 22 juli 08:00-11:00, maar dit ordernummer staat nergens in de sheet. Handmatig uitzoeken welke klant dit is.'],
  [['FALSE','Adriaans nabestelling','','','(zie PDF)','22-07-2026','','','','','Unilux, orderbevestiging in PDF-bijlage'],
   'NIEUW: Unilux orderbevestiging "Adriaans Nabestelling" (mail 22-07). Ordernummer en details staan alleen in de PDF-bijlage.'],
  [['FALSE','(klant onbekend)','','','1090-5031824825','20-07-2026','','','','','Velux, orderbevestiging in PDF-bijlage'],
   'NIEUW: Velux orderbevestiging 1090-5031824825, besteld 20-07 via info@sonty.nl (doorgestuurd naar orders@ op 22-07). Klantreferentie staat alleen in de bijlage.'],
  [['FALSE','RETOUR Toppoint SN82606373','','','SN82606373','','','','','Afhaaldag bevestigen bij NE (voor 16:30 = volgende werkdag ophalen)','Retourzending Toppoint Blinds'],
   'ACTIE NODIG: Herinnering van NE (22-07): retouropdracht SN82606373 (Toppoint Blinds) wacht op bevestiging van de afhaaldag. Geen order, maar actiepunt.'],
];

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: '/Users/clawdboot/sonty/data/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Dubbel-check 1: nieuwe ordernummers mogen nog nergens in de tab staan
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: "'Claude ai test'!E1:E1720" });
  const eKol = (r.data.values || []).map((v) => String(v[0] || '').trim());
  const nieuweNrs = NIEUW.map(([row]) => row[4]).filter((n) => /\d/.test(n));
  for (const nr of nieuweNrs) {
    const hit = eKol.findIndex((e) => e === nr);
    if (hit >= 0) { console.log(`STOP: ordernr ${nr} staat al op rij ${hit + 1}`); process.exit(1); }
  }
  // Dubbel-check 2: doelrijen voor nieuwe orders moeten leeg zijn (B en E)
  const chk = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'Claude ai test'!B${START_NIEUW}:E${START_NIEUW + NIEUW.length - 1}` });
  if ((chk.data.values || []).some((row) => String(row[0] || '').trim() || String(row[3] || '').trim())) {
    console.log('STOP: doelrijen niet leeg:', JSON.stringify(chk.data.values)); process.exit(1);
  }

  // 1) Waarden: G-updates + nieuwe rijen (incl. L-formule in sheet-eigen vorm H{n+1060})
  const data = UPDATES.filter(([, g]) => g).map(([rij, g]) => ({ range: `'Claude ai test'!G${rij}`, values: [[g]] }));
  const nieuweValues = NIEUW.map(([row], i) => {
    const n = START_NIEUW + i;
    return [...row, `=IF(H${n + 1060}=TRUE; ""; IF(ISBLANK(F${n}); ""; DATEDIF(F${n}; TODAY(); "D")))`];
  });
  data.push({ range: `'Claude ai test'!A${START_NIEUW}:L${START_NIEUW + NIEUW.length - 1}`, values: nieuweValues });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  // 2) Opmaak + notities
  const requests = [];
  const blauwRij = (rij0, aantal = 1) => requests.push({ repeatCell: {
    range: { sheetId: SHEET_ID, startRowIndex: rij0, endRowIndex: rij0 + aantal, startColumnIndex: 0, endColumnIndex: 12 },
    cell: { userEnteredFormat: { backgroundColor: BLAUW } }, fields: 'userEnteredFormat.backgroundColor' } });
  const notitie = (rij0, tekst) => requests.push({ updateCells: {
    range: { sheetId: SHEET_ID, startRowIndex: rij0, endRowIndex: rij0 + 1, startColumnIndex: 0, endColumnIndex: 1 },
    rows: [{ values: [{ note: STAMP + tekst }] }], fields: 'note' } });
  for (const [rij, , tekst] of UPDATES) { blauwRij(rij - 1); notitie(rij - 1, tekst); }
  blauwRij(START_NIEUW - 1, NIEUW.length);
  NIEUW.forEach(([, tekst], i) => notitie(START_NIEUW - 1 + i, tekst));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests } });

  // Terugleescontrole
  const back = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'Claude ai test'!A${START_NIEUW}:L${START_NIEUW + NIEUW.length - 1}` });
  (back.data.values || []).forEach((v, i) => console.log(START_NIEUW + i, JSON.stringify(v.slice(0, 7))));
  const gBack = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: "'Claude ai test'!G1045" });
  console.log('G1045 nu:', JSON.stringify(gBack.data.values));
  console.log('GESCHREVEN OK');
})().catch((e) => { console.log('FOUT:', e.message); process.exit(1); });
