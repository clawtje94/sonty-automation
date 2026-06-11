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
  console.log('🎬 ZAP-01 Step 4 - Insert Vid');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Double-click Step 4
  const step4El = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === '4.') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 5) return { x: Math.round(rect.x + 100), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });
  if (step4El) {
    await page.mouse.dblclick(step4El.x, step4El.y);
    await page.waitForTimeout(5000);
  }

  // Scroll config panel
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  // Switch to Custom mode
  const dotBtn = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button[aria-label="Select field map type"]');
    let lastBtn = null;
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      const rect = btn.getBoundingClientRect();
      if (rect.x > 1200 && rect.y > 300) lastBtn = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
    }
    return lastBtn;
  });
  if (!dotBtn) { console.log('No dot btn'); return; }

  await page.mouse.click(dotBtn.x, dotBtn.y);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Custom') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 400 && rect.width > 20) { el.click(); return; }
      }
    }
  });
  await page.waitForTimeout(3000);
  console.log('Custom mode');

  // Click the custom field
  const customField = await page.evaluate(() => {
    const editables = document.querySelectorAll('.editable-slate-field, [contenteditable="true"]');
    for (const ed of editables) {
      if (ed.offsetParent === null) continue;
      const rect = ed.getBoundingClientRect();
      if (rect.x < 850 || rect.y < 400) continue;
      return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
    }
    return null;
  });
  if (!customField) { console.log('No custom field'); return; }
  await page.mouse.click(customField.x, customField.y);
  await page.waitForTimeout(1000);

  // Click "+" to open data picker
  const plusBtn = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button[aria-label="Add a field mapping"]');
    let lastBtn = null;
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      const rect = btn.getBoundingClientRect();
      if (rect.y > 400) lastBtn = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
    }
    return lastBtn;
  });
  if (!plusBtn) { console.log('No + btn'); return; }
  await page.mouse.click(plusBtn.x, plusBtn.y);
  await page.waitForTimeout(5000);

  // Expand Step 2
  const step2Link = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'Create or Update Contact in HubSpot') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50 && rect.width < 400) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });
  if (step2Link) {
    await page.mouse.click(step2Link.x, step2Link.y);
    await page.waitForTimeout(3000);
    console.log('Step 2 expanded');
  }

  // Now find and click "Vid" - look anywhere in the data picker
  const vidItem = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Vid') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 10 && rect.y > 300) {
          return { text, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (vidItem) {
    console.log(`"Vid" at (${vidItem.x}, ${vidItem.y})`);
    await page.mouse.click(vidItem.x, vidItem.y);
    await page.waitForTimeout(3000);
    console.log('Vid ingevoegd!');
    await ss(page, 'Z01-FIX4H-01-vid-inserted');

    // Check field content
    const fieldContent = await page.evaluate(() => {
      const editables = document.querySelectorAll('.editable-slate-field, [contenteditable="true"]');
      for (const ed of editables) {
        if (ed.offsetParent === null) continue;
        const rect = ed.getBoundingClientRect();
        if (rect.x < 850 || rect.y < 400) continue;
        return ed.textContent?.trim().substring(0, 100) || '';
      }
      return 'not found';
    });
    console.log(`Field content: "${fieldContent}"`);
  } else {
    console.log('Vid not found, checking all items...');
    const items = await page.evaluate(() => {
      const result = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.offsetParent === null) continue;
        const rect = el.getBoundingClientRect();
        if (rect.y < 300 || rect.x < 400 || rect.x > 900) continue;
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && text.length < 60) {
          result.push({ text, x: Math.round(rect.x), y: Math.round(rect.y) });
        }
      }
      // Deduplicate
      const seen = new Set();
      return result.filter(i => { const key = i.text + i.y; if (seen.has(key)) return false; seen.add(key); return true; });
    });
    console.log('Picker items:', JSON.stringify(items.slice(0, 30), null, 2));
  }

  // Remove old bh@hubspot.com entry
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Scroll down to find bh@hubspot.com row
  const bhRemove = await page.evaluate(() => {
    // Find the row with bh@hubspot.com and its X button
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text === '×' || text === '✕' || text === 'X' || text === '') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 1150 && rect.width < 35) {
          // Check parent for bh@hubspot
          let el = btn.parentElement;
          for (let i = 0; i < 5; i++) {
            if (el?.textContent?.includes('bh@hubspot')) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
            }
            el = el?.parentElement;
          }
        }
      }
    }
    return null;
  });

  if (bhRemove) {
    console.log(`Remove bh@hubspot at (${bhRemove.x}, ${bhRemove.y})`);
    await page.mouse.click(bhRemove.x, bhRemove.y);
    await page.waitForTimeout(2000);
    console.log('Removed!');
  }

  // Click Continue
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1000);
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    console.log('Continue geklikt');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z01-FIX4H-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
