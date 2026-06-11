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
  console.log('🎬 ZAP trigger configureren');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik op trigger stap
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(5000);

  // Klik op "Configure" tab als die er is
  const configTab = page.locator('button, [role="tab"]').filter({ hasText: /^Configure$/ }).first();
  if (await configTab.isVisible().catch(() => false)) {
    await configTab.click();
    await page.waitForTimeout(3000);
    console.log('  Configure tab geklikt');
  }

  // Deal Pipeline dropdown — klik op "Choose value..." bij Pipeline
  // De dropdowns zijn waarschijnlijk custom divs met role="combobox"
  const pipelineField = page.getByText('Deal Pipeline').first();
  await pipelineField.waitFor({ timeout: 10000 });

  // Klik op het dropdown element NA "Deal Pipeline" label
  // Zoek de "Choose value..." bij pipeline
  const allComboboxes = await page.locator('[role="combobox"]:visible').all();
  console.log(`  Comboboxes: ${allComboboxes.length}`);

  // Als er geen comboboxes zijn, zoek naar custom dropdown triggers
  if (allComboboxes.length === 0) {
    // Klik op het "Choose value..." tekst element
    const chooseValues = await page.getByText('Choose value...').all();
    console.log(`  "Choose value..." elementen: ${chooseValues.length}`);

    if (chooseValues.length >= 1) {
      // Eerste is pipeline
      await chooseValues[0].click();
      await page.waitForTimeout(3000);
      console.log('  Pipeline dropdown geopend');
      await ss(page, 'TRIG2-01-pipeline-open');

      // Zoek opties
      const options = await page.locator('[role="option"]:visible, [class*="option"]:visible, li:visible').all();
      console.log(`  Opties zichtbaar: ${options.length}`);

      // Dump alle zichtbare tekst die op een optie lijkt
      const dropdownText = await page.evaluate(() => {
        // Look for dropdown/listbox/menu elements
        const lists = document.querySelectorAll('[role="listbox"], [role="menu"], ul, [class*="dropdown"], [class*="menu"]');
        const texts = [];
        for (const list of lists) {
          if (list.offsetParent !== null) {
            texts.push(`${list.tagName}[${list.getAttribute('role') || list.className?.substring(0,30)}]: ${list.innerText?.substring(0, 300)}`);
          }
        }
        return texts;
      });
      console.log('  Dropdown content:');
      for (const t of dropdownText) console.log(`    ${t}`);

      // Probeer ook [role="option"]
      const roleOptions = await page.locator('[role="option"]').all();
      console.log(`  role="option" elementen: ${roleOptions.length}`);
      for (const opt of roleOptions.slice(0, 10)) {
        const t = await opt.innerText().catch(() => '');
        const vis = await opt.isVisible().catch(() => false);
        console.log(`    "${t.substring(0, 50)}" visible=${vis}`);
      }
    }
  } else {
    // Klik eerste combobox (pipeline)
    await allComboboxes[0].click();
    await page.waitForTimeout(3000);
    console.log('  Combobox[0] geklikt');
    const options = await page.locator('[role="option"]').all();
    console.log(`  Opties: ${options.length}`);
    for (const opt of options.slice(0, 10)) {
      const t = await opt.innerText().catch(() => '');
      console.log(`    "${t.substring(0, 50)}"`);
    }
  }

  await ss(page, 'TRIG2-02');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
