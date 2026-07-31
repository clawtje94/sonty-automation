#!/usr/bin/env node
// CENTRALE ADVERTENTIEKOSTEN-ADMINISTRATIE (opdracht Daimy 31 juli).
// Verzamelt spend per maand per platform uit alle beschikbare bronnen en schrijft
// data/ad-spend.json. Bronnen, in volgorde van voorkeur:
//   1. data/ad-spend-handmatig.json  — handmatig/geparste rapporten {"2026-07":{"Meta":123,"Google":456}}
//   2. De tab "conversie %" in het offerteregister (kolom kosten; mrt-mei 2025 staat er al)
//   3. (zodra Meta het Creditcard-account openzet of er een system-user-token is: API-collector)
// Alles wat ontbreekt blijft eerlijk leeg — het dashboard toont dan "geen kostendata".
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const UIT = path.join(__dirname, '..', 'data', 'ad-spend.json');
const HANDMATIG = path.join(__dirname, '..', 'data', 'ad-spend-handmatig.json');
const MAAND = { januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12,
  jan:1,feb:2,mrt:3,apr:4,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dec:12 };
const geld = s => { const n = parseFloat(String(s||'').replace(/[€\s.]/g,'').replace(',','.')); return isFinite(n)?n:0; };

(async () => {
  const spend = {}; // "JJJJ-MM" -> {Meta, Google, bron}
  // 2. sheet-tab "conversie %" (structuur: maandnaam-rij, dan Facebook/Google-rijen met kosten in kolom 4)
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname,'..','data','google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'conversie %'!A1:H200` });
  let huidigeMaand = null;
  // Jaartal staat niet in de tab; de bestaande invulling is 2025 (maart-mei). Nieuwe regels
  // kunnen "juli 2026" als maandnaam krijgen — dan pakt de parser het jaar mee.
  for (const rij of (r.data.values || [])) {
    const a = String(rij[0]||'').trim().toLowerCase();
    const jaarMatch = a.match(/^([a-z]+)\s*(\d{4})?$/);
    if (jaarMatch && MAAND[jaarMatch[1]]) { huidigeMaand = `${jaarMatch[2]||2025}-${String(MAAND[jaarMatch[1]]).padStart(2,'0')}`; continue; }
    if (!huidigeMaand) continue;
    const kosten = geld(rij[4]);
    if (!kosten) continue;
    const key = /facebook|meta|insta/.test(a) ? 'Meta' : /google/.test(a) ? 'Google' : null;
    if (!key) continue;
    spend[huidigeMaand] = spend[huidigeMaand] || { bron: 'sheet conversie %' };
    spend[huidigeMaand][key] = (spend[huidigeMaand][key]||0) + kosten;
  }
  // 1. handmatig bestand overschrijft/vult aan
  if (fs.existsSync(HANDMATIG)) {
    const h = JSON.parse(fs.readFileSync(HANDMATIG,'utf8'));
    for (const [m, v] of Object.entries(h)) {
      if (m.startsWith('_')) continue;
      spend[m] = { ...(spend[m]||{}), ...v, bron: ((spend[m]||{}).bron ? spend[m].bron + ' + ' : '') + 'handmatig' };
    }
  }
  fs.writeFileSync(UIT, JSON.stringify(spend, null, 1));
  console.log('ad-spend.json:', Object.keys(spend).sort().map(m => `${m} (${['Meta','Google'].filter(k=>spend[m][k]).join('+')||'leeg'})`).join(', ') || 'geen data');
})();
