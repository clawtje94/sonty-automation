const { chromium } = require('playwright');
const path = require('path');
const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`📸 ${name}`);
}
async function dismissTrialGuide(page) {
  await page.evaluate(() => { const i = document.getElementById('mini-trial-guide-iframe'); if(i) i.remove(); });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  await page.goto(`https://app-eu1.hubspot.com/workflows/${PORTAL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissTrialGuide(page);
  await page.locator('[data-test-id="create-workflow-dropdown"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByText('Vanaf nul').click();
  await page.waitForTimeout(4000);
  await dismissTrialGuide(page);

  // Trigger instellen
  await page.getByText('Voldoet aan filtercriteria').click();
  await page.waitForTimeout(2000);
  await page.getByText('Deal').first().click();
  await page.waitForTimeout(2000);
  await page.locator('[data-test-id="fr-condition-select"]').first().click();
  await page.waitForTimeout(1500);
  await page.getByText('Deal eigenschappen').click();
  await page.waitForTimeout(1500);
  await page.locator('input[placeholder*="oek"]').last().fill('stadium');
  await page.waitForTimeout(1500);
  await page.getByText('Stadium deal').first().click();
  await page.waitForTimeout(2000);
  await page.locator('button, div[role="button"]').filter({ hasText: /^Zoeken$/ }).first().click();
  await page.waitForTimeout(2000);
  const si = page.locator('input[placeholder*="oek"], input[type="text"]').last();
  if (await si.isVisible().catch(() => false)) { await si.fill('nieuwe'); await page.waitForTimeout(1000); }
  await page.locator('label, li, span, [role="option"]').filter({ hasText: /nieuwe lead/i }).first().click();
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  await screenshot(page, 'DIAG-na-trigger');

  // Log alle buttons die zichtbaar zijn
  const buttons = await page.locator('button:visible').allInnerTexts();
  console.log('\nZichtbare knoppen:', buttons.filter(b => b.trim().length > 0));

  await browser.close();
})();
