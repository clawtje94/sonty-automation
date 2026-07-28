#!/usr/bin/env node
/**
 * PREVIEW MET ECHTE KLANTDATA (oplevercheck, poort 1: testen tegen productiedata).
 *
 * preview.js rendert met één verzonnen voorbeeldklant. Dat ziet er altijd goed uit, want die
 * voorbeeldwaarden heb ik zelf gekozen. Dit script pakt juist de lastige gevallen uit de echte
 * export: de klant zonder voornaam, de duurste offerte, de goedkoopste, de langste productnaam en
 * de klant met initialen in plaats van een naam. Daar breekt een sjabloon, niet bij "Marleen".
 *
 * Gebruik: node scripts/email/preview-echt.js
 * Resultaat: scripts/email/previews-echt/
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, 'dist');
const SHOTS = path.join(__dirname, 'previews-echt');
const EXPORT = path.join(__dirname, '..', '..', 'data', 'email', 'rp-export.json');

const euro = (n) => typeof n === 'number' && isFinite(n)
  ? '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
const datumNL = (ms) => ms ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// De echte functies uit de sync, niet een kopie. Een kopie loopt na de eerste wijziging uit de
// pas en dan test je iets anders dan wat de klant krijgt.
const { netteVoornaam, leesbaarProduct, netProduct } = require('./klaviyo-profielen.js');

function velden(k) {
  return {
    'first_name': netteVoornaam(k.voornaam) || '',
    'person.sonty_product': netProduct(k.product) || '',
    'person.sonty_product_kort': leesbaarProduct(k.product) || '',
    'person.sonty_offertenummer': k.offerteNummer || '',
    'person.sonty_geldigheid_label': (k.offerteVerlooptOp > Date.now()) ? 'Geldig tot' : 'Prijs van',
    'person.sonty_geldigheid_waarde': datumNL((k.offerteVerlooptOp > Date.now()) ? k.offerteVerlooptOp : k.offerteDatum),
    'person.sonty_bedrag': euro(k.offerteBedrag),
    'person.sonty_offerte_datum_nl': datumNL(k.offerteDatum),
    'person.sonty_offerte_link': k.offerteLink || '',
    'person.sonty_weer_piek': '32,2',
    'person.sonty_weer_dag': 'woensdag',
  };
}

function vulIn(html, w) {
  return html
    .replace(/\{\{\s*([a-z_.]+)\s*\|\s*default:\s*"([^"]*)"\s*\}\}/gi, (_, s, def) => (w[s] ? w[s] : def))
    .replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, s) => w[s] ?? '')
    .replace(/\{%\s*unsubscribe\s*%\}/gi, '#uit')
    .replace(/\{%\s*manage_preferences\s*%\}/gi, '#voorkeuren');
}

(async () => {
  const rijen = JSON.parse(fs.readFileSync(EXPORT, 'utf8')).filter((r) => r.magMail !== false && r.offerteLink);
  const opBedrag = [...rijen].sort((a, b) => (b.offerteBedrag || 0) - (a.offerteBedrag || 0));

  const gevallen = [
    ['duurste-offerte', opBedrag[0]],
    ['goedkoopste-offerte', opBedrag.filter((r) => r.offerteBedrag > 0).slice(-1)[0]],
    ['zonder-voornaam', rijen.find((r) => !netteVoornaam(r.voornaam))],
    ['initialen-als-naam', rijen.find((r) => /\./.test(String(r.voornaam || '').split(' ')[0]))],
    ['langste-productnaam', [...rijen].sort((a, b) => String(b.product || '').length - String(a.product || '').length)[0]],
  ].filter(([, k]) => k);

  console.log('Randgevallen uit de echte export:\n');
  for (const [naam, k] of gevallen) {
    console.log(`  ${naam.padEnd(22)} voornaam=${JSON.stringify(netteVoornaam(k.voornaam))} bedrag=${euro(k.offerteBedrag) || '(geen)'} product=${JSON.stringify(String(k.product || '').slice(0, 40))}`);
  }

  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  // De drie mails waar de meeste variabelen in zitten; breekt het ergens, dan hier.
  const SJABLONEN = ['sonty-rp-offerte', 'sonty-reactivering-1', 'sonty-weer-hitte'];

  for (const [naam, k] of gevallen) {
    const w = velden(k);
    for (const sj of SJABLONEN) {
      const html = vulIn(fs.readFileSync(path.join(DIST, sj + '.html'), 'utf8'), w);
      const tmp = path.join(SHOTS, `${sj}__${naam}.html`);
      fs.writeFileSync(tmp, html);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto('file://' + tmp);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS, `${sj}__${naam}.png`), fullPage: true });
      await ctx.close();
    }
    console.log(`  gerenderd: ${naam}`);
  }
  await browser.close();
  console.log(`\nScreenshots in ${SHOTS}`);
  process.exit(0);
})().catch((e) => { console.error('FOUT: ' + (e.message || e)); process.exit(1); });
