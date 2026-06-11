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
  console.log('🎬 Private App aanmaken');

  // Ga naar Private Apps pagina
  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'PA-00-overview');

  // Klik "Privé-app maken" knop
  const createBtn = page.locator('button, a').filter({ hasText: /priv.*app.*maken|create.*private.*app/i }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
  } else {
    // Probeer link
    await page.getByText('Privé-app maken').click().catch(() => {});
  }
  await page.waitForTimeout(4000);
  await dismiss(page);
  await ss(page, 'PA-01-create');

  // Vul app naam in
  const nameField = page.getByLabel('Naam').or(page.getByLabel('App naam')).or(page.locator('input[type="text"]:visible').first());
  await nameField.waitFor({ state: 'visible', timeout: 10000 });
  await nameField.fill('Sonty Automation');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1000);
  console.log('  Naam: Sonty Automation');

  // Beschrijving (optioneel)
  const descField = page.locator('textarea:visible').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.fill('API access voor Sonty automatisering');
  }

  // Ga naar Bereiken (Scopes) tab
  const scopesTab = page.locator('a, button, [role="tab"]').filter({ hasText: /bereiken|scopes|machtigingen/i }).first();
  if (await scopesTab.isVisible().catch(() => false)) {
    await scopesTab.click();
    await page.waitForTimeout(3000);
    await dismiss(page);
  }
  await ss(page, 'PA-02-scopes');

  // Selecteer alle relevante scopes
  // We hebben nodig: crm.objects.deals (read/write), crm.schemas.deals (read/write),
  // crm.objects.contacts (read/write), properties (read/write)

  // Zoek scope checkboxes
  const scopeCategories = ['crm.objects', 'crm.schemas'];
  for (const cat of scopeCategories) {
    const searchInput = page.locator('input[type="search"], input[placeholder*="oek"], input[placeholder*="Zoek"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(cat);
      await page.waitForTimeout(1500);
    }

    // Selecteer alle zichtbare checkboxen
    const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
    for (const cb of checkboxes) {
      const checked = await cb.isChecked().catch(() => false);
      if (!checked) {
        await cb.click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }

    // Clear search
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('');
      await page.waitForTimeout(500);
    }
  }
  await ss(page, 'PA-03-scopes-selected');
  console.log('  Scopes geselecteerd');

  // Klik "App maken" of "Maken"
  const makeBtn = page.locator('button').filter({ hasText: /app maken|maken|create/i }).last();
  await makeBtn.waitFor({ state: 'visible', timeout: 8000 });
  await makeBtn.click();
  await page.waitForTimeout(3000);

  // Er kan een bevestigings-dialoog verschijnen
  const confirmBtn = page.locator('button').filter({ hasText: /doorgaan|bevestig|maken|create/i }).last();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(5000);
  }
  await ss(page, 'PA-04-created');

  // Zoek het access token
  // Het token verschijnt op de pagina na aanmaak
  const tokenEl = page.locator('[class*="token"], [data-test-id*="token"], code, pre, input[readonly]');
  const tokenText = await tokenEl.first().innerText().catch(async () => {
    // Probeer "Token weergeven" knop
    const showBtn = page.locator('button').filter({ hasText: /token.*weergeven|toon.*token|show/i }).first();
    if (await showBtn.isVisible().catch(() => false)) {
      await showBtn.click();
      await page.waitForTimeout(2000);
      return await tokenEl.first().innerText().catch(() => 'NOT_FOUND');
    }
    return 'NOT_FOUND';
  });

  console.log('\n═══ RESULTAAT ═══');
  if (tokenText && tokenText !== 'NOT_FOUND') {
    console.log('ACCESS TOKEN:', tokenText);
    // Sla token op
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    env += `\nHUBSPOT_API_TOKEN=${tokenText}\n`;
    fs.writeFileSync(envPath, env);
    console.log('Token opgeslagen in .env');
  } else {
    console.log('Token niet gevonden op pagina — check screenshot');
    await ss(page, 'PA-05-token-search');
    // Log alle text content
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Page text:', pageText.substring(0, 500));
  }

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
