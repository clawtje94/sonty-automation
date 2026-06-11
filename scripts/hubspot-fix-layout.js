const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(5000);

  if (page.url().includes('confirm')) {
    console.log('WAITING_FOR_CODE');
    // Write status file so parent process knows to read the code
    fs.writeFileSync('/tmp/hs-needs-code.txt', 'waiting');

    // Poll for the code file
    for (let i = 0; i < 60; i++) { // Wait up to 2 minutes
      await new Promise(r => setTimeout(r, 2000));
      try {
        const code = fs.readFileSync('/tmp/hs-code.txt', 'utf8').trim();
        if (code && code.length === 6) {
          console.log('Got code:', code);
          await page.fill('input[placeholder*="code"], input[type="text"]', code);
          await page.click('button:has-text("Continue"), button[type="submit"]');
          await page.waitForTimeout(10000);
          break;
        }
      } catch(e) {}
    }
  }

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('Login failed after code:', page.url());
    await browser.close();
    return;
  }
  console.log('LOGGED_IN');
  fs.writeFileSync('/tmp/hs-needs-code.txt', 'logged_in');

  // Go to Isa Geer deal page first to see current state
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
  await page.waitForTimeout(8000);

  // Click "Aanpassen" in the deal sidebar
  console.log('Looking for Aanpassen...');
  try {
    // The "Aanpassen" link is in the left sidebar
    const aanpasLinks = await page.$$('text=Aanpassen');
    console.log('Found', aanpasLinks.length, 'Aanpassen links');
    for (const link of aanpasLinks) {
      const visible = await link.isVisible();
      if (visible) {
        await link.click();
        await page.waitForTimeout(5000);
        console.log('Clicked Aanpassen, URL:', page.url());
        await page.screenshot({ path: '/tmp/hs-aanpassen.png' });
        break;
      }
    }
  } catch(e) {
    console.log('Aanpassen click failed:', e.message.substring(0, 60));
  }

  // If we're on the layout editor, configure it
  if (page.url().includes('layout-editor') || page.url().includes('record-customization')) {
    console.log('\n=== LAYOUT EDITOR ===');
    await page.screenshot({ path: '/tmp/hs-layout-editor.png' });

    const editorText = await page.evaluate(() => document.body.innerText);
    console.log(editorText.substring(0, 1000));

    // Look for the sidebar section to add/reorder properties
    // The layout editor typically has a drag-and-drop interface
    // with sections like "Linker zijbalk" and available properties
  } else {
    // We might be on the sales-products-settings page
    console.log('URL:', page.url());
    await page.screenshot({ path: '/tmp/hs-after-aanpassen.png' });

    // Get full page text
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log(pageText.substring(0, 500));
  }

  await browser.close();
  console.log('Done');
})().catch(console.error);
