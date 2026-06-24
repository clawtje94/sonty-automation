#!/usr/bin/env node
// Schrijft per contactpersoon een leesbare WhatsApp- en Mail-geschiedenis (uit Trengo) naar HubSpot.
// WA: match op telefoon. Mail: zoek tickets op e-mail. Thread = laatste ~15 berichten.
// Gebruik: node scripts/hubspot-trengo-summary.js [all|recent|N]
const fs = require('fs');
const path = require('path');
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const { normPhone } = require('./te-ver-phones');
const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const WA_CHANNEL = 1359857;
const EMAIL_CHANNELS = new Set([1347356, 1347358, 1359813, 1363384, 1363385]);
const STAGE = '4998659267';
const HS = 'https://api.hubapi.com';
const HH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const TH = { Authorization: `Bearer ${TT}` };
const arg = process.argv[2] || '5';
const ALL = arg === 'all', RECENT = arg === 'recent';
const hget = async u => (await fetch(u, { headers: HH })).json();
const hpost = async (u, b) => (await fetch(u, { method: 'POST', headers: HH, body: JSON.stringify(b) })).json();
const tget = async u => { const r = await fetch(u, { headers: TH }); return r.ok ? r.json() : null; };

function buildThread(messages) {
  if (!messages || !messages.length) return '';
  // chronologisch sorteren (oudste boven), dan de nieuwste 20 berichten
  const chron = messages.slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  return chron.slice(-20).map(m => {
    const who = (m.type === 'INBOUND') ? 'Klant' : 'Sonty';
    const txt = (m.message || m.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
    const dt = (m.created_at || '').slice(0, 16);
    return txt ? `${dt} ${who}: ${txt}` : '';
  }).filter(Boolean).join('\n');
}

async function ticketThread(ticketId) {
  const j = await tget(`https://app.trengo.com/api/v2/tickets/${ticketId}/messages`);
  return buildThread(j && (j.data || j));
}

// WA-map: telefoon -> recentste ticketId
async function buildWaMap() {
  const map = new Map();
  for (let page = 1; page <= 100; page++) {
    const j = await tget(`https://app.trengo.com/api/v2/tickets?channel_id=${WA_CHANNEL}&page=${page}`);
    const tickets = j && j.data; if (!tickets || !tickets.length) break;
    for (const t of tickets) {
      const ph = normPhone(t.contact && t.contact.phone); if (!ph) continue;
      const date = t.latest_message_at || t.updated_at || t.created_at;
      const cur = map.get(ph);
      if (!cur || new Date(date) > new Date(cur.date)) map.set(ph, { date, ticketId: t.id });
    }
    await new Promise(x => setTimeout(x, 100));
  }
  return map;
}

// volledige e-maildiscussie: voeg ALLE e-mailtickets van het adres samen (incl. antwoorden naar aanvragen@ etc.)
async function getEmailThread(email) {
  const j = await tget(`https://app.trengo.com/api/v2/tickets?term=${encodeURIComponent(email)}`);
  const tickets = ((j && j.data) || []).filter(t => EMAIL_CHANNELS.has(t.channel && t.channel.id) || (t.channel && /mail/i.test(t.channel.type || '')));
  if (!tickets.length) return '';
  // nieuwste tickets eerst, max 6 tickets samenvoegen
  tickets.sort((a, b) => new Date(b.latest_message_at || b.updated_at || 0) - new Date(a.latest_message_at || a.updated_at || 0));
  let all = [];
  for (const t of tickets.slice(0, 6)) {
    const m = await tget(`https://app.trengo.com/api/v2/tickets/${t.id}/messages`);
    const msgs = (m && (m.data || m)) || [];
    all.push(...msgs);
  }
  return buildThread(all);
}

(async () => {
  console.log('WhatsApp-gesprekken indexeren...');
  const wa = await buildWaMap();
  console.log(`WA-nummers: ${wa.size}\n`);

  const since = RECENT ? String(Date.now() - 2 * 3600 * 1000) : new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const body = { filterGroups: [{ filters: [
      { propertyName: 'dealstage', operator: 'EQ', value: STAGE },
      { propertyName: 'createdate', operator: 'GTE', value: since }] }],
    sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }], properties: ['dealname'], limit: 200 };
  let deals = [], after, total = 0;
  do { const p = await hpost(`${HS}/crm/v3/objects/deals/search`, after ? { ...body, after } : body);
    total = p.total; deals.push(...(p.results || [])); after = p.paging?.next?.after;
  } while ((ALL || RECENT) && after && deals.length < total);
  if (!ALL && !RECENT) deals = deals.slice(0, parseInt(arg, 10) || 5);
  console.log(`Verse leads: ${total}. Verwerk: ${deals.length}\n`);

  let waN = 0, mailN = 0;
  const seen = new Set();
  for (const d of deals) {
    await new Promise(r => setTimeout(r, 80));
    const ac = await hget(`${HS}/crm/v4/objects/deals/${d.id}/associations/contacts`);
    const cid = ac.results?.[0]?.toObjectId; if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    const c = await hget(`${HS}/crm/v3/objects/contacts/${cid}?properties=phone,mobilephone,email`);
    const ph = normPhone(c.properties.phone || c.properties.mobilephone || '');
    const email = (c.properties.email || '').trim();
    const props = {};
    const waHit = ph && wa.get(ph);
    if (waHit) { const t = await ticketThread(waHit.ticketId); if (t) { props.sonty_wa_samenvatting = t; waN++; } }
    if (email) { const t = await getEmailThread(email); if (t) { props.sonty_mail_samenvatting = t; mailN++; } }
    if (Object.keys(props).length) {
      await fetch(`${HS}/crm/v3/objects/contacts/${cid}`, { method: 'PATCH', headers: HH, body: JSON.stringify({ properties: props }) });
      console.log(`${d.properties.dealname}: ${props.sonty_wa_samenvatting ? 'WA ' : ''}${props.sonty_mail_samenvatting ? 'Mail' : ''}`);
    }
  }
  console.log(`\nKlaar. WhatsApp-samenvattingen: ${waN}, Mail-samenvattingen: ${mailN}`);
})();
