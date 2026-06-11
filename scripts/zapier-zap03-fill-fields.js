const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function clickEditor(page, y, label) {
  // Click the Slate editor at given y position
  await page.mouse.click(900, y);
  await page.waitForTimeout(500);
  // Select all existing content and clear
  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(200);
}

async function typeInEditor(page, y, text, label) {
  await clickEditor(page, y, label);
  await page.keyboard.type(text);
  console.log(`  ✅ ${label} = "${text}"`);
  await page.waitForTimeout(500);
}

async function insertDataFromStep1(page, editorY, searchTerm, label) {
  // Click the editor first
  await page.mouse.click(900, editorY);
  await page.waitForTimeout(500);

  // Find the "+" button next to this editor (should be on the right side)
  const plusBtn = await page.evaluate((targetY) => {
    const btns = document.querySelectorAll('button');
    let best = null;
    let bestDist = 999;
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const rect = btn.getBoundingClientRect();
      // Look for small buttons to the right of the editor area
      if (rect.x > 1220 && rect.width < 50) {
        const dist = Math.abs(rect.y + rect.height / 2 - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), dist, text: btn.textContent?.trim().substring(0, 10) || '', ariaLabel: btn.getAttribute('aria-label') || '' };
        }
      }
    }
    return best;
  }, editorY);

  console.log(`  Plus button for ${label}:`, JSON.stringify(plusBtn));

  if (plusBtn && plusBtn.dist < 40) {
    await page.mouse.click(plusBtn.x, plusBtn.y);
    await page.waitForTimeout(3000);

    await ss(page, `Z03FILL-dp-${label.replace(/\s+/g, '')}`);

    // Search in data picker
    const dpSearch = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const ph = inp.placeholder || '';
        if (ph.toLowerCase().includes('search')) {
          const rect = inp.getBoundingClientRect();
          if (rect.y > 150 && rect.width > 100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), ph };
        }
      }
      return null;
    });

    if (dpSearch) {
      await page.mouse.click(dpSearch.x, dpSearch.y);
      await page.keyboard.type(searchTerm);
      await page.waitForTimeout(2000);

      // Click the first matching result
      const result = await page.evaluate((term) => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          const text = el.textContent?.trim() || '';
          if (text.toLowerCase().includes(term.toLowerCase()) && text.length < 80) {
            const rect = el.getBoundingClientRect();
            if (rect.y > 200 && rect.width > 20 && rect.height > 10) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
            }
          }
        }
        return null;
      }, searchTerm);

      if (result) {
        await page.mouse.click(result.x, result.y);
        console.log(`  ✅ ${label} = mapped to "${result.text}"`);
        await page.waitForTimeout(2000);
        return true;
      } else {
        console.log(`  ❌ "${searchTerm}" niet gevonden in data picker`);
        // Show available options
        const options = await page.evaluate(() => {
          const result = [];
          const items = document.querySelectorAll('[role="option"], [class*="option"], [class*="item"], [class*="result"]');
          for (const el of items) {
            if (el.offsetParent === null) continue;
            const text = el.textContent?.trim() || '';
            if (text.length > 2 && text.length < 80) result.push(text.substring(0, 60));
          }
          return result.slice(0, 10);
        });
        console.log('  Options:', options);
        // Close data picker by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  } else {
    console.log(`  No plus button found near ${label}, trying keyboard shortcut`);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-03 Velden invullen');

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

  // Click Configure breadcrumb (at x=1005, y=170 based on screenshot)
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);

  await ss(page, 'Z03FILL-01-configure');

  // ===== 1. Set Job Type = "Opmeting" =====
  console.log('\n--- Job Type ---');
  // Job Type is a text editor at y=323, but it might also accept typed text
  // In Planado's Zapier integration, Job Type might need to be the exact string
  await typeInEditor(page, 323, 'Opmeting', 'Job Type');

  // ===== 2. Set Assignee (email) = daimy@sonty.nl =====
  console.log('\n--- Assignee ---');
  await typeInEditor(page, 698, 'daimy@sonty.nl', 'Assignee (email)');

  await ss(page, 'Z03FILL-02-typed');

  // ===== 3. Set Client External ID = HubSpot Record ID from Step 1 =====
  console.log('\n--- Client External ID ---');
  await insertDataFromStep1(page, 773, 'Record ID', 'Client External ID');

  // ===== 4. Scroll down to reach Client First Name and Last Name =====
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(2000);

  // Re-scan editors after scroll
  const editorsAfterScroll = await page.evaluate(() => {
    const result = [];
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
        result.push({ label, x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) });
      }
    });
    return result;
  });
  console.log('\nEditors after scroll:', JSON.stringify(editorsAfterScroll.map(e => ({ label: e.label, y: e.y })), null, 2));

  // ===== 5. Client First Name =====
  const firstNameEditor = editorsAfterScroll.find(e => e.label.includes('First Name'));
  if (firstNameEditor) {
    console.log('\n--- Client First Name ---');
    await insertDataFromStep1(page, firstNameEditor.y, 'First', 'Client First Name');
  }

  // ===== 6. Client Last Name =====
  const lastNameEditor = editorsAfterScroll.find(e => e.label.includes('Last Name'));
  if (lastNameEditor) {
    console.log('\n--- Client Last Name ---');
    await insertDataFromStep1(page, lastNameEditor.y, 'Last', 'Client Last Name');
  }

  await ss(page, 'Z03FILL-03-names');

  // ===== 7. Scroll down to find Continue button and click it =====
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(2000);

  const continueBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      if (btn.textContent?.trim() === 'Continue') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 850) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (continueBtn) {
    await page.mouse.click(continueBtn.x, continueBtn.y);
    console.log('\n✅ Continue geklikt');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z03FILL-04-continue');

  // Check the result (Test tab should now show mapped data)
  const testText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  const testIdx = testText.indexOf('Send Job');
  if (testIdx > 0) {
    console.log('\nTest preview:', testText.substring(testIdx, testIdx + 1500));
  }

  await ss(page, 'Z03FILL-final');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
