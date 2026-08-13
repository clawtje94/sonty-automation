#!/usr/bin/env node
// Wekelijks Klaviyo-prestatierapport (ALLEEN-LEZEN: reporting-queries, wijzigt niets).
// Haalt per flow en per campagne: recipients, open/click rate, conversies en omzet.
// Gebruik: node klaviyo-week-rapport.js [dagen]  (default 7)

const fs = require('fs');
const path = require('path');

// Default: Sonty-key. Override met KLAVIYO_KEY_FILE=<pad naar bestand met alleen de key>
const KEY = fs
  .readFileSync(process.env.KLAVIYO_KEY_FILE || path.join(process.env.HOME, 'sonty/scripts/.klaviyo-private-key.txt'), 'utf8')
  .trim();
const REVISION = '2026-07-15';
const DAGEN = parseInt((process.argv.find((a) => /^\d+$/.test(a)) || '7'), 10);
const ALS_JSON = process.argv.includes('--json');

async function api(method, pathname, body, poging = 0) {
  const res = await fetch(`https://a.klaviyo.com/api/${pathname}`, {
    method,
    headers: {
      Authorization: `Klaviyo-API-Key ${KEY}`,
      revision: REVISION,
      accept: 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && poging < 5) {
    const wacht = Number(res.headers.get('retry-after')) || 5;
    await new Promise((r) => setTimeout(r, (wacht + 1) * 1000));
    return api(method, pathname, body, poging + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const STATS_CONVERSIE = ['recipients', 'opens', 'open_rate', 'clicks', 'click_rate', 'conversions', 'conversion_rate', 'conversion_value', 'revenue_per_recipient', 'unsubscribe_rate', 'spam_complaint_rate'];
// Sonty is lead-gen: er is geen bruikbare order-metric in dit account (Placed Order is een
// slapende WooCommerce-metric waar de reporting-API 400 op geeft). Dan meten we engagement en
// gezondheid via Klaviyo, en komt conversie uit de sheet (zie MASTERPLAN, wekelijkse bot).
const STATS_BASIS = ['recipients', 'opens', 'open_rate', 'clicks', 'click_rate', 'unsubscribe_rate', 'spam_complaint_rate'];

const regel = (r) => {
  const basis = `ontvangers ${r.recipients} | open ${(r.open_rate * 100).toFixed(1)}% | click ${(r.click_rate * 100).toFixed(2)}%`;
  const conversie = r.conversions == null ? '' : ` | conversies ${r.conversions} (${(r.conversion_rate * 100).toFixed(2)}%) | omzet €${(r.conversion_value || 0).toFixed(0)} | RPR €${(r.revenue_per_recipient || 0).toFixed(2)}`;
  return `${basis}${conversie} | unsub ${(r.unsubscribe_rate * 100).toFixed(2)}% | spam ${(r.spam_complaint_rate * 100).toFixed(3)}%`;
};

(async () => {
  // Placed Order metric-id opzoeken (conversie-metric); reporting-API eist er altijd één,
  // ook als we alleen basisstatistieken opvragen.
  const metrics = await api('GET', 'metrics');
  const placedOrder = (metrics.data || []).find((m) => m.attributes.name === 'Placed Order');
  if (!placedOrder) throw new Error('Placed Order metric niet gevonden');

  const timeframe = { key: `last_${DAGEN === 7 ? '7' : DAGEN === 30 ? '30' : '90'}_days` };

  if (!ALS_JSON) console.log(`KLAVIYO WEEKRAPPORT — laatste ${DAGEN} dagen (${new Date().toISOString().slice(0, 10)})`);

  let STATS = STATS_CONVERSIE;
  const values = (type, extra) => ({
    data: { type: `${type}-values-report`, attributes: { statistics: STATS, timeframe, conversion_metric_id: placedOrder.id, ...extra } },
  });

  // Flows (met terugval naar basisstatistieken als de conversie-metric niet querybaar is)
  let flowReport;
  try {
    flowReport = await api('POST', 'flow-values-reports', values('flow'));
  } catch (e) {
    if (!/conversion metric/i.test(e.message)) throw e;
    STATS = STATS_BASIS;
    flowReport = await api('POST', 'flow-values-reports', values('flow'));
  }
  // Flow-namen erbij
  const flows = await api('GET', 'flows', undefined);
  const flowNames = Object.fromEntries((flows.data || []).map((f) => [f.id, `${f.attributes.name} [${f.attributes.status}]`]));

  if (!ALS_JSON) console.log('\n=== FLOWS (gesorteerd op omzet) ===');
  const rows = (flowReport.data?.attributes?.results || [])
    .map((r) => ({ id: r.groupings.flow_id, kanaal: r.groupings.send_channel, naam: null, ...r.statistics }))
    .filter((r) => r.recipients > 0)
    .sort((a, b) => (b.conversion_value || 0) - (a.conversion_value || 0));
  rows.forEach((r) => { r.naam = flowNames[r.id] || r.id; });
  for (const r of ALS_JSON ? [] : rows) {
    console.log(`- ${flowNames[r.id] || r.id} (${r.kanaal})\n    ${regel(r)}`);
  }

  // Campagnes
  const campReport = await api('POST', 'campaign-values-reports', values('campaign', { filter: "equals(send_channel,'email')" }));
  const camps = await api('GET', "campaigns?filter=equals(messages.channel,'email')&sort=-created_at&page[size]=50");
  const campNames = Object.fromEntries((camps.data || []).map((c) => [c.id, c.attributes.name]));

  if (!ALS_JSON) console.log('\n=== CAMPAGNES (afgelopen periode) ===');
  const crows = (campReport.data?.attributes?.results || [])
    .map((r) => ({ id: r.groupings.campaign_id, naam: null, ...r.statistics }))
    .filter((r) => r.recipients > 0)
    .sort((a, b) => (b.conversion_value || 0) - (a.conversion_value || 0));
  crows.forEach((r) => { r.naam = campNames[r.id] || r.id; });
  for (const r of ALS_JSON ? [] : crows) {
    console.log(`- ${campNames[r.id] || r.id}\n    ${regel(r)}`);
  }

  // Totalen
  const somF = rows.reduce((s, r) => s + (r.conversion_value || 0), 0);
  const somC = crows.reduce((s, r) => s + (r.conversion_value || 0), 0);
  const tot = somF + somC;
  if (ALS_JSON) {
    console.log(JSON.stringify({ dagen: DAGEN, flows: rows, campagnes: crows, flowOmzet: somF, campagneOmzet: somC, totaal: tot }));
    return;
  }
  console.log(`\n=== TOTAAL ===\nFlow-omzet: €${somF.toFixed(0)} (${tot ? ((somF / tot) * 100).toFixed(0) : 0}%) | Campagne-omzet: €${somC.toFixed(0)} (${tot ? ((somC / tot) * 100).toFixed(0) : 0}%) | Totaal e-mail: €${tot.toFixed(0)}`);
  console.log('Benchmark: flows horen richting 30-50% van e-mailomzet te leveren; spam < 0,1%, unsub-campagnes < 0,3%.');
})().catch((e) => {
  console.error('FOUT:', e.message);
  process.exit(1);
});
