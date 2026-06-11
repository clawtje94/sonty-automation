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
  console.log('🎬 ZAP-03 Planado Configure bekijken');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Step 2
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Create Job') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.dblclick(step2.x, step2.y);
    await page.waitForTimeout(5000);
  }

  // Click Configure tab
  const configTab = page.locator('text=Configure').first();
  if (await configTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await configTab.click();
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z03CFG-01-configure');

  // Get all configure fields
  const configText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  console.log('Configure fields:\n', configText.substring(configText.indexOf('Configure'), configText.indexOf('Configure') + 2000));

  // Scroll down to see more fields
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2000);
  await ss(page, 'Z03CFG-02-scroll');

  const moreText = await page.evaluate(() => document.body.innerText.substring(0, 6000));
  console.log('\nAll text (scrolled):\n', moreText.substring(moreText.indexOf('Configure'), moreText.indexOf('Configure') + 3000));

  // Scroll more
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2000);
  await ss(page, 'Z03CFG-03-scroll2');

  const evenMore = await page.evaluate(() => document.body.innerText.substring(0, 8000));
  console.log('\nFull text:\n', evenMore.substring(evenMore.indexOf('Template'), 3000));

  await ss(page, 'Z03CFG-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
