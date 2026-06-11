const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');
const PORTAL_ID = '147970649';
const VIDEO_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

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

async function selectScope(page, searchTerm) {
  const scopeSearch = page.locator('input[role="searchbox"]:visible').first();
  await scopeSearch.fill(searchTerm);
  await page.waitForTimeout(1500);

  // Find all checkbox rows and click them
  const cbs = await page.locator('input[type="checkbox"]:visible').all();
  let count = 0;
  for (const cb of cbs) {
    const checked = await cb.isChecked().catch(() => true);
    if (!checked) {
      // Try clicking the parent label/row instead of checkbox directly
      const parent = cb.locator('..');
      await parent.click({ force: true }).catch(async () => {
        // Fallback: click checkbox with force
        await cb.click({ force: true }).catch(() => {});
      });
      await page.waitForTimeout(300);

      // Verify
      const nowChecked = await cb.isChecked().catch(() => false);
      if (nowChecked) {
        count++;
      } else {
        // Try JS click
        await cb.evaluate(el => el.click());
        await page.waitForTimeout(300);
        const finalCheck = await cb.isChecked().catch(() => false);
        if (finalCheck) count++;
        else console.log(`    ⚠️ Checkbox niet aan te vinken`);
      }
    } else {
      count++;
    }
  }
  console.log(`  ${searchTerm}: ${count}/${cbs.length} checked`);
  return count;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Private App aanmaken v5');

  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // 1. NAAM
  const nameByLabel = page.getByLabel('Naam');
  await nameByLabel.waitFor({ state: 'visible', timeout: 10000 });
  await nameByLabel.fill('Sonty Automation');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  console.log('✅ Naam: Sonty Automation');

  // Beschrijving
  const descField = page.locator('textarea:visible').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.fill('API access voor Sonty CRM automatisering');
  }

  // 2. BEREIKEN TAB
  await page.getByText('Bereiken', { exact: true }).first().click();
  await page.waitForTimeout(3000);
  await dismiss(page);

  // Open scope panel
  const addScopeBtn = page.locator('button').filter({ hasText: /nieuw bereik|bereik toevoegen/i }).first();
  await addScopeBtn.click();
  await page.waitForTimeout(3000);
  console.log('  Scope panel geopend');

  // Selecteer scopes
  const scopes = [
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    'crm.schemas.deals.read',
    'crm.schemas.deals.write',
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.schemas.contacts.read',
    'crm.schemas.contacts.write',
  ];

  for (const scope of scopes) {
    const scopeSearch = page.locator('input[role="searchbox"]:visible').first();
    await scopeSearch.fill(scope);
    await page.waitForTimeout(1500);

    // Find exact scope checkbox row
    const rows = await page.locator('input[type="checkbox"]:visible').all();
    for (const cb of rows) {
      // Get the scope name from nearby text
      const row = cb.locator('xpath=ancestor::*[contains(@class, "row") or contains(@class, "scope") or self::li or self::div[contains(@class, "Scope")]]').first();
      const rowText = await row.innerText().catch(async () => {
        // Fallback: get text from sibling/parent
        const parent = cb.locator('..');
        return await parent.innerText().catch(() => '');
      });

      // Just click every visible unchecked checkbox
      const checked = await cb.isChecked().catch(() => true);
      if (!checked) {
        // Use evaluate to click (most reliable)
        await cb.evaluate(el => {
          el.click();
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForTimeout(300);
        const nowChecked = await cb.isChecked().catch(() => false);
        console.log(`    ${scope} checkbox: ${nowChecked ? '✅' : '❌'}`);
      }
    }
  }

  await ss(page, 'PA5-01-scopes-checked');

  // Check "Geselecteerde bereiken" count
  const selectedText = await page.evaluate(() => {
    const el = document.querySelector('[class*="selected"], [class*="Selected"]');
    return el ? el.innerText : '';
  });
  console.log(`  Selected text: "${selectedText}"`);

  // Check Bijwerken button state
  const updateBtn = page.locator('button').filter({ hasText: /^Bijwerken$/ }).first();
  const isDisabled = await updateBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true').catch(() => true);
  console.log(`  Bijwerken disabled: ${isDisabled}`);

  if (isDisabled) {
    // Probeer bulk select — zoek een "alles selecteren" optie
    const selectAllBtn = page.locator('button, a, label').filter({ hasText: /alles|select all|alle/i }).first();
    if (await selectAllBtn.isVisible().catch(() => false)) {
      await selectAllBtn.click();
      await page.waitForTimeout(1000);
    }

    // Probeer een simpelere scope
    const scopeSearch = page.locator('input[role="searchbox"]:visible').first();
    await scopeSearch.fill('crm.objects.deals');
    await page.waitForTimeout(2000);
    await ss(page, 'PA5-02-deals-search');

    // Dump checkbox HTML voor debug
    const cbHtml = await page.evaluate(() => {
      const cbs = document.querySelectorAll('input[type="checkbox"]');
      return Array.from(cbs).slice(0, 5).map(cb => ({
        checked: cb.checked,
        disabled: cb.disabled,
        id: cb.id,
        name: cb.name,
        parentHtml: cb.parentElement?.outerHTML?.substring(0, 200),
      }));
    });
    console.log('  Checkbox debug:', JSON.stringify(cbHtml, null, 2));

    // Probeer via label klikken
    const labels = await page.locator('label:visible').all();
    console.log(`  Labels: ${labels.length}`);
    for (const label of labels.slice(0, 5)) {
      const text = await label.innerText().catch(() => '');
      if (text.includes('crm.')) {
        console.log(`  Label: "${text}" — klikken`);
        await label.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    await ss(page, 'PA5-03-after-label-click');

    // Check opnieuw
    const isDisabled2 = await updateBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true').catch(() => true);
    console.log(`  Bijwerken disabled na label click: ${isDisabled2}`);
  }

  if (!isDisabled || true) {
    // Force click Bijwerken
    await updateBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // APP AANMAKEN
  const createBtn = page.locator('button').filter({ hasText: /^App aanmaken$/ }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // Bevestiging
    const confirmBtn = page.locator('button').filter({ hasText: /doorgaan|bevestig|continue/i }).last();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'PA5-04-result');

  // TOKEN
  await page.waitForTimeout(3000);
  const showTokenBtn = page.locator('button').filter({ hasText: /token.*weergeven|show.*token|weergeven/i }).first();
  if (await showTokenBtn.isVisible().catch(() => false)) {
    await showTokenBtn.click();
    await page.waitForTimeout(2000);
  }

  let token = '';
  const allInputs = await page.locator('input:visible').all();
  for (const inp of allInputs) {
    const val = await inp.inputValue().catch(() => '');
    if (val && val.startsWith('pat-')) {
      token = val;
      break;
    }
  }

  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nPagina:', finalText.substring(0, 600));

  console.log('\n═══ RESULTAAT ═══');
  if (token) {
    console.log('🎉 TOKEN:', token);
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!env.includes('HUBSPOT_API_TOKEN')) {
      env += `\nHUBSPOT_API_TOKEN=${token}\n`;
      fs.writeFileSync(envPath, env);
      console.log('Token opgeslagen in .env');
    }
  } else {
    console.log('Token niet gevonden');
    console.log('URL:', page.url());
  }

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
