const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const WF_ID = '3911111914'; // WF-03 already created
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
  console.log('🎬 HS-WF-03 Continue — Vertakking + Taak');

  // Open de workflow
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'WF03C-00-canvas');

  // Annuleer incomplete actie als nodig
  const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await ann.isVisible().catch(() => false)) { await ann.click(); await page.waitForTimeout(2000); }

  // ══ VERTAKKING TOEVOEGEN ══
  console.log('\n[1] Vertakking toevoegen...');
  // Klik de laatste + knop (na de vertraging)
  const plusBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns.length} + knoppen`);
  if (plusBtns.length > 0) {
    await plusBtns[plusBtns.length - 1].click();
    await page.waitForTimeout(2500);
    await dismiss(page);
  }
  await ss(page, 'WF03C-01-panel');

  // Klik "Vertakking"
  const vertakking = page.locator('button, [role="button"], div')
    .filter({ hasText: /^Vertakking$/ }).first();
  await vertakking.waitFor({ state: 'visible', timeout: 8000 });
  await vertakking.click();
  await page.waitForTimeout(2000);
  await dismiss(page);
  await ss(page, 'WF03C-01-vertakking');

  // Er verschijnt een config panel voor de vertakking
  // We moeten een filter toevoegen: Stadium deal = Eerste offerte verzonden
  // Zoek de "filter toevoegen" knop of het filter panel

  // Wacht op het config panel
  await page.waitForTimeout(2000);
  await ss(page, 'WF03C-01-config');

  // Zoek een knop/link om een filter toe te voegen
  const addFilterBtn = page.locator('button, a, [role="button"]')
    .filter({ hasText: /filter|conditie|voorwaarde|eigenschap/i }).first();
  if (await addFilterBtn.isVisible().catch(() => false)) {
    console.log('  Filter knop gevonden, klikken...');
    await addFilterBtn.click();
    await page.waitForTimeout(2000);
  }

  // Als er een dropdown/zoek verschijnt voor deal eigenschappen
  const propSearch = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').first();
  if (await propSearch.isVisible().catch(() => false)) {
    await propSearch.fill('stadium');
    await page.waitForTimeout(1500);
    const stadiumOpt = page.locator('li, [role="option"], div, span')
      .filter({ hasText: /stadium deal/i }).first();
    if (await stadiumOpt.isVisible().catch(() => false)) {
      await stadiumOpt.click();
      await page.waitForTimeout(1500);
    }
  }
  await ss(page, 'WF03C-01-prop-selected');

  // Selecteer de waarde
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
    // Sluit dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await ss(page, 'WF03C-01-branch-done');
  await save(page, 'Vertakking');

  // ══ TAAK IN YES BRANCH ══
  console.log('\n[2] Taak in YES branch...');
  await page.waitForTimeout(2000);
  await dismiss(page);

  // Na vertakking opslaan: er zijn nu twee paden (YES en "Alle andere")
  // Zoek de + knoppen opnieuw
  const plusBtns2 = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns2.length} + knoppen na vertakking`);

  // De YES branch + knop is waarschijnlijk de eerste na de vertakking
  // Klik de eerste + knop
  if (plusBtns2.length > 0) {
    await plusBtns2[0].click();
    await page.waitForTimeout(2500);
    await dismiss(page);
  }
  await ss(page, 'WF03C-02-panel');

  // CRM > Taak aanmaken
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
  await ss(page, 'WF03C-02-task');
  await save(page, 'Taak YES branch');

  // ══ KLAAR ══
  await ss(page, 'WF03C-ZZ-final');
  console.log('\n✅ HS-WF-03 compleet!');
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
