const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://sonty.planadoapp.com/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
    await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
    await page.locator('button:has-text("Inloggen")').click();
    await page.waitForTimeout(5000);

    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find all links with @sontymontage.nl in the page
    const oldEmails = ['sjoerd@sontymontage.nl', 'marvin@sontymontage.nl', 'mick@sontymontage.nl',
      'jorren@sontymontage.nl', 'tygo@sontymontage.nl', 'kevin@sontymontage.nl', 'nick@sontymontage.nl'];

    for (const email of oldEmails) {
      await page.goto('https://sonty.planadoapp.com/admin/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Find the row with this email and click the name link
      const nameLink = page.locator(`tr:has-text("${email}") a`).first();
      try {
        if (await nameLink.isVisible({ timeout: 2000 })) {
          const name = await nameLink.textContent();
          await nameLink.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);

          // Look for delete button
          const deleteBtn = page.locator('button:has-text("Verwijderen"), a:has-text("Verwijderen"), text=Uitnodiging annuleren');
          try {
            if (await deleteBtn.first().isVisible({ timeout: 2000 })) {
              await deleteBtn.first().click();
              await page.waitForTimeout(1000);

              // Confirm
              const confirm = page.locator('button:has-text("Bevestigen"), button:has-text("Ja"), button:has-text("OK"), button.btn-danger');
              try {
                if (await confirm.first().isVisible({ timeout: 2000 })) {
                  await confirm.first().click();
                  await page.waitForTimeout(2000);
                }
              } catch (e) {}
              console.log(`Verwijderd: ${name.trim()} (${email})`);
            } else {
              // Try looking at the page for any delete/remove option
              await page.screenshot({ path: `/tmp/planado-del-${email.split('@')[0]}.png` });
              console.log(`Geen verwijder knop: ${name.trim()} (${email})`);
            }
          } catch (e) {
            console.log(`Fout bij verwijderen: ${email} - ${e.message.substring(0, 50)}`);
          }
        } else {
          console.log(`Niet gevonden: ${email}`);
        }
      } catch (e) {
        console.log(`Skip: ${email}`);
      }
    }

    await page.goto('https://sonty.planadoapp.com/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-users-cleaned.png' });
    console.log('Klaar');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
