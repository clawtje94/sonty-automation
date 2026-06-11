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
  console.log('🎬 Planado 4 types toevoegen v3');

  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const newTypes = ['Winkel afspraak', 'Service afspraak', 'Reparatie afspraak', 'Onderhouds afspraak'];

  for (const typeName of newTypes) {
    // Click directly at the position of "+ Opdrachtstype toevoegen" link
    // Based on screenshot: x≈464, y≈270 (but y shifts down as we add types)
    const linkPos = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        // Check if link text contains "toevoegen" and is near the types section
        const text = link.textContent?.trim() || '';
        if (text.includes('toevoegen')) {
          const rect = link.getBoundingClientRect();
          // Must be in the main content area (x > 350) and below the inputs
          if (rect.x > 350 && rect.x < 600 && rect.y > 200 && rect.y < 500 && rect.height < 40) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text, href: link.href || '' };
          }
        }
      }
      return null;
    });

    if (linkPos) {
      console.log(`Klik: "${linkPos.text}" op (${linkPos.x}, ${linkPos.y})`);
      await page.mouse.click(linkPos.x, linkPos.y);
      await page.waitForTimeout(2000);

      // Count inputs before and after to find the new one
      const allInputs = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('input').forEach((inp, idx) => {
          if (inp.offsetParent === null) return;
          const rect = inp.getBoundingClientRect();
          if (rect.width > 200) {
            result.push({ idx, value: inp.value || '', x: Math.round(rect.x), y: Math.round(rect.y + rect.height / 2), w: Math.round(rect.width) });
          }
        });
        return result;
      });
      console.log('  Inputs:', allInputs.map(i => `"${i.value}" y=${i.y}`).join(', '));

      const emptyInput = allInputs.find(i => i.value === '');
      if (emptyInput) {
        await page.mouse.click(emptyInput.x + 100, emptyInput.y);
        await page.waitForTimeout(300);
        await page.keyboard.type(typeName);
        console.log(`  ✅ ${typeName}`);
      } else {
        console.log(`  ❌ Geen leeg veld`);
        await ss(page, `PLJT7-debug`);
      }
      await page.waitForTimeout(500);
    } else {
      console.log(`❌ Link niet gevonden`);
      break;
    }
  }

  await ss(page, 'PLJT7-01-added');

  await page.locator('button:has-text("Opslaan")').click();
  console.log('Opgeslagen');
  await page.waitForTimeout(5000);

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
  await ss(page, 'PLJT7-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
