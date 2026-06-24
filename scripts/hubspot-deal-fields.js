#!/usr/bin/env node
// Vult deal-velden voor de bellijst: 📞 Telefoon (sonty_telefoon, van contact) en
// ⏳ Leeftijd (dagen) (deal_leeftijd_dagen, sinds createdate). Idempotent.
// Gebruik: node scripts/hubspot-deal-fields.js [all|recent|N]
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const STAGE = '4998659267';
const BASE = 'https://api.hubapi.com';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const arg = process.argv[2] || '5';
const ALL = arg === 'all', RECENT = arg === 'recent';
const jget = async u => (await fetch(u, { headers: H })).json();
const jpost = async (u, b) => (await fetch(u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();

(async () => {
  const since = RECENT ? String(Date.now() - 2 * 3600 * 1000) : new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const body = { filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: STAGE },
      { propertyName: 'createdate', operator: 'GTE', value: since }] }],
    sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
    properties: ['dealname', 'createdate', 'sonty_telefoon', 'deal_leeftijd_dagen'], limit: 200 };
  let deals = [], after, total = 0;
  do { const p = await jpost(`${BASE}/crm/v3/objects/deals/search`, after ? { ...body, after } : body);
    total = p.total; deals.push(...(p.results || [])); after = p.paging?.next?.after;
  } while ((ALL || RECENT) && after && deals.length < total);
  if (!ALL && !RECENT) deals = deals.slice(0, parseInt(arg, 10) || 5);
  console.log(`Verse leads: ${total}. Verwerk: ${deals.length}`);

  let n = 0;
  for (const d of deals) {
    await new Promise(r => setTimeout(r, 60));
    const leeftijd = Math.floor((Date.now() - new Date(d.properties.createdate).getTime()) / 864e5);
    const props = { deal_leeftijd_dagen: String(leeftijd) };
    if (!d.properties.sonty_telefoon) {
      const ac = await jget(`${BASE}/crm/v4/objects/deals/${d.id}/associations/contacts`);
      const cid = ac.results?.[0]?.toObjectId;
      if (cid) { const c = await jget(`${BASE}/crm/v3/objects/contacts/${cid}?properties=phone,mobilephone`);
        const tel = c.properties.phone || c.properties.mobilephone; if (tel) props.sonty_telefoon = tel; }
    }
    await fetch(`${BASE}/crm/v3/objects/deals/${d.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ properties: props }) });
    n++;
  }
  console.log(`Klaar. Bijgewerkt: ${n}`);
})();
