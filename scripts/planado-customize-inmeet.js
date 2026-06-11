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

  // === Step 1: Set Opdrachttype to Inmeet afspraak ===
  console.log('\n=== Setting Opdrachttype ===');
  const typeDropdown = await page.$('select:below(:text("Opdrachttype"))');
  if (typeDropdown) {
    // Check current options
    const options = await typeDropdown.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent?.trim() })));
    console.log('Type options:', options);
    // Select "Inmeet afspraak" type if available
    const inmeetOption = options.find(o => o.text.toLowerCase().includes('inmeet'));
    if (inmeetOption) {
      await typeDropdown.selectOption(inmeetOption.value);
      console.log('Selected:', inmeetOption.text);
    }
  }

  // === Step 2: Delete all 5 English report fields ===
  console.log('\n=== Deleting English report fields ===');
  for (let i = 0; i < 5; i++) {
    const deleteButtons = await page.$$('.rf-delete');
    if (deleteButtons.length > 0) {
      await deleteButtons[0].click();
      await page.waitForTimeout(500);
      // Handle any confirmation dialog
      const confirmDialog = await page.$('.modal button:has-text("OK"), .modal button:has-text("Ja"), .modal button:has-text("Verwijderen"), button.btn-danger:has-text("Verwijderen")');
      if (confirmDialog) {
        await confirmDialog.click();
        await page.waitForTimeout(500);
      }
      console.log(`Deleted field ${i + 1}/5`);
    } else {
      console.log(`No more delete buttons after ${i} deletions`);
      break;
    }
  }

  await page.screenshot({ path: '/tmp/inmeet-clean.png', fullPage: true });
  console.log('All English fields deleted');

  // === Step 3: Add Dutch report fields ===
  console.log('\n=== Adding Dutch report fields ===');

  // Helper: Add a report field by type
  async function addReportField(type, name) {
    // Click "Rapportveld toevoegen" dropdown
    const addBtn = await page.$('button:has-text("Rapportveld toevoegen")');
    if (!addBtn) {
      console.log('ERROR: Could not find "Rapportveld toevoegen" button');
      return false;
    }
    await addBtn.click();
    await page.waitForTimeout(500);

    // The dropdown should show options like: Actie, Tekstveld, Fotoveld, Handtekeningveld
    // Map type to the Dutch menu option
    const typeMap = {
      'checkbox': 'Actie',
      'text': 'Tekstveld',
      'photo': 'Fotoveld',
      'signature': 'Handtekeningveld'
    };

    const menuText = typeMap[type] || type;
    const menuItem = await page.$(`a:has-text("${menuText}"), button:has-text("${menuText}"), [role="menuitem"]:has-text("${menuText}")`);
    if (menuItem) {
      await menuItem.click();
      await page.waitForTimeout(500);
    } else {
      // Try clicking the dropdown option by text content
      const dropdownItems = await page.$$('.dropdown-menu a, .dropdown-menu li, .dropdown-menu button, [class*="menu"] a');
      for (const item of dropdownItems) {
        const text = await item.textContent();
        if (text?.trim().includes(menuText)) {
          await item.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    }

    // Now fill in the name in the newly added (last) input field
    // The new field should be the last one in the report section
    const allInputs = await page.$$('.report-fields input[type="text"], .custom-field input[type="text"]');
    if (allInputs.length > 0) {
      const lastInput = allInputs[allInputs.length - 1];
      const currentValue = await lastInput.inputValue();
      if (!currentValue || currentValue === '') {
        await lastInput.fill(name);
        console.log(`Added ${type}: "${name}"`);
        return true;
      }
    }

    // Alternative: find the last empty input near Opdrachtrapport
    const emptyInputs = await page.$$eval('input[type="text"]', els =>
      els.filter(e => !e.value && e.getBoundingClientRect().y > 800)
        .map(e => ({ y: Math.round(e.getBoundingClientRect().y) }))
    );
    if (emptyInputs.length > 0) {
      const lastEmpty = await page.$(`input[type="text"]:not([value])`);
      if (lastEmpty) {
        await lastEmpty.fill(name);
        console.log(`Added ${type}: "${name}" (alt method)`);
        return true;
      }
    }

    console.log(`WARNING: Could not fill name for ${type}: "${name}"`);
    return false;
  }

  // Add fields for Inmeet afspraak
  const inmeetReportFields = [
    { type: 'checkbox', name: 'Klant begroeten & situatie bespreken' },
    { type: 'text', name: 'Breedte meting (mm)' },
    { type: 'text', name: 'Hoogte meting (mm)' },
    { type: 'text', name: 'Diepte/uitval meting (mm)' },
    { type: 'photo', name: 'Foto\'s huidige situatie' },
    { type: 'photo', name: 'Foto\'s meetpunten' },
    { type: 'text', name: 'Opmerkingen voor montage team' },
    { type: 'text', name: 'Opmerkingen intern (NIET voor klant)' },
    { type: 'checkbox', name: 'Monsters/stalen getoond' },
    { type: 'checkbox', name: 'Offerte besproken' },
    { type: 'signature', name: 'Handtekening klant' },
  ];

  for (const field of inmeetReportFields) {
    await addReportField(field.type, field.name);
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: '/tmp/inmeet-fields-added.png', fullPage: true });

  // === Step 4: Update description ===
  console.log('\n=== Updating description ===');
  const descField = await page.$('textarea');
  if (descField) {
    await descField.fill('Inmeetafspraak bij klant: situatie opnemen, metingen uitvoeren, monsters tonen en offerte bespreken. Vul alle meetgegevens en foto\'s zo volledig mogelijk in voor het montage team.');
    console.log('Description updated');
  }

  // === Step 5: Enable "Opdracht vereist klant/locatie" ===
  const clientRequired = await page.$('input[type="checkbox"]:near(:text("Opdracht vereist klant/locatie"))');
  if (clientRequired) {
    const isChecked = await clientRequired.isChecked();
    if (!isChecked) {
      await clientRequired.check();
      console.log('Enabled: Opdracht vereist klant/locatie');
    }
  }

  // === Step 6: Save ===
  console.log('\n=== Saving template ===');
  await page.screenshot({ path: '/tmp/inmeet-before-save.png', fullPage: true });

  const saveBtn = await page.$('button:has-text("Opslaan")');
  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log('Template saved!');
    await page.screenshot({ path: '/tmp/inmeet-saved.png', fullPage: true });
  } else {
    console.log('WARNING: Could not find Save button');
  }

  // === Now do the same for Montage templates ===
  console.log('\n\n=== Setting up MONTAGE PARTICULIER template ===');
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.click('a:has-text("Montage afspraak particulier")');
  await page.waitForTimeout(3000);

  // Check what fields exist
  const montageInputs = await page.$$eval('input[type="text"]', els =>
    els.map(e => ({ value: e.value?.substring(0, 50), y: Math.round(e.getBoundingClientRect().y) }))
      .filter(e => e.y > 800)
  );
  console.log('Existing Montage report fields:', montageInputs);
  await page.screenshot({ path: '/tmp/montage-01-opened.png', fullPage: true });

  // Delete existing English fields
  let montageDeleteButtons = await page.$$('.rf-delete');
  console.log(`Found ${montageDeleteButtons.length} fields to delete`);
  for (let i = 0; i < montageDeleteButtons.length; i++) {
    const btns = await page.$$('.rf-delete');
    if (btns.length > 0) {
      await btns[0].click();
      await page.waitForTimeout(500);
      const confirmDialog = await page.$('.modal button:has-text("OK"), button.btn-danger');
      if (confirmDialog) await confirmDialog.click();
      await page.waitForTimeout(500);
      console.log(`Deleted montage field ${i + 1}`);
    }
  }

  // Add Montage report fields
  const montageReportFields = [
    { type: 'checkbox', name: 'Werkplek voorbereid & beschermd' },
    { type: 'photo', name: 'Foto\'s VOOR montage' },
    { type: 'photo', name: 'Foto\'s NA montage' },
    { type: 'checkbox', name: 'Product getest & werkend' },
    { type: 'text', name: 'Gebruikte materialen' },
    { type: 'text', name: 'Nabestellingen nodig' },
    { type: 'text', name: 'Opmerkingen voor klant' },
    { type: 'text', name: 'Opmerkingen intern (NIET voor klant)' },
    { type: 'checkbox', name: 'Werkplek opgeruimd' },
    { type: 'checkbox', name: 'Bediening uitgelegd aan klant' },
    { type: 'signature', name: 'Handtekening klant' },
  ];

  for (const field of montageReportFields) {
    await addReportField(field.type, field.name);
    await page.waitForTimeout(300);
  }

  // Update description
  const montageDesc = await page.$('textarea');
  if (montageDesc) {
    await montageDesc.fill('Montage afspraak particulier: zonwering/raamdecoratie installeren bij klant. Maak voor én na foto\'s, controleer het product en laat de klant tekenen. Interne opmerkingen over nabestellingen of problemen apart noteren.');
  }

  // Enable client required
  const montageClientReq = await page.$('input[type="checkbox"]:near(:text("Opdracht vereist klant/locatie"))');
  if (montageClientReq) {
    const checked = await montageClientReq.isChecked();
    if (!checked) await montageClientReq.check();
  }

  // Save
  const montageSaveBtn = await page.$('button:has-text("Opslaan")');
  if (montageSaveBtn) {
    await montageSaveBtn.click();
    await page.waitForTimeout(3000);
    console.log('Montage template saved!');
  }

  await page.screenshot({ path: '/tmp/montage-saved.png', fullPage: true });

  await browser.close();
  console.log('\n=== DONE ===');
  console.log('Templates customized:');
  console.log('1. Inmeet afspraak - Dutch measurement fields');
  console.log('2. Montage afspraak particulier - Dutch installation fields');
})().catch(err => console.error('Error:', err.message));
