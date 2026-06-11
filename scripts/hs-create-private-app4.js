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
  console.log('🎬 Private App aanmaken v4');

  // Ga naar private app create pagina
  await page.goto(
    `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/create`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);

  // 1. BASISINFORMATIE — Naam invullen
  const nameByLabel = page.getByLabel('Naam');
  await nameByLabel.waitFor({ state: 'visible', timeout: 10000 });
  await nameByLabel.fill('Sonty Automation');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  console.log('  Naam: Sonty Automation');

  // Beschrijving
  const descField = page.locator('textarea:visible').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.fill('API access voor Sonty CRM automatisering');
  }
  await ss(page, 'PA4-01-basic');

  // 2. BEREIKEN TAB
  const scopesTab = page.getByText('Bereiken', { exact: true }).first();
  await scopesTab.click();
  await page.waitForTimeout(3000);
  await dismiss(page);
  await ss(page, 'PA4-02-scopes');

  // Klik "Nieuw bereik toevoegen" knop
  const addScopeBtn = page.locator('button').filter({ hasText: /nieuw bereik|bereik toevoegen|add.*scope/i }).first();
  await addScopeBtn.waitFor({ state: 'visible', timeout: 8000 });
  await addScopeBtn.click();
  await page.waitForTimeout(3000);
  await dismiss(page);
  await ss(page, 'PA4-03-add-scope-dialog');

  // Er opent zich waarschijnlijk een dialoog/panel met scope selectie
  const dialogText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Na "Nieuw bereik toevoegen":', dialogText.substring(0, 500));

  // Zoek search input in de scope selectie
  const scopeSearch = page.locator('input[type="search"]:visible, input[placeholder*="oek"]:visible, input[placeholder*="search"]:visible, input[placeholder*="earch"]:visible').first();

  if (await scopeSearch.isVisible().catch(() => false)) {
    console.log('  Search input gevonden in scope dialog');
  }

  // Zoek checkboxes
  const dialogCbs = await page.locator('input[type="checkbox"]:visible').all();
  console.log(`  Checkboxes in dialog: ${dialogCbs.length}`);

  // Zoek alle zichtbare inputs
  const allInputs = await page.locator('input:visible').all();
  console.log(`  Alle inputs: ${allInputs.length}`);
  for (let i = 0; i < Math.min(allInputs.length, 8); i++) {
    const type = await allInputs[i].getAttribute('type').catch(() => '');
    const placeholder = await allInputs[i].getAttribute('placeholder').catch(() => '');
    const role = await allInputs[i].getAttribute('role').catch(() => '');
    console.log(`    input[${i}]: type="${type}" placeholder="${placeholder}" role="${role}"`);
  }

  // Zoek dropdown/combobox/select elementen
  const selects = await page.locator('select:visible, [role="combobox"]:visible, [role="listbox"]:visible').all();
  console.log(`  Select/combobox elementen: ${selects.length}`);

  // Zoek alle buttons in de dialog
  const btns = await page.locator('button:visible').all();
  for (const btn of btns) {
    const text = await btn.innerText().catch(() => '');
    if (text.trim()) console.log(`  button: "${text.trim().substring(0, 60)}"`);
  }

  // Zoek een scope search/dropdown
  // Misschien is het een typeahead/combobox
  const typeaheads = await page.locator('[role="combobox"]:visible, [data-selenium*="scope"]:visible, [class*="scope"]:visible').all();
  console.log(`  Typeaheads/scope elements: ${typeaheads.length}`);

  // Probeer alle links/clickable elementen met scope namen
  const scopeLinks = await page.locator('a, button, [role="option"], [role="menuitem"], li').filter({ hasText: /crm\.objects|crm\.schemas/i }).all();
  console.log(`  Scope links: ${scopeLinks.length}`);

  // Scope toevoegen werkt misschien via een text input + zoeken
  // Probeer elke input te vullen met een scope naam
  for (const inp of allInputs) {
    const type = await inp.getAttribute('type').catch(() => '');
    if (type === 'search' || type === 'text') {
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      if (!placeholder?.includes('doorzoeken')) {
        await inp.fill('crm.objects.deals');
        await page.waitForTimeout(2000);
        console.log('  Zoekterm "crm.objects.deals" ingevuld');
        await ss(page, 'PA4-04-scope-search');

        // Check wat er verschijnt
        const afterSearch = await page.evaluate(() => document.body.innerText.substring(0, 2000));
        console.log('  Na zoeken:', afterSearch.substring(0, 300));

        // Check nieuwe checkboxes/opties
        const newCbs = await page.locator('input[type="checkbox"]:visible').all();
        console.log(`  Checkboxes na zoeken: ${newCbs.length}`);

        const newOptions = await page.locator('[role="option"]:visible, li:visible').all();
        console.log(`  Options na zoeken: ${newOptions.length}`);
        break;
      }
    }
  }

  await ss(page, 'PA4-05-debug');
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
