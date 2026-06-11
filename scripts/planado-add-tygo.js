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

    console.log('\n2. Adding Tygo Krikke...');
    await page.goto('https://sonty.planadoapp.com/admin/users/new?role=field');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Fill first name and last name
    const textInputs = await page.$$('input[type="text"]');
    const visibleInputs = [];
    for (const inp of textInputs) {
      if (await inp.isVisible()) visibleInputs.push(inp);
    }

    if (visibleInputs.length >= 2) {
      await visibleInputs[0].fill('Tygo');
      await visibleInputs[1].fill('Krikke');
      console.log('   Filled name: Tygo Krikke');
    }

    // Click "Via e-mail" radio
    await page.locator('text=Via e-mail').click();
    await page.waitForTimeout(500);

    // Fill email field
    const updatedInputs = await page.$$('input[type="text"]');
    const visibleAfter = [];
    for (const inp of updatedInputs) {
      if (await inp.isVisible()) visibleAfter.push(inp);
    }
    if (visibleAfter.length >= 3) {
      await visibleAfter[2].fill('tygokrikke@hotmail.com');
      console.log('   Filled email: tygokrikke@hotmail.com');
    } else {
      // Try email input type
      const emailInput = await page.$('input[type="email"]:visible');
      if (emailInput) {
        await emailInput.fill('tygokrikke@hotmail.com');
        console.log('   Filled email via email input: tygokrikke@hotmail.com');
      } else {
        console.log('   Could not find email field');
      }
    }

    await page.screenshot({ path: '/tmp/planado-tygo-before-submit.png' });

    // Submit
    await page.locator('button.btn.btn-primary').click();
    await page.waitForTimeout(3000);

    const url = page.url();
    if (!url.includes('/new')) {
      console.log('   ✅ Tygo Krikke toegevoegd!');
    } else {
      console.log('   ❌ Still on form page');
      const errors = await page.$$eval('.error, .alert, [class*="error"], [class*="Error"]', els =>
        els.map(e => e.textContent.trim()).filter(t => t.length > 0)
      );
      if (errors.length) console.log('   Errors:', errors);
    }

    await page.screenshot({ path: '/tmp/planado-tygo-result.png' });

    // Verify in users list
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-tygo-userlist.png' });
    console.log('\n3. Screenshot saved to /tmp/planado-tygo-userlist.png');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-tygo-error.png' });
  }

  await browser.close();
})();
