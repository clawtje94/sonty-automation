const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);

  // Add Jaimy as web user (klantenservice, not field worker)
  await page.goto('https://sonty.planadoapp.com/admin/users/new?role=web');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

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

  if (fieldMap['Voornaam']) await fieldMap['Voornaam'].fill('Jaimy');
  if (fieldMap['Achternaam']) await fieldMap['Achternaam'].fill('de Wit');
  if (fieldMap['E-mailadres']) await fieldMap['E-mailadres'].fill('jaimy@sonty.nl');
  if (fieldMap['Wachtwoord']) await fieldMap['Wachtwoord'].fill('SontyPlanado2026!');

  await page.locator('button.btn.btn-primary').first().click();
  await page.waitForTimeout(3000);

  if (!page.url().includes('/new')) {
    console.log('OK: Jaimy de Wit (jaimy@sonty.nl)');
  } else {
    console.log('FAIL');
  }
  await browser.close();
})();
