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

  // This is the approach that WORKED for Inmeet:
  async function deleteAllReportFields() {
    let count = 0;
    while (count < 25) {
      const btns = await page.$$('.rf-delete');
      if (btns.length === 0) break;
      try {
        await btns[0].scrollIntoViewIfNeeded();
        await btns[0].click();
        await page.waitForTimeout(400);
        count++;
      } catch(e) { break; }
    }
    console.log(`  Deleted ${count} report fields`);
  }

  // This is the approach that WORKED for Inmeet:
  async function addField(buttonText, typeClass, fieldName) {
    try {
      // Close any open dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Use page.evaluate to find and click the button (works reliably)
      const btnClicked = await page.evaluate((btnText) => {
        const btns = document.querySelectorAll('.custom-fields__btn');
        for (const btn of btns) {
          if (btn.textContent.includes(btnText) && btn.offsetWidth > 0) {
            btn.scrollIntoView({ block: 'center' });
            btn.click();
            return true;
          }
        }
        return false;
      }, buttonText);

      if (!btnClicked) {
        console.log(`  ❌ ${fieldName} (button not found)`);
        return false;
      }
      await page.waitForTimeout(700);

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
        await page.keyboard.press('Escape');
        console.log(`  ❌ ${fieldName} (type not found)`);
        return false;
      }
      await page.waitForTimeout(600);

      // Fill last empty input using Playwright (not evaluate, for React compat)
      const inputs = await page.$$('input[type="text"]');
      for (let i = inputs.length - 1; i >= 0; i--) {
        try {
          const value = await inputs[i].inputValue();
          if (!value || value === '') {
            await inputs[i].scrollIntoViewIfNeeded();
            await inputs[i].fill(fieldName);
            console.log(`  ✅ ${fieldName}`);
            return true;
          }
        } catch(e) { continue; }
      }
      console.log(`  ⚠️ ${fieldName} (no empty input)`);
      return true;
    } catch(e) {
      console.log(`  ❌ ${fieldName} (${e.message?.substring(0, 50)})`);
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

  // Step 1: Delete ALL report fields (the working approach)
  await deleteAllReportFields();

  // Step 2: Also delete any custom fields from previous attempts
  let cfCount = 0;
  while (cfCount < 10) {
    const cfBtns = await page.$$('.cf-delete');
    if (cfBtns.length === 0) break;
    try {
      await cfBtns[0].scrollIntoViewIfNeeded();
      await cfBtns[0].click();
      await page.waitForTimeout(400);
      cfCount++;
    } catch(e) { break; }
  }
  if (cfCount > 0) console.log(`  Deleted ${cfCount} custom fields`);

  // Step 3: Update description
  const desc = await page.$('textarea');
  if (desc) {
    await desc.scrollIntoViewIfNeeded();
    await desc.fill('Montage bij particuliere klant. Voor- en na foto\'s, product testen, bediening uitleggen.');
  }

  // Step 4: Add opdrachtvelden
  console.log('\nOpdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');

  // Step 5: Add rapportvelden
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

  // Step 6: Save
  const saveBtn = page.locator('button:has-text("Opslaan")');
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-part-v2-saved.png', fullPage: true });
  console.log('✅ MONTAGE PARTICULIER DONE');

  // ========================================
  // MONTAGE ZAKELIJK
  // ========================================
  console.log('\n\n=== MONTAGE AFSPRAAK ZAKELIJK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak zakelijk")');
  await page.waitForTimeout(3000);

  await deleteAllReportFields();

  cfCount = 0;
  while (cfCount < 10) {
    const cfBtns = await page.$$('.cf-delete');
    if (cfBtns.length === 0) break;
    try {
      await cfBtns[0].scrollIntoViewIfNeeded();
      await cfBtns[0].click();
      await page.waitForTimeout(400);
      cfCount++;
    } catch(e) { break; }
  }
  if (cfCount > 0) console.log(`  Deleted ${cfCount} custom fields`);

  const desc2 = await page.$('textarea');
  if (desc2) {
    await desc2.scrollIntoViewIfNeeded();
    await desc2.fill('Montage bij zakelijke klant. Voor- en na foto\'s, contactpersoon noteren, bediening uitleggen.');
  }

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

  const saveBtn2 = page.locator('button:has-text("Opslaan")');
  await saveBtn2.scrollIntoViewIfNeeded();
  await saveBtn2.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-zak-v2-saved.png', fullPage: true });
  console.log('✅ MONTAGE ZAKELIJK DONE');

  await browser.close();
  console.log('\n=== ALL DONE ===');
})().catch(err => console.error('Error:', err.message));
