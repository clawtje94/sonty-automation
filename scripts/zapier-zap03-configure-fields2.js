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
  console.log('🎬 ZAP-03 Configure velden v2');

  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Open Step 2 (Create Job)
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

  // We're on Test tab. Click "Configure" in the breadcrumb bar at ~x=1005, y=170
  // The breadcrumb is: Setup ✅ > Configure ✅ > Test ⓘ
  // Use exact pixel coordinates based on screenshot
  console.log('Clicking Configure breadcrumb...');
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);

  await ss(page, 'Z03CF2-01-configure');

  // Check what we see now
  const panelText = await page.evaluate(() => document.body.innerText.substring(0, 6000));
  const configIdx = panelText.indexOf('Configure');
  console.log('Panel:', panelText.substring(configIdx > 0 ? configIdx : 0, (configIdx > 0 ? configIdx : 0) + 1500));

  // Find all form elements
  const formElements = await page.evaluate(() => {
    const result = { dropdowns: [], editors: [], inputs: [], buttons: [] };

    // Dropdowns (Choose value buttons)
    document.querySelectorAll('button').forEach(btn => {
      if (btn.offsetParent === null) return;
      const text = btn.textContent?.trim() || '';
      if (text.startsWith('Choose value')) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 850) {
          let label = '';
          let p = btn.closest('[class*="field"], [class*="form-group"], [class*="Field"]');
          if (p) { const l = p.querySelector('label'); if (l) label = l.textContent?.trim() || ''; }
          if (!label) {
            let parent = btn.parentElement;
            for (let i = 0; i < 8 && parent && !label; i++) {
              const l = parent.querySelector('label');
              if (l) label = l.textContent?.trim() || '';
              parent = parent.parentElement;
            }
          }
          result.dropdowns.push({ label, text: text.substring(0, 30), x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
        }
      }
    });

    // Content editables (Slate text fields)
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      if (el.offsetParent === null) return;
      const rect = el.getBoundingClientRect();
      if (rect.x > 850 && rect.width > 40) {
        let label = '';
        let parent = el.parentElement;
        for (let i = 0; i < 8 && parent && !label; i++) {
          const l = parent.querySelector('label');
          if (l) label = l.textContent?.trim() || '';
          parent = parent.parentElement;
        }
        result.editors.push({ label, x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2), w: Math.round(rect.width), content: el.textContent?.trim().substring(0, 30) || '' });
      }
    });

    // Regular inputs
    document.querySelectorAll('input').forEach(inp => {
      if (inp.offsetParent === null) return;
      const rect = inp.getBoundingClientRect();
      if (rect.x > 850 && rect.width > 40) {
        let label = '';
        let parent = inp.parentElement;
        for (let i = 0; i < 8 && parent && !label; i++) {
          const l = parent.querySelector('label');
          if (l) label = l.textContent?.trim() || '';
          parent = parent.parentElement;
        }
        result.inputs.push({ label, placeholder: inp.placeholder, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
      }
    });

    return result;
  });

  console.log('\nDropdowns:', JSON.stringify(formElements.dropdowns, null, 2));
  console.log('\nEditors:', JSON.stringify(formElements.editors, null, 2));
  console.log('\nInputs:', JSON.stringify(formElements.inputs, null, 2));

  await ss(page, 'Z03CF2-02-form');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
