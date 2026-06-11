const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture ALL tokens from different API calls
  const tokens = {};

  page.on('request', (request) => {
    const url = request.url();
    const auth = request.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.replace('Bearer ', '');
      // Categorize by URL
      if (url.includes('outlook.office.com') || url.includes('outlook.office365.com')) {
        tokens['outlook'] = token;
      }
      if (url.includes('graph.microsoft.com')) {
        tokens['graph'] = token;
      }
      if (url.includes('calendar') || url.includes('Calendar') || url.includes('events') || url.includes('calendarView')) {
        tokens['calendar'] = token;
        tokens['calendar_url'] = url;
      }
      // Store by domain
      const domain = new URL(url).hostname;
      if (!tokens[domain]) tokens[domain] = token;
    }
  });

  // Also capture the actual calendar API calls to understand the endpoints used
  page.on('response', async (response) => {
    const url = response.url();
    if ((url.includes('calendar') || url.includes('Calendar') || url.includes('events')) &&
        response.status() === 200) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const body = await response.text();
          if (body.length > 100 && body.length < 50000) {
            const data = JSON.parse(body);
            const events = data.value || data.Value || [];
            if (events.length > 0) {
              console.log(`CALENDAR_DATA: ${url.substring(0, 100)} — ${events.length} events`);
              // Save the first batch of calendar data
              fs.writeFileSync('/tmp/outlook-calendar-data.json', body);
            }
          }
        }
      } catch (e) {}
    }
  });

  try {
    // Login to Outlook Calendar specifically
    await page.goto('https://outlook.office.com/calendar/view/month');
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

    // Wait for calendar to fully load and make API calls
    await page.waitForTimeout(10000);

    // Navigate around to trigger more API calls
    // Go back one month
    try {
      await page.locator('button[aria-label*="ack"], button[aria-label*="orig"]').first().click();
      await page.waitForTimeout(5000);
    } catch (e) {}

    // Go forward again
    try {
      await page.locator('button[aria-label*="orward"], button[aria-label*="olgende"]').first().click();
      await page.waitForTimeout(5000);
    } catch (e) {}

    console.log('\nTokens captured:');
    for (const [key, val] of Object.entries(tokens)) {
      if (key.endsWith('_url')) {
        console.log(`  ${key}: ${val}`);
      } else {
        console.log(`  ${key}: ${val.substring(0, 50)}...`);
      }
    }

    // Save the calendar-specific token
    if (tokens['calendar']) {
      fs.writeFileSync('/tmp/ms-calendar-token.txt', tokens['calendar']);
      console.log('\nCalendar token saved!');
    } else if (tokens['outlook.office.com'] || tokens['outlook.office365.com']) {
      const outlookToken = tokens['outlook.office.com'] || tokens['outlook.office365.com'];
      fs.writeFileSync('/tmp/ms-calendar-token.txt', outlookToken);
      console.log('\nOutlook token saved (fallback)');
    }

    // Test the captured tokens against calendar API
    for (const [key, token] of Object.entries(tokens)) {
      if (key.endsWith('_url')) continue;
      if (token.length < 100) continue;

      // Decode scopes
      try {
        const payload = token.split('.')[1];
        const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(padded, 'base64').toString();
        const data = JSON.parse(decoded);
        const scopes = data.scp || '';
        if (scopes.includes('Calendar') || scopes.includes('calendar')) {
          console.log(`\n✅ Token "${key}" has Calendar scope!`);
          console.log(`   Scopes: ${scopes.substring(0, 200)}`);
          fs.writeFileSync('/tmp/ms-calendar-token.txt', token);
        }
      } catch (e) {}
    }

  } catch (err) {
    console.error('Error:', err.message);
  }

  await browser.close();
})();
