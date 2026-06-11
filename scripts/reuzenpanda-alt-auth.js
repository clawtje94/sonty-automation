const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login with Joey
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'Joey@sonty.nl');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'Shja..59');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  await page.click('text=Sonty B.V.');
  await page.waitForTimeout(5000);

  // Get auth token
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'Authorization');
  const token = authCookie ? authCookie.value.replace('Bearer_', '') : '';
  console.log('Token:', token.substring(0, 60) + '...');

  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
  const DOC_ID = '23c8c5ed-f25c-45bd-bd6c-1f0b52437064';

  // Try with X-AUTHORIZATION header
  console.log('\n=== With X-AUTHORIZATION header ===');
  const results = await page.evaluate(async ({ profileId, docId, authToken }) => {
    const endpoints = [
      { path: `/api/v1/quotations/pdf?id=${docId}&company_profile_id=${profileId}`, base: 'https://hub.reuzenpanda.nl' },
      { path: `/api/v1/quotations/info?id=${docId}&company_profile_id=${profileId}`, base: 'https://hub.reuzenpanda.nl' },
      { path: `/document-service/v1/${profileId}/documents/${docId}/pdf`, base: 'https://backend.reuzenpanda.nl' },
    ];

    const results = [];
    for (const { path, base } of endpoints) {
      // Try with X-AUTHORIZATION
      try {
        const res = await fetch(base + path, {
          headers: { 'X-AUTHORIZATION': authToken },
          credentials: 'include',
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('pdf')) {
          results.push({ path, status: res.status, isPdf: true });
        } else {
          const text = await res.text();
          results.push({ path, status: res.status, body: text.substring(0, 200) });
        }
      } catch(e) {
        results.push({ path, error: e.message });
      }

      // Also try with Authorization: Bearer
      try {
        const res = await fetch(base + path, {
          headers: { 'Authorization': 'Bearer ' + authToken },
          credentials: 'include',
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('pdf')) {
          results.push({ path: path + ' (Bearer)', status: res.status, isPdf: true });
        } else {
          const text = await res.text();
          results.push({ path: path + ' (Bearer)', status: res.status, body: text.substring(0, 200) });
        }
      } catch(e) {}
    }
    return results;
  }, { profileId: PROFILE_ID, docId: DOC_ID, authToken: token });

  results.forEach(r => {
    if (r.isPdf) {
      console.log(r.path + ': ✅ PDF!');
    } else {
      console.log(r.path + ': ' + (r.status || 'ERR'));
      if (r.body) console.log('  ' + r.body.substring(0, 150));
    }
  });

  // Try getting the document via composer endpoint (which renders the HTML)
  console.log('\n=== Composer/render ===');
  const composerResult = await page.evaluate(async ({ profileId, docId }) => {
    // Try getting the rendered HTML of the offerte
    const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/composer/${docId}/render`, {
      credentials: 'include',
    });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    return { status: res.status, type: ct, body: text.substring(0, 300) };
  }, { profileId: PROFILE_ID, docId: DOC_ID });
  console.log('Composer render:', composerResult.status, composerResult.type);
  console.log(composerResult.body.substring(0, 200));

  // Last attempt: check if there's a version-specific PDF endpoint
  console.log('\n=== Version-specific endpoints ===');
  // Get document versions
  const versionsResult = await page.evaluate(async ({ profileId, docId }) => {
    const endpoints = [
      `/document-service/v1/${profileId}/documents/${docId}/versions`,
      `/document-service/v1/${profileId}/documents/${docId}/history`,
      `/document-service/v1/${profileId}/quotations/${docId}`,
    ];
    const results = [];
    for (const ep of endpoints) {
      try {
        const res = await fetch(`https://backend.reuzenpanda.nl${ep}`, { credentials: 'include' });
        const text = await res.text();
        results.push({ ep: ep.split(docId)[1] || ep.split(profileId)[1], status: res.status, body: text.substring(0, 300) });
      } catch(e) {
        results.push({ ep, error: e.message });
      }
    }
    return results;
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  versionsResult.forEach(r => {
    console.log((r.ep || '') + ': ' + (r.status || 'ERR'));
    if (r.body) console.log('  ' + r.body.substring(0, 200));
  });

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
