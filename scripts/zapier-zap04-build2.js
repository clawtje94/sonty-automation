const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ZAP_URL = 'https://zapier.com/editor/354159297/draft/354159297/setup';
const SESSION_FILE = path.join(__dirname, '.zapier-session.json');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function sendWebhook() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      event: "job_finished",
      data: {
        job: {
          uuid: "test-job-123",
          template: { name: "Inmeet Opmeting Zonwering" },
          external_id: "12345678",
          client: { name: "Test Klant", phone: "+31612345678" },
          workers: [{ name: "Monteur Test" }],
          finished_at: "2026-03-13T14:00:00Z"
        }
      }
    });

    const req = https.request('https://hooks.zapier.com/hooks/catch/22982966/uxppbhy/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Webhook response: ${res.statusCode} - ${data.substring(0, 200)}`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Send test webhook first
  console.log('Sending test webhook...');
  await sendWebhook();
  await sleep(2000);

  const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  if (sessionData.cookies) await context.addCookies(sessionData.cookies);

  const page = await context.newPage();
  console.log('Navigating to Zapier editor...');
  await page.goto(ZAP_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(5000);
  console.log('URL:', page.url());

  // Use Copilot
  const copilotInput = await page.$('textarea[name="copilot-input"]');
  if (!copilotInput) {
    console.log('ERROR: Copilot input not found');
    await browser.close();
    return;
  }

  const msg = `Add two new steps to this zap after the webhook trigger:

1. A "Filter by Zapier" step that only continues if the raw body text contains the word "Inmeet"

2. A "HubSpot" action using "Update Deal" event. Set dealstage to 4999295187. The Object ID should use the external_id from step 1's webhook data. Pipeline is 3623322812.

Add and fully configure both steps now.`;

  await copilotInput.click();
  await sleep(300);
  await copilotInput.fill(msg);
  await sleep(300);

  const sendBtn = await page.$('button[aria-label="Send"]');
  if (sendBtn) {
    await sendBtn.click();
    console.log('Message sent to Copilot');
  }

  // Wait for completion with periodic screenshots
  console.log('Waiting for Copilot to work...');
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const stopBtn = await page.$('button:has-text("Stop")');
    const isRunning = stopBtn && await stopBtn.isVisible().catch(() => false);
    if (!isRunning) {
      console.log(`Copilot finished after ~${(i+1)*5}s`);
      break;
    }
    if (i % 3 === 2) {
      // Periodic update
      const copilotArea = await page.$('[class*="Copilot"], [class*="copilot"]');
      if (copilotArea) {
        const text = await copilotArea.textContent();
        console.log(`  [${(i+1)*5}s] Last 500 chars: ${text.slice(-500)}`);
      }
    }
    console.log(`  still working... ${(i+1)*5}s`);
  }

  await sleep(3000);

  // Take screenshots
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-result-1.png' });
  console.log('Screenshot: zapier-result-1.png');

  // Get copilot text
  const copilotArea = await page.$('[class*="Copilot"], [class*="copilot"]');
  if (copilotArea) {
    const text = await copilotArea.textContent();
    console.log('\n--- Copilot conversation (last 4000 chars) ---');
    console.log(text.slice(-4000));
  }

  // Get visible text
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
  console.log('\n--- Visible text ---');
  console.log(bodyText.substring(0, 4000));

  // Check step count
  const filterEl = await page.$$('text=Filter');
  const hubspotEl = await page.$$('text=HubSpot');
  console.log(`\nFilter elements: ${filterEl.length}`);
  console.log(`HubSpot elements: ${hubspotEl.length}`);

  // Scroll canvas to see all steps
  const canvas = await page.$('[class*="canvas"], [class*="Canvas"]');
  if (canvas) {
    await canvas.evaluate(el => el.scrollTop = 1000);
  }
  await page.mouse.wheel(0, 800);
  await sleep(1000);
  await page.screenshot({ path: '/Users/clawdboot/sonty/scripts/zapier-result-2.png' });
  console.log('Screenshot (scrolled): zapier-result-2.png');

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
