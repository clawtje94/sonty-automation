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
  console.log('🎬 ZAP-01 verificatie');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Close Copilot panel if open
  const closePanel = page.locator('button[aria-label*="Close"], button[aria-label*="close"]').first();
  if (await closePanel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closePanel.click();
    await page.waitForTimeout(1000);
  }

  // Try collapsing copilot sidebar by clicking the chevron
  const chevron = page.locator('[class*="copilot"] button, button').filter({ hasText: '‹' }).first();

  // Click on step 3 (Create Deal) in the canvas
  await page.waitForTimeout(2000);

  // First close copilot panel by clicking the < button
  const collapseBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(10);

  // Just click on the step 3 card text directly using force
  const createDealCard = page.locator('text=Create Deal').first();
  await createDealCard.click({ force: true, timeout: 10000 }).catch(() => {
    console.log('  Force click on Create Deal failed, trying via evaluate');
  });
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-VER-step3');

  // Take a screenshot of whatever panel opened
  const rightPanel = await page.evaluate(() => {
    // Look for the configuration panel on the right
    const panels = document.querySelectorAll('[class*="panel"], [class*="Panel"], [class*="sidebar"], [class*="Sidebar"]');
    for (const p of panels) {
      if (p.offsetWidth > 200 && p.innerText.includes('Configure')) {
        return p.innerText.substring(0, 1000);
      }
    }
    return 'No config panel found';
  });
  console.log('Step 3 panel:', rightPanel.substring(0, 500));

  // Click step 1 (trigger)
  const step1 = page.locator('text=Lead Created').first();
  await step1.click({ force: true, timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-VER-step1');

  // Get overall page status
  const fullText = await page.evaluate(() => document.body.innerText.substring(0, 5000));

  // Check for errors/warnings
  if (fullText.includes('error') || fullText.includes('Error')) {
    console.log('\n⚠️ Errors gevonden in pagina');
  }
  if (fullText.includes('required')) {
    console.log('\n⚠️ Required fields gevonden');
  }
  if (fullText.includes('⚠') || fullText.includes('warning')) {
    console.log('\n⚠️ Warnings gevonden');
  }

  // Check for yellow/orange warning icons on steps
  const warningIcons = await page.locator('[class*="warning"], [class*="error"], [data-testid*="error"]').count().catch(() => 0);
  console.log(`Warning/error elementen: ${warningIcons}`);

  console.log('\nURL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
