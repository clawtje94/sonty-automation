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
  page.setDefaultTimeout(60000);
  console.log('🎬 Copilot ZAP-02 configuratie');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik "Build it" om Copilot te starten
  const buildItBtn = page.locator('button').filter({ hasText: /^Build it$/ }).first();
  if (await buildItBtn.isVisible().catch(() => false)) {
    await buildItBtn.click();
    await page.waitForTimeout(5000);
    console.log('  "Build it" geklikt');
  }

  // Wacht tot het Copilot panel opent
  await page.waitForTimeout(3000);

  // Stuur een bericht naar Copilot met specifieke configuratie
  const chatInput = page.locator('textarea, [contenteditable="true"], input[placeholder*="Chat"], input[placeholder*="copilot"]').first();
  if (await chatInput.isVisible().catch(() => false)) {
    const config = `Please configure this zap:
1. Trigger: HubSpot "Updated Deal Stage" - set the pipeline to "Sonty Verkooppijplijn" and filter for the stage "Eerste Offerte Verstuurd"
2. Action: Reuzenpanda "Create Document Quotation" - map the deal name, contact email, and postal code from HubSpot
3. Add a third step: HubSpot "Update Deal" - update the deal with the Reuzenpanda quote URL and amount
Then rename this zap to "ZAP-02: Eerste Offerte via Reuzenpanda"`;

    await chatInput.fill(config);
    await page.waitForTimeout(1000);

    // Klik send of druk Enter
    const sendBtn = page.locator('button').filter({ hasText: /send|submit/i }).first()
      .or(page.locator('button[type="submit"]').first());
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('  Copilot instructie verstuurd');

    // Wacht op Copilot response
    await page.waitForTimeout(30000);
    await ss(page, 'ZCOP-01-response');

    // Check status
    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Copilot response:', text.substring(0, 800));

    // Wacht meer als het nog bezig is
    if (text.includes('Working') || text.includes('being called') || text.includes('Loading')) {
      console.log('  Nog bezig — wacht 30 sec');
      await page.waitForTimeout(30000);
      await ss(page, 'ZCOP-02-after-wait');
    }
  } else {
    console.log('  Chat input niet gevonden');

    // Probeer de stap direct te klikken en configureren
    // Klik op "1. Updated Deal Stage"
    const step1 = page.getByText('Updated Deal Stage').first();
    await step1.click();
    await page.waitForTimeout(3000);
    await ss(page, 'ZCOP-01-step1-click');

    // Dump het panel
    const panelText = await page.evaluate(() => {
      const aside = document.querySelector('aside, [class*="panel"], [class*="drawer"]');
      return aside ? aside.innerText.substring(0, 1500) : 'Geen panel';
    });
    console.log('Step 1 panel:', panelText.substring(0, 600));
  }

  await ss(page, 'ZCOP-03-final');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
