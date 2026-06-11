#!/usr/bin/env node
/**
 * Stap 3 (alleen-lezen): haal de bestaande Sonty B.V. configurator(s) op
 * via Daimy's hub-sessie, zodat we het datamodel kennen voor de nieuwe build.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/rp-explore';
const SONTY_PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 60000 });
  await page.waitForTimeout(3000);
  const emailInput = await page.$('input[placeholder*="mail"], input[type="email"], input[name="email"]');
  if (emailInput) {
    await emailInput.fill('daimyboot@gmail.com');
    let pw = await page.$('input[type="password"]');
    if (!pw) { await page.keyboard.press('Enter'); await page.waitForTimeout(3000); pw = await page.$('input[type="password"]'); }
    if (pw) { await pw.fill('TQGb@eD%5nGRSN9@4Gss'); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(6000);
  }
  const sonty = await page.$('text=Sonty B.V.');
  if (sonty) { await sonty.click(); await page.waitForTimeout(5000); }

  const get = (url) => page.evaluate(async (u) => {
    const res = await fetch(u, { credentials: 'include' });
    const text = await res.text();
    try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text.slice(0, 300) }; }
  }, url);

  const list = await get(`https://backend.reuzenpanda.nl/widget-service/${SONTY_PID}/configurators`);
  fs.writeFileSync(OUT + '/sonty-configurators-list.json', JSON.stringify(list, null, 2));
  const items = (list.body && list.body.configurators) || [];
  console.log('Configurators:', items.length, items.map((c) => `${c.name || c.title || c.id}`).join(' | '));

  for (const c of items.slice(0, 3)) {
    const detail = await get(`https://backend.reuzenpanda.nl/widget-service/${SONTY_PID}/configurators/${c.id}`);
    fs.writeFileSync(`${OUT}/sonty-configurator-${c.id}.json`, JSON.stringify(detail, null, 2));
    console.log('Detail', c.id, '->', detail.status, JSON.stringify(detail.body).length, 'bytes');
  }
  await browser.close();
})();
