const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  screenshot: ${name}`);
}

// Map a field by label: click the "+" data picker, search, click result
async function mapDataField(page, label, searchTerm) {
  console.log(`  Mapping: ${label} -> "${searchTerm}"`);

  // Find the editor for this label and its "+" button
  const fieldInfo = await page.evaluate((lbl) => {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      let parent = el.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const labels = parent.querySelectorAll('label');
        for (const l of labels) {
          if (l.textContent?.trim() === lbl) {
            const rect = el.getBoundingClientRect();
            if (rect.y > 0 && rect.y < 900) {
              // Find "+" button near this editor
              const buttons = document.querySelectorAll('button');
              let plusBtn = null;
              let minDist = 999;
              for (const btn of buttons) {
                if (btn.offsetParent === null) continue;
                const btnText = btn.textContent?.trim();
                if (btnText !== '+') continue;
                const btnRect = btn.getBoundingClientRect();
                // Must be to the right of the editor and vertically close
                if (btnRect.x > rect.x + rect.width - 20) {
                  const yDist = Math.abs(btnRect.y - rect.y);
                  if (yDist < 30 && yDist < minDist) {
                    minDist = yDist;
                    plusBtn = { x: Math.round(btnRect.x + btnRect.width / 2), y: Math.round(btnRect.y + btnRect.height / 2) };
                  }
                }
              }
              return {
                editor: { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) },
                plus: plusBtn
              };
            }
          }
        }
        parent = parent.parentElement;
      }
    }
    return null;
  }, label);

  if (!fieldInfo) {
    console.log(`    Field "${label}" niet gevonden`);
    return false;
  }

  if (!fieldInfo.plus) {
    console.log(`    "+" button niet gevonden voor "${label}"`);
    return false;
  }

  // Click the "+" button to open data picker
  await page.mouse.click(fieldInfo.plus.x, fieldInfo.plus.y);
  await page.waitForTimeout(1500);

  // Search in data picker
  const searchInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"], input[placeholder]');
    for (const inp of inputs) {
      if (inp.offsetParent === null) continue;
      const ph = inp.placeholder?.toLowerCase() || '';
      if (ph.includes('search') || ph.includes('zoek')) {
        const rect = inp.getBoundingClientRect();
        return { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (searchInput) {
    await page.mouse.click(searchInput.x, searchInput.y);
    await page.waitForTimeout(300);
    await page.keyboard.type(searchTerm);
    await page.waitForTimeout(1500);

    // Click the first matching result
    const result = await page.evaluate((term) => {
      const items = document.querySelectorAll('[class*="option"], [class*="item"], [role="option"], li, button');
      for (const item of items) {
        if (item.offsetParent === null) continue;
        const text = item.textContent?.trim() || '';
        if (text.toLowerCase().includes(term.toLowerCase())) {
          const rect = item.getBoundingClientRect();
          if (rect.height > 0 && rect.height < 60 && rect.y > 0) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
          }
        }
      }
      return null;
    }, searchTerm);

    if (result) {
      await page.mouse.click(result.x, result.y);
      console.log(`    Mapped: ${result.text}`);
      await page.waitForTimeout(500);
      return true;
    } else {
      console.log(`    Geen resultaat voor "${searchTerm}"`);
      // Close data picker by pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      return false;
    }
  } else {
    console.log(`    Search input niet gevonden in data picker`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return false;
  }
}

async function addFieldsToZap(page, zapId, zapName) {
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

  // Click Configure breadcrumb
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);
  await ss(page, `ZADD-${zapName}-01-configure`);

  // First, let's see what fields are visible
  const visibleFields = await page.evaluate(() => {
    const labels = [];
    document.querySelectorAll('label').forEach(l => {
      if (l.offsetParent === null) return;
      const text = l.textContent?.trim();
      if (text && text.length < 40) {
        const rect = l.getBoundingClientRect();
        if (rect.x > 850 && rect.y > 0 && rect.y < 900) {
          labels.push({ text, y: Math.round(rect.y) });
        }
      }
    });
    return labels;
  });
  console.log('  Zichtbare velden:', visibleFields.map(f => f.text));

  // Scroll down to find more fields
  await page.mouse.move(1068, 500);
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(2000);

  const moreFields = await page.evaluate(() => {
    const labels = [];
    document.querySelectorAll('label').forEach(l => {
      if (l.offsetParent === null) return;
      const text = l.textContent?.trim();
      if (text && text.length < 40) {
        const rect = l.getBoundingClientRect();
        if (rect.x > 850 && rect.y > 0 && rect.y < 900) {
          labels.push({ text, y: Math.round(rect.y) });
        }
      }
    });
    return labels;
  });
  console.log('  Na scroll:', moreFields.map(f => f.text));
  await ss(page, `ZADD-${zapName}-02-scrolled`);

  // Scroll down more to see all fields
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(2000);

  const evenMoreFields = await page.evaluate(() => {
    const labels = [];
    document.querySelectorAll('label').forEach(l => {
      if (l.offsetParent === null) return;
      const text = l.textContent?.trim();
      if (text && text.length < 40) {
        const rect = l.getBoundingClientRect();
        if (rect.x > 850 && rect.y > 0 && rect.y < 900) {
          labels.push({ text, y: Math.round(rect.y) });
        }
      }
    });
    return labels;
  });
  console.log('  Na 2e scroll:', evenMoreFields.map(f => f.text));
  await ss(page, `ZADD-${zapName}-03-scrolled2`);

  // Now try to map the fields we need
  // Scroll back to top first
  await page.mouse.move(1068, 300);
  await page.mouse.wheel(0, -3000);
  await page.waitForTimeout(2000);

  // Map phone
  const phoneMapped = await mapDataField(page, 'Phone', 'Phone');

  // Scroll down a bit to find email/address
  await page.mouse.move(1068, 500);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);

  const emailMapped = await mapDataField(page, 'Email', 'Email');

  // Scroll for address fields
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);

  // Try Address or Street
  let addressMapped = await mapDataField(page, 'Address Line 1', 'Street');
  if (!addressMapped) {
    addressMapped = await mapDataField(page, 'Address', 'Street');
  }

  // Try City
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1000);
  const cityMapped = await mapDataField(page, 'City', 'City');

  // Try Zip
  const zipMapped = await mapDataField(page, 'Postal Code', 'Zip');
  if (!zipMapped) {
    await mapDataField(page, 'Zip', 'Zip');
  }

  // External ID - map to deal ID for reverse lookup
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);
  const extIdMapped = await mapDataField(page, 'External ID', 'Record ID');

  await ss(page, `ZADD-${zapName}-04-final`);

  // Click Continue to validate
  await page.mouse.move(1068, 400);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(2000);

  const continueBtn = await page.evaluate(() => {
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
    console.log('  Continue geklikt');
    await page.waitForTimeout(5000);
    await ss(page, `ZADD-${zapName}-05-test`);
  }

  console.log(`  Resultaat: Phone=${phoneMapped}, Email=${emailMapped}, Address=${addressMapped}, City=${cityMapped}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('Zapier: telefoon, email, adres toevoegen aan ZAP-03 en ZAP-08');

  // ZAP-03: Inmeet afspraak
  await addFieldsToZap(page, '353373774', 'ZAP-03');

  // ZAP-08: Montage afspraak
  await addFieldsToZap(page, '353424667', 'ZAP-08');

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('\nSession opgeslagen');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
