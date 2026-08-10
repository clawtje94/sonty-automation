#!/usr/bin/env node
// GRIPP OPENSTAANDE OFFERTES + OPRUIMLIJST (opdracht Daimy 30 juli 2026).
//
// Definitie "openstaand" = Daimy's eigen Gripp-scherm (geleerd 30 juli): status
// Verzonden (id 9) ÉN niet gearchiveerd, bedragen EX btw (API geeft incl, dus /1,21).
// Opruimlijst = open offertes waarvan de klant dit jaar al een ANDERE offerte
// accepteerde (zelfde maand = vrijwel zeker een oude versie van dezelfde deal).
// Gripp-sleutel is ALLEEN-LEZEN; archiveren moet het team zelf.
// Gebruik: node scripts/gripp-open-offertes.js [--stuur]
const KEY = require('./secrets.js').GRIPP_API_KEY;
const call = async body => { const r = await fetch('https://api.gripp.com/public/api3.php', {
  method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body) }); return r.json(); };
const eur = n => '€' + Math.round(n).toLocaleString('nl-NL');
const JAAR = new Date().getFullYear();

(async () => {
  const open = (await call([{ method: 'offer.get', params: [[
    { field: 'offer.status', operator: 'equals', value: 9 },
    { field: 'offer.archived', operator: 'equals', value: false },
    { field: 'offer.createdon', operator: 'greaterequals', value: `${JAAR}-01-01` }],
    { paging: { firstresult: 0, maxresults: 250 } }], id: 1 }]))[0].result.rows || [];

  const acc = [];
  for (let first = 0; first < 2000; first += 250) {
    const j = await call([{ method: 'offer.get', params: [[
      { field: 'offer.acceptedon', operator: 'greaterequals', value: `${JAAR}-01-01` }],
      { paging: { firstresult: first, maxresults: 250 } }], id: 1 }]);
    const rows = j[0].result?.rows || []; acc.push(...rows);
    if (rows.length < 250) break;
  }
  const accPerBedrijf = new Map();
  for (const a of acc) { const c = a.company?.id; if (!c) continue;
    if (!accPerBedrijf.has(c)) accPerBedrijf.set(c, []);
    accPerBedrijf.get(c).push({ m: (a.acceptedon?.date || '').slice(0, 7), nr: a.number }); }

  const ex = o => parseFloat(o.totalinclvat || 0) / 1.21;
  const opruim = [], twijfel = [], statusFout = [];
  let totWaarde = 0;
  for (const o of open) { totWaarde += ex(o);
    const maand = (o.createdon?.date || '').slice(0, 7);
    // Offerte is ZELF al geaccepteerd maar status bleef op Verzonden staan:
    // dat is gewonnen omzet die als open telt — administratie bijwerken.
    if (o.acceptedon?.date) {
      statusFout.push({ nr: o.number, klant: o.company?.searchname || '?', maand, w: ex(o),
        accM: o.acceptedon.date.slice(0, 10) });
      continue;
    }
    // Alleen ANDERE offertes van dezelfde klant tellen als acceptatie-bewijs.
    const accs = (accPerBedrijf.get(o.company?.id) || []).filter(a => a.nr !== o.number);
    if (!accs.length) continue;
    const item = { nr: o.number, klant: o.company?.searchname || '?', maand, w: ex(o),
      accNr: accs[0].nr, accM: accs[0].m };
    (accs.some(a => a.m === maand) ? opruim : twijfel).push(item);
  }
  const som = a => a.reduce((x, i) => x + i.w, 0);
  const echt = open.length - opruim.length - twijfel.length - statusFout.length;

  const L = [];
  L.push(`GRIPP OPENSTAANDE OFFERTES — stand ${new Date().toISOString().slice(0, 10)}`);
  L.push('');
  L.push(`openstaand volgens Gripp : ${open.length} offertes, ${eur(totWaarde)} ex btw`);
  L.push(`waarvan opruimkandidaat  : ${opruim.length} (klant accepteerde andere offerte in DEZELFDE maand), ${eur(som(opruim))}`);
  L.push(`waarvan twijfelgeval     : ${twijfel.length} (klant accepteerde eerder/later dit jaar iets anders), ${eur(som(twijfel))}`);
  L.push(`waarvan STATUS FOUT      : ${statusFout.length} (offerte is ZELF al geaccepteerd, status nooit bijgewerkt), ${eur(som(statusFout))}`);
  L.push(`ECHT OPEN                : ${echt} offertes, ${eur(totWaarde - som(opruim) - som(twijfel) - som(statusFout))}`);
  L.push('');
  if (statusFout.length) {
    L.push('STATUS BIJWERKEN (al geaccepteerd, staat nog op Verzonden):');
    for (const i of statusFout.sort((a, b) => a.maand < b.maand ? -1 : 1))
      L.push(`  #${i.nr} ${i.klant} | geaccepteerd op ${i.accM} | ${eur(i.w)}`);
    L.push('');
  }
  L.push('OPRUIMLIJST (zelfde maand — vrijwel zeker oude versie; archiveren in Gripp):');
  for (const i of opruim.sort((a, b) => a.maand < b.maand ? -1 : 1))
    L.push(`  #${i.nr} ${i.klant} | ${i.maand} | ${eur(i.w)} | klant accepteerde #${i.accNr}`);
  if (twijfel.length) {
    L.push('');
    L.push('TWIJFELGEVALLEN (even nakijken; kan een tweede product zijn):');
    for (const i of twijfel.sort((a, b) => a.maand < b.maand ? -1 : 1))
      L.push(`  #${i.nr} ${i.klant} | ${i.maand} | ${eur(i.w)} | accepteerde #${i.accNr} in ${i.accM}`);
  }
  const tekst = L.join('\n');
  console.log(tekst);
  if (process.argv.includes('--stuur'))
    require('child_process').execFileSync(process.execPath, [__dirname + '/sonty-data-send.js', tekst, '--code'], { stdio: 'inherit' });
})();
