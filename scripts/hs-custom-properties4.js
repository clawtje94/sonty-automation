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

  // 1. DETAILS — Label invullen + blur om te valideren
  const labelInput = page.locator('input:visible').first();
  await labelInput.waitFor({ state: 'visible', timeout: 10000 });
  await labelInput.click();
  await labelInput.fill(prop.label);
  // Tab uit het veld om blur te triggeren
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1500);

  // Beschrijving
  const textarea = page.locator('textarea:visible').first();
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill(prop.desc);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
  }
  console.log(`  Label + beschrijving ingevuld`);

  // Check of Details tab nog een fout heeft
  await ss(page, `P4-${prop.label.substring(0, 8)}-details`);

  // 2. VELDTYPE TAB
  await page.getByText('Veldtype', { exact: true }).click();
  await page.waitForTimeout(2000);

  // Klik de veldtype dropdown (toont "Eén regel met tekst")
  const fieldTypeDD = page.locator('button, [role="button"]')
    .filter({ hasText: /Eén regel met tekst|regel.*tekst|Datumkiezer|Dropdown/i }).first();
  await fieldTypeDD.waitFor({ state: 'visible', timeout: 8000 });
  await fieldTypeDD.click();
  await page.waitForTimeout(1500);

  // Selecteer het juiste type uit de dropdown opties
  const typeOpt = page.locator('[role="option"], li, div[role="menuitem"]')
    .filter({ hasText: new RegExp(prop.fieldType, 'i') }).first();
  await typeOpt.waitFor({ state: 'visible', timeout: 5000 });
  await typeOpt.click();
  await page.waitForTimeout(1500);
  console.log(`  Type: ${prop.fieldType}`);

  // Als dropdown: opties toevoegen
  if (prop.options) {
    await page.waitForTimeout(1000);
    // Er verschijnen optie velden
    for (let i = 0; i < prop.options.length; i++) {
      const opt = prop.options[i];
      // Zoek lege input velden voor opties
      const optInputs = await page.locator('input[type="text"]:visible').all();
      let filled = false;
      for (const inp of optInputs) {
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
        // Klik "optie toevoegen"
        const addBtn = page.locator('button, a').filter({ hasText: /optie toevoegen|voeg.*toe/i }).first();
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

  await ss(page, `P4-${prop.label.substring(0, 8)}-veldtype`);

  // 3. AANMAKEN — force click als disabled
  const createBtn = page.locator('button').filter({ hasText: /^Aanmaken$/ }).first();
  const isDisabled = await createBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true').catch(() => true);
  console.log(`  Aanmaken disabled: ${isDisabled}`);

  if (isDisabled) {
    // Ga terug naar Details om te zien wat het probleem is
    await page.getByText('Details', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await ss(page, `P4-${prop.label.substring(0, 8)}-details-check`);

    // Misschien moet het label opnieuw worden ingevuld
    const labelInput2 = page.locator('input:visible').first();
    const currentVal = await labelInput2.inputValue().catch(() => '');
    console.log(`  Huidig label: "${currentVal}"`);
    if (!currentVal) {
      await labelInput2.fill(prop.label);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);
    }

    // Probeer nu aanmaken
    const createBtn2 = page.locator('button').filter({ hasText: /^Aanmaken$/ }).first();
    await createBtn2.click({ force: true });
    await page.waitForTimeout(3000);
  } else {
    await createBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check of het gelukt is
  const url = page.url();
  if (!url.includes('action=create')) {
    console.log(`  ✅ ${prop.label} aangemaakt!`);
  } else {
    console.log(`  ⚠️ Mogelijk niet aangemaakt, URL nog steeds create`);
  }
  await ss(page, `P4-${prop.label.substring(0, 8)}-done`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Custom Properties v4');

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
