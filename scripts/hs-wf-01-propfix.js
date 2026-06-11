const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const WF_ID = '3911097543';
const VIDEO_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}
async function dismiss(page) {
  await page.evaluate(() => {
    document.getElementById('mini-trial-guide-iframe')?.remove();
  });
}

async function fixRecordBewerken(page, actionNumber, pipelineStage) {
  console.log(`\n[Fix] Actie ${actionNumber} → ${pipelineStage}...`);

  // Klik op de actie kaart met "Record bewerken" en "Wijzigingen vereist"
  const cards = await page.locator('div').filter({ hasText: new RegExp(`${actionNumber}\\. Record bewerken`) }).all();
  for (const card of cards) {
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(2000);
      break;
    }
  }
  await ss(page, `FP-${actionNumber}-open`);

  // Klik het "Een eigenschap keizen" dropdown
  const propDD = page.locator('button').filter({ hasText: /een eigenschap keizen/i }).first();
  if (await propDD.isVisible().catch(() => false)) {
    await propDD.click();
    await page.waitForTimeout(1500);

    // Zoek "dealpijplijn" in de dropdown
    const searchInput = page.locator('input[placeholder*="oeken"], input[placeholder*="Zoek"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('dealpijplijn');
      await page.waitForTimeout(1000);
    }

    // Klik "Dealpijplijn en -fase"
    const propOpt = page.locator('li, div, button, [role="option"]')
      .filter({ hasText: /dealpijplijn/i }).first();
    await propOpt.waitFor({ state: 'visible', timeout: 5000 });
    await propOpt.click();
    await page.waitForTimeout(2000);
    await ss(page, `FP-${actionNumber}-prop-selected`);

    // Nu verschijnt de pijplijn + fase selectie
    // Zoek de pijplijn dropdown en selecteer "Sonty Verkooppijplijn"
    const pipeDD = page.locator('button, select, [role="combobox"]')
      .filter({ hasText: /pijplijn|pipeline|selecteer/i }).first();
    if (await pipeDD.isVisible().catch(() => false)) {
      await pipeDD.click();
      await page.waitForTimeout(1000);
      const sontyOpt = page.locator('[role="option"], li, option')
        .filter({ hasText: /sonty/i }).first();
      if (await sontyOpt.isVisible().catch(() => false)) {
        await sontyOpt.click();
        await page.waitForTimeout(1000);
      }
    }

    // Zoek de fase/stadium dropdown en selecteer de juiste fase
    const stageDD = page.locator('button, select, [role="combobox"]')
      .filter({ hasText: /fase|stadium|selecteer.*fase/i }).first();
    if (await stageDD.isVisible().catch(() => false)) {
      await stageDD.click();
      await page.waitForTimeout(1000);
      const stageOpt = page.locator('[role="option"], li, option')
        .filter({ hasText: new RegExp(pipelineStage, 'i') }).first();
      if (await stageOpt.isVisible().catch(() => false)) {
        await stageOpt.click();
        await page.waitForTimeout(500);
      }
    }

    await ss(page, `FP-${actionNumber}-filled`);
  }

  // Opslaan
  const saveBtn = page.locator('button').filter({ hasText: /opslaan/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log(`  ✅ Actie ${actionNumber} → ${pipelineStage}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Property fix gestart');

  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'FP-00');

  // Fix actie 3: Record bewerken → Belpoging 1
  await fixRecordBewerken(page, 3, 'Belpoging 1');

  // Fix actie 6: Record bewerken → Belpoging 2
  await fixRecordBewerken(page, 6, 'Belpoging 2');

  await ss(page, 'FP-ZZ-final');
  console.log('\n✅ Property fix compleet!');

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
