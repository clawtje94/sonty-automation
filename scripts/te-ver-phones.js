#!/usr/bin/env node
// Leest het offerte-register (Google Sheet) en geeft de telefoonnummers terug van leads
// die als "TE VER" (kolom F) zijn gemarkeerd. Die mensen mogen GEEN bel-taak krijgen.
// Bron: Daimy — kolom F = bedrag incl btw OF "TE VER", kolom E = telefoon, B/C = naam.
const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const KEYFILE = path.join(__dirname, '..', 'data', 'google-service-account.json');
// Tab-namen zoals in de sheet (let op afkortingen: Maart/Juni/Juli, niet Mrt/Jun/Jul)
const MONTHS = { 1: 'Jan', 2: 'Feb', 3: 'Maart', 4: 'April', 5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Aug', 9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Dec' };

// Normaliseer telefoon naar laatste 9 cijfers (robuust voor +31 / 0031 / 06 / spaties)
function normPhone(p) {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

// Bepaal de relevante maand-tabnamen (huidige + vorige maand) o.b.v. een datum
function recentMonthTitles(now = new Date()) {
  const out = [];
  for (let back = 0; back < 2; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    out.push(`${MONTHS[d.getMonth() + 1]} ${d.getFullYear()}`);
  }
  return out;
}

async function getTeVer(now = new Date()) {
  const auth = new google.auth.GoogleAuth({ keyFile: KEYFILE, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabsByTrim = {};
  for (const s of meta.data.sheets) tabsByTrim[s.properties.title.trim()] = s.properties.title;

  const phones = new Set();
  const names = new Set();
  let scannedTabs = [];
  for (const target of recentMonthTitles(now)) {
    const actual = tabsByTrim[target];
    if (!actual) continue;
    scannedTabs.push(actual.trim());
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${actual}'!A4:F4000` });
    for (const r of (res.data.values || [])) {
      const f = (r[5] || '').toString().trim().toUpperCase();
      if (f !== 'TE VER') continue;
      const ph = normPhone(r[4]);
      if (ph) phones.add(ph);
      const naam = `${(r[1] || '').trim()} ${(r[2] || '').trim()}`.trim().toLowerCase();
      if (naam) names.add(naam);
    }
  }
  return { phones, names, scannedTabs };
}

module.exports = { getTeVer, normPhone };

// CLI: print samenvatting
if (require.main === module) {
  getTeVer().then(({ phones, names, scannedTabs }) => {
    console.log('Tabs gescand:', scannedTabs.join(' | '));
    console.log('TE VER telefoonnummers:', phones.size, '| namen:', names.size);
    console.log('Sample tel:', [...phones].slice(0, 5).join(', '));
  }).catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
