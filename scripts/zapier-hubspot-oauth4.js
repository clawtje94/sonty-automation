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
  console.log('🎬 HubSpot OAuth v4');

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
  console.log('  Popup geladen');

  // STAP 1: Klik het LABEL element om de radio te selecteren
  const labelClicked = await popup.evaluate(() => {
    const radio = document.querySelector('input[type="radio"]');
    if (!radio) return 'no radio';
    let el = radio.parentElement;
    while (el && el.tagName !== 'LABEL' && el.tagName !== 'BODY') {
      el = el.parentElement;
    }
    if (el && el.tagName === 'LABEL') {
      el.click();
      return `label clicked, checked=${radio.checked}`;
    }
    return 'no label found';
  });
  console.log(`  ${labelClicked}`);
  await popup.waitForTimeout(1000);

  // STAP 2: Klik "Account kiezen" — nu zou die enabled moeten zijn
  const btnEnabled = await popup.evaluate(() => {
    const btn = document.querySelector('button[data-button-use="primary"]');
    return btn ? btn.getAttribute('aria-disabled') : 'no btn';
  });
  console.log(`  Account kiezen disabled=${btnEnabled}`);

  if (btnEnabled === 'false' || btnEnabled === null) {
    // Knop is enabled! Klik hem
    await popup.locator('button').filter({ hasText: /Account kiezen/ }).first().click();
    console.log('  ✅ "Account kiezen" geklikt!');
  } else {
    // Force click
    await popup.evaluate(() => {
      const btn = document.querySelector('button[data-button-use="primary"]');
      if (btn) btn.click();
    });
    console.log('  Force click op "Account kiezen"');
  }

  // STAP 3: Wacht op volgende pagina (scopes/permissions of redirect)
  await popup.waitForTimeout(8000);

  if (popup.isClosed()) {
    console.log('  ✅ Popup gesloten na account kiezen — direct geautoriseerd!');
  } else {
    const newUrl = popup.url();
    console.log('  Popup URL:', newUrl.substring(0, 150));
    await ss(popup, 'OA4-02-after-account');

    const text = await popup.evaluate(() => document.body.innerText).catch(() => '');
    console.log('  Tekst:', text.substring(0, 500));

    // Check of er een scopes/grant pagina is
    const btns = await popup.locator('button:visible').all();
    console.log(`  Buttons: ${btns.length}`);
    for (const btn of btns) {
      const t = await btn.innerText().catch(() => '');
      if (t.trim()) console.log(`    "${t.trim().substring(0, 60)}"`);
    }

    // Zoek grant/connect knop
    const grantBtn = popup.locator('button').filter({
      hasText: /verbind|connect|grant|allow|authorize|goedkeur|toestaan/i
    }).first();
    if (await grantBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await grantBtn.click();
      console.log('  ✅ Grant knop geklikt!');
      await popup.waitForTimeout(10000);
    }

    // Check links (sometimes it's a link, not a button)
    const links = await popup.locator('a:visible').all();
    for (const link of links) {
      const t = await link.innerText().catch(() => '');
      if (t.trim()) console.log(`    link: "${t.trim().substring(0, 60)}"`);
    }

    if (!popup.isClosed()) {
      await ss(popup, 'OA4-03-final-popup');
    }
  }

  // Wacht en check hoofdpagina
  await page.waitForTimeout(10000);
  await ss(page, 'OA4-04-main');
  const mainText = await page.evaluate(() => document.body.innerText.substring(0, 2000));

  if (mainText.includes('Continue') && !mainText.includes('Sign in')) {
    console.log('\n  ✅✅✅ HubSpot VERBONDEN! Continue knop zichtbaar!');
  } else if (mainText.includes('Sign in')) {
    console.log('\n  ❌ Nog niet verbonden');
  } else if (mainText.includes('Change') && !mainText.includes('Connect HubSpot')) {
    console.log('\n  ⏳ Mogelijk verbonden (Change knop, geen Sign in)');
  }
  console.log('\nMain:', mainText.substring(0, 600));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
