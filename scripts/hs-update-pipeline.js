const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HUBSPOT_SESSION = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';

// Target pipeline stages in order (new 18-stage flow)
const TARGET_STAGES = [
  'Nieuwe Lead',
  'Belpoging 1',
  'Belpoging 2',
  'Prijsindicatie Verstuurd',
  'WhatsApp Verstuurd',
  'In Contact',
  'Opmeting Ingepland',
  'Opmeting Afgerond',
  'Definitieve Offerte Verstuurd',
  'Offerte Akkoord',
  'Aanbetaling Verstuurd',
  'Aanbetaling Ontvangen',
  'Producten Besteld',
  'Orderbevestiging Ontvangen',
  'Installatie Ingepland',
  'Installatie Afgerond',
  'Eindfactuur Verstuurd',
  'Afgerond',
];
// "Verloren" stays as closed-lost stage (separate)

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: HUBSPOT_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 HubSpot pipeline stages updaten');

  // Go to deals board view
  await page.goto(`https://app-eu1.hubspot.com/contacts/${PORTAL_ID}/objects/0-3/views/all/board`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await ss(page, 'PIPE-01-board');
  console.log('  URL:', page.url());

  // First select "Sonty Verkooppijplijn" if not already selected
  const pipelineDD = page.locator('button').filter({ hasText: /pijplijn|pipeline/i }).first();
  if (await pipelineDD.isVisible().catch(() => false)) {
    const ddText = await pipelineDD.innerText().catch(() => '');
    console.log(`  Pipeline dropdown: "${ddText}"`);
    if (!ddText.includes('Sonty')) {
      await pipelineDD.click();
      await page.waitForTimeout(1000);
      const sontyOpt = page.locator('[role="option"]').filter({ hasText: /Sonty/i }).first();
      if (await sontyOpt.isVisible().catch(() => false)) {
        await sontyOpt.click();
        await page.waitForTimeout(3000);
      }
    }
  }

  // Dump the full page text and all links/buttons to find "Edit stages"
  const boardText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Board text:', boardText.substring(0, 600));

  // Look for all links that contain pipeline/stage related text
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText?.trim()?.substring(0, 60),
      href: a.href
    })).filter(l => l.text);
  });
  console.log('\nLinks:');
  for (const l of allLinks.slice(0, 20)) {
    console.log(`  "${l.text}" → ${l.href?.substring(0, 80)}`);
  }

  // Look for gear/settings icons near the pipeline
  const allBtns = await page.locator('button:visible').all();
  console.log('\nButtons:');
  for (const btn of allBtns.slice(0, 25)) {
    const t = await btn.innerText().catch(() => '');
    const aria = await btn.getAttribute('aria-label').catch(() => '');
    if (t.trim() || aria) console.log(`  btn: "${t.trim().substring(0, 50)}" aria="${aria || ''}"`);
  }

  await ss(page, 'PIPE-02-board');

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFull text:', bodyText.substring(0, 1000));

  const settingsText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Settings:', settingsText.substring(0, 800));

  // Check if we need to select the right pipeline (Sonty Verkooppijplijn)
  const pipelineSelector = page.locator('select, [role="combobox"], button').filter({ hasText: /pipeline|pijplijn|sonty/i }).first();
  if (await pipelineSelector.isVisible().catch(() => false)) {
    await pipelineSelector.click();
    await page.waitForTimeout(1000);
    const sontyOpt = page.locator('[role="option"], option').filter({ hasText: /Sonty/i }).first();
    if (await sontyOpt.isVisible().catch(() => false)) {
      await sontyOpt.click();
      await page.waitForTimeout(3000);
      console.log('  Sonty Verkooppijplijn geselecteerd');
    }
  }

  await ss(page, 'PIPE-03-pipeline');

  // Now read all current stages
  const currentStages = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"]');
    return Array.from(inputs).map(i => i.value).filter(v => v && v.length > 1);
  });
  console.log('\nHuidige stages:', currentStages);

  // Also check for stage rows — they usually have input fields for stage names
  const stageRows = await page.locator('input[type="text"]:visible').all();
  console.log(`\nAantal input velden: ${stageRows.length}`);
  for (let i = 0; i < stageRows.length; i++) {
    const val = await stageRows[i].inputValue().catch(() => '');
    if (val) console.log(`  [${i}] "${val}"`);
  }

  // Dump all buttons
  const buttons = await page.locator('button:visible').all();
  for (const btn of buttons.slice(0, 30)) {
    const t = await btn.innerText().catch(() => '');
    if (t.trim() && t.trim().length < 80) console.log(`  btn: "${t.trim()}"`);
  }

  await ss(page, 'PIPE-04-stages');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(HUBSPOT_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
