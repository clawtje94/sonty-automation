#!/usr/bin/env node
/**
 * Stap 2: open Sonty B.V. profiel → Formulieren → eerste externe formulier.
 * Logt alle backend-calls zodat we de configurator-API leren kennen.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/rp-explore';
fs.mkdirSync(OUT, { recursive: true });
const apiCalls = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('reuzenpanda.nl') && !u.includes('hub.reuzenpanda.nl') && !u.includes('mercure')) {
      apiCalls.push(r.method() + ' ' + u.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '{uuid}'));
    }
  });

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

  // Bedrijfskeuze: klik Sonty B.V. als de picker er staat
  const sonty = await page.$('text=Sonty B.V.');
  if (sonty) { await sonty.click(); await page.waitForTimeout(5000); }
  await page.screenshot({ path: OUT + '/10-profile-chosen.png' });

  await page.goto('https://hub.reuzenpanda.nl/app/forms', { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + '/11-forms.png' });

  // Externe formulieren openen
  const ext = await page.$('text=Externe formulieren');
  if (ext) { await ext.click(); await page.waitForTimeout(4000); }
  await page.screenshot({ path: OUT + '/12-external-forms.png' });

  // Lijst met formulieren loggen
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a, [role="button"], li')).map((e) => (e.textContent || '').trim()).filter((t) => t && t.length < 80).filter((v, i, s) => s.indexOf(v) === i)
  );
  fs.writeFileSync(OUT + '/form-items.txt', items.join('\n'));

  // Eerste formulier in de zijbalk aanklikken (na de vaste menu-items)
  const links = await page.$$('aside a, nav a, [class*="sidebar"] a');
  console.log('Zijbalk links:', links.length);
  for (const l of links) {
    const t = ((await l.textContent()) || '').trim();
    if (t && !['Externe formulieren', 'Interne formulieren'].includes(t)) {
      console.log('Open formulier:', t);
      await l.click();
      await page.waitForTimeout(6000);
      break;
    }
  }
  await page.screenshot({ path: OUT + '/13-form-opened.png' });
  console.log('URL:', page.url());

  fs.writeFileSync(OUT + '/api-calls2.txt', Array.from(new Set(apiCalls)).sort().join('\n'));
  console.log('API calls gelogd:', new Set(apiCalls).size);
  await browser.close();
})();
