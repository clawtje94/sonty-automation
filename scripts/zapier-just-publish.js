const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  console.log('URL:', page.url());
  await page.screenshot({ path: '/tmp/zap-pre-pub.png' });

  // Click Publish via multiple methods
  // Method 1: Click by text with force
  try {
    const pubBtn = await page.locator('button:has-text("Publish")').last();
    await pubBtn.click({ force: true, timeout: 3000 });
    console.log('Clicked Publish via locator');
    await page.waitForTimeout(3000);
  } catch(e) {
    // Method 2: Click by coordinates (top right)
    await page.mouse.click(1320, 64);
    console.log('Clicked Publish by coords');
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: '/tmp/zap-pub-dialog.png' });

  // Fill version name and confirm
  try {
    const inputs = await page.$$('input[type="text"]');
    for (const inp of inputs) {
      const rect = await inp.boundingBox();
      if (rect && rect.y > 150 && rect.y < 400 && rect.width > 200) {
        await inp.fill('v5-reuzenpanda-data');
        console.log('Version name filled');
        break;
      }
    }
  } catch(e) {}

  // Click the Publish button inside the dialog
  try {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = (await btn.textContent()).trim();
      const rect = await btn.boundingBox();
      if (text === 'Publish' && rect && rect.y > 200) {
        await btn.click({ force: true });
        console.log('Confirmed Publish!');
        break;
      }
    }
  } catch(e) {}

  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/zap-after-pub.png' });

  // Check status
  const headerText = await page.evaluate(() => {
    return document.querySelector('header')?.innerText || document.body.innerText.substring(0, 300);
  });
  console.log('Status:', headerText.includes('Draft') ? 'Still Draft' : 'Published!');

  await ctx.close();
  console.log('Done');
})().catch(console.error);
