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
    document.querySelectorAll('[class*="TrialGuide"], [class*="trial-guide"]').forEach(e => e.remove());
    document.querySelectorAll('[class*="alert-"]').forEach(e => e.remove());
  });
}
async function save(page, label) {
  await page.locator('button').filter({ hasText: /opslaan/i }).first().click();
  await page.waitForTimeout(3000);
  console.log(`  ✅ ${label}`);
}
async function clickLastPlus(page) {
  const btns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  await btns[btns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);
}
async function scrollPanel(page) {
  await page.evaluate(() => {
    document.querySelectorAll('div[class*="scroll"], aside, div[style*="overflow"]')
      .forEach(e => { if (e.scrollHeight > e.clientHeight) e.scrollTop = e.scrollHeight; });
  });
  await page.waitForTimeout(600);
}

// ═══ ACTIES ═══

async function addVertraging(page, dagen, uren, minuten) {
  // Klik Vertraging icon
  await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
  await page.waitForTimeout(2000);
  await dismiss(page);

  // Type: "Voor een bepaalde tijd"
  const dd = page.locator('button').filter({ hasText: /selecteer|gebaseer/i }).first();
  await dd.waitFor({ state: 'visible', timeout: 8000 });
  await dd.click();
  await page.waitForTimeout(1000);
  const opt = page.locator('[role="option"]').filter({ hasText: /voor een bepaalde tijd/i }).first();
  if (await opt.isVisible().catch(() => false)) await opt.click();
  else { const all = await page.locator('[role="option"]').all(); await all[all.length - 1].click(); }
  await page.waitForTimeout(2500);

  // Spinners: type="text", klasse TextInput, waarde "0"
  const spinners = await page.locator('input[type="text"][class*="TextInput"]').all();
  if (spinners.length >= 3) {
    if (dagen) { await spinners[0].click({ clickCount: 3 }); await spinners[0].fill(String(dagen)); }
    if (uren) { await spinners[1].click({ clickCount: 3 }); await spinners[1].fill(String(uren)); }
    if (minuten) { await spinners[2].click({ clickCount: 3 }); await spinners[2].fill(String(minuten)); }
  } else {
    // Fallback: vul eerste input met "0" waarde
    const allInp = await page.locator('input:visible').all();
    let filled = 0;
    for (const inp of allInp) {
      const val = await inp.inputValue().catch(() => '');
      if (val === '0' && filled < 3) {
        const target = filled === 0 ? dagen : filled === 1 ? uren : minuten;
        if (target) { await inp.click({ clickCount: 3 }); await inp.fill(String(target)); }
        filled++;
      }
    }
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);
}

async function addTaakAanmaken(page, titel) {
  // Open CRM > Taak aanmaken
  const crm = page.locator('div, span').filter({ hasText: /^CRM$/ }).first();
  await crm.waitFor({ state: 'visible', timeout: 8000 });
  await crm.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);

  const taak = page.locator('button, div[role="button"], li').filter({ hasText: /taak aanmaken/i }).first();
  await taak.waitFor({ state: 'visible', timeout: 6000 });
  await taak.click();
  await page.waitForTimeout(2000);

  // Titel is een contenteditable div (StyledFormulaText), niet een input
  const titelField = page.getByLabel('Titel');
  if (await titelField.isVisible().catch(() => false)) {
    await titelField.click();
    await page.waitForTimeout(300);
    // Selecteer alles en vervang
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(titel);
    console.log(`  Titel: "${titel}"`);
  } else {
    // Fallback: zoek contenteditable
    const ce = page.locator('[contenteditable="true"], [class*="FormulaText"]').first();
    if (await ce.isVisible().catch(() => false)) {
      await ce.click();
      await page.keyboard.press('Meta+a');
      await page.keyboard.type(titel);
      console.log(`  Titel via contenteditable: "${titel}"`);
    }
  }
  await page.waitForTimeout(500);
}

