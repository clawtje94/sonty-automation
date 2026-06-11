const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function fillStaticText(page, label, text) {
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

  if (!editor) { console.log(`  ❌ ${label} niet gevonden`); return false; }
  await page.mouse.click(editor.x, editor.y);
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
  console.log(`  ✅ ${label} = "${text}"`);
  await page.waitForTimeout(500);
  return true;
}

async function mapDataField(page, label, searchTerm) {
  const plusInfo = await page.evaluate((lbl) => {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      let parent = el.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const l = parent.querySelector('label');
        if (l && l.textContent?.trim() === lbl) {
          const editorRect = el.getBoundingClientRect();
          if (editorRect.y < 0 || editorRect.y > 800) break;
          const btns = document.querySelectorAll('button');
          let best = null;
          let bestDist = 999;
          for (const btn of btns) {
            if (btn.offsetParent === null) continue;
            const rect = btn.getBoundingClientRect();
            const yDist = Math.abs(rect.y + rect.height / 2 - (editorRect.y + editorRect.height / 2));
            if (rect.x > editorRect.x + editorRect.width - 50 && yDist < 25 && rect.width < 50) {
              if (yDist < bestDist) { bestDist = yDist; best = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }; }
            }
          }
          return { editor: { x: Math.round(editorRect.x + 10), y: Math.round(editorRect.y + editorRect.height / 2) }, plus: best };
        }
        parent = parent.parentElement;
      }
    }
    return null;
  }, label);

  if (!plusInfo || !plusInfo.plus) { console.log(`  ❌ ${label}: geen "+" knop`); return false; }

  await page.mouse.click(plusInfo.plus.x, plusInfo.plus.y);
  await page.waitForTimeout(3000);

  const dpSearch = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const ph = (inp.placeholder || '').toLowerCase();
      if (ph.includes('search')) {
        const rect = inp.getBoundingClientRect();
        if (rect.width > 100 && rect.y > 100) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (!dpSearch) { console.log(`  ❌ Geen zoekbalk`); await page.keyboard.press('Escape'); return false; }

  await page.mouse.click(dpSearch.x, dpSearch.y);
  await page.keyboard.type(searchTerm);
  await page.waitForTimeout(2000);

  const result = await page.evaluate((term) => {
    const termLower = term.toLowerCase();
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text.toLowerCase().includes(termLower) && text.length > 3 && text.length < 100) {
        const rect = el.getBoundingClientRect();
        if (rect.y > 200 && rect.width > 20 && rect.height > 10 && rect.height < 40) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
      }
    }
    return null;
  }, searchTerm);

  if (result) {
    await page.mouse.click(result.x, result.y);
    console.log(`  ✅ ${label} → "${result.text}"`);
    await page.waitForTimeout(2000);
    return true;
  }
  console.log(`  ❌ "${searchTerm}" niet gevonden`);
  await page.keyboard.press('Escape');
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-08 Finish Setup + Configure');

  await page.goto('https://zapier.com/editor/353424667/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click Step 2
  const step2 = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Select the event' || text === 'Create Job') {
        const rect = el.getBoundingClientRect();
        if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (step2) {
    await page.mouse.click(step2.x, step2.y);
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FS-01');

  // Check current state
  const stateText = await page.evaluate(() => document.body.innerText.substring(0, 2000));

  if (stateText.includes('Choose an event') && stateText.includes('Planado')) {
    // Need to select Create Job event
    console.log('Selecting Create Job event...');

    // Click the "Choose an event" dropdown
    const eventDD = await page.evaluate(() => {
      const selects = document.querySelectorAll('button, select, [role="combobox"], [class*="select"]');
      for (const el of selects) {
        if (el.offsetParent === null) continue;
        const text = el.textContent?.trim() || '';
        if (text.includes('Choose an event')) {
          const rect = el.getBoundingClientRect();
          if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (eventDD) {
      await page.mouse.click(eventDD.x, eventDD.y);
      await page.waitForTimeout(3000);

      // The popover opens to the LEFT of the side panel. Look for "Create Job" anywhere on screen
      const createJob = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Create Job') {
            const rect = el.getBoundingClientRect();
            if (rect.y > 350 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (createJob) {
        await page.mouse.click(createJob.x, createJob.y);
        console.log('  ✅ Create Job event geselecteerd');
        await page.waitForTimeout(3000);
      }
    }
  }

  await ss(page, 'Z08FS-02-event');

  // Click Continue to pass Setup
  let continueBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 850) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (continueBtn) {
    await page.mouse.click(continueBtn.x, continueBtn.y);
    console.log('  Continue');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FS-03');

  // Check if we need another Continue (Account → Configure)
  continueBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 850) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (continueBtn) {
    await page.mouse.click(continueBtn.x, continueBtn.y);
    console.log('  Continue (2)');
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FS-04');

  // Now we should be on Configure or Test tab
  // Click Configure breadcrumb if needed
  const currentState = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  if (currentState.includes('Configure') && currentState.includes('Test')) {
    // Click Configure breadcrumb
    await page.mouse.click(1005, 170);
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z08FS-05-configure');

  // Now fill the fields for Installatie
  const configText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nConfig:', configText.substring(0, 600));

  if (configText.includes('Job Type') && configText.includes('Enter text or insert data')) {
    console.log('\n--- Filling Installatie fields ---');

    // Job Type = "Installatie"
    await fillStaticText(page, 'Job Type', 'Installatie');

    // Scroll down for more fields
    await page.mouse.move(1068, 400);
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(2000);

    // Assignee
    await fillStaticText(page, 'Assignee (email)', 'daimy@sonty.nl');

    // Client External ID → HubSpot Record ID
    console.log('\n--- Client External ID ---');
    await mapDataField(page, 'Client External ID', 'Record ID');

    // Scroll more
    await page.mouse.move(1068, 400);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(2000);

    // Client First Name
    console.log('\n--- Client First Name ---');
    const fn = await mapDataField(page, 'Client First Name', 'Voornaam');
    if (!fn) await mapDataField(page, 'Client First Name', 'First');

    // Client Last Name
    console.log('\n--- Client Last Name ---');
    const ln = await mapDataField(page, 'Client Last Name', 'Achternaam');
    if (!ln) await mapDataField(page, 'Client Last Name', 'Last');

    await ss(page, 'Z08FS-06-filled');

    // Click Continue
    await page.mouse.move(1068, 400);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(2000);

    continueBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 850 && rect.y > 0 && rect.y < 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (continueBtn) {
      await page.mouse.click(continueBtn.x, continueBtn.y);
      console.log('\n✅ Continue (Configure → Test)');
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'Z08FS-07-test');

  // Show test preview
  const testText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  const dataInIdx = testText.indexOf('Data in');
  if (dataInIdx > 0) {
    console.log('\nTest preview:\n', testText.substring(dataInIdx, dataInIdx + 1000));
  }

  await ss(page, 'Z08FS-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
