#!/usr/bin/env node
// GOOGLE ADS API-COLLECTOR (opdracht Mats via Brein 16sis3xa, 01-09-2026) — spiegel van
// scripts/meta-ads-api.js. Haalt per maand per campagne spend/kliks/conversies op en schrijft:
//   data/campagne-spend-google.json   {maand:{campagne:{spend,kliks,leads,impressies,cpl}}}
//                                     (alleen API-maanden overschreven, rest blijft staan)
//   data/ad-spend-google-api.json     {maand: spendtotaal} -> ad-spend.js pakt dit als
//                                     hoogste bron voor Google (API wint van sheet/handmatig)
// "leads" = metrics.conversions zoals het account ze telt (Lars/Jules definieren de
// conversie-acties in Google Ads zelf; hier niet herinterpreteren).
// Credentials in ~/sonty/.env (zie docs/google-ads-api-setup.md):
//   GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
//   GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID (zonder streepjes),
//   optioneel GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC).
// Setup-hulp: --auth-url (print toestemmings-URL) en --code <code> (wisselt in voor refresh token).
// Gebruik: node scripts/google-ads-api.js [--vanaf 2026-01-01] [--tot 2026-09-01] [--droog]
const fs = require('fs');
const path = require('path');
const BASIS = path.join(__dirname, '..', 'data');
const ENV = path.join(__dirname, '..', '.env');
const env = {};
try { for (const l of fs.readFileSync(ENV, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); } } catch {}
const E = (k) => process.env[k] || env[k] || '';
const VERSIE = 'v18';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };

// ── Setup-hulp: refresh token maken ──
if (process.argv.includes('--auth-url')) {
  if (!E('GOOGLE_ADS_CLIENT_ID')) { console.error('GOOGLE_ADS_CLIENT_ID ontbreekt in .env'); process.exit(2); }
  console.log('Open deze URL, log in met het Google Ads-account, en draai daarna: node scripts/google-ads-api.js --code <code>');
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(E('GOOGLE_ADS_CLIENT_ID'))}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/adwords')}&access_type=offline&prompt=consent`);
  process.exit(0);
}
if (arg('--code')) {
  (async () => {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: arg('--code'), client_id: E('GOOGLE_ADS_CLIENT_ID'), client_secret: E('GOOGLE_ADS_CLIENT_SECRET'), redirect_uri: 'urn:ietf:wg:oauth:2.0:oob', grant_type: 'authorization_code' }) });
    const j = await r.json();
    if (j.refresh_token) console.log('Zet in .env:  GOOGLE_ADS_REFRESH_TOKEN=' + j.refresh_token);
    else { console.error('Geen refresh token:', JSON.stringify(j)); process.exit(1); }
  })();
  return;
}

const NODIG = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'];
const mist = NODIG.filter((k) => !E(k));
if (mist.length) { console.error(`Google Ads-credentials ontbreken in .env: ${mist.join(', ')} — zie docs/google-ads-api-setup.md (Daimy moet deze aanleveren).`); process.exit(2); }

const vandaag = new Date().toISOString().slice(0, 10);
const VANAF = arg('--vanaf', '2026-01-01');
const TOT = arg('--tot', vandaag);
const DROOG = process.argv.includes('--droog');
const UIT_CAMP = path.join(BASIS, 'campagne-spend-google.json');
const UIT_TOT = path.join(BASIS, 'ad-spend-google-api.json');

(async () => {
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: E('GOOGLE_ADS_CLIENT_ID'), client_secret: E('GOOGLE_ADS_CLIENT_SECRET'), refresh_token: E('GOOGLE_ADS_REFRESH_TOKEN'), grant_type: 'refresh_token' }) });
  const tok = await tr.json();
  if (!tok.access_token) { console.error('OAuth mislukt:', JSON.stringify(tok)); process.exit(1); }

  const cid = E('GOOGLE_ADS_CUSTOMER_ID').replace(/-/g, '');
  const headers = { Authorization: 'Bearer ' + tok.access_token, 'developer-token': E('GOOGLE_ADS_DEVELOPER_TOKEN'), 'Content-Type': 'application/json' };
  if (E('GOOGLE_ADS_LOGIN_CUSTOMER_ID')) headers['login-customer-id'] = E('GOOGLE_ADS_LOGIN_CUSTOMER_ID').replace(/-/g, '');
  const query = `SELECT campaign.name, segments.month, metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.impressions FROM campaign WHERE segments.date >= '${VANAF}' AND segments.date <= '${TOT}'`;
  const r = await fetch(`https://googleads.googleapis.com/${VERSIE}/customers/${cid}/googleAds:searchStream`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const j = await r.json();
  if (!r.ok) { console.error('Google Ads API:', JSON.stringify(j).slice(0, 500)); process.exit(1); }

  const perMaand = {};
  for (const chunk of Array.isArray(j) ? j : [j]) for (const row of chunk.results || []) {
    const m = String(row.segments?.month || '').slice(0, 7);
    if (!m) continue;
    const naam = row.campaign?.name || '?';
    const cur = (perMaand[m] = perMaand[m] || {})[naam] || { spend: 0, kliks: 0, leads: 0, impressies: 0 };
    cur.spend = +(cur.spend + (+row.metrics?.costMicros || 0) / 1e6).toFixed(2);
    cur.kliks += +row.metrics?.clicks || 0;
    cur.leads = +(cur.leads + (+row.metrics?.conversions || 0)).toFixed(1);
    cur.impressies += +row.metrics?.impressions || 0;
    cur.cpl = cur.leads ? +(cur.spend / cur.leads).toFixed(2) : null;
    perMaand[m][naam] = cur;
  }
  const maanden = Object.keys(perMaand).sort();
  if (!maanden.length) { console.error('Google Ads API gaf geen rijen voor', VANAF, '-', TOT); process.exit(1); }
  let bestaand = {}; try { bestaand = JSON.parse(fs.readFileSync(UIT_CAMP, 'utf8')); } catch {}
  const camp = { ...bestaand, ...perMaand };
  let totalen = {}; try { totalen = JSON.parse(fs.readFileSync(UIT_TOT, 'utf8')); } catch {}
  for (const m of maanden) totalen[m] = +Object.values(perMaand[m]).reduce((a, v) => a + v.spend, 0).toFixed(2);
  totalen._bijgewerkt = new Date().toISOString();
  totalen._bron = `Google Ads API ${VERSIE}, customer ${cid}, per campagne per maand`;
  if (!DROOG) { fs.writeFileSync(UIT_CAMP, JSON.stringify(camp, null, 1)); fs.writeFileSync(UIT_TOT, JSON.stringify(totalen, null, 1)); }
  console.log((DROOG ? '[droog] ' : '') + 'Google Ads API:', maanden.map((m) => {
    const v = Object.values(perMaand[m]);
    return `${m} €${totalen[m].toFixed(0)} (${v.length} camp, ${v.reduce((a, x) => a + x.leads, 0).toFixed(0)} conv)`;
  }).join(', '));
})();
