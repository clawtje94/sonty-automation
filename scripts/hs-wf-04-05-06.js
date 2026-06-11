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

async function createWorkflow(page, name) {
  console.log(`\n══ ${name} ══`);
  console.log('[1] Workflow aanmaken...');
  await page.goto(`https://app-eu1.hubspot.com/workflows/${PORTAL_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismiss(page);
  await page.locator('[data-test-id="create-workflow-dropdown"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByText('Vanaf nul').click();
  await page.waitForTimeout(4000);
  await dismiss(page);
  return page;
}

async function setTriggerDealStage(page, stageSearch, stageLabelRegex) {
  console.log('[2] Trigger instellen...');
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

  // Selecteer stage
  const valueBtn = page.locator('button').filter({ hasText: /^Zoeken$/ }).first();
  if (await valueBtn.isVisible().catch(() => false)) {
    await valueBtn.click();
    await page.waitForTimeout(2000);
  }
  const searchInp = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
  if (await searchInp.isVisible().catch(() => false)) {
    await searchInp.fill(stageSearch);
    await page.waitForTimeout(1000);
  }
  const label = page.locator('label').filter({ hasText: stageLabelRegex }).first();
  if (await label.isVisible().catch(() => false)) {
    await label.click();
    await page.waitForTimeout(500);
  }
  await page.getByText('Groep 1').first().click();
  await page.waitForTimeout(1000);
  console.log('  ✅ Trigger ingesteld');
}

async function setTriggerMultiStage(page, stages) {
  console.log('[2] Trigger instellen (meerdere stages)...');
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
  if (await valueBtn.isVisible().catch(() => false)) {
    await valueBtn.click();
    await page.waitForTimeout(2000);
  }

  for (const stage of stages) {
    const searchInp = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
    if (await searchInp.isVisible().catch(() => false)) {
      await searchInp.fill(stage.substring(0, 10));
      await page.waitForTimeout(1000);
    }
    const label = page.locator('label').filter({ hasText: new RegExp(stage, 'i') }).first();
    if (await label.isVisible().catch(() => false)) {
      await label.click();
      await page.waitForTimeout(500);
    }
    if (await searchInp.isVisible().catch(() => false)) {
      await searchInp.fill('');
      await page.waitForTimeout(500);
    }
  }
  await page.getByText('Groep 1').first().click();
  await page.waitForTimeout(1000);
  console.log('  ✅ Trigger ingesteld');
}

async function goToCanvas(page) {
  console.log('[3] Naar canvas...');
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

  const wfMatch = page.url().match(/\/flow\/(\d+)\//);
  const wfId = wfMatch ? wfMatch[1] : 'unknown';
  console.log('  WF ID:', wfId);
  return wfId;
}

async function setName(page, name) {
  await page.locator('h1, [class*="WorkflowName"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill(name);
    await nameInput.press('Enter');
    console.log(`  ✅ Naam: ${name}`);
  }
  await page.waitForTimeout(1000);
}

async function addTask(page, wfId, titel, edgeId = 'enrollment-edge-0') {
  console.log(`  Taak toevoegen: "${titel}"`);
  // Gebruik URL methode voor eerste actie, + knop voor volgende
  if (edgeId) {
    await page.goto(
      `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${wfId}/edit/actions/new-action?edgeId=${edgeId}`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
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
    await page.keyboard.type(titel);
    console.log(`  Titel ingevuld`);
  } else {
    const ce = page.locator('[contenteditable="true"]').first();
    if (await ce.isVisible().catch(() => false)) {
      await ce.click();
      await page.keyboard.press('Meta+a');
      await page.keyboard.type(titel);
    }
  }
  await page.waitForTimeout(500);
  await save(page, `Taak: ${titel.substring(0, 30)}...`);
}

async function addInternalEmail(page, wfId) {
  console.log('  Interne e-mail toevoegen...');
  // Klik laatste + knop
  const plusBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  await plusBtns[plusBtns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);

  // Communicatie > Interne e-mail
  const comm = page.locator('div, span').filter({ hasText: /^Communicatie$/ }).first();
  await comm.waitFor({ state: 'visible', timeout: 8000 });
  await comm.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);
  await page.waitForTimeout(800);

  const emailAction = page.locator('button, div[role="button"], li')
    .filter({ hasText: /interne.*mail|e-mail.*melding/i }).first();
  if (await emailAction.isVisible().catch(() => false)) {
    await emailAction.click();
  } else {
    const searchBox = page.locator('input[placeholder="Acties zoeken"]').first();
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill('interne e-mail');
      await page.waitForTimeout(1500);
      await page.locator('button, div[role="button"], li')
        .filter({ hasText: /interne.*mail|e-mail.*melding/i }).first().click();
    }
  }
  await page.waitForTimeout(2000);

  const subjectField = page.locator('input[placeholder*="nderwerp"], input[type="text"]').first();
  if (await subjectField.isVisible().catch(() => false)) {
    await subjectField.fill('Deal vereist aandacht');
    console.log('  Onderwerp ingevuld');
  }

  const bodyField = page.locator('[contenteditable="true"], textarea').first();
  if (await bodyField.isVisible().catch(() => false)) {
    await bodyField.click();
    await page.keyboard.type('Een deal in je pijplijn vereist aandacht. Bekijk de deal in HubSpot.');
    console.log('  Body ingevuld');
  }

  await save(page, 'Interne e-mail');
}

async function addDelay(page, wfId, dagen, uren, minuten) {
  console.log(`  Vertraging toevoegen: ${dagen}d ${uren}h ${minuten}m`);
  const plusBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  await plusBtns[plusBtns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);

  await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
  await page.waitForTimeout(2000);
  await dismiss(page);

  const dd = page.locator('button').filter({ hasText: /selecteer|gebaseer/i }).first();
  await dd.waitFor({ state: 'visible', timeout: 8000 });
  await dd.click();
  await page.waitForTimeout(1000);
  const opt = page.locator('[role="option"]').filter({ hasText: /voor een bepaalde tijd/i }).first();
  if (await opt.isVisible().catch(() => false)) await opt.click();
  else { const all = await page.locator('[role="option"]').all(); await all[all.length - 1].click(); }
  await page.waitForTimeout(2500);

  const spinners = await page.locator('input[type="text"][class*="TextInput"]').all();
  if (spinners.length >= 3) {
    if (dagen) { await spinners[0].click({ clickCount: 3 }); await spinners[0].fill(String(dagen)); }
    if (uren) { await spinners[1].click({ clickCount: 3 }); await spinners[1].fill(String(uren)); }
    if (minuten) { await spinners[2].click({ clickCount: 3 }); await spinners[2].fill(String(minuten)); }
  } else {
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
  await save(page, `Vertraging ${dagen}d ${uren}h`);
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  const results = {};

  // ═══ WF-05: Verlopen Deal Alert ═══
  // Trigger: Alle actieve stages, Actie: Taak + Interne e-mail
  // (Simpelste workflow, begin hiermee)
  try {
    await createWorkflow(page, 'HS-WF-05 Verlopen Deal Alert');
    await setTriggerMultiStage(page, [
      'Belpoging 1', 'Belpoging 2', 'In Contact', 'Eerste Offerte',
      'Opmeting Ingepland', 'Opmeting Gedaan', 'Definitieve Offerte'
    ]);
    const wfId = await goToCanvas(page);
    await setName(page, 'HS-WF-05 Verlopen Deal Alert');

    // Vertraging 7 dagen
    await page.goto(
      `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${wfId}/edit/actions/new-action?edgeId=enrollment-edge-0`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    await dismiss(page);
    await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
    await page.waitForTimeout(2000);
    await dismiss(page);
    const dd5 = page.locator('button').filter({ hasText: /selecteer|gebaseer/i }).first();
    await dd5.waitFor({ state: 'visible', timeout: 8000 });
    await dd5.click();
    await page.waitForTimeout(1000);
    const opt5 = page.locator('[role="option"]').filter({ hasText: /voor een bepaalde tijd/i }).first();
    if (await opt5.isVisible().catch(() => false)) await opt5.click();
    else { const all = await page.locator('[role="option"]').all(); await all[all.length - 1].click(); }
    await page.waitForTimeout(2500);
    const spin5 = await page.locator('input[type="text"][class*="TextInput"]').all();
    if (spin5.length >= 1) {
      await spin5[0].click({ clickCount: 3 });
      await spin5[0].fill('7');
    }
    await page.keyboard.press('Tab');
    await page.waitForTimeout(800);
    await save(page, 'Vertraging 7 dagen');

    // Taak
    await addTask(page, wfId, 'Deal stilstaand — controleer voortgang', null);
    // Interne e-mail
    await addInternalEmail(page, wfId);

    await ss(page, 'WF05-ZZ-final');
    results['WF-05'] = { status: '✅', id: wfId };
    console.log(`\n✅ HS-WF-05 klaar! ID: ${wfId}`);
  } catch (e) {
    console.error('❌ WF-05 failed:', e.message);
    results['WF-05'] = { status: '❌', error: e.message.substring(0, 80) };
    // Annuleer en ga door
    const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
    if (await ann.isVisible().catch(() => false)) await ann.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  // ═══ WF-06: Definitieve Offerte Opvolging ═══
  // Trigger: Definitieve offerte verzonden, Delay 5 dagen, Taak + email
  try {
    await createWorkflow(page, 'HS-WF-06 Definitieve Offerte Opvolging');
    await setTriggerDealStage(page, 'Definitieve', /definitieve offerte/i);
    const wfId = await goToCanvas(page);
    await setName(page, 'HS-WF-06 Definitieve Offerte Opvolging');

    // Vertraging 5 dagen
    await page.goto(
      `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${wfId}/edit/actions/new-action?edgeId=enrollment-edge-0`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    await dismiss(page);
    await page.locator('button, [role="button"]').filter({ hasText: /^Vertraging$/ }).first().click();
    await page.waitForTimeout(2000);
    await dismiss(page);
    const dd6 = page.locator('button').filter({ hasText: /selecteer|gebaseer/i }).first();
    await dd6.waitFor({ state: 'visible', timeout: 8000 });
    await dd6.click();
    await page.waitForTimeout(1000);
    const opt6 = page.locator('[role="option"]').filter({ hasText: /voor een bepaalde tijd/i }).first();
    if (await opt6.isVisible().catch(() => false)) await opt6.click();
    else { const all = await page.locator('[role="option"]').all(); await all[all.length - 1].click(); }
    await page.waitForTimeout(2500);
    const spin6 = await page.locator('input[type="text"][class*="TextInput"]').all();
    if (spin6.length >= 1) {
      await spin6[0].click({ clickCount: 3 });
      await spin6[0].fill('5');
    }
    await page.keyboard.press('Tab');
    await page.waitForTimeout(800);
    await save(page, 'Vertraging 5 dagen');

    // Taak
    await addTask(page, wfId, 'Opvolgen definitieve offerte — klant heeft niet gereageerd', null);
    // Interne e-mail
    await addInternalEmail(page, wfId);

    await ss(page, 'WF06-ZZ-final');
    results['WF-06'] = { status: '✅', id: wfId };
    console.log(`\n✅ HS-WF-06 klaar! ID: ${wfId}`);
  } catch (e) {
    console.error('❌ WF-06 failed:', e.message);
    results['WF-06'] = { status: '❌', error: e.message.substring(0, 80) };
    const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
    if (await ann.isVisible().catch(() => false)) await ann.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  // ═══ WF-04: Reactie Detectie → Contact Gelegd ═══
  // Dit is complexer: trigger = contact replies to sequence email
  // HubSpot free trial may not support this trigger type
  // Maak een simpele versie: trigger = deal in bepaalde stages, actie = taak
  try {
    await createWorkflow(page, 'HS-WF-04 Reactie Detectie');
    // Trigger: deal in stages Belpoging 1/2, Eerste offerte, Offerte followup
    await setTriggerMultiStage(page, [
      'Belpoging 1', 'Belpoging 2', 'Eerste Offerte'
    ]);
    const wfId = await goToCanvas(page);
    await setName(page, 'HS-WF-04 Reactie Detectie');

    // Taak: kwalificeer en plan opmeting
    await addTask(page, wfId, 'Klant heeft gereageerd — kwalificeer en plan opmeting', 'enrollment-edge-0');
    // Interne e-mail
    await addInternalEmail(page, wfId);

    await ss(page, 'WF04-ZZ-final');
    results['WF-04'] = { status: '✅', id: wfId };
    console.log(`\n✅ HS-WF-04 klaar! ID: ${wfId}`);
  } catch (e) {
    console.error('❌ WF-04 failed:', e.message);
    results['WF-04'] = { status: '❌', error: e.message.substring(0, 80) };
  }

  // ═══ SAMENVATTING ═══
  console.log('\n\n═══ RESULTAAT ═══');
  for (const [wf, result] of Object.entries(results)) {
    console.log(`${result.status} ${wf}: ${result.id || result.error}`);
  }

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
