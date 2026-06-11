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
  console.log('🎬 Planado login + API key');

  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Debug: list all inputs
  const allInputs = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input').forEach(inp => {
      result.push({
        type: inp.type, name: inp.name, placeholder: inp.placeholder,
        id: inp.id, visible: inp.offsetParent !== null
      });
    });
    return result;
  });
  console.log('Inputs:', JSON.stringify(allInputs));

  // Fill email - use placeholder match
  const emailInput = page.locator('input[placeholder="E-mail"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.click();
    await emailInput.fill('daimy@sonty.nl');
    console.log('Email ingevuld');
  } else {
    // Fallback: first visible input
    const firstInput = page.locator('input').first();
    await firstInput.click();
    await firstInput.fill('daimy@sonty.nl');
  }

  // Fill password
  const pwInput = page.locator('input[placeholder="Wachtwoord"]').first();
  if (await pwInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pwInput.click();
    await pwInput.fill('^XU6C&SuS*FFnb');
    console.log('Wachtwoord ingevuld');
  } else {
    const pw = page.locator('input[type="password"]').first();
    await pw.click();
    await pw.fill('^XU6C&SuS*FFnb');
  }

  await page.waitForTimeout(500);

  // Click "Inloggen" button
  const loginBtn = page.locator('button:has-text("Inloggen"), input[value="Inloggen"]').first();
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }
  console.log('Login...');
  await page.waitForTimeout(8000);
  await ss(page, 'PL3-01-loggedin');
  console.log('URL:', page.url());

  // Go to Integraties
  await page.goto('https://sonty.planadoapp.com/admin/integrations', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'PL3-02-integraties');

  const intText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nIntegraties:', intText.substring(0, 1500));
  console.log('URL:', page.url());

  // Look for API link or section
  const apiLinks = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('a, button').forEach(el => {
      const text = el.textContent?.trim() || '';
      const href = el.getAttribute('href') || '';
      if (text.includes('API') || href.includes('api') || text.includes('Webhook') || href.includes('webhook')) {
        const rect = el.getBoundingClientRect();
        result.push({ text: text.substring(0, 50), href, x: Math.round(rect.x), y: Math.round(rect.y) });
      }
    });
    return result;
  });
  console.log('\nAPI links:', JSON.stringify(apiLinks));

  // Check all links on the page
  const allLinks = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('a').forEach(el => {
      const text = el.textContent?.trim() || '';
      const href = el.getAttribute('href') || '';
      if (text.length > 0 && text.length < 50) {
        result.push({ text, href: href.substring(0, 80) });
      }
    });
    return result;
  });
  console.log('\nAll links:', JSON.stringify(allLinks.slice(0, 30), null, 2));

  // Try clicking on specific API/webhook sections
  for (const link of apiLinks) {
    if (link.href && link.href.includes('api')) {
      console.log(`\nNavigating to API: ${link.href}`);
      if (link.href.startsWith('/')) {
        await page.goto(`https://sonty.planadoapp.com${link.href}`, { waitUntil: 'domcontentloaded' });
      } else {
        await page.goto(link.href, { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(5000);
      await ss(page, 'PL3-03-api');
      const apiText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('\nAPI page:', apiText.substring(0, 1500));

      // Find API key
      const key = await page.evaluate(() => {
        // Check input fields
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          const val = inp.value || '';
          if (val.length > 20 && /^[a-zA-Z0-9_.-]+$/.test(val)) return { source: 'input', value: val };
        }
        // Check code/pre/span elements
        const codeEls = document.querySelectorAll('code, pre, .token, [class*="key"], [class*="api"]');
        for (const el of codeEls) {
          const val = el.textContent?.trim() || '';
          if (val.length > 20 && val.length < 200 && /^[a-zA-Z0-9_.-]+$/.test(val)) return { source: el.tagName, value: val };
        }
        return null;
      });

      if (key) {
        console.log(`\n🔑 API Key gevonden (${key.source}): ${key.value}`);
        fs.writeFileSync(path.join(__dirname, 'planado-api-key.txt'), key.value);
      }
      break;
    }
  }

  await ss(page, 'PL3-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
