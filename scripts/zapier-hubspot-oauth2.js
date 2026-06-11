const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');
const HUBSPOT_SESSION = path.join(__dirname, 'hubspot-session.json');

async function ss(ctx, name) {
  await ctx.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const zapierState = JSON.parse(fs.readFileSync(ZAPIER_SESSION, 'utf8'));
  const hubspotState = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
  const allCookies = [...(zapierState.cookies || []), ...(hubspotState.cookies || [])];
  const mergedState = { ...zapierState, cookies: allCookies };

  const context = await browser.newContext({ storageState: mergedState });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 HubSpot OAuth v2');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  // Check of er al een account verbonden is (niet "Connect HubSpot" maar een echt account)
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  // "Connect HubSpot" = NIET verbonden. Een echte verbinding toont account naam.
  const hasSignIn = panelText.includes('Sign in') && panelText.includes('Connect HubSpot');
  if (!hasSignIn && (panelText.includes('daimy@sonty.nl') || panelText.includes('Sonty'))) {
    console.log('  ✅ HubSpot is al verbonden!');
    await ss(page, 'OAUTH2-already-connected');
    await context.close();
    await browser.close();
    return;
  }
  console.log('  HubSpot nog niet verbonden — OAuth starten...');

  // Klik Sign in
  const signIn = page.locator('button').filter({ hasText: /^Sign in$/ }).first();
  if (!await signIn.isVisible().catch(() => false)) {
    console.log('  Geen "Sign in" knop — mogelijk al verbonden');
    await ss(page, 'OAUTH2-no-signin');
    // Save and exit
    const storageState = await context.storageState();
    fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
    await context.close();
    await browser.close();
    return;
  }

  // Wait for popup after clicking Sign in
  const popupPromise = context.waitForEvent('page', { timeout: 20000 });
  await signIn.click({ force: true });
  console.log('  Sign in geklikt, wacht op popup...');

  const popup = await popupPromise.catch(() => null);
  if (!popup) {
    console.log('  ❌ Geen popup verschenen');
    await ss(page, 'OAUTH2-no-popup');
    await context.close();
    await browser.close();
    return;
  }

  // Wait for popup to load
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(5000);
  console.log('  Popup URL:', popup.url().substring(0, 120));
  await ss(popup, 'OAUTH2-01-popup');

  const popupText = await popup.evaluate(() => document.body.innerText).catch(() => '');
  console.log('  Popup inhoud:', popupText.substring(0, 400));

  // STAP 1: Selecteer Sonty B.V. account via radio button
  // De radio button reageert niet op gewone click — gebruik evaluate
  const radioClicked = await popup.evaluate(() => {
    // Find all radio inputs or elements that look like radio buttons
    const radios = document.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      radios[0].checked = true;
      radios[0].click();
      radios[0].dispatchEvent(new Event('change', { bubbles: true }));
      radios[0].dispatchEvent(new Event('input', { bubbles: true }));
      return `radio found and clicked, checked=${radios[0].checked}`;
    }
    // Try label click
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.innerText?.includes('Sonty')) {
        label.click();
        return `label clicked: ${label.innerText}`;
      }
    }
    // Try clicking the table row
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      if (row.innerText?.includes('Sonty')) {
        row.click();
        return `row clicked: ${row.innerText?.substring(0, 50)}`;
      }
    }
    return 'nothing found';
  }).catch(e => `error: ${e.message}`);
  console.log(`  Radio result: ${radioClicked}`);
  await popup.waitForTimeout(2000);

  // Check if button is now enabled
  const btnDisabled = await popup.evaluate(() => {
    const btn = document.querySelector('button[data-button-use="primary"]');
    return btn ? { disabled: btn.getAttribute('aria-disabled'), text: btn.innerText } : null;
  }).catch(() => null);
  console.log(`  Button status: ${JSON.stringify(btnDisabled)}`);

  // If still disabled, try React-style event on the radio
  if (btnDisabled?.disabled === 'true') {
    console.log('  Button nog disabled — probeer React-compatible click...');
    await popup.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios.length > 0) {
        // React uses its own event system
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'checked'
        ).set;
        nativeInputValueSetter.call(radios[0], true);
        radios[0].dispatchEvent(new Event('input', { bubbles: true }));
        radios[0].dispatchEvent(new Event('change', { bubbles: true }));
        radios[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }).catch(e => console.log(`  React click error: ${e.message}`));
    await popup.waitForTimeout(2000);

    // Check again
    const btnDisabled2 = await popup.evaluate(() => {
      const btn = document.querySelector('button[data-button-use="primary"]');
      return btn ? { disabled: btn.getAttribute('aria-disabled'), text: btn.innerText } : null;
    }).catch(() => null);
    console.log(`  Button status na React click: ${JSON.stringify(btnDisabled2)}`);
  }

  // If still disabled, force-click the button anyway
  if (btnDisabled?.disabled === 'true') {
    console.log('  Force-click op "Account kiezen"...');
    await popup.evaluate(() => {
      const btn = document.querySelector('button[data-button-use="primary"]');
      if (btn) {
        btn.removeAttribute('aria-disabled');
        btn.removeAttribute('disabled');
        btn.click();
      }
    }).catch(e => console.log(`  Force click error: ${e.message}`));
    await popup.waitForTimeout(2000);
  }

  await ss(popup, 'OAUTH2-01b-after-radio');

  // STAP 2: Klik "Account kiezen" knop (may already be clicked via force above)
  const accountBtn = popup.locator('button').filter({ hasText: /Account kiezen|Choose account|Select account/i }).first();
  if (await accountBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('  "Account kiezen" knop gevonden — klikken...');
    await accountBtn.click({ force: true }).catch(() => {});
    console.log('  ✅ Account kiezen geklikt!');
    await popup.waitForTimeout(8000);
    await ss(popup, 'OAUTH2-02-after-account');

    // STAP 3: Na account kiezen verschijnt er waarschijnlijk een scopes/permissions pagina
    const text2 = await popup.evaluate(() => document.body.innerText).catch(() => '');
    console.log('  Na account kiezen:', text2.substring(0, 500));

    // Zoek alle buttons
    const btns = await popup.locator('button:visible').all();
    console.log(`  Buttons: ${btns.length}`);
    for (const btn of btns) {
      const t = await btn.innerText().catch(() => '');
      if (t.trim()) console.log(`    btn: "${t.trim().substring(0, 80)}"`);
    }

    // Zoek een "Verbinden" / "Connect" / "Grant access" / "Toestaan" knop
    const connectBtn = popup.locator('button').filter({
      hasText: /verbind|connect|grant|allow|authorize|goedkeur|toestaan|accepter|approve|access/i
    }).first();

    if (await connectBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      const btnLabel = await connectBtn.innerText().catch(() => '');
      console.log(`  Verbind-knop gevonden: "${btnLabel}" — klikken...`);
      await connectBtn.click();
      console.log('  ✅ Verbinding goedgekeurd!');
      await popup.waitForTimeout(10000);
    } else {
      console.log('  Geen verbind-knop — check of popup al gesloten is');
      if (popup.isClosed()) {
        console.log('  ✅ Popup is gesloten — OAuth waarschijnlijk geslaagd!');
      } else {
        await ss(popup, 'OAUTH2-03-no-connect-btn');
        // Dump alles
        const text3 = await popup.evaluate(() => document.body.innerText).catch(() => '');
        console.log('  Popup tekst:', text3.substring(0, 500));

        // Misschien is er een input of checkbox
        const inputs = await popup.locator('input:visible').all();
        console.log(`  Inputs: ${inputs.length}`);
        const checkboxes = await popup.locator('input[type="checkbox"]:visible').all();
        console.log(`  Checkboxes: ${checkboxes.length}`);
      }
    }
  } else {
    console.log('  ❌ "Account kiezen" knop niet gevonden');
    // Misschien is de popup al voorbij de account selectie
    const btns2 = await popup.locator('button:visible').all();
    for (const btn of btns2) {
      const t = await btn.innerText().catch(() => '');
      if (t.trim()) console.log(`    btn: "${t.trim().substring(0, 80)}"`);
    }
  }

  // Check of popup gesloten is (= success)
  await popup.waitForTimeout(3000).catch(() => {});
  if (popup.isClosed()) {
    console.log('  ✅ Popup gesloten — OAuth geslaagd!');
  } else {
    await ss(popup, 'OAUTH2-04-final-popup');
  }

  // Check hoofdpagina
  await page.waitForTimeout(5000);
  await ss(page, 'OAUTH2-05-main');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nHoofdpagina:', finalText.substring(0, 600));

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
