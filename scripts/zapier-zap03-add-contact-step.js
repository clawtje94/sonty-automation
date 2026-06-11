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
  console.log('🎬 ZAP-03: Final — click "+" at correct position to map Contact ID');

  // Open ZAP-03
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Click Step 2 card
  await page.mouse.click(660, 370);
  await page.waitForTimeout(5000);

  // Click Configure tab
  await page.mouse.click(1003, 170);
  await page.waitForTimeout(5000);
  await ss(page, 'Z03GC-H0-configure');

  // Click the "+" button - CORRECT position from screenshot: (1225, 248)
  console.log('Clicking "+" at (1225, 248)');
  await page.mouse.click(1225, 248);
  await page.waitForTimeout(5000);
  await ss(page, 'Z03GC-H1-picker');

  // Check if data picker opened
  const pickerVisible = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Previous Steps' || el.textContent?.trim() === 'Step Output') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 200) return true;
      }
    }
    return false;
  });
  console.log('Data picker visible:', pickerVisible);

  if (!pickerVisible) {
    // Try clicking the input field first, then the "+"
    console.log('Picker not visible, clicking input field first...');
    await page.mouse.click(1050, 248);
    await page.waitForTimeout(2000);

    // Now dynamically find and click the "+" button
    const plusBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [role="button"]');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const rect = btn.getBoundingClientRect();
        const label = btn.getAttribute('aria-label') || '';
        const text = btn.textContent?.trim() || '';
        // The "+" is a small button at the right edge of the Contact ID input
        if (rect.x > 1200 && rect.y > 230 && rect.y < 270 && rect.width < 50 && rect.height < 50) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), label, text, w: Math.round(rect.width), h: Math.round(rect.height) };
        }
      }
      return null;
    });
    console.log('Found + button:', JSON.stringify(plusBtn));

    if (plusBtn) {
      await page.mouse.click(plusBtn.x, plusBtn.y);
      await page.waitForTimeout(5000);
      await ss(page, 'Z03GC-H1b-picker');
    }
  }

  // Now look for "ID" in the data picker
  // The data picker shows: "1. Updated Deal Stage in HubSpot" > "Step Output {...}" > "ID 0"
  // List everything in the picker area
  const pickerItems = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const items = [];
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text.length > 0 && text.length < 100) {
        const rect = el.getBoundingClientRect();
        // Picker popup area is roughly between x=510-860, y=250-600
        if (rect.x > 510 && rect.x < 870 && rect.y > 250 && rect.y < 620 && rect.width > 3 && rect.height < 50) {
          items.push({ text, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), w: Math.round(rect.width) });
        }
      }
    }
    return items;
  });
  console.log('Picker items:', JSON.stringify(pickerItems));

  // Find "ID" — it should be a leaf node under Step Output
  const idItem = pickerItems.find(i => i.text === 'ID' && i.w < 50) ||
                 pickerItems.find(i => i.text === '1. ID');

  if (idItem) {
    console.log(`Clicking "ID" at (${idItem.x}, ${idItem.y})`);
    await page.mouse.click(idItem.x, idItem.y);
    await page.waitForTimeout(3000);
    console.log('  ✅ Mapped!');
  } else {
    console.log('ID not in picker. Checking if we need to expand Step 1...');

    // Find and click "1. Updated Deal Stage in HubSpot" to expand
    const step1 = pickerItems.find(i => i.text.includes('Updated Deal Stage'));
    if (step1) {
      console.log(`Expanding: "${step1.text}"`);
      await page.mouse.click(step1.x, step1.y);
      await page.waitForTimeout(2000);

      // Now find ID
      const items2 = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        const items = [];
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          const text = el.textContent?.trim() || '';
          if (text === 'ID' || text === 'Step Output' || text === '{...}') {
            const rect = el.getBoundingClientRect();
            if (rect.x > 520 && rect.y > 400 && rect.width > 3) {
              items.push({ text, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
            }
          }
        }
        return items;
      });
      console.log('After expand:', JSON.stringify(items2));

      const idItem2 = items2.find(i => i.text === 'ID');
      if (idItem2) {
        await page.mouse.click(idItem2.x, idItem2.y);
        await page.waitForTimeout(3000);
        console.log('  ✅ Mapped to ID!');
      }
    } else {
      // Maybe Copilot suggestions shows "1. ID"
      const suggestion = pickerItems.find(i => i.text.includes('1. ID'));
      if (suggestion) {
        await page.mouse.click(suggestion.x, suggestion.y);
        await page.waitForTimeout(3000);
        console.log('  ✅ Mapped via suggestion');
      }
    }
  }

  await ss(page, 'Z03GC-H2-mapped');

  // Verify field value
  const val = await page.evaluate(() => {
    const ces = document.querySelectorAll('[contenteditable="true"]');
    for (const ce of ces) {
      const rect = ce.getBoundingClientRect();
      if (rect.x > 870 && rect.y > 180 && rect.y < 300 && rect.width > 200) {
        return ce.textContent || '';
      }
    }
    return 'NOT FOUND';
  });
  console.log('Field value:', JSON.stringify(val));

  // Close picker
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Continue
  const contBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });
  if (contBtn) {
    await page.mouse.click(contBtn.x, contBtn.y);
    console.log('  Continue');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z03GC-H3-final');
  const finalState = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('FINAL:', finalState.substring(0, 1000));
  console.log('URL:', page.url());

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('✅ Session opgeslagen');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
  console.log('✅ Done');
})();
