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
  console.log('🎬 Planado job types updaten (6 types)');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);
  console.log('Ingelogd');

  // Go to Job Types
  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Get current types
  const currentTypes = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200 && inp.value) result.push(inp.value);
    });
    return result;
  });
  console.log('Huidige types:', currentTypes);

  // We need to rename existing types and add new ones
  // Current: Opmeting, Installatie
  // Target: Montage, Inmeten, Winkel afspraak, Service afspraak, Reparatie, Onderhoud

  // Rename Opmeting → Inmeten
  const typeInputs = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200) {
        result.push({ value: inp.value, x: Math.round(rect.x + 200), y: Math.round(rect.y + rect.height / 2) });
      }
    });
    return result;
  });

  for (const inp of typeInputs) {
    if (inp.value === 'Opmeting') {
      await page.mouse.click(inp.x, inp.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Inmeten');
      console.log('Opmeting → Inmeten');
    }
    if (inp.value === 'Installatie') {
      await page.mouse.click(inp.x, inp.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Montage');
      console.log('Installatie → Montage');
    }
  }

  await page.waitForTimeout(1000);
  await ss(page, 'PLJT3-01-renamed');

  // Now add the 4 new types: Winkel afspraak, Service afspraak, Reparatie, Onderhoud
  const newTypes = ['Winkel afspraak', 'Service afspraak', 'Reparatie', 'Onderhoud'];

  for (const typeName of newTypes) {
    // Find and click "Add" or "+" button
    const addBtn = await page.evaluate(() => {
      const allEls = document.querySelectorAll('a, button');
      for (const el of allEls) {
        if (el.offsetParent === null) continue;
        const text = el.textContent?.trim() || '';
        if (text.includes('Add') || text.includes('Toevoegen') || text.includes('Nieuw') || text === '+') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
      return null;
    });

    if (addBtn) {
      await page.mouse.click(addBtn.x, addBtn.y);
      await page.waitForTimeout(1000);

      // Find the newest empty input
      const emptyInput = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
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
        console.log(`+ ${typeName} toegevoegd`);
        await page.waitForTimeout(500);
      }
    } else {
      console.log(`Geen "Add" knop gevonden voor ${typeName}`);
      break;
    }
  }

  await page.waitForTimeout(1000);
  await ss(page, 'PLJT3-02-added');

  // Save
  const saveBtn = page.locator('button:has-text("Opslaan"), button:has-text("Save")').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    console.log('Opgeslagen');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'PLJT3-03-saved');

  // Verify
  const finalTypes = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200 && inp.value) result.push(inp.value);
    });
    return result;
  });
  console.log('\nDefinitieve types:', finalTypes);

  await ss(page, 'PLJT3-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
