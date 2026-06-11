const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Intercept ALL requests to find PDF/document URLs
  const allRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('google') && !url.includes('harness') && !url.includes('analytics')) {
      allRequests.push({ method: req.method(), url });
    }
  });

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
  allRequests.length = 0;

  // Go to deals pipeline
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(5000);

  // Open Chantal's deal
  await page.click('text=Chantal Van Driel');
  await page.waitForTimeout(3000);

  // Now click on the Offerte card text
  // The offerte is in the "Documenten" section
  // Try clicking "Concept" or the offerte number
  const offerteEl = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent.includes('20262305') && el.children.length < 3) {
        const r = el.getBoundingClientRect();
        if (r.height > 10 && r.height < 100) {
          return { x: r.x + r.width/2, y: r.y + r.height/2, text: el.textContent.trim().substring(0, 60) };
        }
      }
    }
    return null;
  });

  if (offerteEl) {
    console.log('Found offerte element:', offerteEl.text, 'at', offerteEl.x, offerteEl.y);
    allRequests.length = 0;

    // Double-click to open
    await page.mouse.dblclick(offerteEl.x, offerteEl.y);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/rp-offerte-dblclick.png' });
    console.log('After dblclick URL:', page.url());

    // Check what requests were made
    console.log('\nRequests after dblclick:');
    allRequests.filter(r => r.url.includes('reuzenpanda')).forEach(r =>
      console.log('  ' + r.method + ' ' + r.url.substring(0, 120))
    );
  }

  // Try another approach: look for a "Bekijken" (view) or "Bewerken" (edit) button
  // after clicking the offerte
  allRequests.length = 0;

  // Single click on offerte card
  if (offerteEl) {
    await page.mouse.click(offerteEl.x, offerteEl.y);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-offerte-singleclick.png' });

    // Check for any new UI elements (popover, modal, sidebar)
    const newElements = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText.split('\n').filter(l => {
        const t = l.trim().toLowerCase();
        return t.includes('bekijk') || t.includes('bewerk') || t.includes('download') ||
               t.includes('pdf') || t.includes('verwijder') || t.includes('kopieer') ||
               t.includes('verstuur') || t.includes('open') || t.includes('preview');
      });
      return lines;
    });
    console.log('\nAction-related text:', newElements.join(' | '));

    console.log('\nRequests after single click:');
    allRequests.filter(r => r.url.includes('reuzenpanda')).forEach(r =>
      console.log('  ' + r.method + ' ' + r.url.substring(0, 120))
    );
  }

  // Try navigating to composer/editor directly with the item_subject ID
  console.log('\n=== Trying composer with lead config ID ===');
  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
  const LEAD_CONFIG_ID = '335c7074-9249-4489-8e29-ff036ed8d427';

  allRequests.length = 0;
  await page.goto(`https://hub.reuzenpanda.nl/app/deals/pipeline?item=86770545-22e7-4108-9507-b6cb7789b2e5&document=23c8c5ed-f25c-45bd-bd6c-1f0b52437064`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/rp-deal-with-doc.png' });

  console.log('Requests:');
  allRequests.filter(r => r.url.includes('document')).forEach(r =>
    console.log('  ' + r.method + ' ' + r.url.substring(0, 120))
  );

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
