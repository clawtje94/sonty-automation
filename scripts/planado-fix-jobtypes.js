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
  console.log('🎬 Planado job types fixen');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Get all input fields (job type names)
  const typeInputs = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200) {
        result.push({ value: inp.value, x: Math.round(rect.x), y: Math.round(rect.y + rect.height / 2) });
      }
    });
    return result;
  });
  console.log('Current types:', JSON.stringify(typeInputs));

  // Change "Repair" to "Opmeting"
  for (const inp of typeInputs) {
    if (inp.value === 'Repair') {
      await page.mouse.click(inp.x + 200, inp.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Opmeting');
      console.log('Repair → Opmeting');
    }
    if (inp.value === 'Installation') {
      await page.mouse.click(inp.x + 200, inp.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Installatie');
      console.log('Installation → Installatie');
    }
  }

  // Delete "Emergency" - click the trash icon next to it
  const emergencyTrash = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.value === 'Emergency') {
        // Find the trash button next to it
        const row = inp.parentElement;
        const trashBtn = row?.querySelector('button, [class*="delete"], [class*="trash"], [role="button"]');
        if (trashBtn) {
          const rect = trashBtn.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
        // Fallback: look for sibling elements
        const siblings = inp.parentElement?.children;
        if (siblings) {
          for (const sib of siblings) {
            if (sib.tagName === 'BUTTON' || sib.querySelector('svg') || sib.getAttribute('role') === 'button') {
              const rect = sib.getBoundingClientRect();
              if (rect.width > 0) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
      }
    }
    return null;
  });

  if (emergencyTrash) {
    await page.mouse.click(emergencyTrash.x, emergencyTrash.y);
    console.log('Emergency verwijderd');
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(1000);
  await ss(page, 'PLJT2-01-edited');

  // Click "Opslaan" (Save)
  const saveBtn = page.locator('button:has-text("Opslaan")').first();
  if (await saveBtn.isVisible({ timeout: 3000 })) {
    await saveBtn.click();
    console.log('Opgeslagen');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'PLJT2-final');
  const finalTypes = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200 && inp.value) result.push(inp.value);
    });
    return result;
  });
  console.log('Final types:', finalTypes);

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
