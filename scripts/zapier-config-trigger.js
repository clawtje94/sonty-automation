const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP configuratie — trigger instellen');

  // Open de zap
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(5000);
  await ss(page, 'TRIG-01');

  // Zoek de "Deal Pipeline" dropdown en selecteer "Sonty Verkooppijplijn"
  const pipelineDD = page.locator('[role="combobox"], select, button').filter({ hasText: /Choose value|pipeline/i }).first()
    .or(page.locator('input[placeholder*="Choose"]').first());

  // Dump alle interactieve elementen in het configuratiepanel
  const formElements = await page.evaluate(() => {
    const panel = document.querySelector('[class*="panel"], aside') || document.body;
    const elements = [];
    // Comboboxes
    panel.querySelectorAll('[role="combobox"]').forEach(el => {
      elements.push({ type: 'combobox', text: el.innerText?.substring(0, 50), ariaLabel: el.getAttribute('aria-label') });
    });
    // Selects
    panel.querySelectorAll('select').forEach(el => {
      elements.push({ type: 'select', name: el.name, options: Array.from(el.options).map(o => o.text).slice(0, 5) });
    });
    // Inputs
    panel.querySelectorAll('input:not([type="hidden"])').forEach(el => {
      elements.push({ type: 'input', inputType: el.type, placeholder: el.placeholder, value: el.value?.substring(0, 30) });
    });
    // Buttons
    panel.querySelectorAll('button').forEach(el => {
      const t = el.innerText?.trim();
      if (t && t.length < 60) elements.push({ type: 'button', text: t });
    });
    return elements;
  });
  console.log('Form elements:');
  for (const el of formElements) {
    console.log(`  ${JSON.stringify(el)}`);
  }

  // Probeer de pipeline dropdown te openen
  // Zoek input met "Choose value" placeholder bij "Deal Pipeline"
  const inputs = await page.locator('input[placeholder*="Choose"]').all();
  console.log(`\nChoose inputs: ${inputs.length}`);
  for (let i = 0; i < inputs.length; i++) {
    const ph = await inputs[i].getAttribute('placeholder').catch(() => '');
    const val = await inputs[i].inputValue().catch(() => '');
    console.log(`  [${i}] placeholder="${ph}" value="${val}"`);
  }

  // Klik op de eerste "Choose value" input (Deal Pipeline)
  if (inputs.length >= 1) {
    await inputs[0].click();
    await page.waitForTimeout(3000);
    console.log('  Pipeline dropdown geopend');

    // Zoek "Sonty Verkooppijplijn" in de opties
    const options = await page.locator('[role="option"]').all();
    console.log(`  Opties: ${options.length}`);
    for (const opt of options) {
      const t = await opt.innerText().catch(() => '');
      console.log(`    "${t.substring(0, 60)}"`);
    }

    // Selecteer Sonty Verkooppijplijn
    const sontyOpt = page.locator('[role="option"]').filter({ hasText: /Sonty Verkooppijplijn/i }).first();
    if (await sontyOpt.isVisible().catch(() => false)) {
      await sontyOpt.click();
      console.log('  ✅ Sonty Verkooppijplijn geselecteerd');
      await page.waitForTimeout(3000);
    }

    // Nu de Deal Stage dropdown
    if (inputs.length >= 2) {
      await inputs[1].click();
      await page.waitForTimeout(3000);
      console.log('  Stage dropdown geopend');

      const stageOptions = await page.locator('[role="option"]').all();
      console.log(`  Stage opties: ${stageOptions.length}`);
      for (const opt of stageOptions) {
        const t = await opt.innerText().catch(() => '');
        console.log(`    "${t.substring(0, 60)}"`);
      }
    }
  }

  await ss(page, 'TRIG-02');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
