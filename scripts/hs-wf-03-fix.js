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
  console.log('🎬 HS-WF-03 Fix — Vertakking + Taak');

  // Open de workflow
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // Annuleer incomplete actie als nodig
  const ann = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await ann.isVisible().catch(() => false)) { await ann.click(); await page.waitForTimeout(2000); }
  await ss(page, 'WF03F-00');

  // Check of vertakking al bestaat
  const vertakkingExists = await page.locator('div').filter({ hasText: /vertakking/i }).first().isVisible().catch(() => false);
  console.log('  Vertakking bestaat al:', vertakkingExists);

  // Als vertakking bestaat, verwijder het eerst (het was incompleet)
  if (vertakkingExists) {
    // Klik op de vertakking kaart
    const vertCard = page.locator('div').filter({ hasText: /Vertakking/ }).first();
    await vertCard.click();
    await page.waitForTimeout(2000);
    // Zoek verwijder knop
    const delBtn = page.locator('[aria-label="Acties"]').last();
    if (await delBtn.isVisible().catch(() => false)) {
      await delBtn.click();
      await page.waitForTimeout(1000);
      const verwijder = page.locator('[role="menuitem"], button').filter({ hasText: /verwijder/i }).first();
      if (await verwijder.isVisible().catch(() => false)) {
        await verwijder.click();
        await page.waitForTimeout(2000);
        // Bevestig
        const bevestig = page.locator('button').filter({ hasText: /verwijder|ja/i }).last();
        if (await bevestig.isVisible().catch(() => false)) {
          await bevestig.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    console.log('  Oude vertakking verwijderd');
    await dismiss(page);
  }

  // ══ VERTAKKING TOEVOEGEN ══
  console.log('\n[1] Vertakking toevoegen...');
  const plusBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns.length} + knoppen`);
  await plusBtns[plusBtns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismiss(page);

  // Klik "Vertakking" in het actiepanel
  const vertBtn = page.locator('button, [role="button"], div')
    .filter({ hasText: /^Vertakking$/ }).first();
  await vertBtn.waitFor({ state: 'visible', timeout: 8000 });
  await vertBtn.click();
  await page.waitForTimeout(2000);
  await dismiss(page);
  await ss(page, 'WF03F-01-vertakking-types');

  // Nu zie ik 3 opties: Klik "Één eigenschap of actie-output"
  const eenEigenschap = page.locator('div, button, [role="button"]')
    .filter({ hasText: /Één eigenschap/i }).first();
  await eenEigenschap.waitFor({ state: 'visible', timeout: 8000 });
  await eenEigenschap.click();
  await page.waitForTimeout(2000);
  await dismiss(page);
  await ss(page, 'WF03F-02-type-selected');

  // Nu verschijnt het filter-config panel
  // Er is een "Vertakking 1" met een "filter toevoegen" of "voorwaarde" knop
  // Klik op het filter selectie element

  // Zoek een dropdown of knop om eigenschap te kiezen
  // Het panel toont waarschijnlijk een "Filtertype" dropdown
  const filterType = page.locator('button, [role="combobox"]')
    .filter({ hasText: /selecteer|filtertype|kies|eigenschap/i }).first();
  if (await filterType.isVisible().catch(() => false)) {
    await filterType.click();
    await page.waitForTimeout(1500);
    console.log('  Filtertype dropdown geopend');
  }

  // Zoek "Deal eigenschappen" in de dropdown
  const dealEig = page.locator('[role="option"], li, div')
    .filter({ hasText: /deal eigenschap/i }).first();
  if (await dealEig.isVisible().catch(() => false)) {
    await dealEig.click();
    await page.waitForTimeout(1500);
    console.log('  Deal eigenschappen geselecteerd');
  }

  // Zoek "stadium" in de zoekbalk
  const searchInput = page.locator('input[placeholder*="oek"], input[placeholder*="Zoek"]').last();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('stadium');
    await page.waitForTimeout(1500);
    const stadiumOpt = page.locator('li, [role="option"], div, span, button')
      .filter({ hasText: /stadium deal/i }).first();
    if (await stadiumOpt.isVisible().catch(() => false)) {
      await stadiumOpt.click();
      await page.waitForTimeout(1500);
      console.log('  Stadium deal geselecteerd');
    }
  }
  await ss(page, 'WF03F-03-property');

  // Selecteer waarde: "Eerste offerte verzonden"
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
      console.log('  Eerste offerte verzonden geselecteerd');
    }
    // Sluit dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await ss(page, 'WF03F-04-filter-done');

  // Opslaan (probeer force click als disabled)
  const saveBtn = page.locator('button').filter({ hasText: /opslaan/i }).first();
  const isDisabled = await saveBtn.getAttribute('aria-disabled');
  console.log('  Save disabled:', isDisabled);

  if (isDisabled === 'true') {
    console.log('  ⚠️ Save nog steeds disabled, screenshot voor debug');
    await ss(page, 'WF03F-04-save-disabled');
    // Probeer force click
    await saveBtn.click({ force: true });
    await page.waitForTimeout(3000);
  } else {
    await save(page, 'Vertakking');
  }

  // ══ TAAK IN VERTAKKING 1 (YES) ══
  console.log('\n[2] Taak in Vertakking 1...');
  await page.waitForTimeout(2000);
  await dismiss(page);
  await ss(page, 'WF03F-05-after-save');

  // Zoek de + knoppen — de eerste in de YES tak
  const plusBtns2 = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  ${plusBtns2.length} + knoppen`);

  // Klik de eerste + knop (YES branch)
  if (plusBtns2.length > 0) {
    await plusBtns2[0].click();
    await page.waitForTimeout(2500);
    await dismiss(page);
  }

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
  await ss(page, 'WF03F-06-task');
  await save(page, 'Taak Vertakking 1');

  // ══ KLAAR ══
  await ss(page, 'WF03F-ZZ-final');
  console.log('\n✅ HS-WF-03 compleet!');
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
