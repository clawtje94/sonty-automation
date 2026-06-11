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
  console.log('🎬 Trigger instellen: Sonty Verkooppijplijn + Prijsindicatie Verstuurd');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Klik trigger
  await page.getByText('Updated Deal Stage').first().click();
  await page.waitForTimeout(3000);

  // Ga naar Configure tab
  const configTab = page.locator('button, [role="tab"]').filter({ hasText: /^Configure$/ }).first();
  if (await configTab.isVisible().catch(() => false)) {
    await configTab.click();
    await page.waitForTimeout(3000);
  }

  // Wacht tot de velden geladen zijn
  await page.waitForTimeout(3000);

  // STAP 1: Selecteer Pipeline
  const comboboxes = await page.locator('[role="combobox"]:visible').all();
  console.log(`  Comboboxes: ${comboboxes.length}`);

  if (comboboxes.length >= 1) {
    // Pipeline dropdown
    await comboboxes[0].click();
    await page.waitForTimeout(2000);

    const sontyPipe = page.locator('[role="option"]').filter({ hasText: /Sonty Verkooppijplijn/ }).first();
    if (await sontyPipe.isVisible().catch(() => false)) {
      await sontyPipe.click();
      console.log('  ✅ Sonty Verkooppijplijn geselecteerd');
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'SET-01-pipeline');

  // STAP 2: Selecteer Stage — wacht tot de stage dropdown geladen is
  // Na pipeline selectie laden de stages opnieuw
  await page.waitForTimeout(3000);

  // Herlaad comboboxes
  const comboboxes2 = await page.locator('[role="combobox"]:visible').all();
  console.log(`  Comboboxes na pipeline: ${comboboxes2.length}`);

  if (comboboxes2.length >= 2) {
    // Stage dropdown (2e combobox)
    await comboboxes2[1].click();
    await page.waitForTimeout(2000);

    // Dump stages
    const stageOpts = await page.locator('[role="option"]').all();
    console.log(`  Stage opties: ${stageOpts.length}`);
    for (const opt of stageOpts.slice(0, 20)) {
      const t = await opt.innerText().catch(() => '');
      console.log(`    "${t.substring(0, 60)}"`);
    }

    // Selecteer "Prijsindicatie Verstuurd" (stap 4 in nieuwe flow)
    const prijsStage = page.locator('[role="option"]').filter({ hasText: /Prijsindicatie Verstuurd/ }).first();
    if (await prijsStage.isVisible().catch(() => false)) {
      await prijsStage.click();
      console.log('  ✅ Prijsindicatie Verstuurd geselecteerd');
      await page.waitForTimeout(3000);
    } else {
      console.log('  ❌ Prijsindicatie Verstuurd niet gevonden');
      // Probeer andere namen
      const anyStage = page.locator('[role="option"]').first();
      if (await anyStage.isVisible().catch(() => false)) {
        const firstText = await anyStage.innerText().catch(() => '');
        console.log(`  Eerste beschikbare stage: "${firstText}"`);
      }
    }
  }

  await ss(page, 'SET-02-stage');

  // STAP 3: Klik Continue
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ }).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    console.log('  ✅ Continue geklikt');
    await page.waitForTimeout(5000);
    await ss(page, 'SET-03-after-continue');
  } else {
    console.log('  Geen Continue knop');
    // Check for other buttons
    const btns = await page.locator('button:visible').all();
    for (const btn of btns.slice(0, 15)) {
      const t = await btn.innerText().catch(() => '');
      if (t.trim() && t.trim().length < 40) console.log(`    btn: "${t.trim()}"`);
    }
  }

  // Dump huidige status
  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nStatus:', text.substring(0, 600));

  // Save
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
