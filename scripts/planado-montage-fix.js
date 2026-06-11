const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  console.log('Logging in...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  async function addField(page, buttonText, typeClass, fieldName) {
    // Close any open dropdowns first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Scroll to and click the button
    const buttons = await page.$$('button');
    let targetBtn = null;
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text?.trim().includes(buttonText.replace('+ ', ''))) {
        const box = await btn.boundingBox();
        if (box && box.width > 0) {
          targetBtn = btn;
          break;
        }
      }
    }

    if (!targetBtn) {
      console.log(`  ❌ ${fieldName} (button "${buttonText}" not found)`);
      return false;
    }

    await targetBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await targetBtn.click();
    await page.waitForTimeout(800);

    // Find visible dropdown and click type
    const allLinks = await page.$$('.dropdown-menu a');
    let clicked = false;
    for (const link of allLinks) {
      try {
        const isVis = await link.isVisible();
        if (!isVis) continue;
        const cls = await link.getAttribute('class');
        if (cls && cls.includes(typeClass)) {
          await link.click();
          clicked = true;
          break;
        }
      } catch(e) { continue; }
    }

    if (!clicked) {
      await page.keyboard.press('Escape');
      console.log(`  ❌ ${fieldName} (type "${typeClass}" not found in dropdown)`);
      return false;
    }

    await page.waitForTimeout(600);

    // Fill last empty input
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
    console.log(`  ⚠️ ${fieldName} (added but no input to fill)`);
    return true;
  }

  // ========================================
  // MONTAGE PARTICULIER
  // ========================================
  console.log('\n=== MONTAGE AFSPRAAK PARTICULIER ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak particulier")');
  await page.waitForTimeout(3000);

  // Check current state
  const fields1 = await page.$$eval('input[type="text"]', els => els.map(e => e.value).filter(v => v));
  console.log('Current fields:', fields1);
  await page.screenshot({ path: '/tmp/montage-part-state.png', fullPage: true });

  // Delete ALL report fields
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
  console.log(`Deleted ${count} report fields`);

  // Also delete any existing opdrachtvelden (from previous attempts)
  // Look for the settings gear + delete buttons in the Aangepaste velden section
  const cfDeleteBtns = await page.$$('.cf-delete');
  for (const btn of cfDeleteBtns) {
    try { await btn.click(); await page.waitForTimeout(300); } catch(e) {}
  }

  // Update description
  const desc = await page.$('textarea');
  if (desc) {
    await desc.scrollIntoViewIfNeeded();
    await desc.fill('Montage bij particuliere klant. Voor- en na foto\'s, product testen, bediening uitleggen.');
  }

  // Add opdrachtvelden
  console.log('\nOpdrachtvelden:');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');

  // Add rapportvelden
  console.log('\nRapportvelden:');
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Werkplek voorbereid & beschermd');
  await addField(page, 'Rapportveld toevoegen', 'image-', "Foto's VOOR montage");
  await addField(page, 'Rapportveld toevoegen', 'image-', "Foto's NA montage");
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Product getest & werkend');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Gebruikte materialen');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Nabestellingen nodig');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Opmerkingen voor klant');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Opmerkingen intern (NIET voor klant)');
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Werkplek opgeruimd');
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Bediening uitgelegd aan klant');

  // Save
  await page.screenshot({ path: '/tmp/montage-part-before-save.png', fullPage: true });
  const saveBtn1 = await page.$('button:has-text("Opslaan")');
  await saveBtn1.scrollIntoViewIfNeeded();
  await saveBtn1.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-part-after-save.png', fullPage: true });
  console.log('✅ MONTAGE PARTICULIER SAVED');

  // ========================================
  // MONTAGE ZAKELIJK
  // ========================================
  console.log('\n\n=== MONTAGE AFSPRAAK ZAKELIJK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak zakelijk")');
  await page.waitForTimeout(3000);

  const fields2 = await page.$$eval('input[type="text"]', els => els.map(e => e.value).filter(v => v));
  console.log('Current fields:', fields2);

  // Delete ALL report fields
  count = 0;
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
  console.log(`Deleted ${count} report fields`);

  const cfDel2 = await page.$$('.cf-delete');
  for (const btn of cfDel2) {
    try { await btn.click(); await page.waitForTimeout(300); } catch(e) {}
  }

  const desc2 = await page.$('textarea');
  if (desc2) {
    await desc2.scrollIntoViewIfNeeded();
    await desc2.fill('Montage bij zakelijke klant. Voor- en na foto\'s, contactpersoon noteren, bediening uitleggen.');
  }

  console.log('\nOpdrachtvelden:');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');
  await addField(page, 'Opdrachtveld toevoegen', 'input-', 'Contactpersoon ter plaatse');

  console.log('\nRapportvelden:');
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Werkplek voorbereid & beschermd');
  await addField(page, 'Rapportveld toevoegen', 'image-', "Foto's VOOR montage");
  await addField(page, 'Rapportveld toevoegen', 'image-', "Foto's NA montage");
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Product getest & werkend');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Gebruikte materialen');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Nabestellingen nodig');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Opmerkingen voor opdrachtgever');
  await addField(page, 'Rapportveld toevoegen', 'input-', 'Opmerkingen intern (NIET voor klant)');
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Werkplek opgeruimd');
  await addField(page, 'Rapportveld toevoegen', 'action-', 'Bediening uitgelegd');

  const saveBtn2 = await page.$('button:has-text("Opslaan")');
  await saveBtn2.scrollIntoViewIfNeeded();
  await saveBtn2.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-zak-after-save.png', fullPage: true });
  console.log('✅ MONTAGE ZAKELIJK SAVED');

  await browser.close();
  console.log('\n=== BOTH MONTAGE TEMPLATES DONE ===');
})().catch(err => console.error('Error:', err.message));
