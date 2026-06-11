const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  console.log('Logging in to Planado...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  // Go to Inmeet template
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Inmeet afspraak")');
  await page.waitForTimeout(3000);
  console.log('Opened Inmeet template');

  // First, explore the dropdown to understand the field types
  console.log('\n=== Exploring Rapportveld dropdown ===');

  // Click the dropdown button
  const addBtn = await page.$('.custom-fields__btn:has-text("Rapportveld toevoegen")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/inmeet-dropdown-open.png', fullPage: true });

    // Get dropdown items
    const dropdownItems = await page.$$eval('.dropdown-menu a, .dropdown-menu li, .dropdown-menu button, ul.dropdown-menu li a', els =>
      els.map(e => ({
        text: e.textContent?.trim(),
        href: e.href || '',
        tag: e.tagName,
        className: e.className?.substring(0, 60)
      })).filter(e => e.text)
    );
    console.log('Dropdown options:', JSON.stringify(dropdownItems, null, 2));

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Helper function: add a single report field
  async function addReportField(typeText, fieldName) {
    // Count fields before
    const fieldsBefore = await page.$$('.rf-delete');
    const countBefore = fieldsBefore.length;

    // Click the dropdown
    const btn = await page.$('.custom-fields__btn:has-text("Rapportveld toevoegen")');
    if (!btn) { console.log('ERROR: no add button'); return false; }

    await btn.click();
    await page.waitForTimeout(500);

    // Click the type from the dropdown
    const option = await page.$(`ul.dropdown-menu a:has-text("${typeText}"), .dropdown-menu a:has-text("${typeText}")`);
    if (!option) {
      // Try broader search
      const allOptions = await page.$$('.dropdown-menu a');
      for (const opt of allOptions) {
        const text = await opt.textContent();
        if (text?.trim().toLowerCase().includes(typeText.toLowerCase())) {
          await opt.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    } else {
      await option.click();
      await page.waitForTimeout(500);
    }

    // Wait for new field to appear
    await page.waitForTimeout(500);

    // Count fields after
    const fieldsAfter = await page.$$('.rf-delete');
    const countAfter = fieldsAfter.length;
    console.log(`  Fields: ${countBefore} → ${countAfter}`);

    // Find the last (newest) input field in the report section
    // Look for inputs that have the specific placeholder text based on type
    const allReportInputs = await page.$$eval('input[type="text"]', els =>
      els.map((e, idx) => ({
        idx,
        value: e.value,
        placeholder: e.placeholder?.substring(0, 60),
        y: Math.round(e.getBoundingClientRect().y),
        visible: e.getBoundingClientRect().width > 0
      })).filter(e => e.visible && e.y > 500) // Only inputs in lower half (report area)
    );
    console.log(`  Report inputs: ${JSON.stringify(allReportInputs)}`);

    // Find the last input in the report section that's empty or has placeholder
    const reportInputs = await page.$$('input[type="text"]');
    let filled = false;
    for (let i = reportInputs.length - 1; i >= 0; i--) {
      const inp = reportInputs[i];
      const value = await inp.inputValue();
      const y = await inp.evaluate(e => e.getBoundingClientRect().y);

      if (y > 500 && (!value || value === '')) {
        await inp.fill(fieldName);
        filled = true;
        console.log(`  ✅ Added ${typeText}: "${fieldName}"`);
        break;
      }
    }

    if (!filled) {
      // Try the very last input
      const lastInput = reportInputs[reportInputs.length - 1];
      if (lastInput) {
        const value = await lastInput.inputValue();
        if (!value || value === '') {
          await lastInput.fill(fieldName);
          console.log(`  ✅ Added ${typeText}: "${fieldName}" (last input)`);
          filled = true;
        }
      }
    }

    if (!filled) {
      console.log(`  ❌ Could not fill: "${fieldName}"`);
    }

    return filled;
  }

  // === Add Inmeet report fields ===
  console.log('\n=== Adding Inmeet report fields ===');

  // First, figure out what the dropdown options are called
  // Based on the existing fields we saw: Actie (checkbox), Naam tekstveld (text), Fotonaam (photo)
  // The Dutch names in the dropdown are likely:
  // - Actie = checkbox/task
  // - Tekstveld = text field
  // - Fotoveld = photo field
  // - Handtekeningveld = signature field

  const fields = [
    ['Actie', 'Klant begroeten & situatie bespreken'],
    ['Naam tekstveld', 'Breedte meting (mm)'],
    ['Naam tekstveld', 'Hoogte meting (mm)'],
    ['Naam tekstveld', 'Diepte/uitval meting (mm)'],
    ['Fotonaam', "Foto's huidige situatie"],
    ['Fotonaam', "Foto's meetpunten"],
    ['Naam tekstveld', 'Opmerkingen voor montage team'],
    ['Naam tekstveld', 'Opmerkingen intern (NIET voor klant)'],
    ['Actie', 'Monsters/stalen getoond'],
    ['Actie', 'Offerte besproken'],
    ['Handtekening', 'Handtekening klant'],
  ];

  for (const [type, name] of fields) {
    await addReportField(type, name);
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: '/tmp/inmeet-all-fields.png', fullPage: true });

  // Update description
  const descField = await page.$('textarea');
  if (descField) {
    await descField.fill('Inmeetafspraak bij klant: situatie opnemen, metingen uitvoeren, monsters tonen en offerte bespreken. Vul alle meetgegevens en foto\'s zo volledig mogelijk in voor het montage team.');
    console.log('Description updated');
  }

  // Save
  console.log('\n=== Saving Inmeet template ===');
  const saveBtn = await page.$('button:has-text("Opslaan")');
  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log('Inmeet template SAVED!');
    await page.screenshot({ path: '/tmp/inmeet-saved-final.png', fullPage: true });
  }

  // === Now Montage particulier ===
  console.log('\n\n=== MONTAGE PARTICULIER ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak particulier")');
  await page.waitForTimeout(3000);
  console.log('Opened Montage template');
  await page.screenshot({ path: '/tmp/montage-opened.png', fullPage: true });

  // Delete existing fields
  let deleteCount = 0;
  while (true) {
    const btns = await page.$$('.rf-delete');
    if (btns.length === 0) break;
    await btns[0].click();
    await page.waitForTimeout(500);
    const confirm = await page.$('.modal button:has-text("OK"), button.btn-danger');
    if (confirm) { await confirm.click(); await page.waitForTimeout(500); }
    deleteCount++;
    if (deleteCount > 20) break; // Safety limit
  }
  console.log(`Deleted ${deleteCount} existing fields`);

  // Add montage fields
  const montageFields = [
    ['Actie', 'Werkplek voorbereid & beschermd'],
    ['Fotonaam', "Foto's VOOR montage"],
    ['Fotonaam', "Foto's NA montage"],
    ['Actie', 'Product getest & werkend'],
    ['Naam tekstveld', 'Gebruikte materialen'],
    ['Naam tekstveld', 'Nabestellingen nodig'],
    ['Naam tekstveld', 'Opmerkingen voor klant'],
    ['Naam tekstveld', 'Opmerkingen intern (NIET voor klant)'],
    ['Actie', 'Werkplek opgeruimd'],
    ['Actie', 'Bediening uitgelegd aan klant'],
    ['Handtekening', 'Handtekening klant'],
  ];

  for (const [type, name] of montageFields) {
    await addReportField(type, name);
    await page.waitForTimeout(300);
  }

  // Update description
  const montageDesc = await page.$('textarea');
  if (montageDesc) {
    await montageDesc.fill('Montage afspraak particulier: product installeren bij klant. Maak voor- en na foto\'s. Interne opmerkingen apart noteren (niet voor klant).');
  }

  // Save
  const montageSave = await page.$('button:has-text("Opslaan")');
  if (montageSave) {
    await montageSave.click();
    await page.waitForTimeout(3000);
    console.log('Montage template SAVED!');
  }
  await page.screenshot({ path: '/tmp/montage-saved-final.png', fullPage: true });

  // === Montage zakelijk ===
  console.log('\n\n=== MONTAGE ZAKELIJK ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak zakelijk")');
  await page.waitForTimeout(3000);

  // Delete existing fields
  deleteCount = 0;
  while (true) {
    const btns = await page.$$('.rf-delete');
    if (btns.length === 0) break;
    await btns[0].click();
    await page.waitForTimeout(500);
    const confirm = await page.$('.modal button:has-text("OK"), button.btn-danger');
    if (confirm) { await confirm.click(); await page.waitForTimeout(500); }
    deleteCount++;
    if (deleteCount > 20) break;
  }
  console.log(`Deleted ${deleteCount} existing fields`);

  // Same fields as particulier + extra for zakelijk
  const zakelijkFields = [
    ['Actie', 'Werkplek voorbereid & beschermd'],
    ['Fotonaam', "Foto's VOOR montage"],
    ['Fotonaam', "Foto's NA montage"],
    ['Actie', 'Product getest & werkend'],
    ['Naam tekstveld', 'Gebruikte materialen'],
    ['Naam tekstveld', 'Nabestellingen nodig'],
    ['Naam tekstveld', 'Contactpersoon ter plaatse'],
    ['Naam tekstveld', 'Opmerkingen voor klant'],
    ['Naam tekstveld', 'Opmerkingen intern (NIET voor klant)'],
    ['Actie', 'Werkplek opgeruimd'],
    ['Actie', 'Bediening uitgelegd'],
    ['Handtekening', 'Handtekening opdrachtgever'],
  ];

  for (const [type, name] of zakelijkFields) {
    await addReportField(type, name);
    await page.waitForTimeout(300);
  }

  const zakelijkDesc = await page.$('textarea');
  if (zakelijkDesc) {
    await zakelijkDesc.fill('Montage afspraak zakelijk: product installeren bij zakelijke klant. Maak voor- en na foto\'s, noteer contactpersoon ter plaatse.');
  }

  const zakelijkSave = await page.$('button:has-text("Opslaan")');
  if (zakelijkSave) {
    await zakelijkSave.click();
    await page.waitForTimeout(3000);
    console.log('Montage zakelijk SAVED!');
  }
  await page.screenshot({ path: '/tmp/montage-zakelijk-saved.png', fullPage: true });

  await browser.close();
  console.log('\n=== ALL TEMPLATES DONE ===');
})().catch(err => console.error('Error:', err.message));
