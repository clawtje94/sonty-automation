const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function deleteFirstUntitled(page) {
  // Find "Zap actions" button for first Untitled Zap
  const actionBtn = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      const text = row.textContent?.trim() || '';
      if (!text.includes('Untitled Zap')) continue;
      const btn = row.querySelector('button[aria-label="Zap actions"]');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (!actionBtn) return false;

  console.log(`Zap actions at (${actionBtn.x}, ${actionBtn.y})`);
  await page.mouse.click(actionBtn.x, actionBtn.y);
  await page.waitForTimeout(2000);

  // Find "Move to trash" in the menu
  const trashOption = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Move to trash') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 20) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (!trashOption) {
    // Try "Delete"
    const deleteOption = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === 'Delete') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20 && rect.y > 300) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (deleteOption) {
      await page.mouse.click(deleteOption.x, deleteOption.y);
      await page.waitForTimeout(3000);
    } else {
      // Show what menu items are visible
      const menuText = await page.evaluate(() => {
        const result = [];
        const allEls = document.querySelectorAll('[role="menuitem"], [class*="menu"] a, [class*="menu"] button, [class*="Menu"] a, [class*="Menu"] button');
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const rect = el.getBoundingClientRect();
          if (rect.y > 300 && rect.width > 30) {
            result.push({ text: el.textContent?.trim().substring(0, 40) || '', y: Math.round(rect.y) });
          }
        }
        return result;
      });
      console.log('Menu items found:', JSON.stringify(menuText));
      await page.keyboard.press('Escape');
      return false;
    }
  } else {
    console.log('Clicking "Move to trash"');
    await page.mouse.click(trashOption.x, trashOption.y);
    await page.waitForTimeout(3000);
  }

  // Confirm dialog
  const confirmBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.includes('Move to trash') || text.includes('trash') || text === 'Delete' || text === 'Confirm') {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 80) {
          return { text, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (confirmBtn) {
    console.log(`Confirming: "${confirmBtn.text}"`);
    await page.mouse.click(confirmBtn.x, confirmBtn.y);
    await page.waitForTimeout(3000);
  }

  console.log('Verwijderd!');
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Drafts verwijderen v3');

  for (let i = 0; i < 4; i++) {
    await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    console.log(`\n--- Ronde ${i + 1} ---`);
    const deleted = await deleteFirstUntitled(page);
    if (!deleted) break;
  }

  // Final check
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await ss(page, 'DEL3-final');

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal list:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
