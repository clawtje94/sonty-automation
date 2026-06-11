const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

const ZAPS_TO_CREATE = [
  { id: 'ZAP-05', name: 'ZAP-05: Definitieve Offerte Verstuurd' },
  { id: 'ZAP-06', name: 'ZAP-06: Offerte Akkoord' },
  { id: 'ZAP-08', name: 'ZAP-08: Installatie Ingepland' },
];

async function createZap(context, zapInfo, index) {
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const prefix = zapInfo.id.replace('-', '');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 ${zapInfo.id}: "${zapInfo.name}" aanmaken (${index + 1}/${ZAPS_TO_CREATE.length})`);
  console.log('='.repeat(60));

  // 1. Open new blank zap editor
  console.log('\n--- Stap 1: Nieuwe zap openen ---');
  await page.goto('https://zapier.com/app/editor/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, `${prefix}-01-editor-loaded`);

  // Dismiss any popup/modal
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // 2. Select HubSpot as trigger app
  console.log('\n--- Stap 2: HubSpot trigger selecteren ---');

  // The editor should show "Select the event that starts your Zap" or a search field
  // Look for a search input to search for HubSpot
  let searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    await searchInput.fill('HubSpot');
    await page.waitForTimeout(3000);
    await ss(page, `${prefix}-02-hubspot-search`);
  } else {
    // Try clicking on the trigger step first
    const triggerStep = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === 'Select the event that starts your Zap' || text === '1. Trigger') {
          const rect = el.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (triggerStep) {
      await page.mouse.click(triggerStep.x, triggerStep.y);
      await page.waitForTimeout(3000);
    }

    // Try search again
    searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('HubSpot');
      await page.waitForTimeout(3000);
      await ss(page, `${prefix}-02-hubspot-search`);
    }
  }

  // Click HubSpot in search results
  const hubspotResult = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text === 'HubSpot') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 150 && rect.width > 30 && rect.height > 10 && rect.height < 60) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (hubspotResult) {
    await page.mouse.click(hubspotResult.x, hubspotResult.y);
    console.log('  HubSpot geselecteerd');
    await page.waitForTimeout(4000);
    await ss(page, `${prefix}-03-hubspot-selected`);
  } else {
    console.log('  ⚠️ HubSpot niet gevonden in zoekresultaten');
    await ss(page, `${prefix}-03-hubspot-not-found`);
  }

  // 3. Select "Updated Deal Stage" event
  console.log('\n--- Stap 3: Updated Deal Stage event selecteren ---');

  // Look for event search or event list
  const eventSearch = page.locator('input[placeholder*="Search"]').first();
  if (await eventSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
    await eventSearch.fill('Updated Deal Stage');
    await page.waitForTimeout(3000);
    await ss(page, `${prefix}-04-event-search`);
  }

  const eventResult = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text.includes('Updated Deal Stage')) {
        const rect = el.getBoundingClientRect();
        if (rect.y > 150 && rect.width > 30) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (eventResult) {
    await page.mouse.click(eventResult.x, eventResult.y);
    console.log('  Updated Deal Stage geselecteerd');
    await page.waitForTimeout(4000);
    await ss(page, `${prefix}-05-event-selected`);
  } else {
    console.log('  ⚠️ Updated Deal Stage niet gevonden');
    await ss(page, `${prefix}-05-event-not-found`);
  }

  // 4. Account should auto-connect, click Continue if visible
  console.log('\n--- Stap 4: Account & Continue ---');
  await page.waitForTimeout(3000);

  // Click Continue buttons (there may be multiple: account, configure, etc.)
  for (let attempt = 0; attempt < 3; attempt++) {
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await continueBtn.evaluate(el => el.disabled).catch(() => true);
      if (!disabled) {
        await continueBtn.click({ force: true });
        console.log(`  Continue geklikt (poging ${attempt + 1})`);
        await page.waitForTimeout(4000);
        await ss(page, `${prefix}-06-continue-${attempt + 1}`);
      } else {
        console.log(`  Continue is disabled (poging ${attempt + 1})`);
        break;
      }
    } else {
      console.log(`  Geen Continue knop zichtbaar (poging ${attempt + 1})`);
      break;
    }
  }

  await ss(page, `${prefix}-07-trigger-configured`);

  // 5. Rename the zap
  console.log('\n--- Stap 5: Zap hernoemen ---');

  const namePos = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Untitled Zap') {
        const rect = el.getBoundingClientRect();
        if (rect.y < 80 && rect.width > 50) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (namePos) {
    await page.mouse.click(namePos.x, namePos.y);
    await page.waitForTimeout(2000);

    // Look for "Rename" menu item
    const renameItem = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Rename') {
          const rect = el.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (renameItem) {
      await page.mouse.click(renameItem.x, renameItem.y);
      await page.waitForTimeout(1000);
    }

    // Type the new name (clear first with triple-click select all)
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(300);
    await page.keyboard.type(zapInfo.name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    console.log(`  Hernoemd naar: ${zapInfo.name}`);
    await ss(page, `${prefix}-08-renamed`);
  } else {
    console.log('  ⚠️ "Untitled Zap" tekst niet gevonden voor hernoemen');
  }

  // 6. Save session state
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log(`  Sessie opgeslagen`);

  // Final status
  await ss(page, `${prefix}-final`);
  const finalUrl = page.url();
  console.log(`  URL: ${finalUrl}`);

  // Extract zap ID from URL
  const zapIdMatch = finalUrl.match(/\/editor\/(\d+)/);
  if (zapIdMatch) {
    console.log(`  ✅ ${zapInfo.id} aangemaakt met Zapier ID: ${zapIdMatch[1]}`);
  }

  await page.close();
  return finalUrl;
}

(async () => {
  console.log('🚀 Remaining zaps aanmaken: ZAP-05, ZAP-06, ZAP-08');
  console.log(`Sessie: ${ZAPIER_SESSION}`);

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });

  const results = [];

  for (let i = 0; i < ZAPS_TO_CREATE.length; i++) {
    try {
      const url = await createZap(context, ZAPS_TO_CREATE[i], i);
      results.push({ ...ZAPS_TO_CREATE[i], url, status: 'OK' });
    } catch (err) {
      console.error(`\n❌ Fout bij ${ZAPS_TO_CREATE[i].id}: ${err.message}`);
      results.push({ ...ZAPS_TO_CREATE[i], url: null, status: `FOUT: ${err.message}` });
      // Save session even on error
      const storageState = await context.storageState();
      fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
    }

    // Small pause between zaps
    if (i < ZAPS_TO_CREATE.length - 1) {
      console.log('\n⏳ 5 seconden wachten voor volgende zap...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SAMENVATTING');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`  ${r.id}: ${r.status} — ${r.url || 'geen URL'}`);
  }

  // Final session save
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('\n✅ Sessie definitief opgeslagen');

  await context.close();
  await browser.close();
})();
