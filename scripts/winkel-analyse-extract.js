#!/usr/bin/env node
// Winkellocatie-onderzoek stap 1: alle leads uit het offerte-register trekken.
// Akkoord-regel van Daimy (2026-07-02): NIET het akkoord-vinkje gebruiken, maar:
//   inkoopvak gevuld (>0) = akkoord. Inkoop == 1 => nog inmeten => offerteprijs als omzet.
//   Anders: akkoord-bedrag (kolom "Bedrag Akkoord") als omzet, fallback offerteprijs.
// Output: data/winkel-leads.json
const { google } = require('googleapis');
const fs = require('fs');

const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TABS = [
  'Mei 2024', 'Juni 2024', 'Juli 2024', 'Aug 2024', 'Sep 2024', 'Okt 2024', 'Nov 2024', 'Dec 2024',
  'Jan 2025', 'Feb 2025 🐸', 'Maart 2025', 'April 2025', 'Mei 2025 ', 'Juni 2025', 'Juli 2025',
  'Aug 2025', 'Augustus 2025', 'Sep 2025', 'Okt 2025', 'Nov 2025', 'Dec 2025',
  'Jan 2026', 'Feb 2026', 'Maart 2026', 'April 2026', 'Mei 2026', 'Juni 2026 ', 'Juli 2026',
];

function parseGeld(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/te\s*ver/i.test(s)) return 'TE_VER';
  const n = parseFloat(s.replace(/[€\s.]/g, '').replace(',', '.'));
  // "€1.042" -> 1042 via bovenstaande; maar "1042.50" zonder € raakt punt kwijt.
  if (isNaN(n)) return null;
  // correctie: als origineel een punt als decimaal had (bv "5249.6") en geen komma
  if (/^\d+\.\d{1,2}$/.test(s)) return parseFloat(s);
  return n;
}

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: __dirname + '/../data/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const leads = [];
  const tabStats = [];

  for (const tab of TABS) {
    let rows;
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${tab}'!A1:Z3000`,
      });
      rows = r.data.values || [];
    } catch (e) {
      tabStats.push({ tab, error: e.message.slice(0, 60) });
      continue;
    }
    if (rows.length < 4) { tabStats.push({ tab, leeg: true }); continue; }

    // header-rij vinden (bevat "Woonplaats")
    let hIdx = rows.findIndex((r0) => r0.some((c) => /woonplaats/i.test(String(c))));
    if (hIdx < 0) { tabStats.push({ tab, geenHeader: true }); continue; }
    const H = rows[hIdx].map((c) => String(c).trim().toLowerCase());
    const H2 = (rows[hIdx - 1] || []).map((c) => String(c).trim().toLowerCase());
    const col = (pred) => H.findIndex(pred);
    const cPlaats = col((h) => h === 'woonplaats');
    const cBedrag = col((h) => /incl btw/.test(h));
    const cProduct = col((h) => /product/.test(h));
    const cAfkomst = col((h) => /afkomst/.test(h));
    const cWinkelOnline = col((h) => h === 'online');
    const cInkoop = col((h) => /inkoo/.test(h));
    // akkoord-bedrag: header 'akkoord' met daarboven 'bedrag'
    const akkoordCols = H.map((h, i) => (h === 'akkoord' ? i : -1)).filter((i) => i >= 0);
    const cAkkoordBedrag = akkoordCols.find((i) => /bedrag/.test(H2[i] || '')) ?? -1;
    const cDatum = 0;

    let n = 0;
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const plaats = String(row[cPlaats] || '').trim();
      const bedragRaw = parseGeld(row[cBedrag]);
      const datum = String(row[cDatum] || '').trim();
      // rommel-rijen overslaan: geen plaats én geen bedrag
      if (!plaats && bedragRaw == null) continue;
      if (/^hoofd data/i.test(plaats)) continue;

      const teVer = bedragRaw === 'TE_VER' || /te\s*ver/i.test(String(row[cBedrag] || ''));
      const bedrag = teVer ? null : bedragRaw;
      const inkoop = cInkoop >= 0 ? parseGeld(row[cInkoop]) : null;
      const akkoord = typeof inkoop === 'number' && inkoop > 0;
      const akkoordBedrag = cAkkoordBedrag >= 0 ? parseGeld(row[cAkkoordBedrag]) : null;
      let omzet = null;
      if (akkoord) {
        if (inkoop === 1) omzet = typeof bedrag === 'number' ? bedrag : null;
        else omzet = typeof akkoordBedrag === 'number' && akkoordBedrag > 0 ? akkoordBedrag
          : typeof bedrag === 'number' ? bedrag : null;
      }
      leads.push({
        tab, datum, plaats,
        bedrag: typeof bedrag === 'number' ? bedrag : null,
        teVer: !!teVer,
        akkoord,
        inkoop: typeof inkoop === 'number' ? inkoop : null,
        omzet,
        product: cProduct >= 0 ? String(row[cProduct] || '').trim() : '',
        afkomst: cAfkomst >= 0 ? String(row[cAfkomst] || '').trim() : '',
        kanaal: cWinkelOnline >= 0 ? String(row[cWinkelOnline] || '').trim() : '',
      });
      n++;
    }
    tabStats.push({ tab, leads: n });
    await new Promise((r) => setTimeout(r, 300)); // sheets rate limit
  }

  fs.writeFileSync(__dirname + '/../data/winkel-leads.json', JSON.stringify(leads));
  console.log(JSON.stringify(tabStats, null, 1));
  const ok = leads.filter((l) => l.akkoord);
  console.log('\nTOTAAL leads:', leads.length);
  console.log('akkoord (inkoop gevuld):', ok.length, '| waarvan inkoop==1 (nog inmeten):', ok.filter((l) => l.inkoop === 1).length);
  console.log('TE VER:', leads.filter((l) => l.teVer).length);
  console.log('met woonplaats:', leads.filter((l) => l.plaats).length);
  console.log('omzet totaal (akkoord):', '€' + ok.reduce((s, l) => s + (l.omzet || 0), 0).toFixed(0));
  console.log('kanaal Winkel:', leads.filter((l) => /winkel/i.test(l.kanaal)).length, '| Online:', leads.filter((l) => /online/i.test(l.kanaal)).length);
})();
