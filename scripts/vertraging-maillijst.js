#!/usr/bin/env node
// Maakt de verzendlijst voor de vertragingsmail: alle regels uit tab "Vertraging. "
// met een geldig mailadres, ontdubbeld per mailadres, met voornaam uit Gripp (ALLEEN-LEZEN, 1 call).
// Output: data/vertraging-maillijst.json + console. Verstuurt NIETS.
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const GRIPP_KEY = 'WZvM6r0bAGGONGRhrkWTxVrydXq9H2';
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TAB = 'Vertraging. ';

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:N300` });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  const mailCol = header.findIndex(h => /mail/i.test(h || ''));
  if (mailCol < 0) throw new Error('Mail-kolom niet gevonden; header: ' + JSON.stringify(header));

  const perMail = new Map();
  const zonderMail = [];
  rows.slice(1).forEach(r => {
    const naam = (r[0] || '').trim();
    if (!naam) return;
    const email = (r[mailCol] || '').trim().toLowerCase();
    const item = { naam, plaats: (r[1] || '').trim(), besteld: (r[4] || '').trim(), product: (r[11] || '').trim() };
    if (!email || !email.includes('@')) { zonderMail.push({ ...item, notitie: (r[mailCol] || '').trim() }); return; }
    if (!perMail.has(email)) perMail.set(email, { email, ...item, regels: 1 });
    else perMail.get(email).regels++;
  });

  // Gripp: voornamen per mailadres, ALLES in 1 batched call
  const emails = [...perMail.keys()];
  const batch = [];
  for (let i = 0; i < emails.length; i += 60) {
    batch.push({ method: 'company.get', params: [[{ field: 'company.email', operator: 'in', value: emails.slice(i, i + 60) }], { paging: { firstresult: 0, maxresults: 250 } }], id: batch.length + 1 });
  }
  const gr = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST', headers: { Authorization: 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!gr.ok) throw new Error('Gripp HTTP ' + gr.status);
  const out = await gr.json();
  const companies = out.flatMap(o => o.result?.rows || []);
  if (companies[0]) console.log('Gripp-velden voorbeeld:', Object.keys(companies[0]).filter(k => /name|first|infix|last/i.test(k)).map(k => k + '=' + JSON.stringify(companies[0][k])).join(' | '));
  const byEmail = {};
  for (const c of companies) { const e = (c.email || '').trim().toLowerCase(); if (e && !byEmail[e]) byEmail[e] = c; }

  const lijst = [...perMail.values()].map(k => {
    const c = byEmail[k.email];
    const voornaam = c ? (c.firstname || '').trim() : '';
    return { ...k, voornaam, grippNaam: c ? (c.searchname || '') : '', inGripp: !!c };
  });

  fs.writeFileSync(path.join(__dirname, '..', 'data', 'vertraging-maillijst.json'), JSON.stringify({ gemaakt: new Date().toISOString(), lijst, zonderMail }, null, 2));
  console.log('\nVERZENDLIJST (' + lijst.length + ' unieke mailadressen):');
  lijst.forEach((k, i) => console.log(String(i + 1).padStart(2) + '. ' + (k.voornaam || '???').padEnd(12) + ' | ' + k.naam.padEnd(32) + ' | ' + k.email + (k.regels > 1 ? '  (' + k.regels + ' orders, 1 mail)' : '')));
  console.log('\nZONDER bruikbaar mailadres (' + zonderMail.length + '):');
  zonderMail.forEach(k => console.log('  - ' + k.naam + (k.notitie ? '  [' + k.notitie + ']' : '')));
  console.log('\nZonder voornaam uit Gripp:', lijst.filter(k => !k.voornaam).length);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
