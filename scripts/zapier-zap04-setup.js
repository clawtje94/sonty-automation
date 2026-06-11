const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ZAP_URL = 'https://zapier.com/editor/354159297/draft/354159297/setup';
const SESSION_FILE = path.join(__dirname, '.zapier-session.json');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  // Load saved cookies
  if (sessionData.cookies && sessionData.cookies.length > 0) {
    await context.addCookies(sessionData.cookies);
    console.log(`Loaded ${sessionData.cookies.length} cookies`);
  }

  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  console.log('Navigating to Zapier editor...');
  try {
    await page.goto(ZAP_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log('Navigation timeout (expected for React SPA), continuing...');
  }

  await sleep(3000);

  // Check if we're logged in or redirected to login
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  if (currentUrl.includes('/login') || currentUrl.includes('/sign-up')) {
    console.log('Session expired, need to login...');

    // Try logging in
    try {
      await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
      await page.fill('input[name="email"], input[type="email"]', 'daimy@sonty.nl');

      // Look for next/continue button
      const nextBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
      if (nextBtn) await nextBtn.click();
      await sleep(2000);

      // Fill password
      await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });
      await page.fill('input[name="password"], input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');

      const loginBtn = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
      if (loginBtn) await loginBtn.click();

      console.log('Login submitted, waiting...');
      await sleep(8000);

      console.log('Post-login URL:', page.url());

      // Save updated session
      const newCookies = await context.cookies();
      fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: newCookies }, null, 2));
      console.log('Session saved');

      // Navigate to editor
      if (!page.url().includes('/editor/')) {
        await page.goto(ZAP_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
        await sleep(3000);
      }
    } catch (loginErr) {
      console.log('Login error:', loginErr.message);
    }
  }

  console.log('On page:', page.url());

  // Take screenshot to see current state
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-state-1.png', fullPage: false });
  console.log('Screenshot saved: zapier-state-1.png');

  // Check page title and content
  const title = await page.title();
  console.log('Page title:', title);

  // Look for the Copilot/AI input
  console.log('\nSearching for Copilot AI input...');

  const selectors = [
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="describe"]',
    'input[placeholder*="Describe"]',
    'input[placeholder*="describe"]',
    'textarea[placeholder*="workflow"]',
    'input[placeholder*="workflow"]',
    '[data-testid*="copilot"]',
    '[data-testid*="ai"]',
    '[class*="copilot"]',
    '[class*="Copilot"]',
    '[aria-label*="Copilot"]',
    '[aria-label*="copilot"]',
    '[aria-label*="Describe"]',
  ];

  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      console.log(`Found element: ${sel}`);
      const text = await el.textContent().catch(() => '');
      const placeholder = await el.getAttribute('placeholder').catch(() => '');
      console.log(`  text: ${text}, placeholder: ${placeholder}`);
    }
  }

  // Look for any text inputs/textareas on the page
  const allInputs = await page.$$('input, textarea');
  console.log(`\nFound ${allInputs.length} input/textarea elements`);
  for (let i = 0; i < Math.min(allInputs.length, 15); i++) {
    const inp = allInputs[i];
    const tag = await inp.evaluate(el => el.tagName);
    const type = await inp.getAttribute('type').catch(() => '');
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const ariaLabel = await inp.getAttribute('aria-label').catch(() => '');
    const name = await inp.getAttribute('name').catch(() => '');
    const visible = await inp.isVisible().catch(() => false);
    console.log(`  [${i}] ${tag} type=${type} name=${name} placeholder="${placeholder}" aria-label="${ariaLabel}" visible=${visible}`);
  }

  // Look for buttons that might relate to adding steps
  console.log('\nSearching for key buttons...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.textContent().catch(() => '');
    const visible = await btn.isVisible().catch(() => false);
    if (visible && text.trim().length > 0 && text.trim().length < 80) {
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      console.log(`  Button: "${text.trim()}" aria-label="${ariaLabel}"`);
    }
  }

  // Try to find the "+" button to add a new step
  console.log('\nLooking for add step button...');
  const addStepSelectors = [
    'button[aria-label*="Add"]',
    'button[aria-label*="add"]',
    'button:has-text("Add a step")',
    'button:has-text("Add step")',
    '[data-testid*="add-step"]',
    '[data-testid*="add_step"]',
    'button[class*="add"]',
  ];

  for (const sel of addStepSelectors) {
    const els = await page.$$(sel);
    for (const el of els) {
      const visible = await el.isVisible().catch(() => false);
      const text = await el.textContent().catch(() => '');
      if (visible) {
        console.log(`  Found: ${sel} -> "${text.trim()}"`);
      }
    }
  }

  // Get the full page text to understand the layout
  const bodyText = await page.evaluate(() => {
    // Get visible text, limited
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while ((node = walker.nextNode()) && texts.length < 200) {
      const t = node.textContent.trim();
      if (t.length > 2 && t.length < 200) {
        const rect = node.parentElement?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          texts.push(t);
        }
      }
    }
    return texts.join('\n');
  });

  console.log('\n--- Visible page text (first 3000 chars) ---');
  console.log(bodyText.substring(0, 3000));

  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-state-2.png', fullPage: true });
  console.log('\nFull page screenshot saved: zapier-state-2.png');

  await browser.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
