const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const APP_ID = '33327041';

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}
async function dismiss(page) {
  await page.evaluate(() => {
    document.getElementById('mini-trial-guide-iframe')?.remove();
    document.querySelectorAll('[class*="TrialGuide"], [class*="trial-guide"]').forEach(e => e.remove());
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Token ophalen voor Sonty Automation');

  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/${APP_ID}`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // Klik "Auth" tab
  const authTab = page.getByText('Auth', { exact: true }).first();
  await authTab.click();
  await page.waitForTimeout(3000);
  await dismiss(page);
  await ss(page, 'TOKEN-01-auth-tab');

  // Dump pagina tekst
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Auth tab tekst:', text.substring(0, 600));

  // Zoek "Token weergeven" / "Show token" knop
  const showBtn = page.locator('button').filter({ hasText: /token.*weergeven|toon.*token|show.*token|weergeven/i }).first();
  if (await showBtn.isVisible().catch(() => false)) {
    console.log('  "Token weergeven" knop gevonden');
    await showBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, 'TOKEN-02-shown');
  }

  // Zoek token in inputs
  let token = '';
  const allInputs = await page.locator('input:visible').all();
  for (const inp of allInputs) {
    const val = await inp.inputValue().catch(() => '');
    const type = await inp.getAttribute('type').catch(() => '');
    console.log(`  input type="${type}" val="${val.substring(0, 30)}..."`);
    if (val && (val.startsWith('pat-') || (val.length > 30 && !val.includes(' ')))) {
      token = val;
    }
  }

  // Zoek in code/pre/span elementen
  if (!token) {
    const codeEls = await page.locator('code, pre, [class*="token" i], [class*="secret" i], [class*="key" i]').all();
    for (const el of codeEls) {
      const text = await el.innerText().catch(() => '');
      if (text && (text.startsWith('pat-') || (text.length > 20 && text.match(/^[a-zA-Z0-9_-]+$/)))) {
        token = text.trim();
        console.log(`  Token in element: ${token.substring(0, 30)}...`);
        break;
      }
    }
  }

  // Probeer clipboard copy knop
  if (!token) {
    const copyBtns = await page.locator('button').filter({ hasText: /kopieer|kopiëren|copy|klembord/i }).all();
    for (const btn of copyBtns) {
      const btnText = await btn.innerText().catch(() => '');
      console.log(`  Copy knop: "${btnText}"`);
    }

    // Klik op de eerste copy knop als die er is
    if (copyBtns.length > 0) {
      // We can't access clipboard, but let's try
      await copyBtns[0].click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  // Dump alle zichtbare tekst die eruit ziet als een token
  if (!token) {
    const allText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        if (t.startsWith('pat-') || (t.length > 30 && t.match(/^[a-zA-Z0-9_-]+$/))) {
          texts.push(t);
        }
      }
      return texts;
    });
    if (allText.length > 0) {
      token = allText[0];
      console.log(`  Token via text walk: ${token.substring(0, 30)}...`);
    }
  }

  await ss(page, 'TOKEN-03-final');

  console.log('\n═══ RESULTAAT ═══');
  if (token) {
    console.log('🎉 ACCESS TOKEN:', token);
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!env.includes('HUBSPOT_API_TOKEN')) {
      env += `\nHUBSPOT_API_TOKEN=${token}\n`;
      fs.writeFileSync(envPath, env);
      console.log('Token opgeslagen in .env');
    }
  } else {
    console.log('Token niet automatisch gevonden');
    console.log('Check screenshot TOKEN-02-shown / TOKEN-03-final');
  }

  await context.close();
  await browser.close();
})();
