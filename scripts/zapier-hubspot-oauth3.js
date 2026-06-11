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
  console.log('🎬 HubSpot OAuth v3 — met popup interactie');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  // Start popup listener VOORDAT we Sign in klikken
  const popupPromise = context.waitForEvent('page', { timeout: 20000 });

  // Klik Sign in
  const signIn = page.locator('button').filter({ hasText: /^Sign in$/ }).first();
  await signIn.click({ force: true });
  console.log('  Sign in geklikt');

  const popup = await popupPromise.catch(() => null);
  if (!popup) {
    console.log('  ❌ Geen popup');
    await context.close();
    await browser.close();
    return;
  }

  await popup.waitForLoadState('networkidle').catch(() => {});
  await popup.waitForTimeout(3000);
  console.log('  Popup URL:', popup.url().substring(0, 150));
  await ss(popup, 'OA3-01-popup');

  // Dump de HTML structuur rond de radio button
  const radioInfo = await popup.evaluate(() => {
    const radios = document.querySelectorAll('input[type="radio"]');
    const info = [];
    for (const r of radios) {
      info.push({
        id: r.id,
        name: r.name,
        value: r.value,
        checked: r.checked,
        parent: r.parentElement?.tagName,
        parentClass: r.parentElement?.className?.substring(0, 50),
        label: r.labels?.[0]?.innerText?.substring(0, 50),
      });
    }
    return info;
  }).catch(() => []);
  console.log('  Radio buttons:', JSON.stringify(radioInfo, null, 2));

  // Probeer de label/wrapper te klikken in plaats van de radio zelf
  const clicked = await popup.evaluate(() => {
    const radios = document.querySelectorAll('input[type="radio"]');
    if (radios.length === 0) return 'no radios found';

    const radio = radios[0];

    // Method 1: Find and click the label
    if (radio.id) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label) {
        label.click();
        return `clicked label for=${radio.id}, checked=${radio.checked}`;
      }
    }

    // Method 2: Click parent label
    let el = radio.parentElement;
    while (el && el.tagName !== 'LABEL' && el.tagName !== 'TR' && el.tagName !== 'BODY') {
      el = el.parentElement;
    }
    if (el && (el.tagName === 'LABEL' || el.tagName === 'TR')) {
      el.click();
      return `clicked ${el.tagName}, checked=${radio.checked}`;
    }

    // Method 3: Direct dispatch with pointer events
    const rect = radio.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    radio.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
    radio.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
    radio.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return `dispatched pointer events, checked=${radio.checked}`;
  }).catch(e => `error: ${e.message}`);
  console.log(`  Click result: ${clicked}`);
  await popup.waitForTimeout(2000);

  // Check button status
  const btnStatus = await popup.evaluate(() => {
    const btn = document.querySelector('button[data-button-use="primary"]');
    return btn ? `disabled=${btn.getAttribute('aria-disabled')}, text=${btn.innerText}` : 'no button';
  }).catch(() => 'error');
  console.log(`  Button: ${btnStatus}`);
  await ss(popup, 'OA3-02-after-click');

  // If button is still disabled, try clicking using Playwright's mouse at the radio coordinates
  if (btnStatus.includes('disabled=true')) {
    console.log('  Probeer Playwright mouse click op radio...');
    const radioBox = await popup.locator('input[type="radio"]').first().boundingBox().catch(() => null);
    if (radioBox) {
      // Click exactly on the radio button element
      await popup.mouse.click(radioBox.x + radioBox.width / 2, radioBox.y + radioBox.height / 2);
      console.log(`  Mouse click op (${radioBox.x + radioBox.width/2}, ${radioBox.y + radioBox.height/2})`);
      await popup.waitForTimeout(2000);

      const btnStatus2 = await popup.evaluate(() => {
        const btn = document.querySelector('button[data-button-use="primary"]');
        return btn ? `disabled=${btn.getAttribute('aria-disabled')}` : 'no button';
      }).catch(() => 'error');
      console.log(`  Button na mouse click: ${btnStatus2}`);
    }

    // Try clicking on the Sonty B.V. text directly
    if (btnStatus.includes('disabled=true')) {
      console.log('  Probeer klik op "Sonty B.V." tekst...');
      const sontyEl = popup.getByText('Sonty B.V.').first();
      await sontyEl.click().catch(() => {});
      await popup.waitForTimeout(2000);

      const btnStatus3 = await popup.evaluate(() => {
        const btn = document.querySelector('button[data-button-use="primary"]');
        return btn ? `disabled=${btn.getAttribute('aria-disabled')}` : 'no button';
      }).catch(() => 'error');
      console.log(`  Button na tekst click: ${btnStatus3}`);
      await ss(popup, 'OA3-03-after-text-click');
    }
  }

  // Final attempt: force submit the form if present
  const formResult = await popup.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.submit();
      return 'form submitted';
    }
    return 'no form found';
  }).catch(e => `error: ${e.message}`);
  console.log(`  Form: ${formResult}`);
  await popup.waitForTimeout(8000);

  // Check if popup navigated or closed
  if (popup.isClosed()) {
    console.log('  ✅ Popup gesloten!');
  } else {
    const newUrl = popup.url();
    console.log('  Popup URL nu:', newUrl.substring(0, 150));
    const newText = await popup.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');
    console.log('  Popup tekst:', newText.substring(0, 300));
    await ss(popup, 'OA3-04-after-form');
  }

  // Check main page
  await page.waitForTimeout(5000);
  await ss(page, 'OA3-05-main');
  const mainText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
  console.log('\nMain:', mainText.substring(0, 500));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
