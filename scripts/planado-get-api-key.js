const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 Planado inloggen + API key ophalen');

  // Go to Planado login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'PL-01-login');

  // Check if login page
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Page text:', bodyText.substring(0, 500));

  // Find email input
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('daimy@sonty.nl');
    console.log('Email ingevuld');
  } else {
    // Try any text input
    const anyInput = page.locator('input[type="text"]').first();
    if (await anyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await anyInput.fill('daimy@sonty.nl');
    }
  }

  // Find password input
  const pwInput = page.locator('input[type="password"]').first();
  if (await pwInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwInput.fill('^XU6C&SuS*FFnb');
    console.log('Wachtwoord ingevuld');
  }

  await page.waitForTimeout(1000);
  await ss(page, 'PL-02-filled');

  // Click login button
  const loginBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Inloggen")').first();
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click();
    console.log('Login geklikt');
    await page.waitForTimeout(8000);
  } else {
    // Try pressing Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);
  }

  await ss(page, 'PL-03-after-login');
  const afterLogin = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('After login:', afterLogin.substring(0, 500));
  console.log('URL:', page.url());

  // Navigate to Settings/API
  // Try common API settings paths
  const settingsUrls = [
    'https://sonty.planadoapp.com/settings',
    'https://sonty.planadoapp.com/settings/api',
    'https://sonty.planadoapp.com/admin/settings',
    'https://sonty.planadoapp.com/api',
  ];

  // First try clicking "Settings" in the navigation
  const settingsLink = await page.evaluate(() => {
    const allEls = document.querySelectorAll('a, button, [role="menuitem"]');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'Settings' || text === 'Instellingen') {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
      }
    }
    return null;
  });

  if (settingsLink) {
    console.log(`Settings link: "${settingsLink.text}" at (${settingsLink.x}, ${settingsLink.y})`);
    await page.mouse.click(settingsLink.x, settingsLink.y);
    await page.waitForTimeout(5000);
    await ss(page, 'PL-04-settings');
  } else {
    // Try navigating directly
    for (const url of settingsUrls) {
      console.log(`Probeer: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      if (text.includes('API') || text.includes('api') || text.includes('token') || text.includes('key')) {
        console.log('Settings/API pagina gevonden!');
        break;
      }
    }
    await ss(page, 'PL-04-settings');
  }

  const settingsText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Settings:', settingsText.substring(0, 1000));

  // Look for API key/token
  const apiLink = await page.evaluate(() => {
    const allEls = document.querySelectorAll('a, button, [role="menuitem"], [role="tab"]');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'API' || text === 'API Key' || text === 'API key' || text.includes('Integrations') || text.includes('Integration')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 10) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
      }
    }
    return null;
  });

  if (apiLink) {
    console.log(`API link: "${apiLink.text}"`);
    await page.mouse.click(apiLink.x, apiLink.y);
    await page.waitForTimeout(5000);
    await ss(page, 'PL-05-api');
    const apiText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('API page:', apiText.substring(0, 1000));
  }

  // Try to find the actual API key value on the page
  const apiKey = await page.evaluate(() => {
    const allEls = document.querySelectorAll('input, code, pre, [class*="token"], [class*="key"], [class*="api"]');
    for (const el of allEls) {
      if (el.offsetParent === null) continue;
      const val = el.value || el.textContent?.trim() || '';
      // API keys are usually long alphanumeric strings
      if (val.length > 20 && val.length < 200 && /^[a-zA-Z0-9_-]+$/.test(val)) {
        return val;
      }
    }
    return null;
  });

  if (apiKey) {
    console.log(`\n🔑 API Key gevonden: ${apiKey}`);
    fs.writeFileSync(path.join(__dirname, 'planado-api-key.txt'), apiKey);
  } else {
    console.log('\nAPI key niet automatisch gevonden');
  }

  await ss(page, 'PL-final');
  console.log('Final URL:', page.url());

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
