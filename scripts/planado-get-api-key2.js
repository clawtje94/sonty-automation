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
  console.log('🎬 Planado API key ophalen');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const pwInput = page.locator('input[type="password"]').first();

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('daimy@sonty.nl');
    await pwInput.fill('^XU6C&SuS*FFnb');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);
  }

  // Navigate to Integraties
  await page.goto('https://sonty.planadoapp.com/admin/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Click "Integraties"
  const integraties = await page.evaluate(() => {
    const allEls = document.querySelectorAll('a, button');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'Integraties' || text === 'Integrations') {
        const rect = el.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), href: el.getAttribute('href') || '' };
      }
    }
    return null;
  });

  if (integraties) {
    console.log(`Integraties: href=${integraties.href}`);
    await page.mouse.click(integraties.x, integraties.y);
    await page.waitForTimeout(5000);
    await ss(page, 'PL2-01-integraties');

    const intText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Integraties:', intText.substring(0, 1500));
    console.log('URL:', page.url());

    // Look for API key on the page
    // Check for any input fields that might contain the key
    const inputs = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('input, textarea, code, pre').forEach(el => {
        if (el.offsetParent === null && el.tagName !== 'INPUT') return;
        const val = el.value || el.textContent?.trim() || '';
        if (val.length > 0) {
          result.push({ tag: el.tagName, type: el.type || '', val: val.substring(0, 100), name: el.name || '' });
        }
      });
      return result;
    });
    console.log('\nInputs/codes:', JSON.stringify(inputs, null, 2));

    // Check for "API" sub-link
    const apiSubLink = await page.evaluate(() => {
      const allEls = document.querySelectorAll('a, button, [role="tab"]');
      for (const el of allEls) {
        const text = el.textContent?.trim() || '';
        if (text === 'API' || text.includes('API Key') || text.includes('Webhook') || text.includes('webhook')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 10) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text, href: el.getAttribute('href') || '' };
        }
      }
      return null;
    });

    if (apiSubLink) {
      console.log(`\nAPI sub-link: "${apiSubLink.text}" href=${apiSubLink.href}`);
      await page.mouse.click(apiSubLink.x, apiSubLink.y);
      await page.waitForTimeout(5000);
      await ss(page, 'PL2-02-api');

      const apiText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('\nAPI page:', apiText.substring(0, 1500));
    }

    // Also try direct URL patterns
    const apiUrls = [
      'https://sonty.planadoapp.com/admin/integrations',
      'https://sonty.planadoapp.com/admin/integrations/api',
      'https://sonty.planadoapp.com/admin/api',
    ];

    for (const url of apiUrls) {
      if (page.url() === url) continue;
      console.log(`\nProbeer: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      if (text.includes('API') || text.includes('token') || text.includes('key') || text.includes('webhook')) {
        console.log('Gevonden!');
        console.log(text.substring(0, 1000));
        await ss(page, 'PL2-03-api-found');

        // Extract key
        const key = await page.evaluate(() => {
          const allEls = document.querySelectorAll('input, code, pre, span, div');
          for (const el of allEls) {
            const val = el.value || el.textContent?.trim() || '';
            if (val.length > 20 && val.length < 200 && /^[a-zA-Z0-9_.-]+$/.test(val)) {
              return val;
            }
          }
          return null;
        });
        if (key) {
          console.log(`\n🔑 API Key: ${key}`);
          fs.writeFileSync(path.join(__dirname, 'planado-api-key.txt'), key);
        }
        break;
      }
    }
  }

  await ss(page, 'PL2-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
