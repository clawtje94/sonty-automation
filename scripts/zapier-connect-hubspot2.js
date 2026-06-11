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
  console.log('🎬 HubSpot koppelen aan Zapier v2');

  // Dismiss cookie banner first
  await page.goto('https://zapier.com/app/connections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Klik "Add connection"
  await page.locator('button, a').filter({ hasText: /add connection/i }).first().click();
  await page.waitForTimeout(3000);

  // Zoek het search input in de dialog
  const searchInput = page.locator('[placeholder*="Search for an app"], [placeholder*="earch"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill('HubSpot');
  await page.waitForTimeout(3000);
  await ss(page, 'ZC2-01-search');

  // Dump wat er verschijnt na zoeken
  const dialogContent = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]');
    return dialog ? dialog.innerText.substring(0, 1000) : document.body.innerText.substring(0, 1000);
  });
  console.log('Dialog content:', dialogContent.substring(0, 500));

  // Zoek klikbaar HubSpot resultaat — probeer diverse selectors
  const hubspotResult = page.locator('[role="option"], [role="listbox"] div, [class*="result"], [class*="suggestion"], li').filter({ hasText: /HubSpot/i }).first();
  if (await hubspotResult.isVisible().catch(() => false)) {
    console.log('  HubSpot resultaat gevonden');
    await hubspotResult.click();
    await page.waitForTimeout(3000);
  } else {
    // Probeer gewoon klikken op tekst "HubSpot"
    const hubspotText = page.locator('div, span, p, button, a').filter({ hasText: /^HubSpot$/ }).first();
    if (await hubspotText.isVisible().catch(() => false)) {
      await hubspotText.click();
      await page.waitForTimeout(3000);
    } else {
      console.log('  Geen resultaat gevonden — probeer keyboard');
      // Type en druk Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'ZC2-02-after-select');

  // Nu "Add connection" knop klikken in de dialog
  const addConnBtn = page.locator('button').filter({ hasText: /^Add connection$/ }).first();
  if (await addConnBtn.isVisible().catch(() => false)) {
    await addConnBtn.click();
    console.log('  "Add connection" geklikt');
  }

  // Wacht op popup (HubSpot OAuth flow)
  console.log('  Wacht op OAuth popup...');
  const popup = await context.waitForEvent('page', { timeout: 20000 }).catch(() => null);

  if (popup) {
    console.log('  Popup URL:', popup.url());
    await popup.waitForTimeout(5000);
    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZC2-03-popup.png') });

    const popupText = await popup.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('  Popup:', popupText.substring(0, 500));

    // HubSpot OAuth — als login nodig is
    if (popup.url().includes('hubspot.com') || popup.url().includes('oauth')) {
      // Laad HubSpot sessie cookies
      const hsSession = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
      for (const cookie of (hsSession.cookies || [])) {
        if (cookie.domain?.includes('hubspot')) {
          await context.addCookies([cookie]).catch(() => {});
        }
      }
      await popup.reload();
      await popup.waitForTimeout(5000);
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZC2-04-popup-reload.png') });

      const popupText2 = await popup.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log('  Popup na reload:', popupText2.substring(0, 500));

      // Selecteer Sonty account als gevraagd
      const sontyBtn = popup.locator('button, a, div').filter({ hasText: /sonty/i }).first();
      if (await sontyBtn.isVisible().catch(() => false)) {
        await sontyBtn.click();
        await popup.waitForTimeout(5000);
        console.log('  Sonty geselecteerd');
      }

      // Grant/authorize
      const grantBtn = popup.locator('button').filter({ hasText: /grant|authorize|allow|connect|toestaan|goedkeuren/i }).first();
      if (await grantBtn.isVisible().catch(() => false)) {
        await grantBtn.click();
        await popup.waitForTimeout(5000);
        console.log('  Autorisatie verleend');
      }

      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-ZC2-05-popup-final.png') });
    }
  } else {
    console.log('  Geen popup geopend');
    await ss(page, 'ZC2-03-no-popup');
    const mainText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('  Main pagina:', mainText.substring(0, 500));
  }

  // Check resultaat
  await page.waitForTimeout(5000);
  await page.goto('https://zapier.com/app/connections', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'ZC2-06-result');

  const connText = await page.evaluate(() => document.body.innerText);
  console.log('\nHubSpot in connections:', connText.includes('HubSpot') ? '✅ JA' : '❌ NEE');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await context.close();
  await browser.close();
})();
