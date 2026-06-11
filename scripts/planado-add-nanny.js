const { chromium } = require('playwright');

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

    // Go to add web user
    await page.goto('https://sonty.planadoapp.com/admin/users/new?role=web');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take full page screenshot first
    await page.screenshot({ path: '/tmp/planado-nanny-full.png', fullPage: true });

    // Fill fields by finding inputs near labels
    const allInputs = await page.$$('input');
    const fieldMap = {};
    for (const inp of allInputs) {
      if (!(await inp.isVisible())) continue;
      const type = await inp.getAttribute('type');
      if (type === 'hidden' || type === 'checkbox' || type === 'radio') continue;
      const labelText = await inp.evaluate(el => {
        const row = el.closest('tr') || el.closest('.form-group') || el.parentElement;
        const label = row?.querySelector('label, td:first-child');
        return label?.textContent?.trim() || '';
      });
      if (labelText) fieldMap[labelText] = inp;
    }

    console.log('Found fields:', Object.keys(fieldMap).join(', '));

    if (fieldMap['Voornaam']) await fieldMap['Voornaam'].fill('Nanny');
    if (fieldMap['Achternaam']) await fieldMap['Achternaam'].fill('van Vliet - Kester');
    if (fieldMap['E-mailadres']) await fieldMap['E-mailadres'].fill('nanny@sonty.nl');
    if (fieldMap['Wachtwoord']) await fieldMap['Wachtwoord'].fill('SontyPlanado2026!');

    // Verify fields are filled
    for (const [label, inp] of Object.entries(fieldMap)) {
      const val = await inp.inputValue();
      console.log(`  ${label}: "${val}"`);
    }

    await page.waitForTimeout(500);

    // Click Toevoegen via JS evaluation to bypass any overlay issues
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim() === 'Toevoegen' && btn.classList.contains('btn-primary')) {
          btn.click();
          return;
        }
      }
    });
    await page.waitForTimeout(5000);

    // If still on page, try force clicking at coordinates
    if (page.url().includes('/new')) {
      const btn = page.locator('button.btn-primary:has-text("Toevoegen")');
      const box = await btn.boundingBox();
      if (box) {
        console.log(`Button at x:${box.x} y:${box.y} w:${box.width} h:${box.height}`);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(5000);
      }
    }

    const url = page.url();
    console.log('URL after submit:', url);
    if (!url.includes('/new')) {
      console.log('OK: Nanny toegevoegd!');
    } else {
      console.log('Nog op formulier pagina');
      // Check for error toast
      const bodyText = await page.textContent('body');
      const errMatch = bodyText.match(/Het formulier bevat fouten|moet worden ingevuld|error/gi);
      if (errMatch) console.log('Errors:', errMatch.join(', '));
      await page.screenshot({ path: '/tmp/planado-nanny-error2.png' });
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
