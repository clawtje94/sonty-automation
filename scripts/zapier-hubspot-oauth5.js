const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');
const HUBSPOT_SESSION = path.join(__dirname, 'hubspot-session.json');

async function ss(ctx, name) {
  await ctx.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`), fullPage: true });
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
  console.log('🎬 HubSpot OAuth v5 — scopes + App verbinden');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  // Start popup listener
  const popupPromise = context.waitForEvent('page', { timeout: 20000 });
  await page.locator('button').filter({ hasText: /^Sign in$/ }).first().click({ force: true });
  console.log('  Sign in geklikt');

  const popup = await popupPromise.catch(() => null);
  if (!popup) { console.log('  ❌ Geen popup'); await browser.close(); return; }
  await popup.waitForLoadState('networkidle').catch(() => {});
  await popup.waitForTimeout(3000);

  // STAP 1: Selecteer account via label click
  await popup.evaluate(() => {
    const radio = document.querySelector('input[type="radio"]');
    if (!radio) return;
    let el = radio.parentElement;
    while (el && el.tagName !== 'LABEL') el = el.parentElement;
    if (el) el.click();
  });
  console.log('  Radio geselecteerd');
  await popup.waitForTimeout(1000);

  // STAP 2: Klik "Account kiezen"
  await popup.locator('button').filter({ hasText: /Account kiezen/ }).first().click();
  console.log('  ✅ Account kiezen geklikt');

  // STAP 3: Wacht op scopes pagina
  await popup.waitForTimeout(8000);
  await ss(popup, 'OA5-01-scopes');

  const text = await popup.evaluate(() => document.body.innerText).catch(() => '');
  console.log('  Scopes pagina:', text.substring(0, 300));

  // STAP 4: Scroll helemaal naar beneden zodat "App verbinden" zichtbaar wordt
  await popup.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await popup.waitForTimeout(2000);
  console.log('  Naar beneden gescrolld');

  // Check "App verbinden" button status
  const btnInfo = await popup.evaluate(() => {
    const btns = document.querySelectorAll('button');
    const results = [];
    for (const btn of btns) {
      const t = btn.innerText?.trim();
      if (t && t.includes('verbinden')) {
        results.push({
          text: t,
          disabled: btn.getAttribute('aria-disabled'),
          testId: btn.getAttribute('data-test-id'),
          visible: btn.offsetParent !== null
        });
      }
    }
    return results;
  });
  console.log('  "App verbinden" knop:', JSON.stringify(btnInfo));

  await ss(popup, 'OA5-02-scrolled');

  // STAP 5: Scroll meer — misschien is er een specifiek scroll-container
  await popup.evaluate(() => {
    // Try scrolling different containers
    const containers = document.querySelectorAll('[class*="scroll"], [class*="content"], main, [role="main"]');
    for (const c of containers) {
      c.scrollTop = c.scrollHeight;
    }
    // Also try the authorize button container
    const btn = document.querySelector('[data-test-id="authorize-button"]');
    if (btn) btn.scrollIntoView({ behavior: 'instant' });
  });
  await popup.waitForTimeout(2000);

  // Check button again
  const btnInfo2 = await popup.evaluate(() => {
    const btn = document.querySelector('[data-test-id="authorize-button"]');
    if (!btn) return 'no authorize button found';
    return {
      text: btn.innerText,
      disabled: btn.getAttribute('aria-disabled'),
      loading: btn.getAttribute('data-loading'),
      rect: btn.getBoundingClientRect()
    };
  });
  console.log('  Authorize button:', JSON.stringify(btnInfo2));

  // STAP 6: Klik "App verbinden" (force of via evaluate)
  if (typeof btnInfo2 === 'object' && btnInfo2.disabled === 'true') {
    console.log('  Button disabled — probeer force click...');
    // Scroll to it and force click
    await popup.evaluate(() => {
      const btn = document.querySelector('[data-test-id="authorize-button"]');
      if (btn) {
        btn.scrollIntoView();
        btn.removeAttribute('aria-disabled');
        btn.removeAttribute('disabled');
        btn.click();
      }
    });
    console.log('  Force click uitgevoerd');
    await popup.waitForTimeout(10000);
  } else if (typeof btnInfo2 === 'object' && (btnInfo2.disabled === 'false' || !btnInfo2.disabled)) {
    // Button is enabled!
    await popup.locator('[data-test-id="authorize-button"]').click();
    console.log('  ✅ App verbinden geklikt!');
    await popup.waitForTimeout(10000);
  }

  // Check result
  if (popup.isClosed()) {
    console.log('  ✅✅ Popup gesloten — autorisatie geslaagd!');
  } else {
    await ss(popup, 'OA5-03-after-connect');
    const finalText = await popup.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => '');
    console.log('  Popup na klik:', finalText);
  }

  // Wacht en check hoofdpagina
  await page.waitForTimeout(10000);
  await ss(page, 'OA5-04-main');
  const mainText = await page.evaluate(() => document.body.innerText.substring(0, 1500));

  if (mainText.includes('Continue') && !mainText.includes('Sign in')) {
    console.log('\n  ✅✅✅ HubSpot VERBONDEN! Continue knop zichtbaar!');
  } else if (mainText.includes('Sign in')) {
    console.log('\n  ❌ Nog niet verbonden');
  } else {
    console.log('\n  Status onduidelijk');
  }
  console.log('\nMain:', mainText.substring(0, 500));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
