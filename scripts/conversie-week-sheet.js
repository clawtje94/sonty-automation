#!/usr/bin/env node
// Conversie per week volgens de methode van Daimy (2026-08-03): conversie = van alle leads in de
// Google Sheet (offerte-register, maandtabs) hoeveel er AKKOORD zijn, en akkoord = er staat een
// inkoopbedrag ingevuld (kolom "inkooop incl btw"; de akkoord-checkbox is slecht bijgehouden).
// Voor de LOPENDE weken loopt het % nog op: die akkoorden staan deels nog in RP "inmeten inplannen"
// en nog niet in de sheet. Gebruik: node scripts/conversie-week-sheet.js [--maanden 4] [--stuur]
const { google } = require('googleapis');
const path = require('path');
const ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const money = s => { const t = String(s || '').replace(/[€\s.]/g, '').replace(',', '.'); const n = parseFloat(t); return isFinite(n) ? n : 0; };
function parseDatum(v) { const t = String(v || '').trim(); let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/); if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); } return null; }
function isoWeek(d) { const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day + 3); const first = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4)); const wk = 1 + Math.round(((dt - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7); return dt.getUTCFullYear() + '-W' + String(wk).padStart(2, '0'); }
function weekStart(d) { const dt = new Date(d); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); }

(async () => {
  const maanden = Number((process.argv[process.argv.indexOf('--maanden') + 1])) || 4;
  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const grens = new Date(); grens.setMonth(grens.getMonth() - maanden);
  // Tabbladen dynamisch uit de sheet halen zodat een trailing space ("Juli 2026 ") het
  // niet stil breekt. Match op genormaliseerde 2026-maandnamen; nieuwe maanden komen vanzelf mee.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const MAAND_RE = /^(jan|feb|maart|april|mei|juni|juli|aug|augustus|sep|sept|okt|nov|dec)\s*2026$/i;
  const tabs = meta.data.sheets.map(s => s.properties.title).filter(t => MAAND_RE.test(norm(t)));
  const perWeek = {};
  for (const tab of tabs) {
    let r; try { r = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${tab}'!A1:AR3100` }); } catch { continue; }
    const vals = r.data.values || []; const hdr = vals[2] || []; if (!hdr.length) continue;
    const cName = hdr.findIndex(h => /naam/i.test(h) || /achternaam/i.test(h));
    const cInkoop = hdr.findIndex(h => norm(h).includes('inkooop') || norm(h).includes('inkoop'));
    const cDatum = hdr.findIndex(h => norm(h).includes('datum'));
    for (let i = 3; i < vals.length; i++) {
      const row = vals[i] || []; if (!(row[cName] || '').trim()) continue;
      const d = parseDatum(row[cDatum]);
      // datum-sanity: geen typefouten (bv. jaar 2045) of toekomstdatums
      if (!d || d < grens || d > new Date() || d.getFullYear() < 2024 || d.getFullYear() > 2027) continue;
      const wk = isoWeek(d); perWeek[wk] = perWeek[wk] || { leads: 0, akkoord: 0, start: weekStart(d) };
      perWeek[wk].leads++; if (money(row[cInkoop]) > 0) perWeek[wk].akkoord++;
    }
  }
  const wks = Object.keys(perWeek).sort();
  const nuWk = isoWeek(new Date());
  const vorige = new Date(); vorige.setDate(vorige.getDate() - 7); const vorigeWk = isoWeek(vorige);
  // MIJLPALEN: elke belangrijke wijziging met datum, zodat je bij de cijfers ziet wat er speelde.
  // Nieuwe wijziging? Voeg hier een regel toe (datum = wanneer het live/actief ging). Datums geverifieerd.
  const MIJLPALEN = [
    { datum: '2026-07-03', tekst: 'AI-bot shadow-test gestart (nog niet live)' },
    { datum: '2026-07-16', tekst: 'AI-bot LIVE op actieve gesprekken' },
    { datum: '2026-07-27', tekst: 'A/B-test WhatsApp-opvolging gestart' },
    { datum: '2026-08-03', tekst: 'Prijsverhoging (Sunmaster 1,20 / Roma 1,30 / markiezen 1,31)' },
  ];
  const mijlPerWeek = {};
  for (const m of MIJLPALEN) { const [y, mo, d] = m.datum.split('-').map(Number); const w = isoWeek(new Date(y, mo - 1, d)); (mijlPerWeek[w] = mijlPerWeek[w] || []).push(m.tekst); }
  const regels = ['Conversie per week (akkoord = inkoopbedrag in de sheet):', ''];
  for (const w of wks) {
    const x = perWeek[w]; const incompleet = (w === nuWk || w === vorigeWk) ? '  << loopt nog op' : '';
    regels.push(`${w} (${x.start}): ${x.leads ? (x.akkoord / x.leads * 100).toFixed(1) : 0}%  (${x.akkoord}/${x.leads})${incompleet}`);
    for (const t of (mijlPerWeek[w] || [])) regels.push(`      ⭐ ${t}`);
  }
  regels.push('', 'De laatste 1-2 weken lopen nog op: die akkoorden staan deels nog in RP inmeten-inplannen en nog niet in de sheet.');
  const tekst = regels.join('\n');
  console.log(tekst);
  if (process.argv.includes('--stuur')) { require('child_process').execSync(`node ${path.join(__dirname, 'sonty-data-send.js')} ${JSON.stringify(tekst)}`, { stdio: 'inherit' }); }
})().catch(e => { console.log('FOUT:', e.message.slice(0, 150)); process.exit(1); });
