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
  console.log('🎬 Planado 4 types toevoegen v4 (pixel coords)');

  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Debug: what links exist on the page?
  const allLinks = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('a, span, div').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.includes('toevoegen') && text.length < 40) {
        const rect = el.getBoundingClientRect();
        result.push({ tag: el.tagName, text, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), href: el.href || '' });
      }
    });
    return result;
  });
  console.log('Links met "toevoegen":', JSON.stringify(allLinks, null, 2));

  const newTypes = ['Winkel afspraak', 'Service afspraak', 'Reparatie afspraak', 'Onderhouds afspraak'];

  for (const typeName of newTypes) {
    // Click directly at position of "+ Opdrachtstype toevoegen" (visible at ~464, 270)
    await page.mouse.click(464, 270);
    await page.waitForTimeout(2000);

    // Check for new empty input
    const inputs = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('input').forEach(inp => {
        if (inp.offsetParent === null) return;
        const rect = inp.getBoundingClientRect();
        if (rect.width > 200) result.push({ value: inp.value || '', y: Math.round(rect.y) });
      });
      return result;
    });
    console.log(`After click: ${inputs.length} inputs: ${inputs.map(i => `"${i.value}"`).join(', ')}`);

    const emptyIdx = inputs.findIndex(i => i.value === '');
    if (emptyIdx >= 0) {
      // Click on the empty input and type
      const emptyY = inputs[emptyIdx].y;
      await page.mouse.click(620, emptyY + 10);
      await page.waitForTimeout(300);
      await page.keyboard.type(typeName);
      console.log(`  ✅ ${typeName}`);
    } else {
      console.log(`  ❌ Geen leeg veld na klik`);
      // The link position shifts down as we add types, recalculate
      const linkY = inputs.length > 0 ? inputs[inputs.length - 1].y + 55 : 270;
      console.log(`  Trying y=${linkY}...`);
      await page.mouse.click(464, linkY);
      await page.waitForTimeout(2000);

      const inputs2 = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('input').forEach(inp => {
          if (inp.offsetParent === null) return;
          const rect = inp.getBoundingClientRect();
          if (rect.width > 200) result.push({ value: inp.value || '', y: Math.round(rect.y) });
        });
        return result;
      });
      const emptyIdx2 = inputs2.findIndex(i => i.value === '');
      if (emptyIdx2 >= 0) {
        await page.mouse.click(620, inputs2[emptyIdx2].y + 10);
        await page.waitForTimeout(300);
        await page.keyboard.type(typeName);
        console.log(`  ✅ ${typeName} (retry)`);
      } else {
        console.log(`  ❌ Nog steeds geen leeg veld`);
      }
    }
    await page.waitForTimeout(500);
    await ss(page, `PLJT8-${typeName.replace(/\s/g, '')}`);
  }

  // Save
  await page.locator('button:has-text("Opslaan")').click();
  console.log('\nOpgeslagen');
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
  console.log('Definitieve types:', finalTypes);
  await ss(page, 'PLJT8-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
