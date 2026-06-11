const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept Graph API requests to capture the access token
  let accessToken = null;

  page.on('request', (request) => {
    const url = request.url();
    const auth = request.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && url.includes('graph.microsoft.com')) {
      accessToken = auth.replace('Bearer ', '');
    }
  });

  try {
    // Login to Outlook
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

    // Wait for calendar to load and Graph API calls to happen
    await page.waitForTimeout(8000);

    if (accessToken) {
      console.log('TOKEN_FOUND');
      console.log(accessToken);

      // Save token
      fs.writeFileSync('/tmp/ms-graph-token.txt', accessToken);
    } else {
      // Try navigating to trigger more API calls
      await page.reload();
      await page.waitForTimeout(5000);

      if (accessToken) {
        console.log('TOKEN_FOUND');
        console.log(accessToken);
        fs.writeFileSync('/tmp/ms-graph-token.txt', accessToken);
      } else {
        console.log('NO_TOKEN');
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  }

  await browser.close();
})();
