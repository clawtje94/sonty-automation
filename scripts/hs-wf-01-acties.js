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

async function dismissTrialGuide(page) {
  await page.evaluate(() => {
    const i = document.getElementById('mini-trial-guide-iframe');
    if (i) i.remove();
  });
  // Sluit ook de trial sidebar als die open is
  const closeBtn = page.locator('button[aria-label*="lose"], button[aria-label*="luiten"], button[data-test-id*="close"]')
    .filter({ hasText: '' }).first();
  // Zoek specifiek de × knop van de Trial-handleiding sidebar
  const trialClose = page.locator('[class*="trial"] button, [class*="Trial"] button, [data-key*="trial"] button').first();
  if (await trialClose.isVisible().catch(() => false)) {
    await trialClose.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

// Log alle knoppen en hun attributen voor debugging
async function debugButtons(page, label) {
  const info = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim().substring(0, 40),
      testId: b.getAttribute('data-test-id'),
      ariaLabel: b.getAttribute('aria-label'),
      class: b.className.substring(0, 60),
    })).filter(b => b.text || b.testId || b.ariaLabel);
  });
  console.log(`  [${label}] Alle knoppen:`, JSON.stringify(info.slice(0, 20), null, 2));
}

// Navigeer direct naar new-action URL (werkt altijd voor de eerste actie)
// Voor volgende acties: zoek de LAATSTE + knop in canvas
async function openActiePanel(page, actionIndex) {
  if (actionIndex === 0) {
    // Eerste actie: gebruik de URL methode
    await page.goto(
      `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit/actions/new-action?edgeId=enrollment-edge-0`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    return;
  }

  // Volgende acties: klik de LAATSTE "Nieuwe actie toevoegen" knop
  const addBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  if (addBtns.length > 0) {
    await addBtns[addBtns.length - 1].click();
    await page.waitForTimeout(2500);
    return;
  }

  // Fallback: scroll naar Einde en hover
  await page.getByText('Einde').first().scrollIntoViewIfNeeded();
  await page.getByText('Einde').first().hover();
  await page.waitForTimeout(800);
  const fallbackBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  if (fallbackBtns.length > 0) {
    await fallbackBtns[fallbackBtns.length - 1].click();
    await page.waitForTimeout(2500);
    return;
  }

  // Diagnose als niets werkt
  await ss(page, `DIAGNOSE-a${actionIndex}`);
  await debugButtons(page, `DIAGNOSE-a${actionIndex}`);
  throw new Error(`Kan + knop niet vinden voor actie ${actionIndex}`);
}

// Zoek een actie via de zoekbalk
async function zoekActie(page, zoekterm) {
  const searchBox = page.locator('input[placeholder="Acties zoeken"]').first();
  await searchBox.waitFor({ state: 'visible', timeout: 10000 });
  await searchBox.fill(zoekterm);
  await page.waitForTimeout(1500);
}

// Sla actie op — Opslaan knop staat bovenaan het paneel
async function slaOp(page, actienaam) {
  const btn = page.locator('button').filter({ hasText: /opslaan/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(3000);
  console.log(`  ✅ ${actienaam}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Opname gestart →', VIDEO_DIR);

  // ══ 0. CANVAS OPENEN ══
  console.log('\n[0] Canvas openen...');
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismissTrialGuide(page);
  await ss(page, '00-canvas');

  // Als er een incomplete actie is (Annuleren knop zichtbaar), annuleer die eerst
  const annuleerBtn = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await annuleerBtn.isVisible().catch(() => false)) {
    console.log('  ↩️  Incomplete actie gedetecteerd, annuleren...');
    await annuleerBtn.click();
    await page.waitForTimeout(2000);
  }

  // ══ A1: VERTRAGING 1 UUR ══
  console.log('\n[A1] Vertraging 1 uur...');
  await openActiePanel(page, 0);
  await ss(page, 'A1-panel');

  // Klik "Vertraging" icoon
  await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
  await page.waitForTimeout(2000);
  await ss(page, 'A1-config');

  // Klik het type-dropdown
  const typeDropA1 = page.locator('button[aria-haspopup], select, [role="combobox"]')
    .filter({ hasText: /selecteer|gebaseer/i }).first();
  await typeDropA1.waitFor({ state: 'visible', timeout: 8000 });
  await typeDropA1.click();
  await page.waitForTimeout(1000);
  await ss(page, 'A1-type-dropdown');

  // Kies "Voor een bepaalde tijd" (4e optie = vaste duur)
  const tijdOpt = page.locator('[role="option"], li, [role="menuitem"]')
    .filter({ hasText: /voor een bepaalde tijd/i }).first();
  if (await tijdOpt.isVisible().catch(() => false)) {
    await tijdOpt.click();
  } else {
    // Klik de laatste optie (Voor een bepaalde tijd staat als 4e/laatste)
    const opts = await page.locator('[role="option"], li[role="option"]').all();
    await opts[opts.length - 1].click();
  }
  await page.waitForTimeout(1500);
  await ss(page, 'A1-type-selected');

  // Sluit trial guide als open
  await dismissTrialGuide(page);
  // Klik × van trial sidebar als zichtbaar
  const trialX = page.locator('button').filter({ hasText: /^×$/ }).first();
  if (await trialX.isVisible().catch(() => false)) { await trialX.click(); await page.waitForTimeout(500); }

  // Vul 1 uur in — UI heeft 3 spinners: Dagen, Uur, Minuten
  // Probeer input[type="number"] en fallback naar role="spinbutton" of gewone input
  let spinners = page.locator('input[type="number"]');
  let spinnerCount = await spinners.count();
  if (spinnerCount === 0) {
    spinners = page.locator('input[role="spinbutton"], [role="spinbutton"] input, input[class*="spin"], input[class*="Spin"]');
    spinnerCount = await spinners.count();
  }
  if (spinnerCount === 0) {
    // Log alle inputs voor diagnose
    const allInputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, placeholder: i.placeholder,
        value: i.value, class: i.className.substring(0, 50)
      }))
    );
    console.log('  Alle inputs:', JSON.stringify(allInputs));
    await ss(page, 'A1-spinner-debug');
    throw new Error('Geen spinner inputs gevonden');
  }
  console.log(`  Spinners gevonden: ${spinnerCount}`);
  // Uur is de 2e spinner (index 1)
  const uurSpinner = spinnerCount >= 2 ? spinners.nth(1) : spinners.first();
  await uurSpinner.click({ clickCount: 3 });
  await uurSpinner.fill('1');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);
  await ss(page, 'A1-filled');
  await slaOp(page, 'A1 Vertraging 1 uur');
  await ss(page, 'A1-done');

  // ══ A2: TAAK – POGING 1 ══
  console.log('\n[A2] Taak Belpogingstaken Poging 1...');
  await ss(page, 'A2-canvas-for-btn');
  await debugButtons(page, 'A2-pre');
  await openActiePanel(page, 1);
  await ss(page, 'A2-panel');

  await zoekActie(page, 'Taak aanmaken');
  await ss(page, 'A2-search');

  // Klik "Taak aanmaken" (element bevat deze tekst)
  await page.locator('button, li, [role="option"], div[class*="action-item"], div[class*="ActionItem"]')
    .filter({ hasText: /taak aanmaken/i }).first().click();
  await page.waitForTimeout(2000);
  await ss(page, 'A2-config');

  // Taaknaam
  const titleA2 = page.locator(
    '[placeholder*="Voer een taaknaam in"], [placeholder*="aaknaam"], input[type="text"]'
  ).first();
  await titleA2.waitFor({ state: 'visible', timeout: 6000 });
  await titleA2.click({ clickCount: 3 });
  await titleA2.fill('Bel [Voornaam] – Poging 1');

  await ss(page, 'A2-filled');
  await slaOp(page, 'A2 Taak Poging 1');

  // ══ A3: DEAL STAGE → BELPOGING 1 ══
  console.log('\n[A3] Stadium → Belpoging 1...');
  await openActiePanel(page, 2);
  await ss(page, 'A3-panel');

  await zoekActie(page, 'eigenschap');
  await ss(page, 'A3-search');
  await page.locator('button, li, div[class*="action-item"], div[class*="ActionItem"]')
    .filter({ hasText: /eigenschap/i }).first().click();
  await page.waitForTimeout(2000);
  await ss(page, 'A3-config');

  // Kies "Stadium deal"
  const propA3 = page.locator('[placeholder*="eigenschap"], [placeholder*="Zoek"]').first();
  if (await propA3.isVisible().catch(() => false)) {
    await propA3.fill('stadium');
    await page.waitForTimeout(1000);
    await page.locator('li, [role="option"]').filter({ hasText: /stadium deal/i }).first().click();
    await page.waitForTimeout(1000);
    // Kies waarde "Belpoging 1"
    const valA3 = page.locator('[placeholder*="eigenschap"], [placeholder*="Zoek"]').last();
    if (await valA3.isVisible().catch(() => false)) {
      await valA3.fill('Belpoging 1');
      await page.waitForTimeout(1000);
      await page.locator('label, li, [role="option"]').filter({ hasText: /belpoging 1/i }).first().click();
    }
  }

  await ss(page, 'A3-filled');
  await slaOp(page, 'A3 Stadium Belpoging 1');

  // ══ A4: VERTRAGING 24 UUR ══
  console.log('\n[A4] Vertraging 24 uur...');
  await openActiePanel(page, 3);

  await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
  await page.waitForTimeout(2000);

  const typeDropA4 = page.locator('button[aria-haspopup], select, [role="combobox"]')
    .filter({ hasText: /selecteer|gebaseer/i }).first();
  await typeDropA4.waitFor({ state: 'visible', timeout: 8000 });
  await typeDropA4.click();
  await page.waitForTimeout(1000);

  const tijdOpt4 = page.locator('[role="option"], li[role="option"]').filter({ hasText: /voor een bepaalde tijd/i }).first();
  if (await tijdOpt4.isVisible().catch(() => false)) {
    await tijdOpt4.click();
  } else {
    const opts4 = await page.locator('[role="option"], li[role="option"]').all();
    await opts4[opts4.length - 1].click();
  }
  await page.waitForTimeout(1500);

  // Spinners: Dagen (0), Uur (1), Minuten (2) — zet Dagen op 1 (= 24 uur)
  const spinnersA4 = page.locator('input[type="number"]');
  await spinnersA4.first().waitFor({ state: 'visible', timeout: 5000 });
  const dagenA4 = spinnersA4.first();
  await dagenA4.click({ clickCount: 3 });
  await dagenA4.fill('1');
  await page.waitForTimeout(300);

  await slaOp(page, 'A4 Vertraging 24 uur');

  // ══ A5: TAAK – POGING 2 ══
  console.log('\n[A5] Taak Poging 2...');
  await openActiePanel(page, 4);

  await zoekActie(page, 'Taak aanmaken');
  await page.locator('button, li, [role="option"], div[class*="action-item"], div[class*="ActionItem"]')
    .filter({ hasText: /taak aanmaken/i }).first().click();
  await page.waitForTimeout(2000);

  const titleA5 = page.locator(
    '[placeholder*="Voer een taaknaam in"], [placeholder*="aaknaam"], input[type="text"]'
  ).first();
  await titleA5.waitFor({ state: 'visible', timeout: 6000 });
  await titleA5.click({ clickCount: 3 });
  await titleA5.fill('Bel [Voornaam] – Poging 2');

  await slaOp(page, 'A5 Taak Poging 2');

  // ══ A6: DEAL STAGE → BELPOGING 2 ══
  console.log('\n[A6] Stadium → Belpoging 2...');
  await openActiePanel(page, 5);

  await zoekActie(page, 'eigenschap');
  await page.locator('button, li, div[class*="action-item"], div[class*="ActionItem"]')
    .filter({ hasText: /eigenschap/i }).first().click();
  await page.waitForTimeout(2000);

  const propA6 = page.locator('[placeholder*="eigenschap"], [placeholder*="Zoek"]').first();
  if (await propA6.isVisible().catch(() => false)) {
    await propA6.fill('stadium');
    await page.waitForTimeout(1000);
    await page.locator('li, [role="option"]').filter({ hasText: /stadium deal/i }).first().click();
    await page.waitForTimeout(1000);
    const valA6 = page.locator('[placeholder*="eigenschap"], [placeholder*="Zoek"]').last();
    if (await valA6.isVisible().catch(() => false)) {
      await valA6.fill('Belpoging 2');
      await page.waitForTimeout(1000);
      await page.locator('label, li, [role="option"]').filter({ hasText: /belpoging 2/i }).first().click();
    }
  }

  await slaOp(page, 'A6 Stadium Belpoging 2');

  // ══ KLAAR ══
  await ss(page, 'ZZ-final');
  console.log('\n✅ HS-WF-01 acties klaar!');
  console.log('📹 Video:', VIDEO_DIR);
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
