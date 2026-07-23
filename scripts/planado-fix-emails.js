const { chromium } = require('playwright');

const MONTEURS = [
  { first: 'Sjoerd', last: 'Pelle', email: 'sjoerd@sonty.nl' },
  { first: 'Marvin', last: 'Vrij', email: 'marvin@sonty.nl' },
  { first: 'Mick', last: 'Mulders', email: 'mick@sonty.nl' },
  { first: 'Jorren', last: 'Plugge', email: 'jorren@sonty.nl' },
  { first: 'Tygo', last: 'Krikke', email: 'tygo@sonty.nl' },
  { first: 'Kevin', last: 'Gibson', email: 'kevin@sonty.nl' },
  { first: 'Nick', last: 'Huizer', email: 'nick@sonty.nl' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    await page.goto('https://sonty.planadoapp.com/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
    await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
    await page.locator('button:has-text("Inloggen")').click();
    await page.waitForTimeout(5000);

    // Go to users list
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // First, try to delete/cancel old invitations with @sontymontage.nl
    // Click on each old invitation to see if we can cancel/delete
    const oldNames = ['Sjoerd Hoogduin', 'Marvin Vrij', 'Mick Mulders', 'Jorren Plugge', 'Tygo Krikke', 'Kevin Gibson', 'Nick Huizer'];

    for (const name of oldNames) {
      try {
        const link = page.locator(`a:has-text("${name.split(' ')[0]}")`).first();
        if (await link.isVisible({ timeout: 2000 })) {
          await link.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);

          // Look for delete/remove/cancel button
          const deleteBtn = page.locator('text=Verwijderen, text=Annuleren uitnodiging, text=Delete, text=Cancel').first();
          try {
            if (await deleteBtn.isVisible({ timeout: 2000 })) {
              await deleteBtn.click();
              await page.waitForTimeout(1000);

              // Confirm deletion if prompted
              const confirmBtn = page.locator('text=Bevestigen, text=Ja, text=OK, button.btn-danger').first();
              try {
                if (await confirmBtn.isVisible({ timeout: 2000 })) {
                  await confirmBtn.click();
                  await page.waitForTimeout(2000);
                }
              } catch (e) {}

              console.log(`Verwijderd: ${name}`);
            }
          } catch (e) {}

          // Go back to users list
          await page.goto('https://sonty.planadoapp.com/admin/users');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log(`Skip: ${name} - ${e.message.substring(0, 50)}`);
      }
    }

    await page.screenshot({ path: '/tmp/planado-after-delete.png' });

    // Now add new invitations with @sonty.nl emails
    const added = [];
    for (const m of MONTEURS) {
      console.log(`Adding ${m.first} ${m.last} (${m.email})...`);
      await page.goto('https://sonty.planadoapp.com/admin/users/new?role=field');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Fill name fields
      const textInputs = await page.$$('input[type="text"]');
      const visible = [];
      for (const inp of textInputs) {
        if (await inp.isVisible()) visible.push(inp);
      }
      if (visible.length >= 2) {
        await visible[0].fill(m.first);
        await visible[1].fill(m.last);
      }

      // Select Via e-mail
      await page.locator('text=Via e-mail').click();
      await page.waitForTimeout(500);

      // Fill email (3rd visible text input)
      const updatedInputs = await page.$$('input[type="text"]');
      const visibleAfter = [];
      for (const inp of updatedInputs) {
        if (await inp.isVisible()) visibleAfter.push(inp);
      }
      if (visibleAfter.length >= 3) {
        await visibleAfter[2].fill(m.email);
      }

      // Click Toevoegen
      await page.locator('button.btn.btn-primary').click();
      await page.waitForTimeout(3000);

      if (!page.url().includes('/new')) {
        added.push(`${m.first} ${m.last}`);
        console.log(`  OK: ${m.first} ${m.last}`);
      } else {
        console.log(`  FOUT: ${m.first} ${m.last}`);
        // Check for "al in gebruik" error
        const bodyText = await page.textContent('body');
        if (bodyText.includes('al in gebruik')) {
          console.log('  -> email al in gebruik');
        }
        if (bodyText.includes('licenties')) {
          console.log('  -> geen licenties meer');
        }
      }
    }

    console.log(`\nResultaat: ${added.length}/${MONTEURS.length} toegevoegd`);
    for (const n of added) console.log(`  OK: ${n}`);

    // Final screenshot
    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-final-fixed.png' });

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
