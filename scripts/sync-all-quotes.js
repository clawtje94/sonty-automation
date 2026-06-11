/**
 * Sync ALL Reuzenpanda quotes to HubSpot deals
 * Matches on contact email address
 */
const { chromium } = require('playwright');

const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const HS_BASE = 'https://api.hubapi.com';
const RP_PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

function formatQuote(quotData, versionData) {
  const lines = [];
  const q = quotData.quotationData || quotData;
  lines.push('📄 ' + (q.documentTitle || 'Offerte'));
  lines.push('Status: ' + (q.quotationStatus || q.documentStatus || '-'));
  lines.push('Nummer: ' + (q.quotationNumber || '-'));
  lines.push('');

  const version = versionData?.versions?.[0];
  if (version?.data?.segments) {
    const priceGroup = version.data.segments.find(s => s.type === 'priceLineGroup');
    if (priceGroup?.data?.lines) {
      lines.push('─── Producten ───');
      let totalExcl = 0;
      for (const line of priceGroup.data.lines) {
        const descLines = line.description.split('\n');
        const name = descLines[0];
        const specs = descLines.slice(1).filter(l => l.trim()).slice(0, 5);
        const lineTotal = line.units * line.pricePerUnit;
        totalExcl += lineTotal;
        lines.push('');
        lines.push(line.units + 'x ' + name);
        lines.push('   €' + line.pricePerUnit.toFixed(2) + ' p/st → €' + lineTotal.toFixed(2));
        specs.forEach(s => lines.push('  ' + s.trim()));
      }
      lines.push('');
      lines.push('─── Totaal ───');
      lines.push('Subtotaal excl BTW: €' + totalExcl.toFixed(2));
      lines.push('BTW (21%): €' + (totalExcl * 0.21).toFixed(2));
      lines.push('Totaal incl BTW: €' + (totalExcl * 1.21).toFixed(2));
    }
  }
  return lines.join('\n');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login to Reuzenpanda
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
  console.log('RP login OK');

  // Step 1: Get all HubSpot deals without RP description
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
  console.log('HubSpot deals to sync:', hsDeals.length);

  // Step 2: For each deal, get the associated contact email
  const dealEmails = [];
  for (const deal of hsDeals) {
    const aRes = await fetch(HS_BASE + '/crm/v4/objects/deals/' + deal.id + '/associations/contacts', {
      headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
    });
    const aData = await aRes.json();
    const contactId = aData.results?.[0]?.toObjectId;
    if (contactId) {
      const cRes = await fetch(HS_BASE + '/crm/v3/objects/contacts/' + contactId + '?properties=email', {
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
      });
      const cData = await cRes.json();
      dealEmails.push({ dealId: deal.id, dealName: deal.properties.dealname, email: cData.properties?.email });
    } else {
      dealEmails.push({ dealId: deal.id, dealName: deal.properties.dealname, email: null });
    }
  }
  console.log('Deals with email:', dealEmails.filter(d => d.email).length);

  // Step 3: Get RP contact persons to build email → contact mapping
  const rpContacts = await page.evaluate(async (profileId) => {
    const res = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/lead-configuration/locked?profile_id=' + profileId, { credentials: 'include' });
    const data = await res.json();
    return data;
  }, RP_PROFILE_ID);

  // Step 4: Get all RP documents with their contact person IDs
  const rpAllDocs = await page.evaluate(async (profileId) => {
    const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + profileId + '/documents/overview', { credentials: 'include' });
    const data = await res.json();
    return (data.documentDatas || []).map(d => ({
      id: d.id, title: d.document_title, status: d.document_status, contactId: d.contact_person_id,
    }));
  }, RP_PROFILE_ID);
  console.log('RP documents:', rpAllDocs.length);

  // Step 5: For each RP document, get the contact person email
  // We'll batch this — get quotation data which includes subjects.contactPerson
  let synced = 0;
  for (const dealInfo of dealEmails) {
    if (!dealInfo.email) continue;

    // Search RP documents by querying each one's quotation data for matching contact email
    // This is expensive, so let's be smart: search RP leads by email first
    const rpLeads = await page.evaluate(async ({ profileId, email }) => {
      try {
        // Search leads by the contact email in the description
        const res = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/lead-configuration/locked?profile_id=' + profileId, { credentials: 'include' });
        const data = await res.json();
        // Filter leads that contain this email
        const matches = (data.leadConfigurations || data || []);
        return { total: Array.isArray(matches) ? matches.length : 'not array', type: typeof matches };
      } catch(e) { return { error: e.message }; }
    }, { profileId: RP_PROFILE_ID, email: dealInfo.email });

    // Alternative: search documents by contact person
    // Get the most recent document for this deal
    // Match by checking quotation data
    for (const doc of rpAllDocs.slice(0, 20)) { // Check first 20 docs
      if (doc.status !== 'SENT' && doc.status !== 'DRAFT') continue;

      const quotData = await page.evaluate(async ({ pid, did }) => {
        try {
          const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/quotations/' + did, { credentials: 'include' });
          return await r.json();
        } catch(e) { return null; }
      }, { pid: RP_PROFILE_ID, did: doc.id });

      if (!quotData?.quotationData) continue;

      // Get the contact person details
      const cpId = quotData.quotationData.subjects?.contactPerson;
      if (!cpId) continue;

      const cpData = await page.evaluate(async ({ pid, cpId }) => {
        try {
          const r = await fetch('https://backend.reuzenpanda.nl/widget-service/api/v1/contact-persons/' + cpId + '?profile_id=' + pid, { credentials: 'include' });
          return await r.json();
        } catch(e) { return null; }
      }, { pid: RP_PROFILE_ID, cpId });

      const cpEmail = cpData?.email || cpData?.contactPerson?.email || '';
      if (cpEmail.toLowerCase() === dealInfo.email.toLowerCase()) {
        console.log('\n✅ MATCH: ' + dealInfo.dealName + ' ↔ ' + doc.title + ' (email: ' + cpEmail + ')');

        // Get version data for formatting
        const versionData = await page.evaluate(async ({ pid, did }) => {
          const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/' + did + '/versions', { credentials: 'include' });
          return await r.json();
        }, { pid: RP_PROFILE_ID, did: doc.id });

        const formatted = formatQuote(quotData, versionData);

        // Get the RP deal ID for the link
        const rpDealId = quotData.quotationData.subjects?.leadConfiguration || doc.id;
        const rpLink = 'https://hub.reuzenpanda.nl/app/deals/pipeline?item=' + rpDealId;

        // Update HubSpot deal
        const updateRes = await fetch(HS_BASE + '/crm/v3/objects/deals/' + dealInfo.dealId, {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            properties: {
              sonty_reuzenpanda_description: formatted,
              sonty_reuzenpanda_link: rpLink,
              sonty_reuzenpanda_id: rpDealId,
            }
          }),
        });
        console.log('  HubSpot update: ' + (updateRes.status === 200 ? '✅' : '❌'));
        synced++;
        break; // Found match, move to next deal
      }
    }
  }

  console.log('\n\nSynced:', synced, 'deals');
  await browser.close();
  console.log('Done');
}

main().catch(console.error);
