const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login + select Sonty
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

  // Get auth token from cookies
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'Authorization');
  const token = authCookie ? authCookie.value.replace('Bearer_', '') : '';
  console.log('Auth token:', token.substring(0, 50) + '...');

  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

  // Try listing documents
  console.log('\n=== Listing documents ===');
  const docsResult = await page.evaluate(async (profileId) => {
    try {
      const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/overview`, {
        credentials: 'include'
      });
      const text = await res.text();
      return { status: res.status, body: text.substring(0, 1000) };
    } catch(e) {
      return { error: e.message };
    }
  }, PROFILE_ID);
  console.log('Documents:', docsResult.status, docsResult.body?.substring(0, 300));

  // Try the quotation PDF API
  console.log('\n=== Trying quotation PDF API ===');
  // First get a quotation ID - from the deal we opened: Offerte #20262305
  // The deal ID was 86770545-22e7-4108-9507-b6cb7789b2e5
  const pdfResult = await page.evaluate(async (profileId) => {
    const endpoints = [
      `/document-service/v1/${profileId}/documents`,
      `/api/v1/quotations?company_profile_id=${profileId}`,
      `/api/v1/quotations/info?company_profile_id=${profileId}`,
    ];

    const results = [];
    for (const ep of endpoints) {
      try {
        const url = ep.startsWith('/api') ? `https://hub.reuzenpanda.nl${ep}` : `https://backend.reuzenpanda.nl${ep}`;
        const res = await fetch(url, { credentials: 'include' });
        const text = await res.text();
        results.push({ endpoint: ep, status: res.status, body: text.substring(0, 500) });
      } catch(e) {
        results.push({ endpoint: ep, error: e.message });
      }
    }
    return results;
  }, PROFILE_ID);

  pdfResult.forEach(r => {
    console.log('\n' + r.endpoint + ': ' + (r.status || 'ERROR'));
    console.log('  ' + (r.body || r.error || '').substring(0, 200));
  });

  // Try getting a specific document by deal ID
  console.log('\n=== Getting document for deal ===');
  const dealId = '86770545-22e7-4108-9507-b6cb7789b2e5';
  const dealDocResult = await page.evaluate(async ({ profileId, dealId }) => {
    const endpoints = [
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents?deal_id=${dealId}`,
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/deals/${dealId}/documents`,
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/quotations?deal_id=${dealId}`,
    ];

    const results = [];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        const text = await res.text();
        results.push({ url: url.split(profileId)[1], status: res.status, body: text.substring(0, 500) });
      } catch(e) {
        results.push({ url, error: e.message });
      }
    }
    return results;
  }, { profileId: PROFILE_ID, dealId });

  dealDocResult.forEach(r => {
    console.log('\n' + (r.url || '') + ': ' + (r.status || 'ERROR'));
    if (r.body) console.log('  ' + r.body.substring(0, 300));
  });

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
