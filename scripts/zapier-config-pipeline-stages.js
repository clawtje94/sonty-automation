const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function selectPipelineAndStage(page, stageName, prefix) {
  // Open Step 1 config
  const step1 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Updated Deal Stage' || text === '1. Updated Deal Stage') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 200 && rect.y < 400) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step1) {
    await page.mouse.dblclick(step1.x, step1.y);
    await page.waitForTimeout(5000);
  }

  // Click Configure tab
  const configTab = page.locator('text=Configure').first();
  if (await configTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await configTab.click();
    await page.waitForTimeout(3000);
  }

  // Check if pipeline already set
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  if (panelText.includes('Sonty Verkooppijplijn') && panelText.includes(stageName)) {
    console.log(`  ✅ Al geconfigureerd: ${stageName}`);
    return true;
  }

  // Select Pipeline: "Choose value..." dropdown (first one)
  const pipelineDropdown = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="combobox"], [class*="select"]');
    const results = [];
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.startsWith('Choose value') || text === 'Choose value...') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800 && rect.width > 50) {
          results.push({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text, top: rect.top });
        }
      }
    }
    results.sort((a, b) => a.top - b.top);
    return results;
  });

  console.log(`  Dropdowns: ${JSON.stringify(pipelineDropdown.map(d => ({ text: d.text.substring(0, 20), y: d.y })))}`);

  if (pipelineDropdown.length === 0) {
    console.log('  Geen dropdowns gevonden');
    return false;
  }

  // Click first dropdown (Pipeline)
  if (!panelText.includes('Sonty Verkooppijplijn')) {
    console.log('  Pipeline selecteren...');
    await page.mouse.click(pipelineDropdown[0].x, pipelineDropdown[0].y);
    await page.waitForTimeout(3000);

    // Search for Sonty
    const searchPipeline = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const placeholder = inp.getAttribute('placeholder') || '';
        if (placeholder.includes('Search') || placeholder.includes('search')) {
          const rect = inp.getBoundingClientRect();
          if (rect.y > 250) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (searchPipeline) {
      await page.mouse.click(searchPipeline.x, searchPipeline.y);
      await page.keyboard.type('Sonty');
      await page.waitForTimeout(2000);
    }

    // Click "Sonty Verkooppijplijn"
    const sonty = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim().includes('Sonty Verkooppijplijn')) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 250 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (sonty) {
      await page.mouse.click(sonty.x, sonty.y);
      console.log('  Sonty Verkooppijplijn geselecteerd');
      await page.waitForTimeout(5000);
    } else {
      // Click the radio button or first option
      const firstOption = await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const r of radios) {
          if (r.offsetParent === null) continue;
          let parent = r.parentElement;
          for (let i = 0; i < 5; i++) {
            if (parent?.textContent?.includes('Sonty')) {
              const rect = r.getBoundingClientRect();
              return { x: Math.round(rect.x + 8), y: Math.round(rect.y + 8) };
            }
            if (parent) parent = parent.parentElement;
          }
        }
        return null;
      });
      if (firstOption) {
        await page.mouse.click(firstOption.x, firstOption.y);
        console.log('  Pipeline radio geklikt');
        await page.waitForTimeout(5000);
      }
    }
  }

  await page.waitForTimeout(2000);

  // Now select Stage
  console.log(`  Stage selecteren: ${stageName}...`);

  // Find the remaining "Choose value" dropdown (should be for Stage now)
  const stageDropdown = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="combobox"]');
    for (const btn of buttons) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.startsWith('Choose value') || text === 'Choose value...') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800 && rect.width > 50) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (stageDropdown) {
    await page.mouse.click(stageDropdown.x, stageDropdown.y);
    await page.waitForTimeout(3000);

    // Search for the stage
    const searchStage = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const placeholder = inp.getAttribute('placeholder') || '';
        if (placeholder.includes('Search') || placeholder.includes('search')) {
          const rect = inp.getBoundingClientRect();
          if (rect.y > 300) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (searchStage) {
      await page.mouse.click(searchStage.x, searchStage.y);
      await page.keyboard.type(stageName);
      await page.waitForTimeout(2000);
    }

    const stageOption = await page.evaluate((name) => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim().includes(name)) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 300 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    }, stageName);

    if (stageOption) {
      await page.mouse.click(stageOption.x, stageOption.y);
      console.log(`  ${stageName} geselecteerd`);
      await page.waitForTimeout(3000);
    } else {
      // Try radio
      const radio = await page.evaluate((name) => {
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const r of radios) {
          if (r.offsetParent === null) continue;
          let parent = r.parentElement;
          for (let i = 0; i < 5; i++) {
            if (parent?.textContent?.includes(name)) {
              const rect = r.getBoundingClientRect();
              return { x: Math.round(rect.x + 8), y: Math.round(rect.y + 8) };
            }
            if (parent) parent = parent.parentElement;
          }
        }
        return null;
      }, stageName);
      if (radio) {
        await page.mouse.click(radio.x, radio.y);
        console.log(`  ${stageName} radio geklikt`);
        await page.waitForTimeout(3000);
      }
    }
  }

  // Click Continue
  const btn = page.locator('button').filter({ hasText: /^Continue$/ });
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
    if (!disabled) {
      await btn.click({ force: true });
      console.log('  Continue');
      await page.waitForTimeout(5000);
    }
  }

  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  const zaps = [
    { name: 'ZAP-05', url: 'https://zapier.com/editor/353424308/draft', stage: 'Definitieve Offerte Verstuurd' },
    { name: 'ZAP-06', url: 'https://zapier.com/editor/353424608/draft', stage: 'Offerte Akkoord' },
    { name: 'ZAP-08', url: 'https://zapier.com/editor/353424667/draft', stage: 'Installatie Ingepland' },
  ];

  for (const zap of zaps) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔧 ${zap.name}: Pipeline → Sonty, Stage → ${zap.stage}`);

    await page.goto(zap.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
    if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gotIt.click();
      await page.waitForTimeout(1000);
    }

    const prefix = zap.name.replace('-', '');
    await selectPipelineAndStage(page, zap.stage, prefix);
    await ss(page, `${prefix}-pipeline-done`);

    const storageState = await context.storageState();
    fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  }

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
