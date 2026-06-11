const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  // The publish dialog should still be open
  // Click the "Publish" button in the dialog
  try {
    // Fill version name
    const versionInput = await page.$('input[placeholder], input[type="text"]');
    if (versionInput) {
      const rect = await versionInput.boundingBox();
      if (rect && rect.y > 200 && rect.y < 400) { // Dialog area
        await versionInput.fill('v5 - Reuzenpanda data');
        console.log('Version name filled');
      }
    }

    // Click Publish in dialog
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = (await btn.textContent()).trim();
      const rect = await btn.boundingBox();
      if (text === 'Publish' && rect && rect.y > 200 && rect.y < 400) {
        await btn.click();
        console.log('Clicked Publish in dialog');
        break;
      }
    }
    await page.waitForTimeout(5000);
  } catch(e) {
    console.log('Dialog interaction failed:', e.message.substring(0, 60));
  }

  await page.screenshot({ path: '/tmp/zap-published-v5.png' });

  // Check final status
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes('Draft')) {
    console.log('Still Draft');
  } else {
    console.log('Published!');
  }

  // Verify the fields by clicking step 3
  await page.click('text=Create Deal');
  await page.waitForTimeout(2000);
  try { await page.click('text=Configure', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Scroll to Reuzenpanda fields
  for (let i = 0; i < 60; i++) {
    const found = await page.evaluate(() => {
      const labels = document.querySelectorAll('label');
      for (const l of labels) {
        if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) return true;
      }
      return false;
    });
    if (found) break;
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.height > 300 && (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 20) {
          d.scrollTop += 80;
        }
      });
    });
    await page.waitForTimeout(80);
  }

  await page.screenshot({ path: '/tmp/zap-verify-fields.png' });

  // Get field values
  const fieldValues = await page.evaluate(() => {
    const results = [];
    const labels = document.querySelectorAll('label');
    for (const l of labels) {
      if (l.textContent.toLowerCase().includes('reuzenpanda') && l.offsetHeight > 0) {
        // Find the editor below this label
        let sibling = l.parentElement;
        while (sibling) {
          const editor = sibling.querySelector('[data-slate-editor], [contenteditable]');
          if (editor) {
            results.push({ label: l.textContent.trim(), value: editor.textContent.substring(0, 100) });
            break;
          }
          sibling = sibling.nextElementSibling;
        }
        if (!results.find(r => r.label === l.textContent.trim())) {
          results.push({ label: l.textContent.trim(), value: '(editor not found)' });
        }
      }
    }
    return results;
  });

  console.log('\nField values:');
  fieldValues.forEach(f => console.log('  ' + f.label + ': ' + f.value));

  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
