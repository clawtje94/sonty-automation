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
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 HubSpot koppelen aan Zapier');

  // Ga naar connections en klik Add connection
  await page.goto('https://zapier.com/app/connections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Dismiss cookie banner
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Klik "Add connection"
  const addBtn = page.locator('button, a').filter({ hasText: /add connection/i }).first();
  await addBtn.click();
  await page.waitForTimeout(3000);
  await ss(page, 'ZC-01-add-connection');

  // Zoek naar HubSpot in het zoekvenster
  const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[placeholder*="app"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill('HubSpot');
  await page.waitForTimeout(2000);
  await ss(page, 'ZC-02-search-hubspot');

  // Klik op HubSpot in de resultaten
  const hubspotOption = page.locator('button, a, [role="option"], li, div').filter({ hasText: /^HubSpot$/i }).first();
  if (await hubspotOption.isVisible().catch(() => false)) {
    await hubspotOption.click();
    await page.waitForTimeout(5000);
    console.log('  HubSpot geselecteerd');
  } else {
    // Probeer bredere match
    const hubspot2 = page.getByText('HubSpot', { exact: true }).first();
    await hubspot2.click();
    await page.waitForTimeout(5000);
  }
  await ss(page, 'ZC-03-hubspot-selected');

  // Er verschijnt een HubSpot OAuth popup/redirect
  // Wacht op popup of check huidige pagina
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Na selectie:', pageText.substring(0, 500));

  // Check of er een popup opent
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
  ]);

  if (popup) {
    console.log('  Popup geopend:', popup.url());
    await popup.waitForTimeout(3000);

    // HubSpot OAuth — we moeten inloggen of een account selecteren
    const popupText = await popup.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('  Popup tekst:', popupText.substring(0, 500));
    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZC-04-popup.png') });

    // Als er een login nodig is, gebruik HubSpot cookies
    if (popupText.includes('Log in') || popupText.includes('Sign in') || popupText.includes('Aanmelden')) {
      // Laad HubSpot sessie cookies in de popup context
      const hsSession = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
      for (const cookie of hsSession.cookies || []) {
        if (cookie.domain?.includes('hubspot')) {
          await context.addCookies([cookie]).catch(() => {});
        }
      }
      console.log('  HubSpot cookies geladen');
      await popup.reload();
      await popup.waitForTimeout(5000);
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZC-05-popup-reload.png') });
    }

    // Check of we een account moeten selecteren
    const popupText2 = await popup.evaluate(() => document.body.innerText.substring(0, 2000));
    if (popupText2.includes('Sonty') || popupText2.includes('147970649') || popupText2.includes('account')) {
      // Selecteer het Sonty account
      const sontyBtn = popup.locator('button, a, [role="button"]').filter({ hasText: /sonty/i }).first();
      if (await sontyBtn.isVisible().catch(() => false)) {
        await sontyBtn.click();
        await popup.waitForTimeout(5000);
        console.log('  Sonty account geselecteerd');
      }
    }

    // Autoriseer
    const authorizeBtn = popup.locator('button').filter({ hasText: /grant|authorize|allow|toestaan|connect/i }).first();
    if (await authorizeBtn.isVisible().catch(() => false)) {
      await authorizeBtn.click();
      await popup.waitForTimeout(5000);
      console.log('  Autorisatie verleend');
    }

    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZC-06-popup-final.png') });
  } else {
    console.log('  Geen popup — check huidige pagina');
    // Misschien is de auth flow in-page
    await ss(page, 'ZC-04-no-popup');
  }

  // Wacht en check of HubSpot nu verbonden is
  await page.waitForTimeout(5000);
  await page.goto('https://zapier.com/app/connections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'ZC-07-connections-after');

  const connText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  if (connText.includes('HubSpot')) {
    console.log('  ✅ HubSpot verbonden!');
  } else {
    console.log('  ❌ HubSpot niet gevonden in connections');
    console.log('  Connections:', connText.substring(0, 500));
  }

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await context.close();
  await browser.close();
})();
