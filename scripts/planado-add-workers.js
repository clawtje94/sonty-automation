const { chromium } = require('playwright');

const MONTEURS = [
  { first: 'Sjoerd', last: 'Pelle', email: 'sjoerd@sontymontage.nl' },
  { first: 'Marvin', last: 'Vrij', email: 'marvin@sontymontage.nl' },
  { first: 'Mick', last: 'Mulders', email: 'mick@sontymontage.nl' },
  { first: 'Jorren', last: 'Plugge', email: 'jorren@sontymontage.nl' },
  { first: 'Tygo', last: 'Krikke', email: 'tygo@sontymontage.nl' },
  { first: 'Kevin', last: 'Gibson', email: 'kevin@sontymontage.nl' },
  { first: 'Nick', last: 'Huizer', email: 'nick@sontymontage.nl' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('1. Login...');
    await page.goto('https://sonty.planadoapp.com/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
    await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
    await page.locator('button:has-text("Inloggen")').click();
    await page.waitForTimeout(5000);
    console.log('   Logged in');

    const added = [];

    for (const m of MONTEURS) {
      console.log(`\n   Adding ${m.first} ${m.last}...`);
      await page.goto('https://sonty.planadoapp.com/admin/users/new?role=field');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Fill Voornaam and Achternaam (first two visible text inputs)
      const textInputs = await page.$$('input[type="text"]');
      const visibleInputs = [];
      for (const inp of textInputs) {
        if (await inp.isVisible()) visibleInputs.push(inp);
      }

      if (visibleInputs.length >= 2) {
        await visibleInputs[0].fill(m.first);
        await visibleInputs[1].fill(m.last);
      }

      // Click "Via e-mail" radio
      await page.locator('text=Via e-mail').click();
      await page.waitForTimeout(500);

      // Screenshot to see the email field
      await page.screenshot({ path: `/tmp/planado-form-${m.first}.png` });

      // Find and fill the email field - it should now be visible
      // Get all visible text/email inputs again after the radio change
      const allInputs = await page.$$('input:visible');
      for (const inp of allInputs) {
        const type = await inp.getAttribute('type');
        const placeholder = await inp.getAttribute('placeholder');
        const value = await inp.inputValue();
        if ((type === 'email' || (type === 'text' && !value && placeholder !== 'E-mail')) && !value) {
          console.log(`   Found empty input: type=${type}, placeholder=${placeholder}`);
        }
      }

      // Re-gather visible text inputs after radio change (email field appeared)
      await page.waitForTimeout(500);
      const updatedInputs = await page.$$('input[type="text"]');
      const visibleAfter = [];
      for (const inp of updatedInputs) {
        if (await inp.isVisible()) visibleAfter.push(inp);
      }
      // The email field is the 3rd visible text input (after voornaam, achternaam)
      if (visibleAfter.length >= 3) {
        await visibleAfter[2].fill(m.email);
        console.log(`   Filled email: ${m.email}`);
      } else {
        console.log(`   Could not find email field (${visibleAfter.length} visible inputs)`);
      }

      // Click Toevoegen (the form submit button, not the nav button)
      await page.locator('button.btn.btn-primary').click();
      await page.waitForTimeout(3000);

      const url = page.url();
      if (!url.includes('/new')) {
        added.push(`${m.first} ${m.last}`);
        console.log(`   ✅ ${m.first} ${m.last}`);
      } else {
        console.log(`   ❌ Still on form page`);
        // Check error messages
        const errors = await page.$$eval('.error, .alert, [class*="error"], [class*="Error"]', els =>
          els.map(e => e.textContent.trim()).filter(t => t.length > 0)
        );
        if (errors.length) console.log('   Errors:', errors);
      }
    }

    console.log(`\nSummary: Added ${added.length}/${MONTEURS.length}`);
    for (const n of added) console.log(`   ✅ ${n}`);

    // Final users list
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-final-users.png' });

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
