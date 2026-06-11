const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  console.log('Logging in...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  async function addField(btnSelector, typeClass, fieldName) {
    try {
      // Close any open dropdown first
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Find and click the button using evaluate to handle complex matching
      const clicked = await page.evaluate((sel) => {
        const btns = document.querySelectorAll('.custom-fields__btn, button');
        for (const btn of btns) {
          if (btn.textContent.includes(sel) && btn.offsetWidth > 0) {
            btn.scrollIntoView({ block: 'center' });
            btn.click();
            return true;
          }
        }
        return false;
      }, btnSelector);

      if (!clicked) {
        console.log(`  ❌ ${fieldName} (button "${btnSelector}" not found)`);
        return false;
      }

      await page.waitForTimeout(600);

      // Click type option from visible dropdown
      const typeClicked = await page.evaluate((tc) => {
        const links = document.querySelectorAll('.dropdown-menu a');
        for (const link of links) {
          if (link.offsetWidth > 0 && link.className.includes(tc)) {
            link.click();
            return true;
          }
        }
        return false;
      }, typeClass);

      if (!typeClicked) {
        console.log(`  ❌ ${fieldName} (type "${typeClass}" not found)`);
        await page.keyboard.press('Escape');
        return false;
      }

      await page.waitForTimeout(600);

      // Fill last empty text input
      const filled = await page.evaluate((name) => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        for (let i = inputs.length - 1; i >= 0; i--) {
          if (inputs[i].offsetWidth > 0 && (!inputs[i].value || inputs[i].value === '')) {
            // Use React's native input value setter
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(inputs[i], name);
            inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, fieldName);

      if (filled) {
        console.log(`  ✅ ${fieldName}`);
      } else {
        console.log(`  ⚠️ ${fieldName} (no empty input)`);
      }
      return true;
    } catch(e) {
      console.log(`  ❌ ${fieldName} (error: ${e.message?.substring(0, 60)})`);
      return false;
    }
  }

  // ========================================
  // MONTAGE PARTICULIER
  // ========================================
  console.log('\n=== MONTAGE AFSPRAAK PARTICULIER ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak particulier")');
  await page.waitForTimeout(3000);

  // Delete ALL report fields using evaluate
  const delCount = await page.evaluate(() => {
    let count = 0;
    const maxRetries = 25;
    for (let i = 0; i < maxRetries; i++) {
      const btn = document.querySelector('.rf-delete');
      if (!btn) break;
      btn.click();
      count++;
    }
    return count;
  });
  // Wait for React to update
  await page.waitForTimeout(1000);
  console.log(`Deleted ${delCount} report fields`);

  // Update description
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, 'Montage bij particuliere klant. Voor- en na foto\'s, product testen, bediening uitleggen.');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Add fields
  console.log('\nOpdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');

  console.log('\nRapportvelden:');
  await addField('Rapportveld toevoegen', 'action-', 'Werkplek voorbereid & beschermd');
  await addField('Rapportveld toevoegen', 'image-', "Foto's VOOR montage");
  await addField('Rapportveld toevoegen', 'image-', "Foto's NA montage");
  await addField('Rapportveld toevoegen', 'action-', 'Product getest & werkend');
  await addField('Rapportveld toevoegen', 'input-', 'Gebruikte materialen');
  await addField('Rapportveld toevoegen', 'input-', 'Nabestellingen nodig');
  await addField('Rapportveld toevoegen', 'input-', 'Opmerkingen voor klant');
  await addField('Rapportveld toevoegen', 'input-', 'Opmerkingen intern (NIET voor klant)');
  await addField('Rapportveld toevoegen', 'action-', 'Werkplek opgeruimd');
  await addField('Rapportveld toevoegen', 'action-', 'Bediening uitgelegd aan klant');

  await page.screenshot({ path: '/tmp/montage-part-final.png', fullPage: true });

  // Save
  await page.evaluate(() => {
    const btn = document.querySelector('button.btn-primary');
    if (btn) { btn.scrollIntoView(); btn.click(); }
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-part-saved-final.png', fullPage: true });
  console.log('✅ MONTAGE PARTICULIER attempt done');

  // ========================================
  // MONTAGE ZAKELIJK
  // ========================================
  console.log('\n\n=== MONTAGE AFSPRAAK ZAKELIJK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak zakelijk")');
  await page.waitForTimeout(3000);

  // Delete report fields
  const delCount2 = await page.evaluate(() => {
    let count = 0;
    for (let i = 0; i < 25; i++) {
      const btn = document.querySelector('.rf-delete');
      if (!btn) break;
      btn.click();
      count++;
    }
    return count;
  });
  await page.waitForTimeout(1000);
  console.log(`Deleted ${delCount2} report fields`);

  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, 'Montage bij zakelijke klant. Voor- en na foto\'s, contactpersoon noteren, bediening uitleggen.');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  console.log('\nOpdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');
  await addField('Opdrachtveld toevoegen', 'input-', 'Contactpersoon ter plaatse');

  console.log('\nRapportvelden:');
  await addField('Rapportveld toevoegen', 'action-', 'Werkplek voorbereid & beschermd');
  await addField('Rapportveld toevoegen', 'image-', "Foto's VOOR montage");
  await addField('Rapportveld toevoegen', 'image-', "Foto's NA montage");
  await addField('Rapportveld toevoegen', 'action-', 'Product getest & werkend');
  await addField('Rapportveld toevoegen', 'input-', 'Gebruikte materialen');
  await addField('Rapportveld toevoegen', 'input-', 'Nabestellingen nodig');
  await addField('Rapportveld toevoegen', 'input-', 'Opmerkingen voor opdrachtgever');
  await addField('Rapportveld toevoegen', 'input-', 'Opmerkingen intern (NIET voor klant)');
  await addField('Rapportveld toevoegen', 'action-', 'Werkplek opgeruimd');
  await addField('Rapportveld toevoegen', 'action-', 'Bediening uitgelegd');

  await page.evaluate(() => {
    const btn = document.querySelector('button.btn-primary');
    if (btn) { btn.scrollIntoView(); btn.click(); }
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-zak-saved-final.png', fullPage: true });
  console.log('✅ MONTAGE ZAKELIJK attempt done');

  await browser.close();
  console.log('\n=== BOTH MONTAGE TEMPLATES DONE ===');
})().catch(err => console.error('Error:', err.message));
