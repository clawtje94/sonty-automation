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
  console.log('🎬 Planado Sign in v3');

  let popupPage = null;

  context.on('page', (p) => {
    popupPage = p;
    console.log('Popup detected');
  });

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
    await page.waitForTimeout(5000);
  }

  if (!popupPage) {
    console.log('No popup, checking for inline auth...');
    await ss(page, 'PLSIGN3-no-popup');
    await browser.close();
    return;
  }

  // Wait for popup to fully load
  await popupPage.waitForLoadState('networkidle').catch(() => {});
  await popupPage.waitForTimeout(5000);

  console.log('Popup URL:', popupPage.url());

  // Check for frames
  const frames = popupPage.frames();
  console.log('Frames:', frames.length);
  for (const frame of frames) {
    console.log(`  Frame: ${frame.url().substring(0, 80)}`);
  }

  // Screenshot popup
  await popupPage.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN3-popup.png') });

  // Try to find inputs in all frames
  for (const frame of frames) {
    const inputs = await frame.evaluate(() => {
      const result = [];
      document.querySelectorAll('input, textarea').forEach(inp => {
        const rect = inp.getBoundingClientRect();
        result.push({
          type: inp.type, name: inp.name, placeholder: inp.placeholder,
          x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width),
          visible: rect.width > 0
        });
      });
      return result;
    }).catch(() => []);

    if (inputs.length > 0) {
      console.log(`Found ${inputs.length} inputs in frame: ${frame.url().substring(0, 60)}`);
      console.log(JSON.stringify(inputs, null, 2));
    }
  }

  // Try using locator on popup directly (searches all frames)
  const subdomain = popupPage.locator('input').first();
  const inputCount = await popupPage.locator('input').count().catch(() => 0);
  console.log(`\nTotal inputs via locator: ${inputCount}`);

  // Also check the DOM structure
  const domInfo = await popupPage.evaluate(() => {
    return {
      html: document.documentElement.innerHTML.substring(0, 3000),
      body: document.body?.innerHTML?.substring(0, 2000) || 'no body'
    };
  });
  console.log('\nDOM (first 1000):', domInfo.html.substring(0, 1000));

  // Try to interact with the popup using keyboard navigation
  // Tab to first field and type
  console.log('\nProbeer keyboard navigatie...');
  await popupPage.keyboard.press('Tab');
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.type('sonty');
  console.log('Typed: sonty');

  await popupPage.keyboard.press('Tab');
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.type('daimy@sonty.nl');
  console.log('Typed: daimy@sonty.nl');

  await popupPage.keyboard.press('Tab');
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.type('^XU6C&SuS*FFnb');
  console.log('Typed: password');

  await popupPage.waitForTimeout(1000);
  await popupPage.screenshot({ path: path.join(__dirname, 'wf-debug-PLSIGN3-filled.png') });

  // Press Enter or click submit
  await popupPage.keyboard.press('Enter');
  console.log('Enter pressed');
  await popupPage.waitForTimeout(10000).catch(() => {});

  // Check main page
  await page.waitForTimeout(3000);
  await ss(page, 'PLSIGN3-after');

  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  const connected = panelText.includes('Used in') || (panelText.includes('Planado') && panelText.includes('Change') && !panelText.includes('Sign in'));
  console.log('\nConnected:', connected);
  console.log('Panel:', panelText.substring(panelText.indexOf('Account'), panelText.indexOf('Account') + 200));

  if (connected) {
    const btn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
      if (!disabled) {
        await btn.click({ force: true });
        console.log('Continue');
        await page.waitForTimeout(5000);
      }
    }
  }

  await ss(page, 'PLSIGN3-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
