#!/usr/bin/env node
/**
 * Verkent de nieuwe Reuzenpanda configurator-builder in de hub.
 * Logt in als Daimy, zoekt het Sonty test profiel + configurator-sectie,
 * en logt alle backend API-calls (method + URL) voor de API-integratie.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/rp-explore';
fs.mkdirSync(OUT, { recursive: true });
const apiCalls = new Set();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('backend.reuzenpanda.nl')) apiCalls.add(r.method() + ' ' + u);
  });

  // Login
  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + '/00-login.png' });
  const emailInput = await page.$('input[placeholder*="mail"], input[type="email"], input[name="email"]');
  if (emailInput) {
    await emailInput.fill('daimyboot@gmail.com');
    let pw = await page.$('input[type="password"]');
    if (!pw) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      pw = await page.$('input[type="password"]');
    }
    if (pw) {
      await pw.fill('TQGb@eD%5nGRSN9@4Gss');
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(6000);
  }
  console.log('URL na login:', page.url());
  await page.screenshot({ path: OUT + '/01-after-login.png' });

  // Profielen ophalen via de sessie van de browser
  const profiles = await page.evaluate(async () => {
    const res = await fetch('https://backend.reuzenpanda.nl/company-profile-service/get-company-profiles', { credentials: 'include' });
    return res.json();
  }).catch((e) => 'fetch error: ' + e.message);
  fs.writeFileSync(OUT + '/profiles.json', JSON.stringify(profiles, null, 2));
  console.log('Profielen:', Array.isArray(profiles) ? profiles.map((p) => p.name + ' (' + p.id + ')').join(', ') : profiles);

  // Navigatie-snapshot van het hoofdmenu
  const navLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="/app"]')).map((a) => a.getAttribute('href') + ' | ' + (a.textContent || '').trim()).filter((v, i, s) => s.indexOf(v) === i)
  );
  console.log('Nav links:\n' + navLinks.join('\n'));

  // Probeer configurator-routes
  for (const route of ['/app/configurators', '/app/configurator', '/app/forms']) {
    await page.goto('https://hub.reuzenpanda.nl' + route, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const name = route.replace(/\//g, '_');
    await page.screenshot({ path: OUT + '/route' + name + '.png' });
    console.log('Route ' + route + ' -> ' + page.url());
  }

  fs.writeFileSync(OUT + '/api-calls.txt', Array.from(apiCalls).sort().join('\n'));
  console.log('API calls gelogd:', apiCalls.size);
  await browser.close();
})();
