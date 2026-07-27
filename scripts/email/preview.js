#!/usr/bin/env node
/**
 * PREVIEW + VISUELE CONTROLE van de e-mailsjablonen (Daimy 2026-07-27).
 *
 * Vervangt de Klaviyo-variabelen door echte voorbeeldwaarden en maakt screenshots in vier
 * combinaties: desktop en mobiel, licht en donker. Zonder deze stap weet je pas hoe een mail
 * eruitziet als hij al bij een klant ligt, en dark mode is precies de plek waar het stilletjes
 * misgaat (witte tekst op wit, of een donkere kaart die in de achtergrond verdwijnt).
 *
 * Gebruik: node scripts/email/preview.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, 'dist');
const SHOTS = path.join(__dirname, 'previews');

// Realistische voorbeeldklant. Bewust een echt ogende offerte, want een lege of nette
// "Test Test"-waarde verbergt juist de problemen (te lange productnaam, groot bedrag).
const VOORBEELD = {
  'first_name': 'Marleen',
  'person.product': 'Zip Design 110 zipscreens (2x, solar)',
  'person.offertenummer': '20269576',
  'person.geldig_tot': '3 augustus 2026',
  'person.bedrag': '€ 4.500,00',
  'person.offerte_datum': '21 juli',
  'person.offerte_link': 'https://document.reuzenpanda.nl/voorbeeld',
  'person.showroom_link': 'https://www.sonty.nl/showroom',
  'person.verhaal_kop': 'Je zocht ooit een knikarmscherm',
  'person.verhaal_intro': 'Is het er destijds nooit van gekomen? Dat gebeurt vaker dan je denkt. Even laten zien wat er nu mogelijk is.',
  'person.verhaal_tekst': 'Onze eigen montageteams plaatsen alles zelf, en we werken uitsluitend met A-merken. Daardoor weet je vooraf wat je krijgt en bij wie je terechtkunt als er iets is.',
  'person.verhaal_cta': 'Bekijk wat het nu kost',
  'person.verhaal_link': 'https://www.sonty.nl',
  'person.service_cta': 'Laat het ons weten',
  'person.service_link': 'https://www.sonty.nl/contact',
};

/** Vervangt {{ x|default:"y" }} en {{ x }} door de voorbeeldwaarde, of anders door de default. */
function vulIn(html) {
  return html
    .replace(/\{\{\s*([a-z_.]+)\s*\|\s*default:\s*"([^"]*)"\s*\}\}/gi, (_, sleutel, def) => VOORBEELD[sleutel] ?? def)
    .replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, sleutel) => VOORBEELD[sleutel] ?? '')
    .replace(/\{%\s*unsubscribe\s*%\}/gi, '#uitschrijven')
    .replace(/\{%\s*manage_preferences\s*%\}/gi, '#voorkeuren');
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const bestanden = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
  const browser = await chromium.launch({ headless: true });

  const varianten = [
    { naam: 'desktop-licht', breedte: 700, schema: 'light' },
    { naam: 'desktop-donker', breedte: 700, schema: 'dark' },
    { naam: 'mobiel-licht', breedte: 390, schema: 'light' },
    { naam: 'mobiel-donker', breedte: 390, schema: 'dark' },
  ];

  for (const bestand of bestanden) {
    const naam = bestand.replace('.html', '');
    const gevuld = vulIn(fs.readFileSync(path.join(DIST, bestand), 'utf8'));
    const tijdelijk = path.join(SHOTS, naam + '.preview.html');
    fs.writeFileSync(tijdelijk, gevuld);

    for (const v of varianten) {
      const ctx = await browser.newContext({
        viewport: { width: v.breedte, height: 1000 },
        colorScheme: v.schema,
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.goto('file://' + tijdelijk);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SHOTS, `${naam}__${v.naam}.png`), fullPage: true });
      await ctx.close();
    }
    console.log(`${naam}: 4 previews`);
  }

  await browser.close();
  console.log(`\nScreenshots in ${SHOTS}`);
  process.exit(0);
})().catch((e) => { console.error('FOUT: ' + (e.message || e)); process.exit(1); });
