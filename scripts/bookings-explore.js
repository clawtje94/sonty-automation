const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to Microsoft Bookings
    await page.goto('https://outlook.office.com/bookings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Login with joey@sontymontage.nl
    const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
    if (emailInput) {
      await emailInput.fill('joey@sontymontage.nl');
      const nextBtn = await page.$('input[type="submit"], button[type="submit"]');
      if (nextBtn) await nextBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Password
      const pwInput = await page.$('input[type="password"], input[name="passwd"]');
      if (pwInput) {
        await pwInput.fill('Shja..59');
        const signInBtn = await page.$('input[type="submit"], button[type="submit"]');
        if (signInBtn) await signInBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }

      // "Stay signed in?" prompt
      await page.waitForTimeout(2000);
      try {
        const yesBtn = page.locator('input[value="Yes"], input[value="Ja"], button:has-text("Yes"), button:has-text("Ja")');
        if (await yesBtn.first().isVisible({ timeout: 5000 })) {
          await yesBtn.first().click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(5000);
        }
      } catch (e) {}
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/bookings-01.png' });
    console.log('URL:', page.url());
    console.log('Title:', await page.title());

    // Check what's on the page
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Page content (first 1000):');
    console.log(bodyText.substring(0, 1000));

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/bookings-error.png' });
  }

  await browser.close();
})();
