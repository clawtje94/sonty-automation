#!/usr/bin/env node
// GRIPP FACTUREN-SYNC (opdracht Mats via Brein thwwy3fr, 01-09-2026: Sam zat 3 dagen zonder
// actuele facturendata; data/gripp-alle-facturen.json was van 3 juli en onleesbaar minified).
// Alleen-lezen (invoice.get), zuinig gepagineerd. Schrijft een kleine, leesbare afgeleide:
//   data/gripp-facturen-open.json  { bijgewerkt, totaal, open[], openLanger14[], alles[] }
// Bedragen incl. btw, zoals Gripp ze geeft. Open = totalopeninclvat > 0.
// Gebruik: node scripts/gripp-facturen-sync.js   (dagelijkse launchd-job volgt pas als het
// proefgeval Sam bevalt — afspraak in de opdracht.)
const fs = require('fs');
const KEY = require('./secrets.js').GRIPP_API_KEY;
const call = async (body) => { const r = await fetch('https://api.gripp.com/public/api3.php', {
  method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body) }); return r.json(); };

const VANAF = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const d = (v) => (v?.date || '').slice(0, 10);
const dagenOud = (iso, nu = new Date()) => iso ? Math.floor((nu - new Date(iso)) / 86400000) : null;

(async () => {
  const alles = [];
  for (let first = 0; first < 5000; first += 250) {
    const j = await call([{ method: 'invoice.get', params: [[
      { field: 'invoice.date', operator: 'greaterequals', value: VANAF }],
      { paging: { firstresult: first, maxresults: 250 } }], id: 1 }]);
    const rows = j[0]?.result?.rows || [];
    for (const r of rows) alles.push({
      nr: r.number, datum: d(r.date), verval: d(r.expirydate),
      status: r.status?.searchname || '?', klant: r.company?.searchname || '?',
      bedrag: +r.totalinclvat || 0, betaald: +r.totalpayed || 0, open: +r.totalopeninclvat || 0,
      ref: r.clientreference || null, onderwerp: r.subject || null, url: r.viewonlineurl || null,
    });
    if (rows.length < 250) break;
    await new Promise((x) => setTimeout(x, 400)); // Gripp zuinig
  }
  // Concepten zijn nog niet verstuurd: geen debiteurenpost. Open = verzonden en (deels) onbetaald.
  const open = alles.filter((f) => f.open > 0 && f.status !== 'Concept')
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const openLanger14 = open.filter((f) => dagenOud(f.verval || f.datum) > 14)
    .map((f) => ({ ...f, dagenOverVerval: dagenOud(f.verval || f.datum) }));
  const uit = { bijgewerkt: new Date().toISOString(), vanaf: VANAF, totaal: alles.length,
    samenvatting: { open: open.length, openBedrag: Math.round(open.reduce((s, f) => s + f.open, 0)),
      openLanger14: openLanger14.length, openLanger14Bedrag: Math.round(openLanger14.reduce((s, f) => s + f.open, 0)) },
    openLanger14, open, alles };
  fs.writeFileSync('data/gripp-facturen-open.json', JSON.stringify(uit, null, 1));
  console.log(`facturen sinds ${VANAF}: ${alles.length} | open: ${open.length} (€${uit.samenvatting.openBedrag}) | >14 dgn over verval: ${openLanger14.length} (€${uit.samenvatting.openLanger14Bedrag})`);
  console.log('oudste 3 open:', openLanger14.slice(0, 3).map((f) => `${f.nr} ${f.klant} €${Math.round(f.open)} (${f.dagenOverVerval} dgn)`).join(' | ') || 'geen');
})();
