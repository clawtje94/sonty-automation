const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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

  // Helper: add a report field
  async function addReportField(typeClassName, fieldName) {
    // Click the "Rapportveld toevoegen" button
    await page.click('.custom-fields__btn:has-text("Rapportveld toevoegen")');
    await page.waitForTimeout(500);

    // Click the specific type by its unique className
    // Each dropdown option has a unique class like "input-xxx" for Tekst, "image-xxx" for Foto, etc.
    // Use partial class match since classes have random suffixes like input-oDhTq_f6hYz5Rwck3JsC
    const cssSelector = `.dropdown-menu a[class*="${typeClassName}"]`;
    await page.click(cssSelector);
    await page.waitForTimeout(800);

    // Find the last input field and fill it
    const inputs = await page.$$('input[type="text"]');
    for (let i = inputs.length - 1; i >= 0; i--) {
      const value = await inputs[i].inputValue();
      const box = await inputs[i].boundingBox();
      if (box && box.y > 400 && (!value || value === '')) {
        await inputs[i].fill(fieldName);
        console.log(`  ✅ ${fieldName}`);
        return true;
      }
    }
    console.log(`  ❌ Could not fill: ${fieldName}`);
    return false;
  }

  // Helper: add a custom/opdracht field
  async function addOpdrachtveld(typeClassName, fieldName) {
    await page.click('.custom-fields__btn:has-text("Opdrachtveld toevoegen")');
    await page.waitForTimeout(500);
    const cssSelector = `.dropdown-menu a[class*="${typeClassName}"]`;
    await page.click(cssSelector);
    await page.waitForTimeout(800);

    const inputs = await page.$$('input[type="text"]');
    for (let i = inputs.length - 1; i >= 0; i--) {
      const value = await inputs[i].inputValue();
      const box = await inputs[i].boundingBox();
      if (box && (!value || value === '')) {
        await inputs[i].fill(fieldName);
        console.log(`  ✅ [opdracht] ${fieldName}`);
        return true;
      }
    }
    console.log(`  ❌ Could not fill opdrachtveld: ${fieldName}`);
    return false;
  }

  // CSS class prefixes from the dropdown:
  // Tekst = input-   (for text field)
  // Foto = image-    (for photo)
  // Ja/Nee = checkbox- (for yes/no)
  // Actie = action-   (for task/action)
  // Handtekening = signature-
  // Nummer = decimal-
  // Geheel getal = integer-
  // Keuzelijst = dictionary-

  // ========================================
  // INMEET AFSPRAAK
  // ========================================
  console.log('\n=== INMEET AFSPRAAK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Inmeet afspraak")');
  await page.waitForTimeout(3000);

  // Add Opdrachtvelden (job fields - visible before job starts)
  console.log('\nOpdrachtvelden:');
  await addOpdrachtveld('input-', 'Product type');
  await addOpdrachtveld('input-', 'Bijzonderheden voor monteur');

  // Add Rapportvelden (report fields - filled during/after job)
  console.log('\nRapportvelden:');
  const inmeetFields = [
    ['action-', 'Klant begroeten & situatie bespreken'],
    ['input-', 'Breedte meting (mm)'],
    ['input-', 'Hoogte meting (mm)'],
    ['input-', 'Diepte/uitval meting (mm)'],
    ['image-', "Foto's huidige situatie"],
    ['image-', "Foto's meetpunten"],
    ['input-', 'Opmerkingen voor montage team'],
    ['input-', 'Opmerkingen intern (NIET voor klant)'],
    ['action-', 'Monsters/stalen getoond'],
    ['action-', 'Offerte besproken'],
    ['signature-', 'Handtekening klant'],
  ];

  for (const [type, name] of inmeetFields) {
    await addReportField(type, name);
    await page.waitForTimeout(200);
  }

  // Update description
  const desc = await page.$('textarea');
  if (desc) {
    await desc.fill('Inmeetafspraak bij klant: situatie opnemen, metingen uitvoeren, monsters tonen en offerte bespreken. Vul alle meetgegevens en foto\'s zo volledig mogelijk in voor het montage team.');
    console.log('Description updated');
  }

  // Save
  await page.click('button:has-text("Opslaan")');
  await page.waitForTimeout(3000);
  console.log('✅ INMEET AFSPRAAK SAVED');
  await page.screenshot({ path: '/tmp/inmeet-v2-saved.png', fullPage: true });

  // ========================================
  // MONTAGE AFSPRAAK PARTICULIER
  // ========================================
  console.log('\n\n=== MONTAGE AFSPRAAK PARTICULIER ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak particulier")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/montage-part-before.png', fullPage: true });

  // Delete existing English fields
  let delCount = 0;
  while (delCount < 20) {
    const btns = await page.$$('.rf-delete');
    if (btns.length === 0) break;
    try {
      await btns[0].click();
      await page.waitForTimeout(300);
      const confirm = await page.$('.modal button, button.btn-danger');
      if (confirm) { try { await confirm.click(); } catch(e) {} }
      await page.waitForTimeout(300);
      delCount++;
    } catch(e) { break; }
  }
  console.log(`Deleted ${delCount} existing fields`);

  // Add opdrachtvelden
  console.log('\nOpdrachtvelden:');
  await addOpdrachtveld('input-', 'Product type');
  await addOpdrachtveld('input-', 'Meetgegevens (van inmeet)');
  await addOpdrachtveld('input-', 'Bijzonderheden');

  // Add rapportvelden
  console.log('\nRapportvelden:');
  const montageFields = [
    ['action-', 'Werkplek voorbereid & beschermd'],
    ['image-', "Foto's VOOR montage"],
    ['image-', "Foto's NA montage"],
    ['action-', 'Product getest & werkend'],
    ['input-', 'Gebruikte materialen'],
    ['input-', 'Nabestellingen nodig'],
    ['input-', 'Opmerkingen voor klant'],
    ['input-', 'Opmerkingen intern (NIET voor klant)'],
    ['action-', 'Werkplek opgeruimd'],
    ['action-', 'Bediening uitgelegd aan klant'],
    ['signature-', 'Handtekening klant'],
  ];

  for (const [type, name] of montageFields) {
    await addReportField(type, name);
    await page.waitForTimeout(200);
  }

  // Update description
  const montageDesc = await page.$('textarea');
  if (montageDesc) {
    await montageDesc.fill('Montage bij particuliere klant. Maak voor- en na foto\'s, test het product, laat de klant tekenen. Interne opmerkingen apart noteren.');
  }

  await page.click('button:has-text("Opslaan")');
  await page.waitForTimeout(3000);
  console.log('✅ MONTAGE PARTICULIER SAVED');
  await page.screenshot({ path: '/tmp/montage-part-saved.png', fullPage: true });

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
      await btns[0].click();
      await page.waitForTimeout(300);
      const confirm = await page.$('.modal button, button.btn-danger');
      if (confirm) { try { await confirm.click(); } catch(e) {} }
      await page.waitForTimeout(300);
      delCount++;
    } catch(e) { break; }
  }
  console.log(`Deleted ${delCount} existing fields`);

  // Add opdrachtvelden
  console.log('\nOpdrachtvelden:');
  await addOpdrachtveld('input-', 'Product type');
  await addOpdrachtveld('input-', 'Meetgegevens (van inmeet)');
  await addOpdrachtveld('input-', 'Bijzonderheden');
  await addOpdrachtveld('input-', 'Contactpersoon ter plaatse');

  // Add rapportvelden
  console.log('\nRapportvelden:');
  const zakelijkFields = [
    ['action-', 'Werkplek voorbereid & beschermd'],
    ['image-', "Foto's VOOR montage"],
    ['image-', "Foto's NA montage"],
    ['action-', 'Product getest & werkend'],
    ['input-', 'Gebruikte materialen'],
    ['input-', 'Nabestellingen nodig'],
    ['input-', 'Opmerkingen voor opdrachtgever'],
    ['input-', 'Opmerkingen intern (NIET voor klant)'],
    ['action-', 'Werkplek opgeruimd'],
    ['action-', 'Bediening uitgelegd'],
    ['signature-', 'Handtekening opdrachtgever'],
  ];

  for (const [type, name] of zakelijkFields) {
    await addReportField(type, name);
    await page.waitForTimeout(200);
  }

  const zakDesc = await page.$('textarea');
  if (zakDesc) {
    await zakDesc.fill('Montage bij zakelijke klant. Maak voor- en na foto\'s, noteer contactpersoon. Laat opdrachtgever tekenen.');
  }

  await page.click('button:has-text("Opslaan")');
  await page.waitForTimeout(3000);
  console.log('✅ MONTAGE ZAKELIJK SAVED');
  await page.screenshot({ path: '/tmp/montage-zak-saved.png', fullPage: true });

  await browser.close();
  console.log('\n=== ALL 3 TEMPLATES DONE ===');
})().catch(err => console.error('Error:', err.message));
