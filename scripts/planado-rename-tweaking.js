const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on('dialog', async dialog => {
    console.log(`  Dialog: "${dialog.message()}" -> accepting`);
    await dialog.accept();
  });

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  // Open Tweaking template and try delete first
  await page.goto('https://sonty.planadoapp.com/admin/templates/1f11c802-652e-69e0-9d06-7e73cee772e4', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Try clicking delete with scrollIntoView
  const delBtn = page.locator('button:has-text("Verwijderen")');
  await delBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Take screenshot to see what's happening
  await page.screenshot({ path: path.join(__dirname, 'wf-debug-PLDEL-before.png') });

  await delBtn.click({ force: true });
  console.log('Clicked Verwijderen');
  await page.waitForTimeout(5000);

  // Check if we're on templates list now (means delete worked)
  const url = page.url();
  console.log('URL after delete:', url);

  if (url.includes('1f11c802-652e-69e0')) {
    // Still on edit page - delete didn't work. Rename instead.
    console.log('Delete failed, renaming to "Advies afspraak"');
    const nameInput = page.locator('input[name="template[name]"]');
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill('Advies afspraak');

    // Set job type
    // Click the type input area (y ~254 based on earlier exploration)
    const typeInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        // Type field is ~y=254, w=516
        if (rect.y > 230 && rect.y < 280 && rect.width > 400) {
          return { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (typeInput) {
      await page.mouse.click(typeInput.x, typeInput.y);
      await page.waitForTimeout(500);
      await page.keyboard.type('Service');
      await page.waitForTimeout(1000);
      const option = await page.evaluate(() => {
        const items = document.querySelectorAll('*');
        for (const item of items) {
          if (item.children.length > 0) continue;
          if (item.textContent?.trim() === 'Service afspraak') {
            const rect = item.getBoundingClientRect();
            if (rect.height > 0 && rect.height < 50 && rect.y > 0) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
        return null;
      });
      if (option) await page.mouse.click(option.x, option.y);
    }

    // Update description
    const desc = page.locator('textarea').first();
    await desc.click({ clickCount: 3 });
    await desc.fill('Adviesgesprek met klant over zonwering of raamdecoratie');

    // Duration: 1h
    const hourInput = page.locator('input[name="template[scheduled_duration][]"]').first();
    await hourInput.click({ clickCount: 3 });
    await hourInput.fill('1');
    const minInput = page.locator('input[name="template[scheduled_duration][]"]').nth(1);
    await minInput.click({ clickCount: 3 });
    await minInput.fill('0');

    // Save
    await page.locator('button:has-text("Opslaan")').click();
    console.log('Opgeslagen als "Advies afspraak"');
    await page.waitForTimeout(3000);
  }

  // Verify
  await page.goto('https://sonty.planadoapp.com/admin/templates', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const templates = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tr td:first-child a').forEach(a => {
      if (a.href?.includes('/admin/templates/')) rows.push(a.textContent?.trim());
    });
    return rows;
  });
  console.log('Definitieve sjablonen:', templates);
  await page.screenshot({ path: path.join(__dirname, 'wf-debug-PLDEL-final.png') });

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
