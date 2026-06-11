const { chromium } = require('playwright');

const SKILLS = [
  'Zonwering buiten',
  'Raamdeco binnen',
  'Rolluiken',
  'Screens',
  'Pergola',
  'Markiezen',
  'Behang',
  'Reparatie',
];

async function login(page) {
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  try {
    await login(page);

    for (const skill of SKILLS) {
      await page.goto('https://sonty.planadoapp.com/admin/skills');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Click "+ Vaardigheid toevoegen"
      await page.locator('text=Vaardigheid toevoegen').click();
      await page.waitForTimeout(1500);

      // The form should appear — find the input
      // Try filling any visible text input that appeared
      const inputs = await page.$$('input[type="text"]');
      let filled = false;
      for (const inp of inputs) {
        if (await inp.isVisible()) {
          const val = await inp.inputValue();
          if (!val) {
            await inp.fill(skill);
            filled = true;
            break;
          }
        }
      }

      if (!filled) {
        // Maybe it's an inline edit - look for contenteditable or textarea
        const editables = await page.$$('[contenteditable], textarea');
        for (const el of editables) {
          if (await el.isVisible()) {
            await el.fill(skill);
            filled = true;
            break;
          }
        }
      }

      if (filled) {
        // Press Enter or click Save
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Try clicking save if there's a button
        try {
          const saveBtn = page.locator('button:has-text("Opslaan")');
          if (await saveBtn.isVisible({ timeout: 1000 })) {
            await saveBtn.click();
            await page.waitForTimeout(1000);
          }
        } catch (e) {}

        console.log('OK: ' + skill);
      } else {
        await page.screenshot({ path: `/tmp/planado-skill-fail-${skill.replace(/\s/g, '_')}.png` });
        console.log('FAIL: ' + skill + ' (no input found)');
      }
    }

    await page.screenshot({ path: '/tmp/planado-skills-done.png' });
    console.log('Done');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
