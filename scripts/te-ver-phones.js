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

// Bepaal de relevante maanden (huidige + vorige maand) o.b.v. een datum
function recentMonthTitles(now = new Date()) {
  const out = [];
  for (let back = 0; back < 2; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    out.push(`${MONTHS[d.getMonth() + 1]} ${d.getFullYear()}`);
  }
  return out;
}

// Vind alle tabs die bij een maand horen — robuust tegen naamvarianten.
// De sheet bevat historisch zowel "Aug 2025" als "Augustus 2025": match daarom op
// maandprefix (eerste 3 letters, case-insensitive) + jaartal i.p.v. exacte naam.
// NL-maandprefixen (jan/feb/maa/apr/mei/jun/jul/aug/sep/okt/nov/dec) zijn uniek.
function findMonthTabs(allTitles, target) {
  const m = target.match(/^(\S+)\s+(\d{4})$/);
  if (!m) return [];
  const prefix = m[1].slice(0, 3).toLowerCase();
  const year = m[2];
  return allTitles.filter(t => {
    const tt = t.trim().toLowerCase();
    return tt.startsWith(prefix) && tt.includes(year);
  });
}

async function getTeVer(now = new Date()) {
  const auth = new google.auth.GoogleAuth({ keyFile: KEYFILE, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const allTitles = meta.data.sheets.map(s => s.properties.title);

  const phones = new Set();           // TE VER (kolom F)
  const names = new Set();
  const akkoordPhones = new Set();     // al akkoord/ingekocht: inkoop (W) gevuld of akkoord (L) = TRUE
  const akkoordNames = new Set();
  const num = (v) => { const d = String(v || '').replace(/[^\d]/g, ''); return d ? parseInt(d, 10) : 0; };
  let scannedTabs = [];
  const missingMonths = [];
  const tabsToScan = [];
  for (const target of recentMonthTitles(now)) {
    const matches = findMonthTabs(allTitles, target);
    if (!matches.length) {
      // WAARSCHUWING: zonder deze tab vervalt de TE VER-uitsluiting voor die maand
      console.warn(`⚠️ TE VER: geen maandtab gevonden voor "${target}" — uitsluitingen van die maand ontbreken!`);
      missingMonths.push(target);
      continue;
    }
    tabsToScan.push(...matches);
  }
  for (const actual of tabsToScan) {
    scannedTabs.push(actual.trim());
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${actual}'!A4:W4000` });
    for (const r of (res.data.values || [])) {
      const ph = normPhone(r[4]);
      const naam = `${(r[1] || '').trim()} ${(r[2] || '').trim()}`.trim().toLowerCase();
      const f = (r[5] || '').toString().trim().toUpperCase();       // F: bedrag of TE VER
      const akkoord = (r[11] || '').toString().trim().toUpperCase(); // L: Akkoord TRUE/FALSE
      const inkoop = num(r[22]);                                     // W: inkoop incl btw
      if (f === 'TE VER') {
        if (ph) phones.add(ph);
        if (naam) names.add(naam);
      }
      if (inkoop > 0 || ['TRUE', 'WAAR', 'JA'].includes(akkoord)) {  // al akkoord -> niet bellen
        if (ph) akkoordPhones.add(ph);
        if (naam) akkoordNames.add(naam);
      }
    }
  }
  return { phones, names, akkoordPhones, akkoordNames, scannedTabs, missingMonths };
}

module.exports = { getTeVer, normPhone };

// CLI: print samenvatting
if (require.main === module) {
  getTeVer().then(({ phones, names, akkoordPhones, akkoordNames, scannedTabs }) => {
    console.log('Tabs gescand:', scannedTabs.join(' | '));
    console.log('TE VER telefoonnummers:', phones.size, '| namen:', names.size);
    console.log('AKKOORD/ingekocht telefoonnummers:', akkoordPhones.size, '| namen:', akkoordNames.size);
  }).catch(e => { console.error('FOUT:', e.message); process.exit(1); });
}
