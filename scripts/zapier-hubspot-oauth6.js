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
  console.log('🎬 HubSpot OAuth v6 — checkbox + App verbinden');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  const popupPromise = context.waitForEvent('page', { timeout: 20000 });
  await page.locator('button').filter({ hasText: /^Sign in$/ }).first().click({ force: true });
  console.log('  Sign in geklikt');

  const popup = await popupPromise.catch(() => null);
  if (!popup) { console.log('  ❌ Geen popup'); await browser.close(); return; }
  await popup.waitForLoadState('networkidle').catch(() => {});
  await popup.waitForTimeout(3000);

  // STAP 1: Selecteer account
  await popup.evaluate(() => {
    const radio = document.querySelector('input[type="radio"]');
    if (!radio) return;
    let el = radio.parentElement;
    while (el && el.tagName !== 'LABEL') el = el.parentElement;
    if (el) el.click();
  });
  await popup.waitForTimeout(1000);
  await popup.locator('button').filter({ hasText: /Account kiezen/ }).first().click();
  console.log('  ✅ Account geselecteerd + Account kiezen geklikt');

  // STAP 2: Wacht op scopes pagina
  await popup.waitForTimeout(8000);

  // STAP 3: Scroll naar beneden en vink de checkbox aan
  await popup.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await popup.waitForTimeout(1000);

  // Vind en klik de checkbox (voorwaarden akkoord)
  const checkboxResult = await popup.evaluate(() => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      if (!cb.checked) {
        // Try clicking the label first
        let label = cb.parentElement;
        while (label && label.tagName !== 'LABEL') label = label.parentElement;
        if (label) {
          label.click();
          return `label clicked, checked=${cb.checked}`;
        }
        // Direct click
        cb.click();
        return `direct click, checked=${cb.checked}`;
      }
      return `already checked`;
    }
    return 'no checkbox found';
  });
  console.log(`  Checkbox: ${checkboxResult}`);
  await popup.waitForTimeout(2000);

  // Check if "App verbinden" is now enabled
  const btnStatus = await popup.evaluate(() => {
    const btn = document.querySelector('[data-test-id="authorize-button"]');
    return btn ? { disabled: btn.getAttribute('aria-disabled'), text: btn.innerText } : 'no btn';
  });
  console.log(`  App verbinden: ${JSON.stringify(btnStatus)}`);
  await ss(popup, 'OA6-01-checkbox-done');

  // STAP 4: Klik "App verbinden"
  if (typeof btnStatus === 'object' && (btnStatus.disabled === 'false' || btnStatus.disabled === null)) {
    console.log('  ✅ Button enabled — klikken!');
    await popup.locator('[data-test-id="authorize-button"]').click();
    console.log('  ✅ App verbinden geklikt!');
  } else {
    console.log('  Button nog disabled — force click...');
    await popup.evaluate(() => {
      const btn = document.querySelector('[data-test-id="authorize-button"]');
      if (btn) { btn.removeAttribute('aria-disabled'); btn.click(); }
    });
  }

  // Wacht op redirect/sluiting
  await popup.waitForTimeout(15000).catch(() => {});

  if (popup.isClosed()) {
    console.log('  ✅✅ Popup gesloten — OAuth geslaagd!');
  } else {
    await ss(popup, 'OA6-02-after-connect');
    const pText = await popup.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => '');
    console.log('  Popup:', pText);
  }

  // Check hoofdpagina
  await page.waitForTimeout(10000);
  await ss(page, 'OA6-03-main');
  const mainText = await page.evaluate(() => document.body.innerText.substring(0, 2000));

  if (mainText.includes('Continue') && !mainText.includes('Sign in')) {
    console.log('\n  ✅✅✅ HubSpot VERBONDEN! Continue knop zichtbaar!');
  } else if (!mainText.includes('Sign in') && mainText.includes('Change')) {
    console.log('\n  ⏳ Waarschijnlijk verbonden (Change knop)');
  } else if (mainText.includes('Sign in')) {
    console.log('\n  ❌ Nog niet verbonden');
  }
  console.log('\nMain:', mainText.substring(0, 600));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
