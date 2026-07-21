#!/usr/bin/env node
// Wekelijks conversierapport voor Daimy (opdracht 21 juli 2026): hoeveel leads kwamen er
// binnen, hoeveel gingen akkoord (= bord-status Inmeten inplannen / Gripp invullen /
// Afgerond), conversie %, akkoorden per productcategorie en de waarde.
// Gebruik: node scripts/weekrapport-conversie.js [--van 2026-07-16] [--tot 2026-07-21] [--stuur]
// Zonder --van/--tot: de afgelopen 7 dagen. --stuur = ook naar Daimy's Telegram.
const KS = require('./ai-ks/config.js');

const STATUS = {
  '2e9819bd-26f0-4082-8f18-32bb48f87f54': 'Inmeten inplannen',
  'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846': 'Gripp invullen',
  '2082ad8a-517c-4e24-8c0f-a5be69b1588a': 'Afgerond',
};
const CATEGORIEEN = [
  ['knikarm|suneye|sunelite|sunbasic', 'Knikarmschermen'],
  ['screen|zip design|zip square|zipscreen', 'Screens'],
  ['rolluik', 'Rolluiken'],
  ['markies', 'Markiezen'],
  ['hor(?![i-z])|plissefit|plisséfit', 'Horren'],
  ['pergola', "Pergola's"],
  ['gordijn|vitrage|jaloezie|plissé(?!fit)|shutter|rolgordijn|duette', 'Raamdecoratie binnen'],
  ['uitvalscherm|suncube|sunproject', 'Uitvalschermen'],
  ['serre|suncontrol', 'Serre zonwering'],
];
const kies = (tekst) => (CATEGORIEEN.find(([re]) => new RegExp(re, 'i').test(tekst)) || [null, 'Overig'])[1];

const rpGet = async (ep) => {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + KS.RP_API_KEY } });
  return r.ok ? r.json() : null;
};
const dagVan = (i) => new Date((i.timestamp_created || 0) * (String(i.timestamp_created).length > 10 ? 1 : 1000)).toISOString().slice(0, 10);
const eur = (n) => '€' + Math.round(n).toLocaleString('nl-NL');

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
  // Zonder --tot: t/m gisteren (maandagrun ⇒ maandag t/m zondag vorige week)
  const tot = arg('--tot') || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const van = arg('--van') || new Date(Date.parse(tot) - 6 * 86400000).toISOString().slice(0, 10);

  const alle = (await rpGet(`/contact-service/${KS.RP_PID}/backlogs/${KS.RP_BACKLOG}/items`))?.items || [];
  const cohort = alle.filter(i => { const d = dagVan(i); return d >= van && d <= tot; });
  const akkoord = cohort.filter(i => STATUS[i.status_id]);

  // Zelfde venster vorige maand als referentie
  const refVan = new Date(Date.parse(van) - 30 * 86400000).toISOString().slice(0, 10);
  const refTot = new Date(Date.parse(tot) - 30 * 86400000).toISOString().slice(0, 10);
  const refCohort = alle.filter(i => { const d = dagVan(i); return d >= refVan && d <= refTot; });
  const refAkkoord = refCohort.filter(i => STATUS[i.status_id]).length;

  // Per akkoord: offerte ophalen voor categorie + waarde (via lead_configuration)
  const perCat = {}, perStatus = {};
  let waarde = 0, zonderOfferte = 0;
  for (const i of akkoord) {
    perStatus[STATUS[i.status_id]] = (perStatus[STATUS[i.status_id]] || 0) + 1;
    let cat = 'Overig', bedrag = 0;
    const lcId = i.item_subject?.type === 'LEAD_CONFIGURATION' ? i.item_subject.id : null;
    if (lcId) {
      const qs = (await rpGet(`/document-service/v1/${KS.RP_PID}/quotations?lead_configuration_id=${lcId}`)) || {};
      const q = (qs.quotationDatas || [])
        .sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0))[0];
      if (q) {
        bedrag = q.pricing?.total || 0;
        const doc = await rpGet(`/document-service/v1/${KS.RP_PID}/quotations/${q.documentId}`);
        const lines = doc?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
        const productTekst = lines.map(l => (l.description || '').split('\n')[0]).join(' | ');
        if (productTekst) cat = kies(productTekst);
      } else zonderOfferte++;
      await new Promise(r => setTimeout(r, 200));
    } else zonderOfferte++;
    perCat[cat] = (perCat[cat] || 0) + 1;
    waarde += bedrag;
  }

  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0') + '%';
  const r = [];
  r.push(`WEEKRAPPORT CONVERSIE ${van} t/m ${tot}`);
  r.push('');
  r.push(`Nieuwe leads: ${cohort.length}`);
  r.push(`Akkoord (Inmeten/Gripp/Afgerond): ${akkoord.length} → conversie ${pct(akkoord.length, cohort.length)}`);
  r.push(`Waarde akkoorden: ${eur(waarde)}${zonderOfferte ? ` (${zonderOfferte} zonder offerte-koppeling)` : ''}`);
  r.push('');
  r.push('Per status: ' + Object.entries(perStatus).map(([k, v]) => `${k} ${v}`).join(' · '));
  r.push('Per categorie:');
  for (const [cat, n] of Object.entries(perCat).sort((a, b) => b[1] - a[1])) r.push(`  - ${cat}: ${n}`);
  r.push('');
  r.push(`Referentie zelfde venster vorige maand (${refVan} t/m ${refTot}): ${refCohort.length} leads, ${refAkkoord} akkoord (${pct(refAkkoord, refCohort.length)})`);

  // Weektrend: de 6 voorgaande weken (ma-zo), telkens met de stand van NU — oudere weken
  // rijpen na (leads converteren later alsnog), dus deze percentages lopen elke week op.
  r.push('');
  r.push('Weektrend (stand van vandaag):');
  const maandagVan = (d) => { const x = new Date(Date.parse(d)); const wd = (x.getUTCDay() + 6) % 7; return new Date(x.getTime() - wd * 86400000); };
  let wStart = maandagVan(van);
  for (let w = 0; w < 6; w++) {
    wStart = new Date(wStart.getTime() - 7 * 86400000);
    const wVan = wStart.toISOString().slice(0, 10);
    const wTot = new Date(wStart.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    const wc = alle.filter(i => { const d = dagVan(i); return d >= wVan && d <= wTot; });
    const wa = wc.filter(i => STATUS[i.status_id]).length;
    r.push(`  wk ${wVan} t/m ${wTot}: ${String(wc.length).padStart(3)} leads, ${String(wa).padStart(2)} akkoord = ${pct(wa, wc.length)}`);
  }
  r.push('');
  r.push('NB: jonge weken converteren nog door (cijfers stijgen elke week); weken ouder dan ±2 maanden zijn op het bord deels opgeschoond en tellen te laag.');
  const tekst = r.join('\n');
  console.log(tekst);

  if (process.argv.includes('--stuur')) {
    await fetch('https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: tekst.slice(0, 3900) }),
    }).catch(() => {});
  }
}

main().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
