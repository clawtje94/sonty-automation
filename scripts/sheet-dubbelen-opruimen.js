#!/usr/bin/env node
/**
 * DUBBELE RIJEN OPRUIMEN IN HET OFFERTE-REGISTER (opdracht Daimy 2026-08-03).
 *
 * Aanleiding: de dedupe in v4 las maar tot rij 2000 terwijl er tot 3000 geschreven wordt,
 * waardoor offertes voorbij rij 2000 elke run opnieuw werden toegevoegd. Dat is gefixt
 * (commit db85a06); dit script haalt de rijen weg die er al door ontstaan zijn.
 *
 * REGEL VAN DAIMY: dubbele rijen mogen weg zolang er geen bedrag bij de inkoop staat.
 * Strikter uitgevoerd, want administratie mag je nooit kwijtraken: een rij blijft staan als
 * er IETS in staat bij inkoop, akkoord, Gripp-nummer, akkoordbedrag of inmeetdatum.
 * En van elk offertenummer blijft er ALTIJD minstens één rij over.
 *
 * Kolomindexen verschillen per tab (zie memory sonty-offerte-sheet-structuur), dus de
 * headerrij (rij 3) wordt per tab gelezen — nooit vaste indexen.
 *
 * Gebruik:
 *   node scripts/sheet-dubbelen-opruimen.js          → dry-run
 *   node scripts/sheet-dubbelen-opruimen.js --echt   → daadwerkelijk verwijderen
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ECHT = process.argv.includes('--echt');
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const BACKUPDIR = path.join(__dirname, '..', 'data', 'sheet-opruim-backups');

const vul = (x) => x !== undefined && String(x).trim() !== '';
/** Kolomindex op EXACTE koptekst. Substring-matching is te grof: "nummer" matchte
 *  "Telefoon nummer" (kolom E), waardoor vrijwel elke rij als administratie gold. */
const kolomExact = (header, ...namen) =>
  header.findIndex((h) => namen.includes(String(h || '').toLowerCase().trim()));
/** Kolomindex op een stuk koptekst, voor koppen die per tab iets anders gespeld zijn. */
const kolomBevat = (header, ...delen) =>
  header.findIndex((h) => delen.some((d) => String(h || '').toLowerCase().trim().includes(d)));

async function main() {
  fs.mkdirSync(BACKUPDIR, { recursive: true });
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = meta.data.sheets.map((s) => ({ id: s.properties.sheetId, titel: s.properties.title }));
  console.log(`${tabs.length} tabs. Modus: ${ECHT ? 'ECHT VERWIJDEREN' : 'dry-run'}\n`);

  let totWeg = 0, totBehouden = 0;
  const rapport = { tijd: new Date().toISOString(), modus: ECHT ? 'echt' : 'dry-run', tabs: [] };

  for (const tab of tabs) {
    let data;
    try {
      data = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${tab.titel}'!A3:AD3000` });
    } catch { continue; }
    const alles = data.data.values || [];
    if (alles.length < 2) continue;
    const header = alles[0];
    const rows = alles.slice(1); // vanaf rij 4

    const cNr = kolomBevat(header, 'rp offerte');
    const cInkoop = kolomBevat(header, 'inkoo');
    const cGripp = kolomExact(header, 'nummer');       // Gripp-opdrachtnummer, NIET "Telefoon nummer"
    const cInmeet = kolomBevat(header, 'inmeet');
    if (cNr < 0) continue;
    // Alle kolommen die op handmatige administratie wijzen; die rijen blijven staan.
    const beschermd = [cInkoop, cGripp, cInmeet].filter((i) => i >= 0);

    const groepen = {};
    rows.forEach((row, i) => {
      const nr = String(row[cNr] || '').trim();
      if (!nr) return;
      (groepen[nr] = groepen[nr] || []).push({ rij: i + 4, row });
    });

    const weg = [], gespaard = [];
    for (const [nr, g] of Object.entries(groepen)) {
      if (g.length < 2) continue;
      const heeftData = (x) => beschermd.some((c) => vul(x.row[c]));
      const metData = g.filter(heeftData);
      if (metData.length) {
        // Rijen met administratie blijven; de kale duplicaten eromheen mogen weg.
        g.filter((x) => !heeftData(x)).forEach((x) => weg.push({ nr, rij: x.rij, reden: 'kaal duplicaat naast een rij met administratie' }));
        metData.forEach((x) => gespaard.push({ nr, rij: x.rij }));
        continue;
      }
      // Geen enkele rij heeft administratie: houd de eerste, de rest mag weg.
      g.slice(1).forEach((x) => weg.push({ nr, rij: x.rij, reden: 'kaal duplicaat' }));
    }
    if (!weg.length) continue;

    console.log(`${tab.titel}: ${weg.length} weg, ${gespaard.length} gespaard | kolommen inkoop=${cInkoop} gripp=${cGripp} inmeet=${cInmeet}`);
    fs.writeFileSync(path.join(BACKUPDIR, tab.titel.trim().replace(/\s+/g, '-') + '.json'),
      JSON.stringify({ tab: tab.titel, tijd: new Date().toISOString(), header, rows }, null, 1));

    if (ECHT) {
      // LEEGMAKEN in plaats van de rij verwijderen. De tabs hebben beveiligde kolommen vanaf
      // AB, en deleteDimension raakt die mee — dat weigert Google ("protected cell or object").
      // Leegmaken van A:Y mag wel, en werkt net zo goed: v4 zoekt bij het schrijven de
      // eerstvolgende volledig lege rij, dus deze gaten worden vanzelf hergebruikt. En omdat
      // het offertenummer (kolom G) weg is, telt de dubbele offerte nergens meer mee.
      const rijen = [...new Set(weg.map((w) => w.rij))].sort((a, b) => a - b);
      for (let i = 0; i < rijen.length; i += 50) {
        const blok = rijen.slice(i, i + 50);
        await sheets.spreadsheets.values.batchClear({
          spreadsheetId: SHEET_ID,
          requestBody: { ranges: blok.map((r) => `'${tab.titel}'!A${r}:Y${r}`) },
        });
        await new Promise((x) => setTimeout(x, 1200));
      }
      console.log(`  → ${rijen.length} rijen leeggemaakt (A:Y)`);
    }
    totWeg += weg.length; totBehouden += gespaard.length;
    rapport.tabs.push({ tab: tab.titel, verwijderd: weg, gespaard });
  }

  fs.writeFileSync(path.join(__dirname, '..', 'data', 'sheet-opruim-rapport.json'), JSON.stringify(rapport, null, 1));
  console.log(`\n${ECHT ? 'VERWIJDERD' : 'DRY-RUN'}: ${totWeg} dubbele rijen, ${totBehouden} gespaard omdat er administratie in staat`);
  console.log('Rapport: data/sheet-opruim-rapport.json | backups: data/sheet-opruim-backups/');
}

main().catch((e) => { console.error('opruimen gestopt:', e.message); process.exit(1); });
