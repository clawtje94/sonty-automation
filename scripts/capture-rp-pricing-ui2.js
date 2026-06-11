#!/usr/bin/env node
/** Verkent prijs/score-instellingen in de editor: vraag-tandwiel, Logica-tab, hoofdinstellingen. */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/rp-explore';
const CONF_ID = 'b2d9ec0b-3362-4048-8a9c-c833bfe05dab';
const writes = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('request', (r) => {
    if (['PUT', 'POST', 'PATCH'].includes(r.method()) && r.url().includes('widget-service')) {
      writes.push({ method: r.method(), url: r.url(), payload: r.postData() });
    }
  });

  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 60000 });
  await page.waitForTimeout(3000);
  const emailInput = await page.$('input[placeholder*="mail"], input[type="email"]');
  if (emailInput) {
    await emailInput.fill('daimyboot@gmail.com');
    let pw = await page.$('input[type="password"]');
    if (!pw) { await page.keyboard.press('Enter'); await page.waitForTimeout(3000); pw = await page.$('input[type="password"]'); }
    if (pw) { await pw.fill('TQGb@eD%5nGRSN9@4Gss'); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(6000);
  }
  const test = await page.$('text=Sonty test');
  if (test) { await test.click(); await page.waitForTimeout(5000); }

  await page.goto(`https://hub.reuzenpanda.nl/app/forms/${CONF_ID}/editor`, { timeout: 60000 });
  await page.waitForTimeout(6000);

  // 1) Tandwiel naast de vraag (zwevende knoppenrij rechts van de kaart)
  await page.mouse.click(973, 206);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/33-question-gear.png' });

  // 2) Logica-tab
  const logica = await page.$('text=Logica');
  if (logica) { await logica.click(); await page.waitForTimeout(2500); await page.screenshot({ path: OUT + '/34-logica-tab.png' }); }

  // 3) Hoofdinstellingen (tandwiel rechtsboven, naast Publiceren)
  await page.mouse.click(1447, 24);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/35-main-settings.png' });

  fs.writeFileSync(OUT + '/pricing-writes2.json', JSON.stringify(writes, null, 2));
  console.log('writes:', writes.length);
  await browser.close();
})();
