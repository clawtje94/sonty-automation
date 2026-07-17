#!/usr/bin/env node
// Microsoft Bookings "API" — leest de showroom-afspraken via de Bookings-webapp (Playwright,
// joey@sontymontage.nl). Er is geen echte API-koppeling (Graph vereist app-registratie in M365);
// dit gebruikt de Exporteren-knop van de agenda: die levert een bestand met alle afspraken.
// Gebruik: node scripts/bookings-afspraken.js [--dagen 30] [--json]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const argIdx = process.argv.indexOf('--dagen');
const DAGEN = argIdx > -1 ? parseInt(process.argv[argIdx + 1], 10) || 30 : 30;
const ALS_JSON = process.argv.includes('--json');
const SHOT_DIR = process.env.SHOT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const shot = (n) => page.screenshot({ path: path.join(SHOT_DIR, `bookings-${n}.png`) }).catch(() => {});
  try {
    await page.goto('https://outlook.office.com/bookings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);
    // Alleen inloggen als we echt op de Microsoft-loginpagina staan (anders racet de
    // redirect met de selector en klapt de execution context — gezien 2026-07-17)
    const opLogin = /login\.microsoftonline|login\.live/.test(page.url());
    const emailInput = opLogin ? await page.$('input[type="email"], input[name="loginfmt"]').catch(() => null) : null;
    if (emailInput) {
      await emailInput.fill('joey@sontymontage.nl');
      await page.locator('input[type="submit"]').click();
      await page.waitForTimeout(3000);
      const pw = await page.$('input[type="password"]');
      if (pw) {
        await pw.fill(fs.readFileSync(path.join(__dirname, '.outlook-joey-pass.txt'), 'utf8').trim());
        await page.locator('input[type="submit"]').click();
        await page.waitForTimeout(3000);
      }
      const yes = page.locator('input[value="Yes"], input[value="Ja"], #idSIButton9');
      if (await yes.count()) { await yes.first().click().catch(() => {}); await page.waitForTimeout(3000); }
    }
    await page.waitForTimeout(6000);

    // Open de showroom-reserveringspagina en de agenda
    await page.locator('text=Afspraak showroom').first().click({ timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.locator('a:has-text("Agenda"), span:has-text("Agenda"), div[role="tab"]:has-text("Agenda")').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await shot('agenda');

    // Exporteren → periode kiezen → download
    await page.locator('button:has-text("Exporteren"), span:has-text("Exporteren")').first().click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    await shot('export-dialoog');

    // Datumbereik: standaard laten staan als het dialoog al een bereik heeft; anders niets invullen.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('button:has-text("Exporteren"), button:has-text("Export")').last().click(),
    ]);
    const bestand = path.join(SHOT_DIR, 'bookings-export' + path.extname(download.suggestedFilename() || '.tsv'));
    await download.saveAs(bestand);
    console.log('Export:', download.suggestedFilename(), '→', bestand);

    // Parsen: Bookings exporteert TSV/CSV met kopregel
    const ruw = fs.readFileSync(bestand, 'utf8');
    const scheider = ruw.includes('\t') ? '\t' : ',';
    const rijen = ruw.split(/\r?\n/).filter(Boolean).map(r => r.split(scheider));
    const kop = rijen[0];
    const afspraken = rijen.slice(1).map(r => Object.fromEntries(kop.map((k, i) => [k.trim(), (r[i] || '').trim()])));
    if (ALS_JSON) console.log(JSON.stringify(afspraken, null, 1));
    else {
      console.log(`\n${afspraken.length} afspraken in export:`);
      for (const a of afspraken.slice(0, 40)) {
        const velden = Object.values(a).filter(Boolean).slice(0, 6).join(' | ');
        console.log('-', velden.slice(0, 160));
      }
    }
  } catch (e) {
    await shot('fout');
    console.error('MISLUKT:', e.message.slice(0, 200), `— zie ${SHOT_DIR}/bookings-fout.png`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
