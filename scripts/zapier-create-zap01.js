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

  // Laad zowel Zapier als HubSpot cookies
  const zapierState = JSON.parse(fs.readFileSync(ZAPIER_SESSION, 'utf8'));
  const hubspotState = JSON.parse(fs.readFileSync(HUBSPOT_SESSION, 'utf8'));
  const allCookies = [...(zapierState.cookies || []), ...(hubspotState.cookies || [])];
  const mergedState = { ...zapierState, cookies: allCookies };

  const context = await browser.newContext({ storageState: mergedState });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  console.log('🎬 ZAP-01 aanmaken: Lead Intake');

  // Dismiss cookies
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const cookieBtn = page.locator('button').filter({ hasText: /accept all/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Klik "Create" knop
  const createBtn = page.locator('button, a').filter({ hasText: /^\+ Create$|^Create$/ }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(5000);
  } else {
    // Direct naar zap editor
    await page.goto('https://zapier.com/editor', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
  }
  await ss(page, 'Z01-01-editor');

  const editorUrl = page.url();
  console.log('Editor URL:', editorUrl);
  const editorText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Editor:', editorText.substring(0, 600));

  // Dump alle zichtbare buttons
  const buttons = await page.locator('button:visible').all();
  console.log(`\nButtons (${buttons.length}):`);
  for (const btn of buttons.slice(0, 15)) {
    const text = await btn.innerText().catch(() => '');
    if (text.trim()) console.log(`  "${text.trim().substring(0, 60)}"`);
  }

  // Dump links
  const links = await page.locator('a:visible').all();
  for (const link of links.slice(0, 10)) {
    const text = await link.innerText().catch(() => '');
    const href = await link.getAttribute('href').catch(() => '');
    if (text.trim()) console.log(`  link: "${text.trim().substring(0, 40)}" → ${href?.substring(0, 60)}`);
  }

  await ss(page, 'Z01-02-debug');

  // Sla sessie op
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));

  await context.close();
  await browser.close();
})();
