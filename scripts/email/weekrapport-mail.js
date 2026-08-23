#!/usr/bin/env node
// Wekelijkse bewaking van de mailmarketing: haalt de cijfers van flows en campagnes
// uit Klaviyo, legt ze naast de norm en meldt alleen wat aandacht vraagt.
// Draait maandag 08:30 via launchd. Handmatig: node scripts/email/weekrapport-mail.js [--dagen 7] [--stuur]
const fs = require('fs'), path = require('path');
const { KLAVIYO_API_KEY } = require('../secrets.js');
const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2026-07-15', accept: 'application/json', 'content-type': 'application/json' };
const AKKOORD_METRIC = 'SXgMKg';          // "Offerte Akkoord" — zo zien we of mail tot akkoorden leidt
const DAGEN = +(process.argv[process.argv.indexOf('--dagen') + 1]) || 7;
const KEY = DAGEN <= 7 ? 'last_7_days' : DAGEN <= 30 ? 'last_30_days' : 'last_90_days';

// Normen uit het masterplan. Een flow die net leeft mag ruimer zitten: een lijst die
// lang niet gemaild is, schoont zichzelf de eerste weken op met afmeldingen.
const NORM = { klik: 4.6, unsub: 0.3, spam: 0.1 };
const NORM_START = { klik: 2.0, unsub: 1.5, spam: 0.35 };
const OPSTART_DAGEN = 60;

const wacht = ms => new Promise(r => setTimeout(r, ms));
async function haal(url, opties = {}) {
  for (let poging = 0; poging < 4; poging++) {
    const r = await fetch(url, { headers: H, ...opties });
    if (r.status === 429) { await wacht(4000 * (poging + 1)); continue; }
    return r.json();
  }
  return { errors: [{ detail: 'te vaak geweigerd door Klaviyo' }] };
}
const pct = (a, b) => b ? (a / b * 100) : 0;
const fmt = n => n.toFixed(2).replace('.', ',') + '%';

(async () => {
  const flows = await haal('https://a.klaviyo.com/api/flows/?fields[flow]=name,status,created&page[size]=50');
  const meta = Object.fromEntries((flows.data || []).map(f => [f.id, {
    naam: f.attributes.name, status: f.attributes.status,
    dagen: Math.round((Date.now() - new Date(f.attributes.created)) / 864e5),
  }]));
  await wacht(1200);

  const rapport = await haal('https://a.klaviyo.com/api/flow-values-reports/', {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'flow-values-report', attributes: {
      statistics: ['recipients', 'opens_unique', 'clicks_unique', 'unsubscribe_uniques', 'spam_complaints', 'conversions'],
      timeframe: { key: KEY }, conversion_metric_id: AKKOORD_METRIC } } }),
  });
  if (rapport.errors) { console.error('Klaviyo gaf een fout:', JSON.stringify(rapport.errors).slice(0, 300)); process.exit(1); }

  const rijen = (rapport.data?.attributes?.results || [])
    .map(r => ({ ...(meta[r.groupings.flow_id] || { naam: 'onbekende flow', dagen: 999 }), ...r.statistics }))
    .filter(r => (r.recipients || 0) > 0)
    .sort((a, b) => b.recipients - a.recipients);

  const L = [];
  L.push(`MAILRAPPORT — laatste ${DAGEN} dagen`);
  L.push('');
  if (!rijen.length) L.push('Er is deze periode niets verstuurd.');

  const alarm = [];
  let totaal = { r: 0, o: 0, k: 0, u: 0, s: 0, c: 0 };
  for (const r of rijen) {
    const v = r.recipients, klik = pct(r.clicks_unique, v), unsub = pct(r.unsubscribe_uniques, v), spam = pct(r.spam_complaints, v);
    const jong = r.dagen < OPSTART_DAGEN;
    const norm = jong ? NORM_START : NORM;
    totaal.r += v; totaal.o += r.opens_unique || 0; totaal.k += r.clicks_unique || 0;
    totaal.u += r.unsubscribe_uniques || 0; totaal.s += r.spam_complaints || 0; totaal.c += r.conversions || 0;
    const let_op = [];
    if (klik < norm.klik) let_op.push(`klik ${fmt(klik)} (norm ${fmt(norm.klik)})`);
    if (unsub > norm.unsub) let_op.push(`afmeldingen ${fmt(unsub)} (norm ${fmt(norm.unsub)})`);
    if (spam > norm.spam) let_op.push(`spam ${fmt(spam)} (norm ${fmt(norm.spam)})`);
    L.push(`${r.naam}${jong ? ' (opstart)' : ''}`);
    L.push(`  ${v} verstuurd · ${fmt(pct(r.opens_unique, v))} open · ${fmt(klik)} klik · ${r.conversions || 0} akkoord`);
    if (let_op.length) { L.push('  LET OP: ' + let_op.join(' | ')); alarm.push(`${r.naam}: ${let_op.join(', ')}`); }
    L.push('');
  }
  if (totaal.r) {
    L.push(`TOTAAL: ${totaal.r} verstuurd · ${fmt(pct(totaal.o, totaal.r))} open · ${fmt(pct(totaal.k, totaal.r))} klik · ${totaal.c} akkoord`);
    L.push('');
    L.push('Let op bij de open-cijfers: Apple verbergt het echte openen, dus dat percentage staat');
    L.push('structureel te hoog. Stuur op klikken en akkoorden, niet op opens.');
  }
  if (alarm.length) { L.push(''); L.push('WAT IK OPPAK: ' + alarm.length + ' punt(en) hierboven; voorstel volgt als een cijfer twee weken achter elkaar afwijkt.'); }

  const tekst = L.join('\n');
  console.log(tekst);
  fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'mailrapport-laatste.txt'), tekst);
  if (process.argv.includes('--stuur')) {
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'sonty-data-send.js'), tekst, '--code'], { stdio: 'inherit' });
  }
})().catch(e => { console.error('FOUT', e.message); process.exit(1); });
