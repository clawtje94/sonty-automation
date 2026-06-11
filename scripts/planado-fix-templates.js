const { chromium } = require('playwright');

const TEMPLATE_TYPE_MAP = {
  'Inmeet afspraak': 'Inmeet afspraak',
  'Montage afspraak particulier': 'Montage afspraak',
  'Montage afspraak zakelijk': 'Montage afspraak',
  'Reparatie afspraak': 'Reparatie afspraak',
  'Service afspraak': 'Service afspraak',
  'Winkel afspraak': 'Winkel afspraak',
  'Onderhouds afspraak': 'Onderhouds afspraak',
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);

  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const templateLinks = await page.$$eval('a', els =>
    els.map(e => ({ text: e.textContent.trim(), href: e.href }))
      .filter(e => e.href.includes('/admin/templates/') && e.text.length > 3)
  );

  for (const tmpl of templateLinks) {
    const targetType = TEMPLATE_TYPE_MAP[tmpl.text];
    if (!targetType) { continue; }

    await page.goto(tmpl.href);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click "Geen type" dropdown to open it
    try {
      await page.locator('text=Geen type').click();
      await page.waitForTimeout(500);
      // Click the target option in the dropdown
      await page.locator('text=' + targetType).first().click();
      await page.waitForTimeout(500);

      // Scroll down and click Opslaan
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Opslaan")').first().click();
      await page.waitForTimeout(2000);
      console.log('OK: ' + tmpl.text + ' -> ' + targetType);
    } catch (e) {
      console.log('FAIL: ' + tmpl.text + ' - ' + e.message.substring(0, 60));
    }
  }
  console.log('Done');
  await browser.close();
})();
