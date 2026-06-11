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
  console.log('🎬 ZAP-02 Step 1 testen');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Double-click Step 1 to open it
  await page.mouse.dblclick(660, 275);
  await page.waitForTimeout(5000);

  // Click "Test trigger" button directly
  const testTriggerBtn = page.locator('button').filter({ hasText: /^Test trigger$/ });
  if (await testTriggerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await testTriggerBtn.click();
    console.log('Test trigger geklikt');
    await page.waitForTimeout(15000);
    await ss(page, 'Z02-T1-02-testing');

    const resultText = await page.evaluate(() => document.body.innerText.substring(0, 4000));
    console.log('Test result:', resultText.substring(0, 1500));

    // If it says "no deal found", look for Skip test
    if (resultText.includes('No') || resultText.includes('no') || resultText.includes("couldn't find")) {
      console.log('\nGeen deal gevonden, probeer skip test...');
      const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
      if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await skipBtn.click();
        console.log('Test geskipt');
        await page.waitForTimeout(3000);
      }
    }

    // Check for "record" selection or Continue
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click();
      console.log('Continue geklikt');
      await page.waitForTimeout(3000);
    }
  } else {
    // Maybe already tested, look for Skip test
    const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      console.log('Test geskipt');
      await page.waitForTimeout(3000);
    } else {
      console.log('Geen Test trigger of Skip test knop gevonden');
      await ss(page, 'Z02-T1-01b-no-buttons');
      const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log('Page:', text.substring(0, 800));
    }
  }

  await ss(page, 'Z02-T1-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
