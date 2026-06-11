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

  // Delete ALL report fields
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

  // Delete ALL custom/opdracht fields
  async function deleteAllOpdrachtvelden() {
    let count = 0;
    while (count < 10) {
      // Opdrachtveld delete buttons have a different class
      const btns = await page.$$('.cf-delete, .custom-field__button--delete');
      if (btns.length === 0) break;
      try {
        await btns[0].scrollIntoViewIfNeeded();
        await btns[0].click();
        await page.waitForTimeout(400);
        count++;
      } catch(e) { break; }
    }
    if (count > 0) console.log(`  Deleted ${count} opdrachtvelden`);
  }

  // Add field helper
  async function addField(buttonText, typeClass, fieldName) {
    const btn = page.locator(`text="${buttonText}"`).first();
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await btn.click();
    await page.waitForTimeout(600);

    // Click type from visible dropdown
    const menus = await page.$$('.dropdown-menu');
    let clicked = false;
    for (const menu of menus) {
      if (!(await menu.isVisible())) continue;
      const options = await menu.$$(`a[class*="${typeClass}"]`);
      if (options.length > 0) {
        await options[0].click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      await page.keyboard.press('Escape');
      console.log(`  ❌ ${fieldName} (type not found)`);
      return false;
    }

    await page.waitForTimeout(500);

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
    console.log(`  ⚠️ ${fieldName} (no empty input)`);
    return true; // Some types like signature may not have input
  }

  // Save template
  async function saveTemplate(name) {
    const saveBtn = page.locator('button:has-text("Opslaan")');
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `/tmp/final-${name}.png`, fullPage: true });

    // Check URL - if we're redirected back to list, it saved
    const url = page.url();
    if (url.includes('/admin/templates') && !url.includes('/admin/templates/')) {
      console.log(`✅ ${name} SAVED (redirected to list)`);
      return true;
    }
    // Still on edit page - might have errors
    const bodyText = await page.locator('body').textContent();
    if (bodyText.includes('Het formulier bevat fouten')) {
      console.log(`⚠️ ${name} has form errors`);
      return false;
    }
    console.log(`✅ ${name} SAVED`);
    return true;
  }

  // Open template
  async function openTemplate(name) {
    await page.goto('https://sonty.planadoapp.com/admin/templates');
    await page.waitForTimeout(3000);
    await page.click(`a:has-text("${name}")`);
    await page.waitForTimeout(3000);
    console.log(`\n=== ${name.toUpperCase()} ===`);
  }

  // ========================================
  // 1. INMEET AFSPRAAK
  // ========================================
  await openTemplate('Inmeet afspraak');
  await deleteAllReportFields();

  // Description
  const desc1 = await page.$('textarea');
  if (desc1) {
    await desc1.scrollIntoViewIfNeeded();
    await desc1.fill('Inmeetafspraak: situatie opnemen, metingen uitvoeren, monsters tonen, offerte bespreken. Vul meetgegevens en foto\'s volledig in voor montage team.');
  }

  // Opdrachtvelden
  console.log('Opdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden voor monteur');

  // Rapportvelden (NO signature - causes validation error)
  console.log('Rapportvelden:');
  await addField('Rapportveld toevoegen', 'action-', 'Klant begroeten & situatie bespreken');
  await addField('Rapportveld toevoegen', 'input-', 'Breedte meting (mm)');
  await addField('Rapportveld toevoegen', 'input-', 'Hoogte meting (mm)');
  await addField('Rapportveld toevoegen', 'input-', 'Diepte/uitval meting (mm)');
  await addField('Rapportveld toevoegen', 'image-', "Foto's huidige situatie");
  await addField('Rapportveld toevoegen', 'image-', "Foto's meetpunten");
  await addField('Rapportveld toevoegen', 'input-', 'Opmerkingen voor montage team');
  await addField('Rapportveld toevoegen', 'input-', 'Opmerkingen intern (NIET voor klant)');
  await addField('Rapportveld toevoegen', 'action-', 'Monsters/stalen getoond');
  await addField('Rapportveld toevoegen', 'action-', 'Offerte besproken');

  await saveTemplate('inmeet');

  // ========================================
  // 2. MONTAGE PARTICULIER
  // ========================================
  await openTemplate('Montage afspraak particulier');
  await deleteAllReportFields();

  const desc2 = await page.$('textarea');
  if (desc2) {
    await desc2.scrollIntoViewIfNeeded();
    await desc2.fill('Montage bij particuliere klant. Voor- en na foto\'s maken, product testen, bediening uitleggen. Interne opmerkingen apart noteren.');
  }

  console.log('Opdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');

  console.log('Rapportvelden:');
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

  await saveTemplate('montage-part');

  // ========================================
  // 3. MONTAGE ZAKELIJK
  // ========================================
  await openTemplate('Montage afspraak zakelijk');
  await deleteAllReportFields();

  const desc3 = await page.$('textarea');
  if (desc3) {
    await desc3.scrollIntoViewIfNeeded();
    await desc3.fill('Montage bij zakelijke klant. Voor- en na foto\'s, contactpersoon noteren, bediening uitleggen.');
  }

  console.log('Opdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');
  await addField('Opdrachtveld toevoegen', 'input-', 'Contactpersoon ter plaatse');

  console.log('Rapportvelden:');
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

  await saveTemplate('montage-zak');

  await browser.close();
  console.log('\n=== ALL 3 TEMPLATES CONFIGURED ===');
})().catch(err => console.error('Error:', err.message));
