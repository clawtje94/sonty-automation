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

  // HubSpot OAuth popup handler
  context.on('page', async (popup) => {
    const popupUrl = popup.url();
    if (popupUrl === 'about:blank') return;
    console.log('  [POPUP]', popupUrl);

    try {
      await popup.waitForTimeout(5000);
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZPOPUP.png') }).catch(() => {});
      const text = await popup.evaluate(() => document.body.innerText.substring(0, 2000)).catch(() => '');
      console.log('  [POPUP text]', text.substring(0, 400));

      // Auto-select Sonty account
      const sonty = popup.locator('button, a, div, span, label').filter({ hasText: /Sonty/i }).first();
      if (await sonty.isVisible({ timeout: 5000 }).catch(() => false)) {
        await sonty.click();
        await popup.waitForTimeout(5000);
        console.log('  [POPUP] Sonty clicked');
        await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZPOPUP-sonty.png') }).catch(() => {});
      }

      // Grant access
      const grant = popup.locator('button').filter({ hasText: /grant|allow|authorize|connect|goedkeuren|toestaan|approve/i }).first();
      if (await grant.isVisible({ timeout: 10000 }).catch(() => false)) {
        await grant.click();
        await popup.waitForTimeout(5000);
        console.log('  [POPUP] Granted');
      }
    } catch (e) {
      console.log('  [POPUP error]', e.message.substring(0, 100));
    }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 bouwen v3');

  // Open zap editor
  await page.goto('https://zapier.com/webintent/create-zap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op Trigger stap
  await page.getByText('Select the event that starts your Zap').click();
  await page.waitForTimeout(3000);

  // Zoek en selecteer HubSpot
  const appSearch = page.locator('input[placeholder*="earch"]').first();
  await appSearch.fill('HubSpot');
  await page.waitForTimeout(2000);
  await page.locator('div, span, li, button').filter({ hasText: /^HubSpot$/ }).last().click();
  await page.waitForTimeout(5000);
  console.log('  HubSpot geselecteerd');

  // Nu op de setup panel — we moeten het event dropdown klikken
  // De combobox met aria-label="Search and select an event"
  const eventCombo = page.locator('[role="combobox"][aria-label*="event"]');
  await eventCombo.click({ force: true });
  await page.waitForTimeout(3000);
  await ss(page, 'ZB01v3-01-event-dropdown');

  // Zoek "New Deal" of deal-gerelateerde events
  // Type "deal" in het event search
  const eventInput = page.locator('[role="combobox"] input, input[aria-label*="event"]').first();
  if (await eventInput.isVisible().catch(() => false)) {
    await eventInput.fill('deal');
    await page.waitForTimeout(2000);
  } else {
    // Probeer via keyboard
    await page.keyboard.type('deal');
    await page.waitForTimeout(2000);
  }
  await ss(page, 'ZB01v3-02-event-search');

  // Dump de event opties
  const eventOpts = await page.locator('[role="option"]:visible, [class*="dropdown"] li:visible, [class*="option"]:visible').all();
  console.log(`  Event opties: ${eventOpts.length}`);
  for (const opt of eventOpts.slice(0, 15)) {
    const t = await opt.innerText().catch(() => '');
    if (t.trim()) console.log(`    "${t.trim().substring(0, 60)}"`);
  }

  // Selecteer "New Deal" of "Updated Deal Stage"
  // Voor ZAP-01 is dit niet de juiste trigger — we willen eigenlijk "New Contact" of HubSpot form
  // Maar laten we eerst kijken wat er beschikbaar is
  const newDealOpt = page.locator('[role="option"]').filter({ hasText: /new deal|nieuwe deal/i }).first();
  if (await newDealOpt.isVisible().catch(() => false)) {
    await newDealOpt.click();
    await page.waitForTimeout(3000);
    console.log('  "New Deal" event geselecteerd');
  } else {
    // Probeer ander event
    const firstOpt = page.locator('[role="option"]:visible').first();
    if (await firstOpt.isVisible().catch(() => false)) {
      const optText = await firstOpt.innerText().catch(() => '');
      console.log(`  Eerste optie: "${optText}" — selecteren`);
      await firstOpt.click();
      await page.waitForTimeout(3000);
    }
  }
  await ss(page, 'ZB01v3-03-event-selected');

  // Nu moeten we HubSpot verbinden — klik "Sign in"
  const signInBtn = page.locator('button').filter({ hasText: /^Sign in$/ }).first();
  if (await signInBtn.isVisible().catch(() => false)) {
    console.log('  Sign in knop gevonden — klikken');
    await signInBtn.click({ force: true });
    console.log('  Wacht op HubSpot OAuth popup...');
    await page.waitForTimeout(25000);
    await ss(page, 'ZB01v3-04-after-oauth');
  } else {
    console.log('  Geen Sign in knop — HubSpot al verbonden?');
  }

  // Check resultaat
  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nResultaat:', text.substring(0, 500));
  await ss(page, 'ZB01v3-05-final');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
