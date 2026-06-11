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

  // Scroll down
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(c => {
      const s = window.getComputedStyle(c);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && c.scrollHeight > c.clientHeight + 50)
        c.scrollTop = c.scrollHeight;
    });
  });
  await page.waitForTimeout(1000);

  // Update auto-reply body via keyboard
  const editors = await page.$$('[contenteditable="true"]');
  for (const ed of editors) {
    const text = await ed.textContent();
    if (text.includes('Dear') || text.includes('Beste') || text.includes('Bedankt')) {
      await ed.click();
      await page.keyboard.press('Meta+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);

      await page.keyboard.type('Beste [name],\n\nBedankt voor uw bericht! We hebben uw e-mail ontvangen en geregistreerd als ticket #[ticket_number]. U kunt altijd op deze e-mail reageren als u extra informatie wilt toevoegen.\n\nWe streven ernaar om binnen 4 uur te reageren tijdens werkdagen.\n\nMet vriendelijke groet,\nTeam Sonty\n085 006 9681', { delay: 2 });

      console.log('Auto-reply body typed');

      // Click outside to trigger blur
      await page.click('text=Auto reply sender');
      await page.waitForTimeout(500);
      break;
    }
  }

  // Also update subject
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(c => {
      const s = window.getComputedStyle(c);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && c.scrollHeight > c.clientHeight + 50)
        c.scrollTop = c.scrollHeight * 0.5;
    });
  });
  await page.waitForTimeout(500);

  const inputs = await page.$$('input');
  for (const inp of inputs) {
    try {
      const val = await inp.inputValue();
      if (val.includes('Thank you') || val.includes('Bedankt')) {
        await inp.click({ clickCount: 3 });
        await inp.fill('Bedankt voor uw bericht \u2014 Sonty');
        console.log('Subject updated');
        break;
      }
    } catch (e) {}
  }

  // Now find and click save button
  await page.waitForTimeout(500);

  // Try finding save in the page
  const allButtons = await page.$$('button');
  let saved = false;
  for (const btn of allButtons) {
    try {
      const text = (await btn.textContent()).trim();
      const visible = await btn.isVisible();
      if ((text === 'Save' || text.includes('Save') || text === 'Opslaan') && visible) {
        console.log('Found save button:', text);
        await btn.click();
        await page.waitForTimeout(3000);
        saved = true;
        console.log('Saved!');
        break;
      }
    } catch (e) {}
  }

  if (!saved) {
    // Scroll up to find save button
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(c => {
        const s = window.getComputedStyle(c);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && c.scrollHeight > c.clientHeight + 50)
          c.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);

    const btns2 = await page.$$('button');
    for (const btn of btns2) {
      try {
        const text = (await btn.textContent()).trim();
        const visible = await btn.isVisible();
        if ((text === 'Save' || text.includes('Save') || text === 'Opslaan') && visible) {
          await btn.click();
          await page.waitForTimeout(3000);
          console.log('Saved (after scroll up)!');
          saved = true;
          break;
        }
      } catch (e) {}
    }
  }

  if (!saved) {
    console.log('Could not find save button. Listing all buttons:');
    for (const btn of allButtons) {
      try {
        const text = (await btn.textContent()).trim().substring(0, 40);
        const visible = await btn.isVisible();
        console.log('  Button:', JSON.stringify(text), 'visible:', visible);
      } catch (e) {}
    }
  }

  await page.screenshot({ path: '/tmp/trengo-final-save.png' });
  await browser.close();
  console.log('Done');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
