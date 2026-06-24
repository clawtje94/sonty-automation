#!/usr/bin/env node
// Sync Trengo WhatsApp-status naar HubSpot-deals: is er WA-contact, laatste bericht,
// status en een directe Trengo-link (om vanuit HubSpot te antwoorden/sturen).
// Match: Trengo WA-ticket contact.phone -> HubSpot deal (gekoppeld contact).
// Gebruik: node scripts/hubspot-sync-trengo-wa.js [all|recent|N]
const fs = require('fs');
const path = require('path');
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const { normPhone } = require('./te-ver-phones');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const WA_CHANNEL = 1359857;
const STAGE = '4998659267';
const HS = 'https://api.hubapi.com';
const HH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const TH = { Authorization: `Bearer ${TT}`, 'Content-Type': 'application/json' };
const arg = process.argv[2] || '5';
const ALL = arg === 'all', RECENT = arg === 'recent';
const hget = async u => (await fetch(u, { headers: HH })).json();
const hpost = async (u, b) => (await fetch(u, { method: 'POST', headers: HH, body: JSON.stringify(b) })).json();

// Bouw telefoon -> {date,status,ticketId} uit Trengo WA-tickets (recentste per nummer)
async function buildWaMap() {
  const map = new Map();
  for (let page = 1; page <= 100; page++) {
    const r = await fetch(`https://app.trengo.com/api/v2/tickets?channel_id=${WA_CHANNEL}&page=${page}`, { headers: TH });
    if (!r.ok) break;
    const j = await r.json();
    const tickets = j.data || [];
    if (!tickets.length) break;
    for (const t of tickets) {
      const ph = normPhone(t.contact && t.contact.phone);
      if (!ph) continue;
      const date = t.latest_message_at || t.updated_at || t.created_at;
      const cur = map.get(ph);
      if (!cur || new Date(date) > new Date(cur.date)) {
        map.set(ph, { date, status: t.status, ticketId: t.id });
      }
    }
    await new Promise(x => setTimeout(x, 120));
  }
  return map;
}

(async () => {
  console.log('Trengo WA-gesprekken laden...');
  const wa = await buildWaMap();
  console.log(`WA-nummers met gesprek: ${wa.size}\n`);

  const since = RECENT ? String(Date.now() - 2 * 3600 * 1000) : new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const body = { filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: STAGE },
      { propertyName: 'createdate', operator: 'GTE', value: since }] }],
    sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
    properties: ['dealname'], limit: 200 };
  let deals = [], after, total = 0;
  do { const p = await hpost(`${HS}/crm/v3/objects/deals/search`, after ? { ...body, after } : body);
    total = p.total; deals.push(...(p.results || [])); after = p.paging?.next?.after;
  } while ((ALL || RECENT) && after && deals.length < total);
  if (!ALL && !RECENT) deals = deals.slice(0, parseInt(arg, 10) || 5);
  console.log(`Verse leads: ${total}. Verwerk: ${deals.length}\n`);

  let withWa = 0, n = 0;
  for (const d of deals) {
    await new Promise(r => setTimeout(r, 60));
    const ac = await hget(`${HS}/crm/v4/objects/deals/${d.id}/associations/contacts`);
    const cid = ac.results?.[0]?.toObjectId; if (!cid) continue;
    const c = await hget(`${HS}/crm/v3/objects/contacts/${cid}?properties=phone,mobilephone`);
    const ph = normPhone(c.properties.phone || c.properties.mobilephone || '');
    const hit = ph && wa.get(ph);
    const props = hit
      ? { sonty_wa_contact_gehad: 'true', sonty_wa_laatste: String(new Date(hit.date).getTime()),
          sonty_wa_status: (hit.status || '').toUpperCase() === 'CLOSED' ? 'closed' : 'open',
          sonty_wa_link: `https://app.trengo.com/tickets/${hit.ticketId}` }
      : { sonty_wa_contact_gehad: 'false' };
    await fetch(`${HS}/crm/v3/objects/deals/${d.id}`, { method: 'PATCH', headers: HH, body: JSON.stringify({ properties: props }) });
    if (hit) { withWa++; console.log(`WA  ${d.properties.dealname} | ${hit.status} | ${hit.date}`); }
    n++;
  }
  console.log(`\nKlaar. Verwerkt: ${n}, met WhatsApp-contact: ${withWa}`);
})();
