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
    document.querySelectorAll('[class*="alert-"]').forEach(e => e.remove());
  });
}

const PROPERTIES = [
  {
    name: 'sonty_call_attempt_1_date',
    label: 'Belpoging 1 datum',
    type: 'date',       // Datumkiezer
    group: 'deal',
    description: 'Datum van de eerste belpoging'
  },
  {
    name: 'sonty_call_attempt_2_date',
    label: 'Belpoging 2 datum',
    type: 'date',
    group: 'deal',
    description: 'Datum van de tweede belpoging'
  },
  {
    name: 'sonty_call_outcome',
    label: 'Belresultaat',
    type: 'select',     // Dropdown
    group: 'deal',
    description: 'Resultaat van de belpogingen',
    options: ['Bereikt', 'Niet bereikt', 'Voicemail', 'Terugbelverzoek', 'Geen interesse']
  },
  {
    name: 'sonty_first_quote_date',
    label: 'Eerste offerte datum',
    type: 'date',
    group: 'deal',
    description: 'Datum waarop de eerste offerte is verzonden'
  },
  {
    name: 'sonty_measurement_date',
    label: 'Opmetingsdatum',
    type: 'date',
    group: 'deal',
    description: 'Datum van de opmeting'
  }
];

async function createProperty(page, prop) {
  console.log(`\n[${prop.label}] Aanmaken...`);

  // Ga naar deal properties settings
  await page.goto(
    `https://app-eu1.hubspot.com/property-settings/${PORTAL_ID}/properties?type=0-3&action=create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(4000);
  await dismiss(page);
  await ss(page, `PROP-${prop.name}-01`);

  // Er verschijnt een "Eigenschap aanmaken" formulier
  // Groep: laat default of kies "Deal informatie"
  // Label invullen
  const labelInput = page.locator('input[data-test-id="property-input-label"], input[name="label"]').first();
  if (await labelInput.isVisible().catch(() => false)) {
    await labelInput.fill(prop.label);
    await page.waitForTimeout(500);
    console.log(`  Label: ${prop.label}`);
  } else {
    // Fallback: zoek eerste tekst input
    const inputs = await page.locator('input[type="text"]:visible').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph && ph.toLowerCase().includes('label')) {
        await inp.fill(prop.label);
        break;
      }
    }
    // Als geen placeholder match, gebruik eerste input
    if (inputs.length > 0) {
      await inputs[0].fill(prop.label);
    }
  }
  await page.waitForTimeout(1000);

  // Interne naam wordt automatisch gegenereerd, maar we willen onze eigen naam
  // Klik op "Interne naam bewerken" als beschikbaar
  const editInternalBtn = page.locator('button, a').filter({ hasText: /interne naam/i }).first();
  if (await editInternalBtn.isVisible().catch(() => false)) {
    await editInternalBtn.click();
    await page.waitForTimeout(500);
    const internalInput = page.locator('input[data-test-id="property-input-name"], input[name="name"]').first();
    if (await internalInput.isVisible().catch(() => false)) {
      await internalInput.fill(prop.name);
    }
  }

  // Type selecteren (Datumkiezer of Dropdown)
  if (prop.type === 'date') {
    // Zoek type dropdown
    const typeDD = page.locator('button, select, [role="combobox"]')
      .filter({ hasText: /tekst|type|veld/i }).first();
    if (await typeDD.isVisible().catch(() => false)) {
      await typeDD.click();
      await page.waitForTimeout(1000);
      const dateOpt = page.locator('[role="option"], li')
        .filter({ hasText: /datumkiezer|datum/i }).first();
      if (await dateOpt.isVisible().catch(() => false)) {
        await dateOpt.click();
        await page.waitForTimeout(500);
      }
    }
  } else if (prop.type === 'select') {
    const typeDD = page.locator('button, select, [role="combobox"]')
      .filter({ hasText: /tekst|type|veld/i }).first();
    if (await typeDD.isVisible().catch(() => false)) {
      await typeDD.click();
      await page.waitForTimeout(1000);
      const selectOpt = page.locator('[role="option"], li')
        .filter({ hasText: /dropdown|selectie|keuze/i }).first();
      if (await selectOpt.isVisible().catch(() => false)) {
        await selectOpt.click();
        await page.waitForTimeout(500);
      }
    }

    // Opties toevoegen
    if (prop.options) {
      for (const opt of prop.options) {
        const addOptBtn = page.locator('button').filter({ hasText: /optie toevoegen|add option/i }).first();
        if (await addOptBtn.isVisible().catch(() => false)) {
          await addOptBtn.click();
          await page.waitForTimeout(500);
          // Vul de laatste optie input
          const optInputs = await page.locator('input[placeholder*="label"], input[placeholder*="optie"]').all();
          if (optInputs.length > 0) {
            await optInputs[optInputs.length - 1].fill(opt);
            await page.waitForTimeout(300);
          }
        }
      }
    }
  }

  // Beschrijving
  const descInput = page.locator('textarea, input[name="description"]').first();
  if (await descInput.isVisible().catch(() => false)) {
    await descInput.fill(prop.description);
  }

  await ss(page, `PROP-${prop.name}-02`);

  // Aanmaken knop klikken
  const createBtn = page.locator('button').filter({ hasText: /aanmaken|opslaan|create/i }).last();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(3000);
    console.log(`  ✅ ${prop.label} aangemaakt`);
  }
  await ss(page, `PROP-${prop.name}-03`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Custom Properties aanmaken');

  for (const prop of PROPERTIES) {
    try {
      await createProperty(page, prop);
    } catch (e) {
      console.error(`  ❌ ${prop.label}: ${e.message.substring(0, 80)}`);
    }
  }

  console.log('\n✅ Custom properties klaar!');
  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
