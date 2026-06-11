const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '.zapier-session.json');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const WEBHOOK_OUTPUT = path.join(__dirname, 'zap09-webhook-url.txt');

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `zap09-${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('=== ZAP-09: Installation Done — Playwright Automation ===\n');

  // Launch browser (headed so we can see what's happening)
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Load saved session cookies
  if (fs.existsSync(SESSION_PATH)) {
    const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    if (session.cookies && session.cookies.length > 0) {
      console.log(`Loading ${session.cookies.length} saved cookies...`);
      await context.addCookies(session.cookies);
    }
  }

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // Step 1: Check if we're logged in by going to Zapier
    console.log('\n[Step 1] Navigating to Zapier...');
    await page.goto('https://zapier.com/app/assets/zaps', { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    await screenshot(page, '01-initial-load');

    // Check if we need to login
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/sign-up') || currentUrl.includes('/login') || currentUrl.includes('/app/login')) {
      console.log('Session expired, logging in fresh...');

      // Go to login page
      await page.goto('https://zapier.com/app/login', { waitUntil: 'domcontentloaded' });
      await sleep(2000);

      // Fill email
      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill('daimy@sonty.nl');

      // Click continue/next
      const continueBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next")').first();
      await continueBtn.click();
      await sleep(2000);

      // Fill password
      const passInput = page.locator('input[name="password"], input[type="password"]').first();
      await passInput.waitFor({ state: 'visible', timeout: 10000 });
      await passInput.fill('D^mR&F%82WtBrVK&fnm8');

      // Click sign in
      const signInBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
      await signInBtn.click();
      await sleep(5000);

      await screenshot(page, '02-after-login');

      // Save new session
      const cookies = await context.cookies();
      fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));
      console.log('Session saved.');

      // Navigate to zaps page
      await page.goto('https://zapier.com/app/assets/zaps', { waitUntil: 'domcontentloaded' });
      await sleep(3000);
    }

    console.log('Logged in successfully.');
    await screenshot(page, '02-zaps-page');

    // Step 2: Click "+ Create" button to create new zap
    console.log('\n[Step 2] Creating new Zap...');

    // Look for Create button
    const createBtn = page.locator('button:has-text("Create"), a:has-text("Create")').first();
    await createBtn.waitFor({ state: 'visible', timeout: 15000 });
    await createBtn.click();
    await sleep(1500);

    await screenshot(page, '03-create-menu');

    // Click "Zap" from the dropdown/menu
    // The dropdown might show: Zap, Table, Interface, etc.
    const zapOption = page.locator('text=Zap').first();
    await zapOption.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('No dropdown appeared, might have gone directly to editor');
    });

    try {
      // Try to find and click "Zap" in menu - might be a menuitem, link, or button
      const zapMenuItem = page.locator('[role="menuitem"]:has-text("Zap"), a:has-text("Zap"), button:has-text("Zap")').first();
      await zapMenuItem.click({ timeout: 5000 });
    } catch (e) {
      console.log('Could not find Zap menu item, trying alternative...');
      // Maybe we need to look for "New Zap" or navigate directly
      await page.goto('https://zapier.com/app/editor', { waitUntil: 'domcontentloaded' });
    }

    await sleep(5000);
    await screenshot(page, '04-zap-editor');
    console.log(`Editor URL: ${page.url()}`);

    // Step 3: First, we need to set up the Webhook trigger to get the URL
    // Before using Copilot, let's check if we're in the editor
    console.log('\n[Step 3] Setting up Webhook trigger to get URL...');

    // The Zapier editor should show trigger selection
    // Look for the trigger node or "Choose app & event"
    // First try the Copilot approach - look for the describe workflow area

    // Look for the Copilot text area at top
    const copilotInput = page.locator('textarea[placeholder*="Describe"], textarea[placeholder*="describe"], input[placeholder*="Describe"], input[placeholder*="describe"], [data-testid*="copilot"] textarea, [data-testid*="copilot"] input').first();

    let usedCopilot = false;

    try {
      await copilotInput.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Found Copilot input!');

      // But first we need the webhook URL, so let's set up the trigger manually first
      // Actually, let's use Copilot to build it, then get the webhook URL after

      // Type the description
      const description = "When I receive a webhook from Planado with a job_finished event containing 'Montage' in the body, update a HubSpot deal. Set the deal pipeline to 'Sonty Verkooppijplijn' and deal stage to 'Installatie Afgerond'. Use the external_id from the webhook as the deal Object ID.";

      await copilotInput.click();
      await sleep(500);
      await copilotInput.fill(description);
      await sleep(1000);

      await screenshot(page, '05-copilot-description');

      // Click "Start building" or press Enter
      const startBuildBtn = page.locator('button:has-text("Start building"), button:has-text("Generate"), button[type="submit"]').first();
      try {
        await startBuildBtn.click({ timeout: 5000 });
      } catch (e) {
        console.log('No Start building button found, pressing Enter...');
        await copilotInput.press('Enter');
      }

      usedCopilot = true;
      console.log('Copilot is building the Zap...');

      // Wait for Copilot to finish building (up to 60 seconds)
      await sleep(10000);
      await screenshot(page, '06-copilot-building');

      // Wait for the zap to be built - check for step indicators
      let buildComplete = false;
      for (let i = 0; i < 10; i++) {
        await sleep(5000);
        // Check if steps are visible (trigger + action)
        const steps = await page.locator('[data-testid*="step"], [class*="Step"], .node-wrapper, [class*="node"]').count();
        console.log(`  Check ${i+1}: Found ${steps} step elements`);
        if (steps >= 2) {
          buildComplete = true;
          break;
        }
        // Also check if there's a loading/building indicator
        const loading = await page.locator('[class*="loading"], [class*="Loading"], [class*="progress"], [class*="building"]').count();
        if (loading === 0 && i > 2) {
          buildComplete = true;
          break;
        }
      }

      await screenshot(page, '07-copilot-result');
      console.log(`Copilot build complete: ${buildComplete}`);

    } catch (e) {
      console.log('Copilot input not found, will set up manually...');
      console.log(`Error: ${e.message}`);
      await screenshot(page, '05-no-copilot');
    }

    // Step 4: Now we need to find and extract the webhook URL
    console.log('\n[Step 4] Looking for webhook URL...');

    // Click on the trigger step to open its configuration
    // The trigger should be "Webhooks by Zapier" - "Catch Hook"
    const triggerStep = page.locator('[data-testid*="trigger"], [class*="trigger"], .node-wrapper:first-child, [class*="Trigger"]').first();
    try {
      await triggerStep.click({ timeout: 5000 });
      await sleep(3000);
    } catch (e) {
      console.log('Could not click trigger step directly, looking for alternatives...');
      // Try clicking the first step/node in the editor
      const firstStep = page.locator('[class*="node"]:first-child, [class*="step"]:first-child').first();
      try {
        await firstStep.click({ timeout: 5000 });
        await sleep(3000);
      } catch (e2) {
        console.log('Could not find trigger step to click');
      }
    }

    await screenshot(page, '08-trigger-config');

    // Look for the webhook URL in the page
    // It's usually displayed as "Your webhook URL is: https://hooks.zapier.com/hooks/catch/..."
    let webhookUrl = null;

    // Try to find webhook URL in the page text
    const pageContent = await page.content();
    const hookMatch = pageContent.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<]+/);
    if (hookMatch) {
      webhookUrl = hookMatch[0];
      console.log(`Found webhook URL: ${webhookUrl}`);
    } else {
      console.log('Webhook URL not found in page content yet...');

      // We might need to click through the trigger setup to get the URL
      // Look for "Test" tab or "Test trigger" section
      const testTab = page.locator('button:has-text("Test"), [role="tab"]:has-text("Test"), a:has-text("Test trigger")').first();
      try {
        await testTab.click({ timeout: 5000 });
        await sleep(3000);

        const pageContent2 = await page.content();
        const hookMatch2 = pageContent2.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<]+/);
        if (hookMatch2) {
          webhookUrl = hookMatch2[0];
          console.log(`Found webhook URL after clicking Test: ${webhookUrl}`);
        }
      } catch (e) {
        console.log('Could not find Test tab');
      }
    }

    // If we still don't have the URL, look for it in any visible text
    if (!webhookUrl) {
      const allText = await page.locator('body').textContent();
      const hookMatch3 = allText.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<\])+]+/);
      if (hookMatch3) {
        webhookUrl = hookMatch3[0];
        console.log(`Found webhook URL in body text: ${webhookUrl}`);
      }
    }

    await screenshot(page, '09-webhook-url');

    // Step 5: If we have the webhook URL, send test data
    if (webhookUrl) {
      console.log(`\n[Step 5] Sending test webhook to: ${webhookUrl}`);

      // Save webhook URL
      fs.writeFileSync(WEBHOOK_OUTPUT, webhookUrl);
      console.log(`Webhook URL saved to: ${WEBHOOK_OUTPUT}`);

      // Send test data using fetch (Node 18+)
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
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });
        console.log(`Test webhook response: ${response.status} ${response.statusText}`);
        const respText = await response.text();
        console.log(`Response body: ${respText}`);
      } catch (e) {
        console.log(`Failed to send test webhook: ${e.message}`);
        console.log('You can send it manually with curl.');
      }

      await sleep(3000);

      // Click "Test trigger" to pull in the test data
      const testTriggerBtn = page.locator('button:has-text("Test trigger"), button:has-text("Test"), button:has-text("Get samples")').first();
      try {
        await testTriggerBtn.click({ timeout: 5000 });
        await sleep(5000);
        await screenshot(page, '10-test-trigger-result');
      } catch (e) {
        console.log('Could not click test trigger button');
      }
    } else {
      console.log('\n[Step 5] Could not find webhook URL automatically.');
      console.log('The URL should be visible in the Zapier editor trigger configuration.');
    }

    // Step 6: Final screenshots
    console.log('\n[Step 6] Taking final screenshots...');
    await screenshot(page, '11-final-state');

    // Try to get the zap name/URL
    const editorUrl = page.url();
    console.log(`\nEditor URL: ${editorUrl}`);

    // Extract zap ID from URL
    const zapIdMatch = editorUrl.match(/\/editor\/(\d+)/);
    if (zapIdMatch) {
      console.log(`Zap ID: ${zapIdMatch[1]}`);
    }

    // Rename the zap to "ZAP-09: Installation Done (Planado → HubSpot)"
    console.log('\n[Step 7] Renaming the Zap...');
    // Look for the zap name/title area
    const zapTitle = page.locator('[data-testid*="zap-name"], [data-testid*="title"], input[aria-label*="name"], [class*="ZapTitle"], [class*="zap-title"]').first();
    try {
      await zapTitle.click({ timeout: 5000 });
      await sleep(500);
      // Clear and type new name
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('ZAP-09: Installation Done (Planado → HubSpot)');
      await page.keyboard.press('Enter');
      await sleep(1000);
      await screenshot(page, '12-renamed');
      console.log('Zap renamed successfully.');
    } catch (e) {
      console.log('Could not rename zap automatically. You can rename it in the editor.');
    }

    // Save session cookies for future use
    const newCookies = await context.cookies();
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies: newCookies }, null, 2));
    console.log('Session cookies updated.');

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Webhook URL: ${webhookUrl || 'Not captured - check screenshots'}`);
    console.log(`Editor URL: ${editorUrl}`);
    console.log(`Screenshots saved in: ${SCREENSHOTS_DIR}`);
    console.log('================\n');

    // Keep browser open for 10 seconds for visual verification
    console.log('Browser will close in 10 seconds...');
    await sleep(10000);

  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    await screenshot(page, 'error-state');

    // Save session even on error
    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
