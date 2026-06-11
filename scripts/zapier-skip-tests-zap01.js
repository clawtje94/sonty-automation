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
  console.log('🎬 ZAP-01 Skip tests stappen 2-4');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Step 2 should be open
  // Double-click step 2
  await page.mouse.dblclick(660, 310);
  await page.waitForTimeout(5000);

  // Skip test for step 2
  console.log('--- Step 2: Skip test ---');
  let skipBtn = page.locator('button').filter({ hasText: /Skip test/i }).first();
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    console.log('  Step 2 test geskipt');
    await page.waitForTimeout(3000);
  } else {
    console.log('  Skip test niet zichtbaar');
    // Check if we need to continue from Configure first
    const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('  Status:', text.substring(0, 300));
  }
  await ss(page, 'Z01-SKIP-01-step2');

  // Step 3
  console.log('\n--- Step 3: Skip test ---');
  await page.mouse.dblclick(660, 450);
  await page.waitForTimeout(5000);

  skipBtn = page.locator('button').filter({ hasText: /Skip test/i }).first();
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    console.log('  Step 3 test geskipt');
    await page.waitForTimeout(3000);
  }
  await ss(page, 'Z01-SKIP-02-step3');

  // Step 4
  console.log('\n--- Step 4: Skip test ---');
  await page.mouse.dblclick(660, 590);
  await page.waitForTimeout(5000);

  skipBtn = page.locator('button').filter({ hasText: /Skip test/i }).first();
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    console.log('  Step 4 test geskipt');
    await page.waitForTimeout(3000);
  }
  await ss(page, 'Z01-SKIP-03-step4');

  // Final overview
  await page.waitForTimeout(2000);
  await ss(page, 'Z01-SKIP-final');

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  // Check if all steps have green checkmarks
  const stepStatuses = await page.evaluate(() => {
    const canvas = document.querySelectorAll('[class*="card"], [class*="step"]');
    return document.body.innerText.includes('Publish');
  });
  console.log('Publish knop zichtbaar:', stepStatuses);

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
