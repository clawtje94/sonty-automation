const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '.zapier-session.json');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const WEBHOOK_OUTPUT = path.join(__dirname, 'zap09-webhook-url.txt');
const ZAP_ID = '354163386';

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `zap09-${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot: ${filepath}`);
  return filepath;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('=== ZAP-09: Get Webhook URL & Configure ===\n');

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Load session
  const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
  await context.addCookies(session.cookies);

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // Navigate directly to the zap editor, click on trigger step
    console.log('[1] Opening zap editor...');
    await page.goto(`https://zapier.com/editor/${ZAP_ID}/draft/${ZAP_ID}/setup`, { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    await screenshot(page, 'get-01-editor');

    // Check if Copilot is still running, wait for it
    let copilotRunning = true;
    for (let i = 0; i < 6; i++) {
      const stopBtn = await page.locator('button:has-text("Stop")').count();
      if (stopBtn > 0) {
        console.log(`  Copilot still running (check ${i+1})...`);
        await sleep(10000);
      } else {
        copilotRunning = false;
        break;
      }
    }

    await screenshot(page, 'get-02-copilot-done');

    // Click on the Webhooks trigger step (step 1)
    console.log('\n[2] Clicking on trigger step...');
    const triggerNode = page.locator('text=Catch Raw Hook').first();
    try {
      await triggerNode.click({ timeout: 5000 });
      await sleep(2000);
    } catch (e) {
      // Try clicking the webhook node itself
      const webhookNode = page.locator('text=Webhooks by Zapier').first();
      await webhookNode.click({ timeout: 5000 });
      await sleep(2000);
    }
    await screenshot(page, 'get-03-trigger-clicked');

    // Now navigate to the Test tab of the trigger to see the webhook URL
    console.log('\n[3] Looking for webhook URL...');

    // The webhook URL is typically shown in the Test section or in the setup
    // Let's click "Test" tab
    const testTab = page.locator('[role="tab"]:has-text("Test"), button:has-text("Test")').first();
    try {
      await testTab.click({ timeout: 5000 });
      await sleep(3000);
      await screenshot(page, 'get-04-test-tab');
    } catch (e) {
      console.log('Could not find Test tab, trying Configure & test...');
      const configTestTab = page.locator('text=Configure & test').first();
      try {
        await configTestTab.click({ timeout: 5000 });
        await sleep(3000);
      } catch (e2) {
        // Try Continue button first
        const continueBtn = page.locator('button:has-text("Continue")').first();
        try {
          await continueBtn.click({ timeout: 5000 });
          await sleep(3000);
        } catch (e3) {
          console.log('Could not find Continue button either');
        }
      }
    }

    await screenshot(page, 'get-04-looking-for-url');

    // Search for webhook URL in the page
    let webhookUrl = null;
    const pageContent = await page.content();
    const hookMatch = pageContent.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<]+/);
    if (hookMatch) {
      webhookUrl = hookMatch[0].replace(/&amp;/g, '&');
      console.log(`Found webhook URL in HTML: ${webhookUrl}`);
    }

    // Also check visible text
    if (!webhookUrl) {
      const bodyText = await page.locator('body').textContent();
      const hookMatch2 = bodyText.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<\])+}]+/);
      if (hookMatch2) {
        webhookUrl = hookMatch2[0];
        console.log(`Found webhook URL in text: ${webhookUrl}`);
      }
    }

    // If still not found, try clicking through Setup → Continue to get to Test
    if (!webhookUrl) {
      console.log('Webhook URL not visible yet. Trying to navigate through setup...');

      // Click Setup tab
      const setupTab = page.locator('text=Setup').first();
      try {
        await setupTab.click({ timeout: 3000 });
        await sleep(1000);
      } catch(e) {}

      // Click Continue
      const continueBtn = page.locator('button:has-text("Continue")').first();
      try {
        await continueBtn.click({ timeout: 3000 });
        await sleep(3000);
        await screenshot(page, 'get-05-after-continue');

        // Check again for URL
        const content2 = await page.content();
        const match2 = content2.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<]+/);
        if (match2) {
          webhookUrl = match2[0].replace(/&amp;/g, '&');
          console.log(`Found webhook URL after Continue: ${webhookUrl}`);
        }
      } catch(e) {
        console.log('Continue button not available');
      }
    }

    // Try yet another approach: look for the URL in any input field or copyable element
    if (!webhookUrl) {
      const inputs = await page.locator('input[readonly], input[value*="hooks.zapier.com"], [class*="url"], [class*="webhook"]').all();
      for (const input of inputs) {
        const val = await input.getAttribute('value').catch(() => null);
        if (val && val.includes('hooks.zapier.com')) {
          webhookUrl = val;
          console.log(`Found webhook URL in input: ${webhookUrl}`);
          break;
        }
        const text = await input.textContent().catch(() => '');
        if (text.includes('hooks.zapier.com')) {
          webhookUrl = text.match(/https:\/\/hooks\.zapier\.com\/[^\s]+/)?.[0];
          console.log(`Found webhook URL in element text: ${webhookUrl}`);
          break;
        }
      }
    }

    // Try the Zapier API approach to get the webhook URL
    if (!webhookUrl) {
      console.log('\nTrying to find webhook URL via the page network or API...');
      // Look for it in the DOM more thoroughly
      const allInputs = await page.locator('input').all();
      for (const input of allInputs) {
        const val = await input.getAttribute('value').catch(() => '');
        if (val && val.includes('hooks')) {
          console.log(`Input value: ${val}`);
          if (val.includes('hooks.zapier.com')) {
            webhookUrl = val;
            break;
          }
        }
      }
    }

    // Final attempt: go directly to the trigger step URL with /test path
    if (!webhookUrl) {
      console.log('\nTrying direct URL navigation to trigger test...');
      await page.goto(`https://zapier.com/editor/${ZAP_ID}/draft/${ZAP_ID}/test`, { waitUntil: 'domcontentloaded' });
      await sleep(5000);
      await screenshot(page, 'get-06-test-page');

      const content3 = await page.content();
      const match3 = content3.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<]+/);
      if (match3) {
        webhookUrl = match3[0].replace(/&amp;/g, '&');
        console.log(`Found webhook URL on test page: ${webhookUrl}`);
      }
    }

    await screenshot(page, 'get-07-final');

    if (webhookUrl) {
      // Clean up the URL
      webhookUrl = webhookUrl.replace(/['";\s]+$/, '');
      fs.writeFileSync(WEBHOOK_OUTPUT, webhookUrl);
      console.log(`\nWebhook URL saved: ${webhookUrl}`);

      // Send test webhook
      console.log('\n[4] Sending test webhook...');
      const testPayload = {
        event: "job_finished",
        job: {
          uuid: "test-123",
          template: { name: "Montage afspraak particulier" },
          external_id: "12345678",
          status: "finished",
          client: { name: "Test Klant" }
        }
      };

      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });
        console.log(`Response: ${resp.status} ${resp.statusText}`);
        const body = await resp.text();
        console.log(`Body: ${body}`);
      } catch (e) {
        console.log(`Fetch failed: ${e.message}`);
      }

      await sleep(3000);

      // Try to test the trigger
      const testTriggerBtn = page.locator('button:has-text("Test trigger"), button:has-text("Test")').first();
      try {
        await testTriggerBtn.click({ timeout: 5000 });
        await sleep(5000);
        await screenshot(page, 'get-08-test-result');
      } catch (e) {
        console.log('Could not click test trigger');
      }
    } else {
      console.log('\nCould not find webhook URL automatically.');
      console.log('You may need to open the trigger step manually to find it.');
    }

    // Save session
    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));

    console.log('\n=== RESULT ===');
    console.log(`Zap ID: ${ZAP_ID}`);
    console.log(`Zap URL: https://zapier.com/editor/${ZAP_ID}`);
    console.log(`Webhook URL: ${webhookUrl || 'Not found - check screenshots'}`);
    console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
    console.log('==============');

    await sleep(8000);

  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    await screenshot(page, 'get-error');
  } finally {
    await browser.close();
  }
})();
