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

  // First skill: click "+ Vaardigheid toevoegen" to create the first input
  await page.locator('text=Vaardigheid toevoegen').click();
  await page.waitForTimeout(1000);

  // Fill first skill
  const firstInput = page.locator('input.pd-form-control').first();
  await firstInput.fill(SKILLS[0]);
  console.log('Filled: ' + SKILLS[0]);

  // Add remaining skills by clicking "+ Vaardigheid toevoegen" and filling each new input
  for (let i = 1; i < SKILLS.length; i++) {
    await page.locator('text=Vaardigheid toevoegen').click();
    await page.waitForTimeout(500);

    // The newest input should be the last one (or empty one)
    const allInputs = page.locator('input.pd-form-control');
    const count = await allInputs.count();
    await allInputs.nth(count - 1).fill(SKILLS[i]);
    console.log('Filled: ' + SKILLS[i]);
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/planado-skills-before-save.png' });

  // Click Opslaan to save ALL skills at once
  await page.locator('button:has-text("Opslaan")').click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/planado-skills-after-save.png' });

  // Verify
  const pageText = await page.evaluate(() => document.body.innerText);
  for (const skill of SKILLS) {
    if (pageText.includes(skill)) {
      console.log('OK: ' + skill);
    } else {
      console.log('MISSING: ' + skill);
    }
  }

  await browser.close();
})();
