const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 Planado Sign in v2');

  // Handle popup
  const popupPromise = new Promise(resolve => {
    context.on('page', async (popup) => {
      console.log('Popup opened:', popup.url());
      await popup.waitForLoadState('domcontentloaded');
      await popup.waitForTimeout(3000);

      // Debug inputs
      const inputs = await popup.evaluate(() => {
        const result = [];
        document.querySelectorAll('input, textarea').forEach(inp => {
          const rect = inp.getBoundingClientRect();
          result.push({
            tag: inp.tagName, type: inp.type, name: inp.name,
            placeholder: inp.placeholder, id: inp.id,
            x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width)
          });
        });
        return result;
      });
      console.log('Popup inputs:', JSON.stringify(inputs, null, 2));

      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN2-popup.png') });

      // Fill fields by position/order (3 fields: subdomain, email, password)
      const visibleInputs = inputs.filter(i => i.w > 100 && i.type !== 'hidden');
      console.log('Visible inputs:', visibleInputs.length);

      if (visibleInputs.length >= 3) {
        // Sort by Y position
        visibleInputs.sort((a, b) => a.y - b.y);

        // Subdomain (first field)
        await popup.mouse.click(visibleInputs[0].x + visibleInputs[0].w / 2, visibleInputs[0].y + 15);
        await popup.keyboard.type('sonty');
        console.log('Subdomain: sonty');

        // Email (second field)
        await popup.mouse.click(visibleInputs[1].x + visibleInputs[1].w / 2, visibleInputs[1].y + 15);
        await popup.keyboard.type('daimy@sonty.nl');
        console.log('Email: daimy@sonty.nl');

        // Password (third field)
        await popup.mouse.click(visibleInputs[2].x + visibleInputs[2].w / 2, visibleInputs[2].y + 15);
        await popup.keyboard.type('^XU6C&SuS*FFnb');
        console.log('Password filled');
      } else {
        // Fallback: try nth-child
        const allInputs = popup.locator('input:not([type="hidden"])');
        const count = await allInputs.count();
        console.log(`Fallback: ${count} inputs`);
        if (count >= 3) {
          await allInputs.nth(0).fill('sonty');
          await allInputs.nth(1).fill('daimy@sonty.nl');
          await allInputs.nth(2).fill('^XU6C&SuS*FFnb');
        }
      }

      await popup.waitForTimeout(1000);
      await popup.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN2-filled.png') });

      // Click "Yes, Continue to Planado"
      const submitBtn = popup.locator('button:has-text("Yes, Continue")');
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Wait for it to become enabled
        await popup.waitForTimeout(1000);
        await submitBtn.click({ force: true });
        console.log('Submit clicked');
      }

      // Wait for popup to close or redirect
      await popup.waitForTimeout(10000).catch(() => {});
      resolve();
    });
  });

  // Open ZAP-03 and click Sign in
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Step 2
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Create Job') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.dblclick(step2.x, step2.y);
    await page.waitForTimeout(5000);
  }

  // Click Sign in
  const signIn = page.locator('button:has-text("Sign in")').first();
  if (await signIn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking Sign in...');
    await signIn.click();
    // Wait for popup handler
    await popupPromise;
    await page.waitForTimeout(5000);
  }

  await ss(page, 'PLSIGN2-after');

  // Check connection status
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  const connected = panelText.includes('Used in') || panelText.includes('Change');
  console.log('Connected:', connected);
  console.log('Panel:', panelText.substring(0, 800));

  // Click Continue
  if (connected) {
    for (let i = 0; i < 3; i++) {
      const btn = page.locator('button').filter({ hasText: /^Continue$/ });
      if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
        if (!disabled) {
          await btn.click({ force: true });
          console.log(`Continue ${i + 1}`);
          await page.waitForTimeout(5000);
        } else break;
      } else break;
    }
  }

  await ss(page, 'PLSIGN2-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
