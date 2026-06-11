const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');
const HUBSPOT_SESSION = path.join(__dirname, 'hubspot-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const zapierState = JSON.parse(fs.readFileSync(ZAPIER_SESSION, 'utf8'));
  const hubspotState = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
  const allCookies = [...(zapierState.cookies || []), ...(hubspotState.cookies || [])];
  const mergedState = { ...zapierState, cookies: allCookies };

  const context = await browser.newContext({ storageState: mergedState });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 aanmaken via editor');

  // Navigate to create zap
  await page.goto('https://zapier.com/webintent/create-zap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Dismiss cookies
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  await ss(page, 'Z01C-01-editor');
  const url = page.url();
  console.log('URL:', url);

  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Pagina:', text.substring(0, 800));

  // De zap editor heeft typically een trigger stap en action stappen
  // Zoek de trigger configuratie
  // Er is waarschijnlijk een "Choose app" of "Search apps" element

  // Zoek alle inputs
  const inputs = await page.locator('input:visible').all();
  console.log(`\nInputs: ${inputs.length}`);
  for (let i = 0; i < Math.min(inputs.length, 10); i++) {
    const type = await inputs[i].getAttribute('type').catch(() => '');
    const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '');
    const ariaLabel = await inputs[i].getAttribute('aria-label').catch(() => '');
    console.log(`  [${i}] type="${type}" placeholder="${placeholder}" aria-label="${ariaLabel}"`);
  }

  // Zoek clickable elementen die triggers configureren
  const triggerEl = page.locator('button, [role="button"], [data-testid*="trigger"], [class*="trigger"]').filter({ hasText: /trigger|app|choose|search/i }).first();
  if (await triggerEl.isVisible().catch(() => false)) {
    const triggerText = await triggerEl.innerText().catch(() => '');
    console.log(`  Trigger element: "${triggerText}"`);
  }

  // Dump alle links/knoppen
  const btns = await page.locator('button:visible, [role="button"]:visible').all();
  console.log(`\nButtons: ${btns.length}`);
  for (const btn of btns.slice(0, 20)) {
    const text = await btn.innerText().catch(() => '');
    if (text.trim() && text.trim().length < 80) console.log(`  btn: "${text.trim()}"`);
  }

  // Zoek de "Trigger" sectie of een app zoekbalk
  const searchApp = page.locator('input[placeholder*="app"], input[placeholder*="earch"], input[aria-label*="app"]').first();
  if (await searchApp.isVisible().catch(() => false)) {
    console.log('  App zoekbalk gevonden!');
    await searchApp.fill('HubSpot');
    await page.waitForTimeout(3000);
    await ss(page, 'Z01C-02-search-hubspot');
  }

  await ss(page, 'Z01C-03-debug');

  // Listen for popups during HubSpot OAuth
  context.on('page', async (popup) => {
    console.log('  [POPUP]', popup.url());
    await popup.screenshot({ path: path.join(__dirname, 'wf-debug-Z01C-popup.png') }).catch(() => {});
  });

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();
})();
