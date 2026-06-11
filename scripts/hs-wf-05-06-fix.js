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
  console.log(`  ${btns.length} + knoppen`);
  if (btns.length === 0) throw new Error('Geen + knop gevonden');
  await btns[btns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);
}

async function addTaskViaPlus(page, titel) {
  console.log(`  Taak: "${titel}"`);
  await clickLastPlus(page);

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
  } else {
    const ce = page.locator('[contenteditable="true"]').first();
    if (await ce.isVisible().catch(() => false)) {
      await ce.click();
      await page.keyboard.press('Meta+a');
      await page.keyboard.type(titel);
    }
  }
  await page.waitForTimeout(500);
  await save(page, 'Taak');
}

async function addEmailViaPlus(page, onderwerp, body) {
  console.log('  Interne e-mail...');
  await clickLastPlus(page);

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
    await subjectField.fill(onderwerp);
  }
  const bodyField = page.locator('[contenteditable="true"], textarea').first();
  if (await bodyField.isVisible().catch(() => false)) {
    await bodyField.click();
    await page.keyboard.type(body);
  }
  await save(page, 'Interne e-mail');
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  // ═══ FIX WF-05 (ID: 3912346823) ═══
  console.log('🎬 Fix WF-05 Verlopen Deal Alert');
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/3912346823/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  const ann1 = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await ann1.isVisible().catch(() => false)) { await ann1.click(); await page.waitForTimeout(2000); }
  await ss(page, 'WF05F-00');

  await addTaskViaPlus(page, 'Deal stilstaand — controleer voortgang');
  await addEmailViaPlus(page, 'Deal stilstaand', 'Een deal staat al 7 dagen in dezelfde fase. Bekijk de deal in HubSpot.');
  await ss(page, 'WF05F-ZZ');
  console.log('✅ WF-05 klaar!\n');

  // ═══ FIX WF-06 (ID: 3912346824) ═══
  console.log('🎬 Fix WF-06 Definitieve Offerte Opvolging');
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/3912346824/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  const ann2 = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await ann2.isVisible().catch(() => false)) { await ann2.click(); await page.waitForTimeout(2000); }
  await ss(page, 'WF06F-00');

  await addTaskViaPlus(page, 'Opvolgen definitieve offerte — klant heeft niet gereageerd');
  await addEmailViaPlus(page, 'Definitieve offerte opvolgen', 'Klant heeft na 5 dagen niet gereageerd op de definitieve offerte. Neem contact op.');
  await ss(page, 'WF06F-ZZ');
  console.log('✅ WF-06 klaar!');

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
