const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function checkTrigger(page, zapId, zapName) {
  console.log(`\n====== ${zapName} (${zapId}) ======`);
  await page.goto(`https://zapier.com/editor/${zapId}/draft`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click Step 1
  const step1 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Updated Deal Stage') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 200 && rect.y < 400) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step1) {
    await page.mouse.click(step1.x, step1.y);
    await page.waitForTimeout(5000);
  }

  // Click Configure breadcrumb
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);

  await ss(page, `VERIFY-${zapName.replace(/[^a-zA-Z0-9]/g, '')}`);

  // Get the configure field values
  const configText = await page.evaluate(() => {
    const panel = document.querySelector('[class*="side-panel"], [class*="SidePanel"]');
    const text = (panel || document.body).innerText;
    return text.substring(0, 3000);
  });

  // Extract pipeline and stage
  const pipelineMatch = configText.match(/Pipeline[\s\S]*?(Sonty[^]*?)(?=\n|$)/i);
  const stageMatch = configText.match(/Stage[\s\S]*?(?:Choose value|([A-Za-z].*?))(?=\n|$)/i);

  console.log('Config excerpt:');
  const configIdx = configText.indexOf('Pipeline');
  if (configIdx > 0) {
    console.log(configText.substring(configIdx, configIdx + 500));
  } else {
    console.log(configText.substring(0, 500));
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 Verify trigger configuratie');

  // Check ZAP-03
  await checkTrigger(page, '353373774', 'ZAP-03');

  // Check ZAP-08
  await checkTrigger(page, '353424667', 'ZAP-08');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
