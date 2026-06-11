const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function selectUpdatedDealStage(page, prefix) {
  // Open Step 1 panel
  const step1 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Select the event' || text === '1. Select the event') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    // Fallback: click on the HubSpot card
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'HubSpot') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 200 && rect.y < 450) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step1) {
    await page.mouse.dblclick(step1.x, step1.y);
    await page.waitForTimeout(5000);
  }

  // Check if panel is open with "Choose an event"
  const chooseEvent = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Choose an event') {
        const rect = el.getBoundingClientRect();
        if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (!chooseEvent) {
    // Maybe already configured
    const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    if (panelText.includes('Updated Deal Stage')) {
      console.log('  ✅ Event al geselecteerd');
      return true;
    }
    console.log('  "Choose an event" niet gevonden');
    return false;
  }

  // Click the dropdown
  await page.mouse.click(chooseEvent.x, chooseEvent.y);
  await page.waitForTimeout(2000);

  // Now there should be a "Search events" input in the popover
  const searchEvents = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const placeholder = inp.getAttribute('placeholder') || '';
      if (placeholder.includes('Search events') || placeholder.includes('Search')) {
        const rect = inp.getBoundingClientRect();
        if (rect.y > 300 && rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (searchEvents) {
    await page.mouse.click(searchEvents.x, searchEvents.y);
    await page.waitForTimeout(300);
    await page.keyboard.type('Updated Deal');
    await page.waitForTimeout(2000);
    await ss(page, `${prefix}-search-events`);
  }

  // Find and click "Updated Deal Stage"
  const eventOption = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text.startsWith('Updated Deal Stage')) {
        const rect = el.getBoundingClientRect();
        if (rect.y > 300 && rect.width > 100 && rect.height > 15 && rect.height < 80) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: text.substring(0, 50) };
        }
      }
    }
    return null;
  });

  if (eventOption) {
    console.log(`  Clicking: "${eventOption.text}" at (${eventOption.x}, ${eventOption.y})`);
    await page.mouse.click(eventOption.x, eventOption.y);
    await page.waitForTimeout(3000);
    await ss(page, `${prefix}-event-selected`);

    // Click Continue
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
    return true;
  } else {
    console.log('  Updated Deal Stage niet gevonden in dropdown');
    const visibleOptions = await page.evaluate(() => {
      const result = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.y > 350 && rect.y < 700 && rect.x > 400 && rect.width > 80) {
          const text = el.textContent?.trim() || '';
          if (text.length > 5 && text.length < 60) result.push({ text, y: Math.round(rect.y) });
        }
      }
      return result;
    });
    console.log('  Visible options:', JSON.stringify(visibleOptions));
    await page.keyboard.press('Escape');
    return false;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  const zaps = [
    { name: 'ZAP-05', url: 'https://zapier.com/editor/353424308/draft', rename: 'ZAP-05: Definitieve Offerte Verstuurd' },
    { name: 'ZAP-06', url: 'https://zapier.com/editor/353424608/draft', rename: 'ZAP-06: Offerte Akkoord' },
    { name: 'ZAP-08', url: 'https://zapier.com/editor/353424667/draft', rename: 'ZAP-08: Installatie Ingepland' },
  ];

  for (const zap of zaps) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔧 ${zap.name}`);

    await page.goto(zap.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // Dismiss popup
    const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
    if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gotIt.click();
      await page.waitForTimeout(1000);
    }

    const prefix = zap.name.replace('-', '');
    const success = await selectUpdatedDealStage(page, prefix);
    console.log(`  Result: ${success ? '✅' : '❌'}`);

    await ss(page, `${prefix}-final`);

    const storageState = await context.storageState();
    fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  }

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
