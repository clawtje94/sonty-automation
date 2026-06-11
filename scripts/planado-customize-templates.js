const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PLANADO_URL = 'https://sonty.planadoapp.com';
const EMAIL = 'daimy@sonty.nl';
const PASSWORD = '^XU6C&SuS*FFnb';
const SCREENSHOTS_DIR = path.join(__dirname, 'planado-templates');

(async () => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(`${PLANADO_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const emailInputs = await page.$$('input[type="text"], input[type="email"]');
  for (const inp of emailInputs) {
    const val = await inp.inputValue();
    if (!val) await inp.fill(EMAIL);
  }
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Inloggen")');
  await page.waitForURL('**/timeline/**', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Go to Inmeet afspraak template
  console.log('Going to Inmeet afspraak...');
  await page.goto(`${PLANADO_URL}/admin/templates/1f11c802-65cd-6aa0-9d06-7e73cee772e4`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click "Opdrachtveld toevoegen" dropdown to see field types
  console.log('Exploring Opdrachtveld dropdown...');
  await page.click('button:has-text("Opdrachtveld toevoegen")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '30-opdrachtveld-dropdown.png'), fullPage: true });

  // Get dropdown menu items
  const dropdownItems1 = await page.$$eval('[class*="dropdown"], [class*="menu"], [role="menu"], [role="listbox"], ul.dropdown-menu, .drop', els => els.map(el => ({
    text: el.innerText.trim().substring(0, 200),
    class: (el.className || '').substring(0, 100),
    tag: el.tagName,
    visible: el.offsetParent !== null
  })).filter(e => e.text && e.visible));
  console.log('Opdrachtveld dropdown items:', JSON.stringify(dropdownItems1, null, 2));

  // Also check for any popup/menu that appeared
  const visibleMenus = await page.$$eval('*', els => {
    return els.filter(el => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    }).map(el => ({
      text: el.innerText?.trim().substring(0, 100) || '',
      tag: el.tagName,
      class: (el.className || '').substring(0, 80)
    })).filter(e => e.text && (
      e.text.includes('Tekst') || e.text.includes('text') ||
      e.text.includes('Foto') || e.text.includes('photo') ||
      e.text.includes('Handtekening') || e.text.includes('signature') ||
      e.text.includes('Checkbox') || e.text.includes('checkbox') ||
      e.text.includes('Keuzelijst') || e.text.includes('dropdown') ||
      e.text.includes('Actie') || e.text.includes('action')
    ) && e.text.length < 60);
  });
  console.log('Visible menu items with field types:', JSON.stringify(visibleMenus, null, 2));

  // Try to screenshot just the area around the button
  const btn1 = await page.$('button:has-text("Opdrachtveld toevoegen")');
  if (btn1) {
    const box = await btn1.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '31-opdrachtveld-dropdown-closeup.png'),
        clip: { x: Math.max(0, box.x - 50), y: Math.max(0, box.y - 50), width: 500, height: 400 }
      });
    }
  }

  // Press Escape to close dropdown
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Now click "Rapportveld toevoegen" to see report field types
  console.log('Exploring Rapportveld dropdown...');
  await page.click('button:has-text("Rapportveld toevoegen")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '32-rapportveld-dropdown.png'), fullPage: true });

  const dropdownItems2 = await page.$$eval('*', els => {
    return els.filter(el => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    }).map(el => ({
      text: el.innerText?.trim().substring(0, 100) || '',
      tag: el.tagName,
      class: (el.className || '').substring(0, 80)
    })).filter(e => e.text && e.text.length < 40 && (
      e.text.includes('Tekst') || e.text.includes('text') ||
      e.text.includes('Foto') || e.text.includes('photo') ||
      e.text.includes('Handtekening') || e.text.includes('signature') ||
      e.text.includes('Checkbox') || e.text.includes('checkbox') ||
      e.text.includes('Keuzelijst') || e.text.includes('dropdown') ||
      e.text.includes('Actie') || e.text.includes('action')
    ));
  });
  console.log('Rapportveld dropdown items:', JSON.stringify(dropdownItems2, null, 2));

  // Try to get the actual dropdown list
  const btn2 = await page.$('button:has-text("Rapportveld toevoegen")');
  if (btn2) {
    const box = await btn2.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '33-rapportveld-dropdown-closeup.png'),
        clip: { x: Math.max(0, box.x - 50), y: Math.max(0, box.y - 50), width: 500, height: 400 }
      });
    }
  }

  // Get all elements near the dropdown buttons - look for the actual menu
  const allDropdowns = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('*').forEach(el => {
      const text = el.innerText?.trim() || '';
      const cls = el.className || '';
      if ((cls.includes('drop') || cls.includes('menu') || cls.includes('popup') || cls.includes('popover')) &&
          text.length > 5 && text.length < 300 && el.offsetParent !== null) {
        result.push({ tag: el.tagName, text: text.substring(0, 200), class: cls.substring(0, 100) });
      }
    });
    return result;
  });
  console.log('All visible dropdowns/menus:', JSON.stringify(allDropdowns, null, 2));

  console.log('\nDone!');
  await browser.close();
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
