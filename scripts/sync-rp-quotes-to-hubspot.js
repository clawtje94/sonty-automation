const { chromium } = require('playwright');

const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const HS_BASE = 'https://api.hubapi.com';
const RP_PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

async function loginReuzenpanda(page) {
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);

  // Use daimyboot@gmail.com (has password login)
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);

  // Check for password field
  const pwField = await page.$('input[type="password"]');
  if (pwField) {
    await pwField.fill('TQGb@eD%5nGRSN9@4Gss');
    await page.click('button:has-text("Inloggen")');
    await page.waitForTimeout(5000);
  }

  // Select Sonty B.V.
  try {
    await page.click('text=Sonty B.V.', { timeout: 5000 });
    await page.waitForTimeout(5000);
  } catch(e) {}

  return !page.url().includes('login');
}

function formatQuoteForHubSpot(quotData, versionData) {
  const lines = [];
  const q = quotData.quotationData || quotData;

  lines.push('📄 ' + (q.documentTitle || q.title || 'Offerte'));
  lines.push('Status: ' + (q.quotationStatus || q.documentStatus || '-'));
  lines.push('Nummer: ' + (q.quotationNumber || q.documentNumber || '-'));
  lines.push('');

  const version = versionData?.versions?.[0];
  if (version?.data?.segments) {
    const priceGroup = version.data.segments.find(s => s.type === 'priceLineGroup');
    if (priceGroup?.data?.lines) {
      lines.push('─── Producten ───');
      let totalExcl = 0;
      for (const line of priceGroup.data.lines) {
        const descLines = line.description.split('\n');
        const productName = descLines[0];
        const specs = descLines.slice(1).filter(l => l.trim()).slice(0, 5);
        const lineTotal = line.units * line.pricePerUnit;
        totalExcl += lineTotal;

        lines.push('');
        lines.push(line.units + 'x ' + productName);
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

  const loggedIn = await loginReuzenpanda(page);
  if (!loggedIn) { console.log('RP login failed'); await browser.close(); return; }
  console.log('Logged in to Reuzenpanda');

  // Get recent RP documents
  const rpDocs = await page.evaluate(async (profileId) => {
    const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + profileId + '/documents/overview', { credentials: 'include' });
    const data = await res.json();
    return (data.documentDatas || []).filter(d => d.document_status === 'SENT').slice(0, 5);
  }, RP_PROFILE_ID);

  console.log('Recent SENT documents:', rpDocs.length);

  // Get first document's full data as proof of concept
  if (rpDocs.length > 0) {
    const doc = rpDocs[0];
    console.log('\nProcessing: ' + doc.document_title);

    const [quotData, versionData] = await Promise.all([
      page.evaluate(async ({ pid, did }) => {
        const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/quotations/' + did, { credentials: 'include' });
        return await r.json();
      }, { pid: RP_PROFILE_ID, did: doc.id }),
      page.evaluate(async ({ pid, did }) => {
        const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/' + did + '/versions', { credentials: 'include' });
        return await r.json();
      }, { pid: RP_PROFILE_ID, did: doc.id }),
    ]);

    const formatted = formatQuoteForHubSpot(quotData, versionData);
    console.log('\n' + formatted);

    // Find a HubSpot deal to update (use first deal without description)
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
        limit: 1,
      }),
    });
    const hsData = await hsRes.json();

    if (hsData.results?.length > 0) {
      const deal = hsData.results[0];
      console.log('\nUpdating HubSpot deal: ' + deal.properties.dealname + ' (ID: ' + deal.id + ')');

      const updateRes = await fetch(HS_BASE + '/crm/v3/objects/deals/' + deal.id, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: {
            sonty_reuzenpanda_description: formatted,
            sonty_reuzenpanda_link: 'https://hub.reuzenpanda.nl/app/deals/pipeline',
          }
        }),
      });
      console.log('Update:', updateRes.status === 200 ? '✅ Done!' : '❌ Failed');
    }
  }

  await browser.close();
  console.log('\nDone');
}

main().catch(console.error);
