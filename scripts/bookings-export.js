const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    // Login
    await page.goto('https://outlook.office.com/bookings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
    if (emailInput) {
      await emailInput.fill('joey@sontymontage.nl');
      await page.locator('input[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      const pwInput = await page.$('input[type="password"]');
      if (pwInput) {
        await pwInput.fill('Shja..59');
        await page.locator('input[type="submit"]').click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
      try {
        const yesBtn = page.locator('input[value="Yes"], input[value="Ja"]');
        if (await yesBtn.first().isVisible({ timeout: 5000 })) {
          await yesBtn.first().click();
          await page.waitForTimeout(5000);
        }
      } catch (e) {}
    }

    // Navigate to Afspraak showroom Sonty
    await page.waitForTimeout(3000);
    await page.locator('text=Afspraak showroom').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate back in time to find past appointments
    console.log('Looking for past appointments...');
    for (let i = 0; i < 8; i++) {
      // Click back arrow to go to previous week
      const backBtn = page.locator('[aria-label="Back"], [aria-label="Vorige"], button:has-text("←")').first();
      try {
        // Try the back navigation arrow near the date
        await page.locator('button[aria-label*="ack"], button[aria-label*="orig"]').first().click();
        await page.waitForTimeout(1500);
      } catch (e) {
        // Try clicking the left arrow icon
        const arrows = await page.$$('button');
        for (const btn of arrows) {
          const ariaLabel = await btn.getAttribute('aria-label');
          if (ariaLabel && (ariaLabel.includes('ack') || ariaLabel.includes('orig') || ariaLabel.includes('revious'))) {
            await btn.click();
            await page.waitForTimeout(1500);
            break;
          }
        }
      }

      // Check for appointments
      const weekText = await page.evaluate(() => {
        const dateHeader = document.querySelector('[class*="week"], [class*="date-range"]');
        return dateHeader?.textContent?.trim() || '';
      });

      // Look for appointment blocks
      const appointments = await page.$$('[class*="appointment"], [class*="event"], [class*="booking"]');
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasAppointments = bodyText.includes('Inmeet') || bodyText.includes('Montage') ||
                              bodyText.includes('afspraak') || bodyText.includes('showroom') ||
                              appointments.length > 0;

      if (hasAppointments) {
        console.log(`Found appointments in week!`);
        await page.screenshot({ path: `/tmp/bookings-week-${i}.png` });
      }
    }

    // Take screenshot of current view
    await page.screenshot({ path: '/tmp/bookings-past.png' });

    // Try the Exporteren button
    console.log('\nTrying export...');
    try {
      await page.locator('text=Exporteren').click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/bookings-export-dialog.png' });

      // Check for download or dialog
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      console.log('Export dialog:', bodyText.substring(0, 500));
    } catch (e) {
      console.log('Export error:', e.message.substring(0, 100));
    }

    // Also check Services page
    console.log('\nChecking services...');
    await page.locator('text=Services').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/bookings-services.png' });
    const servicesText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Services:', servicesText.substring(0, 800));

    // Check Klanten (clients)
    console.log('\nChecking klanten...');
    await page.locator('text=Klanten').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/bookings-klanten.png' });
    const klantenText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Klanten:', klantenText.substring(0, 800));

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/bookings-error.png' });
  }

  await browser.close();
})();
