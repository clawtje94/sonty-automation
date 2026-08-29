#!/usr/bin/env node
// V5 (Daimy 29-08, via het Brein: "ja zolang je de juiste kolom pakt"): kolom T (Akkoord → Datum) terugvullen voor
// leads die vóór 29-08 op "Inmeten inplannen" kwamen. Bron van de datum = state.gezien (eerste keer gezien door de
// planner = moment van akkoord). Schrijft ALLEEN in de kolom die op de koppen "Datum"(rij 2)/"Akkoord"(rij 3) is
// herkend en alleen als de cel leeg is (tabs zonder die kop worden overgeslagen).
//   node scripts/akkoord-datum-backfill.js            → dry-run: laat zien wat er zou gebeuren
//   node scripts/akkoord-datum-backfill.js --schrijf 1 → eerste rij echt schrijven (proefgeval)
//   node scripts/akkoord-datum-backfill.js --schrijf   → alles schrijven
const fs = require('fs');
const path = require('path');
const P = require('./cron-inmeten-planner.js');
const { schrijfAkkoordDatum } = require('./lib/sheet-inplannen.js');
const state = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeten-planner-state.json'), 'utf8'));
const schrijf = process.argv.includes('--schrijf');
const max = schrijf && /^\d+$/.test(process.argv[process.argv.indexOf('--schrijf') + 1] || '') ? +process.argv[process.argv.indexOf('--schrijf') + 1] : Infinity;
(async () => {
  const ids = Object.entries(state.gezien || {}).filter(([, d]) => d < '2026-08-29T00:00:00').sort((a, b) => a[1].localeCompare(b[1]));
  const telling = { geschreven: 0, zouSchrijven: 0, alGevuld: 0, geenKolom: 0, nietGevonden: 0, rpFout: 0 };
  let n = 0;
  for (const [id, gezien] of ids) {
    let item, lead;
    try { item = await P.rpGet(`/contact-service/${P.PID}/backlogs/${P.BACKLOG_ID}/items/${id}`).then((d) => d.item || d); lead = await P.leesLeadCompleet(item); }
    catch (e) { telling.rpFout++; console.log(`RP-FOUT ${id.slice(0, 8)} ${gezien.slice(0, 10)}: ${e.message.slice(0, 60)}`); continue; }
    const doe = schrijf && n < max;
    let r;
    try { r = await schrijfAkkoordDatum({ rpNummers: lead.rpNummers || [], telefoon: lead.telefoon, datum: new Date(gezien), docDatums: lead.rpDatums || [], dryRun: !doe }); }
    catch (e) { telling.rpFout++; console.log(`SHEET-FOUT ${lead.naam}: ${e.message.slice(0, 60)}`); continue; }
    if (!r.gevonden) { telling.nietGevonden++; console.log(`niet gevonden   ${gezien.slice(0, 10)} ${lead.naam} (${(lead.rpNummers || []).join('/')} ${lead.telefoon || '-'})`); continue; }
    if (r.overgeslagen && /geen Akkoord/.test(r.overgeslagen)) { telling.geenKolom++; console.log(`geen kolom      ${gezien.slice(0, 10)} ${lead.naam} tab ${r.tab}`); continue; }
    if (r.overgeslagen) { telling.alGevuld++; console.log(`al gevuld       ${gezien.slice(0, 10)} ${lead.naam} ${r.tab} r${r.rij}: ${r.overgeslagen.replace('akkoorddatum al gevuld: ', '')}`); continue; }
    if (r.geschreven) { telling.geschreven++; n++; console.log(`GESCHREVEN      ${r.cel} = ${r.geschreven}  ${lead.naam}`); continue; }
    telling.zouSchrijven++; n++; console.log(`zou schrijven   ${r.cel} = ${r.zouSchrijven}  ${lead.naam}`);
  }
  console.log('\nTOTAAL', ids.length, JSON.stringify(telling));
})();
