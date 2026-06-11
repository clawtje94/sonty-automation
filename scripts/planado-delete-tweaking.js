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

  // Login
  await page.goto('https://sonty.planadoapp.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder="E-mail"]').fill('daimy@sonty.nl');
  await page.locator('input[placeholder="Wachtwoord"]').fill('^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(8000);

  // Open Tweaking template
  await page.goto('https://sonty.planadoapp.com/admin/templates/1f11c802-652e-69e0-9d06-7e73cee772e4', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Look for delete/verwijderen button - get full page text to find it
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('Looking for delete... page contains "Verwijderen":', pageText.includes('Verwijderen'));
  console.log('Page contains "verwijder":', pageText.toLowerCase().includes('verwijder'));

  await ss(page, 'PLDEL-01-tweaking-page');

  // Find and click Verwijderen
  const deleteInfo = await page.evaluate(() => {
    const allEls = document.querySelectorAll('button, a, span, div');
    const results = [];
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text.match(/^verwijder/i) && text.length < 20) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({ tag: el.tagName, text, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), w: Math.round(rect.width) });
        }
      }
    }
    return results;
  });
  console.log('Delete elements:', JSON.stringify(deleteInfo, null, 2));

  if (deleteInfo.length > 0) {
    // Click the delete button (last one is likely the template delete, not nav)
    const del = deleteInfo[deleteInfo.length - 1];
    console.log(`Clicking: "${del.text}" at (${del.x}, ${del.y})`);
    await page.mouse.click(del.x, del.y);
    await page.waitForTimeout(3000);
    await ss(page, 'PLDEL-02-after-click');

    // Check for confirmation dialog
    const dialogBtns = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('button, a').forEach(el => {
        if (el.offsetParent === null) return;
        const text = el.textContent?.trim() || '';
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.y > 0) {
          results.push({ tag: el.tagName, text, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
        }
      });
      return results;
    });
    console.log('Visible buttons after delete click:', dialogBtns.filter(b => b.text.length < 30).map(b => b.text));

    // Look for OK/Ja/Bevestigen/Yes
    const confirm = dialogBtns.find(b => b.text.match(/^(ok|ja|bevestig|yes|verwijder)/i));
    if (confirm) {
      console.log(`Confirming: "${confirm.text}"`);
      await page.mouse.click(confirm.x, confirm.y);
      await page.waitForTimeout(3000);
    }
  }

  // Check result
  await page.goto('https://sonty.planadoapp.com/admin/templates', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const templates = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tr td:first-child a').forEach(a => {
      if (a.href?.includes('/admin/templates/')) rows.push(a.textContent?.trim());
    });
    return rows;
  });
  console.log('Templates:', templates);
  await ss(page, 'PLDEL-03-final');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
