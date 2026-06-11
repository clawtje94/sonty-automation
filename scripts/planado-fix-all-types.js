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
  console.log('🎬 Planado alle 6 types goed instellen');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  await page.goto('https://sonty.planadoapp.com/admin/job-types', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // First rename existing types
  const typeInputs = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 200) {
        result.push({ value: inp.value, x: Math.round(rect.x + 200), y: Math.round(rect.y + rect.height / 2) });
      }
    });
    return result;
  });
  console.log('Huidige types:', typeInputs.map(t => t.value));

  // Rename Inmeten → Inmeet afspraak, Montage → Montage afspraak
  for (const inp of typeInputs) {
    if (inp.value === 'Inmeten') {
      await page.mouse.click(inp.x, inp.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Inmeet afspraak');
      console.log('Inmeten → Inmeet afspraak');
    }
    if (inp.value === 'Montage') {
      await page.mouse.click(inp.x, inp.y);
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Montage afspraak');
      console.log('Montage → Montage afspraak');
    }
  }

  await page.waitForTimeout(1000);

  // Now add 4 new types by clicking "+ Opdrachtstype toevoegen"
  const newTypes = ['Winkel afspraak', 'Service afspraak', 'Reparatie afspraak', 'Onderhouds afspraak'];

  for (const typeName of newTypes) {
    // Find the correct link - "Opdrachtstype toevoegen" not "Oplossingen toevoegen"
    const addLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a, span, div');
      for (const el of links) {
        const text = el.textContent?.trim() || '';
        if (text.includes('Opdrachtstype toevoegen') || text.includes('type toevoegen')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
      // Fallback: look for any "toevoegen" link near the types section
      const allLinks = document.querySelectorAll('a');
      for (const link of allLinks) {
        const text = link.textContent?.trim() || '';
        if (text.includes('toevoegen') && !text.includes('Oplossing')) {
          const rect = link.getBoundingClientRect();
          // Should be below the type inputs (y > 200)
          if (rect.y > 200 && rect.y < 500) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
      return null;
    });

    if (addLink) {
      console.log(`Klik: "${addLink.text}"`);
      await page.mouse.click(addLink.x, addLink.y);
      await page.waitForTimeout(1500);

      // Find the last input that's empty or newly added
      const allInputs = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('input').forEach(inp => {
          if (inp.offsetParent === null) return;
          const rect = inp.getBoundingClientRect();
          if (rect.width > 200) {
            result.push({ value: inp.value || '', x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
          }
        });
        return result;
      });

      // Find the empty one (last one should be empty)
      const emptyInp = allInputs.filter(i => i.value === '').pop();
      if (emptyInp) {
        await page.mouse.click(emptyInp.x, emptyInp.y);
        await page.keyboard.type(typeName);
        console.log(`  ✅ ${typeName}`);
      } else {
        console.log(`  ❌ Geen leeg input veld. Inputs:`, allInputs.map(i => i.value));
      }
      await page.waitForTimeout(500);
    } else {
      console.log(`❌ Toevoegen link niet gevonden`);
      // Show all links on page for debugging
      const allLinks = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('a').forEach(a => {
          const text = a.textContent?.trim() || '';
          if (text.length > 3 && text.length < 50) {
            const rect = a.getBoundingClientRect();
            result.push({ text, y: Math.round(rect.y) });
          }
        });
        return result.filter(l => l.y > 100 && l.y < 500);
      });
      console.log('Links op pagina:', JSON.stringify(allLinks));
      break;
    }
  }

  await ss(page, 'PLJT5-01-all-types');

  // Save
  const saveBtn = page.locator('button:has-text("Opslaan")').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    console.log('\nOpgeslagen');
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

  await ss(page, 'PLJT5-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
