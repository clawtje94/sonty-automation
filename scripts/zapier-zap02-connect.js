const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');
const HUBSPOT_SESSION = path.join(__dirname, 'hubspot-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const zapierState = JSON.parse(fs.readFileSync(ZAPIER_SESSION, 'utf8'));
  const hubspotState = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
  const allCookies = [...(zapierState.cookies || []), ...(hubspotState.cookies || [])];
  const mergedState = { ...zapierState, cookies: allCookies };

  const context = await browser.newContext({ storageState: mergedState });

  // OAuth popup handler
  context.on('page', async (popup) => {
    const url = popup.url();
    if (url === 'about:blank') return;
    console.log('  [POPUP]', url.substring(0, 100));

    try {
      await popup.waitForTimeout(5000);
      const text = await popup.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '');
      console.log('  [POPUP text]', text.substring(0, 300));
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZPOPUP2.png') }).catch(() => {});

      // Select Sonty
      const sonty = popup.locator('button, a, div, span, label, [class*="account"]').filter({ hasText: /Sonty/i }).first();
      if (await sonty.isVisible({ timeout: 8000 }).catch(() => false)) {
        await sonty.click();
        await popup.waitForTimeout(5000);
        console.log('  [POPUP] Sonty clicked');
      }

      // Grant access
      const grant = popup.locator('button').filter({ hasText: /grant|allow|authorize|connect|goedkeuren/i }).first();
      if (await grant.isVisible({ timeout: 10000 }).catch(() => false)) {
        await grant.click();
        await popup.waitForTimeout(5000);
        console.log('  [POPUP] Granted');
      }
    } catch (e) {
      console.log('  [POPUP error]', e.message.substring(0, 80));
    }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-02 HubSpot koppelen + configureren');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  // Klik "Sign in" voor HubSpot
  const signIn = page.locator('button').filter({ hasText: /^Sign in$/ }).first();
  if (await signIn.isVisible().catch(() => false)) {
    console.log('  Sign in klikken...');
    await signIn.click({ force: true });
    console.log('  Wacht op OAuth...');
    await page.waitForTimeout(25000);
    await ss(page, 'Z02C-01-after-oauth');
  }

  // Check of het account nu verbonden is
  const text1 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Na OAuth:', text1.substring(0, 500));

  // Als verbonden, ga door met configuratie
  // Er verschijnt waarschijnlijk een "Continue" knop of configuratievelden
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(5000);
    console.log('  Continue geklikt');
    await ss(page, 'Z02C-02-after-continue');

    // Nu verschijnen de configuratievelden (Pipeline, Stage, etc.)
    const text2 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Configuratie:', text2.substring(0, 600));

    // Zoek pipeline dropdown
    const pipelineDD = page.locator('[role="combobox"], select, button').filter({ hasText: /pipeline|pijplijn/i }).first();
    if (await pipelineDD.isVisible().catch(() => false)) {
      await pipelineDD.click({ force: true });
      await page.waitForTimeout(2000);
      console.log('  Pipeline dropdown geopend');

      // Selecteer Sonty Verkooppijplijn
      const sontyPipe = page.locator('[role="option"], li').filter({ hasText: /sonty/i }).first();
      if (await sontyPipe.isVisible().catch(() => false)) {
        await sontyPipe.click();
        await page.waitForTimeout(2000);
        console.log('  Sonty Verkooppijplijn geselecteerd');
      }
    }

    // Zoek stage dropdown
    const stageDD = page.locator('[role="combobox"], select, button').filter({ hasText: /stage|stadium/i }).first();
    if (await stageDD.isVisible().catch(() => false)) {
      await stageDD.click({ force: true });
      await page.waitForTimeout(2000);

      const stageOpt = page.locator('[role="option"], li').filter({ hasText: /eerste offerte/i }).first();
      if (await stageOpt.isVisible().catch(() => false)) {
        await stageOpt.click();
        await page.waitForTimeout(2000);
        console.log('  Eerste Offerte Verstuurd geselecteerd');
      }
    }

    await ss(page, 'Z02C-03-configured');
  }

  // Dump final state
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nFinal:', finalText.substring(0, 600));
  await ss(page, 'Z02C-04-final');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
