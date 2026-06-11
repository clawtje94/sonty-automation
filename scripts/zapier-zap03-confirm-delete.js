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
  console.log('🎬 ZAP-03 confirm delete Step 2');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click the ⋮ menu on Step 2
  const step2Menu = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const label = btn.getAttribute('aria-label') || '';
      if (label.includes('Toggle step menu') && label.includes('Reuzenpanda')) {
        const rect = btn.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2Menu) {
    await page.mouse.click(step2Menu.x, step2Menu.y);
    await page.waitForTimeout(2000);

    // Click "Delete" first
    const deleteOpt = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Delete') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20 && rect.y > 400) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (deleteOpt) {
      await page.mouse.click(deleteOpt.x, deleteOpt.y);
      await page.waitForTimeout(2000);
    }

    // Now click "Really delete?"
    const reallyDelete = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Really delete?') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (reallyDelete) {
      console.log('Clicking "Really delete?"');
      await page.mouse.click(reallyDelete.x, reallyDelete.y);
      await page.waitForTimeout(3000);
      console.log('Step 2 verwijderd!');
    } else {
      console.log('Really delete niet gevonden');
    }
  } else {
    console.log('Step 2 niet gevonden, misschien al verwijderd');
    // Check if only 1 step exists
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log(bodyText.substring(0, 800));
  }

  await ss(page, 'Z03-DEL-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  const hasReuzenpanda = finalText.includes('Reuzenpanda');
  console.log(`\nReuzenpanda still present: ${hasReuzenpanda}`);
  console.log('Steps visible:', finalText.substring(0, 600));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
