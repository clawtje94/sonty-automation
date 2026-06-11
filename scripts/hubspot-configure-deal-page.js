const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(5000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  try { await page.click('button:has-text("Accept")', { timeout: 2000 }); } catch(e) {}

  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(3000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(5000);

  // Enter verification code
  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '609380');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(10000);
  }

  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('Login failed:', page.url());
    await browser.close();
    return;
  }
  console.log('LOGGED IN\n');

  // Go to deal record customization
  // HubSpot Settings → Objects → Deals → Record Customization
  const settingsUrls = [
    'https://app-eu1.hubspot.com/record-customization/147970649/deals',
    'https://app-eu1.hubspot.com/property-settings/147970649/deals/record-customization',
    'https://app-eu1.hubspot.com/settings/147970649/objects/deals/record-customization',
  ];

  for (const url of settingsUrls) {
    await page.goto(url);
    await page.waitForTimeout(5000);
    const curUrl = page.url();
    const text = await page.evaluate(() => document.body.innerText.substring(0, 300));
    const is404 = text.includes('404') || text.includes('niet gevonden');
    if (!is404) {
      console.log('Found settings at:', curUrl);
      await page.screenshot({ path: '/tmp/hs-record-custom.png' });
      console.log(text.substring(0, 300));
      break;
    }
  }

  // Try going to the deal page directly and customizing from there
  console.log('\n=== Opening Isa Geer deal page ===');
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/record/0-3/496073833660');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/hs-deal-current.png' });

  // Check what's visible on the deal page
  const dealPageText = await page.evaluate(() => document.body.innerText);
  const sections = dealPageText.split('\n').filter(l => {
    const t = l.trim();
    return t.includes('Reuzenpanda') || t.includes('offerte') || t.includes('Offerte') ||
           t.includes('omschrijving') || t.includes('link') || t.includes('Producten') ||
           t.includes('Over deze deal') || t.includes('About this') ||
           t.includes('Eigenschappen') || t.includes('Properties') ||
           t.includes('Aanpassen') || t.includes('Customize');
  });
  console.log('\nRelevant sections on deal page:');
  sections.forEach(s => console.log('  ' + s.trim().substring(0, 80)));

  // Look for "Aanpassen" or "Customize" buttons on the deal sidebar
  const customizeBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim(), href: el.href || '' }))
      .filter(l => l.text.toLowerCase().includes('aanpass') || l.text.toLowerCase().includes('custom') ||
                   l.text.toLowerCase().includes('bewerk') || l.text.toLowerCase().includes('edit'));
  });
  console.log('\nCustomize buttons:');
  customizeBtns.forEach(b => console.log('  ' + b.text + (b.href ? ' → ' + b.href : '')));

  // Try clicking "Acties" or the settings gear on the sidebar
  // Look for property group headers like "Over deze deal" or "About this deal"
  try {
    // Click on "Over deze deal" or "About this deal" to expand properties
    await page.click('text=Over deze deal', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/hs-deal-about.png' });
  } catch(e) {
    try {
      await page.click('text=About this deal', { timeout: 2000 });
      await page.waitForTimeout(2000);
    } catch(e2) {}
  }

  // Check the "Alle eigenschappen bekijken" link
  try {
    await page.click('text=Alle eigenschappen bekijken', { timeout: 3000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/hs-deal-all-props.png' });
  } catch(e) {
    try {
      await page.click('text=View all properties', { timeout: 2000 });
      await page.waitForTimeout(3000);
    } catch(e2) {}
  }

  // Try the sidebar customization - usually there's a "Customize properties" or gear icon
  // In the left sidebar of the deal page
  try {
    const gearIcons = await page.$$('[data-test-id="sidebar-customize"], [aria-label*="Customize"], [aria-label*="Aanpassen"]');
    console.log('Gear/customize icons:', gearIcons.length);
  } catch(e) {}

  // Navigate to settings to configure deal sidebar properties
  console.log('\n=== Configuring deal sidebar ===');
  await page.goto('https://app-eu1.hubspot.com/settings/147970649/objects/deals');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-deal-settings.png' });

  const settingsText = await page.evaluate(() => document.body.innerText);
  const settingsLines = settingsText.split('\n').filter(l => l.trim().length > 2).slice(0, 30);
  console.log('Deal settings:');
  settingsLines.forEach(l => console.log('  ' + l.trim().substring(0, 80)));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
