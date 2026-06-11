const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const APP_ID = '33327041';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/${APP_ID}`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);

  // Klik Auth tab
  await page.getByText('Auth', { exact: true }).first().click();
  await page.waitForTimeout(3000);

  // Klik "Token weergeven"
  const showBtn = page.getByText('Token weergeve').or(page.getByText('Token weergeven'));
  await showBtn.first().click();
  await page.waitForTimeout(3000);

  // Nu zou het token zichtbaar moeten zijn — screenshot
  await page.screenshot({ path: path.join(__dirname, 'wf-debug-TOKEN-REVEALED.png') });

  // Lees het token
  const tokenText = await page.evaluate(() => {
    // Zoek tekst die begint met 'pat-eu1-'
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const tokens = [];
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent.trim();
      if (t.startsWith('pat-eu1-') && !t.includes('*')) {
        tokens.push(t);
      }
    }
    return tokens;
  });
  console.log('Tokens gevonden:', tokenText);

  // Probeer ook via Kopiëren knop + clipboard
  const copyBtn = page.getByText('Kopiëren').first();
  if (await copyBtn.isVisible().catch(() => false)) {
    await copyBtn.click();
    await page.waitForTimeout(1000);

    // Probeer clipboard te lezen
    const clipboardText = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (e) {
        return 'CLIPBOARD_ERROR: ' + e.message;
      }
    });
    console.log('Clipboard:', clipboardText);
  }

  // Dump alle zichtbare tekst rond het token
  const tokenArea = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="token" i], [class*="secret" i], [class*="code" i], code, pre, [class*="mono"]');
    return Array.from(els).map(el => el.innerText?.trim()).filter(t => t && t.length > 5);
  });
  console.log('Token area tekst:', tokenArea);

  // Probeer input waarde na reveal
  const inputs = await page.locator('input:visible').all();
  for (const inp of inputs) {
    const val = await inp.inputValue().catch(() => '');
    const type = await inp.getAttribute('type').catch(() => '');
    if (val && val.length > 10) {
      console.log(`Input type="${type}": ${val}`);
    }
  }

  await context.close();
  await browser.close();
})();
