const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '.zapier-session.json');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const ZAP_ID = '354163386';

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `zap09-${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot: ${filepath}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('=== ZAP-09: Test Trigger & Final Screenshots ===\n');

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
  await context.addCookies(session.cookies);

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // Send another test webhook first (in case the previous one expired)
    const webhookUrl = 'https://hooks.zapier.com/hooks/catch/22982966/uxpj6xx/';
    console.log('[1] Sending test webhook...');
    const testPayload = {
      event: "job_finished",
      job: {
        uuid: "test-montage-456",
        template: { name: "Montage afspraak particulier" },
        external_id: "12345678",
        status: "finished",
        client: { name: "Test Klant" }
      }
    };
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    console.log(`Webhook response: ${resp.status}`);

    // Navigate to the trigger test page
    console.log('\n[2] Opening trigger test page...');
    await page.goto(`https://zapier.com/editor/${ZAP_ID}/draft/${ZAP_ID}/test`, { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    await screenshot(page, 'test-01-page');

    // Click "Test trigger" button
    console.log('\n[3] Clicking Test trigger...');
    const testBtn = page.locator('button:has-text("Test trigger")').first();
    try {
      await testBtn.click({ timeout: 10000 });
      console.log('Clicked Test trigger');
      await sleep(8000);
      await screenshot(page, 'test-02-result');
    } catch (e) {
      console.log(`Could not click Test trigger: ${e.message}`);
      // Try alternative: look for any test button
      const anyTestBtn = page.locator('button:has-text("Test")').first();
      try {
        await anyTestBtn.click({ timeout: 5000 });
        await sleep(8000);
        await screenshot(page, 'test-02-result-alt');
      } catch (e2) {
        console.log('No test button found');
      }
    }

    // Check if we got test data - look for "We found a request!" or similar
    const pageText = await page.locator('body').textContent();
    if (pageText.includes('found a request') || pageText.includes('test was successful') || pageText.includes('job_finished')) {
      console.log('Test data received successfully!');
    } else {
      console.log('Test data status unclear - check screenshots');
    }

    // Click Continue to move to step 2
    console.log('\n[4] Moving through steps...');
    const continueBtn = page.locator('button:has-text("Continue")').first();
    try {
      await continueBtn.click({ timeout: 5000 });
      await sleep(3000);
      await screenshot(page, 'test-03-step2-filter');

      // Check filter step
      console.log('On step 2 (Filter)...');

      // Continue to step 3
      const continueBtn2 = page.locator('button:has-text("Continue")').first();
      await continueBtn2.click({ timeout: 5000 });
      await sleep(3000);
      await screenshot(page, 'test-04-step3-hubspot');
    } catch (e) {
      console.log(`Could not navigate through steps: ${e.message}`);
    }

    // Take a full overview screenshot by scrolling up
    console.log('\n[5] Taking overview screenshots...');
    // Scroll the canvas to show all steps
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1000);

    // Close any open panels to see the full flow
    const closeBtn = page.locator('[aria-label="Close"], button:has-text("×")').first();
    try {
      await closeBtn.click({ timeout: 2000 });
      await sleep(1000);
    } catch (e) {}

    await screenshot(page, 'test-05-overview');

    // Now let's rename the zap title properly
    console.log('\n[6] Checking zap title...');
    const titleText = await page.locator('[class*="title"], [data-testid*="zap-name"]').first().textContent().catch(() => '');
    console.log(`Current title: ${titleText || 'unknown'}`);

    // Save session
    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));

    console.log('\n=== DONE ===');
    console.log(`Zap ID: ${ZAP_ID}`);
    console.log(`Zap URL: https://zapier.com/editor/${ZAP_ID}`);
    console.log(`Webhook URL: ${webhookUrl}`);
    console.log('Status: Draft (not published)');
    console.log('Steps:');
    console.log('  1. Webhooks by Zapier - Catch Raw Hook');
    console.log('  2. Filter by Zapier - Filter conditions');
    console.log('  3. HubSpot - Update Deal');
    console.log('============');

    await sleep(8000);

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    await screenshot(page, 'test-error');
  } finally {
    await browser.close();
  }
})();
