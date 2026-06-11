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
  console.log('🎬 ZAP-03 Step 2 Reuzenpanda verwijderen');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, 'Z03-RM-01-loaded');

  // Find the ⋮ menu button on Step 2 (Reuzenpanda)
  // The ⋮ button is at the right side of the step card
  const step2Menu = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    let reuzenpandaY = null;
    // First find the Reuzenpanda step Y position
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text.includes('Reuzenpanda') || text.includes('Create Document Quotation')) {
        const rect = el.getBoundingClientRect();
        if (rect.y > 300 && rect.width > 30) {
          reuzenpandaY = rect.y;
          break;
        }
      }
    }
    if (!reuzenpandaY) return null;

    // Find the ⋮ button near that Y position (within 50px)
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      const rect = btn.getBoundingClientRect();
      if (Math.abs(rect.y - reuzenpandaY) < 50 && rect.x > 700) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const text = btn.textContent?.trim() || '';
        if (ariaLabel.includes('option') || ariaLabel.includes('menu') || ariaLabel.includes('action') ||
            text === '⋮' || text === '...' || text === '' && rect.width < 50) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), label: ariaLabel, text };
        }
      }
    }
    return null;
  });

  if (step2Menu) {
    console.log(`Step 2 menu button: (${step2Menu.x}, ${step2Menu.y}) label="${step2Menu.label}"`);
    await page.mouse.click(step2Menu.x, step2Menu.y);
    await page.waitForTimeout(2000);
    await ss(page, 'Z03-RM-02-menu-open');

    // Find "Delete" in the context menu
    const deleteOption = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === 'Delete' || text === 'Delete step' || text === 'Remove') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20 && rect.y > 200) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
          }
        }
      }
      return null;
    });

    if (deleteOption) {
      console.log(`Delete option: "${deleteOption.text}" at (${deleteOption.x}, ${deleteOption.y})`);
      await page.mouse.click(deleteOption.x, deleteOption.y);
      await page.waitForTimeout(3000);

      // Confirm if dialog appears
      const confirmBtn = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.offsetParent === null) continue;
          const text = btn.textContent?.trim() || '';
          if (text === 'Delete' || text === 'Confirm' || text === 'Yes' || text.includes('Delete step')) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 60) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
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

      console.log('Step 2 verwijderd!');
    } else {
      // Show all menu items
      const menuItems = await page.evaluate(() => {
        const result = [];
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          const rect = el.getBoundingClientRect();
          if (rect.y > 300 && rect.y < 600 && rect.width > 30 && rect.x > 500) {
            const text = el.textContent?.trim() || '';
            if (text.length > 0 && text.length < 50) {
              result.push({ text, x: Math.round(rect.x), y: Math.round(rect.y) });
            }
          }
        }
        return result;
      });
      console.log('Menu items:', JSON.stringify(menuItems, null, 2));
      await page.keyboard.press('Escape');
    }
  } else {
    console.log('Step 2 menu button niet gevonden, probeer direct via ⋮ knop op de step card');

    // Alternative: right-click on Step 2 or find the three-dot menu
    // In Zapier editor, each step has a ⋮ in the top-right corner of the card
    const step2Card = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text.includes('Reuzenpanda')) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 300) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (step2Card) {
      // Look for all small buttons near this area
      const nearbyButtons = await page.evaluate((cardY) => {
        const btns = document.querySelectorAll('button, [role="button"]');
        const result = [];
        for (const btn of btns) {
          if (btn.offsetParent === null) continue;
          const rect = btn.getBoundingClientRect();
          if (Math.abs(rect.y - cardY) < 80 && rect.x > 700) {
            result.push({
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
              label: btn.getAttribute('aria-label') || '',
              text: btn.textContent?.trim().substring(0, 30) || '',
              tag: btn.tagName
            });
          }
        }
        return result;
      }, step2Card.y);
      console.log('Buttons near Step 2:', JSON.stringify(nearbyButtons, null, 2));
    }
  }

  await ss(page, 'Z03-RM-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
