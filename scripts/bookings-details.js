const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login to Microsoft
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

      // Stay signed in - Yes
      try {
        const yesBtn = page.locator('input[value="Yes"], input[value="Ja"]');
        if (await yesBtn.first().isVisible({ timeout: 5000 })) {
          await yesBtn.first().click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(5000);
        }
      } catch (e) {}
    }

    console.log('Logged in:', page.url());

    // Click on "Sonty" shared booking page
    console.log('\n1. Opening Sonty bookings page...');
    try {
      await page.locator('text=Sonty').first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/bookings-sonty.png' });
      console.log('URL:', page.url());

      // Look for calendar/appointments view
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('Content (1500 chars):');
      console.log(bodyText.substring(0, 1500));

      // Find navigation links
      const links = await page.$$eval('a, button, [role="tab"]', els =>
        els.map(e => e.textContent.trim().substring(0, 50)).filter(t => t.length > 1)
      );
      console.log('\nButtons/links:', links.slice(0, 30).join(' | '));
    } catch (e) {
      console.log('Error:', e.message.substring(0, 100));
    }

    // Try "Afspraak showroom Sonty"
    console.log('\n2. Opening Afspraak showroom Sonty...');
    await page.goto('https://outlook.office.com/bookings/homepage');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    try {
      await page.locator('text=Afspraak showroom').first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/bookings-showroom.png' });
      console.log('URL:', page.url());

      // Look for calendar tab
      try {
        const calTab = page.locator('text=Agenda, text=Calendar, text=Kalender, text=Reserveringen').first();
        if (await calTab.isVisible({ timeout: 3000 })) {
          await calTab.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
          await page.screenshot({ path: '/tmp/bookings-calendar.png' });

          const calText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
          console.log('Calendar content:');
          console.log(calText.substring(0, 1500));
        }
      } catch (e) {}

      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log('Content:');
      console.log(bodyText.substring(0, 1000));
    } catch (e) {
      console.log('Error:', e.message.substring(0, 100));
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/bookings-error.png' });
  }

  await browser.close();
})();
