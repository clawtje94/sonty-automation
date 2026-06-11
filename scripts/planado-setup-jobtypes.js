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
  console.log('🎬 Planado job types aanmaken');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);
  console.log('Ingelogd');

  // Go to Job Types settings
  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'PLJT-01-types');

  const typesText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Types:', typesText.substring(0, 1000));

  // Check if "Opmeting" already exists
  if (typesText.includes('Opmeting')) {
    console.log('Opmeting type bestaat al!');
  } else {
    // Create Opmeting job type
    const addBtn = page.locator('a:has-text("Nieuw type"), a:has-text("New type"), button:has-text("Nieuw type"), button:has-text("New"), a:has-text("toevoegen"), button:has-text("Add")').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(3000);
      await ss(page, 'PLJT-02-new');

      // Fill name field
      const nameInput = page.locator('input[placeholder*="aam"], input[placeholder*="ame"], input[name*="name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Opmeting');
        console.log('Naam: Opmeting');
      } else {
        // Try any visible input
        const inputs = await page.evaluate(() => {
          const result = [];
          document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
            if (inp.offsetParent === null) return;
            const rect = inp.getBoundingClientRect();
            if (rect.width > 100) result.push({
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
              placeholder: inp.placeholder, name: inp.name
            });
          });
          return result;
        });
        console.log('Inputs:', JSON.stringify(inputs));
        if (inputs.length > 0) {
          await page.mouse.click(inputs[0].x, inputs[0].y);
          await page.keyboard.type('Opmeting');
        }
      }

      // Save
      const saveBtn = page.locator('button:has-text("Opslaan"), button:has-text("Save"), button[type="submit"]').first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        console.log('Opmeting opgeslagen');
      }
    } else {
      // Check the page structure
      const links = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('a, button').forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.length > 0 && text.length < 50) {
            result.push({ text, href: el.getAttribute('href') || '' });
          }
        });
        return result;
      });
      console.log('Links/buttons:', JSON.stringify(links.filter(l => l.text.length > 2).slice(0, 20), null, 2));
    }
  }

  await ss(page, 'PLJT-03-after-opmeting');

  // Now create Installatie type
  const typesText2 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  if (typesText2.includes('Installatie')) {
    console.log('Installatie type bestaat al!');
  } else {
    // Go back to types list
    await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const addBtn2 = page.locator('a:has-text("Nieuw type"), a:has-text("New type"), button:has-text("Nieuw type"), button:has-text("New"), a:has-text("toevoegen"), button:has-text("Add")').first();
    if (await addBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn2.click();
      await page.waitForTimeout(3000);

      const nameInput = page.locator('input[placeholder*="aam"], input[placeholder*="ame"], input[name*="name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Installatie');
      } else {
        const inputs = await page.evaluate(() => {
          const result = [];
          document.querySelectorAll('input[type="text"], input:not([type])').forEach(inp => {
            if (inp.offsetParent === null) return;
            const rect = inp.getBoundingClientRect();
            if (rect.width > 100) result.push({
              x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)
            });
          });
          return result;
        });
        if (inputs.length > 0) {
          await page.mouse.click(inputs[0].x, inputs[0].y);
          await page.keyboard.type('Installatie');
        }
      }

      const saveBtn = page.locator('button:has-text("Opslaan"), button:has-text("Save"), button[type="submit"]').first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        console.log('Installatie opgeslagen');
      }
    }
  }

  await ss(page, 'PLJT-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 800));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
