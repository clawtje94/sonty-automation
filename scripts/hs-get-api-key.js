const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}
async function dismiss(page) {
  await page.evaluate(() => {
    document.getElementById('mini-trial-guide-iframe')?.remove();
    document.querySelectorAll('[class*="TrialGuide"], [class*="trial-guide"]').forEach(e => e.remove());
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  // STAP 1: Probeer de Sleutels pagina
  console.log('=== Stap 1: Sleutels pagina ===');
  await page.goto(
    `https://app-eu1.hubspot.com/developer/${PORTAL_ID}/api-keys`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'KEY-01-sleutels');
  let text1 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Sleutels pagina:', text1.substring(0, 400));

  // STAP 2: Probeer Private App create via directe URL
  console.log('\n=== Stap 2: Private App create ===');
  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'KEY-02-private-app-create');
  let text2 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Private App create:', text2.substring(0, 400));

  // Check of er een form is
  const inputs = await page.locator('input:visible').all();
  console.log(`Zichtbare inputs: ${inputs.length}`);
  for (let i = 0; i < Math.min(inputs.length, 5); i++) {
    const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '');
    const label = await inputs[i].getAttribute('aria-label').catch(() => '');
    const name = await inputs[i].getAttribute('name').catch(() => '');
    console.log(`  input[${i}]: placeholder="${placeholder}" label="${label}" name="${name}"`);
  }

  // STAP 3: Probeer "Verouderde app maken" op de oude apps pagina
  console.log('\n=== Stap 3: Verouderde app maken ===');
  await page.goto(
    `https://app-eu1.hubspot.com/developer/${PORTAL_ID}/applications`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  const createLegacyBtn = page.locator('a, button').filter({ hasText: /verouderde app maken/i }).first();
  if (await createLegacyBtn.isVisible().catch(() => false)) {
    console.log('Verouderde app maken knop gevonden — klikken');
    await createLegacyBtn.click();
    await page.waitForTimeout(5000);
    await dismiss(page);
    await ss(page, 'KEY-03-legacy-create');
    let text3 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Legacy create page:', text3.substring(0, 600));

    // Zoek inputs
    const legacyInputs = await page.locator('input:visible').all();
    console.log(`Zichtbare inputs: ${legacyInputs.length}`);
    for (let i = 0; i < Math.min(legacyInputs.length, 5); i++) {
      const placeholder = await legacyInputs[i].getAttribute('placeholder').catch(() => '');
      const type = await legacyInputs[i].getAttribute('type').catch(() => '');
      console.log(`  input[${i}]: type="${type}" placeholder="${placeholder}"`);
    }

    // Zoek tabs
    const tabs = await page.locator('[role="tab"]:visible, .private-tabs a:visible').all();
    console.log(`Tabs: ${tabs.length}`);
    for (const tab of tabs) {
      const tabText = await tab.innerText().catch(() => '');
      console.log(`  tab: "${tabText}"`);
    }
  }

  // STAP 4: Probeer access tokens pagina
  console.log('\n=== Stap 4: Access tokens ===');
  await page.goto(
    `https://app-eu1.hubspot.com/developer/${PORTAL_ID}/access-tokens`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'KEY-04-access-tokens');
  let text4 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Access tokens:', text4.substring(0, 400));

  await context.close();
  await browser.close();
})();
