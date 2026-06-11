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

  // Go to deals and click on Chantal's deal
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(5000);
  await page.click('text=Chantal Van Driel');
  await page.waitForTimeout(3000);

  // Click on "Offerte #20262305" text to open it
  console.log('=== Clicking on Offerte ===');
  try {
    await page.click('text=Offerte #20262305', { timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-offerte-opened.png' });
    console.log('Offerte clicked, URL:', page.url());

    // Get all text to see what opened
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 500));
  } catch(e) {
    console.log('Offerte click failed');
  }

  // Also try the ⋮ menu next to the offerte
  console.log('\n=== Clicking ⋮ menu ===');
  // Go back to deal view
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(3000);
  await page.click('text=Chantal Van Driel');
  await page.waitForTimeout(3000);

  // Find the ⋮ button near "Documenten"
  const menuBtns = await page.$$('button');
  for (const btn of menuBtns) {
    const text = await btn.textContent();
    const rect = await btn.boundingBox();
    if (rect && rect.x > 600 && rect.y > 150 && rect.y < 250) { // Near Documenten area
      console.log('Button at (' + Math.round(rect.x) + ',' + Math.round(rect.y) + '): "' + text.trim().substring(0, 20) + '"');
    }
  }

  // Click the three dots menu near the offerte - it should be around x=600, y=195 based on the screenshot
  await page.mouse.click(610, 195);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/rp-offerte-menu.png' });

  // Check if a context menu appeared
  const menuItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], [class*="menu"] li, [class*="Menu"] button, [class*="dropdown"] a, [class*="dropdown"] button'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({
        text: el.textContent.trim(),
        href: el.href || '',
      }));
  });
  console.log('\nMenu items:', menuItems.length);
  menuItems.forEach(m => console.log('  ' + m.text + (m.href ? ' → ' + m.href : '')));

  // If no menu found, try right-clicking or look for more icons
  if (menuItems.length === 0) {
    // Try all visible text to find any new elements
    const newText = await page.evaluate(() => document.body.innerText);
    const lines = newText.split('\n').filter(l => l.trim().length > 1);
    // Find lines that weren't there before (menu items)
    const pdfLines = lines.filter(l =>
      l.toLowerCase().includes('pdf') || l.toLowerCase().includes('download') ||
      l.toLowerCase().includes('bekijk') || l.toLowerCase().includes('verwijder') ||
      l.toLowerCase().includes('kopieer') || l.toLowerCase().includes('bewerk') ||
      l.toLowerCase().includes('verstuur') || l.toLowerCase().includes('delen')
    );
    console.log('PDF-related text:', pdfLines.join(' | '));
  }

  // Also try intercepting network requests when clicking the offerte
  const pdfUrls = [];
  page.on('request', req => {
    if (req.url().includes('pdf') || req.url().includes('quotation') || req.url().includes('document')) {
      pdfUrls.push(req.url());
    }
  });

  // Click on the offerte number itself
  try {
    await page.click('text=#20262305', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-offerte-nr-clicked.png' });
    console.log('\nClicked offerte number, URL:', page.url());
  } catch(e) {}

  console.log('PDF URLs intercepted:', pdfUrls);

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
