const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`), fullPage: false });
  console.log(`  ss: ${name}`);
}

async function readPanel(page) {
  return await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    let rightPanel = null;
    for (const d of allDivs) {
      const rect = d.getBoundingClientRect();
      if (rect.left > 600 && rect.width > 200 && rect.height > 200 && d.innerText.length > 50) {
        if (!rightPanel || d.innerText.length > rightPanel.innerText.length) {
          rightPanel = d;
        }
      }
    }
    return rightPanel ? rightPanel.innerText.substring(0, 2000) : 'No panel found';
  });
}

async function dismissPopups(page) {
  for (const label of ['Got it', 'Dismiss', 'Close', 'Skip']) {
    const btn = page.locator('button').filter({ hasText: new RegExp(label, 'i') }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('=== ZAP-01 Configuration Check ===');

  // Navigate to the zap editor
  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  await dismissPopups(page);
  await ss(page, 'Z01-check-overview');

  // Get the overview: page text and all visible steps
  const overviewText = await page.evaluate(() => document.body.innerText.substring(0, 4000));
  console.log('\n--- PAGE OVERVIEW ---');
  console.log(overviewText.substring(0, 1500));
  console.log('\nCurrent URL:', page.url());

  // Detect steps in the canvas by looking for numbered labels
  const stepLabels = await page.evaluate(() => {
    const results = [];
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const t = el.innerText || '';
      const match = t.match(/^(\d+)\.\s+(.{3,60})$/);
      if (match && el.children.length < 5) {
        results.push({ num: match[1], label: match[2], tag: el.tagName });
      }
    }
    const seen = new Set();
    return results.filter(r => {
      const key = r.num + r.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  console.log('\n--- DETECTED STEPS ---');
  for (const s of stepLabels) {
    console.log(`  Step ${s.num}: ${s.label}`);
  }

  // Click each step and read its configuration panel
  for (let i = 0; i < stepLabels.length; i++) {
    const step = stepLabels[i];
    console.log(`\n=== STEP ${step.num}: ${step.label} ===`);

    try {
      const clickTarget = page.locator('*').filter({ hasText: new RegExp(`^${step.num}\\.\\s+${step.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
      if (await clickTarget.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickTarget.click();
      } else {
        await page.click(`text=${step.label}`, { timeout: 5000 });
      }
    } catch {
      console.log(`  Could not click step ${step.num}, trying alternate...`);
      try {
        await page.click(`text=${step.num}. ${step.label}`, { timeout: 3000 });
      } catch {
        console.log(`  Skipping step ${step.num} - not clickable`);
        continue;
      }
    }

    await page.waitForTimeout(4000);
    await dismissPopups(page);
    await ss(page, `Z01-check-step${step.num}`);

    const panelText = await readPanel(page);
    console.log(`  Panel content (first 800 chars):`);
    console.log(panelText.substring(0, 800));

    if (panelText.includes('error') || panelText.includes('Error')) {
      console.log('  ** ERRORS DETECTED **');
    }
    if (panelText.includes('required') || panelText.includes('Required')) {
      console.log('  ** HAS REQUIRED FIELDS **');
    }
    if (panelText.includes('not configured') || panelText.includes('Set up')) {
      console.log('  ** NEEDS CONFIGURATION **');
    }

    const statusInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasCheckmark: body.includes('Configured') || body.includes('configured'),
        hasWarning: body.includes('Action needed') || body.includes('action needed'),
        hasSkip: body.includes('Skip test') || body.includes('Test')
      };
    });
    console.log(`  Status: configured=${statusInfo.hasCheckmark}, needsAction=${statusInfo.hasWarning}`);
  }

  // Final screenshot
  try {
    const closeBtn = page.locator('button[aria-label="Close"], button[aria-label="close"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {}

  await ss(page, 'Z01-check-final');

  // Check zap on/off/draft
  const zapStatus = await page.evaluate(() => {
    const text = document.body.innerText;
    if (text.includes('Turn on Zap') || text.includes('Publish')) return 'DRAFT/OFF';
    if (text.includes('Turn off') || text.includes('Running')) return 'ON/RUNNING';
    return 'UNKNOWN';
  });
  console.log(`\n=== ZAP STATUS: ${zapStatus} ===`);

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('\nSession saved.');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
  console.log('\n=== Check complete ===');
})();
