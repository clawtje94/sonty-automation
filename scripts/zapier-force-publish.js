const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  // Force click Publish via JavaScript dispatch
  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a, [role="button"]');
    for (const b of btns) {
      if (b.textContent.trim() === 'Publish' || b.innerText.trim() === 'Publish') {
        b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'dispatched on ' + b.tagName + ' class=' + (b.className || '').substring(0, 40);
      }
    }
    // Also try finding by aria-label
    const pubBtn = document.querySelector('[aria-label*="Publish"], [data-testid*="publish"]');
    if (pubBtn) {
      pubBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return 'dispatched on aria/testid element';
    }
    return 'not found';
  });
  console.log('Publish dispatch:', clicked);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-force-pub-1.png' });

  // Check for dialog
  const hasDialog = await page.evaluate(() => {
    return document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]') !== null;
  });
  console.log('Dialog appeared:', hasDialog);

  if (hasDialog) {
    // Click Publish in dialog
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]');
      if (dialog) {
        const btns = dialog.querySelectorAll('button');
        for (const b of btns) {
          if (b.textContent.trim() === 'Publish') {
            b.click();
            return;
          }
        }
      }
    });
    await page.waitForTimeout(5000);
    console.log('Dialog Publish clicked');
  }

  await page.screenshot({ path: '/tmp/zap-force-pub-2.png' });

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Contains Draft:', bodyText.includes('Draft'));
  console.log('Contains Published:', bodyText.includes('published'));

  await ctx.close();
  console.log('Done');
})().catch(console.error);
