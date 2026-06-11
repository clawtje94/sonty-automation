const { chromium } = require('playwright');

const NL_AUTO_REPLY = `Beste [name],

Bedankt voor uw bericht! We hebben uw e-mail ontvangen en geregistreerd als ticket #[ticket_number]. U kunt altijd op deze e-mail reageren als u extra informatie wilt toevoegen.

We streven ernaar om binnen 4 uur te reageren tijdens werkdagen.

Met vriendelijke groet,
Team Sonty
📞 085 006 9681`;

const EMAIL_CHANNELS = [1347356, 1347358, 1359813];
const NAMES = { 1347356: 'Email (Trengo)', 1347358: 'Sonty (Outlook)', 1359813: 'Klantenservice (Nylas)' };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('https://app.trengo.com/login');
  await page.waitForTimeout(4000);
  await page.fill('input[name="email"], input[type="email"]', 'daimy@sonty.nl');
  await page.fill('input[name="password"], input[type="password"]', 'CZ%bWD64XVs6Kf');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  if (page.url().includes('login')) { console.log('Login failed'); await browser.close(); return; }
  console.log('Logged in\n');

  for (const chId of EMAIL_CHANNELS) {
    console.log(`══ ${NAMES[chId]} (${chId}) ══`);

    await page.goto(`https://app.trengo.com/admin/channels2/email/${chId}`);
    await page.waitForTimeout(3000);
    await page.click('text=Email settings');
    await page.waitForTimeout(2000);

    // Scroll the content container to bottom to expose auto-reply fields
    await page.evaluate(() => {
      const containers = document.querySelectorAll('div');
      for (const c of containers) {
        const style = window.getComputedStyle(c);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && c.scrollHeight > c.clientHeight) {
          c.scrollTop = c.scrollHeight;
        }
      }
      window.scrollTo(0, document.body.scrollHeight);
      document.documentElement.scrollTop = document.documentElement.scrollHeight;
    });
    await page.waitForTimeout(1000);

    // Find and update "Auto reply sender" input (contains "sonty.nl")
    const allInputs = await page.$$('input[type="text"], input:not([type])');
    for (const inp of allInputs) {
      try {
        const val = await inp.inputValue();
        if (val === 'sonty.nl' || val === 'Sonty') {
          // Check if this is the auto-reply sender by checking nearby text
          const isVisible = await inp.isVisible();
          if (isVisible) {
            await inp.click({ clickCount: 3 });
            await inp.fill('Sonty');
            console.log('  ✅ Auto reply sender → "Sonty"');
          }
        }
      } catch (e) { /* skip */ }
    }

    // Find and update auto-reply subject input
    const subjectInputs = await page.$$('input');
    for (const inp of subjectInputs) {
      try {
        const val = await inp.inputValue();
        if (val.includes('Thank you') || val.includes('thank you') || val.includes('Bedankt')) {
          const isVisible = await inp.isVisible();
          if (isVisible) {
            await inp.click({ clickCount: 3 });
            await inp.fill('Bedankt voor uw bericht — Sonty');
            console.log('  ✅ Auto reply subject → NL');
          }
        }
      } catch (e) { /* skip */ }
    }

    // Find and update auto-reply body (contenteditable with "Dear [name]" or "Beste [name]")
    const editors = await page.$$('[contenteditable="true"], .ql-editor, .ProseMirror');
    for (const ed of editors) {
      try {
        const text = await ed.textContent();
        if (text.includes('Dear [name]') || text.includes('confirmation') || text.includes('Kinds regards') || text.includes('Beste [name]')) {
          const isVisible = await ed.isVisible();
          if (isVisible) {
            await ed.click();
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await ed.pressSequentially(NL_AUTO_REPLY, { delay: 5 });
            console.log('  ✅ Auto reply body → NL');
            break;
          }
        }
      } catch (e) { /* skip */ }
    }

    // Save
    await page.waitForTimeout(500);
    const saveBtn = await page.$('button:has-text("Save"), button:has-text("Opslaan")');
    if (saveBtn) {
      const isVisible = await saveBtn.isVisible();
      if (isVisible) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        console.log('  ✅ Saved');
      }
    }

    await page.screenshot({ path: `/tmp/trengo-ar-done-${chId}.png` });
    console.log('');
  }

  await browser.close();
  console.log('══ KLAAR ══');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
