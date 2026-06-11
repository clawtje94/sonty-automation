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
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-01 via Copilot: Reuzenpanda → HubSpot');

  // Open new zap
  await page.goto('https://zapier.com/webintent/create-zap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Gebruik het Copilot tekstveld om de zap te beschrijven
  const copilotInput = page.locator('textarea, [contenteditable="true"], input[placeholder*="Start building"]').first();
  if (await copilotInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    const desc = 'When a new lead is created in Reuzenpanda, create or update a contact in HubSpot and create a new deal in the Sonty Verkooppijplijn pipeline with stage Nieuwe Lead';
    await copilotInput.fill(desc);
    await page.waitForTimeout(1000);
    console.log('  Copilot beschrijving ingevuld');

    // Klik "Start building" of druk Enter
    const startBtn = page.locator('button').filter({ hasText: /Start building|Build|Send/i }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      console.log('  "Start building" geklikt');
    } else {
      await page.keyboard.press('Enter');
      console.log('  Enter gedrukt');
    }

    // Wacht op Copilot respons
    await page.waitForTimeout(20000);
    await ss(page, 'Z01C-01-copilot');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Na copilot:', text.substring(0, 600));

    // Wacht meer als het nog bezig is
    if (text.includes('Loading') || text.includes('Working') || text.includes('building')) {
      console.log('  Nog bezig — wacht 20s');
      await page.waitForTimeout(20000);
      await ss(page, 'Z01C-02-wait');
    }

  } else {
    console.log('  Copilot input niet gevonden');

    // Alternatief: klik op trigger stap "1." en selecteer Reuzenpanda handmatig
    const triggerCard = page.getByText('Select the event that starts your Zap').first();
    if (await triggerCard.isVisible().catch(() => false)) {
      await triggerCard.click();
      await page.waitForTimeout(3000);
      console.log('  Trigger card geklikt');

      // Nu zou er een app-selectie panel verschijnen
      // Zoek Reuzenpanda in de zoekbalk
      const appSearch = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await appSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
        await appSearch.fill('Reuzenpanda');
        await page.waitForTimeout(3000);

        const rpOpt = page.locator('[role="option"], li, button, a').filter({ hasText: /Reuzenpanda/i }).first();
        if (await rpOpt.isVisible().catch(() => false)) {
          await rpOpt.click();
          console.log('  ✅ Reuzenpanda geselecteerd');
          await page.waitForTimeout(5000);
        }
      }
    }
  }

  await ss(page, 'Z01C-03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 600));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
