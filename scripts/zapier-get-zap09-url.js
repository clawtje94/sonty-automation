const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '.zapier-session.json');
const WEBHOOK_OUTPUT = path.join(__dirname, '.zapier-webhook-url-zap09.txt');

async function screenshot(page, name) {
  const filepath = `/tmp/zap09-get-url-${name}.png`;
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot: ${filepath}`);
  return filepath;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('=== ZAP-09: Get Webhook URL ===\n');

  const browser = await chromium.launch({ headless: true });
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
    // Step 1: Navigate to Zapier zaps list
    console.log('\n[Step 1] Navigating to Zapier zaps list...');
    await page.goto('https://zapier.com/app/assets/zaps', { waitUntil: 'domcontentloaded' });
    await sleep(4000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Login if needed
    if (currentUrl.includes('/sign-up') || currentUrl.includes('/login') || currentUrl.includes('/app/login')) {
      console.log('Session expired, logging in...');
      await page.goto('https://zapier.com/app/login', { waitUntil: 'domcontentloaded' });
      await sleep(2000);

      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill('daimy@sonty.nl');

      const continueBtn = page.locator('button[type="submit"], button:has-text("Continue")').first();
      await continueBtn.click();
      await sleep(3000);

      const passInput = page.locator('input[name="password"], input[type="password"]').first();
      await passInput.waitFor({ state: 'visible', timeout: 10000 });
      await passInput.fill('D^mR&F%82WtBrVK&fnm8');

      const signInBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first();
      await signInBtn.click();
      await sleep(5000);

      const cookies = await context.cookies();
      fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));
      console.log('Session saved.');

      await page.goto('https://zapier.com/app/assets/zaps', { waitUntil: 'domcontentloaded' });
      await sleep(4000);
    }

    // Dismiss cookie banner if present
    try {
      const cookieBtn = page.locator('button:has-text("Accept all cookies")');
      if (await cookieBtn.isVisible({ timeout: 2000 })) {
        await cookieBtn.click();
        await sleep(1000);
      }
    } catch (e) { /* no cookie banner */ }

    console.log('On zaps page.');
    await screenshot(page, '01-zaps-list');

    // Step 2: Search for and find ZAP-09
    console.log('\n[Step 2] Searching for ZAP-09...');

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    try {
      await searchInput.waitFor({ state: 'visible', timeout: 5000 });
      await searchInput.fill('Planado job_finished');
      await sleep(2000);
      await screenshot(page, '02-search');
    } catch (e) {
      console.log('No search box found.');
    }

    // Step 3: Click on the zap name link to open it in the editor
    console.log('\n[Step 3] Opening ZAP-09 in editor...');

    // The zap name is a clickable link. We need to click the name text, not the row.
    // From the screenshot, the name shows as "Planado job_finished to HubS..."
    // Let's find the link that contains "Planado job_finished"
    const zapNameLink = page.locator('a:has-text("Planado job_finished")').first();

    try {
      await zapNameLink.waitFor({ state: 'visible', timeout: 10000 });
      const href = await zapNameLink.getAttribute('href');
      console.log(`Zap link href: ${href}`);

      if (href && href.includes('/editor/')) {
        // Navigate directly to the editor URL
        const fullUrl = href.startsWith('http') ? href : `https://zapier.com${href}`;
        console.log(`Navigating to: ${fullUrl}`);
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
      } else {
        // Click the link
        await zapNameLink.click();
      }
    } catch (e) {
      console.log(`Could not find zap link: ${e.message}`);
      // Try getting all links on the page
      const allLinks = await page.locator('a[href*="/editor/"]').all();
      console.log(`Found ${allLinks.length} editor links`);
      for (const link of allLinks) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        console.log(`  ${text.trim().substring(0, 50)} -> ${href}`);
        if (text.includes('Planado') || text.includes('job_finished')) {
          console.log('  >>> Clicking this one');
          await page.goto(`https://zapier.com${href}`, { waitUntil: 'domcontentloaded' });
          break;
        }
      }
    }

    await sleep(5000);
    await screenshot(page, '03-editor');
    console.log(`Editor URL: ${page.url()}`);

    // If we ended up on a folder page instead of editor, try clicking the zap name there
    if (page.url().includes('/folders/')) {
      console.log('Landed on folder page, finding zap and clicking...');
      const zapLink2 = page.locator('a:has-text("Planado job_finished")').first();
      const href2 = await zapLink2.getAttribute('href');
      console.log(`Zap link href: ${href2}`);
      if (href2) {
        const fullUrl = href2.startsWith('http') ? href2 : `https://zapier.com${href2}`;
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
        await sleep(5000);
        await screenshot(page, '03b-editor');
        console.log(`Editor URL: ${page.url()}`);
      }
    }

    // Step 4: Now in the editor, find and click the trigger step
    console.log('\n[Step 4] Finding trigger step...');

    // First check if webhook URL is already visible in page HTML
    let webhookUrl = null;
    let pageContent = await page.content();
    let hookMatch = pageContent.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+\/?/);
    if (hookMatch) {
      webhookUrl = hookMatch[0];
      console.log(`Found webhook URL in page HTML: ${webhookUrl}`);
    }

    if (!webhookUrl) {
      // Click on the trigger step - it should be "Webhooks by Zapier" or "Catch Raw Hook"
      const triggerSelectors = [
        'text=Catch Raw Hook',
        'text=Catch Hook',
        'text=Webhooks by Zapier',
        'text=1. Trigger',
        '[data-testid*="node"]:first-child',
        'button:has-text("Webhooks")',
      ];

      for (const sel of triggerSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 3000 })) {
            console.log(`Clicking trigger: ${sel}`);
            await el.click();
            await sleep(3000);
            await screenshot(page, '04-trigger-clicked');
            break;
          }
        } catch (e) { /* try next */ }
      }

      // Check for webhook URL again
      pageContent = await page.content();
      hookMatch = pageContent.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+\/?/);
      if (hookMatch) {
        webhookUrl = hookMatch[0];
        console.log(`Found webhook URL: ${webhookUrl}`);
      }
    }

    if (!webhookUrl) {
      // Try clicking "Test" or other tabs in the trigger config panel
      console.log('Looking in trigger config tabs...');

      const tabSelectors = [
        'button:has-text("Test")',
        '[role="tab"]:has-text("Test")',
        'button:has-text("Configure")',
        'button:has-text("Trigger")',
        'button:has-text("Set up")',
      ];

      for (const sel of tabSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 2000 })) {
            console.log(`  Clicking: ${sel}`);
            await el.click();
            await sleep(2000);

            pageContent = await page.content();
            hookMatch = pageContent.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+\/?/);
            if (hookMatch) {
              webhookUrl = hookMatch[0];
              console.log(`Found webhook URL in tab: ${webhookUrl}`);
              break;
            }
          }
        } catch (e) { /* try next */ }
      }
    }

    if (!webhookUrl) {
      // Look in visible text — match the URL pattern (account_id/hook_id/ format)
      const bodyText = await page.locator('body').textContent();
      hookMatch = bodyText.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+\/?/);
      if (hookMatch) {
        webhookUrl = hookMatch[0];
        console.log(`Found webhook URL in body text: ${webhookUrl}`);
      }
    }

    if (!webhookUrl) {
      // Try scrolling down in the trigger panel - the URL might be below the fold
      console.log('Scrolling trigger panel...');
      const panel = page.locator('[class*="panel"], [class*="Panel"], [class*="sidebar"], aside, [role="complementary"]').first();
      try {
        await panel.evaluate(el => el.scrollTop = el.scrollHeight);
        await sleep(1000);
        pageContent = await page.content();
        hookMatch = pageContent.match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+\/?/);
        if (hookMatch) {
          webhookUrl = hookMatch[0];
          console.log(`Found webhook URL after scroll: ${webhookUrl}`);
        }
      } catch (e) { /* no panel found */ }
    }

    if (!webhookUrl) {
      // Use Zapier internal API to get the webhook URL for this zap
      console.log('Trying Zapier API...');
      const editorUrl = page.url();
      const zapIdMatch = editorUrl.match(/\/editor\/(\d+)/);

      if (zapIdMatch) {
        const zapId = zapIdMatch[1];
        console.log(`Zap ID: ${zapId}`);

        const apiResult = await page.evaluate(async (id) => {
          const endpoints = [
            `https://zapier.com/api/v4/zaps/${id}`,
            `https://zapier.com/api/v4/zaps/${id}/steps`,
            `https://zapier.com/api/v3/zaps/${id}`,
          ];
          const results = {};
          for (const url of endpoints) {
            try {
              const resp = await fetch(url, { credentials: 'include' });
              results[url] = { status: resp.status, data: resp.ok ? await resp.json() : await resp.text().then(t => t.substring(0, 200)) };
            } catch (e) {
              results[url] = { error: e.message };
            }
          }
          return results;
        }, zapId);

        console.log('API results:');
        for (const [url, result] of Object.entries(apiResult)) {
          const str = JSON.stringify(result).substring(0, 300);
          console.log(`  ${url}: ${str}`);

          // Check for webhook URL in the response
          const m = JSON.stringify(result).match(/https:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<\\]+/);
          if (m) {
            webhookUrl = m[0];
            console.log(`Found webhook URL in API: ${webhookUrl}`);
          }
        }
      }
    }

    await screenshot(page, '05-final');

    // Step 5: Save result
    if (webhookUrl) {
      webhookUrl = webhookUrl.replace(/[,;)\]}>\\]+$/, '');
      fs.writeFileSync(WEBHOOK_OUTPUT, webhookUrl);
      console.log(`\nWebhook URL saved to: ${WEBHOOK_OUTPUT}`);
      console.log(`URL: ${webhookUrl}`);
    } else {
      console.log('\nERROR: Could not extract webhook URL.');
      console.log('Dumping page content for debugging...');
      const text = await page.locator('body').textContent();
      console.log('Body text (first 3000 chars):');
      console.log(text.substring(0, 3000));
    }

    // Save session
    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));
    console.log('\nSession cookies saved.');
    console.log('=== DONE ===');

  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    console.error(error.stack);
    await screenshot(page, 'error');

    const cookies = await context.cookies();
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies }, null, 2));
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
