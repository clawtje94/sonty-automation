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
// De veldnamen komen exact overeen met wat klaviyo-profielen.js in Klaviyo zet. Wijkt dit af,
// dan ziet een preview er goed uit terwijl de echte mail lege plekken heeft; dat gebeurde in de
// ronde van 27 juli, waarin de offertekaart in de preview leeg bleef.
const VOORBEELD = {
  'first_name': 'Marleen',
  'person.sonty_aanhef': 'Hoi Marleen,',
  'person.sonty_product': 'Zip Design 110 zipscreens (2x, solar)',
  'person.sonty_product_kort': 'screens',
  'person.sonty_offertenummer': '20269576',
  'person.sonty_geldig_tot': '3 augustus 2026',
  'person.sonty_geldigheid_label': 'Geldig tot',
  'person.sonty_geldigheid_waarde': '3 augustus 2026',
  'person.sonty_bedrag': '€ 4.500,00',
  'person.sonty_offerte_datum_nl': '21 juli 2026',
  'person.sonty_offerte_link': 'https://www.sonty.nl/offerte',  // klikbaar in testmails; echte klantlink komt uit het profiel
  'person.sonty_showroom_link': 'https://www.sonty.nl/showroom',
  'person.sonty_verhaal_kop': 'Je zocht ooit een knikarmscherm',
  'person.sonty_verhaal_intro': 'Is het er destijds nooit van gekomen? Dat gebeurt vaker dan je denkt. Even laten zien wat er nu mogelijk is, en wat het tegenwoordig kost.',
  'person.sonty_verhaal_cta': 'Bekijk wat het nu kost',
  'person.sonty_verhaal_link': 'https://www.sonty.nl',
  'person.sonty_service_cta': 'Laat het ons weten',
  'person.sonty_service_link': 'https://www.sonty.nl/contact',
};

// Per productvariant een passende voorbeeldklant (Daimy 18-08: previews toonden overal
// "screens" omdat de vaste voorbeeldklant dat product had; dat wekte de indruk dat de
// variabelen fout stonden terwijl Klaviyo per klant het echte product invult).
const VARIANT_VOORBEELD = {
  knikarm: { 'person.sonty_product': 'Suneye 500 knikarmscherm (1x, motor)', 'person.sonty_product_kort': 'een knikarmscherm' },
  rolluiken: { 'person.sonty_product': 'Roma voorzetrolluiken (3x, solar)', 'person.sonty_product_kort': 'rolluiken' },
  pergola: { 'person.sonty_product': 'Pergola 4x3m met zijscreens', 'person.sonty_product_kort': 'een pergola' },
  markies: { 'person.sonty_product': 'Markies 180cm (2x)', 'person.sonty_product_kort': 'een markies' },
  binnen: { 'person.sonty_product': 'Plisse en duo-rolgordijnen (5x)', 'person.sonty_product_kort': 'raamdecoratie' },
};
function voorbeeldVoor(naam) {
  for (const [kern, extra] of Object.entries(VARIANT_VOORBEELD)) {
    if (naam.includes(kern)) return { ...VOORBEELD, ...extra };
  }
  return VOORBEELD;
}

/** Vervangt {{ x|default:"y" }} en {{ x }} door de voorbeeldwaarde, of anders door de default. */
function vulIn(html, waarden = VOORBEELD) {
  return html
    .replace(/\{\{\s*([a-z_.]+)\s*\|\s*default:\s*"([^"]*)"\s*\}\}/gi, (_, sleutel, def) => waarden[sleutel] ?? def)
    .replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, sleutel) => waarden[sleutel] ?? '')
    .replace(/\{%\s*unsubscribe\s*%\}/gi, 'https://www.sonty.nl/#uitschrijven-test')
    .replace(/\{%\s*manage_preferences\s*%\}/gi, 'https://www.sonty.nl/#voorkeuren-test');
}

const ALLEEN_HTML = process.argv.includes('--alleen-html');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const bestanden = fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
  if (ALLEEN_HTML) {
    for (const bestand of bestanden) {
      const gevuld = vulIn(fs.readFileSync(path.join(DIST, bestand), 'utf8'), voorbeeldVoor(bestand));
      fs.writeFileSync(path.join(SHOTS, bestand.replace('.html', '.preview.html')), gevuld);
    }
    console.log(bestanden.length + ' preview-htmls ververst (zonder screenshots)');
    process.exit(0);
  }
  const browser = await chromium.launch({ headless: true });

  const varianten = [
    { naam: 'desktop-licht', breedte: 700, schema: 'light' },
    { naam: 'desktop-donker', breedte: 700, schema: 'dark' },
    { naam: 'mobiel-licht', breedte: 390, schema: 'light' },
    { naam: 'mobiel-donker', breedte: 390, schema: 'dark' },
  ];

  for (const bestand of bestanden) {
    const naam = bestand.replace('.html', '');
    const gevuld = vulIn(fs.readFileSync(path.join(DIST, bestand), 'utf8'), voorbeeldVoor(bestand));
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
