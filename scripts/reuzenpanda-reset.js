const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('https://hub.reuzenpanda.nl/-/nl/login/daimyboot@gmail.com/forgot-password');
  await page.waitForTimeout(3000);

  // Click "Wachtwoord opnieuw instellen"
  await page.click('button:has-text("Wachtwoord opnieuw instellen")');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/rp-reset-sent.png' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log('After reset:', text.substring(0, 300));

  await browser.close();
})().catch(console.error);
