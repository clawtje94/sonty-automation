const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function fillStaticText(page, label, text) {
  // Find the editor by its label
  const editor = await page.evaluate((lbl) => {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      let parent = el.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const l = parent.querySelector('label');
        if (l && l.textContent?.trim() === lbl) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 0 && rect.y < 800) return { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) };
        }
        parent = parent.parentElement;
      }
    }
    return null;
  }, label);

  if (!editor) {
    console.log(`  ❌ ${label} niet gevonden (niet zichtbaar)`);
    return false;
  }

  await page.mouse.click(editor.x, editor.y);
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
  console.log(`  ✅ ${label} = "${text}"`);
  await page.waitForTimeout(500);
  return true;
}

async function mapDataField(page, label, searchTerm) {
  // Find the "+" button next to the field label
  const plusInfo = await page.evaluate((lbl) => {
    // First find the editor by label
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      let parent = el.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const l = parent.querySelector('label');
        if (l && l.textContent?.trim() === lbl) {
          const editorRect = el.getBoundingClientRect();
          if (editorRect.y < 0 || editorRect.y > 800) break;

          // Now find the "+" button - look for buttons near this editor
          const btns = document.querySelectorAll('button');
          let best = null;
          let bestDist = 999;
          for (const btn of btns) {
            if (btn.offsetParent === null) continue;
            const rect = btn.getBoundingClientRect();
            const yDist = Math.abs(rect.y + rect.height / 2 - (editorRect.y + editorRect.height / 2));
            // The "+" button should be on the right side and close vertically
            if (rect.x > editorRect.x + editorRect.width - 50 && yDist < 25 && rect.width < 50) {
              if (yDist < bestDist) {
                bestDist = yDist;
                best = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: btn.textContent?.trim() || '' };
              }
            }
          }
          return { editor: { x: Math.round(editorRect.x + 10), y: Math.round(editorRect.y + editorRect.height / 2) }, plus: best };
        }
        parent = parent.parentElement;
      }
    }
    return null;
  }, label);

  if (!plusInfo) {
    console.log(`  ❌ ${label} niet gevonden`);
    return false;
  }

  if (!plusInfo.plus) {
    console.log(`  ❌ ${label}: geen "+" knop gevonden`);
    return false;
  }

  console.log(`  Clicking "+" for ${label}...`);
  await page.mouse.click(plusInfo.plus.x, plusInfo.plus.y);
  await page.waitForTimeout(3000);

  // Look for search input in the data picker popup
  const dpSearch = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const ph = (inp.placeholder || '').toLowerCase();
      if (ph.includes('search') || ph.includes('zoek')) {
        const rect = inp.getBoundingClientRect();
        if (rect.width > 100 && rect.y > 100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), ph: inp.placeholder };
      }
    }
    return null;
  });

  if (!dpSearch) {
    console.log(`  ❌ Geen zoekbalk in data picker`);
    // Show what's visible
    const popoverText = await page.evaluate(() => {
      const popovers = document.querySelectorAll('[role="dialog"], [class*="popover"], [class*="Popover"], [class*="dropdown"], [class*="Dropdown"]');
      for (const p of popovers) {
        if (p.offsetParent === null) continue;
        const text = p.textContent?.trim() || '';
        if (text.length > 20) return text.substring(0, 500);
      }
      return '';
    });
    console.log('  Popover:', popoverText.substring(0, 200));
    await page.keyboard.press('Escape');
    return false;
  }

  await page.mouse.click(dpSearch.x, dpSearch.y);
  await page.keyboard.type(searchTerm);
  await page.waitForTimeout(2000);

  // Click the first matching result
  const result = await page.evaluate((term) => {
    const allEls = document.querySelectorAll('*');
    const termLower = term.toLowerCase();
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text.toLowerCase().includes(termLower) && text.length > 3 && text.length < 100) {
        const rect = el.getBoundingClientRect();
        // Result should be below the search input
        if (rect.y > 200 && rect.width > 20 && rect.height > 10 && rect.height < 40) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
    }
    return null;
  }, searchTerm);

  if (result) {
    await page.mouse.click(result.x, result.y);
    console.log(`  ✅ ${label} → mapped to "${result.text}"`);
    await page.waitForTimeout(2000);
    return true;
  } else {
    console.log(`  ❌ "${searchTerm}" niet gevonden`);
    // List what's available
    const allText = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      const texts = [];
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.y > 250 && rect.y < 600 && rect.x > 800 && rect.height > 10) {
          const text = el.textContent?.trim() || '';
          if (text.length > 2 && text.length < 60) texts.push(text);
        }
      }
      return texts.slice(0, 15);
    });
    console.log('  Beschikbaar:', allText);
    await page.keyboard.press('Escape');
    return false;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-03 Velden invullen v3');

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

  // Click Configure breadcrumb
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);

  await ss(page, 'Z03F3-01-configure');

  // Job Type should already be "Opmeting" from last run — verify
  const jobTypeContent = await page.evaluate(() => {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      let parent = el.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const l = parent.querySelector('label');
        if (l && l.textContent?.trim() === 'Job Type') {
          return el.textContent?.trim() || '';
        }
        parent = parent.parentElement;
      }
    }
    return null;
  });
  console.log('Job Type current:', jobTypeContent);

  if (!jobTypeContent || jobTypeContent === 'Enter text or insert data…' || jobTypeContent === '') {
    console.log('Job Type leeg, opnieuw invullen...');
    await fillStaticText(page, 'Job Type', 'Opmeting');
  } else {
    console.log('✅ Job Type al ingesteld:', jobTypeContent);
  }

  // Scroll down to see Assignee, Client External ID, etc.
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 350);
  await page.waitForTimeout(2000);

  await ss(page, 'Z03F3-02-scrolled');

  // Fill Assignee (email) with static text
  console.log('\n--- Assignee (email) ---');
  await fillStaticText(page, 'Assignee (email)', 'daimy@sonty.nl');

  // Map Client External ID to HubSpot Record ID
  console.log('\n--- Client External ID ---');
  await mapDataField(page, 'Client External ID', 'Record ID');

  await ss(page, 'Z03F3-03-extid');

  // Scroll down more for name fields
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  // Map Client First Name
  console.log('\n--- Client First Name ---');
  const firstResult = await mapDataField(page, 'Client First Name', 'Voornaam');
  if (!firstResult) {
    // Try English
    await mapDataField(page, 'Client First Name', 'First');
  }

  // Map Client Last Name
  console.log('\n--- Client Last Name ---');
  const lastResult = await mapDataField(page, 'Client Last Name', 'Achternaam');
  if (!lastResult) {
    await mapDataField(page, 'Client Last Name', 'Last');
  }

  await ss(page, 'Z03F3-04-names');

  // Scroll all the way down to Continue button
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(2000);

  // Click Continue
  const continueBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      if (btn.textContent?.trim() === 'Continue') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 850 && rect.y > 0 && rect.y < 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (continueBtn) {
    await page.mouse.click(continueBtn.x, continueBtn.y);
    console.log('\n✅ Continue geklikt');
    await page.waitForTimeout(5000);
  } else {
    console.log('Continue niet zichtbaar, scroll meer...');
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1000);
    const btn2 = await page.evaluate(() => {
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
    if (btn2) {
      await page.mouse.click(btn2.x, btn2.y);
      console.log('\n✅ Continue geklikt (na extra scroll)');
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'Z03F3-05-test');

  // Show test preview
  const testText = await page.evaluate(() => document.body.innerText.substring(0, 6000));
  const dataInIdx = testText.indexOf('Data in');
  if (dataInIdx > 0) {
    console.log('\nTest preview:\n', testText.substring(dataInIdx, dataInIdx + 1500));
  }

  await ss(page, 'Z03F3-final');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
