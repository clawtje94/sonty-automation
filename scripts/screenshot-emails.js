const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'emails');
const OUTPUT_DIR = path.join(__dirname, 'email-previews');

const vars = {
  '{{voornaam}}': 'Daimy',
  '{{product}}': 'Screens',
  '{{prijsindicatie}}': '€ 1.850',
  '{{configurator_link}}': 'https://sonty.nl/configurator/demo',
  '{{datum}}': 'Donderdag 13 maart 2026',
  '{{tijdslot}}': '10:00 - 12:00',
  '{{adres}}': 'Keizersgracht 123, 1015 Amsterdam',
  '{{offertebedrag}}': '€ 2.450',
  '{{offerte_link}}': 'https://sonty.nl/offerte/demo',
  '{{geldig_tot}}': '27 maart 2026',
  '{{aanbetalingsbedrag}}': '€ 1.225',
  '{{factuur_link}}': 'https://sonty.nl/factuur/demo',
  '{{betaal_link}}': 'https://sonty.nl/betaal/demo',
  '{{levertijd}}': '2-3 weken',
  '{{google_review_link}}': 'https://g.page/r/sonty/review',
};

function replaceVars(html) {
  let result = html;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
  }
  // Strip HTML comments
  return result.replace(/<!--[\s\S]*?-->/g, '');
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.html')).sort();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8');
    const html = replaceVars(raw);

    // Wrap in a full HTML page with white background for email preview
    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;padding:40px;background:#e5e5e5;display:flex;justify-content:center;}</style>
</head><body>${html}</body></html>`;

    const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const name = file.replace('.html', '.png');
    await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage: true });
    console.log(`  ✅ ${name}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nKlaar! ${files.length} screenshots in ${OUTPUT_DIR}`);
})();
