#!/usr/bin/env node
// Eenmalige migratie + reusable: zet per deal met een Reuzenpanda-id:
//   sonty_reuzenpanda_link = BEWERK-link (hub.reuzenpanda.nl/app/deals/pipeline?item={id})
//   sonty_offerte_link     = KLANT-offertelink (document.reuzenpanda.nl/...) — verplaatst indien daar nog
// Idempotent. Gebruik: node scripts/hubspot-fix-rp-links.js
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const BASE = 'https://api.hubapi.com';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const jpost = async (u, b) => (await fetch(u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();

(async () => {
  let deals = [], after, total = 0;
  do {
    const p = await jpost(`${BASE}/crm/v3/objects/deals/search`, {
      filterGroups: [{ filters: [{ propertyName: 'sonty_reuzenpanda_id', operator: 'HAS_PROPERTY' }] }],
      properties: ['sonty_reuzenpanda_id', 'sonty_reuzenpanda_link', 'sonty_offerte_link'],
      limit: 200, ...(after ? { after } : {}),
    });
    total = p.total; (p.results || []).forEach(d => deals.push(d)); after = p.paging?.next?.after;
  } while (after);
  console.log(`Deals met Reuzenpanda-id: ${total}`);

  const updates = [];
  for (const d of deals) {
    const id = d.properties.sonty_reuzenpanda_id;
    const cur = d.properties.sonty_reuzenpanda_link || '';
    const edit = `https://hub.reuzenpanda.nl/app/deals/pipeline?item=${id}`;
    const props = {};
    if (cur !== edit) props.sonty_reuzenpanda_link = edit;
    // klant-link verplaatsen indien de oude waarde een document-link was en offerte_link nog leeg
    if (/document\.reuzenpanda/.test(cur) && !d.properties.sonty_offerte_link) props.sonty_offerte_link = cur;
    if (Object.keys(props).length) updates.push({ id: d.id, properties: props });
  }
  console.log(`Te updaten: ${updates.length}`);
  let done = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    const r = await fetch(`${BASE}/crm/v3/objects/deals/batch/update`, { method: 'POST', headers: H, body: JSON.stringify({ inputs: chunk }) });
    if (r.ok) done += chunk.length; else console.log('batch fout', r.status, (await r.text()).slice(0, 120));
    await new Promise(x => setTimeout(x, 120));
  }
  console.log(`Klaar. Bijgewerkt: ${done}`);
})();
