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

  // Create new invitation for Kevin with hotmail
  await page.goto('https://sonty.planadoapp.com/admin/users/new?role=field');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Fill name
  const textInputs = await page.$$('input[type="text"]');
  const visible = [];
  for (const inp of textInputs) {
    if (await inp.isVisible()) visible.push(inp);
  }
  if (visible.length >= 2) {
    await visible[0].fill('Kevin');
    await visible[1].fill('Gibson');
  }

  // Via e-mail
  await page.locator('text=Via e-mail').click();
  await page.waitForTimeout(500);

  // Fill email
  const updatedInputs = await page.$$('input[type="text"]');
  const visibleAfter = [];
  for (const inp of updatedInputs) {
    if (await inp.isVisible()) visibleAfter.push(inp);
  }
  if (visibleAfter.length >= 3) {
    await visibleAfter[2].fill('Gibson.k.j@hotmail.com');
  }

  await page.locator('button.btn.btn-primary').click();
  await page.waitForTimeout(3000);

  if (!page.url().includes('/new')) {
    console.log('OK: Kevin Gibson reinvited to Gibson.k.j@hotmail.com');
  } else {
    console.log('FAIL');
    await page.screenshot({ path: '/tmp/planado-kevin-fail.png' });
  }

  await browser.close();
})();
