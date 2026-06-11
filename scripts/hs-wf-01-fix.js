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
async function dismissOverlays(page) {
  await page.evaluate(() => {
    document.getElementById('mini-trial-guide-iframe')?.remove();
    document.querySelectorAll('[class*="TrialGuide"], [class*="trial-guide"]').forEach(el => el.remove());
  });
  // Sluit "Kan actie niet plakken" toast als zichtbaar
  const toastClose = page.locator('[class*="alert"] button, [class*="Toast"] button').first();
  if (await toastClose.isVisible().catch(() => false)) {
    await toastClose.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}
async function slaOp(page, naam) {
  const btn = page.locator('button').filter({ hasText: /opslaan/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(3000);
  console.log(`  ✅ ${naam}`);
}

// Scroll het actie-panel naar beneden
async function scrollPanel(page) {
  await page.evaluate(() => {
    const els = document.querySelectorAll('div[class*="scroll"], div[style*="overflow"], aside, [class*="SidePanel"]');
    els.forEach(el => el.scrollTop = el.scrollHeight);
    // Also scroll the main panel area
    const panel = document.querySelector('[class*="ActionPanel"], [class*="action-panel"]');
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(500);
}

// Open actiepanel via de LAATSTE "Nieuwe actie toevoegen" knop
async function openActiePanel(page, index) {
  if (index === 0) {
    // Eerste actie: URL methode
    await page.goto(
      `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit/actions/new-action?edgeId=enrollment-edge-0`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    await dismissOverlays(page);
    return;
  }
  const addBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  if (addBtns.length === 0) throw new Error('Geen + knop gevonden');
  await addBtns[addBtns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismissOverlays(page);
}

// Klik een actie in de CRM categorie
async function klikCRMActie(page, actieNaam) {
  // Klik CRM om te expanden
  const crm = page.locator('div, span, button').filter({ hasText: /^CRM$/ }).first();
  await crm.waitFor({ state: 'visible', timeout: 8000 });
  await crm.click();
  await page.waitForTimeout(800);
  // Scroll panel om CRM-items zichtbaar te maken
  await scrollPanel(page);
  await page.waitForTimeout(800);
  // Zoek de actie
  const actie = page.locator('button, div[role="button"], li')
    .filter({ hasText: new RegExp(actieNaam, 'i') }).first();
  await actie.waitFor({ state: 'visible', timeout: 6000 });
  await actie.click();
  await page.waitForTimeout(2000);
}

// Vul het titel-veld in bij Taak aanmaken
async function vulTitelIn(page, titel) {
  // Zoek alle zichtbare inputs
  const inputs = await page.locator('input:visible').all();
  console.log(`  ${inputs.length} zichtbare inputs`);
  for (const inp of inputs) {
    const ph = await inp.getAttribute('placeholder').catch(() => '');
    const type = await inp.getAttribute('type').catch(() => '');
    // Skip search boxes en hidden inputs
    if (ph && (ph.includes('oek') || ph.includes('Actie'))) continue;
    if (type === 'hidden' || type === 'checkbox' || type === 'radio') continue;
    // Dit is waarschijnlijk het titel-veld
    await inp.click();
    await inp.fill(titel);
    console.log(`  Titel ingevuld: "${titel}"`);
    return;
  }
  console.log('  ⚠️ Titel-veld niet gevonden');
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Opname gestart');

  // ══ 0. CANVAS ══
  console.log('\n[0] Canvas openen...');
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismissOverlays(page);
  await ss(page, '00-canvas');

  // ══ A1: VERTRAGING 1 UUR ══
  console.log('\n[A1] Vertraging 1 uur...');
  await openActiePanel(page, 0);

  // Klik Vertraging icon
  await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  // Type: "Voor een bepaalde tijd"
  const typeDD = page.locator('button[aria-haspopup], [role="combobox"]')
    .filter({ hasText: /selecteer|gebaseer/i }).first();
  await typeDD.waitFor({ state: 'visible', timeout: 8000 });
  await typeDD.click();
  await page.waitForTimeout(1000);
  const tijdOpt = page.locator('[role="option"], li').filter({ hasText: /voor een bepaalde tijd/i }).first();
  if (await tijdOpt.isVisible().catch(() => false)) await tijdOpt.click();
  else { const opts = await page.locator('[role="option"]').all(); await opts[opts.length - 1].click(); }
  await page.waitForTimeout(2500);
  await ss(page, 'A1-type-selected');

  // Debug: log alle inputs
  const allInputsA1 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, value: i.value, visible: i.offsetParent !== null,
      class: i.className.substring(0, 40), name: i.name
    }))
  );
  console.log('  Inputs na type:', JSON.stringify(allInputsA1.filter(i => i.visible)));

  // Spinners: Dagen (0), Uur (1), Minuten (2) → zet Uur op 1
  let spinners = page.locator('input[type="number"]:visible');
  let spinCount = await spinners.count();
  if (spinCount === 0) {
    // Probeer via role="spinbutton"
    spinners = page.locator('[role="spinbutton"]:visible, input[inputmode="numeric"]:visible');
    spinCount = await spinners.count();
  }
  if (spinCount === 0) {
    // Probeer ALLE zichtbare inputs met numerieke waarde
    spinners = page.locator('input:visible');
    spinCount = await spinners.count();
    console.log(`  Fallback: ${spinCount} zichtbare inputs totaal`);
  }
  await spinners.first().waitFor({ state: 'visible', timeout: 8000 });
  const uurSpinner = spinners.nth(1);
  await uurSpinner.click({ clickCount: 3 });
  await uurSpinner.fill('1');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);

  await slaOp(page, 'Vertraging 1 uur');

  // ══ A2: TAAK POGING 1 ══
  console.log('\n[A2] Taak – Poging 1...');
  await openActiePanel(page, 1);
  await klikCRMActie(page, 'Taak aanmaken');
  await ss(page, 'A2-config');
  await vulTitelIn(page, 'Bel contact – Poging 1');
  await ss(page, 'A2-filled');
  await slaOp(page, 'Taak Poging 1');

  // ══ A3: STADIUM → BELPOGING 1 ══
  console.log('\n[A3] Stadium → Belpoging 1...');
  await openActiePanel(page, 2);
  // CRM → scroll → zoek "Eigenschap instellen" of "Eigenschapswaarde"
  const crm3 = page.locator('div, span, button').filter({ hasText: /^CRM$/ }).first();
  await crm3.waitFor({ state: 'visible', timeout: 8000 });
  await crm3.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);
  await page.waitForTimeout(800);
  await ss(page, 'A3-crm-scroll');

  // Zoek de juiste actie (NIET "Slimme eigenschap")
  const eigenItems = await page.locator('button, div[role="button"], li')
    .filter({ hasText: /eigenschap/i }).all();
  console.log(`  Eigenschap items: ${eigenItems.length}`);
  // Log alle teksten
  for (let i = 0; i < eigenItems.length; i++) {
    const txt = await eigenItems[i].innerText().catch(() => '');
    console.log(`    [${i}] ${txt.substring(0, 60)}`);
  }
  // Klik degene die NIET "Slimme" bevat
  let eigenClicked = false;
  for (const item of eigenItems) {
    const txt = await item.innerText().catch(() => '');
    if (txt.toLowerCase().includes('slimme') || txt.toLowerCase().includes('agent')) continue;
    if (txt.toLowerCase().includes('eigenschap') && !txt.toLowerCase().includes('ai')) {
      await item.click();
      eigenClicked = true;
      break;
    }
  }
  if (!eigenClicked && eigenItems.length > 0) {
    // Klik de laatste (meest waarschijnlijk CRM)
    await eigenItems[eigenItems.length - 1].click();
  }
  await page.waitForTimeout(2000);
  await ss(page, 'A3-config');

  // Kies eigenschap "Stadium deal"
  const propSearch3 = page.locator('[placeholder*="eigenschap"], [placeholder*="Zoek"], input[type="search"]').first();
  if (await propSearch3.isVisible().catch(() => false)) {
    await propSearch3.fill('stadium');
    await page.waitForTimeout(1000);
    await page.locator('li, [role="option"]').filter({ hasText: /stadium deal/i }).first().click();
    await page.waitForTimeout(1000);
    const valSearch3 = page.locator('[placeholder*="Zoek"], input[type="search"]').last();
    if (await valSearch3.isVisible().catch(() => false)) {
      await valSearch3.fill('Belpoging 1');
      await page.waitForTimeout(1000);
      await page.locator('label, li, [role="option"]').filter({ hasText: /belpoging 1/i }).first().click();
    }
  }
  await ss(page, 'A3-filled');
  await slaOp(page, 'Stadium Belpoging 1');

  // ══ A4: VERTRAGING 24 UUR ══
  console.log('\n[A4] Vertraging 24 uur...');
  await openActiePanel(page, 3);
  await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
  await page.waitForTimeout(2000);
  await dismissOverlays(page);

  const typeDD4 = page.locator('button[aria-haspopup], [role="combobox"]')
    .filter({ hasText: /selecteer|gebaseer/i }).first();
  await typeDD4.waitFor({ state: 'visible', timeout: 8000 });
  await typeDD4.click();
  await page.waitForTimeout(1000);
  const tijdOpt4 = page.locator('[role="option"], li').filter({ hasText: /voor een bepaalde tijd/i }).first();
  if (await tijdOpt4.isVisible().catch(() => false)) await tijdOpt4.click();
  else { const opts = await page.locator('[role="option"]').all(); await opts[opts.length - 1].click(); }
  await page.waitForTimeout(1500);

  await page.waitForTimeout(2500);
  // Spinners zijn input[type="text"] met waarde "0"
  // Dagen is de eerste, Uur de tweede, Minuten de derde
  // Zet Dagen op 1 (= 24 uur)
  const spin4 = page.locator('input[type="text"][class*="TextInput"]');
  let spin4Count = await spin4.count();
  if (spin4Count === 0) {
    // Fallback: alle visible inputs met value "0"
    const allInp = await page.locator('input:visible').all();
    for (const inp of allInp) {
      const val = await inp.inputValue().catch(() => '');
      if (val === '0') {
        await inp.click({ clickCount: 3 });
        await inp.fill('1');
        break;
      }
    }
  } else {
    await spin4.first().click({ clickCount: 3 });
    await spin4.first().fill('1');
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);

  await slaOp(page, 'Vertraging 24 uur');

  // ══ A5: TAAK POGING 2 ══
  console.log('\n[A5] Taak – Poging 2...');
  await openActiePanel(page, 4);
  await klikCRMActie(page, 'Taak aanmaken');
  await vulTitelIn(page, 'Bel contact – Poging 2');
  await slaOp(page, 'Taak Poging 2');

  // ══ A6: STADIUM → BELPOGING 2 ══
  console.log('\n[A6] Stadium → Belpoging 2...');
  await openActiePanel(page, 5);
  const crm6 = page.locator('div, span, button').filter({ hasText: /^CRM$/ }).first();
  await crm6.waitFor({ state: 'visible', timeout: 8000 });
  await crm6.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);
  await page.waitForTimeout(800);

  const eigenItems6 = await page.locator('button, div[role="button"], li')
    .filter({ hasText: /eigenschap/i }).all();
  for (const item of eigenItems6) {
    const txt = await item.innerText().catch(() => '');
    if (txt.toLowerCase().includes('slimme') || txt.toLowerCase().includes('agent')) continue;
    if (txt.toLowerCase().includes('eigenschap')) {
      await item.click();
      break;
    }
  }
  await page.waitForTimeout(2000);

  const propSearch6 = page.locator('[placeholder*="eigenschap"], [placeholder*="Zoek"], input[type="search"]').first();
  if (await propSearch6.isVisible().catch(() => false)) {
    await propSearch6.fill('stadium');
    await page.waitForTimeout(1000);
    await page.locator('li, [role="option"]').filter({ hasText: /stadium deal/i }).first().click();
    await page.waitForTimeout(1000);
    const valSearch6 = page.locator('[placeholder*="Zoek"], input[type="search"]').last();
    if (await valSearch6.isVisible().catch(() => false)) {
      await valSearch6.fill('Belpoging 2');
      await page.waitForTimeout(1000);
      await page.locator('label, li, [role="option"]').filter({ hasText: /belpoging 2/i }).first().click();
    }
  }

  await slaOp(page, 'Stadium Belpoging 2');

  // ══ KLAAR ══
  await ss(page, 'ZZ-final');
  console.log('\n✅ HS-WF-01 compleet!');
  console.log('📹 Video:', VIDEO_DIR);
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
