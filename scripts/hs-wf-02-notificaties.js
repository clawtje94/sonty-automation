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
  await page.locator('button').filter({ hasText: /opslaan/i }).first().click();
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
  console.log('🎬 HS-WF-02 Interne Notificaties');

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
  await ss(page, 'WF02-01-created');

  // ══ 2. TRIGGER: Deal eigenschap gewijzigd ══
  console.log('\n[2] Trigger instellen...');
  // Klik op trigger type
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

  // Selecteer "is bekend" (any value = deal has a stage = always true for any stage change)
  // Of selecteer specifieke stages die notificatie nodig hebben
  // We kiezen "is één van" en selecteren ALLE stages behalve Nieuwe Lead (die krijgt al WF-01)
  const valueBtn = page.locator('button').filter({ hasText: /^Zoeken$/ }).first();
  await valueBtn.waitFor({ state: 'visible' });
  await valueBtn.click();
  await page.waitForTimeout(2000);

  // Selecteer relevante stages
  const stages = ['In Contact', 'Eerste Offerte', 'Opmeting Ingepland', 'Opmeting Gedaan',
    'Definitieve Offerte', 'Gewonnen', 'Verloren'];
  for (const stage of stages) {
    const searchInp = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
    if (await searchInp.isVisible().catch(() => false)) {
      await searchInp.fill(stage.substring(0, 8)); // Zoek eerste 8 chars
      await page.waitForTimeout(1000);
    }
    const label = page.locator('label').filter({ hasText: new RegExp(stage, 'i') }).first();
    if (await label.isVisible().catch(() => false)) {
      await label.click();
      await page.waitForTimeout(500);
    }
    // Clear search voor volgende
    if (await searchInp.isVisible().catch(() => false)) {
      await searchInp.fill('');
      await page.waitForTimeout(500);
    }
  }

  // Sluit dropdown
  await page.getByText('Groep 1').first().click();
  await page.waitForTimeout(1000);
  await ss(page, 'WF02-02-trigger');
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
  await ss(page, 'WF02-03-canvas');
  console.log('  URL:', page.url());

  // Haal WF ID uit URL
  const wfMatch = page.url().match(/\/flow\/(\d+)\//);
  const wfId = wfMatch ? wfMatch[1] : 'unknown';
  console.log('  WF ID:', wfId);

  // ══ 4. NAAM INSTELLEN ══
  console.log('\n[4] Naam instellen...');
  const editBtn = page.locator('button[aria-label*="ijzigen"], [data-test-id*="edit"]').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(500);
  }
  // Klik de naam/potlood
  const pencil = page.locator('svg, button').filter({ hasText: '' }).locator('..').filter({ hasText: /workflow zonder naam/i }).first();
  if (await pencil.isVisible().catch(() => false)) {
    await pencil.click();
    await page.waitForTimeout(500);
  }
  // Probeer het pennetje naast de titel
  await page.locator('h1, [class*="WorkflowName"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  // Zoek input en vul naam in
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill('HS-WF-02 Interne Notificaties');
    await nameInput.press('Enter');
    console.log('  ✅ Naam ingesteld');
  }
  await page.waitForTimeout(1000);

  // ══ 5. ACTIE: INTERNE E-MAIL VERZENDEN ══
  console.log('\n[5] Actie: interne e-mail...');
  // Navigeer naar new-action URL
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${wfId}/edit/actions/new-action?edgeId=enrollment-edge-0`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(3000);
  await dismiss(page);
  await ss(page, 'WF02-05-panel');

  // Klik "Communicatie" categorie
  const commCat = page.locator('div, span').filter({ hasText: /^Communicatie$/ }).first();
  await commCat.waitFor({ state: 'visible', timeout: 8000 });
  await commCat.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);
  await page.waitForTimeout(800);
  await ss(page, 'WF02-05-comm');

  // Zoek "Interne e-mailmelding verzenden" of vergelijkbaar
  const emailAction = page.locator('button, div[role="button"], li')
    .filter({ hasText: /interne.*mail|e-mail.*melding|internal.*email/i }).first();
  if (await emailAction.isVisible().catch(() => false)) {
    await emailAction.click();
  } else {
    // Probeer zoekbalk
    const searchBox = page.locator('input[placeholder="Acties zoeken"]').first();
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill('interne e-mail');
      await page.waitForTimeout(1500);
      await page.locator('button, div[role="button"], li')
        .filter({ hasText: /interne.*mail|e-mail.*melding/i }).first().click();
    }
  }
  await page.waitForTimeout(2000);
  await ss(page, 'WF02-05-config');

  // Configureer de e-mail
  // Ontvanger: deal owner
  // Onderwerp en body instellen
  const subjectField = page.locator('input[placeholder*="nderwerp"], input[type="text"]').first();
  if (await subjectField.isVisible().catch(() => false)) {
    await subjectField.fill('Deal stadium gewijzigd');
    console.log('  Onderwerp ingevuld');
  }

  // Body (als contenteditable)
  const bodyField = page.locator('[contenteditable="true"], textarea').first();
  if (await bodyField.isVisible().catch(() => false)) {
    await bodyField.click();
    await page.keyboard.type('Een deal in je pijplijn is van stadium veranderd. Bekijk de deal in HubSpot.');
    console.log('  Body ingevuld');
  }

  await ss(page, 'WF02-05-filled');
  await save(page, 'Interne e-mail notificatie');
  await ss(page, 'WF02-05-done');

  // ══ KLAAR ══
  await ss(page, 'WF02-ZZ-final');
  console.log('\n✅ HS-WF-02 Interne Notificaties klaar!');
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
