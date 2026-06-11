const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://app.trengo.com/login');
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', 'CZ%bWD64XVs6Kf');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  console.log('Logged in');

  await page.goto('https://app.trengo.com/admin/channels2/email/1347356');
  await page.waitForTimeout(3000);
  await page.click('text=Email settings');
  await page.waitForTimeout(2000);

  // Scroll down to auto-reply
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(c => {
      const s = window.getComputedStyle(c);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && c.scrollHeight > c.clientHeight + 50)
        c.scrollTop = c.scrollHeight;
    });
  });
  await page.waitForTimeout(1000);

  // Find auto-reply editor and type new text via keyboard
  const editors = await page.$$('[contenteditable="true"]');
  console.log('Found', editors.length, 'editors');

  for (const ed of editors) {
    const text = await ed.textContent();
    if (text.includes('Dear') || text.includes('Beste') || text.includes('confirmation')) {
      console.log('Found auto-reply editor, replacing...');
      await ed.click();
      await page.keyboard.press('Meta+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);

      await page.keyboard.type('Beste [name],', { delay: 5 });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Bedankt voor uw bericht! We hebben uw e-mail ontvangen en geregistreerd als ticket #[ticket_number]. U kunt altijd op deze e-mail reageren als u extra informatie wilt toevoegen.', { delay: 3 });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('We streven ernaar om binnen 4 uur te reageren tijdens werkdagen.', { delay: 3 });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Met vriendelijke groet,', { delay: 3 });
      await page.keyboard.press('Enter');
      await page.keyboard.type('Team Sonty', { delay: 3 });
      await page.keyboard.press('Enter');
      await page.keyboard.type('085 006 9681', { delay: 3 });

      console.log('Typed NL auto-reply');
      break;
    }
  }

  // Update subject — scroll to middle
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(c => {
      const s = window.getComputedStyle(c);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && c.scrollHeight > c.clientHeight + 50)
        c.scrollTop = c.scrollHeight * 0.55;
    });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/trengo-ar-mid.png' });

  const inputs = await page.$$('input');
  for (const inp of inputs) {
    try {
      const val = await inp.inputValue();
      if (val.includes('Thank you')) {
        await inp.click({ clickCount: 3 });
        await inp.fill('Bedankt voor uw bericht \u2014 Sonty');
        console.log('Updated subject');
        break;
      }
    } catch (e) { /* skip */ }
  }

  // Trigger save — click elsewhere then find save button
  await page.click('h2:has-text("Email"), text=Email settings');
  await page.waitForTimeout(1000);

  const btns = await page.$$('button');
  for (const btn of btns) {
    try {
      const text = (await btn.textContent()).trim();
      if (text === 'Save' || text === 'Opslaan') {
        const visible = await btn.isVisible();
        console.log('Save button found, visible:', visible);
        if (visible) {
          await btn.click();
          await page.waitForTimeout(3000);
          console.log('Saved!');
        }
        break;
      }
    } catch (e) { /* skip */ }
  }

  await page.screenshot({ path: '/tmp/trengo-ar-saved.png' });
  await browser.close();
  console.log('Done');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
