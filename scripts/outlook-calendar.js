const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login to Outlook calendar
    await page.goto('https://outlook.office.com/calendar');
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

    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/outlook-cal-01.png' });
    console.log('URL:', page.url());

    // Get calendar content
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Calendar content (1500):');
    console.log(bodyText.substring(0, 1500));

    // Try to go to month view for better overview
    try {
      const monthBtn = page.locator('text=Maand, text=Month');
      if (await monthBtn.first().isVisible({ timeout: 3000 })) {
        await monthBtn.first().click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/outlook-cal-month.png' });
      }
    } catch (e) {}

    // Go back a few weeks to find appointments
    for (let i = 0; i < 4; i++) {
      try {
        await page.locator('button[aria-label*="ack"], button[aria-label*="orig"], button[aria-label*="revious"]').first().click();
        await page.waitForTimeout(2000);
      } catch (e) { break; }
    }

    await page.screenshot({ path: '/tmp/outlook-cal-past.png' });
    const pastText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('\nPast calendar:');
    console.log(pastText.substring(0, 1500));

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/outlook-error.png' });
  }

  await browser.close();
})();
