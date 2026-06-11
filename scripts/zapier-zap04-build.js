const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ZAP_URL = 'https://zapier.com/editor/354159297/draft/354159297/setup';
const SESSION_FILE = path.join(__dirname, '.zapier-session.json');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForCopilotDone(page, maxWait = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const stopBtn = await page.$('button:has-text("Stop")');
    if (!stopBtn || !(await stopBtn.isVisible().catch(() => false))) {
      console.log(`Copilot finished after ${Math.round((Date.now() - start)/1000)}s`);
      return true;
    }
    await sleep(3000);
    console.log(`  waiting... ${Math.round((Date.now() - start)/1000)}s`);
  }
  console.log('Copilot timed out');
  return false;
}

async function getCopilotText(page) {
  const copilotArea = await page.$('[class*="Copilot"], [class*="copilot"]');
  if (copilotArea) {
    return await copilotArea.textContent();
  }
  return '';
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

  // First, send a test webhook payload to the hook URL so there's sample data
  console.log('\nSending test webhook payload...');
  const testPayload = JSON.stringify({
    event: "job_finished",
    data: {
      job: {
        uuid: "test-job-123",
        template: {
          name: "Inmeet Opmeting Zonwering"
        },
        external_id: "12345678",
        client: {
          name: "Test Klant",
          phone: "+31612345678"
        },
        workers: [{ name: "Monteur Test" }],
        finished_at: "2026-03-13T14:00:00Z",
        custom_fields: {
          planado_job_id: "job-abc-123",
          deal_id: "12345678"
        }
      }
    }
  });

  // Send via fetch in a new page to avoid CORS
  const webhookPage = await context.newPage();
  await webhookPage.evaluate(async (payload) => {
    await fetch('https://hooks.zapier.com/hooks/catch/22982966/uxppbhy/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
  }, testPayload);
  await webhookPage.close();
  console.log('Test webhook sent!');
  await sleep(2000);

  // Now use Copilot to add the steps
  console.log('\nUsing Copilot to add steps...');
  const copilotInput = await page.$('textarea[name="copilot-input"]');
  if (!copilotInput) {
    console.log('ERROR: Copilot input not found');
    await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-build-error.png' });
    await browser.close();
    return;
  }

  const msg = `Add two steps after the webhook trigger:

Step 2: Filter by Zapier - Only continue if the raw body text contains "Inmeet" (text contains filter).

Step 3: HubSpot - Update Deal action. Connect to Sonty's HubSpot account. Set the deal stage (dealstage) to "4999295187" and use the deal ID from the webhook external_id field. The pipeline ID is "3623322812".

Please add and configure these steps now.`;

  await copilotInput.click();
  await sleep(300);
  await copilotInput.fill(msg);
  await sleep(300);

  // Send
  const sendBtn = await page.$('button[aria-label="Send"]');
  if (sendBtn) {
    await sendBtn.click();
    console.log('Message sent to Copilot');
  } else {
    await copilotInput.press('Enter');
    console.log('Message sent (Enter key)');
  }

  // Wait for Copilot to finish
  await sleep(3000);
  await waitForCopilotDone(page, 120000);

  await sleep(3000);
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-build-1.png' });
  console.log('Screenshot: zapier-build-1.png');

  // Get copilot conversation
  const copilotText = await getCopilotText(page);
  console.log('\n--- Copilot text (last 3000 chars) ---');
  console.log(copilotText.slice(-3000));

  // Check visible page
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
  console.log('\n--- Visible page text ---');
  console.log(bodyText.substring(0, 4000));

  // Check for Filter and HubSpot
  const filterEl = await page.$('text=Filter');
  const hubspotEl = await page.$('text=HubSpot');
  const updateDealEl = await page.$('text=Update Deal');
  console.log(`\nFilter on page: ${!!filterEl}`);
  console.log(`HubSpot on page: ${!!hubspotEl}`);
  console.log(`Update Deal on page: ${!!updateDealEl}`);

  // Scroll down on the canvas to see all steps
  await page.mouse.wheel(0, 500);
  await sleep(1000);
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-build-2.png' });
  console.log('Screenshot (scrolled): zapier-build-2.png');

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
