#!/usr/bin/env node
/**
 * Eenmalig (04-09-2026): flow "Sonty E | Service en review" herbouwen met trigger METRIC
 * "Montage afgerond" (uit montage-events.js) in plaats van segment "5. Klant (akkoord)".
 * Stappen: metric aanmaken via één event op een intern adres → flow klonen met nieuwe trigger
 * → live zetten → oude flow hernoemen (staat al op draft).
 */
const fs = require('fs');
const { KLAVIYO_API_KEY } = require('../secrets.js');
const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, revision: '2026-07-15', accept: 'application/json', 'content-type': 'application/vnd.api+json' };
const HPRE = { ...H, revision: '2024-10-15.pre' };
const HJ = { ...H, revision: '2024-10-15', 'content-type': 'application/json' };
const OUD = 'RSKdNg';
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. metric laten bestaan (intern adres, event ligt vóór de flow → triggert niets)
  let r = await fetch('https://a.klaviyo.com/api/events/', { method: 'POST', headers: HJ, body: JSON.stringify({ data: { type: 'event', attributes: {
    metric: { data: { type: 'metric', attributes: { name: 'Montage afgerond' } } },
    profile: { data: { type: 'profile', attributes: { email: 'aanvragen@sonty.nl' } } },
    properties: { test: true, reden: 'metric aanmaken voor flow E' }, unique_id: 'montage-metric-aanmaak-2026-09-04' } } }) });
  console.log('metric-event:', r.status);
  let metricId = null;
  for (let i = 0; i < 10 && !metricId; i++) {
    await wacht(3000);
    const ms = await (await fetch('https://a.klaviyo.com/api/metrics/', { headers: HJ })).json();
    metricId = (ms.data || []).find((m) => m.attributes.name === 'Montage afgerond')?.id || null;
  }
  if (!metricId) throw new Error('metric "Montage afgerond" niet gevonden na 30 s');
  console.log('metric id:', metricId);

  // 2. definitie van de oude flow ophalen en ombouwen
  const det = await (await fetch(`https://a.klaviyo.com/api/flows/${OUD}/?additional-fields%5Bflow%5D=definition`, { headers: H })).json();
  const df = det.data.attributes.definition;
  const schoon = (o) => { if (Array.isArray(o)) { o.forEach(schoon); return; } if (o && typeof o === 'object') { delete o.id; Object.values(o).forEach(schoon); } };
  df.actions.forEach((a, i) => { schoon(a.data || {}); a.temporary_id = 'stap-' + i; delete a.id; a.links = { next: i + 1 < df.actions.length ? 'stap-' + (i + 1) : null }; });
  df.entry_action_id = 'stap-0';
  df.triggers = [{ type: 'metric', id: metricId, trigger_filter: null }];
  df.profile_filter = { condition_groups: [{ conditions: [{ type: 'profile-property', property: "properties['sonty_mag_mail']", filter: { type: 'string', operator: 'equals', value: 'ja' } }] }] };
  const naam = 'Sonty E | Service en review [v0904 na montage]';
  const mk = await (await fetch('https://a.klaviyo.com/api/flows/', { method: 'POST', headers: HPRE, body: JSON.stringify({ data: { type: 'flow', attributes: { name: naam, definition: df } } }) })).json();
  if (!mk.data?.id) throw new Error('flow aanmaken mislukt: ' + JSON.stringify(mk).slice(0, 400));
  console.log('nieuwe flow:', mk.data.id, naam);

  // 3. live zetten + controleren
  r = await fetch(`https://a.klaviyo.com/api/flows/${mk.data.id}/`, { method: 'PATCH', headers: H, body: JSON.stringify({ data: { type: 'flow', id: mk.data.id, attributes: { status: 'live' } } }) });
  console.log('live zetten:', r.status);
  const chk = await (await fetch(`https://a.klaviyo.com/api/flows/${mk.data.id}/?include=flow-actions`, { headers: HJ })).json();
  console.log('status:', chk.data.attributes.status, '| trigger:', chk.data.attributes.trigger_type, '| acties:', (chk.included || []).map((a) => a.attributes.action_type + ':' + a.attributes.status).join(', '));

  // 4. oude flow hernoemen (blijft draft)
  r = await fetch(`https://a.klaviyo.com/api/flows/${OUD}/`, { method: 'PATCH', headers: H, body: JSON.stringify({ data: { type: 'flow', id: OUD, attributes: { name: 'Sonty E | Service en review [v0819 UIT: triggerde op akkoord i.p.v. montage]' } } }) });
  console.log('oude flow hernoemen:', r.status);
  fs.writeFileSync(__dirname + '/../../data/email/flow-e-montage.json', JSON.stringify({ flowId: mk.data.id, metricId, oud: OUD, op: new Date().toISOString() }, null, 1));
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
