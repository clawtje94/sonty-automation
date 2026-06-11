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
  console.log('🎬 Planado API key genereren');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  // Go to API page
  await page.goto('https://sonty.planadoapp.com/admin/integrations/api', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Click "Nieuwe sleutel genereren"
  const generateBtn = page.locator('text=Nieuwe sleutel genereren').first();
  if (await generateBtn.isVisible({ timeout: 5000 })) {
    await generateBtn.click();
    console.log('Nieuwe sleutel genereren geklikt');
    await page.waitForTimeout(5000);
    await ss(page, 'PL5-01-generated');

    // Check for the key
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Page text:', pageText.substring(0, 1500));

    // Find the API key value - check all elements
    const keyInfo = await page.evaluate(() => {
      const result = [];
      // Check inputs
      document.querySelectorAll('input').forEach(inp => {
        if (inp.value && inp.value.length > 10) {
          result.push({ source: 'input', value: inp.value, type: inp.type });
        }
      });
      // Check all text elements for long alphanumeric strings
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        // API keys are typically 32+ chars, alphanumeric with dashes/underscores
        if (text.length > 25 && text.length < 200 && /^[a-zA-Z0-9_-]+$/.test(text)) {
          result.push({ source: el.tagName, value: text });
        }
      }
      // Check code/pre
      document.querySelectorAll('code, pre, [class*="key"], [class*="token"]').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length > 15 && text.length < 200) {
          result.push({ source: 'code', value: text });
        }
      });
      return result;
    });

    console.log('\nKey candidates:', JSON.stringify(keyInfo, null, 2));

    if (keyInfo.length > 0) {
      const apiKey = keyInfo[0].value;
      console.log(`\n🔑 API Key: ${apiKey}`);
      fs.writeFileSync(path.join(__dirname, 'planado-api-key.txt'), apiKey);
    }

    // Also check for a "copy" button
    const copyBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [role="button"]');
      for (const btn of btns) {
        const text = btn.textContent?.trim() || '';
        const label = btn.getAttribute('aria-label') || '';
        if (text.includes('Copy') || text.includes('Kopieer') || label.includes('copy') || label.includes('Copy')) {
          const rect = btn.getBoundingClientRect();
          return { text, label, x: Math.round(rect.x), y: Math.round(rect.y) };
        }
      }
      return null;
    });
    if (copyBtn) console.log('Copy button:', JSON.stringify(copyBtn));
  }

  // Also set up a webhook while we're here
  const webhookBtn = page.locator('text=Webhook toevoegen').first();
  if (await webhookBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('\n"Webhook toevoegen" knop gevonden');
  }

  await ss(page, 'PL5-final');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
