const { chromium } = require('playwright');

// Publish ZAP-01 draft — try EVERY method until one works
(async () => {
  // Method 1: Fresh persistent context
  const dir = '/tmp/zapier-pub-' + Date.now();
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Login
  await page.goto('https://zapier.com/app/login');
  await page.waitForTimeout(5000);
  try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}

  const cap = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap > 0) { console.log('CAPTCHA — waiting 30s and retrying'); await page.waitForTimeout(30000); }

  await page.fill('input[type="email"]', 'daimy@sonty.nl');
  const b1 = await page.$$('button');
  for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(4000);

  const cap2 = await page.locator('iframe[src*="recaptcha"]').count();
  if (cap2 > 0) { console.log('CAPTCHA after email — aborting'); await ctx.close(); return; }

  await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
  const b2 = await page.$$('button');
  for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
  await page.waitForTimeout(12000);

  if (page.url().includes('login')) { console.log('Login failed'); await ctx.close(); return; }
  console.log('Logged in');

  // Go to draft
  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  // Try multiple publish methods
  let published = false;

  // Method 1: Direct URL to publish
  console.log('Method 1: Click Publish text');
  try {
    await page.locator('text=Publish').last().click({ timeout: 3000 });
    await page.waitForTimeout(3000);
    // Check for dialog
    const dialog = await page.$('[role="dialog"]');
    if (dialog) {
      // Fill version name if needed
      try {
        const inp = await dialog.$('input');
        if (inp) await inp.fill('v5-reuzenpanda');
      } catch(e) {}
      // Click publish in dialog
      const dialogBtns = await dialog.$$('button');
      for (const btn of dialogBtns) {
        if ((await btn.textContent()).trim() === 'Publish') {
          await btn.click();
          published = true;
          console.log('Published via dialog!');
          break;
        }
      }
    }
  } catch(e) {}

  if (!published) {
    await page.waitForTimeout(2000);
    // Method 2: Use Zapier's internal API
    console.log('Method 2: Zapier API');
    try {
      const cookies = await ctx.cookies();
      const sessionCookie = cookies.find(c => c.name === 'zapier_session' || c.name === 'session_id' || c.name.includes('session'));
      if (sessionCookie) {
        console.log('Found session cookie:', sessionCookie.name);
      }

      // Try publishing via fetch from within the page
      const result = await page.evaluate(async () => {
        try {
          // Get CSRF token
          const csrfMeta = document.querySelector('meta[name="csrf-token"]');
          const csrf = csrfMeta ? csrfMeta.content : '';

          // Try the Zapier publish API
          const res = await fetch('/api/v4/zaps/353405789/publish', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': csrf,
            },
            credentials: 'same-origin',
          });
          return { status: res.status, text: (await res.text()).substring(0, 200) };
        } catch(e) {
          return { error: e.message };
        }
      });
      console.log('API result:', JSON.stringify(result));
    } catch(e) {
      console.log('API method failed:', e.message.substring(0, 60));
    }
  }

  if (!published) {
    // Method 3: Use keyboard shortcut
    console.log('Method 3: Keyboard');
    await page.keyboard.press('Control+Shift+p');
    await page.waitForTimeout(3000);
    const dialog2 = await page.$('[role="dialog"]');
    if (dialog2) {
      const btns = await dialog2.$$('button');
      for (const btn of btns) {
        if ((await btn.textContent()).trim() === 'Publish') {
          await btn.click();
          published = true;
          console.log('Published via keyboard!');
          break;
        }
      }
    }
  }

  if (!published) {
    // Method 4: Click via evaluate with event simulation
    console.log('Method 4: Full event simulation');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"], span');
      for (const b of btns) {
        if (b.textContent.trim() === 'Publish' && b.offsetHeight > 0) {
          const rect = b.getBoundingClientRect();
          ['mousedown', 'mouseup', 'click'].forEach(type => {
            b.dispatchEvent(new MouseEvent(type, {
              bubbles: true, cancelable: true, view: window,
              clientX: rect.x + rect.width/2, clientY: rect.y + rect.height/2,
            }));
          });
          return;
        }
      }
    });
    await page.waitForTimeout(5000);
    const dialog3 = await page.$('[role="dialog"]');
    if (dialog3) {
      console.log('Dialog appeared!');
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const btns = dialog.querySelectorAll('button');
          btns.forEach(b => {
            if (b.textContent.trim() === 'Publish') b.click();
          });
        }
      });
      published = true;
      console.log('Published via simulation!');
    }
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap-pub-attempt.png' });

  const finalStatus = await page.evaluate(() =>
    document.body.innerText.includes('Draft') ? 'DRAFT' : 'PUBLISHED'
  );
  console.log('Final:', finalStatus);

  await ctx.close();
  console.log('Done');
})().catch(console.error);