async function addRecordBewerken(page, eigenschap, waarde) {
  // Open CRM > Record bewerken
  const crm = page.locator('div, span').filter({ hasText: /^CRM$/ }).first();
  await crm.waitFor({ state: 'visible', timeout: 8000 });
  await crm.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);

  const rb = page.locator('button, div[role="button"], li').filter({ hasText: /record bewerken/i }).first();
  await rb.waitFor({ state: 'visible', timeout: 6000 });
  await rb.click();
  await page.waitForTimeout(2000);
  await ss(page, 'RB-config');

  // Klik "Een eigenschap keizen" dropdown
  const propDD = page.locator('button').filter({ hasText: /een eigenschap keizen/i }).first();
  await propDD.waitFor({ state: 'visible', timeout: 6000 });
  await propDD.click();
  await page.waitForTimeout(1500);
  await ss(page, 'RB-prop-dropdown');

  // Zoek in het dropdown panel
  const searchInputs = await page.locator('input:visible').all();
  console.log(`  ${searchInputs.length} inputs na dropdown open`);
  // Zoek de search input (er verschijnt er eentje in het dropdown)
  for (const inp of searchInputs) {
    const ph = await inp.getAttribute('placeholder').catch(() => '');
    if (ph && (ph.includes('oek') || ph.includes('Zoek') || ph.includes('Search'))) {
      await inp.fill(eigenschap);
      await page.waitForTimeout(1500);
      break;
    }
  }
  await ss(page, 'RB-prop-search');

  // Klik de eigenschap optie
  const propOpt = page.locator('[role="option"], li, button, div')
    .filter({ hasText: new RegExp(eigenschap, 'i') }).first();
  if (await propOpt.isVisible().catch(() => false)) {
    await propOpt.click();
    await page.waitForTimeout(1500);
  }
  await ss(page, 'RB-prop-selected');

  // Nu verschijnt het waarde-veld
  // Klik het waarde dropdown of veld
  const valDD = page.locator('button, input, select')
    .filter({ hasText: /kies.*waarde|selecteer|een waarde/i }).first();
  if (await valDD.isVisible().catch(() => false)) {
    await valDD.click();
    await page.waitForTimeout(1000);
    // Zoek waarde
    const valSearch = await page.locator('input:visible').all();
    for (const inp of valSearch) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph && (ph.includes('oek') || ph.includes('Zoek'))) {
        await inp.fill(waarde);
        await page.waitForTimeout(1000);
        break;
      }
    }
    await page.locator('[role="option"], li, label')
      .filter({ hasText: new RegExp(waarde, 'i') }).first().click();
    await page.waitForTimeout(500);
  } else {
    // Misschien verschijnt er direct een dropdown/input voor de waarde
    const valInput = page.locator('input, select').last();
    if (await valInput.isVisible().catch(() => false)) {
      await valInput.fill(waarde);
      await page.waitForTimeout(1000);
      const opt = page.locator('[role="option"], li').filter({ hasText: new RegExp(waarde, 'i') }).first();
      if (await opt.isVisible().catch(() => false)) await opt.click();
    }
  }
  await ss(page, 'RB-val-selected');
}

// ═══ MAIN ═══

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  console.log('🎬 Final script gestart');

  // ══ CANVAS ══
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // Annuleer incomplete actie als nodig
  const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await ann.isVisible().catch(() => false)) { await ann.click(); await page.waitForTimeout(2000); }
  await ss(page, 'F-00');

  // Check of Vertraging 1h al bestaat
  const vertragingExists = await page.locator('div').filter({ hasText: /vertragen gedurende.*1 uur/i }).first().isVisible().catch(() => false);
  let actionIndex = 0;

  if (!vertragingExists) {
    // A1: Vertraging 1 uur
    console.log('\n[A1] Vertraging 1 uur...');
    await page.goto(
      `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit/actions/new-action?edgeId=enrollment-edge-0`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    await dismiss(page);
    await addVertraging(page, 0, 1, 0);
    await save(page, 'Vertraging 1 uur');
    actionIndex = 1;
  } else {
    console.log('\n[A1] Vertraging 1 uur bestaat al ✅');
    actionIndex = 1;
  }

  // A2: Taak – Poging 1
  console.log('\n[A2] Taak Poging 1...');
  await clickLastPlus(page);
  await addTaakAanmaken(page, 'Bel contact – Poging 1');
  await save(page, 'Taak Poging 1');

  // A3: Record bewerken – Stadium = Belpoging 1
  console.log('\n[A3] Stadium → Belpoging 1...');
  await clickLastPlus(page);
  await addRecordBewerken(page, 'Stadium deal', 'Belpoging 1');
  await save(page, 'Stadium Belpoging 1');

  // A4: Vertraging 24 uur (= 1 dag)
  console.log('\n[A4] Vertraging 24 uur...');
  await clickLastPlus(page);
  await addVertraging(page, 1, 0, 0);
  await save(page, 'Vertraging 24 uur');

  // A5: Taak – Poging 2
  console.log('\n[A5] Taak Poging 2...');
  await clickLastPlus(page);
  await addTaakAanmaken(page, 'Bel contact – Poging 2');
  await save(page, 'Taak Poging 2');

  // A6: Record bewerken – Stadium = Belpoging 2
  console.log('\n[A6] Stadium → Belpoging 2...');
  await clickLastPlus(page);
  await addRecordBewerken(page, 'Stadium deal', 'Belpoging 2');
  await save(page, 'Stadium Belpoging 2');

  await ss(page, 'F-ZZ-final');
  console.log('\n✅ HS-WF-01 Belpogingstaken COMPLEET!');
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
