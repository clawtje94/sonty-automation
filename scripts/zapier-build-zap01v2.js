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
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const zapierState = JSON.parse(fs.readFileSync(ZAPIER_SESSION, 'utf8'));
  const hubspotState = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
  const allCookies = [...(zapierState.cookies || []), ...(hubspotState.cookies || [])];
  const mergedState = { ...zapierState, cookies: allCookies };

  const context = await browser.newContext({ storageState: mergedState });

  // Listen for popups (HubSpot OAuth)
  context.on('page', async (popup) => {
    const popupUrl = popup.url();
    console.log('  [POPUP]', popupUrl);
    if (!popupUrl.includes('hubspot') && !popupUrl.includes('oauth')) return;

    await popup.waitForTimeout(5000);
    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZPOPUP.png') }).catch(() => {});

    const popupText = await popup.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '');
    console.log('  [POPUP] Text:', popupText.substring(0, 300));

    // Select Sonty account
    const sontyLink = popup.locator('button, a, div, label, [class*="account"]').filter({ hasText: /sonty/i }).first();
    if (await sontyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sontyLink.click();
      await popup.waitForTimeout(5000);
      console.log('  [POPUP] Sonty geselecteerd');
    }

    // Grant/connect
    const grantBtn = popup.locator('button').filter({ hasText: /grant|allow|authorize|connect|goedkeuren|toestaan/i }).first();
    if (await grantBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await grantBtn.click();
      await popup.waitForTimeout(5000);
      console.log('  [POPUP] Autorisatie verleend');
    }

    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZPOPUP-after.png') }).catch(() => {});
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 bouwen v2');

  // De vorige run heeft al een zap aangemaakt — laten we die gebruiken
  // Of maak een nieuwe
  await page.goto('https://zapier.com/webintent/create-zap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op Trigger stap
  const triggerEl = page.getByText('Select the event that starts your Zap');
  await triggerEl.click();
  await page.waitForTimeout(3000);

  // Zoek HubSpot in het app panel
  const appSearch = page.locator('input[placeholder*="earch"]').first();
  await appSearch.waitFor({ state: 'visible', timeout: 10000 });
  await appSearch.fill('HubSpot');
  await page.waitForTimeout(2000);

  // Klik op HubSpot resultaat
  // Het staat in een lijst/panel aan de rechterkant
  const hubspotItem = page.locator('div, span, li, button').filter({ hasText: /^HubSpot$/ }).last();
  await hubspotItem.click();
  await page.waitForTimeout(5000);
  console.log('  HubSpot geselecteerd');
  await ss(page, 'ZB01v2-01-hubspot');

  // Nu verschijnt er een event selectie panel
  // Dump huidige staat
  const text1 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Na HubSpot selectie:', text1.substring(0, 600));

  // Zoek "New Deal" of "Deal Stage Change" of andere trigger events
  // Er is waarschijnlijk een dropdown of lijst van events
  const eventSearch = page.locator('input[placeholder*="event"], input[placeholder*="earch"]').first();
  if (await eventSearch.isVisible().catch(() => false)) {
    await eventSearch.fill('deal');
    await page.waitForTimeout(2000);
    console.log('  "deal" gezocht in events');
  }

  // Klik op de event dropdown als die er is
  const eventDropdown = page.locator('button, [role="combobox"], select').filter({ hasText: /choose|select|event|trigger/i }).first();
  if (await eventDropdown.isVisible().catch(() => false)) {
    await eventDropdown.click();
    await page.waitForTimeout(2000);
  }

  await ss(page, 'ZB01v2-02-events');

  // Dump alle zichtbare opties
  const opts = await page.locator('[role="option"]:visible, li:visible').all();
  console.log(`  Event opties: ${opts.length}`);
  for (const opt of opts.slice(0, 10)) {
    const t = await opt.innerText().catch(() => '');
    if (t.trim() && t.trim().length < 80) console.log(`    "${t.trim()}"`);
  }

  // Zoek HubSpot connectie prompt
  const signInBtn = page.locator('button').filter({ hasText: /sign in|connect|log in|aanmelden/i }).first();
  if (await signInBtn.isVisible().catch(() => false)) {
    console.log('  HubSpot sign-in knop gevonden');
    await signInBtn.click();
    console.log('  Wacht op OAuth popup...');
    await page.waitForTimeout(20000);
    await ss(page, 'ZB01v2-03-after-signin');
  }

  // Check huidige staat
  const text2 = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nHuidige staat:', text2.substring(0, 500));
  await ss(page, 'ZB01v2-04-final');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
