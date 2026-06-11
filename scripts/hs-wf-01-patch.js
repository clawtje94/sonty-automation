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
}
async function slaOp(page, naam) {
  const btn = page.locator('button').filter({ hasText: /opslaan/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(3000);
  console.log(`  ✅ ${naam}`);
}

// Verwijder actie via het 3-dots "Acties" menu op een specifieke kaart
async function verwijderActieByIndex(page, cardIndex) {
  // Zoek alle "Acties" menu-knoppen (per actie kaart)
  // Elke action card heeft een "Acties" menu knop
  const actieMenus = await page.locator('button[aria-label="Acties"]').all();
  console.log(`  Actie-menus: ${actieMenus.length}`);

  // Klik het juiste menu (0-indexed)
  if (cardIndex < actieMenus.length && await actieMenus[cardIndex].isVisible().catch(() => false)) {
    await actieMenus[cardIndex].click();
    await page.waitForTimeout(800);
    const delOpt = page.locator('[role="menuitem"], button, li')
      .filter({ hasText: /verwijderen|delete/i }).first();
    if (await delOpt.isVisible().catch(() => false)) {
      await delOpt.click();
      await page.waitForTimeout(1000);
      const confirmDel = page.locator('button').filter({ hasText: /verwijder|delete|ja/i }).first();
      if (await confirmDel.isVisible().catch(() => false)) {
        await confirmDel.click();
        await page.waitForTimeout(2000);
      }
      console.log(`  🗑️ Actie ${cardIndex} verwijderd`);
      return true;
    }
    await page.keyboard.press('Escape');
  }
  return false;
}

async function scrollPanel(page) {
  await page.evaluate(() => {
    document.querySelectorAll('div[class*="scroll"], div[style*="overflow"], aside')
      .forEach(el => el.scrollTop = el.scrollHeight);
  });
  await page.waitForTimeout(500);
}

async function klikNieuweActie(page) {
  const addBtns = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  if (addBtns.length === 0) throw new Error('Geen + knop');
  await addBtns[addBtns.length - 1].click();
  await page.waitForTimeout(2500);
  await dismissOverlays(page);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Patch gestart');

  // ══ 0. CANVAS ══
  console.log('\n[0] Canvas openen...');
  await page.goto(
    `https://app-eu1.hubspot.com/workflows/${PORTAL_ID}/platform/flow/${WF_ID}/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismissOverlays(page);

  // Annuleer onafgemaakte actie
  const annBtn = page.locator('button').filter({ hasText: /^Annuleren$/ }).first();
  if (await annBtn.isVisible().catch(() => false)) {
    await annBtn.click();
    await page.waitForTimeout(2000);
  }
  await ss(page, 'P-00-canvas');

  // ══ LOG ALLE ACTIES ══
  const cards = await page.locator('[data-test-id*="card-details-toggle"]').all();
  console.log(`  ${cards.length} actie kaarten gevonden`);
  for (let i = 0; i < cards.length; i++) {
    const txt = await cards[i].locator('..').innerText().catch(() => '');
    console.log(`  [${i}] ${txt.substring(0, 60)}`);
  }

  // ══ STAP 1: FIX TAAK 2 (ontbrekende titel) ══
  console.log('\n[1] Fix Taak 2 (titel toevoegen)...');
  // Klik op "Taak aanmaken" kaart (actie 2)
  const taak2 = page.locator('div').filter({ hasText: /^2\. Taak aanmaken/ }).first();
  if (await taak2.isVisible().catch(() => false)) {
    await taak2.click();
    await page.waitForTimeout(2000);
    await ss(page, 'P-01-taak2');

    // Nu zou het config panel open moeten zijn
    // Gebruik getByLabel voor het Titel veld
    const titelVeld = page.getByLabel('Titel');
    if (await titelVeld.isVisible().catch(() => false)) {
      await titelVeld.click();
      await titelVeld.fill('Bel contact – Poging 1');
      console.log('  Titel ingevuld via getByLabel');
    } else {
      // Fallback: zoek input element dat BOVEN type dropdown staat
      const inputs = await page.locator('input:visible').all();
      for (const inp of inputs) {
        const val = await inp.inputValue().catch(() => '---');
        const placeholder = await inp.getAttribute('placeholder').catch(() => '');
        // Titel-veld is leeg, geen placeholder, niet een spinner
        if (val === '' && !placeholder) {
          await inp.click();
          await inp.fill('Bel contact – Poging 1');
          console.log('  Titel ingevuld via lege input');
          break;
        }
      }
    }
    await page.waitForTimeout(500);

    // Type naar Bellen
    const typeDD = page.locator('button, select').filter({ hasText: /to-do/i }).first();
    if (await typeDD.isVisible().catch(() => false)) {
      await typeDD.click();
      await page.waitForTimeout(500);
      const belOpt = page.locator('[role="option"], option').filter({ hasText: /bellen|call/i }).first();
      if (await belOpt.isVisible().catch(() => false)) {
        await belOpt.click();
        await page.waitForTimeout(500);
      }
    }

    await ss(page, 'P-01-filled');
    await slaOp(page, 'Taak 2 titel');
  } else {
    console.log('  ⚠️ Taak 2 niet gevonden, skip');
  }

  // ══ STAP 2: VERWIJDER ACTIE 3 (Eigenschapswaarde verhogen — fout) ══
  console.log('\n[2] Verwijder foute actie 3...');
  // Zoek de "Eigenschapswaarde" kaart
  const eigenFout = page.locator('div').filter({ hasText: /eigenschapswaarde/i }).first();
  if (await eigenFout.isVisible().catch(() => false)) {
    await eigenFout.click();
    await page.waitForTimeout(1000);
    // Klik trash icon op deze kaart
    // Via de 3-dots menu
    await verwijderActieByIndex(page, 2); // 3e menu (0-indexed: 2)
    // Herlees canvas
    await page.waitForTimeout(2000);
  }
  await ss(page, 'P-02-after-delete');

  // ══ STAP 3: VOEG "Record bewerken" TOE (Stadium = Belpoging 1) ══
  console.log('\n[3] Record bewerken → Belpoging 1...');
  // Klik de + knop NA actie 2 (Taak Poging 1)
  const addBtns3 = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  console.log(`  + knoppen: ${addBtns3.length}`);
  // Klik de 2e + knop (na Vertraging, na Taak) = index 1
  if (addBtns3.length >= 2) {
    await addBtns3[1].click();
  } else {
    await addBtns3[addBtns3.length - 1].click();
  }
  await page.waitForTimeout(2500);
  await dismissOverlays(page);

  // Klik CRM categorie
  const crm3 = page.locator('div, span, button').filter({ hasText: /^CRM$/ }).first();
  await crm3.waitFor({ state: 'visible', timeout: 8000 });
  await crm3.click();
  await page.waitForTimeout(800);
  await scrollPanel(page);
  await page.waitForTimeout(800);
  await ss(page, 'P-03-crm');

  // Klik specifiek "Record bewerken" (NIET "Eigenschapswaarde")
  const recordBewerken = page.locator('button, div[role="button"], li')
    .filter({ hasText: /record bewerken/i }).first();
  if (await recordBewerken.isVisible().catch(() => false)) {
    await recordBewerken.click();
  } else {
    console.log('  ⚠️ "Record bewerken" niet gevonden');
    await ss(page, 'P-03-NOT-FOUND');
    // Probeer alle items te loggen
    const allItems = await page.locator('button, div[role="button"], li').allInnerTexts();
    const relevant = allItems.filter(t => t.trim().length > 0 && t.trim().length < 80);
    console.log('  Items:', relevant.slice(0, 30));
  }
  await page.waitForTimeout(2000);
  await ss(page, 'P-03-config');

  // Config: kies eigenschap
  const propDD3 = page.locator('button, select, [role="combobox"]')
    .filter({ hasText: /eigenschap.*keizen|een eigenschap/i }).first();
  if (await propDD3.isVisible().catch(() => false)) {
    await propDD3.click();
    await page.waitForTimeout(1000);
    // Zoek "Stadium deal"
    const searchInDropdown = page.locator('input[placeholder*="oek"], input[type="search"]').last();
    if (await searchInDropdown.isVisible().catch(() => false)) {
      await searchInDropdown.fill('stadium');
      await page.waitForTimeout(1000);
    }
    await page.locator('[role="option"], li').filter({ hasText: /stadium deal/i }).first().click();
    await page.waitForTimeout(1000);
    await ss(page, 'P-03-prop-selected');
  }

  // Kies waarde "Belpoging 1"
  const valDD3 = page.locator('button, select, [role="combobox"]')
    .filter({ hasText: /selecteer|een waarde/i }).first();
  if (await valDD3.isVisible().catch(() => false)) {
    await valDD3.click();
    await page.waitForTimeout(1000);
    const searchVal = page.locator('input[placeholder*="oek"], input[type="search"]').last();
    if (await searchVal.isVisible().catch(() => false)) {
      await searchVal.fill('Belpoging');
      await page.waitForTimeout(1000);
    }
    await page.locator('[role="option"], li, label').filter({ hasText: /belpoging 1/i }).first().click();
    await page.waitForTimeout(500);
  }

  await ss(page, 'P-03-filled');
  await slaOp(page, 'Record bewerken Belpoging 1');

  // ══ STAP 4: FIX TAAK 5 (ontbrekende titel) ══
  console.log('\n[4] Fix Taak 5 (titel)...');
  const taak5 = page.locator('div').filter({ hasText: /Taak aanmaken/ })
    .filter({ hasText: /ontbrekende titel|wijzigingen/i }).last();
  if (await taak5.isVisible().catch(() => false)) {
    await taak5.click();
    await page.waitForTimeout(2000);

    const titelVeld5 = page.getByLabel('Titel');
    if (await titelVeld5.isVisible().catch(() => false)) {
      await titelVeld5.click();
      await titelVeld5.fill('Bel contact – Poging 2');
    } else {
      const inputs5 = await page.locator('input:visible').all();
      for (const inp of inputs5) {
        const val = await inp.inputValue().catch(() => '---');
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        if (val === '' && !ph) {
          await inp.click();
          await inp.fill('Bel contact – Poging 2');
          break;
        }
      }
    }
    await slaOp(page, 'Taak 5 titel');
  }

  // ══ STAP 5: VERWIJDER + VERVANAG FOUTE ACTIE 6 ══
  console.log('\n[5] Fix actie 6 (Record bewerken Belpoging 2)...');
  // Zoek de tweede "Eigenschapswaarde" of "Record bewerken" met fout
  const eigenFout6 = page.locator('div').filter({ hasText: /eigenschapswaarde|kies een eigenschap/i }).last();
  if (await eigenFout6.isVisible().catch(() => false)) {
    await eigenFout6.click();
    await page.waitForTimeout(1000);

    // Verwijder via het laatste Acties menu
    const actieMenus6 = await page.locator('button[aria-label="Acties"]').all();
    if (actieMenus6.length > 0) {
      await actieMenus6[actieMenus6.length - 1].click();
      await page.waitForTimeout(800);
      const delOpt = page.locator('[role="menuitem"], button, li')
        .filter({ hasText: /verwijderen|delete/i }).first();
      if (await delOpt.isVisible().catch(() => false)) {
        await delOpt.click();
        await page.waitForTimeout(1000);
        const conf = page.locator('button').filter({ hasText: /verwijder|ja/i }).first();
        if (await conf.isVisible().catch(() => false)) await conf.click();
        await page.waitForTimeout(2000);
        console.log('  🗑️ Actie 6 verwijderd');
      } else {
        await page.keyboard.press('Escape');
      }
    }
  }

  // Voeg "Record bewerken" toe voor Belpoging 2
  const addBtns6 = await page.locator('[aria-label="Nieuwe actie toevoegen"]').all();
  if (addBtns6.length > 0) {
    await addBtns6[addBtns6.length - 1].click();
    await page.waitForTimeout(2500);
    await dismissOverlays(page);

    const crm6 = page.locator('div, span, button').filter({ hasText: /^CRM$/ }).first();
    await crm6.waitFor({ state: 'visible', timeout: 8000 });
    await crm6.click();
    await page.waitForTimeout(800);
    await scrollPanel(page);
    await page.waitForTimeout(800);

    const rb6 = page.locator('button, div[role="button"], li')
      .filter({ hasText: /record bewerken/i }).first();
    if (await rb6.isVisible().catch(() => false)) {
      await rb6.click();
      await page.waitForTimeout(2000);

      // Config eigenschap
      const propDD6 = page.locator('button, select, [role="combobox"]')
        .filter({ hasText: /eigenschap.*keizen|een eigenschap/i }).first();
      if (await propDD6.isVisible().catch(() => false)) {
        await propDD6.click();
        await page.waitForTimeout(1000);
        const sd = page.locator('input[placeholder*="oek"], input[type="search"]').last();
        if (await sd.isVisible().catch(() => false)) { await sd.fill('stadium'); await page.waitForTimeout(1000); }
        await page.locator('[role="option"], li').filter({ hasText: /stadium deal/i }).first().click();
        await page.waitForTimeout(1000);
      }
      const valDD6 = page.locator('button, select, [role="combobox"]')
        .filter({ hasText: /selecteer|een waarde/i }).first();
      if (await valDD6.isVisible().catch(() => false)) {
        await valDD6.click();
        await page.waitForTimeout(1000);
        const sv6 = page.locator('input[placeholder*="oek"], input[type="search"]').last();
        if (await sv6.isVisible().catch(() => false)) { await sv6.fill('Belpoging'); await page.waitForTimeout(1000); }
        await page.locator('[role="option"], li, label').filter({ hasText: /belpoging 2/i }).first().click();
        await page.waitForTimeout(500);
      }

      await slaOp(page, 'Record bewerken Belpoging 2');
    }
  }

  // ══ KLAAR ══
  await ss(page, 'P-ZZ-final');
  console.log('\n✅ Patch compleet!');
  console.log('📹 Video:', VIDEO_DIR);
  console.log('🔗', page.url());

  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
})();
