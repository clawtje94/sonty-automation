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
  console.log('🎬 ZAP-01 Step 4 laatste veld');

  await page.goto('https://zapier.com/editor/353405789/draft/_GEN_1773140876863/fields', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Scroll to bottom
  await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && d.scrollHeight > d.clientHeight + 50) {
        d.scrollTop = d.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-FF-01-scroll');

  // Find the last "Choose value" - should be "Id's of the objects"
  const chooseSpan = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'))
      .filter(el => el.textContent.trim() === 'Choose value…' && el.children.length === 0 && el.offsetParent !== null)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width/2), y: Math.round(rect.y + rect.height/2), visible: rect.top >= 0 && rect.bottom <= 800, left: rect.left };
      })
      .filter(s => s.left > 800 && s.visible);
    return all[all.length - 1] || null; // Last one
  });

  if (chooseSpan) {
    console.log(`  Klik op (${chooseSpan.x}, ${chooseSpan.y})`);
    await page.mouse.click(chooseSpan.x, chooseSpan.y);
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-FF-02-popup');

    // Check what appeared
    const popupText = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Select value for')) {
        const idx = text.indexOf('Select value for');
        return text.substring(idx, idx + 500);
      }
      return 'no popup';
    });
    console.log('Popup:', popupText.substring(0, 300));

    // This field needs contact IDs - could be a text input or a mapping field
    // Check for radios
    const radios = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[type="radio"]'))
        .filter(i => i.offsetParent !== null)
        .map(i => ({ x: Math.round(i.getBoundingClientRect().x + 8), y: Math.round(i.getBoundingClientRect().y + 8), val: i.value }));
    });

    if (radios.length > 0) {
      console.log('Radios:', radios.map(r => r.val));
      // Select the one that matches step 2 contact ID
      const contactId = radios.find(r => r.val.includes('2__') || r.val.includes('vid') || r.val.includes('contact'));
      if (contactId) {
        await page.mouse.click(contactId.x, contactId.y);
        console.log(`  Geselecteerd: ${contactId.val}`);
      } else {
        await page.mouse.click(radios[0].x, radios[0].y);
        console.log(`  Eerste: ${radios[0].val}`);
      }
      await page.waitForTimeout(3000);
    } else {
      // It might be the "Id's of objects" field which uses a different UI
      // This could be a text/mapping field - look for "Insert Data" or the + button
      console.log('  Geen radios, probeer data mapping...');

      // Click the three-dot menu (⋮) next to the field to switch to Custom/Map mode
      const threeDots = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          const rect = btn.getBoundingClientRect();
          if (rect.left > 1200 && rect.width < 50 && rect.top > 500 && rect.top < 600) {
            return { x: Math.round(rect.x + rect.width/2), y: Math.round(rect.y + rect.height/2) };
          }
        }
        return null;
      });

      if (threeDots) {
        await page.mouse.click(threeDots.x, threeDots.y);
        await page.waitForTimeout(2000);
        await ss(page, 'Z01-FF-03-menu');

        // Click "Custom" to switch to text input mode
        const customOpt = page.locator('text=Custom').first()
          .or(page.locator('[role="menuitem"]').filter({ hasText: /Custom/ }).first());
        if (await customOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
          await customOpt.click();
          console.log('  Custom mode geactiveerd');
          await page.waitForTimeout(2000);
          await ss(page, 'Z01-FF-04-custom');

          // Now there should be a text input where we can type/map the contact ID
          // Look for the input field
          const input = page.locator('[contenteditable="true"]').last()
            .or(page.locator('input[type="text"]').last());
          if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
            await input.click();
            await page.waitForTimeout(1000);

            // Type the mapping token for step 2's VID (contact ID)
            // In Zapier, this uses "Insert Data" to map from previous steps
            // Click the + button to insert data
            const plusBtn = page.locator('button').filter({ hasText: /\+/ }).last();
            if (await plusBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await plusBtn.click();
              await page.waitForTimeout(2000);

              // Look for step 2 data
              const step2 = page.locator('text=Create or Update Contact').first()
                .or(page.locator('text=Step 2').first());
              if (await step2.isVisible({ timeout: 3000 }).catch(() => false)) {
                await step2.click();
                await page.waitForTimeout(2000);

                // Find "VID" or "ID" or "Contact ID"
                const vidField = page.locator('text=VID').first()
                  .or(page.locator('text=Vid').first())
                  .or(page.locator('text=id').first());
                if (await vidField.isVisible({ timeout: 3000 }).catch(() => false)) {
                  await vidField.click();
                  console.log('  Contact VID gemapped!');
                  await page.waitForTimeout(2000);
                }
              }
            }
          }
        }
      }
    }
  }

  // Final check
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-FF-05-status');

  const remaining = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasFinish: text.includes('finish required'),
      chooseCount: (text.match(/Choose value…/g) || []).length,
    };
  });
  console.log('Remaining:', JSON.stringify(remaining));

  // Try Continue
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
    console.log('Continue!');
    await page.waitForTimeout(5000);

    const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      console.log('Test geskipt!');
    }
  }

  await ss(page, 'Z01-FF-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
