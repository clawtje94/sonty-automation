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
  console.log('🎬 Planado API key ophalen v4');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);
  console.log('Ingelogd, URL:', page.url());

  // Direct naar API pagina
  await page.goto('https://sonty.planadoapp.com/admin/integrations/api', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'PL4-01-api');

  const apiText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('API page:', apiText.substring(0, 2000));

  // Find the API key
  const keyInfo = await page.evaluate(() => {
    const result = { inputs: [], codes: [], spans: [] };
    // Check inputs
    document.querySelectorAll('input').forEach(inp => {
      if (inp.value && inp.value.length > 10) {
        result.inputs.push({ value: inp.value, type: inp.type, placeholder: inp.placeholder });
      }
    });
    // Check code elements
    document.querySelectorAll('code, pre').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.length > 10) result.codes.push(text.substring(0, 100));
    });
    // Check for any element with "key" or "token" nearby
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if ((text.includes('Bearer') || text.includes('token') || text.includes('key')) && text.length > 10 && text.length < 200) {
        result.spans.push(text);
      }
    }
    return result;
  });
  console.log('\nKey info:', JSON.stringify(keyInfo, null, 2));

  // Also check for copy button or visible key
  const allVisibleText = await page.evaluate(() => {
    const result = [];
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text.length > 15 && text.length < 100) {
        const rect = el.getBoundingClientRect();
        if (rect.y > 100 && rect.y < 700 && rect.x > 200) {
          result.push({ text, y: Math.round(rect.y), x: Math.round(rect.x) });
        }
      }
    }
    return result;
  });
  console.log('\nAll visible text:', JSON.stringify(allVisibleText.slice(0, 30), null, 2));

  await ss(page, 'PL4-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
