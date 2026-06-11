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
  console.log('🎬 ZAP-01 stappen klikken');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Click on step 1 by coordinates (center of the card in the canvas)
  console.log('\n--- STEP 1 ---');
  await page.mouse.click(660, 170);
  await page.waitForTimeout(4000);
  await ss(page, 'Z01-CLK-step1');

  // Get all visible text
  let panelText = await page.evaluate(() => {
    return document.body.innerText.substring(0, 5000);
  });
  // Look for Setup/Configure/Test tabs which indicate a config panel is open
  if (panelText.includes('Configure') && panelText.includes('Setup')) {
    console.log('Config panel geopend!');
    // Extract the panel content
    const idx = panelText.indexOf('Setup');
    console.log(panelText.substring(idx, idx + 600));
  } else {
    console.log('Geen config panel, probeer step 3...');
  }

  // Click on step 3 by coordinates
  console.log('\n--- STEP 3 ---');
  await page.mouse.click(660, 450);
  await page.waitForTimeout(4000);
  await ss(page, 'Z01-CLK-step3');

  panelText = await page.evaluate(() => document.body.innerText.substring(0, 8000));
  if (panelText.includes('Configure') && panelText.includes('Setup')) {
    const idx = panelText.indexOf('Setup');
    console.log('Config panel:');
    console.log(panelText.substring(idx, idx + 800));
  } else {
    console.log('Geen config panel');
    // Maybe the whole page is the panel now
    console.log(panelText.substring(0, 800));
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
