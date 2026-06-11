/**
 * HubSpot Deal Enrichment — voegt Reuzenpanda link toe aan deals die het nog niet hebben
 * Run periodiek of als cron job
 */
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const BASE = 'https://api.hubapi.com';

async function main() {
  // Find deals in Sonty pipeline without Reuzenpanda link
  const res = await fetch(`${BASE}/crm/v3/objects/deals/search`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{
        filters: [
          { propertyName: 'pipeline', operator: 'EQ', value: '3623322812' },
          { propertyName: 'sonty_reuzenpanda_link', operator: 'NOT_HAS_PROPERTY' },
        ]
      }],
      properties: ['dealname', 'sonty_reuzenpanda_description', 'sonty_reuzenpanda_link', 'sonty_reuzenpanda_id'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 20,
    }),
  });

  const data = await res.json();
  console.log('Deals without Reuzenpanda link:', data.total || 0);

  if (!data.results?.length) {
    console.log('All deals have links already!');
    return;
  }

  for (const deal of data.results) {
    const desc = deal.properties.sonty_reuzenpanda_description;
    const existingLink = deal.properties.sonty_reuzenpanda_link;
    const existingId = deal.properties.sonty_reuzenpanda_id;

    if (existingLink) continue;

    console.log('\nDeal:', deal.properties.dealname, '(ID:', deal.id + ')');

    // If we don't have the RP ID, we can't construct the link
    // But we can still note that it needs one
    if (!existingId) {
      console.log('  No Reuzenpanda ID — skipping link (needs Zapier mapping)');
      continue;
    }

    const link = `https://hub.reuzenpanda.nl/app/deals/pipeline?item=${existingId}`;
    const updateRes = await fetch(`${BASE}/crm/v3/objects/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { sonty_reuzenpanda_link: link }
      }),
    });
    console.log('  Link added:', updateRes.status === 200 ? '✅' : '❌');
  }
}

main().catch(console.error);
