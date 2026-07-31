#!/usr/bin/env node
// Leest per maandtab het "lasten"-blok (Daimy 31 juli: lasten = alle bedrijfslasten
// van die maand BEHALVE ad spend — monteurs, buslease, overhead, alles).
// Schrijft data/maand-lasten.json { "2026-07": 115000, ... }
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const JAREN = {
  2025: { 'Jan 2025': 1, 'Feb 2025 🐸': 2, 'Maart 2025': 3, 'April 2025': 4, 'Mei 2025 ': 5, 'Juni 2025': 6,
          'Juli 2025': 7, 'Aug 2025': 8, 'Sep 2025': 9, 'Okt 2025': 10, 'Nov 2025': 11, 'Dec 2025': 12 },
  2026: { 'Jan 2026': 1, 'Feb 2026': 2, 'Maart 2026': 3, 'April 2026': 4, 'Mei 2026': 5, 'Juni 2026 ': 6, 'Juli 2026': 7 },
};
const geld = s => { const n = parseFloat(String(s || '').replace(/[€\s.]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const uit = {};
  for (const [jaar, tabs] of Object.entries(JAREN)) {
    for (const [tab, mnd] of Object.entries(tabs)) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${tab}'!AA1:AR60` }).catch(() => null);
      if (!r) continue;
      const vals = r.data.values || [];
      buiten: for (let i = 0; i < vals.length; i++) {
        const row = vals[i] || [];
        for (let j = 0; j < row.length; j++) {
          if (String(row[j] || '').trim().toLowerCase() === 'lasten') {
            const w = geld((vals[i + 1] || [])[j]);
            if (w > 1000) { uit[`${jaar}-${String(mnd).padStart(2, '0')}`] = w; break buiten; }
          }
        }
      }
      await new Promise(res => setTimeout(res, 250));
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'maand-lasten.json'), JSON.stringify(uit, null, 1));
  console.log('maand-lasten.json:', Object.entries(uit).sort().map(([m, v]) => `${m}=€${v.toLocaleString('nl-NL')}`).join(', '));
})();
