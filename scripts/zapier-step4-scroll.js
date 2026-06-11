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
  console.log('🎬 ZAP-01 Step 4 scroll + fix');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Open step 4
  await page.mouse.dblclick(660, 590);
  await page.waitForTimeout(5000);

  // Scroll down in the right config panel
  // The panel is on the right side (x > 880)
  await page.evaluate(() => {
    // Find the scrollable container in the right panel
    const panels = document.querySelectorAll('div');
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && p.scrollHeight > p.clientHeight) {
        p.scrollTop += 300;
        return `Scrolled panel at ${Math.round(rect.left)},${Math.round(rect.top)}`;
      }
    }
    return 'no scrollable panel found';
  });
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-S4S-01-scrolled');

  // Now check what's visible
  const panelText = await page.evaluate(() => {
    const panels = document.querySelectorAll('div');
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && rect.height > 300) {
        return p.innerText.substring(0, 2000);
      }
    }
    return document.body.innerText.substring(0, 2000);
  });
  console.log('Panel na scroll:', panelText.substring(0, 800));

  // Find the "Choose value" button for the association type
  const chooseBtn = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        // Must be in right panel area
        if (rect.left > 800) {
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }
      }
    }
    return null;
  });

  if (chooseBtn) {
    console.log(`  Choose value at (${Math.round(chooseBtn.x)}, ${Math.round(chooseBtn.y)})`);
    await page.mouse.click(chooseBtn.x, chooseBtn.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-S4S-02-dropdown');

    // Get popup options
    const popupText = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Select value for')) {
        const start = text.indexOf('Select value for');
        return text.substring(start, start + 500);
      }
      return 'popup niet gevonden';
    });
    console.log('Popup:', popupText.substring(0, 300));

    // Find radio for "contact"
    const radioInfo = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="radio"]');
      const results = [];
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        // Get text from parent
        let parent = inp.parentElement;
        let text = '';
        for (let i = 0; i < 5; i++) {
          if (parent) {
            if (parent.textContent.length < 200) text = parent.textContent;
            parent = parent.parentElement;
          }
        }
        results.push({
          x: Math.round(rect.x + rect.width/2),
          y: Math.round(rect.y + rect.height/2),
          value: inp.value,
          text: text.substring(0, 100)
        });
      }
      return results;
    });
    console.log('Radios:', JSON.stringify(radioInfo));

    // Click the "contact" radio
    let clicked = false;
    for (const r of radioInfo) {
      if (r.text.toLowerCase().includes('contact') || r.value.toLowerCase().includes('contact')) {
        console.log(`  Contact radio klikken (${r.x}, ${r.y})`);
        await page.mouse.click(r.x, r.y);
        await page.waitForTimeout(3000);
        clicked = true;
        break;
      }
    }

    if (!clicked && radioInfo.length > 0) {
      // Just click the first radio
      console.log(`  Eerste radio klikken: ${radioInfo[0].text}`);
      await page.mouse.click(radioInfo[0].x, radioInfo[0].y);
      await page.waitForTimeout(3000);
    }

    await ss(page, 'Z01-S4S-03-after-select');
  } else {
    console.log('  Geen Choose value button gevonden in panel');
    // Maybe all fields are already filled - check
    const allFields = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('To continue, finish required') ? 'incomplete' : 'complete';
    });
    console.log('  Form status:', allFields);
  }

  // Check if Continue is now available
  await page.waitForTimeout(2000);

  // Scroll panel to see Continue button
  await page.evaluate(() => {
    const panels = document.querySelectorAll('div');
    for (const p of panels) {
      const rect = p.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && p.scrollHeight > p.clientHeight) {
        p.scrollTop = p.scrollHeight;
        return;
      }
    }
  });
  await page.waitForTimeout(1000);
  await ss(page, 'Z01-S4S-04-scrolled-bottom');

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

    // Skip test
    const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      console.log('  Test geskipt');
      await page.waitForTimeout(3000);
    }
    await ss(page, 'Z01-S4S-05-done');
  } else {
    console.log('  Continue niet enabled');
  }

  await ss(page, 'Z01-S4S-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 800));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
