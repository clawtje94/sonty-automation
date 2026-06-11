const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile5', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
    const cap = await page.locator('iframe[src*="recaptcha"]').count();
    if (cap > 0) { console.log('CAPTCHA'); await ctx.close(); return; }
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    const b1 = await page.$$('button');
    for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(4000);
    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    const b2 = await page.$$('button');
    for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(12000);
    if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }
    await page.goto('https://zapier.com/editor/353405789');
    await page.waitForTimeout(8000);
  }

  console.log('On editor');

  // Switch to draft edit mode
  try {
    await page.click('text=Edit draft', { timeout: 3000 });
    await page.waitForTimeout(3000);
    console.log('Switched to draft');
  } catch(e) {
    console.log('No Edit draft button');
  }

  await page.screenshot({ path: '/tmp/zap01-draft-mode.png' });

  // Scroll down to see the + button after step 4
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Look for the "+" button - it's usually a small circle between steps
  // In the Zapier editor, clicking between steps shows "Add step"
  // Try clicking the "+" icon after step 4
  const plusButtons = await page.$$('[class*="AddStep"], [class*="add-step"], [data-testid*="add"], button[aria-label*="Add"]');
  console.log('Plus buttons found:', plusButtons.length);

  // Also try clicking the visible "+" text/icon in the flow
  const allButtons = await page.$$('button');
  let foundAdd = false;
  for (const btn of allButtons) {
    try {
      const text = (await btn.textContent()).trim();
      const ariaLabel = await btn.getAttribute('aria-label');
      if (text === '+' || text === 'Add step' || text.includes('Add') ||
          (ariaLabel && ariaLabel.includes('Add'))) {
        const visible = await btn.isVisible();
        const rect = await btn.boundingBox();
        if (visible && rect && rect.y > 600) { // Below step 4
          console.log('Found add button at y=' + rect.y + ': "' + (text || ariaLabel) + '"');
          await btn.click({ force: true });
          foundAdd = true;
          await page.waitForTimeout(3000);
          await page.screenshot({ path: '/tmp/zap01-after-add.png' });
          break;
        }
      }
    } catch(e) {}
  }

  if (!foundAdd) {
    // Try using the Copilot chat instead
    console.log('\nTrying Copilot chat...');
    const copilotInput = await page.$('[placeholder*="Chat"], [placeholder*="copilot"], textarea, [contenteditable="true"]');
    if (copilotInput) {
      await copilotInput.click();
      await page.waitForTimeout(500);
      await page.keyboard.type('Add a step 5: HubSpot Create Task with subject "Belpoging 1 — " followed by the deal name from step 3, task type CALL, priority HIGH, and associate with the contact from step 2', { delay: 10 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(10000);
      console.log('Sent Copilot request');
      await page.screenshot({ path: '/tmp/zap01-copilot-result.png' });
    } else {
      console.log('No Copilot input found');

      // Last resort: try clicking between the lines connecting steps
      // The "+" appears when you hover over the connecting line
      // Click at the position below step 4
      console.log('Trying click at bottom of flow...');
      await page.mouse.click(700, 770); // Approximate position of "+" below step 4
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/zap01-click-bottom.png' });
    }
  }

  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
