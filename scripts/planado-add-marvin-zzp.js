const { chromium } = require('playwright');

const USERS_TO_ADD = [
  { first: 'ZZP', last: 'Team', email: 'marvinmertakusuma@gmail.com' },
];

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

    // First check: resend Marvin Vrij invite (already exists as pending)
    console.log('\n2. Checking pending invites for Marvin Vrij...');
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-users-before.png' });
    console.log('   Screenshot saved');

    // Add ZZP Team
    for (const u of USERS_TO_ADD) {
      const fullName = `${u.first} ${u.last}`.trim();
      console.log(`\n3. Adding ${fullName}...`);
      await page.goto('https://sonty.planadoapp.com/admin/users/new?role=field');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const textInputs = await page.$$('input[type="text"]');
      const visibleInputs = [];
      for (const inp of textInputs) {
        if (await inp.isVisible()) visibleInputs.push(inp);
      }

      if (visibleInputs.length >= 2) {
        await visibleInputs[0].fill(u.first);
        await visibleInputs[1].fill(u.last);
        console.log(`   Filled name: ${fullName}`);
      }

      // Click "Via e-mail" radio
      await page.locator('text=Via e-mail').click();
      await page.waitForTimeout(500);

      // Fill email
      const updatedInputs = await page.$$('input[type="text"]');
      const visibleAfter = [];
      for (const inp of updatedInputs) {
        if (await inp.isVisible()) visibleAfter.push(inp);
      }
      if (visibleAfter.length >= 3) {
        await visibleAfter[2].fill(u.email);
        console.log(`   Filled email: ${u.email}`);
      }

      await page.screenshot({ path: `/tmp/planado-${u.first.toLowerCase().replace(/\s/g,'-')}-before-submit.png` });

      // Submit
      await page.locator('button.btn.btn-primary').click();
      await page.waitForTimeout(3000);

      const url = page.url();
      if (!url.includes('/new')) {
        console.log(`   ✅ ${fullName} toegevoegd!`);
      } else {
        console.log(`   ❌ Still on form page`);
        const errors = await page.$$eval('.error, .alert, [class*="error"], [class*="Error"]', els =>
          els.map(e => e.textContent.trim()).filter(t => t.length > 0)
        );
        if (errors.length) console.log('   Errors:', errors);
        await page.screenshot({ path: `/tmp/planado-${u.first.toLowerCase().replace(/\s/g,'-')}-error.png` });
      }
    }

    // Final screenshot
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-users-after.png' });
    console.log('\n4. Final screenshot saved');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-add-error.png' });
  }

  await browser.close();
})();
