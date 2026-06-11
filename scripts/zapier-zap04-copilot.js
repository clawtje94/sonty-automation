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
  await sleep(4000);

  console.log('URL:', page.url());

  // Check if we need to login
  if (page.url().includes('/login')) {
    console.log('Need to login first...');
    await browser.close();
    return;
  }

  // Step 1: Use Copilot to describe the workflow
  console.log('\nStep 1: Using Copilot AI...');

  // Find and click the copilot textarea
  const copilotInput = await page.$('textarea[name="copilot-input"]');
  if (!copilotInput) {
    console.log('ERROR: Copilot input not found');
    await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-copilot-error.png' });
    await browser.close();
    return;
  }

  // Type the description into Copilot
  const description = `I already have a Webhooks trigger set up. For step 2, add a Filter step (Filter by Zapier) that checks if the webhook body contains "Inmeet" in the template name field. Then for step 3, add a HubSpot action to Update Deal - set the deal stage to stage ID "4999295187" (Opmeting Afgerond) in pipeline "3623322812".`;

  console.log('Typing into Copilot...');
  await copilotInput.click();
  await sleep(500);
  await copilotInput.fill(description);
  await sleep(500);

  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-copilot-typed.png' });
  console.log('Screenshot: zapier-copilot-typed.png');

  // Click the Send button
  const sendBtn = await page.$('button[aria-label="Send"]');
  if (sendBtn) {
    console.log('Clicking Send...');
    await sendBtn.click();
  } else {
    // Try pressing Enter
    console.log('Send button not found, pressing Enter...');
    await copilotInput.press('Enter');
  }

  // Wait for Copilot to respond
  console.log('Waiting for Copilot response...');
  await sleep(15000);

  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-copilot-response.png' });
  console.log('Screenshot: zapier-copilot-response.png');

  // Check what happened - get visible text from copilot area
  const copilotArea = await page.$('[class*="copilot"], [class*="Copilot"]');
  if (copilotArea) {
    const copilotText = await copilotArea.textContent();
    console.log('\nCopilot area text (first 2000 chars):');
    console.log(copilotText.substring(0, 2000));
  }

  // Check if new steps were added to the canvas
  const stepCards = await page.$$('[data-testid*="node"], [class*="StepCard"], [class*="step-card"]');
  console.log(`\nStep cards found: ${stepCards.length}`);

  // Get all visible text to understand current state
  const bodyText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while ((node = walker.nextNode()) && texts.length < 150) {
      const t = node.textContent.trim();
      if (t.length > 2 && t.length < 200) {
        const rect = node.parentElement?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          texts.push(t);
        }
      }
    }
    return [...new Set(texts)].join('\n');
  });
  console.log('\n--- Visible page text ---');
  console.log(bodyText.substring(0, 3000));

  // Wait a bit more and screenshot again
  await sleep(10000);
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-copilot-final.png' });
  console.log('\nFinal screenshot: zapier-copilot-final.png');

  // Check copilot text again after waiting
  if (copilotArea) {
    const copilotText2 = await copilotArea.textContent();
    console.log('\nCopilot area text after waiting (first 2000 chars):');
    console.log(copilotText2.substring(0, 2000));
  }

  // Look for any "Apply" or "Accept" buttons that Copilot might show
  const applyBtns = await page.$$('button');
  for (const btn of applyBtns) {
    const text = await btn.textContent().catch(() => '');
    const visible = await btn.isVisible().catch(() => false);
    if (visible && (text.includes('Apply') || text.includes('Accept') || text.includes('Yes') || text.includes('Confirm'))) {
      console.log(`Found action button: "${text.trim()}"`);
    }
  }

  // Save updated session
  const newCookies = await context.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: newCookies }, null, 2));

  await browser.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
