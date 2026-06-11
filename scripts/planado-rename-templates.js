const { chromium } = require('playwright');
const path = require('path');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  screenshot: ${name}`);
}

// Template UUID -> new Dutch name mapping
const RENAMES = [
  { uuid: '1f11c802-65cd-6aa0-9d06-7e73cee772e4', old: 'Estimation', newName: 'Inmeet afspraak', duration: '2h' },
  { uuid: '1f11c802-6675-6110-9d06-7e73cee772e4', old: 'Installation, business', newName: 'Montage afspraak', duration: '3h' },
  { uuid: '1f11c802-6613-6d00-9d06-7e73cee772e4', old: 'Installation, individuals', newName: 'Montage afspraak particulier', duration: '3h' },
  { uuid: '1f11c802-658a-62d0-9d06-7e73cee772e4', old: 'Delivery', newName: 'Winkel afspraak', duration: '1h' },
  { uuid: '1f11c802-66cd-6430-9d06-7e73cee772e4', old: 'Repair', newName: 'Reparatie afspraak', duration: '2h' },
  { uuid: '1f11c802-6452-6f20-9d06-7e73cee772e4', old: 'Diagnostic', newName: 'Service afspraak', duration: '2h' },
  { uuid: '1f11c802-63cb-6a80-9d06-7e73cee772e4', old: 'Emergency', newName: 'Onderhouds afspraak', duration: '2h' },
  { uuid: '1f11c802-652e-69e0-9d06-7e73cee772e4', old: 'Tweaking', newName: null }, // delete or skip
];

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('Planado sjablonen hernoemen');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  for (const tmpl of RENAMES) {
    if (!tmpl.newName) {
      console.log(`\n  SKIP: ${tmpl.old} (wordt later verwijderd)`);
      continue;
    }

    console.log(`\n====== ${tmpl.old} -> ${tmpl.newName} ======`);

    // Navigate to template edit page
    await page.goto(`https://sonty.planadoapp.com/admin/templates/${tmpl.uuid}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Find the name input field
    const nameInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        // Look for the name field - usually the first visible text input
        if (rect.width > 200 && rect.y > 100 && rect.y < 400) {
          // Check if label says "Name" or "Naam"
          let parent = inp.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            const label = parent.querySelector('label');
            if (label) {
              const labelText = label.textContent?.trim() || '';
              if (labelText.match(/naam|name/i)) {
                return { value: inp.value, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) };
              }
            }
            parent = parent.parentElement;
          }
          // If no label found, return first big input as fallback
          return { value: inp.value, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), fallback: true };
        }
      }
      return null;
    });

    if (nameInput) {
      console.log(`  Huidige naam: "${nameInput.value}" (${nameInput.fallback ? 'fallback' : 'label match'})`);

      // Triple-click to select all text in the input, then type new name
      await page.mouse.click(nameInput.x + 100, nameInput.y + 10, { clickCount: 3 });
      await page.waitForTimeout(300);
      await page.keyboard.type(tmpl.newName);
      console.log(`  -> ${tmpl.newName}`);
      await page.waitForTimeout(500);
    } else {
      // Debug: what inputs are on the page?
      const allInputs = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('input').forEach(inp => {
          if (inp.offsetParent === null) return;
          const rect = inp.getBoundingClientRect();
          result.push({ type: inp.type, value: inp.value || '', x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width) });
        });
        return result;
      });
      console.log('  Alle inputs:', JSON.stringify(allInputs));
      await ss(page, `PLREN-debug-${tmpl.old.replace(/[^a-zA-Z]/g, '')}`);
      continue;
    }

    // Click save button
    const saved = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, input[type="submit"]');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || btn.value || '';
        if (text.match(/opslaan|save|bewaar/i) && btn.offsetParent !== null) {
          const rect = btn.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
      return null;
    });

    if (saved) {
      await page.mouse.click(saved.x, saved.y);
      console.log(`  Opgeslagen (${saved.text})`);
      await page.waitForTimeout(3000);
    } else {
      console.log('  Save knop niet gevonden');
      await ss(page, `PLREN-nosave-${tmpl.old.replace(/[^a-zA-Z]/g, '')}`);
    }
  }

  // Verify: go back to templates list
  await page.goto('https://sonty.planadoapp.com/admin/templates', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const finalTemplates = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('tr a').forEach(a => {
      if (a.href?.includes('/admin/templates/') && a.href.length > 50) {
        result.push(a.textContent?.trim());
      }
    });
    return result;
  });
  console.log('\nDefinitieve sjablonen:', finalTemplates);
  await ss(page, 'PLREN-final');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
