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
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 HubSpot OAuth — handmatig met screenshots');

  // Open de zap en klik op trigger
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  // Klik Sign in
  const signIn = page.locator('button').filter({ hasText: /^Sign in$/ }).first();
  await signIn.click({ force: true });
  console.log('  Sign in geklikt');

  // Wacht op popup
  const popup = await context.waitForEvent('page', { timeout: 15000 }).catch(() => null);

  if (popup) {
    console.log('  Popup URL:', popup.url().substring(0, 100));
    await popup.waitForTimeout(5000);
    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-OAUTH-01.png') });

    const text1 = await popup.evaluate(() => document.body.innerText).catch(() => '');
    console.log('  Popup text:', text1.substring(0, 500));

    // Klik op Sonty B.V.
    const sonty = popup.locator('div, button, a, tr, td, span').filter({ hasText: /Sonty B\.V\./i }).first();
    if (await sonty.isVisible({ timeout: 8000 }).catch(() => false)) {
      await sonty.click();
      console.log('  Sonty B.V. geklikt');
      await popup.waitForTimeout(8000);
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-OAUTH-02.png') });

      const text2 = await popup.evaluate(() => document.body.innerText).catch(() => '');
      console.log('  Na Sonty click:', text2.substring(0, 500));

      // Zoek "Verbinden" of "Grant" of "Accepteren" knop
      const allButtons = await popup.locator('button:visible').all();
      console.log(`  Buttons in popup: ${allButtons.length}`);
      for (const btn of allButtons) {
        const t = await btn.innerText().catch(() => '');
        if (t.trim()) console.log(`    btn: "${t.trim().substring(0, 60)}"`);
      }

      // Klik de goedkeur-knop
      const approveBtn = popup.locator('button').filter({ hasText: /verbind|grant|allow|authorize|connect|goedkeur|toestaan|accepter|access/i }).first();
      if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const btnText = await approveBtn.innerText().catch(() => '');
        console.log(`  Goedkeur knop: "${btnText}"`);
        await approveBtn.click();
        console.log('  ✅ Goedgekeurd!');
        await popup.waitForTimeout(8000);
      } else {
        console.log('  ❌ Geen goedkeur-knop gevonden');
        await popup.screenshot({ path: path.join(__dirname, 'wf-debug-OAUTH-03-no-grant.png') });

        // Misschien is het een pagina met checkboxes voor scopes
        const checkboxes = await popup.locator('input[type="checkbox"]:visible').all();
        if (checkboxes.length > 0) {
          console.log(`  ${checkboxes.length} checkboxes gevonden — scopes pagina`);
          // Vink alles aan
          for (const cb of checkboxes) {
            if (!(await cb.isChecked().catch(() => true))) {
              await cb.click().catch(() => {});
            }
          }
          // Zoek submit knop
          const submitBtn = popup.locator('button[type="submit"], button').filter({ hasText: /submit|grant|connect|allow|accept/i }).first();
          if (await submitBtn.isVisible().catch(() => false)) {
            await submitBtn.click();
            console.log('  Scopes goedgekeurd');
            await popup.waitForTimeout(8000);
          }
        }
      }

      // Final screenshot
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-OAUTH-04-final.png') }).catch(() => {});
    }
  }

  // Check resultaat op hoofdpagina
  await page.waitForTimeout(5000);
  await ss(page, 'OAUTH-05-main');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nHoofdpagina na OAuth:', finalText.substring(0, 500));

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
