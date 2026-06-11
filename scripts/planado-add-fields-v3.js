const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // Login
  console.log('Logging in...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  // Helper: add a field (works for both opdracht and rapport)
  async function addField(buttonText, typeClass, fieldName) {
    // Scroll the button into view and click
    const btn = page.locator(`text="${buttonText}"`).first();
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await btn.click();
    await page.waitForTimeout(700);

    // Take screenshot of dropdown for debugging first field
    // Now click the type option - find the VISIBLE dropdown menu
    // Multiple dropdowns exist, pick the one currently visible
    const visibleDropdowns = await page.$$('.dropdown-menu');
    let clicked = false;
    for (const dd of visibleDropdowns) {
      const isVisible = await dd.isVisible();
      if (!isVisible) continue;

      const options = await dd.$$(`a[class*="${typeClass}"]`);
      if (options.length > 0) {
        await options[0].click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Fallback: just click any matching visible element
      const allOptions = await page.$$(`.dropdown-menu:visible a[class*="${typeClass}"]`);
      if (allOptions.length > 0) {
        await allOptions[allOptions.length - 1].click();
        clicked = true;
      }
    }

    if (!clicked) {
      console.log(`  ❌ Could not click type "${typeClass}" for "${fieldName}"`);
      // Close dropdown
      await page.keyboard.press('Escape');
      return false;
    }

    await page.waitForTimeout(600);

    // Find and fill the newest empty input
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

    // For signature/handtekening fields, there may not be a text input
    // Check if the field count increased
    console.log(`  ⚠️ No empty input for "${fieldName}" (may be a non-text type like signature)`);
    return true;
  }

  // ========================================
  // INMEET AFSPRAAK
  // ========================================
  console.log('\n=== INMEET AFSPRAAK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Inmeet afspraak")');
  await page.waitForTimeout(3000);

  // Add Opdrachtvelden
  console.log('\nOpdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden voor monteur');

  // Add Rapportvelden
  console.log('\nRapportvelden:');
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
  await addField('Rapportveld toevoegen', 'signature-', 'Handtekening klant');

  // Update description
  const desc = await page.$('textarea');
  if (desc) {
    await desc.scrollIntoViewIfNeeded();
    await desc.fill('Inmeetafspraak bij klant: situatie opnemen, metingen uitvoeren, monsters tonen en offerte bespreken. Vul alle meetgegevens en foto\'s zo volledig mogelijk in voor het montage team.');
    console.log('Description updated');
  }

  // Save
  const saveBtn = page.locator('button:has-text("Opslaan")');
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await page.waitForTimeout(3000);
  console.log('✅ INMEET AFSPRAAK SAVED');
  await page.screenshot({ path: '/tmp/inmeet-v3-saved.png', fullPage: true });

  // ========================================
  // MONTAGE AFSPRAAK PARTICULIER
  // ========================================
  console.log('\n\n=== MONTAGE AFSPRAAK PARTICULIER ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak particulier")');
  await page.waitForTimeout(3000);

  // Delete existing English fields
  let delCount = 0;
  while (delCount < 20) {
    const btns = await page.$$('.rf-delete');
    if (btns.length === 0) break;
    try {
      await btns[0].scrollIntoViewIfNeeded();
      await btns[0].click();
      await page.waitForTimeout(500);
    } catch(e) { break; }
    delCount++;
  }
  console.log(`Deleted ${delCount} existing fields`);

  // Add Opdrachtvelden
  console.log('\nOpdrachtvelden:');
  await addField('Opdrachtveld toevoegen', 'input-', 'Product type');
  await addField('Opdrachtveld toevoegen', 'input-', 'Meetgegevens (van inmeet)');
  await addField('Opdrachtveld toevoegen', 'input-', 'Bijzonderheden');

  // Add Rapportvelden
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
  await addField('Rapportveld toevoegen', 'signature-', 'Handtekening klant');

  const montageDesc = await page.$('textarea');
  if (montageDesc) {
    await montageDesc.scrollIntoViewIfNeeded();
    await montageDesc.fill('Montage bij particuliere klant. Maak voor- en na foto\'s, test het product, laat de klant tekenen. Interne opmerkingen apart noteren.');
  }

  const montageSave = page.locator('button:has-text("Opslaan")');
  await montageSave.scrollIntoViewIfNeeded();
  await montageSave.click();
  await page.waitForTimeout(3000);
  console.log('✅ MONTAGE PARTICULIER SAVED');
  await page.screenshot({ path: '/tmp/montage-part-v3-saved.png', fullPage: true });

  // ========================================
  // MONTAGE AFSPRAAK ZAKELIJK
  // ========================================
  console.log('\n\n=== MONTAGE AFSPRAAK ZAKELIJK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak zakelijk")');
  await page.waitForTimeout(3000);

  // Delete existing
  delCount = 0;
  while (delCount < 20) {
    const btns = await page.$$('.rf-delete');
    if (btns.length === 0) break;
    try {
      await btns[0].scrollIntoViewIfNeeded();
      await btns[0].click();
      await page.waitForTimeout(500);
    } catch(e) { break; }
    delCount++;
  }
  console.log(`Deleted ${delCount} existing fields`);

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
  await addField('Rapportveld toevoegen', 'signature-', 'Handtekening opdrachtgever');

  const zakDesc = await page.$('textarea');
  if (zakDesc) {
    await zakDesc.scrollIntoViewIfNeeded();
    await zakDesc.fill('Montage bij zakelijke klant. Maak voor- en na foto\'s, noteer contactpersoon. Laat opdrachtgever tekenen.');
  }

  const zakSave = page.locator('button:has-text("Opslaan")');
  await zakSave.scrollIntoViewIfNeeded();
  await zakSave.click();
  await page.waitForTimeout(3000);
  console.log('✅ MONTAGE ZAKELIJK SAVED');
  await page.screenshot({ path: '/tmp/montage-zak-v3-saved.png', fullPage: true });

  await browser.close();
  console.log('\n=== ALL 3 TEMPLATES DONE ===');
})().catch(err => console.error('Error:', err.message));
