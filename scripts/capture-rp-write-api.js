#!/usr/bin/env node
/**
 * Leert de write-API van widget-service door op het SONTY TEST profiel
 * (en alleen daar!) via de UI een configurator aan te maken,
 * met volledige capture van alle schrijvende calls (method, url, payload, response).
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/rp-explore';
const TEST_PID = '23944e59-c24d-4032-a9fa-dbdb6f52bc94';
fs.mkdirSync(OUT, { recursive: true });
const writes = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('request', async (r) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) return;
    const u = r.url();
    if (!u.includes('backend.reuzenpanda.nl')) return;
    if (u.includes('analytics') || u.includes('event-streaming') || u.includes('filter-service')) return;
    writes.push({ method: r.method(), url: u, payload: r.postData() });
  });
  page.on('response', async (res) => {
    const r = res.request();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) return;
    const u = r.url();
    if (!u.includes('backend.reuzenpanda.nl') || u.includes('analytics') || u.includes('event-streaming') || u.includes('filter-service')) return;
    const entry = writes.find((w) => w.url === u && !w.response);
    if (entry) { entry.status = res.status(); entry.response = await res.text().catch(() => ''); }
  });

  // Login
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

  // Bedrijfskeuze: SONTY TEST (niet Sonty B.V.!)
  const test = await page.$('text=Sonty test');
  if (test) { await test.click(); await page.waitForTimeout(5000); }
  await page.screenshot({ path: OUT + '/20-test-profile.png' });

  // Verifieer dat we echt op het testprofiel zitten
  const current = await page.evaluate(async () => {
    const res = await fetch('https://backend.reuzenpanda.nl/company-profile-service/list-company-profiles', { credentials: 'include' });
    return res.json();
  }).catch(() => null);
  fs.writeFileSync(OUT + '/current-profile.json', JSON.stringify(current, null, 2));

  await page.goto('https://hub.reuzenpanda.nl/app/forms', { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + '/21-forms-test.png' });

  // Nieuw formulier maken: ronde +-knop naast de "Formulieren"-titel
  await page.mouse.click(315, 88);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + '/22-after-plus.png' });

  // Template-galerij: "Maak een nieuw formulier zonder sjabloon" (+ onderaan)
  const blank = await page.$('text=Maak een nieuw formulier zonder sjabloon');
  if (blank) {
    const box = await blank.boundingBox();
    // de +-knop staat rechts naast de tekst
    await page.mouse.click(box.x + box.width + 30, box.y + box.height / 2);
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: OUT + '/25-blank-chosen.png' });

  // Eventuele naam-dialoog
  const nameInput = await page.$('input[name="name"], [role="dialog"] input[type="text"], .modal input[type="text"]');
  if (nameInput) {
    await nameInput.fill('API test - Knikarmschermen');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: OUT + '/26-editor.png' });
  console.log('URL nu:', page.url());

  // In de editor: probeer op te slaan zodat we de save-call zien
  const saveBtn = await page.$('button:has-text("Opslaan"), button:has-text("Publiceer"), button:has-text("Save")');
  if (saveBtn) { await saveBtn.click(); await page.waitForTimeout(4000); }
  await page.screenshot({ path: OUT + '/27-after-save.png' });

  fs.writeFileSync(OUT + '/write-calls.json', JSON.stringify(writes, null, 2));
  console.log('Schrijvende calls:', writes.length);
  for (const w of writes) console.log(w.method, w.status, w.url.replace('https://backend.reuzenpanda.nl', ''));
  await browser.close();
})();
