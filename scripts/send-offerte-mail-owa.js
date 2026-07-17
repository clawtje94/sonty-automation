#!/usr/bin/env node
// Offerte-mail in Sonty-huisstijl versturen via Outlook Web (SMTP AUTH staat uit op de tenant).
// Login-flow = zelfde als werkbon-mail-check.js (joey@sontymontage.nl, headless).
// Gebruik: node scripts/send-offerte-mail-owa.js --to x@y.nl --voornaam Joey --product "..." \
//   --bedrag "€ 8.262" --link "https://..." --geldig "23 juli 2026" [--intro "..."] [--subject "..."]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const arg = (naam, verplicht = true) => {
  const i = process.argv.indexOf('--' + naam);
  if (i === -1 || !process.argv[i + 1]) {
    if (verplicht) { console.error(`--${naam} ontbreekt`); process.exit(1); }
    return null;
  }
  return process.argv[i + 1];
};

const to = arg('to');
const vars = {
  '{{voornaam}}': arg('voornaam'),
  '{{product}}': arg('product'),
  '{{offertebedrag}}': arg('bedrag'),
  '{{offerte_link}}': arg('link'),
  '{{geldig_tot}}': arg('geldig'),
};
const intro = arg('intro', false);
const subject = arg('subject', false) || 'Je offerte van Sonty';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp';

let html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'emails', '03-definitieve-offerte.html'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '');
if (intro) html = html.replace(/<p>Bedankt voor de fijne opmeting![\s\S]*?<\/p>/, `<p>${intro}</p>`);
for (const [k, v] of Object.entries(vars)) html = html.split(k).join(v);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
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
        await pwInput.fill(fs.readFileSync(path.join(__dirname, '.outlook-joey-pass.txt'), 'utf8').trim());
        await page.locator('input[type="submit"]').click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
      try {
        const yesBtn = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
        if (await yesBtn.count()) { await yesBtn.first().click(); await page.waitForTimeout(3000); }
      } catch {}
    }
    await page.waitForTimeout(3000);

    // Nieuw bericht via de directe compose-deeplink (de "Nieuw"-knop kan in de verkeerde
    // Outlook-app landen, bv. Nieuwsbrieven — gezien 2026-07-17)
    await page.goto('https://outlook.office.com/mail/deeplink/compose');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    // Aan-veld
    const aan = page.locator('[aria-label="To" i], [aria-label="Aan" i], div[role="textbox"][aria-label*="To" i]').first();
    await aan.click();
    await page.keyboard.type(to);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    // Onderwerp
    const subj = page.locator('input[aria-label*="subject" i], input[aria-label*="onderwerp" i], input[placeholder*="subject" i]').first();
    await subj.fill(subject);

    // Body: HTML direct in de rich-text editor zetten + input-event zodat OWA het registreert
    const body = page.locator('div[role="textbox"][contenteditable="true"][aria-label*="body" i], div[role="textbox"][contenteditable="true"][aria-label*="bericht" i], div[contenteditable="true"].dFCbN, div[role="textbox"][contenteditable="true"]').last();
    await body.click();
    await body.evaluate((el, h) => {
      el.innerHTML = h;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, html);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOT_DIR, 'offerte-mail-concept.png') });

    // Versturen
    const send = page.locator('button[aria-label*="Send" i], button[aria-label*="Verzenden" i], button[title*="Send" i]').first();
    await send.click();
    await page.waitForTimeout(4000);

    // Controle: staat hij in Verzonden items?
    await page.goto('https://outlook.office.com/mail/sentitems/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SHOT_DIR, 'offerte-mail-verzonden.png') });
    const eerste = await page.locator('[role="listbox"] [role="option"]').first().textContent().catch(() => '');
    console.log('Bovenste verzonden item:', (eerste || '(lijst niet leesbaar)').slice(0, 160));
    console.log(`Klaar. Screenshots: ${SHOT_DIR}/offerte-mail-concept.png + offerte-mail-verzonden.png`);
  } catch (e) {
    await page.screenshot({ path: path.join(SHOT_DIR, 'offerte-mail-fout.png') }).catch(() => {});
    console.error('MISLUKT:', e.message, `— zie ${SHOT_DIR}/offerte-mail-fout.png`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
