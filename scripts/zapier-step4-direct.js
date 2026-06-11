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
  console.log('🎬 ZAP-01 Step 4 direct URL');

  // Navigate directly to step 4 config
  await page.goto('https://zapier.com/editor/353405789/draft/_GEN_1773140876863/fields', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  await ss(page, 'Z01-DIR-01-loaded');

  // Get panel text
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Loaded page:', text.substring(0, 800));

  // Check what step we're on
  if (text.includes('Create Associations')) {
    console.log('Op step 4!');

    // Scroll down to see all fields
    await page.evaluate(() => {
      const panels = document.querySelectorAll('div[class*="panel"], div[class*="Panel"], div[class*="sidebar"]');
      for (const p of panels) {
        if (p.scrollHeight > p.clientHeight && p.getBoundingClientRect().left > 800) {
          p.scrollTop = p.scrollHeight;
        }
      }
      // Also scroll the main scrollable container
      const scrollables = document.querySelectorAll('div');
      for (const d of scrollables) {
        const rect = d.getBoundingClientRect();
        if (rect.left > 800 && rect.width > 200 && d.scrollHeight > d.clientHeight + 50) {
          d.scrollTop = d.scrollHeight;
        }
      }
    });
    await page.waitForTimeout(2000);
    await ss(page, 'Z01-DIR-02-scrolled');

    // Get all visible "Choose value" elements with exact positions
    const allChoose = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const results = [];
      for (const el of all) {
        if (el.textContent.trim() === 'Choose value…' && el.children.length === 0 && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left > 800) {
            results.push({
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
              tag: el.tagName,
              visible: rect.top >= 0 && rect.bottom <= window.innerHeight
            });
          }
        }
      }
      return results;
    });
    console.log('Choose value elements:', JSON.stringify(allChoose));

    // Find a visible one
    const visible = allChoose.find(c => c.visible);
    if (visible) {
      console.log(`  Klik visible Choose value (${visible.x}, ${visible.y})`);
      await page.mouse.click(visible.x, visible.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z01-DIR-03-clicked');

      // Check what appeared
      const afterText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      if (afterText.includes('Select value for')) {
        const idx = afterText.indexOf('Select value for');
        console.log('Popup:', afterText.substring(idx, idx + 300));

        // Find radio for "contact"
        const radios = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('input[type="radio"]'))
            .filter(i => i.offsetParent !== null)
            .map(i => {
              const rect = i.getBoundingClientRect();
              let txt = '';
              let p = i.parentElement;
              for (let j = 0; j < 8; j++) {
                if (p) {
                  const t = p.textContent.trim();
                  if (t.length > 1 && t.length < 200) txt = t;
                  p = p.parentElement;
                }
              }
              return {
                x: Math.round(rect.x + rect.width/2),
                y: Math.round(rect.y + rect.height/2),
                val: i.value,
                txt: txt.substring(0, 80)
              };
            });
        });
        console.log('Radios:', JSON.stringify(radios));

        const contactR = radios.find(r =>
          r.txt.toLowerCase().includes('contact') || r.val === 'contact'
        );
        if (contactR) {
          await page.mouse.click(contactR.x, contactR.y);
          console.log('  Contact geselecteerd!');
          await page.waitForTimeout(3000);
        } else if (radios.length > 0) {
          console.log('  Geen "contact" gevonden, opties:', radios.map(r => `${r.val}:${r.txt}`));
        }
      }
    } else {
      console.log('  Geen visible Choose value gevonden');
      // Check if all required fields are filled
      const incomplete = await page.evaluate(() => document.body.innerText.includes('finish required'));
      console.log('  Required fields incomplete:', incomplete);
    }
  }

  // Check for remaining required fields
  await page.waitForTimeout(2000);

  // Also check if there's a second required field below
  const remaining = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasFinish = text.includes('finish required');
    // Count all "Choose value" that are enabled
    const btns = document.querySelectorAll('button');
    let enabledCount = 0;
    for (const btn of btns) {
      if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) enabledCount++;
    }
    return { hasFinish, enabledCount };
  });
  console.log('Remaining:', JSON.stringify(remaining));

  // Try to continue if possible
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const disabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
    if (!disabled) {
      await continueBtn.click({ force: true });
      console.log('Continue geklikt!');
      await page.waitForTimeout(5000);

      const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
      if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await skipBtn.click();
        console.log('Test geskipt!');
        await page.waitForTimeout(3000);
      }
    }
  }

  await ss(page, 'Z01-DIR-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
