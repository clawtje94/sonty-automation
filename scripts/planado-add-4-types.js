const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Planado 4 extra types toevoegen');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const newTypes = ['Winkel afspraak', 'Service afspraak', 'Reparatie', 'Onderhoud'];

  for (const typeName of newTypes) {
    // Click "+ Opdrachtstype toevoegen" link
    const addLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.textContent?.trim().includes('toevoegen')) {
          const rect = link.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: link.textContent.trim() };
        }
      }
      return null;
    });

    if (addLink) {
      console.log(`Klik: "${addLink.text}"`);
      await page.mouse.click(addLink.x, addLink.y);
      await page.waitForTimeout(1500);

      // Find the new empty input field (last one)
      const emptyInput = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        let last = null;
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const rect = inp.getBoundingClientRect();
          if (rect.width > 200 && (!inp.value || inp.value === '')) {
            last = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return last;
      });

      if (emptyInput) {
        await page.mouse.click(emptyInput.x, emptyInput.y);
        await page.keyboard.type(typeName);
        console.log(`  ✅ ${typeName}`);
        await page.waitForTimeout(500);
      } else {
        console.log(`  ❌ Geen leeg veld gevonden voor ${typeName}`);
      }
    } else {
      console.log(`❌ "toevoegen" link niet gevonden`);
      break;
    }
  }

  await ss(page, 'PLJT4-01-added');

  // Click Opslaan
  const saveBtn = page.locator('button:has-text("Opslaan")').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    console.log('Opgeslagen');
    await page.waitForTimeout(5000);
  }

  // Verify
  const finalTypes = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200 && inp.value) result.push(inp.value);
    });
    return result;
  });
  console.log('\nDefinitieve types:', finalTypes);

  await ss(page, 'PLJT4-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
