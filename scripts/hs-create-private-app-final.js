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
  console.log('🎬 Private App aanmaken — FINAL');

  // Navigate to create page
  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // 1. BASISINFORMATIE — Naam
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

  // Klik "Nieuw bereik toevoegen"
  const addScopeBtn = page.locator('button').filter({ hasText: /nieuw bereik|bereik toevoegen/i }).first();
  await addScopeBtn.click();
  await page.waitForTimeout(3000);

  // Search input
  const scopeSearch = page.locator('input[role="searchbox"]:visible, input[type="search"]:visible').first();
  await scopeSearch.waitFor({ state: 'visible', timeout: 5000 });

  // Selecteer scopes per zoekterm
  const scopeSearches = [
    'crm.objects.deals',
    'crm.schemas.deals',
    'crm.objects.contacts',
    'crm.schemas.contacts',
  ];

  for (const searchTerm of scopeSearches) {
    await scopeSearch.fill(searchTerm);
    await page.waitForTimeout(1500);

    // Vink alle zichtbare checkboxes aan
    const cbs = await page.locator('input[type="checkbox"]:visible').all();
    let count = 0;
    for (const cb of cbs) {
      if (!(await cb.isChecked().catch(() => true))) {
        await cb.click().catch(() => {});
        count++;
        await page.waitForTimeout(200);
      }
    }
    console.log(`  ${searchTerm}: ${count}/${cbs.length} aangevinkt`);
  }

  // Clear search en neem ook properties scopes mee
  await scopeSearch.fill('crm.objects.custom');
  await page.waitForTimeout(1500);
  const customCbs = await page.locator('input[type="checkbox"]:visible').all();
  let customCount = 0;
  for (const cb of customCbs) {
    if (!(await cb.isChecked().catch(() => true))) {
      await cb.click().catch(() => {});
      customCount++;
      await page.waitForTimeout(200);
    }
  }
  console.log(`  crm.objects.custom: ${customCount} aangevinkt`);

  await ss(page, 'PAF-01-scopes');

  // Klik "Bijwerken" (Update)
  const updateBtn = page.locator('button').filter({ hasText: /^Bijwerken$/ }).first();
  await updateBtn.waitFor({ state: 'visible', timeout: 5000 });
  await updateBtn.click();
  await page.waitForTimeout(3000);
  console.log('✅ Scopes bijgewerkt');
  await ss(page, 'PAF-02-scopes-updated');

  // 3. APP AANMAKEN
  const createBtn = page.locator('button').filter({ hasText: /^App aanmaken$/ }).first();
  await createBtn.waitFor({ state: 'visible', timeout: 5000 });
  await createBtn.click();
  await page.waitForTimeout(3000);
  console.log('  App aanmaken geklikt');

  // Bevestigings-dialoog — "Doorgaan met aanmaken" of "Continue creating"
  const confirmBtn = page.locator('button').filter({ hasText: /doorgaan|bevestig|continue|app maken/i }).last();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(5000);
    console.log('  Bevestiging geklikt');
  }
  await ss(page, 'PAF-03-after-create');

  // Wacht op de app details pagina met het token
  await page.waitForTimeout(5000);

  // Check of we op de details pagina zijn
  const url = page.url();
  console.log('  URL:', url);

  // Zoek "Token weergeven" knop
  const showTokenBtn = page.locator('button').filter({ hasText: /token.*weergeven|toon.*token|show.*token|weergeven/i }).first();
  if (await showTokenBtn.isVisible().catch(() => false)) {
    await showTokenBtn.click();
    await page.waitForTimeout(2000);
    console.log('  Token weergeven geklikt');
  }

  // Zoek het token
  let token = '';

  // Check alle input[readonly] en input[type="password"]
  const tokenInputs = await page.locator('input:visible').all();
  for (const inp of tokenInputs) {
    const val = await inp.inputValue().catch(() => '');
    if (val && (val.startsWith('pat-') || (val.length > 30 && !val.includes(' ')))) {
      token = val;
      break;
    }
  }

  // Check code/pre elementen
  if (!token) {
    const codeEls = await page.locator('code, pre, [class*="token"], [data-test*="token"]').all();
    for (const el of codeEls) {
      const text = await el.innerText().catch(() => '');
      if (text && (text.startsWith('pat-') || (text.length > 30 && !text.includes(' ')))) {
        token = text.trim();
        break;
      }
    }
  }

  // Probeer kopieer knop + clipboard als token niet gevonden
  if (!token) {
    const copyBtn = page.locator('button').filter({ hasText: /kopieer|kopiëren|copy/i }).first();
    if (await copyBtn.isVisible().catch(() => false)) {
      console.log('  Kopieerknop gevonden — handmatig controleren');
    }
  }

  await ss(page, 'PAF-04-token');

  // Dump pagina info
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nPagina tekst:', finalText.substring(0, 800));

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
    console.log('Token niet automatisch gevonden — check screenshot PAF-04-token');
    console.log('URL:', page.url());
  }

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
