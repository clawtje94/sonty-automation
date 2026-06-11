const { chromium } = require('playwright');

const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const HS_BASE = 'https://api.hubapi.com';
const RP_PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

function formatQuote(quotData, versionData) {
  const lines = [];
  const q = quotData.quotationData || quotData;
  lines.push('📄 ' + (q.documentTitle || 'Offerte'));
  lines.push('Status: ' + (q.quotationStatus || '-'));
  lines.push('Nummer: ' + (q.quotationNumber || '-'));
  lines.push('');
  const version = versionData?.versions?.[0];
  if (version?.data?.segments) {
    const pg = version.data.segments.find(s => s.type === 'priceLineGroup');
    if (pg?.data?.lines) {
      lines.push('─── Producten ───');
      let total = 0;
      for (const l of pg.data.lines) {
        const name = l.description.split('\n')[0];
        const specs = l.description.split('\n').slice(1).filter(x => x.trim()).slice(0, 4);
        const lt = l.units * l.pricePerUnit;
        total += lt;
        lines.push('');
        lines.push(l.units + 'x ' + name);
        lines.push('   €' + l.pricePerUnit.toFixed(2) + ' → €' + lt.toFixed(2));
        specs.forEach(s => lines.push('  ' + s.trim()));
      }
      lines.push('');
      lines.push('─── Totaal ───');
      lines.push('Excl BTW: €' + total.toFixed(2));
      lines.push('Incl BTW: €' + (total * 1.21).toFixed(2));
    }
  }
  return lines.join('\n');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login RP
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  await page.click('text=Sonty B.V.');
  await page.waitForTimeout(5000);
  console.log('RP OK');

  // Get HubSpot deals + contact emails
  const hsRes = await fetch(HS_BASE + '/crm/v3/objects/deals/search', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [
        { propertyName: 'pipeline', operator: 'EQ', value: '3623322812' },
        { propertyName: 'sonty_reuzenpanda_description', operator: 'NOT_HAS_PROPERTY' },
      ]}],
      properties: ['dealname'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 50,
    }),
  });
  const hsDeals = (await hsRes.json()).results || [];

  // Build email map
  const emailToDeal = {};
  for (const deal of hsDeals) {
    const aRes = await fetch(HS_BASE + '/crm/v4/objects/deals/' + deal.id + '/associations/contacts', {
      headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
    });
    const aData = await aRes.json();
    const cId = aData.results?.[0]?.toObjectId;
    if (cId) {
      const cRes = await fetch(HS_BASE + '/crm/v3/objects/contacts/' + cId + '?properties=email', {
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
      });
      const email = (await cRes.json()).properties?.email;
      if (email) emailToDeal[email.toLowerCase()] = { dealId: deal.id, dealName: deal.properties.dealname };
    }
  }
  console.log('Email→Deal map:', Object.keys(emailToDeal).length, 'entries');
  Object.entries(emailToDeal).slice(0, 5).forEach(([e, d]) => console.log('  ' + e + ' → ' + d.dealName));

  // Search RP for documents by these emails
  // Use the RP search/filter API for contact persons
  const rpResults = await page.evaluate(async ({ profileId, emails }) => {
    const results = [];
    for (const email of emails) {
      try {
        // Search RP contact persons by email
        const cpRes = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/contact-persons/search?profile_id=' + profileId + '&query=' + encodeURIComponent(email), { credentials: 'include' });
        if (cpRes.status === 200) {
          const cpData = await cpRes.json();
          results.push({ email, data: cpData, status: cpRes.status });
        } else {
          // Try alternative endpoint
          const cpRes2 = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/contact-persons?profile_id=' + profileId + '&email=' + encodeURIComponent(email), { credentials: 'include' });
          const cpData2 = await cpRes2.json();
          results.push({ email, data: cpData2, status: cpRes2.status });
        }
      } catch(e) {
        results.push({ email, error: e.message });
      }
    }
    return results;
  }, { profileId: RP_PROFILE_ID, emails: Object.keys(emailToDeal).slice(0, 5) });

  console.log('\nRP contact search results:');
  rpResults.forEach(r => {
    console.log('  ' + r.email + ': status=' + r.status);
    if (r.data) console.log('    ' + JSON.stringify(r.data).substring(0, 200));
  });

  // Alternative: use the RP deals API to find deals by searching
  console.log('\n=== RP Deals search ===');
  const rpDealsSearch = await page.evaluate(async ({ profileId, emails }) => {
    const results = [];
    for (const email of emails.slice(0, 3)) {
      try {
        // Try searching deals
        const res = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/lead-configuration/search?profile_id=' + profileId + '&query=' + encodeURIComponent(email), { credentials: 'include' });
        const data = await res.json();
        results.push({ email, status: res.status, data: JSON.stringify(data).substring(0, 300) });
      } catch(e) {
        results.push({ email, error: e.message });
      }
    }
    return results;
  }, { profileId: RP_PROFILE_ID, emails: Object.keys(emailToDeal) });

  rpDealsSearch.forEach(r => {
    console.log('  ' + r.email + ': ' + (r.status || 'ERR'));
    console.log('    ' + (r.data || r.error || '').substring(0, 200));
  });

  await browser.close();
  console.log('\nDone');
}

main().catch(console.error);
