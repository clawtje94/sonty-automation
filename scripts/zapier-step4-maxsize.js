const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  // Use larger viewport
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: ZAPIER_SESSION,
    viewport: { width: 1600, height: 1000 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 Step 4 met groot viewport');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Double-click step 4
  await page.mouse.dblclick(760, 590);
  await page.waitForTimeout(5000);
  await ss(page, 'Z01-MAX-01-step4');

  // Scroll panel down
  await page.evaluate(() => {
    const panels = document.querySelectorAll('div');
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && p.scrollHeight > p.clientHeight) {
        p.scrollTop = p.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-MAX-02-scrolled');

  // Get the full config panel text
  const panelText = await page.evaluate(() => {
    const panels = document.querySelectorAll('div');
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && rect.height > 300) {
        return p.innerText;
      }
    }
    return document.body.innerText;
  });
  console.log('Panel text:', panelText.substring(0, 1500));

  // Find the dropdown for "Type of the objects..."
  const chooseBtns = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const results = [];
    for (const btn of buttons) {
      if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        results.push({
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          inPanel: rect.left > 800
        });
      }
    }
    return results;
  });
  console.log('Choose value buttons:', JSON.stringify(chooseBtns));

  // Click the one in the panel
  const panelBtn = chooseBtns.find(b => b.inPanel);
  if (panelBtn) {
    console.log(`  Klik op (${panelBtn.x}, ${panelBtn.y})`);
    await page.mouse.click(panelBtn.x, panelBtn.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-MAX-03-dropdown-open');

    // Check what opened
    const afterClick = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Select value for')) {
        const idx = text.indexOf('Select value for');
        return text.substring(idx, idx + 500);
      }
      return 'no popup';
    });
    console.log('Popup:', afterClick.substring(0, 300));

    // Find and click "contact" option
    const radios = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="radio"]');
      return Array.from(inputs)
        .filter(i => i.offsetParent !== null)
        .map(i => {
          const rect = i.getBoundingClientRect();
          let parent = i.parentElement;
          let text = '';
          for (let j = 0; j < 10; j++) {
            if (parent && parent.textContent) {
              text = parent.textContent.trim();
              if (text.length > 1 && text.length < 200) break;
            }
            if (parent) parent = parent.parentElement;
          }
          return {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            value: i.value,
            text: text.substring(0, 100)
          };
        });
    });
    console.log('Radios:', JSON.stringify(radios));

    // Find "contact" option
    const contactRadio = radios.find(r =>
      r.text.toLowerCase().includes('contact') || r.value.toLowerCase().includes('contact')
    );

    if (contactRadio) {
      console.log(`  Contact radio (${contactRadio.x}, ${contactRadio.y})`);
      await page.mouse.click(contactRadio.x, contactRadio.y);
      await page.waitForTimeout(3000);
      console.log('  Contact geselecteerd!');
    } else if (radios.length > 0) {
      console.log('  Alle opties:', radios.map(r => `${r.value}: ${r.text}`));
      // Print all options and their values for debugging
    }

    await ss(page, 'Z01-MAX-04-after-select');

    // Check if Continue is enabled now
    await page.evaluate(() => {
      const panels = document.querySelectorAll('div');
      for (const p of panels) {
        const rect = p.getBoundingClientRect();
        if (rect.left > 800 && rect.width > 200 && p.scrollHeight > p.clientHeight) {
          p.scrollTop = p.scrollHeight;
        }
      }
    });
    await page.waitForTimeout(1000);

    const continueEnabled = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.trim() === 'Continue' && !btn.disabled) return true;
      }
      return false;
    });

    if (continueEnabled) {
      const btn = page.locator('button').filter({ hasText: /^Continue$/ });
      await btn.click({ force: true });
      console.log('  Continue geklikt!');
      await page.waitForTimeout(5000);

      const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
      if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await skipBtn.click();
        console.log('  Test geskipt!');
        await page.waitForTimeout(3000);
      }
      await ss(page, 'Z01-MAX-05-done');
    }
  }

  await ss(page, 'Z01-MAX-final');
  const ft = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', ft.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
