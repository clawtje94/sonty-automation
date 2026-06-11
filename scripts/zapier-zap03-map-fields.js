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
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-03 Planado veldmapping');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Step 2
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Create Job') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.dblclick(step2.x, step2.y);
    await page.waitForTimeout(5000);
  }

  // Click Configure tab
  const configTab = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Configure') {
        const rect = el.getBoundingClientRect();
        if (rect.x > 900 && rect.y < 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (configTab) {
    await page.mouse.click(configTab.x, configTab.y);
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z03MAP-01-configure');

  // Get all the configure fields
  const fields = await page.evaluate(() => {
    const result = [];
    // Look for field labels and their corresponding inputs/dropdowns
    const allEls = document.querySelectorAll('label, [class*="label"]');
    for (const el of allEls) {
      const text = el.textContent?.trim() || '';
      if (text.length > 2 && text.length < 50) {
        const rect = el.getBoundingClientRect();
        if (rect.x > 800 && rect.y > 150) {
          result.push({ label: text, y: Math.round(rect.y) });
        }
      }
    }
    return result;
  });
  console.log('Fields:', JSON.stringify(fields, null, 2));

  // Check current field state
  const configText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  console.log('Config text:', configText.substring(configText.indexOf('Job Type'), 2000));

  // Find all "Choose value" dropdowns and text inputs
  const dropdowns = await page.evaluate(() => {
    const result = [];
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.startsWith('Choose value') || text === 'Choose value…') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800) {
          // Find the label above this dropdown
          let label = '';
          let prevEl = btn.parentElement;
          while (prevEl && !label) {
            const lbl = prevEl.querySelector('label');
            if (lbl) label = lbl.textContent?.trim() || '';
            prevEl = prevEl.parentElement;
          }
          result.push({ text: text.substring(0, 30), y: Math.round(rect.y), x: Math.round(rect.x + rect.width / 2), label });
        }
      }
    }
    return result;
  });
  console.log('\nDropdowns:', JSON.stringify(dropdowns, null, 2));

  // Find all text input fields (Slate editors)
  const textInputs = await page.evaluate(() => {
    const result = [];
    const slates = document.querySelectorAll('[class*="slate"], [contenteditable="true"], [data-testid*="field"]');
    for (const el of slates) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.x > 800 && rect.width > 50) {
        result.push({ y: Math.round(rect.y), x: Math.round(rect.x + rect.width / 2), w: Math.round(rect.width), text: el.textContent?.trim().substring(0, 30) || '' });
      }
    }
    return result;
  });
  console.log('\nText inputs:', JSON.stringify(textInputs, null, 2));

  // Let me find the Job Type dropdown specifically
  // Job Type should be a dropdown (Choose value)
  // I need to:
  // 1. Set Job Type = "Opmeting"
  // 2. Set Client External ID = HubSpot deal ID (dynamic from Step 1)
  // 3. Set other client fields from Step 1 data

  // First, set Job Type to "Opmeting"
  const jobTypeDropdown = dropdowns.find(d => d.label.includes('Job Type') || d.y < 350);
  if (jobTypeDropdown) {
    console.log('\nSetting Job Type...');
    await page.mouse.click(jobTypeDropdown.x, jobTypeDropdown.y);
    await page.waitForTimeout(3000);

    // Search for "Opmeting"
    const searchInput = await page.evaluate(() => {
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

    if (searchInput) {
      await page.mouse.click(searchInput.x, searchInput.y);
      await page.keyboard.type('Opmeting');
      await page.waitForTimeout(2000);
    }

    const opmetingOption = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim().includes('Opmeting')) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 300 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (opmetingOption) {
      await page.mouse.click(opmetingOption.x, opmetingOption.y);
      console.log('  Opmeting geselecteerd');
      await page.waitForTimeout(3000);
    }
  }

  await ss(page, 'Z03MAP-02-jobtype');

  // Scroll down to see more fields
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  // Now I need to set Client External ID to the HubSpot Deal ID
  // This requires clicking the "+" button or the Slate field and inserting data from Step 1
  // The Client External ID field should accept the deal's hs_object_id

  // Find all field labels and their positions after scrolling
  const allFields = await page.evaluate(() => {
    const result = [];
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      const rect = el.getBoundingClientRect();
      if (rect.x > 870 && rect.x < 920 && rect.y > 150 && text.length > 3 && text.length < 40) {
        result.push({ text, y: Math.round(rect.y), x: Math.round(rect.x) });
      }
    }
    return result;
  });
  console.log('\nAll field labels:', JSON.stringify(allFields, null, 2));

  await ss(page, 'Z03MAP-03-scrolled');

  // Get the full configure panel content
  const fullConfig = await page.evaluate(() => document.body.innerText.substring(0, 6000));
  const configSection = fullConfig.substring(fullConfig.indexOf('Configure'));
  console.log('\nFull config:', configSection.substring(0, 2000));

  await ss(page, 'Z03MAP-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
