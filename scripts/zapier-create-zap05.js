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
  console.log('🎬 ZAP-05 aanmaken');

  await page.goto('https://zapier.com/app/editor/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Click on Step 1 "Trigger" card to open app picker
  const triggerCard = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Select the event that starts your Zap') {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (triggerCard) {
    await page.mouse.click(triggerCard.x, triggerCard.y);
    await page.waitForTimeout(5000);
    await ss(page, 'Z05-01-picker-open');
  }

  // Now the app picker modal should be open - find search input
  const searchInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const placeholder = inp.getAttribute('placeholder') || '';
      const rect = inp.getBoundingClientRect();
      if (rect.width > 150) { // The modal search input is wide
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), placeholder };
      }
    }
    return null;
  });

  if (searchInput) {
    console.log(`Search: "${searchInput.placeholder}" at (${searchInput.x}, ${searchInput.y})`);
    await page.mouse.click(searchInput.x, searchInput.y);
    await page.keyboard.type('HubSpot');
    await page.waitForTimeout(3000);
    await ss(page, 'Z05-02-search');

    // Click HubSpot result
    const hubspot = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'HubSpot') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 30 && rect.height > 10 && rect.height < 80) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (hubspot) {
      await page.mouse.click(hubspot.x, hubspot.y);
      console.log('HubSpot geselecteerd');
      await page.waitForTimeout(5000);
      await ss(page, 'Z05-03-hubspot');
    }
  }

  // Select "Updated Deal Stage" event
  const eventSearch = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const rect = inp.getBoundingClientRect();
      if (rect.width > 150) {
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (eventSearch) {
    await page.mouse.click(eventSearch.x, eventSearch.y);
    await page.keyboard.type('Updated Deal Stage');
    await page.waitForTimeout(3000);

    const event = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Updated Deal Stage') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (event) {
      await page.mouse.click(event.x, event.y);
      console.log('Updated Deal Stage geselecteerd');
      await page.waitForTimeout(5000);
      await ss(page, 'Z05-04-event');
    }
  }

  // Click Continue buttons
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
      if (!disabled) {
        await btn.click({ force: true });
        console.log(`Continue ${i + 1}`);
        await page.waitForTimeout(5000);
      } else break;
    } else break;
  }

  await ss(page, 'Z05-05-configured');

  // Rename
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

  if (namePos) {
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
      await page.keyboard.type('ZAP-05: Definitieve Offerte Verstuurd');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      console.log('Hernoemd');
    }
  }

  await ss(page, 'Z05-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
