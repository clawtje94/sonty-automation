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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  console.log('🎬 Private App aanmaken v3');

  // Ga naar private app create pagina
  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'PA3-00-form');

  // 1. BASISINFORMATIE TAB
  // Vul naam in — zoek input veld
  // De pagina heeft: Naam, Logo, Beschrijving
  // Er zijn 2 inputs (zoekbalk + naam veld waarschijnlijk)
  const nameInput = page.locator('input:visible').nth(1); // skip search
  const firstInput = page.locator('input:visible').first();

  // Check welke input het naam veld is
  for (let i = 0; i < 3; i++) {
    const inp = page.locator('input:visible').nth(i);
    if (await inp.isVisible().catch(() => false)) {
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const type = await inp.getAttribute('type').catch(() => '');
      const value = await inp.inputValue().catch(() => '');
      console.log(`  input[${i}]: type="${type}" placeholder="${placeholder}" value="${value}"`);
    }
  }

  // Probeer de naam in te vullen via het label of een ander attribuut
  // De tekst zegt "Naam" als label — probeer getByLabel
  const nameByLabel = page.getByLabel('Naam');
  if (await nameByLabel.isVisible().catch(() => false)) {
    await nameByLabel.fill('Sonty Automation');
    console.log('  Naam ingevuld via label');
  } else {
    // Probeer inputs naast het "Naam" label
    // Zoek input die niet de search bar is
    const allInputs = await page.locator('input:visible').all();
    for (const inp of allInputs) {
      const type = await inp.getAttribute('type').catch(() => '');
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      if (type !== 'search' && !placeholder?.includes('doorzoeken') && !placeholder?.includes('search')) {
        await inp.fill('Sonty Automation');
        console.log('  Naam ingevuld via non-search input');
        break;
      }
    }
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);

  // Beschrijving (textarea)
  const descField = page.locator('textarea:visible').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.fill('API access voor Sonty CRM automatisering');
    console.log('  Beschrijving ingevuld');
  }
  await ss(page, 'PA3-01-basic-info');

  // 2. BEREIKEN TAB
  const scopesTab = page.getByText('Bereiken', { exact: true }).or(
    page.locator('[role="tab"]').filter({ hasText: /bereiken|scopes/i })
  ).first();
  await scopesTab.click();
  await page.waitForTimeout(3000);
  await dismiss(page);
  await ss(page, 'PA3-02-scopes-tab');

  // Zoek naar scope search/filter
  const scopeText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Scopes pagina (300 chars):', scopeText.substring(0, 300));

  // Zoek scope checkboxes — zoek naar specifieke scopes
  const scopeSearchInput = page.locator('input[type="search"]:visible, input[placeholder*="oek"]:visible, input[placeholder*="search"]:visible').first();

  const scopesToSelect = [
    'crm.objects.deals',
    'crm.schemas.deals',
    'crm.objects.contacts',
    'crm.schemas.contacts',
  ];

  if (await scopeSearchInput.isVisible().catch(() => false)) {
    for (const scope of scopesToSelect) {
      await scopeSearchInput.fill(scope);
      await page.waitForTimeout(2000);

      // Vink alle zichtbare checkboxen aan
      const cbs = await page.locator('input[type="checkbox"]:visible').all();
      let count = 0;
      for (const cb of cbs) {
        if (!(await cb.isChecked().catch(() => true))) {
          await cb.click().catch(() => {});
          count++;
          await page.waitForTimeout(200);
        }
      }
      console.log(`  ${scope}: ${count} scopes aangevinkt`);
      await scopeSearchInput.fill('');
      await page.waitForTimeout(500);
    }
  } else {
    console.log('  Geen search input voor scopes gevonden');
    // Probeer alle checkboxes op de pagina
    const allCbs = await page.locator('input[type="checkbox"]:visible').all();
    console.log(`  Totaal ${allCbs.length} checkboxes zichtbaar`);

    // Zoek naar expandable secties
    const expandBtns = await page.locator('button:visible').filter({ hasText: /crm|deals|contacts|objects/i }).all();
    console.log(`  Expand buttons: ${expandBtns.length}`);
    for (const btn of expandBtns) {
      const btnText = await btn.innerText().catch(() => '');
      console.log(`    expand: "${btnText}"`);
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  await ss(page, 'PA3-03-scopes-selected');

  // 3. APP MAKEN
  const createBtn = page.locator('button').filter({ hasText: /app maken|create.*app|opslaan|save/i }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    const disabled = await createBtn.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true').catch(() => false);
    console.log(`  Create button disabled: ${disabled}`);
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);
  } else {
    console.log('  Create button niet gevonden');
    // Dump alle buttons
    const allBtns = await page.locator('button:visible').all();
    for (const btn of allBtns) {
      const text = await btn.innerText().catch(() => '');
      if (text.trim()) console.log(`  button: "${text.trim().substring(0, 50)}"`);
    }
  }

  // Bevestigings-dialoog
  await page.waitForTimeout(2000);
  const confirmBtns = await page.locator('button:visible').filter({ hasText: /doorgaan|continue|bevestig|maken|create/i }).all();
  for (const btn of confirmBtns) {
    const text = await btn.innerText().catch(() => '');
    console.log(`  Confirm button: "${text}"`);
    await btn.click().catch(() => {});
    await page.waitForTimeout(2000);
  }
  await ss(page, 'PA3-04-after-create');

  // TOKEN ZOEKEN
  await page.waitForTimeout(3000);

  // Probeer "Token weergeven" knop
  const showTokenBtn = page.locator('button').filter({ hasText: /token.*weergeven|toon.*token|show.*token|weergeven/i }).first();
  if (await showTokenBtn.isVisible().catch(() => false)) {
    await showTokenBtn.click();
    await page.waitForTimeout(2000);
    console.log('  Token weergeven geklikt');
  }

  // Zoek token
  let token = '';
  // Check input[readonly] of input[type="password"]
  const tokenInputs = await page.locator('input[readonly]:visible, input[type="password"]:visible').all();
  for (const inp of tokenInputs) {
    const val = await inp.inputValue().catch(() => '');
    if (val && val.length > 10) {
      token = val;
      console.log(`  Token gevonden in input: ${val.substring(0, 20)}...`);
      break;
    }
  }

  // Check code/pre elementen
  if (!token) {
    const codeEls = await page.locator('code:visible, pre:visible').all();
    for (const el of codeEls) {
      const val = await el.innerText().catch(() => '');
      if (val && val.length > 10 && (val.startsWith('pat-') || val.length > 30)) {
        token = val;
        console.log(`  Token gevonden in code: ${val.substring(0, 20)}...`);
        break;
      }
    }
  }

  await ss(page, 'PA3-05-final');

  // Dump pagina tekst voor debug
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nPagina tekst na aanmaak:', finalText.substring(0, 600));

  console.log('\n═══ RESULTAAT ═══');
  if (token) {
    console.log('ACCESS TOKEN:', token);
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!env.includes('HUBSPOT_API_TOKEN')) {
      env += `\nHUBSPOT_API_TOKEN=${token}\n`;
      fs.writeFileSync(envPath, env);
      console.log('Token opgeslagen in .env');
    }
  } else {
    console.log('Token niet gevonden — check screenshots PA3-04/PA3-05');
    console.log('URL:', page.url());
  }

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
