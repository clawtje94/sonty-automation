const { chromium } = require('playwright');

const USER_DATA_DIR = '/tmp/zapier-chrome-profile';

(async () => {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1400, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  // Login if needed
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  if (page.url().includes('login')) {
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    const btns = await page.$$('button');
    for (const btn of btns) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(4000);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await pw.fill('D^mR&F%82WtBrVK&fnm8');
      const btns2 = await page.$$('button');
      for (const btn of btns2) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
      await page.waitForTimeout(12000);
    }
  }

  if (page.url().includes('login')) { console.log('Login failed'); await context.close(); return; }
  console.log('Logged in\n');

  // Go to ZAP-01 editor
  await page.goto('https://zapier.com/editor/353405789');
  await page.waitForTimeout(8000);

  // Click Step 2: Create or Update Contact
  console.log('=== Step 2: Fix Contact mapping ===');
  await page.click('text=Create or Update Contact');
  await page.waitForTimeout(3000);

  // Click Configure tab
  try { await page.click('text=Configure', { timeout: 3000 }); await page.waitForTimeout(2000); } catch(e) {}

  // Take screenshot of current config
  await page.screenshot({ path: '/tmp/zap01-s2-config.png' });

  // I need to find the input fields and click on them to open the data picker
  // The fields I need to map:
  // - Contact Email: already mapped to "Parsed Free Fields Email" ✅
  // - First name: needs to be mapped
  // - Last name: needs to be mapped
  // - Phone: needs to be mapped

  // Scroll down to find more fields in step 2 config
  // The Zapier editor has a right panel with form fields
  // Let me find all the "Enter text or insert data" placeholders
  const fields = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, [data-slate-editor], [contenteditable]');
    const results = [];
    inputs.forEach(inp => {
      const rect = inp.getBoundingClientRect();
      if (rect.left > 450 && rect.width > 100) { // Right panel
        results.push({
          tag: inp.tagName,
          type: inp.type || '',
          value: inp.value || inp.textContent?.substring(0, 80) || '',
          placeholder: inp.placeholder || '',
          y: rect.top,
          x: rect.left,
        });
      }
    });
    return results.sort((a, b) => a.y - b.y);
  });

  console.log('Right panel fields:');
  fields.forEach(f => console.log(`  y=${Math.round(f.y)} ${f.tag} type=${f.type} val="${f.value}" placeholder="${f.placeholder}"`));

  // Let me look for the full list of available HubSpot contact fields
  // by scrolling through the step 2 config panel
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        const s = window.getComputedStyle(d);
        if (r.left > 450 && r.height > 200 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
          d.scrollTop += 300;
        }
      });
    });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: '/tmp/zap01-s2-scrolled.png' });

  // Get all visible labels and fields after scrolling
  const allLabels = await page.evaluate(() => {
    const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"]');
    const results = [];
    labels.forEach(l => {
      const rect = l.getBoundingClientRect();
      if (rect.left > 450 && rect.width > 50) {
        results.push({ text: l.textContent.trim().substring(0, 80), y: rect.top });
      }
    });
    return results.sort((a, b) => a.y - b.y);
  });

  console.log('\nVisible labels after scroll:');
  allLabels.forEach(l => console.log(`  y=${Math.round(l.y)} "${l.text}"`));

  await context.close();
  console.log('\nDone');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
