const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-02 Step 2 Configure');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Double-click Step 2
  await page.mouse.dblclick(660, 465);
  await page.waitForTimeout(5000);

  // Check where we are
  let text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Step 2 state:', text.substring(0, 800));

  // If on Setup tab, click Continue
  if (text.includes('Continue') && text.includes('Trengo')) {
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueBtn.click();
      console.log('Continue geklikt → Configure tab');
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'Z02-S2C-01-configure');
  text = await page.evaluate(() => document.body.innerText.substring(0, 4000));
  console.log('\nConfigure tab:', text.substring(0, 1200));

  // Now click Channel ID field to explore
  const channelField = page.locator('.editable-slate-field').first();
  if (await channelField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await channelField.click();
    await page.waitForTimeout(2000);

    // Click the "+" button for Channel ID
    await page.mouse.click(1228, 248);
    await page.waitForTimeout(5000);
    await ss(page, 'Z02-S2C-02-data-picker');

    // Grab all visible text to see the data picker content
    const pickerText = await page.evaluate(() => document.body.innerText.substring(0, 6000));
    console.log('\nData picker text:', pickerText.substring(0, 2000));

    // Look for Step 1 data items
    const dataItems = await page.evaluate(() => {
      const items = [];
      // Find all clickable items in the data picker
      const els = document.querySelectorAll('[role="option"], [role="treeitem"], [class*="TreeItem"], [class*="treeitem"], [class*="DataItem"], [class*="dataItem"]');
      for (const el of els) {
        if (el.offsetParent === null) continue;
        const rect = el.getBoundingClientRect();
        items.push({
          text: el.textContent?.trim().substring(0, 100) || '',
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2)
        });
      }
      return items;
    });
    console.log('\nData items:', JSON.stringify(dataItems.slice(0, 20), null, 2));

    // Try clicking on "1. Updated Deal Stage in HubSpot" to expand it
    const hubspotStep = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent.includes('Updated Deal Stage') || el.textContent.includes('HubSpot')) {
          const rect = el.getBoundingClientRect();
          // Only in the data picker area (right side, after the main fields)
          if (rect.y > 500 || rect.x > 1200) {
            return {
              text: el.textContent.trim().substring(0, 80),
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2)
            };
          }
        }
      }
      return null;
    });

    if (hubspotStep) {
      console.log(`\nHubSpot step found: ${hubspotStep.text} at (${hubspotStep.x}, ${hubspotStep.y})`);
      await page.mouse.click(hubspotStep.x, hubspotStep.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z02-S2C-03-hubspot-expanded');

      const expandedText = await page.evaluate(() => document.body.innerText.substring(0, 6000));
      console.log('\nExpanded:', expandedText.substring(expandedText.indexOf('Updated Deal'), expandedText.indexOf('Updated Deal') + 1500));
    }
  }

  await ss(page, 'Z02-S2C-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
