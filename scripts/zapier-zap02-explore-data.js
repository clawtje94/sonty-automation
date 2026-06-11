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
  console.log('🎬 ZAP-02 data verkennen');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Double-click Step 2
  await page.mouse.dblclick(660, 465);
  await page.waitForTimeout(5000);

  // Click on Channel ID field
  const channelField = page.locator('.editable-slate-field').first();
  await channelField.click();
  await page.waitForTimeout(2000);

  // Click the "+" button for Channel ID to open data picker
  await page.mouse.click(1228, 248);
  await page.waitForTimeout(5000);

  // Try to expand Step 1 data by clicking on "Updated Deal Stage in HubSpot"
  // From previous output, it shows at the bottom of the picker
  const step1Item = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'Updated Deal Stage in HubSpot' || text === '1.\nUpdated Deal Stage in HubSpot') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 400) { // In the data picker area
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: text.substring(0, 50) };
        }
      }
    }
    // Try finding just "Updated Deal Stage"
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text.includes('Updated Deal Stage') && !text.includes('Channel') && !text.includes('Configure')) {
        const rect = el.getBoundingClientRect();
        if (rect.y > 450) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: text.substring(0, 50) };
        }
      }
    }
    return null;
  });

  if (step1Item) {
    console.log(`Step 1 item found: "${step1Item.text}" at (${step1Item.x}, ${step1Item.y})`);
    await page.mouse.click(step1Item.x, step1Item.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z02-EXP-01-step1-clicked');

    // Now grab all the data fields that appeared
    const dataFields = await page.evaluate(() => {
      const result = [];
      // The data picker shows field names - grab all visible text in the picker area
      const allEls = document.querySelectorAll('*');
      const seen = new Set();
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.offsetParent === null) continue;
        const rect = el.getBoundingClientRect();
        if (rect.y < 500 || rect.x < 800) continue; // Data picker is at the bottom
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && text.length < 100 && !seen.has(text)) {
          seen.add(text);
          result.push({
            text,
            x: Math.round(rect.x),
            y: Math.round(rect.y)
          });
        }
      }
      return result;
    });
    console.log('\nData fields in picker:', JSON.stringify(dataFields, null, 2));
  } else {
    console.log('Step 1 item not found in data picker');
  }

  // Also try scrolling down in the data picker to see more
  await page.evaluate(() => {
    const panels = document.querySelectorAll('[class*="picker"], [class*="Picker"], [class*="dataPicker"], aside');
    for (const p of panels) {
      if (p.scrollHeight > p.clientHeight) {
        p.scrollTop = p.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(2000);
  await ss(page, 'Z02-EXP-02-scrolled');

  // Grab the full data picker content after scroll
  const fullPickerText = await page.evaluate(() => {
    // Get all text from y > 400 area
    const allEls = document.querySelectorAll('*');
    const texts = [];
    const seen = new Set();
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.y < 400) continue;
      const text = el.textContent?.trim() || '';
      if (text.length > 0 && text.length < 100 && !seen.has(text)) {
        seen.add(text);
        texts.push(text);
      }
    }
    return texts.join('\n');
  });
  console.log('\nAll picker text:\n', fullPickerText);

  // Close the data picker by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Now try typing in the Channel ID field to see if autocomplete works
  await channelField.click();
  await page.waitForTimeout(1000);
  // Clear any existing content
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);

  // Type a space or nothing to trigger autocomplete
  await page.keyboard.type(' ');
  await page.waitForTimeout(3000);

  // Check for autocomplete suggestions
  const suggestions = await page.evaluate(() => {
    const result = [];
    const listboxes = document.querySelectorAll('[role="listbox"], [role="option"], [class*="suggestion"], [class*="autocomplete"]');
    for (const lb of listboxes) {
      if (lb.offsetParent === null) continue;
      result.push(lb.textContent?.trim().substring(0, 200) || '');
    }
    return result;
  });
  console.log('\nAutocomplete suggestions:', suggestions);

  // Clear the space
  await page.keyboard.press('Backspace');

  await ss(page, 'Z02-EXP-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
