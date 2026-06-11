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

  // Get recent RP documents with their quotation data (contact name + amount)
  const rpDocs = await page.evaluate(async (profileId) => {
    const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + profileId + '/documents/overview', { credentials: 'include' });
    const data = await res.json();
    // Get most recent docs
    return (data.documentDatas || []).slice(0, 50).map(d => ({
      id: d.id, title: d.document_title, status: d.document_status,
      contactPersonId: d.contact_person_id, number: d.document_number,
    }));
  }, RP_PROFILE_ID);
  console.log('Recent RP docs:', rpDocs.length);

  // For each doc, get the quotation data to extract contact name
  const rpDocsWithNames = [];
  for (const doc of rpDocs.slice(0, 30)) {
    const qData = await page.evaluate(async ({ pid, did }) => {
      try {
        const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/quotations/' + did, { credentials: 'include' });
        const data = await r.json();
        const q = data.quotationData;
        return {
          contactPersonId: q?.subjects?.contactPerson,
          leadConfigId: q?.subjects?.leadConfiguration,
          status: q?.quotationStatus,
        };
      } catch(e) { return null; }
    }, { pid: RP_PROFILE_ID, did: doc.id });

    if (qData) {
      rpDocsWithNames.push({ ...doc, ...qData });
    }
    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }

  // Now get document details which include the contact name from the version
  for (const doc of rpDocsWithNames) {
    const vData = await page.evaluate(async ({ pid, did }) => {
      try {
        const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/' + did + '/versions', { credentials: 'include' });
        const data = await r.json();
        const v = data.versions?.[0];
        const cp = v?.data?.segments?.find(s => s.type === 'contactPerson');
        return cp?.content || null;
      } catch(e) { return null; }
    }, { pid: RP_PROFILE_ID, did: doc.id });

    // The contact template has ${contactPerson.name} etc — not actual data
    // We need actual resolved contact data

    // Try getting the document with resolved/rendered contact data
    const rendered = await page.evaluate(async ({ pid, did }) => {
      try {
        const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/' + did, { credentials: 'include' });
        const data = await r.json();
        const doc = data.document;
        // Check properties for contact info
        const contactId = doc?.properties?.CONTACT_PERSON;
        return { contactId, title: doc?.document_name };
      } catch(e) { return null; }
    }, { pid: RP_PROFILE_ID, did: doc.id });

    doc.resolvedContactId = rendered?.contactId;
    await new Promise(r => setTimeout(r, 200));
  }

  // Match RP docs to HubSpot deals by looking at deal names
  // Get all HubSpot deals
  const hsRes = await fetch(HS_BASE + '/crm/v3/objects/deals/search', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [
        { propertyName: 'pipeline', operator: 'EQ', value: '3623322812' },
        { propertyName: 'sonty_reuzenpanda_description', operator: 'NOT_HAS_PROPERTY' },
      ]}],
      properties: ['dealname', 'createdate'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 50,
    }),
  });
  const hsDeals = (await hsRes.json()).results || [];
  console.log('\nHS deals without desc:', hsDeals.length);

  // For each deal, find the RP document by searching all docs' quotation data
  // Use the deal's contact email to match against RP contact person
  let synced = 0;
  for (const deal of hsDeals.slice(0, 10)) {
    // Get deal's contact email
    const aRes = await fetch(HS_BASE + '/crm/v4/objects/deals/' + deal.id + '/associations/contacts', {
      headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
    });
    const cId = (await aRes.json()).results?.[0]?.toObjectId;
    if (!cId) continue;
    const cRes = await fetch(HS_BASE + '/crm/v3/objects/contacts/' + cId + '?properties=email', {
      headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
    });
    const email = (await cRes.json()).properties?.email;
    if (!email) continue;

    // Search RP documents by this contact's email using the documents API with filter
    const matchingDocs = await page.evaluate(async ({ profileId, email }) => {
      try {
        const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + profileId + '/documents?contact_email=' + encodeURIComponent(email), { credentials: 'include' });
        if (res.status === 200) {
          const data = await res.json();
          return { found: true, docs: (data.documents || []).map(d => ({ id: d.id, title: d.document_name || d.document_title })) };
        }
        // Try alternative
        const res2 = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + profileId + '/documents/search?query=' + encodeURIComponent(email), { credentials: 'include' });
        if (res2.status === 200) return { found: true, data: (await res2.json()) };
        return { found: false, status: res.status };
      } catch(e) { return { error: e.message }; }
    }, { profileId: RP_PROFILE_ID, email });

    if (matchingDocs?.found && matchingDocs.docs?.length > 0) {
      console.log('✅ ' + deal.properties.dealname + ' → ' + matchingDocs.docs[0].title);

      const doc = matchingDocs.docs[0];
      const [qd, vd] = await Promise.all([
        page.evaluate(async ({ p, d }) => { const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + p + '/quotations/' + d, { credentials: 'include' }); return await r.json(); }, { p: RP_PROFILE_ID, d: doc.id }),
        page.evaluate(async ({ p, d }) => { const r = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + p + '/documents/' + d + '/versions', { credentials: 'include' }); return await r.json(); }, { p: RP_PROFILE_ID, d: doc.id }),
      ]);

      const formatted = formatQuote(qd, vd);
      await fetch(HS_BASE + '/crm/v3/objects/deals/' + deal.id, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { sonty_reuzenpanda_description: formatted, sonty_reuzenpanda_link: 'https://hub.reuzenpanda.nl/app/deals/pipeline?item=' + doc.id } }),
      });
      synced++;
    } else {
      console.log('❌ ' + deal.properties.dealname + ' (' + email + ') — no RP match');
    }
  }

  console.log('\nSynced:', synced);
  await browser.close();
}

main().catch(console.error);
