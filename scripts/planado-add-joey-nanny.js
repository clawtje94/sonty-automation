const { chromium } = require('playwright');

const USERS = [
  {
    first: 'Joey', last: 'Engelen', email: 'joey@sonty.nl',
    password: 'SontyPlanado2026!',
    fullPermissions: true // eigenaar - alles kunnen inzien
  },
  {
    first: 'Nanny', last: 'van Vliet - Kester', email: 'nanny@sonty.nl',
    password: 'SontyPlanado2026!',
    fullPermissions: true // planner - planning bewerken
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    await page.goto('https://sonty.planadoapp.com/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
    await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
    await page.locator('button:has-text("Inloggen")').click();
    await page.waitForTimeout(5000);

    for (const u of USERS) {
      await page.goto('https://sonty.planadoapp.com/admin/users/new?role=web');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // This form has labeled fields - fill by finding inputs near labels
      // Voornaam, Achternaam, E-mailadres, Wachtwoord are all text/email/password inputs
      const allInputs = await page.$$('input');
      const fieldMap = {};

      for (const inp of allInputs) {
        if (!(await inp.isVisible())) continue;
        const type = await inp.getAttribute('type');
        if (type === 'hidden' || type === 'checkbox' || type === 'radio') continue;

        // Get the label text by looking at siblings/parent
        const labelText = await inp.evaluate(el => {
          // Check for preceding label or td
          const row = el.closest('tr') || el.closest('.form-group') || el.parentElement;
          const label = row?.querySelector('label, td:first-child');
          return label?.textContent?.trim() || '';
        });

        fieldMap[labelText] = inp;
      }

      // Fill the fields
      if (fieldMap['Voornaam']) await fieldMap['Voornaam'].fill(u.first);
      if (fieldMap['Achternaam']) await fieldMap['Achternaam'].fill(u.last);
      if (fieldMap['E-mailadres']) await fieldMap['E-mailadres'].fill(u.email);
      if (fieldMap['Wachtwoord']) await fieldMap['Wachtwoord'].fill(u.password);

      // For Joey: set all permissions to "bewerken en verwijderen"
      if (u.fullPermissions) {
        // Check all "bewerken en verwijderen" radio buttons where available
        const deleteRadios = await page.$$('input[type="radio"]');
        for (const radio of deleteRadios) {
          const label = await radio.evaluate(el => {
            const lbl = el.closest('label') || el.parentElement;
            return lbl?.textContent?.trim() || '';
          });
          if (label.includes('bewerken en verwijderen')) {
            await radio.check();
          }
        }
      }

      await page.screenshot({ path: `/tmp/planado-form-${u.first}.png` });

      // Submit - find the save/create button at bottom
      const submitBtn = page.locator('button.btn.btn-primary, button:has-text("Opslaan"), button:has-text("Aanmaken")');
      await submitBtn.first().click();
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      if (!currentUrl.includes('/new')) {
        console.log(`OK: ${u.first} ${u.last} (${u.email})`);
      } else {
        // Check for errors
        await page.screenshot({ path: `/tmp/planado-error-${u.first}.png` });
        const pageText = await page.textContent('body');
        const errorMatch = pageText.match(/(?:fout|error|moet|invalid)[^.]{0,100}/gi);
        console.log(`FOUT: ${u.first} - ${errorMatch ? errorMatch[0] : 'onbekend'}`);
      }
    }

    // Final users list
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-users-final.png' });
    console.log('Klaar');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
