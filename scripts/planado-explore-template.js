const { chromium } = require('playwright');
const path = require('path');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`), fullPage: true });
  console.log(`  screenshot: ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('Planado sjabloon verkennen');

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  // Open Estimation template
  await page.goto('https://sonty.planadoapp.com/admin/templates/1f11c802-65cd-6aa0-9d06-7e73cee772e4', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await ss(page, 'PLEXP-01-estimation');

  // Get all form elements on the page
  const formElements = await page.evaluate(() => {
    const result = [];
    // Inputs
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.offsetParent === null) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 30) return;
      let labelText = '';
      // Check for label
      const id = el.id;
      if (id) {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl) labelText = lbl.textContent?.trim() || '';
      }
      if (!labelText) {
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          const lbl = parent.querySelector('label');
          if (lbl) { labelText = lbl.textContent?.trim() || ''; break; }
          parent = parent.parentElement;
        }
      }
      result.push({
        tag: el.tagName,
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        value: el.value || '',
        placeholder: el.placeholder || '',
        label: labelText,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      });
    });
    return result;
  });
  console.log('Form elements:', JSON.stringify(formElements, null, 2));

  // Get full page text
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  console.log('\nPage text:\n', pageText);

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
