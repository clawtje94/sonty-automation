const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const VIDEO_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

async function dismiss(page) {
  await page.evaluate(() => {
    document.getElementById('mini-trial-guide-iframe')?.remove();
    document.querySelectorAll('[class*="TrialGuide"], [class*="trial-guide"]').forEach(e => e.remove());
  });
}

const PROPERTIES = [
  { label: 'Belpoging 1 datum', fieldType: 'Datumkiezer', desc: 'Datum van de eerste belpoging' },
  { label: 'Belpoging 2 datum', fieldType: 'Datumkiezer', desc: 'Datum van de tweede belpoging' },
  { label: 'Belresultaat', fieldType: 'Dropdown selectie', desc: 'Resultaat van de belpogingen',
    options: ['Bereikt', 'Niet bereikt', 'Voicemail', 'Terugbelverzoek', 'Geen interesse'] },
  { label: 'Eerste offerte datum', fieldType: 'Datumkiezer', desc: 'Datum waarop de eerste offerte is verzonden' },
  { label: 'Opmetingsdatum', fieldType: 'Datumkiezer', desc: 'Datum van de opmeting' },
];

async function createProperty(page, prop) {
  console.log(`\n[${prop.label}]`);

  await page.goto(
    `https://app-eu1.hubspot.com/property-settings/${PORTAL_ID}/properties?type=0-3&action=create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // 1. Label via getByLabel
  const labelField = page.getByLabel('Eigenschapslabel');
  await labelField.waitFor({ state: 'visible', timeout: 10000 });
  await labelField.fill(prop.label);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);

  // 2. Beschrijving
  const descField = page.getByLabel('Beschrijving');
  if (await descField.isVisible().catch(() => false)) {
    await descField.fill(prop.desc);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
  }

  // 3. Veldtype tab
  await page.getByText('Veldtype', { exact: true }).click();
  await page.waitForTimeout(2000);

  // 4. Open type dropdown
  const dd = page.locator('button, [role="button"]').filter({ hasText: /Eén regel met tekst/i }).first();
  await dd.waitFor({ state: 'visible', timeout: 8000 });
  await dd.click();
  await page.waitForTimeout(1500);

  // 5. Selecteer type — gebruik het span[data-option-text] element in de dropdown
  const typeOpt = page.locator('span[data-option-text="true"]')
    .filter({ hasText: new RegExp(`^${prop.fieldType}$`, 'i') }).first();
  if (await typeOpt.isVisible().catch(() => false)) {
    await typeOpt.click();
  } else {
    // Fallback: role=button met de juiste naam
    await page.getByRole('button', { name: prop.fieldType }).click();
  }
  await page.waitForTimeout(1500);
  console.log(`  Type: ${prop.fieldType}`);

  // 6. Opties voor dropdown
  if (prop.options) {
    await page.waitForTimeout(1000);
    for (let i = 0; i < prop.options.length; i++) {
      const opt = prop.options[i];
      // Zoek lege inputs
      const inputs = await page.locator('input[type="text"]:visible').all();
      let filled = false;
      for (const inp of inputs) {
        const val = await inp.inputValue().catch(() => 'x');
        if (val === '') {
          await inp.fill(opt);
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
          filled = true;
          break;
        }
      }
      if (!filled) {
        const addBtn = page.locator('button').filter({ hasText: /optie toevoegen/i }).first();
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(500);
          const newInputs = await page.locator('input[type="text"]:visible').all();
          if (newInputs.length > 0) {
            await newInputs[newInputs.length - 1].fill(opt);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
          }
        }
      }
    }
    console.log(`  Opties: ${prop.options.join(', ')}`);
  }

  // 7. Aanmaken
  const createBtn = page.locator('button').filter({ hasText: /^Aanmaken$/ }).first();
  await createBtn.click({ force: true });
  await page.waitForTimeout(3000);

  const url = page.url();
  if (!url.includes('action=create')) {
    console.log(`  ✅ Aangemaakt!`);
    return true;
  }
  console.log(`  ⚠️ Nog op create pagina`);
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Properties aanmaken');

  const results = [];
  for (const prop of PROPERTIES) {
    try {
      const ok = await createProperty(page, prop);
      results.push(`${ok ? '✅' : '⚠️'} ${prop.label}`);
    } catch (e) {
      console.error(`  ❌ ${e.message.substring(0, 80)}`);
      results.push(`❌ ${prop.label}`);
      // Annuleer en ga door
      const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
      if (await ann.isVisible().catch(() => false)) await ann.click().catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  console.log('\n═══ RESULTAAT ═══');
  results.forEach(r => console.log(r));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
