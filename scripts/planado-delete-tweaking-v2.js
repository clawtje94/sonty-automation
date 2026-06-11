const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Auto-accept browser dialogs (confirm/alert)
  page.on('dialog', async dialog => {
    console.log(`  Dialog: "${dialog.message()}" -> accepting`);
    await dialog.accept();
  });

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  // Open Tweaking template
  await page.goto('https://sonty.planadoapp.com/admin/templates/1f11c802-652e-69e0-9d06-7e73cee772e4', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Scroll to bottom where Verwijderen button is
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Click Verwijderen button
  await page.locator('button:has-text("Verwijderen")').click();
  console.log('Clicked Verwijderen');
  await page.waitForTimeout(5000);

  // Check result
  await page.goto('https://sonty.planadoapp.com/admin/templates', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const templates = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tr td:first-child a').forEach(a => {
      if (a.href?.includes('/admin/templates/')) rows.push(a.textContent?.trim());
    });
    return rows;
  });
  console.log('Templates:', templates);

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
