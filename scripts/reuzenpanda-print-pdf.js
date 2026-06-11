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

  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
  const DOC_ID = '23c8c5ed-f25c-45bd-bd6c-1f0b52437064';

  // Try opening the offerte in a viewer
  console.log('=== Trying viewer URLs ===');
  const viewerUrls = [
    `https://hub.reuzenpanda.nl/app/deals/documents/${DOC_ID}`,
    `https://hub.reuzenpanda.nl/app/documents/${DOC_ID}`,
    `https://hub.reuzenpanda.nl/app/quotations/${DOC_ID}`,
    `https://hub.reuzenpanda.nl/app/composer/${DOC_ID}`,
    `https://hub.reuzenpanda.nl/app/deals/quotation/${DOC_ID}`,
  ];

  for (const url of viewerUrls) {
    await page.goto(url);
    await page.waitForTimeout(3000);
    const curUrl = page.url();
    const hasContent = !(await page.evaluate(() => document.body.innerText)).includes('404');
    console.log(url.split('/app/')[1] + ': ' + (hasContent ? '✅ content' : '❌ 404') + ' → ' + curUrl.split('/app/')[1]);
    if (hasContent && !curUrl.includes('404')) {
      await page.screenshot({ path: '/tmp/rp-viewer-' + url.split('/').pop() + '.png' });
    }
  }

  // Try the composer/editor for the document
  console.log('\n=== Trying composer ===');
  const composerResult = await page.evaluate(async ({ profileId, docId }) => {
    const endpoints = [
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/composer/${docId}`,
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/preview`,
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/html`,
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/render`,
      `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/share/${docId}`,
    ];

    const results = [];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        const ct = res.headers.get('content-type') || '';
        const text = await res.text();
        results.push({
          ep: url.split(profileId)[1],
          status: res.status,
          type: ct,
          body: text.substring(0, 200),
          isPdf: ct.includes('pdf'),
          isHtml: ct.includes('html'),
        });
      } catch(e) {
        results.push({ ep: url.split(profileId)[1], error: e.message });
      }
    }
    return results;
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  composerResult.forEach(r => {
    console.log((r.ep || '') + ': ' + (r.status || 'ERR') + ' (' + (r.type || '') + ')');
    if (r.isPdf) console.log('  PDF FOUND!');
    if (r.body) console.log('  ' + r.body.substring(0, 150));
  });

  // Try getting a public share link
  console.log('\n=== Checking for share/public links ===');
  const shareResult = await page.evaluate(async ({ profileId, docId }) => {
    // Try creating a share link
    const endpoints = [
      { url: `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/share`, method: 'POST' },
      { url: `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/public-link`, method: 'GET' },
      { url: `https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/signing-link`, method: 'GET' },
    ];

    const results = [];
    for (const { url, method } of endpoints) {
      try {
        const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        const text = await res.text();
        results.push({ ep: url.split(profileId)[1], status: res.status, body: text.substring(0, 300) });
      } catch(e) {
        results.push({ ep: url.split(profileId)[1], error: e.message });
      }
    }
    return results;
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  shareResult.forEach(r => {
    console.log((r.ep || '') + ': ' + (r.status || 'ERR'));
    if (r.body) console.log('  ' + r.body.substring(0, 200));
  });

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
