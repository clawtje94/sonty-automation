#!/usr/bin/env node
/**
 * Opent de Prijstest-configurator in de hub-editor (Sonty test) en
 * verkent de prijs/score-instellingen. Screenshots + capture van PUT-payloads.
 */
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
  await page.screenshot({ path: OUT + '/30-editor.png' });

  // Zoek tabs/knoppen die met prijs te maken hebben
  const texts = await page.$$eval('button, [role="tab"], a, [class*="menu"] *', (els) =>
    els.map((e) => (e.textContent || '').trim()).filter((t) => t && t.length < 40).filter((v, i, s) => s.indexOf(v) === i)
  );
  fs.writeFileSync(OUT + '/editor-texts.txt', texts.join('\n'));
  const prijsItems = texts.filter((t) => /prijs|price|score|bereken/i.test(t));
  console.log('Prijs-gerelateerde UI:', JSON.stringify(prijsItems));

  // Instellingen-tandwiel rechtsboven proberen
  const gear = await page.$('[class*="settings"], svg[data-icon="gear"], button:has(svg[data-icon="gear"])');
  if (gear) { await gear.click(); await page.waitForTimeout(3000); await page.screenshot({ path: OUT + '/31-settings.png' }); }

  // Klik op antwoord "Model A" om de antwoord-instellingen te zien
  const modelA = await page.$('text=Model A');
  if (modelA) { await modelA.click(); await page.waitForTimeout(3000); await page.screenshot({ path: OUT + '/32-answer-selected.png' }); }

  fs.writeFileSync(OUT + '/pricing-writes.json', JSON.stringify(writes, null, 2));
  console.log('writes:', writes.length);
  await browser.close();
})();
