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
  console.log('🎬 ZAP-02 afronden');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);
  await ss(page, 'Z02F-01-trigger');

  // Check of account nu verbonden is
  const panelText = await page.evaluate(() => {
    const panel = document.querySelector('aside, [class*="panel"], [class*="sidebar"]');
    return panel ? panel.innerText : document.body.innerText.substring(0, 2000);
  });
  console.log('Panel:', panelText.substring(0, 600));

  // Check voor "Continue" knop
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(5000);
    console.log('  Continue geklikt');
    await ss(page, 'Z02F-02-after-continue');

    // Nu verschijnen configuratievelden
    const configText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Config:', configText.substring(0, 800));

    // Dump alle dropdowns en inputs
    const combos = await page.locator('[role="combobox"]:visible').all();
    console.log(`\nComboboxes: ${combos.length}`);
    for (let i = 0; i < combos.length; i++) {
      const label = await combos[i].getAttribute('aria-label').catch(() => '');
      const text = await combos[i].innerText().catch(() => '');
      console.log(`  [${i}] label="${label}" text="${text.substring(0, 50)}"`);
    }

    // Zoek specifiek pipeline en stage dropdowns
    const allLabels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label, [class*="label"]')).map(l => l.innerText?.trim()).filter(t => t);
    });
    console.log('\nLabels:', allLabels.slice(0, 10).join(', '));

    await ss(page, 'Z02F-03-config');
  } else {
    // Misschien is er een account dropdown
    const accountDD = page.locator('[role="combobox"]').filter({ hasText: /connect|account|hubspot/i }).first();
    if (await accountDD.isVisible().catch(() => false)) {
      await accountDD.click({ force: true });
      await page.waitForTimeout(2000);

      // Selecteer het verbonden account
      const accOpt = page.locator('[role="option"]').first();
      if (await accOpt.isVisible().catch(() => false)) {
        const accText = await accOpt.innerText().catch(() => '');
        console.log(`  Account optie: "${accText}"`);
        await accOpt.click();
        await page.waitForTimeout(3000);
      }
    }

    // Check opnieuw voor Continue
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(5000);
      console.log('  Continue geklikt (2e poging)');
    }

    await ss(page, 'Z02F-02-alt');
    const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Alt:', text.substring(0, 600));
  }

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
