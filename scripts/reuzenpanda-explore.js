const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  // Select Sonty B.V.
  try {
    await page.click('text=Sonty B.V.');
    await page.waitForTimeout(5000);
    console.log('Selected Sonty B.V.');
    console.log('URL:', page.url());
  } catch(e) {
    console.log('Could not select Sonty');
  }

  await page.screenshot({ path: '/tmp/rp-sonty-home.png' });

  // Explore the main nav
  const navItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, [role="menuitem"], nav a'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 50), href: el.href || '' }))
      .filter(l => l.text.length > 0 && l.text.length < 50);
  });
  console.log('\nNavigation:');
  navItems.forEach(n => console.log('  ' + n.text + (n.href ? ' → ' + n.href : '')));

  // Go to settings
  await page.goto('https://hub.reuzenpanda.nl/app/settings');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-settings-2.png' });
  console.log('\nSettings URL:', page.url());

  // Get all text on settings page
  const settingsText = await page.evaluate(() => document.body.innerText);
  const settingsLines = settingsText.split('\n').filter(l => l.trim().length > 2);
  console.log('Settings page content:');
  settingsLines.slice(0, 40).forEach(l => console.log('  ' + l.trim().substring(0, 80)));

  // Look for deals/quotations to understand PDF
  await page.goto('https://hub.reuzenpanda.nl/app/deals');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-deals-2.png' });

  // Click on a deal to see if there's a PDF option
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-pipeline.png' });

  // Try clicking on a deal item
  try {
    const dealItems = await page.$$('[class*="card"], [class*="item"], [class*="deal"]');
    console.log('\nDeal items:', dealItems.length);
    if (dealItems.length > 0) {
      await dealItems[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/rp-deal-detail.png' });
      console.log('Deal detail URL:', page.url());

      // Look for PDF/download buttons
      const pdfBtns = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a, button'))
          .filter(el => el.offsetHeight > 0)
          .map(el => ({ text: el.textContent.trim(), href: el.href || '' }))
          .filter(l => l.text.toLowerCase().includes('pdf') || l.text.toLowerCase().includes('download') ||
                       l.text.toLowerCase().includes('offerte') || l.href.includes('pdf'));
      });
      console.log('PDF buttons:', pdfBtns);
    }
  } catch(e) {
    console.log('Deal click failed');
  }

  // Check sidebar icons
  const sidebarIcons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('nav a, aside a, [class*="sidebar"] a'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 30), href: el.href, title: el.title || '' }))
      .filter(l => l.href);
  });
  console.log('\nSidebar links:');
  sidebarIcons.forEach(s => console.log('  ' + s.text + ' | ' + s.title + ' → ' + s.href));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
