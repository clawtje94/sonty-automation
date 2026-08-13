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
const DAGEN = parseInt(process.argv[2] || '7', 10);

async function api(method, pathname, body) {
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
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const STATS = ['recipients', 'opens', 'open_rate', 'clicks', 'click_rate', 'conversions', 'conversion_rate', 'conversion_value', 'revenue_per_recipient', 'unsubscribe_rate', 'spam_complaint_rate'];

(async () => {
  // Placed Order metric-id opzoeken (conversie-metric)
  const metrics = await api('GET', 'metrics');
  const placedOrder = (metrics.data || []).find((m) => m.attributes.name === 'Placed Order');
  if (!placedOrder) throw new Error('Placed Order metric niet gevonden');

  const timeframe = { key: `last_${DAGEN === 7 ? '7' : DAGEN === 30 ? '30' : '90'}_days` };

  console.log(`KLAVIYO WEEKRAPPORT — laatste ${DAGEN} dagen (${new Date().toISOString().slice(0, 10)})`);

  // Flows
  const flowReport = await api('POST', 'flow-values-reports', {
    data: {
      type: 'flow-values-report',
      attributes: {
        statistics: STATS,
        timeframe,
        conversion_metric_id: placedOrder.id,
      },
    },
  });
  // Flow-namen erbij
  const flows = await api('GET', 'flows', undefined);
  const flowNames = Object.fromEntries((flows.data || []).map((f) => [f.id, `${f.attributes.name} [${f.attributes.status}]`]));

  console.log('\n=== FLOWS (gesorteerd op omzet) ===');
  const rows = (flowReport.data?.attributes?.results || [])
    .map((r) => ({ id: r.groupings.flow_id, kanaal: r.groupings.send_channel, ...r.statistics }))
    .filter((r) => r.recipients > 0)
    .sort((a, b) => (b.conversion_value || 0) - (a.conversion_value || 0));
  for (const r of rows) {
    console.log(
      `- ${flowNames[r.id] || r.id} (${r.kanaal})\n` +
        `    ontvangers ${r.recipients} | open ${(r.open_rate * 100).toFixed(1)}% | click ${(r.click_rate * 100).toFixed(2)}% | conversies ${r.conversions} (${(r.conversion_rate * 100).toFixed(2)}%) | omzet €${(r.conversion_value || 0).toFixed(0)} | RPR €${(r.revenue_per_recipient || 0).toFixed(2)} | unsub ${(r.unsubscribe_rate * 100).toFixed(2)}% | spam ${(r.spam_complaint_rate * 100).toFixed(3)}%`
    );
  }

  // Campagnes
  const campReport = await api('POST', 'campaign-values-reports', {
    data: {
      type: 'campaign-values-report',
      attributes: {
        statistics: STATS,
        timeframe,
        conversion_metric_id: placedOrder.id,
        filter: "equals(campaign.channel,'email')",
      },
    },
  });
  const camps = await api('GET', "campaigns?filter=equals(messages.channel,'email')&sort=-created_at&page[size]=50");
  const campNames = Object.fromEntries((camps.data || []).map((c) => [c.id, c.attributes.name]));

  console.log('\n=== CAMPAGNES (afgelopen periode) ===');
  const crows = (campReport.data?.attributes?.results || [])
    .map((r) => ({ id: r.groupings.campaign_id, ...r.statistics }))
    .filter((r) => r.recipients > 0)
    .sort((a, b) => (b.conversion_value || 0) - (a.conversion_value || 0));
  for (const r of crows) {
    console.log(
      `- ${campNames[r.id] || r.id}\n` +
        `    ontvangers ${r.recipients} | open ${(r.open_rate * 100).toFixed(1)}% | click ${(r.click_rate * 100).toFixed(2)}% | conversies ${r.conversions} (${(r.conversion_rate * 100).toFixed(2)}%) | omzet €${(r.conversion_value || 0).toFixed(0)} | RPR €${(r.revenue_per_recipient || 0).toFixed(2)} | unsub ${(r.unsubscribe_rate * 100).toFixed(2)}% | spam ${(r.spam_complaint_rate * 100).toFixed(3)}%`
    );
  }

  // Totalen
  const somF = rows.reduce((s, r) => s + (r.conversion_value || 0), 0);
  const somC = crows.reduce((s, r) => s + (r.conversion_value || 0), 0);
  const tot = somF + somC;
  console.log(`\n=== TOTAAL ===\nFlow-omzet: €${somF.toFixed(0)} (${tot ? ((somF / tot) * 100).toFixed(0) : 0}%) | Campagne-omzet: €${somC.toFixed(0)} (${tot ? ((somC / tot) * 100).toFixed(0) : 0}%) | Totaal e-mail: €${tot.toFixed(0)}`);
  console.log('Benchmark: flows horen richting 30-50% van e-mailomzet te leveren; spam < 0,1%, unsub-campagnes < 0,3%.');
})().catch((e) => {
  console.error('FOUT:', e.message);
  process.exit(1);
});
