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
  console.log('🎬 ZAP-01 status check');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  await ss(page, 'Z01-STATUS-01');

  // Get full page text
  const text = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  console.log('PAGE TEXT:');
  console.log(text.substring(0, 2000));
  console.log('\nURL:', page.url());

  // Check if copilot is still working
  if (text.includes('Working on it') || text.includes('being called')) {
    console.log('\n⏳ Copilot is nog bezig, 30s extra wachten...');
    await page.waitForTimeout(30000);
    await ss(page, 'Z01-STATUS-02');
    const text2 = await page.evaluate(() => document.body.innerText.substring(0, 5000));
    console.log('NA WACHT:', text2.substring(0, 2000));
  }

  // Click through each step to check configuration
  const steps = page.locator('[data-testid*="step"], [class*="Step"]');
  const stepCount = await steps.count().catch(() => 0);
  console.log(`\nAantal stappen zichtbaar: ${stepCount}`);

  // Try scrolling up to see all steps
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // Click on step 1 to check
  const step1 = page.locator('text=Lead Created').first();
  if (await step1.isVisible().catch(() => false)) {
    await step1.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-STATUS-step1');
    const step1Text = await page.evaluate(() => {
      const panel = document.querySelector('[class*="panel"], [class*="Panel"], [class*="sidebar"]');
      return panel ? panel.innerText.substring(0, 500) : 'no panel';
    });
    console.log('Step 1:', step1Text.substring(0, 300));
  }

  // Check step 3 (Create Deal)
  const step3 = page.locator('text=Create Deal').first();
  if (await step3.isVisible().catch(() => false)) {
    await step3.click();
    await page.waitForTimeout(3000);
    await ss(page, 'Z01-STATUS-step3');
  }

  await ss(page, 'Z01-STATUS-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
