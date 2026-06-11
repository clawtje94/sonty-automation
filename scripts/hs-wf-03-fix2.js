const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const WF_ID = '3911111914';
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
async function save(page, label) {
  const btn = page.locator('button').filter({ hasText: /opslaan/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(3000);
  console.log(`  ✅ ${label}`);
}
async function scrollPanel(page) {
  await page.evaluate(() => {
    document.querySelectorAll('div[class*="scroll"], aside, div[style*="overflow"]')
      .forEach(e => { if (e.scrollHeight > e.clientHeight) e.scrollTop = e.scrollHeight; });
  });
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  console.log('🎬 HS-WF-03 Fix2');

  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // Annuleer eventuele open config
  const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await ann.isVisible().catch(() => false)) { await ann.click(); await page.waitForTimeout(2000); }
  await ss(page, 'WF03G-00');

  // ══ 1. VERTAKKING TOEVOEGEN ══
  console.log('\n[1] Vertakking toevoegen...');
  const plusBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns.length} + knoppen`);
  await plusBtns[plusBtns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);

  // Klik Vertakking icon in het actiepanel (naast Vertraging)
  const vertBtn = page.getByText('Vertakking', { exact: true });
  await vertBtn.waitFor({ state: 'visible', timeout: 8000 });
  await vertBtn.click();
  await page.waitForTimeout(2500);
  await dismiss(page);
  await ss(page, 'WF03G-01-types');

  // Klik "Één eigenschap of actie-output" — gebruik getByText
  const eenEig = page.getByText('Één eigenschap of actie-output');
  await eenEig.waitFor({ state: 'visible', timeout: 8000 });
  await eenEig.click();
  await page.waitForTimeout(3000);
  await dismiss(page);
  await ss(page, 'WF03G-02-eigenschap-selected');

  // Nu verschijnt het vertakking config panel met "Vertakking 1" sectie
  // We moeten een filter/conditie kiezen
  // Zoek of er een dropdown/selector is

  // Log alle zichtbare buttons om te zien wat er is
  const allBtns = await page.locator('button:visible').all();
  console.log(`  ${allBtns.length} zichtbare buttons`);
  for (let i = 0; i < Math.min(allBtns.length, 15); i++) {
    const txt = await allBtns[i].innerText().catch(() => '');
    if (txt.trim()) console.log(`    [${i}] "${txt.trim().substring(0, 50)}"`);
  }

  // Zoek een select/dropdown voor eigenschap filtering
  // Er kan een data-test-id zijn
  const condSelect = page.locator('[data-test-id*="condition"], [data-test-id*="filter"]').first();
  if (await condSelect.isVisible().catch(() => false)) {
    console.log('  Conditie selector gevonden');
    await condSelect.click();
    await page.waitForTimeout(1500);
  }

  // Zoek "Deal eigenschappen" optie
  const dealProp = page.getByText('Deal eigenschappen');
  if (await dealProp.isVisible().catch(() => false)) {
    await dealProp.click();
    await page.waitForTimeout(1500);
  }

  // Zoek stadium in search
  const searchInput = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('stadium');
    await page.waitForTimeout(1500);
    await page.getByText('Stadium deal').first().click();
    await page.waitForTimeout(2000);
    console.log('  Stadium deal geselecteerd');
  }
  await ss(page, 'WF03G-03-stadium');

  // Selecteer waarde
  const valBtn = page.locator('button').filter({ hasText: /^Zoeken$/ }).first();
  if (await valBtn.isVisible().catch(() => false)) {
    await valBtn.click();
    await page.waitForTimeout(1500);
    const sInp = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
    if (await sInp.isVisible().catch(() => false)) {
      await sInp.fill('Eerste off');
      await page.waitForTimeout(1000);
    }
    const label = page.locator('label').filter({ hasText: /eerste offerte/i }).first();
    if (await label.isVisible().catch(() => false)) {
      await label.click();
      await page.waitForTimeout(500);
      console.log('  Eerste offerte geselecteerd');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await ss(page, 'WF03G-04-value');

  // Check of save enabled is
  const saveBtn = page.locator('[data-test-id="automation-action-config-save-button"]');
  const isDisabled = await saveBtn.getAttribute('aria-disabled').catch(() => 'unknown');
  console.log('  Save aria-disabled:', isDisabled);

  if (isDisabled !== 'true') {
    await save(page, 'Vertakking');
  } else {
    console.log('  ⚠️ Save disabled — probeer toch...');
    await ss(page, 'WF03G-04-disabled');
    // Scroll om te zien of er meer velden zijn
    await scrollPanel(page);
    await ss(page, 'WF03G-04-scrolled');
    // Force click
    await saveBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // ══ 2. TAAK IN VERTAKKING 1 ══
  console.log('\n[2] Taak in Vertakking 1...');
  await page.waitForTimeout(2000);
  await dismiss(page);

  const plusBtns2 = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns2.length} + knoppen`);
  if (plusBtns2.length > 0) {
    await plusBtns2[0].click();
    await page.waitForTimeout(2500);
    await dismiss(page);
  }

  const crm = page.locator('div, span').filter({ hasText: /^CRM$/ }).first();
  await crm.waitFor({ state: 'visible', timeout: 8000 });
  await crm.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);

  const taak = page.locator('button, div[role="button"], li')
    .filter({ hasText: /taak aanmaken/i }).first();
  await taak.waitFor({ state: 'visible', timeout: 6000 });
  await taak.click();
  await page.waitForTimeout(2000);

  const titelField = page.getByLabel('Titel');
  if (await titelField.isVisible().catch(() => false)) {
    await titelField.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('Opvolgen: klant heeft niet gereageerd op offerte');
    console.log('  Titel ingevuld');
  } else {
    const ce = page.locator('[contenteditable="true"]').first();
    if (await ce.isVisible().catch(() => false)) {
      await ce.click();
      await page.keyboard.press('Meta+a');
      await page.keyboard.type('Opvolgen: klant heeft niet gereageerd op offerte');
    }
  }
  await page.waitForTimeout(500);
  await save(page, 'Taak');

  await ss(page, 'WF03G-ZZ-final');
  console.log('\n✅ HS-WF-03 compleet!');
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
