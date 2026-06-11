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
  console.log('🎬 Private App aanmaken v2 — via Oude Apps');

  // Ga direct naar de oude apps / legacy apps pagina
  await page.goto(
    `https://app-eu1.hubspot.com/developer/${PORTAL_ID}/applications`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForTimeout(5000);
  await dismiss(page);
  await ss(page, 'PA2-00-legacy-apps');

  // Check of we op de juiste pagina zijn
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Page text (first 500):', pageText.substring(0, 500));

  // Probeer de "Privé-apps" tab of link te vinden
  const privateAppsLink = page.locator('a, button, [role="tab"]').filter({ hasText: /priv.*app|private.*app/i }).first();
  if (await privateAppsLink.isVisible().catch(() => false)) {
    console.log('Privé-apps link gevonden');
    await privateAppsLink.click();
    await page.waitForTimeout(3000);
    await dismiss(page);
    await ss(page, 'PA2-01-private-apps-tab');
  }

  // Klik "Privé-app maken" of "Create a private app"
  const createBtn = page.locator('a, button').filter({ hasText: /priv.*app.*maken|create.*private.*app|privé-app.*maken/i }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    console.log('Create button gevonden');
    await createBtn.click();
    await page.waitForTimeout(5000);
    await dismiss(page);
    await ss(page, 'PA2-02-create-form');
  } else {
    console.log('Create button niet gevonden, probeer alternatieve routes...');

    // Probeer "Ga naar oude apps" knop
    const oudeAppsBtn = page.locator('a, button').filter({ hasText: /oude apps|legacy/i }).first();
    if (await oudeAppsBtn.isVisible().catch(() => false)) {
      await oudeAppsBtn.click();
      await page.waitForTimeout(5000);
      await dismiss(page);
      await ss(page, 'PA2-02b-oude-apps');

      // Nu opnieuw zoeken naar create button
      const createBtn2 = page.locator('a, button').filter({ hasText: /priv.*app.*maken|create.*private.*app/i }).first();
      if (await createBtn2.isVisible().catch(() => false)) {
        await createBtn2.click();
        await page.waitForTimeout(5000);
        await dismiss(page);
      }
    }

    // Als we nog steeds niet op de create pagina zijn, probeer direct URL
    if (page.url().includes('applications')) {
      console.log('Probeer directe URL naar private app create...');
      await page.goto(
        `https://app-eu1.hubspot.com/private-apps/${PORTAL_ID}/create`,
        { waitUntil: 'domcontentloaded' }
      );
      await page.waitForTimeout(5000);
      await dismiss(page);
      await ss(page, 'PA2-02c-direct-create');
    }
  }

  // Nu zouden we op het create formulier moeten zijn
  const pageText2 = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nCreate page text:', pageText2.substring(0, 600));

  // Vul app naam in
  const nameField = page.getByLabel('Naam').or(page.getByLabel('App naam')).or(page.getByLabel('Name')).or(page.locator('input[name="name"]'));
  if (await nameField.first().isVisible().catch(() => false)) {
    await nameField.first().fill('Sonty Automation');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);
    console.log('  Naam: Sonty Automation');
  } else {
    // Probeer eerste text input
    const firstInput = page.locator('input[type="text"]:visible').first();
    if (await firstInput.isVisible().catch(() => false)) {
      await firstInput.fill('Sonty Automation');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);
      console.log('  Naam via input: Sonty Automation');
    }
  }

  // Beschrijving
  const descField = page.locator('textarea:visible').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.fill('API access voor Sonty automatisering');
  }

  await ss(page, 'PA2-03-name-filled');

  // Ga naar Bereiken (Scopes) tab
  const scopesTab = page.locator('a, button, [role="tab"]').filter({ hasText: /bereiken|scopes|machtigingen/i }).first();
  if (await scopesTab.isVisible().catch(() => false)) {
    await scopesTab.click();
    await page.waitForTimeout(3000);
    await dismiss(page);
    console.log('  Scopes tab geopend');
  }
  await ss(page, 'PA2-04-scopes');

  // Zoek en selecteer scopes
  const scopeSearches = ['crm.objects', 'crm.schemas'];
  for (const searchTerm of scopeSearches) {
    const searchInput = page.locator('input[type="search"], input[placeholder*="oek"], input[placeholder*="Zoek"], input[placeholder*="earch"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(searchTerm);
      await page.waitForTimeout(2000);
      console.log(`  Zoekterm: ${searchTerm}`);

      // Selecteer alle zichtbare checkboxen
      const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
      let checked = 0;
      for (const cb of checkboxes) {
        const isChecked = await cb.isChecked().catch(() => false);
        if (!isChecked) {
          await cb.click().catch(() => {});
          await page.waitForTimeout(200);
          checked++;
        }
      }
      console.log(`  ${checked} checkboxes aangevinkt voor ${searchTerm}`);

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(500);
    }
  }
  await ss(page, 'PA2-05-scopes-selected');

  // Klik "App maken" / "Create app"
  const makeBtn = page.locator('button').filter({ hasText: /app maken|maken|create.*app|create/i }).last();
  if (await makeBtn.isVisible().catch(() => false)) {
    await makeBtn.click();
    await page.waitForTimeout(3000);
    console.log('  App maken geklikt');
  }

  // Bevestigings-dialoog
  const confirmBtn = page.locator('button').filter({ hasText: /doorgaan|bevestig|continue|create/i }).last();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(5000);
  }
  await ss(page, 'PA2-06-created');

  // Zoek het access token
  // Probeer "Token weergeven" / "Show token" knop
  const showTokenBtn = page.locator('button').filter({ hasText: /token.*weergeven|toon.*token|show.*token/i }).first();
  if (await showTokenBtn.isVisible().catch(() => false)) {
    await showTokenBtn.click();
    await page.waitForTimeout(2000);
  }

  // Zoek token element
  const tokenEl = page.locator('[class*="token"], [data-test-id*="token"], code, pre, input[readonly], input[type="password"]');
  let tokenText = '';
  const tokenInputs = await tokenEl.all();
  for (const el of tokenInputs) {
    const val = await el.inputValue().catch(() => null) || await el.innerText().catch(() => '');
    if (val && val.length > 10 && val.startsWith('pat-')) {
      tokenText = val;
      break;
    }
    if (val && val.length > 20) {
      tokenText = val;
    }
  }

  // Probeer ook via clipboard
  if (!tokenText) {
    const copyBtn = page.locator('button').filter({ hasText: /kopieer|kopiëren|copy/i }).first();
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  console.log('\n═══ RESULTAAT ═══');
  if (tokenText) {
    console.log('ACCESS TOKEN:', tokenText);
    // Sla token op
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!env.includes('HUBSPOT_API_TOKEN')) {
      env += `\nHUBSPOT_API_TOKEN=${tokenText}\n`;
      fs.writeFileSync(envPath, env);
      console.log('Token opgeslagen in .env');
    }
  } else {
    console.log('Token niet automatisch gevonden — check screenshots');
    await ss(page, 'PA2-07-token-search');
    const allText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Volledige pagina tekst:', allText.substring(0, 800));
  }

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
