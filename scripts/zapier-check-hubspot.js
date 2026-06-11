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
  console.log('🎬 Check HubSpot connectie in Zapier');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(5000);

  await ss(page, 'CHECK-01');

  // Read the panel
  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Panel:', text.substring(0, 800));

  // Check for "Continue" button (means account is connected and ready)
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    console.log('  ✅ Continue knop zichtbaar — HubSpot is verbonden!');
  }

  // Check for "Sign in" (means not connected)
  const signIn = page.locator('button').filter({ hasText: /^Sign in$/ }).first();
  if (await signIn.isVisible().catch(() => false)) {
    console.log('  ❌ Sign in nog zichtbaar — NIET verbonden');
  }

  // Check for account name
  if (text.includes('Change') && !text.includes('Sign in') && !text.includes('Connect HubSpot')) {
    console.log('  ✅ Account lijkt verbonden (Change knop, geen Sign in)');
  }

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
