const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const VIDEO_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}
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
  console.log(`\n[${prop.label}] Aanmaken...`);

  await page.goto(
    `https://app-eu1.hubspot.com/property-settings/${PORTAL_ID}/properties?type=0-3&action=create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(4000);
  await dismiss(page);

  // 1. DETAILS TAB — Label invullen
  const labelInput = page.locator('input:visible').first();
  await labelInput.waitFor({ state: 'visible', timeout: 10000 });
  await labelInput.fill(prop.label);
  await page.waitForTimeout(1000);
  console.log(`  Label: ${prop.label}`);

  // Beschrijving
  const textarea = page.locator('textarea:visible').first();
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill(prop.desc);
  }

  // 2. VELDTYPE TAB
  await page.getByText('Veldtype', { exact: true }).click();
  await page.waitForTimeout(2000);

  // Klik de "Eén regel met tekst" dropdown
  const fieldTypeDD = page.locator('button, [role="button"]')
    .filter({ hasText: /Eén regel met tekst|regel.*tekst/i }).first();
  await fieldTypeDD.waitFor({ state: 'visible', timeout: 8000 });
  await fieldTypeDD.click();
  await page.waitForTimeout(1500);
  await ss(page, `PROP3-${prop.label.substring(0, 10)}-dropdown`);

  // Selecteer het juiste type
  const typeOpt = page.locator('[role="option"], li')
    .filter({ hasText: new RegExp(prop.fieldType, 'i') }).first();
  await typeOpt.waitFor({ state: 'visible', timeout: 5000 });
  await typeOpt.click();
  await page.waitForTimeout(1500);
  console.log(`  Type: ${prop.fieldType}`);

  // Als dropdown: opties toevoegen
  if (prop.options) {
    await page.waitForTimeout(1000);
    for (let i = 0; i < prop.options.length; i++) {
      const opt = prop.options[i];
      // Er is waarschijnlijk al één optie-input zichtbaar, of we moeten "optie toevoegen" klikken
      if (i > 0) {
        const addBtn = page.locator('button, a').filter({ hasText: /optie toevoegen|voeg.*optie/i }).first();
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(500);
        }
      }
      // Vul de optie inputs — ze zijn waarschijnlijk type="text" inputs in een lijst
      const optInputs = await page.locator('input[type="text"]:visible').all();
      // De laatste input is de nieuwste optie
      if (optInputs.length > 0) {
        const lastInput = optInputs[optInputs.length - 1];
        const val = await lastInput.inputValue().catch(() => '');
        if (!val) {
          await lastInput.fill(opt);
          await page.waitForTimeout(300);
        }
      }
    }
    console.log(`  Opties: ${prop.options.join(', ')}`);
  }

  await ss(page, `PROP3-${prop.label.substring(0, 10)}-ready`);

  // 3. AANMAKEN
  const createBtn = page.locator('button').filter({ hasText: /^Aanmaken$/ }).first();
  await createBtn.waitFor({ state: 'visible', timeout: 5000 });
  await createBtn.click();
  await page.waitForTimeout(3000);
  console.log(`  ✅ ${prop.label} aangemaakt!`);
  await ss(page, `PROP3-${prop.label.substring(0, 10)}-done`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Custom Properties aanmaken v3');

  const results = [];
  for (const prop of PROPERTIES) {
    try {
      await createProperty(page, prop);
      results.push(`✅ ${prop.label}`);
    } catch (e) {
      console.error(`  ❌ ${prop.label}: ${e.message.substring(0, 100)}`);
      results.push(`❌ ${prop.label}`);
    }
  }

  console.log('\n═══ RESULTAAT ═══');
  results.forEach(r => console.log(r));

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
