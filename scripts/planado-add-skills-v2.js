const { chromium } = require('playwright');

const SKILLS = ['Zonwering buiten', 'Raamdeco binnen', 'Rolluiken', 'Screens', 'Pergola', 'Markiezen', 'Behang', 'Reparatie'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);

  await page.goto('https://sonty.planadoapp.com/admin/skills');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click + Vaardigheid toevoegen
  await page.locator('text=Vaardigheid toevoegen').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/planado-skill-add-form.png' });

  // Log everything visible
  const html = await page.evaluate(() => document.querySelector('.modal, [class*="dialog"], [class*="popup"], [class*="overlay"], form')?.innerHTML?.substring(0, 2000) || 'no modal');
  console.log('Modal HTML:', html.substring(0, 500));

  // List ALL visible inputs including their context
  const allInputs = await page.$$eval('input, textarea, [contenteditable="true"]', els =>
    els.filter(e => e.offsetParent !== null).map(e => ({
      tag: e.tagName,
      type: e.type,
      name: e.name,
      placeholder: e.placeholder,
      value: e.value,
      id: e.id,
      class: e.className.substring(0, 50),
    }))
  );
  console.log('Visible inputs:', JSON.stringify(allInputs, null, 2));

  // Try finding input near the "Vaardigheid toevoegen" text
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Page text after click:', pageText.substring(0, 800));

  await browser.close();
})();
