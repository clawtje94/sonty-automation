// Haalt een OWA-token op door de Authorization-header van outlook.office.com te onderscheppen.
// Bewezen patroon uit ~/sonty/scripts/werkbon-mail-fetch.js
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/owa-token.txt';
const PASS = fs.readFileSync('/Users/clawdboot/sonty/scripts/.outlook-joey-pass.txt', 'utf8').trim();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1600, height: 1000 } }).then(c => c.newPage());
  let token = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && req.url().includes('outlook.office.com')) token = auth.slice(7);
  });

  await page.goto('https://outlook.office.com/mail/');
  await page.waitForTimeout(3000);
  const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
  if (emailInput) {
    await emailInput.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(4000);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await pw.fill(PASS);
      await page.locator('input[type="submit"]').click();
      await page.waitForTimeout(5000);
    }
    try {
      const yes = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
      if (await yes.count()) { await yes.first().click(); await page.waitForTimeout(4000); }
    } catch {}
  }
  await page.waitForTimeout(10000);
  if (!token) { await page.reload(); await page.waitForTimeout(8000); }
  if (token) { fs.writeFileSync(OUT, token); console.log('TOKEN_OK', token.length); }
  else console.log('TOKEN_FAIL');
  await browser.close();
})();
