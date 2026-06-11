const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login fast
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(5000);
  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '447571');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
  }
  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('FAILED');
    await browser.close();
    return;
  }
  console.log('LOGGED IN');

  // Go to record customization and click Standaardweergave
  await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
  await page.waitForTimeout(5000);

  // Click on "Standaardweergave" link
  await page.click('a:has-text("Standaardweergave")');
  await page.waitForTimeout(8000);
  console.log('Layout editor URL:', page.url());
  await page.screenshot({ path: '/tmp/hs-editor-1.png' });

  // Get the editor content
  const editorText = await page.evaluate(() => document.body.innerText);
  console.log(editorText.substring(0, 2000));

  // Take full screenshot
  await page.screenshot({ path: '/tmp/hs-editor-full.png', fullPage: true });

  // List everything we can interact with
  const els = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, input, select, [draggable], [role="tab"], [role="button"]'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({
        text: el.textContent.trim().substring(0, 50),
        tag: el.tagName,
        y: Math.round(el.getBoundingClientRect().y),
        x: Math.round(el.getBoundingClientRect().x),
      }))
      .filter(l => l.text.length > 1)
      .sort((a, b) => a.y - b.y);
  });
  console.log('\nAll elements:');
  els.forEach(e => console.log('  (' + e.x + ',' + e.y + ') [' + e.tag + '] ' + e.text));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
