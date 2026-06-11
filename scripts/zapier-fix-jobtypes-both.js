const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

async function fixJobType(page, zapId, zapName, oldType, newType) {
  console.log(`\n====== ${zapName} (${zapId}): "${oldType}" → "${newType}" ======`);

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

  // Find Job Type editor and update it
  const editor = await page.evaluate(() => {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      if (el.offsetParent === null) continue;
      let parent = el.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const l = parent.querySelector('label');
        if (l && l.textContent?.trim() === 'Job Type') {
          const rect = el.getBoundingClientRect();
          if (rect.y > 0 && rect.y < 800) return { x: Math.round(rect.x + 10), y: Math.round(rect.y + rect.height / 2), content: el.textContent?.trim() || '' };
        }
        parent = parent.parentElement;
      }
    }
    return null;
  });

  if (editor) {
    console.log(`  Huidige waarde: "${editor.content}"`);
    await page.mouse.click(editor.x, editor.y);
    await page.waitForTimeout(300);
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.type(newType);
    console.log(`  ✅ Job Type → "${newType}"`);
    await page.waitForTimeout(1000);
  } else {
    console.log('  ❌ Job Type veld niet gevonden');
  }

  // Scroll down and click Continue
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
    console.log('  Continue');
    await page.waitForTimeout(5000);
  }

  // Verify in test preview
  const testText = await page.evaluate(() => document.body.innerText.substring(0, 4000));
  const jobTypeMatch = testText.match(/Job Type\n(.+)/);
  if (jobTypeMatch) {
    console.log(`  Test preview Job Type: "${jobTypeMatch[1]}"`);
  }

  await ss(page, `ZFIX-${zapName.replace(/[^a-zA-Z0-9]/g, '')}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 Zapier Job Types fixen');

  // Fix ZAP-03: Opmeting → Inmeet afspraak
  await fixJobType(page, '353373774', 'ZAP-03', 'Opmeting', 'Inmeet afspraak');

  // Fix ZAP-08: Installatie → Montage afspraak
  await fixJobType(page, '353424667', 'ZAP-08', 'Installatie', 'Montage afspraak');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('\n✅ Beide zaps bijgewerkt');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
