const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Login Planado...');
    await page.goto('https://sonty.planadoapp.com/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
    await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
    await page.locator('button:has-text("Inloggen")').click();
    await page.waitForTimeout(5000);
    console.log('   Logged in');

    console.log('\n2. Adding Yudi den Heijer...');
    await page.goto('https://sonty.planadoapp.com/admin/users/new?role=field');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const textInputs = await page.$$('input[type="text"]');
    const visibleInputs = [];
    for (const inp of textInputs) {
      if (await inp.isVisible()) visibleInputs.push(inp);
    }
    if (visibleInputs.length >= 2) {
      await visibleInputs[0].fill('Yudi');
      await visibleInputs[1].fill('den Heijer');
      console.log('   Filled name');
    }

    await page.locator('text=Via e-mail').click();
    await page.waitForTimeout(500);

    const updatedInputs = await page.$$('input[type="text"]');
    const visibleAfter = [];
    for (const inp of updatedInputs) {
      if (await inp.isVisible()) visibleAfter.push(inp);
    }
    if (visibleAfter.length >= 3) {
      await visibleAfter[2].fill('yudi@sonty.nl');
      console.log('   Filled email: yudi@sonty.nl');
    }

    await page.locator('button.btn.btn-primary').click();
    await page.waitForTimeout(3000);

    if (!page.url().includes('/new')) {
      console.log('   ✅ Yudi den Heijer toegevoegd!');
    } else {
      console.log('   ❌ Failed');
      const errors = await page.$$eval('.error, .alert, [class*="error"]', els =>
        els.map(e => e.textContent.trim()).filter(t => t.length > 0)
      );
      if (errors.length) console.log('   Errors:', errors);
    }

    await page.screenshot({ path: '/tmp/planado-yudi-result.png' });
  } catch (err) {
    console.error('Error:', err.message);
  }
  await browser.close();
})();
