const { chromium } = require('playwright');
const path = require('path');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Planado 4 types toevoegen v2');

  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await ss(page, 'PLJT6-01-start');

  const newTypes = ['Winkel afspraak', 'Service afspraak', 'Reparatie afspraak', 'Onderhouds afspraak'];

  for (const typeName of newTypes) {
    // Use Playwright locator to find the exact "Opdrachtstype toevoegen" link
    const addLink = page.locator('a:has-text("Opdrachtstype toevoegen")');

    if (await addLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addLink.click();
      await page.waitForTimeout(2000);

      // Now find the empty input - count all visible inputs with width > 200
      const inputs = await page.locator('input').all();
      let found = false;
      for (const inp of inputs) {
        if (!await inp.isVisible()) continue;
        const box = await inp.boundingBox();
        if (!box || box.width < 200) continue;
        const val = await inp.inputValue();
        if (val === '') {
          await inp.fill(typeName);
          console.log(`  ✅ ${typeName}`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`  ❌ Geen leeg veld voor ${typeName}`);
        await ss(page, `PLJT6-debug-${typeName.replace(/\s/g, '')}`);
      }
      await page.waitForTimeout(500);
    } else {
      console.log(`❌ "Opdrachtstype toevoegen" niet gevonden`);
      break;
    }
  }

  await ss(page, 'PLJT6-02-added');

  // Save
  await page.locator('button:has-text("Opslaan")').click();
  console.log('Opgeslagen');
  await page.waitForTimeout(5000);

  // Verify
  const allInputs = await page.locator('input').all();
  const types = [];
  for (const inp of allInputs) {
    if (!await inp.isVisible()) continue;
    const box = await inp.boundingBox();
    if (!box || box.width < 200) continue;
    const val = await inp.inputValue();
    if (val) types.push(val);
  }
  console.log('\nDefinitieve types:', types);

  await ss(page, 'PLJT6-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
