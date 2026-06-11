const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-02 configureren');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op de trigger stap (HubSpot - Updated Deal Stage)
  const triggerNode = page.locator('div').filter({ hasText: /Updated Deal Stage/ }).first();
  await triggerNode.click();
  await page.waitForTimeout(3000);
  await ss(page, 'ZCONF-01-trigger');

  // Dump het setup panel
  const text1 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Trigger setup:', text1.substring(0, 800));

  // Check of er configuratievelden zijn
  // Bijv. Pipeline, Stage selectie
  const dropdowns = await page.locator('[role="combobox"]:visible, select:visible').all();
  console.log(`  Dropdowns: ${dropdowns.length}`);
  for (let i = 0; i < Math.min(dropdowns.length, 5); i++) {
    const label = await dropdowns[i].getAttribute('aria-label').catch(() => '');
    const text = await dropdowns[i].innerText().catch(() => '');
    console.log(`    [${i}] label="${label}" text="${text.substring(0, 40)}"`);
  }

  // Zoek inputs
  const inputs = await page.locator('input:visible').all();
  console.log(`  Inputs: ${inputs.length}`);
  for (let i = 0; i < Math.min(inputs.length, 8); i++) {
    const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '');
    const type = await inputs[i].getAttribute('type').catch(() => '');
    console.log(`    [${i}] type="${type}" placeholder="${placeholder}"`);
  }

  // Zoek "Continue" knop
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    console.log('  Continue knop zichtbaar');
  }

  // Zoek "Test" tab
  const testTab = page.locator('button, [role="tab"]').filter({ hasText: /^Test$/ }).first();
  if (await testTab.isVisible().catch(() => false)) {
    console.log('  Test tab zichtbaar');
  }

  // Dump alle knoppen in het panel
  const btns = await page.locator('button:visible').all();
  for (const btn of btns.slice(0, 20)) {
    const t = await btn.innerText().catch(() => '');
    if (t.trim() && t.trim().length < 60) console.log(`  btn: "${t.trim()}"`);
  }

  await ss(page, 'ZCONF-02-debug');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
