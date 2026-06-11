const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  screenshot: ${name}`);
}

async function clickPlusAndMap(page, searchTerm) {
  // After clicking "+", a data picker dropdown opens. Search and click result.
  await page.waitForTimeout(1500);

  // Find search input in the data picker
  const searchInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const ph = (inp.placeholder || '').toLowerCase();
      if (ph.includes('search') || ph.includes('zoek') || ph.includes('find')) {
        const rect = inp.getBoundingClientRect();
        if (rect.width > 100) return { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (searchInput) {
    await page.mouse.click(searchInput.x, searchInput.y);
    await page.waitForTimeout(300);
    await page.keyboard.type(searchTerm);
    await page.waitForTimeout(1500);

    // Click first matching result
    const result = await page.evaluate((term) => {
      const candidates = document.querySelectorAll('*');
      for (const el of candidates) {
        if (el.children.length > 3) continue;
        if (el.offsetParent === null) continue;
        const text = el.textContent?.trim() || '';
        if (text.toLowerCase().includes(term.toLowerCase()) && text.length < 60) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 10 && rect.height < 50 && rect.y > 100 && rect.width > 50) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
          }
        }
      }
      return null;
    }, searchTerm);

    if (result) {
      await page.mouse.click(result.x, result.y);
      console.log(`    -> ${result.text}`);
      await page.waitForTimeout(500);
      return true;
    }
  }
  // Close picker
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  return false;
}

async function findAndFillField(page, labelText, action) {
  // Find a field by its label, then perform the action on it
  // action can be: { type: 'text', value: '...' } or { type: 'dataPicker', searchTerm: '...' }

  // First find the label and its associated editor + "+" button
  const fieldInfo = await page.evaluate((lbl) => {
    const labels = document.querySelectorAll('label');
    for (const l of labels) {
      if (l.offsetParent === null) continue;
      const text = l.textContent?.trim();
      if (text !== lbl) continue;
      const rect = l.getBoundingClientRect();
      if (rect.x < 850 || rect.y < 0 || rect.y > 800) continue;

      // Find the editor (contenteditable or input) near this label
      let container = l.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const editor = container.querySelector('[contenteditable="true"]');
        const input = container.querySelector('input:not([type="hidden"])');
        const target = editor || input;
        if (target && target.offsetParent !== null) {
          const tRect = target.getBoundingClientRect();
          if (tRect.width > 100) {
            // Find "+" button
            const buttons = document.querySelectorAll('button');
            let plusBtn = null;
            for (const btn of buttons) {
              if (btn.offsetParent === null) continue;
              if (btn.textContent?.trim() !== '+') continue;
              const bRect = btn.getBoundingClientRect();
              const yDist = Math.abs(bRect.y - tRect.y);
              if (yDist < 30 && bRect.x > tRect.x) {
                plusBtn = { x: Math.round(bRect.x + bRect.width / 2), y: Math.round(bRect.y + bRect.height / 2) };
                break;
              }
            }
            return {
              editor: { x: Math.round(tRect.x + 10), y: Math.round(tRect.y + tRect.height / 2) },
              plus: plusBtn,
              isContentEditable: !!editor
            };
          }
        }
        container = container.parentElement;
      }
    }
    return null;
  }, labelText);

  if (!fieldInfo) {
    console.log(`    "${labelText}": niet gevonden op scherm`);
    return false;
  }

  if (action.type === 'text') {
    // Click editor and type text
    await page.mouse.click(fieldInfo.editor.x, fieldInfo.editor.y);
    await page.waitForTimeout(300);
    await page.keyboard.type(action.value);
    console.log(`    "${labelText}": typed "${action.value}"`);
    return true;
  }

  if (action.type === 'dataPicker' && fieldInfo.plus) {
    await page.mouse.click(fieldInfo.plus.x, fieldInfo.plus.y);
    const result = await clickPlusAndMap(page, action.searchTerm);
    if (result) {
      console.log(`    "${labelText}": mapped via data picker`);
    } else {
      console.log(`    "${labelText}": data picker mapping failed for "${action.searchTerm}"`);
    }
    return result;
  }

  if (action.type === 'textAndData') {
    // Type text first, then insert data picker values
    await page.mouse.click(fieldInfo.editor.x, fieldInfo.editor.y);
    await page.waitForTimeout(300);

    for (const part of action.parts) {
      if (part.text) {
        await page.keyboard.type(part.text);
        await page.waitForTimeout(200);
      }
      if (part.dataPicker && fieldInfo.plus) {
        await page.mouse.click(fieldInfo.plus.x, fieldInfo.plus.y);
        await clickPlusAndMap(page, part.dataPicker);
      }
    }
    return true;
  }

  return false;
}

async function scrollToField(page, labelText) {
  // Scroll until the field is visible
  for (let attempt = 0; attempt < 5; attempt++) {
    const found = await page.evaluate((lbl) => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.offsetParent === null) continue;
        if (l.textContent?.trim() === lbl) {
          const rect = l.getBoundingClientRect();
          if (rect.x > 850 && rect.y > 50 && rect.y < 600) return true;
        }
      }
      return false;
    }, labelText);

    if (found) return true;
    await page.mouse.move(1068, 400);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(800);
  }
  return false;
}

async function fillZap(page, zapId, zapName) {
  console.log(`\n====== ${zapName} (${zapId}) ======`);

  await page.goto(`https://zapier.com/editor/${zapId}/draft`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click Step 2 (Create Job)
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

  // Click Configure
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);

  // 1. Fill Description with phone + email from HubSpot
  console.log('  [Description]');
  if (await scrollToField(page, 'Description')) {
    await findAndFillField(page, 'Description', {
      type: 'textAndData',
      parts: [
        { text: 'Tel: ' },
        { dataPicker: 'Phone Number' },
        { text: ' | Email: ' },
        { dataPicker: 'Email' }
      ]
    });
  }

  // 2. Fill Client Address
  console.log('  [Client Address]');
  if (await scrollToField(page, 'Client Address')) {
    await findAndFillField(page, 'Client Address', {
      type: 'textAndData',
      parts: [
        { dataPicker: 'Street Address' },
        { text: ', ' },
        { dataPicker: 'Postal Code' },
        { text: ' ' },
        { dataPicker: 'City' }
      ]
    });
  }

  // 3. Fill Contacts Name with "Telefoon"
  console.log('  [Contacts]');
  if (await scrollToField(page, 'Name')) {
    // Check if this is the Contacts section Name field
    const nameInfo = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.offsetParent === null) continue;
        if (l.textContent?.trim() !== 'Name') continue;
        const rect = l.getBoundingClientRect();
        if (rect.x > 850 && rect.y > 0 && rect.y < 800) {
          // Check if "Contacts" header is nearby above
          const parent = l.closest('[class]');
          const allText = parent?.parentElement?.textContent || '';
          if (allText.includes('Contacts') || allText.includes('Value')) {
            return true;
          }
        }
      }
      return false;
    });

    if (nameInfo) {
      await findAndFillField(page, 'Name', { type: 'text', value: 'Telefoon' });
    }
  }

  // 4. Fill Contacts Value with phone
  if (await scrollToField(page, 'Value')) {
    await findAndFillField(page, 'Value', {
      type: 'dataPicker',
      searchTerm: 'Phone'
    });
  }

  await ss(page, `ZFILL-${zapName}-result`);

  // Click Continue
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(2000);

  const continueBtn = await page.evaluate(() => {
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
    console.log('  Continue geklikt');
    await page.waitForTimeout(5000);
    await ss(page, `ZFILL-${zapName}-test`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('Zapier: Description + Client Address + Contacts invullen');

  await fillZap(page, '353373774', 'ZAP-03');
  await fillZap(page, '353424667', 'ZAP-08');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('\nSession opgeslagen');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
