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
  console.log('🎬 ZAP-02 Channel ID + data picker');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Double-click Step 2
  await page.mouse.dblclick(660, 465);
  await page.waitForTimeout(6000);
  await ss(page, 'Z02-DP-01-open');

  // Click the Channel ID editable field
  const channelField = page.locator('.editable-slate-field').first();
  await channelField.click();
  await page.waitForTimeout(2000);

  // Click the "+" button for Channel ID (at x=1228, y=248)
  await page.mouse.click(1228, 248);
  await page.waitForTimeout(5000);
  await ss(page, 'Z02-DP-02-plus-clicked');

  // Check what appeared - data picker dropdown
  const pickerContent = await page.evaluate(() => {
    const result = { items: [], panels: [], text: '' };

    // Look for the data picker panel/dropdown
    const panels = document.querySelectorAll('[class*="picker"], [class*="Picker"], [class*="panel"], [class*="Panel"], [class*="mapper"], [class*="Mapper"], [class*="dropdown"], [class*="Dropdown"], [class*="popover"], [class*="Popover"]');
    for (const p of panels) {
      if (p.offsetParent === null) continue;
      const rect = p.getBoundingClientRect();
      if (rect.width < 50) continue;
      result.panels.push({
        class: p.className?.substring?.(0, 80) || '',
        text: p.textContent?.trim().substring(0, 300) || '',
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      });
    }

    // Look for list items within any visible dropdown
    const items = document.querySelectorAll('[role="option"], [role="menuitem"], [class*="item"], [class*="Item"]');
    for (const item of items) {
      if (item.offsetParent === null) continue;
      const rect = item.getBoundingClientRect();
      // Only items that appear to be in a dropdown (floating, right side)
      if (rect.x < 800 || rect.width < 100) continue;
      const text = item.textContent?.trim().substring(0, 100) || '';
      if (text.length > 2) {
        result.items.push({
          text,
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2)
        });
      }
    }

    // Also grab ALL visible text in the area where the picker would appear
    const bodyText = document.body.innerText;
    result.text = bodyText.substring(0, 5000);

    return result;
  });

  console.log('\nPanels:', JSON.stringify(pickerContent.panels.slice(0, 5), null, 2));
  console.log('\nItems:', JSON.stringify(pickerContent.items.slice(0, 15), null, 2));
  console.log('\nFull text (relevant):', pickerContent.text.substring(0, 2000));

  await ss(page, 'Z02-DP-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
