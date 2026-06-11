const { chromium } = require('playwright');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}
async function dismissTrialGuide(page) {
  await page.evaluate(() => { const i = document.getElementById('mini-trial-guide-iframe'); if(i) i.remove(); });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  // ══ 1. WORKFLOW AANMAKEN ══
  console.log('[1] Workflow aanmaken...');
  await page.goto(`https://app-eu1.hubspot.com/workflows/${PORTAL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissTrialGuide(page);
  await page.locator('[data-test-id="create-workflow-dropdown"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByText('Vanaf nul').click();
  await page.waitForTimeout(4000);
  await dismissTrialGuide(page);

  // ══ 2. TRIGGER ══
  console.log('[2] Trigger: Deal → Nieuwe Lead...');
  await page.getByText('Voldoet aan filtercriteria').click();
  await page.waitForTimeout(2000);
  await page.getByText('Deal').first().click();
  await page.waitForTimeout(2000);
  await page.locator('[data-test-id="fr-condition-select"]').first().click();
  await page.waitForTimeout(1500);
  await page.getByText('Deal eigenschappen').click();
  await page.waitForTimeout(1500);
  await page.locator('input[placeholder*="oek"]').last().fill('stadium');
  await page.waitForTimeout(1500);
  await page.getByText('Stadium deal').first().click();
  await page.waitForTimeout(2000);
  const valueBtn = page.locator('button').filter({ hasText: /^Zoeken$/ }).first();
  await valueBtn.waitFor({ state: 'visible' });
  await valueBtn.click();
  await page.waitForTimeout(2500);
  const dropSearch = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
  if (await dropSearch.isVisible().catch(() => false)) { await dropSearch.fill('nieuwe'); await page.waitForTimeout(1500); }
  await page.locator('label').filter({ hasText: /nieuwe lead/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Groep 1').first().click();
  await page.waitForTimeout(1000);
  console.log('  ✅ Trigger ingesteld');

  // ══ 3. VOLGENDE (trigger → records) ══
  console.log('[3] Volgende stap...');
  await page.locator('button').filter({ hasText: 'Volgende' }).first().click();
  await page.waitForTimeout(2000);

  // ══ 4. OPSLAAN EN DOORGAAN → CANVAS ══
  console.log('[4] Opslaan en doorgaan naar canvas...');
  const saveAndContinue = page.locator('button').filter({ hasText: /opslaan en doorgaan/i }).first();
  await saveAndContinue.waitFor({ state: 'visible' });
  await saveAndContinue.click();
  await page.waitForTimeout(4000);
  await screenshot(page, 'CANVAS-1');
  console.log('  URL na canvas:', page.url());

  // ══ 5. NAAM INSTELLEN (nu in canvas) ══
  console.log('[5] Naam instellen...');
  // In canvas: klik het potlood naast "Workflow zonder naam"
  await page.locator('button[aria-label*="ijzigen"], [data-test-id*="name"] button, button[data-test-id*="edit"]').first().click().catch(async () => {
    await page.locator('[data-test-id="workflow-name-edit-button"]').first().click().catch(async () => {
      // Klik op de tekst + potlood icoon rechts ervan
      await page.locator('h1').first().click().catch(() => {});
    });
  });
  await page.waitForTimeout(500);
  const nameInput = page.locator('input[type="text"], input[placeholder*="naam"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill('HS-WF-01 Belpogingstaken');
    await nameInput.press('Enter');
    console.log('  ✅ Naam ingesteld');
  } else {
    console.log('  ⚠️ Naamveld niet gevonden, ga handmatig verder');
  }
  await page.waitForTimeout(1000);

  // ══ 6. ACTIE + ══
  console.log('[6] Actie toevoegen...');
  await screenshot(page, 'CANVAS-2');

  // Klik op het + icoon onder de trigger in het canvas
  // In HubSpot workflow canvas is dit meestal een knop met tekst "Actie toevoegen" of een + icoon
  const addBtn = page.locator('[data-test-id="add-action-button"], [aria-label*="ctie toevoegen"]').first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
  } else {
    // Hover over het canvas pad om + te zien
    await page.locator('[class*="add-step"], [class*="addStep"], [class*="AddAction"]').first().click().catch(async () => {
      // Zoek de "Einde" node en klik op de + erboven
      await page.getByText('Einde').first().hover();
      await page.waitForTimeout(500);
      await page.locator('button').filter({ hasText: /^\+$/ }).first().click().catch(() => {});
    });
  }
  await page.waitForTimeout(2000);
  await screenshot(page, 'ACTIE-MENU');

  // Log beschikbare acties
  const acties = await page.locator('li, [role="option"], button, div[role="button"]').allInnerTexts();
  const relevantActies = acties.filter(t => t.trim().length > 0 && t.trim().length < 50).slice(0, 20);
  console.log('  Beschikbare acties:', relevantActies);

  await page.waitForTimeout(3000);
  await browser.close();
})();
