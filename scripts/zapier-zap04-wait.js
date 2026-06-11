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

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  if (sessionData.cookies) {
    await context.addCookies(sessionData.cookies);
  }

  const page = await context.newPage();

  console.log('Navigating to Zapier editor...');
  await page.goto(ZAP_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(5000);
  console.log('URL:', page.url());

  // Check if Copilot is still working
  const stopBtn = await page.$('button:has-text("Stop")');
  if (stopBtn && await stopBtn.isVisible()) {
    console.log('Copilot is still working... waiting up to 60 seconds');
    // Wait for the stop button to disappear (means copilot is done)
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      const still = await page.$('button:has-text("Stop")');
      if (!still || !(await still.isVisible().catch(() => false))) {
        console.log(`Copilot finished after ~${(i+1)*5} seconds`);
        break;
      }
      console.log(`Still working... ${(i+1)*5}s`);
    }
  } else {
    console.log('Copilot is not running (or already finished)');
  }

  await sleep(3000);

  // Take screenshot of current state
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-after-copilot.png' });
  console.log('Screenshot: zapier-after-copilot.png');

  // Get the Copilot conversation text
  const copilotArea = await page.$('[class*="Copilot"], [class*="copilot"]');
  if (copilotArea) {
    const copilotText = await copilotArea.textContent();
    console.log('\n--- Copilot conversation ---');
    console.log(copilotText.substring(0, 5000));
  }

  // Get full page visible text
  const bodyText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while ((node = walker.nextNode()) && texts.length < 300) {
      const t = node.textContent.trim();
      if (t.length > 2 && t.length < 300) {
        const rect = node.parentElement?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          texts.push(t);
        }
      }
    }
    return [...new Set(texts)].join('\n');
  });
  console.log('\n--- Full visible text ---');
  console.log(bodyText.substring(0, 4000));

  // Check for any steps in the zap
  console.log('\n--- Looking for step elements ---');
  const stepElements = await page.$$('[class*="StepCard"], [data-testid*="node"]');
  console.log(`Found ${stepElements.length} step elements`);

  // Look for Filter and HubSpot mentions
  const filterMention = await page.$('text=Filter');
  const hubspotMention = await page.$('text=HubSpot');
  console.log(`Filter found: ${!!filterMention}`);
  console.log(`HubSpot found: ${!!hubspotMention}`);

  // Save session
  const newCookies = await context.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: newCookies }, null, 2));

  await browser.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
