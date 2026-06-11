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
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-02 hernoemen');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  await ss(page, 'RENAME-01-loaded');

  // Find the "Untitled Zap" text position and click it
  const namePos = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Untitled Zap') {
        const rect = el.getBoundingClientRect();
        if (rect.y < 50 && rect.width > 50) { // In the top bar
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (namePos) {
    console.log(`Name at (${namePos.x}, ${namePos.y})`);
    await page.mouse.click(namePos.x, namePos.y);
    await page.waitForTimeout(2000);
    await ss(page, 'RENAME-02-clicked');

    // Check if input appeared
    const inputFound = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        if (rect.y < 80 && rect.width > 100) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), value: inp.value };
        }
      }
      return null;
    });

    if (inputFound) {
      console.log(`Input found: "${inputFound.value}" at (${inputFound.x}, ${inputFound.y})`);
      // Triple-click to select all text, then type new name
      await page.mouse.click(inputFound.x, inputFound.y, { clickCount: 3 });
      await page.waitForTimeout(500);
      await page.keyboard.type('ZAP-02: WhatsApp Follow-up via Trengo');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      console.log('ZAP-02 hernoemd!');
    } else {
      // Maybe it's a dropdown/popover - check for rename option
      console.log('No input found after click, trying dropdown approach...');
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('After click text:', bodyText.substring(0, 500));

      // Look for "Rename" menu item
      const renameItem = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Rename') {
            const rect = el.getBoundingClientRect();
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (renameItem) {
        await page.mouse.click(renameItem.x, renameItem.y);
        await page.waitForTimeout(2000);
        // Now type the new name
        await page.keyboard.type('ZAP-02: WhatsApp Follow-up via Trengo');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        console.log('ZAP-02 hernoemd via Rename!');
      }
    }
  } else {
    console.log('Zap name not found in top bar');
  }

  await ss(page, 'RENAME-final');
  const finalTitle = await page.evaluate(() => document.title);
  console.log('Title:', finalTitle);

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
