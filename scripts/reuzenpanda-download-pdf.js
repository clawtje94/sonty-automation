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
  const DOC_ID = '23c8c5ed-f25c-45bd-bd6c-1f0b52437064'; // Offerte #20262777

  // Try various PDF endpoints
  console.log('=== Testing PDF download endpoints ===');
  const pdfEndpoints = [
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/pdf`,
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/download`,
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}/export`,
    `/document-service/v1/${PROFILE_ID}/quotations/${DOC_ID}/pdf`,
    `/document-service/v1/${PROFILE_ID}/pdf/${DOC_ID}`,
    `/document-service/v1/${PROFILE_ID}/documents/${DOC_ID}`,
  ];

  for (const ep of pdfEndpoints) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(`https://backend.reuzenpanda.nl${url}`, { credentials: 'include' });
        const contentType = res.headers.get('content-type') || '';
        const contentDisposition = res.headers.get('content-disposition') || '';
        if (contentType.includes('pdf')) {
          return { status: res.status, type: contentType, disposition: contentDisposition, isPdf: true };
        }
        const text = await res.text();
        return { status: res.status, type: contentType, body: text.substring(0, 200), isPdf: false };
      } catch(e) {
        return { error: e.message };
      }
    }, ep);

    const status = result.isPdf ? '✅ PDF!' : result.status;
    console.log(ep.split(PROFILE_ID)[1] + ': ' + status);
    if (result.isPdf) {
      console.log('  Content-Type:', result.type);
      console.log('  Content-Disposition:', result.disposition);
    } else if (result.body) {
      console.log('  ' + result.body.substring(0, 150));
    }
  }

  // Also try the document detail to find PDF URL in the response
  console.log('\n=== Document detail ===');
  const docDetail = await page.evaluate(async ({ profileId, docId }) => {
    const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}`, { credentials: 'include' });
    return await res.text();
  }, { profileId: PROFILE_ID, docId: DOC_ID });
  console.log(docDetail.substring(0, 1000));

  // Check for preview/share URLs in the document data
  if (docDetail.includes('url') || docDetail.includes('pdf') || docDetail.includes('link')) {
    try {
      const parsed = JSON.parse(docDetail);
      console.log('\nPDF-related fields:');
      const findPdf = (obj, prefix = '') => {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string' && (k.toLowerCase().includes('url') || k.toLowerCase().includes('pdf') || k.toLowerCase().includes('link') || k.toLowerCase().includes('file') || v.includes('pdf') || v.includes('http'))) {
            console.log('  ' + prefix + k + ': ' + v.substring(0, 150));
          } else if (typeof v === 'object' && v !== null) {
            findPdf(v, prefix + k + '.');
          }
        }
      };
      findPdf(parsed);
    } catch(e) {}
  }

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
