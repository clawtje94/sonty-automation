const { chromium } = require('playwright');

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
  console.log('Logged in');

  // Go to deals pipeline
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(5000);

  // Click on the first deal card
  const cards = await page.$$('[class*="card"], [class*="Card"]');
  console.log('Cards:', cards.length);

  // Try clicking on "Chantal Van Driel" or any visible deal
  try {
    await page.click('text=Chantal Van Driel', { timeout: 5000 });
    await page.waitForTimeout(3000);
    console.log('Clicked deal');
  } catch(e) {
    // Click first visible card
    if (cards.length > 0) {
      await cards[0].click();
      await page.waitForTimeout(3000);
    }
  }

  await page.screenshot({ path: '/tmp/rp-deal-clicked.png' });

  // Look for all buttons/links on the page now
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="button"]'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({
        text: el.textContent.trim().substring(0, 50),
        href: el.href || '',
        tag: el.tagName,
      }))
      .filter(l => l.text.length > 0);
  });
  console.log('\nAll interactive elements:');
  elements.forEach(e => console.log('  [' + e.tag + '] ' + e.text + (e.href ? ' → ' + e.href : '')));

  // Look for PDF, download, preview, offerte related elements
  const pdfRelated = elements.filter(e =>
    e.text.toLowerCase().includes('pdf') || e.text.toLowerCase().includes('download') ||
    e.text.toLowerCase().includes('preview') || e.text.toLowerCase().includes('bekijk') ||
    e.text.toLowerCase().includes('offerte') || e.text.toLowerCase().includes('document') ||
    e.href.includes('pdf') || e.href.includes('download') || e.href.includes('quotation')
  );
  console.log('\nPDF-related:', pdfRelated.length);
  pdfRelated.forEach(p => console.log('  ' + p.text + ' → ' + p.href));

  // Try navigating to a quotation directly
  // The deal shows "Offerte #20262305" — try accessing it
  await page.goto('https://hub.reuzenpanda.nl/app/deals/quotations');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-quotations.png' });

  // Check the deal detail panel more carefully
  // Maybe we need to scroll or click tabs
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(3000);

  // Try clicking on "Offerte #20262305" text directly
  try {
    await page.click('text=Offerte #', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-offerte-click.png' });
    console.log('\nClicked on Offerte #, URL:', page.url());
  } catch(e) {}

  // Also check network requests for PDF URLs
  // Listen for any PDF downloads
  page.on('response', response => {
    if (response.url().includes('pdf') || response.headers()['content-type']?.includes('pdf')) {
      console.log('PDF URL found:', response.url());
    }
  });

  // Try the quotation list view
  await page.goto('https://hub.reuzenpanda.nl/app/deals/table');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-deals-table.png' });

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
