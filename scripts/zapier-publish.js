const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile3', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    let b = await page.$$('button');
    for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(4000);
    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    b = await page.$$('button');
    for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(12000);
    await page.goto('https://zapier.com/editor/353405789/draft');
    await page.waitForTimeout(8000);
  }

  console.log('URL:', page.url());
  await page.screenshot({ path: '/tmp/zap-pub-draft.png' });

  // Click Publish using coordinates - it's in the top right area
  // From the screenshot: "Publish" text is at approximately x=1320, y=64
  console.log('Clicking Publish via coordinates...');
  await page.mouse.click(1320, 64);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-pub-after-click.png' });

  // Check for any confirmation dialog
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes('Are you sure') || bodyText.includes('confirm')) {
    console.log('Confirmation dialog found');
    try {
      await page.click('button:has-text("Publish")', { timeout: 3000, force: true });
      await page.waitForTimeout(3000);
    } catch(e) {}
  }

  // Check if published
  await page.screenshot({ path: '/tmp/zap-pub-result.png' });
  const headerText = await page.evaluate(() => {
    const bar = document.querySelector('[class*="topbar"], [class*="Topbar"], [class*="header"]');
    return bar ? bar.innerText : document.body.innerText.substring(0, 500);
  });
  console.log('After publish:', headerText.replace(/\n/g, ' | ').substring(0, 200));

  // Now turn on toggle via coordinates (the toggle is at approx x=228, y=64)
  console.log('\nClicking toggle via coordinates...');
  await page.mouse.click(228, 64);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-toggle-result.png' });

  await ctx.close();
  console.log('Done');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
