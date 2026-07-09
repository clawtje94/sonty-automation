/**
 * Check of joey@sontymontage.nl de gedeelde mailbox werkbon@sonty.nl kan openen
 * in Outlook Web, en lees de zichtbare berichtenlijst uit.
 * Output: screenshot + onderwerpen naar stdout. Alleen-lezen.
 */
const { chromium } = require('playwright');

const SCREENSHOT = process.argv[2] || '/tmp/werkbon-mailbox.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Vang ook een outlook.office.com bearer-token voor eventuele REST-calls
  let owaToken = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
      owaToken = auth.replace('Bearer ', '');
    }
  });

  try {
    await page.goto('https://outlook.office.com/mail/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
    if (emailInput) {
      await emailInput.fill('joey@sontymontage.nl');
      await page.locator('input[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      const pwInput = await page.$('input[type="password"]');
      if (pwInput) {
        await pwInput.fill('Shja..59');
        await page.locator('input[type="submit"]').click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
      try {
        const yesBtn = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
        if (await yesBtn.count()) { await yesBtn.first().click(); await page.waitForTimeout(3000); }
      } catch {}
    }

    // Open de gedeelde mailbox direct via URL
    await page.goto('https://outlook.office.com/mail/werkbon@sonty.nl/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);

    await page.screenshot({ path: SCREENSHOT });

    // Berichtenlijst uitlezen (OWA rijen hebben role=option in de lijst)
    const rows = await page.$$eval('[role="listbox"] [role="option"]', (els) =>
      els.slice(0, 25).map((el) => el.innerText.replace(/\n+/g, ' | ').slice(0, 220))
    ).catch(() => []);

    // Foutmelding zichtbaar?
    const body = await page.evaluate(() => document.body.innerText.slice(0, 600));
    const denied = /geen toegang|access denied|niet gevonden|doesn.t exist|kan deze map niet/i.test(body);

    console.log(JSON.stringify({
      ok: rows.length > 0 && !denied,
      denied,
      rowCount: rows.length,
      rows: rows.slice(0, 15),
      owaTokenCaptured: !!owaToken,
      url: page.url(),
    }, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
  await browser.close();
})();
