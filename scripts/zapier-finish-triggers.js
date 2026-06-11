const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function selectEventAndContinue(page, prefix) {
  // Click the "Choose an event" dropdown
  const dropdown = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Choose an event') {
        const rect = el.getBoundingClientRect();
        if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (dropdown) {
    console.log(`  Dropdown at (${dropdown.x}, ${dropdown.y})`);
    await page.mouse.click(dropdown.x, dropdown.y);
    await page.waitForTimeout(3000);
    await ss(page, `${prefix}-event-dropdown`);

    // Look for "Updated Deal Stage" in the dropdown options
    const updatedDeal = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === 'Updated Deal Stage') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (updatedDeal) {
      await page.mouse.click(updatedDeal.x, updatedDeal.y);
      console.log('  Updated Deal Stage geselecteerd');
      await page.waitForTimeout(3000);
    } else {
      // Maybe need to search/scroll - check what's in the dropdown
      const options = await page.evaluate(() => {
        const result = [];
        const allEls = document.querySelectorAll('input[type="radio"], [role="option"], [role="listbox"] *, li');
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const text = el.textContent?.trim() || '';
          const rect = el.getBoundingClientRect();
          if (text.length > 3 && text.length < 80 && rect.y > 200) {
            result.push({ text, y: Math.round(rect.y) });
          }
        }
        return result.slice(0, 20);
      });
      console.log('  Dropdown options:', JSON.stringify(options));

      // Try searching within the dropdown
      const searchInDropdown = page.locator('input[placeholder*="Search"]').first();
      if (await searchInDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInDropdown.fill('Updated Deal');
        await page.waitForTimeout(2000);

        const found = await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.children.length > 0) continue;
            if (el.textContent?.trim().includes('Updated Deal Stage')) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
          return null;
        });

        if (found) {
          await page.mouse.click(found.x, found.y);
          console.log('  Updated Deal Stage gevonden en geselecteerd');
          await page.waitForTimeout(3000);
        }
      }
    }
  } else {
    console.log('  "Choose an event" niet gevonden');
  }

  // Click Continue buttons
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
      if (!disabled) {
        await btn.click({ force: true });
        console.log(`  Continue ${i + 1}`);
        await page.waitForTimeout(5000);
      } else break;
    } else break;
  }
}

async function renameZap(page, newName) {
  const namePos = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Untitled Zap') {
        const rect = el.getBoundingClientRect();
        if (rect.y < 80 && rect.width > 50) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });
  if (!namePos) return false;

  await page.mouse.click(namePos.x, namePos.y);
  await page.waitForTimeout(2000);
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
    await page.waitForTimeout(1000);
    await page.keyboard.type(newName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // ============= ZAP-05: finish trigger config =============
  console.log('\n🔧 ZAP-05: Event selecteren');
  await page.goto('https://zapier.com/editor/353424308/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Step 1
  await page.mouse.dblclick(660, 400);
  await page.waitForTimeout(5000);
  await ss(page, 'FIN-05-01');

  await selectEventAndContinue(page, 'FIN-05');
  await ss(page, 'FIN-05-done');

  // Check if rename needed (still "Untitled Zap"?)
  const title05 = await page.evaluate(() => document.title);
  if (title05.includes('Untitled')) {
    if (await renameZap(page, 'ZAP-05: Definitieve Offerte Verstuurd')) {
      console.log('  ZAP-05 hernoemd');
    }
  }

  // Save
  let storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  // ============= ZAP-06: create new =============
  console.log('\n🔧 ZAP-06: Nieuwe zap aanmaken');
  await page.goto('https://zapier.com/app/editor/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Click trigger card
  const trigger06 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Select the event that starts your Zap') {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });
  if (trigger06) {
    await page.mouse.click(trigger06.x, trigger06.y);
    await page.waitForTimeout(5000);
  }

  // Search HubSpot in modal
  const search06 = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
    }
    return null;
  });
  if (search06) {
    await page.mouse.click(search06.x, search06.y);
    await page.keyboard.type('HubSpot');
    await page.waitForTimeout(3000);
    const hs = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'HubSpot') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 30 && rect.height > 10 && rect.height < 80) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });
    if (hs) {
      await page.mouse.click(hs.x, hs.y);
      console.log('  HubSpot geselecteerd');
      await page.waitForTimeout(5000);
    }
  }

  await selectEventAndContinue(page, 'FIN-06');
  await ss(page, 'FIN-06-done');
  if (await renameZap(page, 'ZAP-06: Offerte Akkoord')) console.log('  ZAP-06 hernoemd');

  storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  const url06 = page.url();
  console.log('  ZAP-06 URL:', url06);

  // ============= ZAP-08: create new =============
  console.log('\n🔧 ZAP-08: Nieuwe zap aanmaken');
  await page.goto('https://zapier.com/app/editor/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  const trigger08 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Select the event that starts your Zap') {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });
  if (trigger08) {
    await page.mouse.click(trigger08.x, trigger08.y);
    await page.waitForTimeout(5000);
  }

  const search08 = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
    }
    return null;
  });
  if (search08) {
    await page.mouse.click(search08.x, search08.y);
    await page.keyboard.type('HubSpot');
    await page.waitForTimeout(3000);
    const hs = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'HubSpot') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 30 && rect.height > 10 && rect.height < 80) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });
    if (hs) {
      await page.mouse.click(hs.x, hs.y);
      console.log('  HubSpot geselecteerd');
      await page.waitForTimeout(5000);
    }
  }

  await selectEventAndContinue(page, 'FIN-08');
  await ss(page, 'FIN-08-done');
  if (await renameZap(page, 'ZAP-08: Installatie Ingepland')) console.log('  ZAP-08 hernoemd');

  storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  const url08 = page.url();
  console.log('  ZAP-08 URL:', url08);

  // Final overview
  console.log('\n📋 SAMENVATTING:');
  console.log('  ZAP-05:', 'https://zapier.com/editor/353424308/draft');
  console.log('  ZAP-06:', url06);
  console.log('  ZAP-08:', url08);

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
