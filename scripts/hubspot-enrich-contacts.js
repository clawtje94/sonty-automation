#!/usr/bin/env node
// Vult contacten van verse leads aan: voor/achternaam (uit dealnaam), telefoon naar standaardveld, eigenaar.
// Maakt records duidelijk (contacten hadden vaak alleen e-mail). Idempotent: vult alleen lege velden.
// Gebruik: node scripts/hubspot-enrich-contacts.js [all|N]
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const OWNER = '89279987';
const STAGE = '4998659267';
const BASE = 'https://api.hubapi.com';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const arg = process.argv[2] || '5';
const ALL = arg === 'all';
const jget = async u => (await fetch(u, { headers: H })).json();
const jpost = async (u, b) => (await fetch(u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
(async () => {
  const since = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const body = { filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: STAGE },
      { propertyName: 'createdate', operator: 'GTE', value: since }] }],
    sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
    properties: ['dealname', 'hubspot_owner_id'], limit: 200 };
  let deals = [], after, total = 0;
  do { const p = await jpost(`${BASE}/crm/v3/objects/deals/search`, after ? { ...body, after } : body);
    total = p.total; deals.push(...(p.results || [])); after = p.paging?.next?.after;
  } while (ALL && after && deals.length < total);
  if (!ALL) deals = deals.slice(0, parseInt(arg, 10) || 5);
  console.log(`Verse leads: ${total}. Verwerk: ${deals.length}\n`);
  let nC = 0, nD = 0;
  for (const d of deals) {
    await new Promise(r => setTimeout(r, 70));
    const naam = (d.properties.dealname || '').trim();
    const parts = naam.split(/\s+/); const first = parts.shift() || ''; const last = parts.join(' ');
    // deal owner
    if (!d.properties.hubspot_owner_id) { await fetch(`${BASE}/crm/v3/objects/deals/${d.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ properties: { hubspot_owner_id: OWNER } }) }); nD++; }
    // contact
    const ac = await jget(`${BASE}/crm/v4/objects/deals/${d.id}/associations/contacts`);
    const cid = ac.results?.[0]?.toObjectId; if (!cid) continue;
    const c = await jget(`${BASE}/crm/v3/objects/contacts/${cid}?properties=firstname,lastname,phone,mobilephone,hubspot_owner_id`);
    const u = {};
    if (!c.properties.firstname && first) u.firstname = first;
    if (!c.properties.lastname && last) u.lastname = last;
    if (!c.properties.phone && c.properties.mobilephone) u.phone = c.properties.mobilephone;
    if (!c.properties.hubspot_owner_id) u.hubspot_owner_id = OWNER;
    if (Object.keys(u).length) { await fetch(`${BASE}/crm/v3/objects/contacts/${cid}`, { method: 'PATCH', headers: H, body: JSON.stringify({ properties: u }) }); nC++; }
  }
  console.log(`\nKlaar. Contacten verrijkt: ${nC}, deal-eigenaren gezet: ${nD}`);
})();
