const { chromium } = require('playwright');
const path = require('path');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`), fullPage: true });
  console.log(`  screenshot: ${name}`);
}

const TEMPLATES = [
  {
    uuid: '1f11c802-65cd-6aa0-9d06-7e73cee772e4',
    old: 'Estimation',
    name: 'Inmeet afspraak',
    type: 'Inmeet afspraak',
    description: 'Eerste bezoek bij klant voor inmeten, monsters tonen en offerte bespreken',
    hours: '2', minutes: '0'
  },
  {
    uuid: '1f11c802-6675-6110-9d06-7e73cee772e4',
    old: 'Installation, business',
    name: 'Montage afspraak zakelijk',
    type: 'Montage afspraak',
    description: 'Montage/installatie bij zakelijke klant',
    hours: '4', minutes: '0'
  },
  {
    uuid: '1f11c802-6613-6d00-9d06-7e73cee772e4',
    old: 'Installation, individuals',
    name: 'Montage afspraak particulier',
    type: 'Montage afspraak',
    description: 'Montage/installatie bij particuliere klant',
    hours: '3', minutes: '0'
  },
  {
    uuid: '1f11c802-658a-62d0-9d06-7e73cee772e4',
    old: 'Delivery',
    name: 'Winkel afspraak',
    type: 'Winkel afspraak',
    description: 'Afspraak in de winkel met klant',
    hours: '1', minutes: '0'
  },
  {
    uuid: '1f11c802-66cd-6430-9d06-7e73cee772e4',
    old: 'Repair',
    name: 'Reparatie afspraak',
    type: 'Reparatie afspraak',
    description: 'Reparatie van zonwering of raamdecoratie bij klant',
    hours: '2', minutes: '0'
  },
  {
    uuid: '1f11c802-6452-6f20-9d06-7e73cee772e4',
    old: 'Diagnostic',
    name: 'Service afspraak',
    type: 'Service afspraak',
    description: 'Servicebezoek voor diagnose of inspectie',
    hours: '1', minutes: '30'
  },
  {
    uuid: '1f11c802-63cb-6a80-9d06-7e73cee772e4',
    old: 'Emergency',
    name: 'Onderhouds afspraak',
    type: 'Onderhouds afspraak',
    description: 'Periodiek onderhoud van zonwering of raamdecoratie',
    hours: '1', minutes: '30'
  },
  {
    uuid: '1f11c802-652e-69e0-9d06-7e73cee772e4',
    old: 'Tweaking',
    name: null // verwijderen
  }
];

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('Planado sjablonen hernoemen en configureren');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  for (const tmpl of TEMPLATES) {
    if (!tmpl.name) {
      console.log(`\n  SKIP/DELETE: ${tmpl.old}`);
      // Navigate to template and delete it
      await page.goto(`https://sonty.planadoapp.com/admin/templates/${tmpl.uuid}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      // Look for delete button
      const deleteBtn = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const btn of btns) {
          const text = btn.textContent?.trim() || '';
          if (text.match(/verwijder|delete/i) && btn.offsetParent !== null) {
            const rect = btn.getBoundingClientRect();
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
          }
        }
        return null;
      });
      if (deleteBtn) {
        await page.mouse.click(deleteBtn.x, deleteBtn.y);
        await page.waitForTimeout(2000);
        // Confirm delete if dialog appears
        const confirmBtn = await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            const text = btn.textContent?.trim() || '';
            if (text.match(/bevestig|ok|ja|confirm|yes|verwijder/i) && btn.offsetParent !== null) {
              const rect = btn.getBoundingClientRect();
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
          return null;
        });
        if (confirmBtn) {
          await page.mouse.click(confirmBtn.x, confirmBtn.y);
          await page.waitForTimeout(3000);
        }
        console.log(`  Verwijderd: ${tmpl.old}`);
      }
      continue;
    }

    console.log(`\n====== ${tmpl.old} -> ${tmpl.name} ======`);

    await page.goto(`https://sonty.planadoapp.com/admin/templates/${tmpl.uuid}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // 1. Change name - find input with name="template[name]"
    const nameInput = page.locator('input[name="template[name]"]');
    if (await nameInput.isVisible()) {
      await nameInput.click({ clickCount: 3 });
      await page.waitForTimeout(200);
      await nameInput.fill(tmpl.name);
      console.log(`  Naam: ${tmpl.name}`);
    }

    // 2. Set job type - click the type dropdown and select
    // The type field is a searchable dropdown after the name
    const typeField = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const lbl of labels) {
        if (lbl.textContent?.trim() === 'Opdrachttype') {
          // Find the input near this label
          const parent = lbl.closest('.form-group') || lbl.parentElement;
          const inp = parent?.querySelector('input');
          if (inp) {
            const rect = inp.getBoundingClientRect();
            return { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (typeField) {
      await page.mouse.click(typeField.x, typeField.y);
      await page.waitForTimeout(500);
      await page.keyboard.type(tmpl.type);
      await page.waitForTimeout(1000);
      // Click on the dropdown option
      const option = await page.evaluate((typeName) => {
        const items = document.querySelectorAll('[class*="option"], [class*="item"], li, div');
        for (const item of items) {
          if (item.offsetParent === null) continue;
          const text = item.textContent?.trim() || '';
          if (text === typeName) {
            const rect = item.getBoundingClientRect();
            if (rect.height > 0 && rect.height < 50) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
        return null;
      }, tmpl.type);
      if (option) {
        await page.mouse.click(option.x, option.y);
        console.log(`  Type: ${tmpl.type}`);
      } else {
        console.log(`  Type niet gevonden in dropdown`);
      }
      await page.waitForTimeout(500);
    }

    // 3. Update description
    const descArea = page.locator('textarea').first();
    if (await descArea.isVisible()) {
      await descArea.click({ clickCount: 3 });
      await page.waitForTimeout(200);
      await descArea.fill(tmpl.description);
      console.log(`  Beschrijving: ${tmpl.description}`);
    }

    // 4. Update duration
    const hourInput = page.locator('input[name="template[scheduled_duration][]"]').first();
    if (await hourInput.isVisible()) {
      await hourInput.click({ clickCount: 3 });
      await hourInput.fill(tmpl.hours);
      // Minutes is next input with same name
      const minInput = page.locator('input[name="template[scheduled_duration][]"]').nth(1);
      if (await minInput.isVisible()) {
        await minInput.click({ clickCount: 3 });
        await minInput.fill(tmpl.minutes);
      }
      console.log(`  Duur: ${tmpl.hours}u ${tmpl.minutes}min`);
    }

    // 5. Save
    await page.waitForTimeout(500);
    const saveBtn = page.locator('button:has-text("Opslaan")');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      console.log(`  Opgeslagen!`);
      await page.waitForTimeout(3000);
    }

    // Check if we got redirected back to list (save success) or still on edit page
    const currentUrl = page.url();
    console.log(`  URL na save: ${currentUrl}`);
  }

  // Verify: go to templates list
  await page.goto('https://sonty.planadoapp.com/admin/templates', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const finalTemplates = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) {
        const link = cells[0]?.querySelector('a');
        rows.push({ name: link?.textContent?.trim() || cells[0].textContent?.trim(), duration: cells[1]?.textContent?.trim() });
      }
    });
    return rows;
  });
  console.log('\nDefinitieve sjablonen:');
  finalTemplates.forEach(t => console.log(`  ${t.name} (${t.duration})`));
  await ss(page, 'PLREN2-final');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
