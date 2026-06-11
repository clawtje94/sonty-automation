const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');
const PLANADO_API_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 Planado account koppelen in Zapier');

  // Listen for new popup windows
  context.on('page', async (popup) => {
    console.log('Popup geopend:', popup.url());

    // Wait for popup to load
    await popup.waitForTimeout(3000);
    const popupUrl = popup.url();
    console.log('Popup URL:', popupUrl);

    const popupText = await popup.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '');
    console.log('Popup text:', popupText.substring(0, 500));

    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN-popup.png') });

    // Find input for API key
    const inputs = await popup.evaluate(() => {
      const result = [];
      document.querySelectorAll('input').forEach(inp => {
        result.push({
          type: inp.type, name: inp.name, placeholder: inp.placeholder,
          id: inp.id, value: inp.value?.substring(0, 20) || ''
        });
      });
      return result;
    }).catch(() => []);
    console.log('Popup inputs:', JSON.stringify(inputs));

    // Fill the API key
    for (const inp of inputs) {
      if (inp.type !== 'hidden' && inp.type !== 'submit') {
        const selector = inp.id ? `#${inp.id}` : inp.name ? `input[name="${inp.name}"]` : 'input:not([type="hidden"])';
        const el = popup.locator(selector).first();
        if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
          await el.fill(PLANADO_API_KEY);
          console.log(`API key ingevuld in ${selector}`);
          break;
        }
      }
    }

    await popup.waitForTimeout(1000);
    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN-filled.png') });

    // Click submit/continue
    const submitBtn = popup.locator('button[type="submit"], input[type="submit"], button:has-text("Yes"), button:has-text("Continue"), button:has-text("Save")').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const btnText = await submitBtn.textContent().catch(() => 'submit');
      console.log(`Submit: "${btnText}"`);
      await submitBtn.click();
      await popup.waitForTimeout(5000);
    }
  });

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Double-click Step 2 to open it
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Create Job' || text === '2. Create Job') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.dblclick(step2.x, step2.y);
    await page.waitForTimeout(5000);
    await ss(page, 'PLSIGN-01-step2');
  }

  // Click "Sign in" button
  const signIn = page.locator('button:has-text("Sign in")').first();
  if (await signIn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking Sign in...');
    await signIn.click();
    // Wait for popup to appear and be handled
    await page.waitForTimeout(15000);
    await ss(page, 'PLSIGN-02-after-signin');
  }

  // Check if connected
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nPanel:', panelText.substring(0, 1000));

  const isConnected = panelText.includes('Planado') && (panelText.includes('Used in') || panelText.includes('Change'));
  console.log('Connected:', isConnected);

  if (isConnected) {
    // Click Continue
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

  await ss(page, 'PLSIGN-final');
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
