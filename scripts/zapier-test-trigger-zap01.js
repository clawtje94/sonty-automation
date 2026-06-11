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
  console.log('🎬 ZAP-01 Trigger testen');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Double-click step 1
  await page.mouse.dblclick(660, 170);
  await page.waitForTimeout(5000);

  // Check if we're on Test tab
  const onTest = await page.evaluate(() => document.body.innerText.includes('Test trigger'));
  console.log('Op test tab:', onTest);

  if (onTest) {
    // Click "Test trigger" button
    const testBtn = page.locator('button').filter({ hasText: /Test trigger/i }).first();
    if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await testBtn.click();
      console.log('  Test trigger geklikt!');
      await page.waitForTimeout(15000);
      await ss(page, 'Z01-TEST-01-result');

      const resultText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('Result:', resultText.substring(0, 1000));

      // Check if test succeeded or failed
      if (resultText.includes('We found') || resultText.includes('record')) {
        console.log('  ✅ Trigger test GESLAAGD!');

        // Click Continue if visible
        const continueBtn = page.locator('button').filter({ hasText: /Continue/i }).first();
        if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          const disabled = await continueBtn.evaluate(el => el.disabled);
          if (!disabled) {
            await continueBtn.click();
            console.log('  Continue geklikt na test');
            await page.waitForTimeout(5000);
          }
        }
      } else if (resultText.includes('No records') || resultText.includes('no leads')) {
        console.log('  ⚠️ Geen records gevonden (normaal als er nog geen leads zijn)');
        // Skip test
        const skipBtn = page.locator('button').filter({ hasText: /Skip/i }).first();
        if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await skipBtn.click();
          console.log('  Skip test geklikt');
          await page.waitForTimeout(3000);
        }
      } else if (resultText.includes('error') || resultText.includes('Error')) {
        console.log('  ❌ Trigger test MISLUKT');
      }

      await ss(page, 'Z01-TEST-02-after');
    }
  } else {
    // Navigate to test - click Test tab
    const testTab = page.locator('text=Test').first();
    if (await testTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testTab.click();
      await page.waitForTimeout(3000);
    }
  }

  // Now move to step 2 and check its configuration
  console.log('\n--- Step 2 check ---');
  await page.mouse.dblclick(660, 310);
  await page.waitForTimeout(5000);
  await ss(page, 'Z01-TEST-03-step2');

  const step2Text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Step 2:', step2Text.substring(0, 600));

  await ss(page, 'Z01-TEST-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
