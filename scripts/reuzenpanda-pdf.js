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
  console.log('Logged in as Sonty B.V.');

  // Check Documenten settings
  console.log('\n=== Documenten ===');
  await page.goto('https://hub.reuzenpanda.nl/app/settings/documents');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-documenten.png' });
  const docText = await page.evaluate(() => document.body.innerText);
  console.log(docText.substring(0, 500));

  // Go to deals pipeline and click on a specific deal
  console.log('\n=== Deals ===');
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline');
  await page.waitForTimeout(5000);

  // Click on a deal item - try the test lead URL we know
  await page.goto('https://hub.reuzenpanda.nl/app/deals/pipeline?item=677b05fe-c5d0-4fd3-abad-6de420fe90ca');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/rp-deal-open.png' });
  console.log('Deal page URL:', page.url());

  // Get all visible text
  const dealText = await page.evaluate(() => document.body.innerText);
  console.log('\nDeal page text:');
  dealText.split('\n').filter(l => l.trim().length > 2).slice(0, 40).forEach(l =>
    console.log('  ' + l.trim().substring(0, 100))
  );

  // Look for any PDF/download/share buttons or links
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({
        text: el.textContent.trim().substring(0, 40),
        href: el.href || '',
        title: el.title || '',
        ariaLabel: el.getAttribute('aria-label') || '',
      }))
      .filter(l => l.text.length > 0);
  });
  console.log('\nAll buttons/links on deal page:');
  allLinks.forEach(l => console.log('  ' + l.text + (l.href ? ' → ' + l.href : '') + (l.title ? ' [' + l.title + ']' : '')));

  // Check the automation page for API/webhook settings
  console.log('\n=== Automation ===');
  await page.goto('https://hub.reuzenpanda.nl/app/automation');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-automation.png' });
  const autoText = await page.evaluate(() => document.body.innerText);
  console.log(autoText.substring(0, 500));

  // Check Abonnement page for API access
  console.log('\n=== Abonnement ===');
  await page.goto('https://hub.reuzenpanda.nl/app/settings/billing');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-billing.png' });
  const billText = await page.evaluate(() => document.body.innerText);
  console.log(billText.substring(0, 500));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
