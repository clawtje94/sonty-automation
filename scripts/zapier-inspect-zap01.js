const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 stappen inspecteren');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Dismiss "Got it" popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Click on step 1 card via the canvas
  console.log('\n--- STEP 1: Reuzenpanda Lead Created ---');
  const step1Card = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: 'Lead Created' }).first();
  const step1Alt = page.locator('div').filter({ hasText: /^1\. Lead Created/ }).first();

  // Try clicking on the step text in canvas
  try {
    await page.click('text=1. Lead Created', { timeout: 5000 });
  } catch {
    try {
      await page.click('text=Lead Created (Reuzenpanda CRM)', { timeout: 5000 });
    } catch {
      console.log('  Kon step 1 niet klikken');
    }
  }
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-INS-step1');

  // Read the right panel
  let panelText = await page.evaluate(() => {
    // Find the rightmost panel/sidebar
    const allDivs = document.querySelectorAll('div');
    let rightPanel = null;
    for (const d of allDivs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && rect.height > 200 && d.innerText.length > 50) {
        if (!rightPanel || d.innerText.length > rightPanel.innerText.length) {
          rightPanel = d;
        }
      }
    }
    return rightPanel ? rightPanel.innerText.substring(0, 1000) : 'No panel found';
  });
  console.log('Panel:', panelText.substring(0, 400));

  // Click on step 3 card
  console.log('\n--- STEP 3: Create Deal ---');
  try {
    await page.click('text=3. Create Deal', { timeout: 5000 });
  } catch {
    try {
      // Try the ⋮ menu area near "Create Deal"
      const cards = page.locator('div').filter({ hasText: 'Create Deal' });
      const count = await cards.count();
      for (let i = 0; i < Math.min(count, 10); i++) {
        const card = cards.nth(i);
        const text = await card.innerText().catch(() => '');
        if (text.includes('3.') && text.includes('Create Deal') && text.length < 100) {
          await card.click({ timeout: 3000 });
          break;
        }
      }
    } catch {
      console.log('  Kon step 3 niet klikken');
    }
  }
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-INS-step3');

  panelText = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    let rightPanel = null;
    for (const d of allDivs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && rect.height > 200 && d.innerText.length > 50) {
        if (!rightPanel || d.innerText.length > rightPanel.innerText.length) {
          rightPanel = d;
        }
      }
    }
    return rightPanel ? rightPanel.innerText.substring(0, 1500) : 'No panel found';
  });
  console.log('Panel:', panelText.substring(0, 600));

  // Check step 4 too
  console.log('\n--- STEP 4: Create Associations ---');
  try {
    await page.click('text=4. Create Associations', { timeout: 5000 });
  } catch {
    console.log('  Kon step 4 niet klikken');
  }
  await page.waitForTimeout(3000);
  await ss(page, 'Z01-INS-step4');

  panelText = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    let rightPanel = null;
    for (const d of allDivs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 800 && rect.width > 200 && rect.height > 200 && d.innerText.length > 50) {
        if (!rightPanel || d.innerText.length > rightPanel.innerText.length) {
          rightPanel = d;
        }
      }
    }
    return rightPanel ? rightPanel.innerText.substring(0, 1500) : 'No panel found';
  });
  console.log('Panel:', panelText.substring(0, 600));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
