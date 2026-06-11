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
  { label: 'Belpoging 1 datum', type: 'date', desc: 'Datum van de eerste belpoging' },
  { label: 'Belpoging 2 datum', type: 'date', desc: 'Datum van de tweede belpoging' },
  { label: 'Belresultaat', type: 'select', desc: 'Resultaat van de belpogingen',
    options: ['Bereikt', 'Niet bereikt', 'Voicemail', 'Terugbelverzoek', 'Geen interesse'] },
  { label: 'Eerste offerte datum', type: 'date', desc: 'Datum waarop de eerste offerte is verzonden' },
  { label: 'Opmetingsdatum', type: 'date', desc: 'Datum van de opmeting' },
];

async function createProperty(page, prop) {
  console.log(`\n[${prop.label}] Aanmaken...`);

  // Ga naar create property pagina voor deals
  await page.goto(
    `https://app-eu1.hubspot.com/property-settings/${PORTAL_ID}/properties?type=0-3&action=create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(4000);
  await dismiss(page);

  // Vul Eigenschapslabel in — het is de eerste zichtbare input op de pagina
  const labelInput = page.locator('input:visible').first();
  await labelInput.waitFor({ state: 'visible', timeout: 10000 });
  await labelInput.fill(prop.label);
  await page.waitForTimeout(1000);
  console.log(`  Label: ${prop.label}`);

  // Beschrijving
  const textarea = page.locator('textarea:visible').first();
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill(prop.desc);
    console.log(`  Beschrijving ingevuld`);
  }

  // Nu moeten we naar "Veldtype" tab klikken om het type in te stellen
  const veldtypeTab = page.getByText('Veldtype', { exact: true });
  if (await veldtypeTab.isVisible().catch(() => false)) {
    await veldtypeTab.click();
    await page.waitForTimeout(2000);
    await ss(page, `PROP-${prop.label.replace(/\s/g, '_')}-veldtype`);

    if (prop.type === 'date') {
      // Zoek "Datumkiezer" optie
      const dateOption = page.locator('button, div, label, [role="radio"], [role="option"]')
        .filter({ hasText: /datumkiezer|datum$/i }).first();
      if (await dateOption.isVisible().catch(() => false)) {
        await dateOption.click();
        await page.waitForTimeout(1000);
        console.log(`  Type: Datumkiezer`);
      } else {
        // Probeer dropdown
        const typeDD = page.locator('button, [role="combobox"]').filter({ hasText: /tekst|type|selecteer/i }).first();
        if (await typeDD.isVisible().catch(() => false)) {
          await typeDD.click();
          await page.waitForTimeout(1000);
          const opt = page.locator('[role="option"]').filter({ hasText: /datum/i }).first();
          if (await opt.isVisible().catch(() => false)) await opt.click();
        }
      }
    } else if (prop.type === 'select') {
      // Zoek "Dropdown selectie" of vergelijkbaar
      const selectOption = page.locator('button, div, label, [role="radio"], [role="option"]')
        .filter({ hasText: /dropdown|selectie|keuze/i }).first();
      if (await selectOption.isVisible().catch(() => false)) {
        await selectOption.click();
        await page.waitForTimeout(1000);
        console.log(`  Type: Dropdown`);
      }

      // Opties toevoegen
      if (prop.options) {
        await page.waitForTimeout(1000);
        for (const opt of prop.options) {
          // Zoek "optie toevoegen" link/knop
          const addBtn = page.locator('button, a').filter({ hasText: /optie toevoegen|add.*option/i }).first();
          if (await addBtn.isVisible().catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(500);
          }
          // Vul het laatste optie input veld
          const optInputs = await page.locator('input:visible').all();
          if (optInputs.length > 0) {
            await optInputs[optInputs.length - 1].fill(opt);
            await page.waitForTimeout(300);
          }
        }
        console.log(`  Opties: ${prop.options.join(', ')}`);
      }
    }
  }

  await ss(page, `PROP-${prop.label.replace(/\s/g, '_')}-filled`);

  // Klik "Aanmaken" knop (rechtsboven)
  const createBtn = page.locator('button').filter({ hasText: /^Aanmaken$/ }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(3000);
    console.log(`  ✅ ${prop.label} aangemaakt!`);
  } else {
    // Probeer force click op disabled knop
    const anyCreate = page.locator('button').filter({ hasText: /aanmaken/i }).first();
    await anyCreate.click({ force: true });
    await page.waitForTimeout(3000);
  }
  await ss(page, `PROP-${prop.label.replace(/\s/g, '_')}-done`);
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

  const results = [];
  for (const prop of PROPERTIES) {
    try {
      await createProperty(page, prop);
      results.push(`✅ ${prop.label}`);
    } catch (e) {
      console.error(`  ❌ ${prop.label}: ${e.message.substring(0, 80)}`);
      results.push(`❌ ${prop.label}: ${e.message.substring(0, 40)}`);
    }
  }

  console.log('\n═══ RESULTAAT ═══');
  results.forEach(r => console.log(r));

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
