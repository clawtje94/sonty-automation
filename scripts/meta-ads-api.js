#!/usr/bin/env node
// META ADS API-COLLECTOR (Daimy 2026-08-20: system-user-token "Sonty Dashboard API", ads_read).
// Vervangt de handmatige Ads Manager-CSV-exports (meta-campagne-import.py) als bron voor
// Meta-kosten. Haalt per maand per campagne spend/kliks/leads op en schrijft:
//   data/campagne-spend-meta.json   {maand:{campagne:{spend,kliks,leads,impressies,cpl}}}
//                                   (zelfde vorm als de CSV-import; alleen maanden die de
//                                    API levert worden overschreven, de rest blijft staan)
//   data/ad-spend-meta-api.json     {maand: spendtotaal}  -> ad-spend.js pakt dit als
//                                   hoogste bron voor Meta (API wint van CSV/sheet/handmatig)
// Token + account in ~/sonty/.env (META_ADS_TOKEN, META_AD_ACCOUNT_ID). Alleen lezen.
// Gebruik: node scripts/meta-ads-api.js [--vanaf 2026-01-01] [--tot 2026-08-20] [--droog]
// Controle 2026-08-20: juni API = CSV op de cent (25.217,63); juli API 25.821 vs CSV 25.441
// (CSV was te vroeg geëxporteerd) -> API is completer. "kliks" = action_type link_click
// (= kolom "Klikken op links" in de CSV), "leads" = action_type lead.
const fs = require('fs');
const path = require('path');
const BASIS = path.join(__dirname, '..', 'data');
const ENV = path.join(__dirname, '..', '.env');
const env = {};
for (const l of fs.readFileSync(ENV, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const TOKEN = process.env.META_ADS_TOKEN || env.META_ADS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID || env.META_AD_ACCOUNT_ID || 'act_1633352477464320';
const VERSIE = 'v26.0';
if (!TOKEN) { console.error('META_ADS_TOKEN ontbreekt in .env'); process.exit(2); }

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const vandaag = new Date().toISOString().slice(0, 10);
const VANAF = arg('--vanaf', '2026-01-01');
const TOT = arg('--tot', vandaag);
const DROOG = process.argv.includes('--droog');
const UIT_CAMP = path.join(BASIS, 'campagne-spend-meta.json');
const UIT_TOT = path.join(BASIS, 'ad-spend-meta-api.json');

async function haal(url) {
  const alles = [];
  let next = url;
  for (let i = 0; next && i < 50; i++) {
    const r = await fetch(next);
    const j = await r.json();
    if (j.error) throw new Error(`Meta API: ${j.error.message} (code ${j.error.code})`);
    alles.push(...(j.data || []));
    next = j.paging && j.paging.next;
  }
  return alles;
}
const actie = (r, type) => { const a = (r.actions || []).find(x => x.action_type === type); return a ? +a.value : 0; };

(async () => {
  const tr = encodeURIComponent(JSON.stringify({ since: VANAF, until: TOT }));
  const url = `https://graph.facebook.com/${VERSIE}/${ACCOUNT}/insights?level=campaign&time_increment=monthly` +
    `&time_range=${tr}&fields=campaign_name,spend,impressions,actions&limit=500&access_token=${TOKEN}`;
  const rijen = await haal(url);
  const perMaand = {};
  for (const r of rijen) {
    const m = r.date_start.slice(0, 7);
    const spend = +(+r.spend).toFixed(2);
    const kliks = actie(r, 'link_click');
    const leads = actie(r, 'lead');
    (perMaand[m] = perMaand[m] || {})[r.campaign_name] = {
      spend, kliks, leads, impressies: +r.impressions || 0,
      cpl: leads ? +(spend / leads).toFixed(2) : null,
    };
  }
  const maanden = Object.keys(perMaand).sort();
  if (!maanden.length) { console.error('Meta API gaf geen rijen terug voor', VANAF, '-', TOT); process.exit(1); }
  // bestaande maanden (uit CSV of eerdere runs) laten staan, API-maanden overschrijven
  let bestaand = {}; try { bestaand = JSON.parse(fs.readFileSync(UIT_CAMP, 'utf8')); } catch {}
  const camp = { ...bestaand, ...perMaand };
  let totalen = {}; try { totalen = JSON.parse(fs.readFileSync(UIT_TOT, 'utf8')); } catch {}
  for (const m of maanden) totalen[m] = +Object.values(perMaand[m]).reduce((a, v) => a + v.spend, 0).toFixed(2);
  totalen._bijgewerkt = new Date().toISOString();
  totalen._bron = `Meta Marketing API ${VERSIE}, ${ACCOUNT}, level=campaign, time_increment=monthly`;
  if (!DROOG) {
    fs.writeFileSync(UIT_CAMP, JSON.stringify(camp, null, 1));
    fs.writeFileSync(UIT_TOT, JSON.stringify(totalen, null, 1));
  }
  console.log((DROOG ? '[droog] ' : '') + 'Meta API:', maanden.map(m => {
    const v = Object.values(perMaand[m]);
    return `${m} €${totalen[m].toFixed(0)} (${v.length} camp, ${v.reduce((a, x) => a + x.leads, 0)} leads)`;
  }).join(', '));
})().catch(e => { console.error('meta-ads-api:', e.message); process.exit(1); });
