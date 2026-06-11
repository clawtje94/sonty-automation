#!/usr/bin/env node
/**
 * Dumpt ALLE configurators van het Sonty B.V. profiel (read-only!)
 * naar data/rp-configurator-voorbeelden/ als referentie voor de nieuwe build.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'rp-configurator-voorbeelden');
const SONTY_PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
fs.mkdirSync(OUT, { recursive: true });

async function loginHub(page) {
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
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await loginHub(page);

  const get = (url) => page.evaluate(async (u) => {
    const res = await fetch(u, { credentials: 'include' });
    const text = await res.text();
    try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text.slice(0, 300) }; }
  }, url);

  const list = await get(`https://backend.reuzenpanda.nl/widget-service/${SONTY_PID}/configurators`);
  const items = (list.body && list.body.configurators) || [];
  console.log('Configurators:', items.map((c) => c.name).join(' | '));

  const index = [];
  for (const c of items) {
    const detail = await get(`https://backend.reuzenpanda.nl/widget-service/${SONTY_PID}/configurators/${c.id}`);
    const conf = detail.body.configurator || detail.body;
    const slug = (c.name || c.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    fs.writeFileSync(path.join(OUT, `sonty-bv-${slug}.json`), JSON.stringify(detail, null, 2));
    index.push({ id: c.id, name: c.name, steps: (conf.steps || []).length, relations: (conf.relations || []).length, file: `sonty-bv-${slug}.json` });
    console.log(`${c.name}: ${detail.status}, ${(conf.steps || []).length} steps, ${(conf.relations || []).length} relations`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  await browser.close();
})();
