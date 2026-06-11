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

  console.log('URL:', page.url());
  if (page.url().includes('login')) {
    console.log('Login failed');
    await page.screenshot({ path: '/tmp/rp-joey-fail.png' });
    await browser.close();
    return;
  }

  // Select Sonty B.V.
  try {
    await page.click('text=Sonty B.V.');
    await page.waitForTimeout(5000);
  } catch(e) {}

  console.log('Logged in as Joey!');
  await page.screenshot({ path: '/tmp/rp-joey-home.png' });

  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
  const DOC_ID = '23c8c5ed-f25c-45bd-bd6c-1f0b52437064'; // Offerte #20262777

  // Try PDF endpoints with Joey's session
  console.log('\n=== Testing PDF endpoints ===');
  const endpoints = [
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/pdf`,
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/download`,
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/preview`,
    `/document-service/v1/${PROFILE_ID}/composer/${DOC_ID}`,
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/share`,
  ];

  for (const ep of endpoints) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(`https://backend.reuzenpanda.nl${url}`, { credentials: 'include' });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('pdf')) {
          return { status: res.status, type: ct, isPdf: true, size: parseInt(res.headers.get('content-length') || '0') };
        }
        const text = await res.text();
        return { status: res.status, type: ct, body: text.substring(0, 300), isPdf: false };
      } catch(e) {
        return { error: e.message };
      }
    }, ep);

    const label = ep.split(DOC_ID)[1] || ep.split(PROFILE_ID)[1];
    if (result.isPdf) {
      console.log(label + ': ✅ PDF! Size:', result.size, 'bytes');
    } else {
      console.log(label + ': ' + (result.status || 'ERR') + ' ' + (result.body?.substring(0, 100) || result.error || ''));
    }
  }

  // If PDF works, download it and save
  console.log('\n=== Downloading PDF ===');
  const pdfData = await page.evaluate(async ({ profileId, docId }) => {
    try {
      const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/pdf`, { credentials: 'include' });
      if (res.headers.get('content-type')?.includes('pdf')) {
        const buf = await res.arrayBuffer();
        return { success: true, size: buf.byteLength, base64: btoa(String.fromCharCode(...new Uint8Array(buf.slice(0, 100)))) };
      }
      const text = await res.text();
      return { success: false, status: res.status, body: text.substring(0, 200) };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  if (pdfData.success) {
    console.log('PDF downloaded! Size:', pdfData.size, 'bytes');
    console.log('First bytes (base64):', pdfData.base64?.substring(0, 50));
  } else {
    console.log('PDF download failed:', pdfData.status || pdfData.error);
    console.log(pdfData.body || '');
  }

  // Also list all quotations to see what's available
  console.log('\n=== All quotations ===');
  const quots = await page.evaluate(async (profileId) => {
    const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/overview`, { credentials: 'include' });
    return await res.text();
  }, PROFILE_ID);

  try {
    const parsed = JSON.parse(quots);
    const docs = parsed.documentDatas || [];
    console.log('Total documents:', docs.length);
    docs.slice(0, 5).forEach(d => {
      console.log('  ' + d.document_title + ' | ' + d.document_status + ' | ID: ' + d.id);
    });
  } catch(e) {
    console.log(quots.substring(0, 300));
  }

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
