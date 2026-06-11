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
  console.log('🎬 ZAP-03 Configure velden invullen');

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

  await ss(page, 'Z03CF-01-opened');

  // Click the Configure tab/breadcrumb (it has a green check ✅)
  // The breadcrumb bar shows: Setup ✅ → Configure ✅ → Test
  // We need to click the "Configure" text in the breadcrumb area (top of side panel)
  const configureTab = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const results = [];
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim() || '';
      if (text === 'Configure') {
        const rect = el.getBoundingClientRect();
        if (rect.x > 800 && rect.y < 250) {
          results.push({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), rx: Math.round(rect.x), ry: Math.round(rect.y) });
        }
      }
    }
    return results;
  });
  console.log('Configure tabs:', JSON.stringify(configureTab));

  // Click the first Configure element found
  if (configureTab.length > 0) {
    await page.mouse.click(configureTab[0].x, configureTab[0].y);
    await page.waitForTimeout(5000);
  }

  await ss(page, 'Z03CF-02-configure-tab');

  // Check what we see now - look for editable fields
  const panelText = await page.evaluate(() => {
    const panel = document.querySelector('[class*="side-panel"], [class*="editor-panel"], [class*="SidePanel"]');
    if (panel) return panel.innerText.substring(0, 3000);
    return document.body.innerText.substring(0, 5000);
  });
  console.log('Panel text:', panelText.substring(0, 1500));

  // Find all dropdown buttons ("Choose value…") and text input areas
  const dropdowns = await page.evaluate(() => {
    const result = [];
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      if (text.startsWith('Choose value') || text === 'Choose value…') {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800) {
          // Find the label
          let label = '';
          let parent = btn.parentElement;
          for (let i = 0; i < 5 && parent && !label; i++) {
            const lbl = parent.querySelector('label');
            if (lbl) label = lbl.textContent?.trim() || '';
            parent = parent.parentElement;
          }
          result.push({ label, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
        }
      }
    }
    return result;
  });
  console.log('\nDropdowns:', JSON.stringify(dropdowns, null, 2));

  // Find contenteditable / Slate editors (text input fields)
  const editors = await page.evaluate(() => {
    const result = [];
    const editables = document.querySelectorAll('[contenteditable="true"], [data-slate-editor="true"], [class*="slate"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.x > 800 && rect.width > 50) {
        // Find label
        let label = '';
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent && !label; i++) {
          const lbl = parent.querySelector('label');
          if (lbl) label = lbl.textContent?.trim() || '';
          parent = parent.parentElement;
        }
        result.push({ label, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: el.textContent?.trim().substring(0, 30) || '' });
      }
    }
    return result;
  });
  console.log('\nEditors:', JSON.stringify(editors, null, 2));

  // Find "+" data picker buttons
  const plusBtns = await page.evaluate(() => {
    const result = [];
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.offsetParent === null) continue;
      const text = btn.textContent?.trim() || '';
      const ariaLabel = btn.getAttribute('aria-label') || '';
      if (text === '+' || ariaLabel.includes('Insert') || ariaLabel.includes('data')) {
        const rect = btn.getBoundingClientRect();
        if (rect.x > 800) {
          result.push({ text: text.substring(0, 10), ariaLabel, x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
        }
      }
    }
    return result;
  });
  console.log('\nPlus buttons:', JSON.stringify(plusBtns, null, 2));

  await ss(page, 'Z03CF-03-fields');

  // ===== STEP 1: Set Job Type to "Opmeting" =====
  const jobTypeDD = dropdowns.find(d => d.label.includes('Job Type'));
  if (jobTypeDD) {
    console.log('\n--- Setting Job Type ---');
    await page.mouse.click(jobTypeDD.x, jobTypeDD.y);
    await page.waitForTimeout(3000);

    // Search for Opmeting in the dropdown
    const searchInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder*="earch"], input[placeholder*="Search"]');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const rect = inp.getBoundingClientRect();
        if (rect.y > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
      return null;
    });

    if (searchInput) {
      await page.mouse.click(searchInput.x, searchInput.y);
      await page.keyboard.type('Opmeting');
      await page.waitForTimeout(2000);
    }

    // Click "Opmeting" option
    const opmetingOpt = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Opmeting') {
          const rect = el.getBoundingClientRect();
          if (rect.y > 200 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (opmetingOpt) {
      await page.mouse.click(opmetingOpt.x, opmetingOpt.y);
      console.log('  ✅ Job Type = Opmeting');
      await page.waitForTimeout(3000);
    } else {
      console.log('  ❌ Opmeting optie niet gevonden');
      // Show available options
      const options = await page.evaluate(() => {
        const result = [];
        const allEls = document.querySelectorAll('[role="option"], [role="listbox"] *, li');
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const text = el.textContent?.trim() || '';
          if (text.length > 1 && text.length < 60) result.push(text);
        }
        return result;
      });
      console.log('  Options:', options);
    }
  }

  await ss(page, 'Z03CF-04-jobtype');

  // ===== STEP 2: Set Client External ID =====
  // First, scroll down to see Client External ID field
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  // Re-scan for editors after scroll
  const editors2 = await page.evaluate(() => {
    const result = [];
    const editables = document.querySelectorAll('[contenteditable="true"], [data-slate-editor="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.x > 800 && rect.width > 50) {
        let label = '';
        let parent = el.parentElement;
        for (let i = 0; i < 8 && parent && !label; i++) {
          const lbl = parent.querySelector('label');
          if (lbl) label = lbl.textContent?.trim() || '';
          parent = parent.parentElement;
        }
        result.push({ label, x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2), text: el.textContent?.trim().substring(0, 30) || '' });
      }
    }
    return result;
  });
  console.log('\nEditors after scroll:', JSON.stringify(editors2, null, 2));

  // Find Client External ID field
  const extIdField = editors2.find(e => e.label.includes('External ID') || e.label.includes('external'));
  if (extIdField) {
    console.log('\n--- Setting Client External ID ---');
    await page.mouse.click(extIdField.x, extIdField.y);
    await page.waitForTimeout(1000);

    // Now find and click the "+" data picker button near this field
    // It should open a menu to pick data from Step 1 (HubSpot trigger)
    const plusBtn = await page.evaluate((fieldY) => {
      const btns = document.querySelectorAll('button');
      let best = null;
      let bestDist = 999;
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const text = btn.textContent?.trim() || '';
        if (text === '+' || ariaLabel.includes('Insert') || ariaLabel.includes('data') || ariaLabel.includes('map')) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 800) {
            const dist = Math.abs(rect.y - fieldY);
            if (dist < bestDist) {
              bestDist = dist;
              best = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), label: ariaLabel || text };
            }
          }
        }
      }
      return best;
    }, extIdField.y);

    if (plusBtn) {
      await page.mouse.click(plusBtn.x, plusBtn.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z03CF-05-datapicker');

      // Search for "hs_object_id" or "Record ID" in the data picker
      const dpSearch = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder*="earch"], input[placeholder*="Search"]');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const rect = inp.getBoundingClientRect();
          if (rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
        return null;
      });

      if (dpSearch) {
        await page.mouse.click(dpSearch.x, dpSearch.y);
        await page.keyboard.type('Record ID');
        await page.waitForTimeout(2000);

        // Click the result
        const recordIdOpt = await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.children.length > 0) continue;
            const text = el.textContent?.trim() || '';
            if (text.includes('Record ID') || text.includes('hs_object_id')) {
              const rect = el.getBoundingClientRect();
              if (rect.y > 250 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
            }
          }
          return null;
        });

        if (recordIdOpt) {
          await page.mouse.click(recordIdOpt.x, recordIdOpt.y);
          console.log(`  ✅ Client External ID = ${recordIdOpt.text}`);
          await page.waitForTimeout(2000);
        } else {
          console.log('  ❌ Record ID niet gevonden in data picker');
        }
      }
    } else {
      // Try typing directly - Zapier Slate might show data picker on "+"
      console.log('  No plus button, trying direct type with data reference');
    }
  } else {
    console.log('Client External ID veld niet gevonden, labels:', editors2.map(e => e.label));
  }

  await ss(page, 'Z03CF-06-extid');

  // ===== STEP 3: Set Assignee Email =====
  const assigneeField = editors2.find(e => e.label.includes('Assignee') || e.label.includes('assignee'));
  if (assigneeField) {
    console.log('\n--- Setting Assignee ---');
    await page.mouse.click(assigneeField.x, assigneeField.y);
    await page.waitForTimeout(500);
    await page.keyboard.type('daimy@sonty.nl');
    console.log('  ✅ Assignee = daimy@sonty.nl');
    await page.waitForTimeout(1000);
  }

  // ===== STEP 4: Map Client First Name =====
  const firstNameField = editors2.find(e => e.label.includes('First Name') || e.label.includes('first'));
  if (firstNameField) {
    console.log('\n--- Setting Client First Name ---');
    await page.mouse.click(firstNameField.x, firstNameField.y);
    await page.waitForTimeout(1000);

    // Find the "+" button near this field for data picker
    const plusBtn2 = await page.evaluate((fieldY) => {
      const btns = document.querySelectorAll('button');
      let best = null;
      let bestDist = 999;
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const text = btn.textContent?.trim() || '';
        if (text === '+' || ariaLabel.includes('Insert') || ariaLabel.includes('data')) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 800) {
            const dist = Math.abs(rect.y - fieldY);
            if (dist < bestDist) { bestDist = dist; best = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }; }
          }
        }
      }
      return best;
    }, firstNameField.y);

    if (plusBtn2) {
      await page.mouse.click(plusBtn2.x, plusBtn2.y);
      await page.waitForTimeout(3000);

      const dpSearch2 = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder*="earch"]');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const rect = inp.getBoundingClientRect();
          if (rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
        return null;
      });

      if (dpSearch2) {
        await page.mouse.click(dpSearch2.x, dpSearch2.y);
        await page.keyboard.type('First');
        await page.waitForTimeout(2000);

        const firstOpt = await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.children.length > 0) continue;
            const text = el.textContent?.trim() || '';
            if (text.includes('First') && text.includes('ame')) {
              const rect = el.getBoundingClientRect();
              if (rect.y > 250 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
            }
          }
          return null;
        });

        if (firstOpt) {
          await page.mouse.click(firstOpt.x, firstOpt.y);
          console.log(`  ✅ Client First Name = ${firstOpt.text}`);
          await page.waitForTimeout(2000);
        }
      }
    }
  }

  // ===== STEP 5: Map Client Last Name =====
  // Scroll down a bit more
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1000);

  const editors3 = await page.evaluate(() => {
    const result = [];
    const editables = document.querySelectorAll('[contenteditable="true"], [data-slate-editor="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.x > 800 && rect.width > 50) {
        let label = '';
        let parent = el.parentElement;
        for (let i = 0; i < 8 && parent && !label; i++) {
          const lbl = parent.querySelector('label');
          if (lbl) label = lbl.textContent?.trim() || '';
          parent = parent.parentElement;
        }
        result.push({ label, x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2), text: el.textContent?.trim().substring(0, 30) || '' });
      }
    }
    return result;
  });

  const lastNameField = editors3.find(e => e.label.includes('Last Name') || e.label.includes('last'));
  if (lastNameField) {
    console.log('\n--- Setting Client Last Name ---');
    await page.mouse.click(lastNameField.x, lastNameField.y);
    await page.waitForTimeout(1000);

    const plusBtn3 = await page.evaluate((fieldY) => {
      const btns = document.querySelectorAll('button');
      let best = null;
      let bestDist = 999;
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const text = btn.textContent?.trim() || '';
        if (text === '+' || ariaLabel.includes('Insert') || ariaLabel.includes('data')) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 800) {
            const dist = Math.abs(rect.y - fieldY);
            if (dist < bestDist) { bestDist = dist; best = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }; }
          }
        }
      }
      return best;
    }, lastNameField.y);

    if (plusBtn3) {
      await page.mouse.click(plusBtn3.x, plusBtn3.y);
      await page.waitForTimeout(3000);

      const dpSearch3 = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder*="earch"]');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const rect = inp.getBoundingClientRect();
          if (rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
        return null;
      });

      if (dpSearch3) {
        await page.mouse.click(dpSearch3.x, dpSearch3.y);
        await page.keyboard.type('Last');
        await page.waitForTimeout(2000);

        const lastOpt = await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.children.length > 0) continue;
            const text = el.textContent?.trim() || '';
            if (text.includes('Last') && text.includes('ame')) {
              const rect = el.getBoundingClientRect();
              if (rect.y > 250 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
            }
          }
          return null;
        });

        if (lastOpt) {
          await page.mouse.click(lastOpt.x, lastOpt.y);
          console.log(`  ✅ Client Last Name = ${lastOpt.text}`);
          await page.waitForTimeout(2000);
        }
      }
    }
  }

  await ss(page, 'Z03CF-07-mapped');

  // Take final screenshot showing all mapped fields
  // Scroll back to top to see all fields
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(2000);
  await ss(page, 'Z03CF-final');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
