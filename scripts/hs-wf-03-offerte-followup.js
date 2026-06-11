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
async function clickLastPlus(page) {
  const btns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  if (btns.length === 0) throw new Error('Geen + knop gevonden');
  await btns[btns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  console.log('🎬 HS-WF-03 Offerte Follow-up Timer');

  // ══ 1. WORKFLOW AANMAKEN ══
  console.log('\n[1] Workflow aanmaken...');
  await page.goto(`https://app-eu1.hubspot.com/workflows/${PORTAL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismiss(page);
  await page.locator('[data-test-id="create-workflow-dropdown"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByText('Vanaf nul').click();
  await page.waitForTimeout(4000);
  await dismiss(page);
  await ss(page, 'WF03-01-created');

  // ══ 2. TRIGGER: Deal stage = Eerste offerte verzonden ══
  console.log('\n[2] Trigger instellen...');
  await page.getByText('Voldoet aan filtercriteria').click();
  await page.waitForTimeout(2000);

  // Kies "Deal" als object
  await page.getByText('Deal').first().click();
  await page.waitForTimeout(2000);

  // Kies filter condition
  await page.locator('[data-test-id="fr-condition-select"]').first().click();
  await page.waitForTimeout(1500);
  await page.getByText('Deal eigenschappen').click();
  await page.waitForTimeout(1500);

  // Zoek "stadium"
  await page.locator('input[placeholder*="oek"]').last().fill('stadium');
  await page.waitForTimeout(1500);
  await page.getByText('Stadium deal').first().click();
  await page.waitForTimeout(2000);

  // Selecteer "Eerste offerte verzonden"
  const valueBtn = page.locator('button').filter({ hasText: /^Zoeken$/ }).first();
  if (await valueBtn.isVisible().catch(() => false)) {
    await valueBtn.click();
    await page.waitForTimeout(2000);
  }
  const searchInp = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
  if (await searchInp.isVisible().catch(() => false)) {
    await searchInp.fill('Eerste off');
    await page.waitForTimeout(1000);
  }
  const stageLabel = page.locator('label').filter({ hasText: /eerste offerte/i }).first();
  if (await stageLabel.isVisible().catch(() => false)) {
    await stageLabel.click();
    await page.waitForTimeout(500);
  }

  // Sluit dropdown
  await page.getByText('Groep 1').first().click();
  await page.waitForTimeout(1000);
  await ss(page, 'WF03-02-trigger');
  console.log('  ✅ Trigger ingesteld');

  // ══ 3. VOLGENDE → OPSLAAN EN DOORGAAN ══
  console.log('\n[3] Naar canvas...');
  const nextBtn = page.locator('button').filter({ hasText: /volgende/i }).first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(2000);
  }
  const saveAndCont = page.locator('button').filter({ hasText: /opslaan en doorgaan/i }).first();
  await saveAndCont.waitFor({ state: 'visible' });
  await saveAndCont.click();
  await page.waitForTimeout(4000);
  await dismiss(page);
  await ss(page, 'WF03-03-canvas');

  // Haal WF ID
  const wfMatch = page.url().match(/\/flow\/(\d+)\//);
  const wfId = wfMatch ? wfMatch[1] : 'unknown';
  console.log('  WF ID:', wfId);

  // ══ 4. NAAM INSTELLEN ══
  console.log('\n[4] Naam instellen...');
  await page.locator('h1, [class*="WorkflowName"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill('HS-WF-03 Offerte Follow-up Timer');
    await nameInput.press('Enter');
    console.log('  ✅ Naam ingesteld');
  }
  await page.waitForTimeout(1000);

  // ══ 5. ACTIE 1: VERTRAGING 3 DAGEN ══
  console.log('\n[5] Vertraging 3 dagen...');
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${wfId}/edit/actions/new-action?edgeId=enrollment-edge-0`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(3000);
  await dismiss(page);

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

  // Dagen=3, Uur=0, Min=0
  const spinners = await page.locator('input[type="text"][class*="TextInput"]').all();
  if (spinners.length >= 3) {
    await spinners[0].click({ clickCount: 3 });
    await spinners[0].fill('3');
  } else {
    const allInp = await page.locator('input:visible').all();
    for (const inp of allInp) {
      const val = await inp.inputValue().catch(() => '');
      if (val === '0') {
        await inp.click({ clickCount: 3 });
        await inp.fill('3');
        break;
      }
    }
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);
  await save(page, 'Vertraging 3 dagen');

  // ══ 6. ACTIE 2: IF/THEN BRANCH ══
  console.log('\n[6] If/then branch...');
  await clickLastPlus(page);

  // Zoek "Als/dan tak" of "If/then branch"
  const ifThen = page.locator('button, [role="button"]').filter({ hasText: /als.*dan|if.*then/i }).first();
  if (await ifThen.isVisible().catch(() => false)) {
    await ifThen.click();
  } else {
    // Probeer zoekbalk
    const searchBox = page.locator('input[placeholder*="ctie"]').first();
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill('als dan');
      await page.waitForTimeout(1500);
      await page.locator('button, [role="button"], li').filter({ hasText: /als.*dan|if.*then/i }).first().click();
    }
  }
  await page.waitForTimeout(2000);
  await dismiss(page);
  await ss(page, 'WF03-06-branch-config');

  // Configureer branch conditie: Stadium deal = Eerste offerte verzonden
  // Klik "Een filter toevoegen"
  const addFilter = page.locator('button, a').filter({ hasText: /filter toevoegen|conditie/i }).first();
  if (await addFilter.isVisible().catch(() => false)) {
    await addFilter.click();
    await page.waitForTimeout(1500);
  }

  // Zoek deal eigenschap "Stadium deal"
  const filterSearch = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').first();
  if (await filterSearch.isVisible().catch(() => false)) {
    await filterSearch.fill('stadium');
    await page.waitForTimeout(1000);
    await page.locator('li, [role="option"], div').filter({ hasText: /stadium deal/i }).first().click();
    await page.waitForTimeout(1500);
  }

  // Selecteer "Eerste offerte verzonden" als waarde
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
    }
  }
  await ss(page, 'WF03-06-branch-filter');
  await save(page, 'If/then branch');

  // ══ 7. ACTIE IN YES BRANCH: Taak aanmaken ══
  console.log('\n[7] Taak in YES branch...');
  // Na de branch zijn er twee paden. We moeten de + knop in de YES tak klikken.
  // Dit is lastiger — de YES tak heeft zijn eigen + knop
  await page.waitForTimeout(2000);
  await dismiss(page);

  // Zoek alle + knoppen — de eerste zou de YES tak moeten zijn
  const plusBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns.length} + knoppen gevonden`);
  if (plusBtns.length > 0) {
    // Klik de eerste + (YES branch)
    await plusBtns[0].click();
    await page.waitForTimeout(2500);
    await dismiss(page);
  }

  // CRM > Taak aanmaken
  const crm = page.locator('div, span').filter({ hasText: /^CRM$/ }).first();
  await crm.waitFor({ state: 'visible', timeout: 8000 });
  await crm.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);

  const taak = page.locator('button, div[role="button"], li').filter({ hasText: /taak aanmaken/i }).first();
  await taak.waitFor({ state: 'visible', timeout: 6000 });
  await taak.click();
  await page.waitForTimeout(2000);

  // Titel invullen
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
  await ss(page, 'WF03-07-task');
  await save(page, 'Taak in YES branch');

  // ══ KLAAR ══
  await ss(page, 'WF03-ZZ-final');
  console.log('\n✅ HS-WF-03 Offerte Follow-up Timer klaar!');
  console.log('  WF ID:', wfId);
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
