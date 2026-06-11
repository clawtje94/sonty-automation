const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login + code
  await page.goto('https://app-eu1.hubspot.com/login');
  await page.waitForTimeout(4000);
  try { await page.click('#hs-eu-cookie-confirmation-button-group button', { timeout: 2000 }); } catch(e) {}
  await page.fill('#username', 'daimy@sonty.nl');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(3000);
  await page.click('text=Sign in with password');
  await page.waitForTimeout(2000);
  await page.fill('#password', 'Ta4ZERam3$ka$g');
  try { await page.click('#loginBtn', { timeout: 3000 }); } catch(e) { await page.click('button[type="submit"]'); }
  await page.waitForTimeout(4000);
  if (page.url().includes('confirm')) {
    await page.fill('input[placeholder*="code"], input[type="text"]', '521586');
    await page.click('button:has-text("Continue"), button[type="submit"]');
    await page.waitForTimeout(8000);
  }
  if (page.url().includes('login') || page.url().includes('confirm')) {
    console.log('FAILED');
    await browser.close();
    return;
  }
  console.log('Logged in');

  // Go to layout editor
  await page.goto('https://app-eu1.hubspot.com/sales-products-settings/147970649/object/0-3/record-customization');
  await page.waitForTimeout(5000);
  await page.click('a:has-text("Standaardweergave")');
  await page.waitForTimeout(8000);
  console.log('In layout editor');

  // Close the popup if shown
  try {
    await page.click('button:has-text("Volgende")', { timeout: 2000 });
    await page.waitForTimeout(1000);
    // Keep clicking next/close until popup is gone
    for (let i = 0; i < 5; i++) {
      try { await page.click('button:has-text("Volgende")', { timeout: 1000 }); await page.waitForTimeout(500); } catch(e) { break; }
    }
    try { await page.click('button:has-text("Klaar")', { timeout: 1000 }); } catch(e) {}
    try { await page.click('button:has-text("Sluiten")', { timeout: 1000 }); } catch(e) {}
    try { await page.click('[aria-label="Close"]', { timeout: 1000 }); } catch(e) {}
  } catch(e) {}
  await page.waitForTimeout(1000);

  // STEP 1: Click on "Over: Deal" to configure the sidebar properties
  console.log('\n=== Configuring sidebar ===');
  try {
    await page.click('text=Over: Deal', { timeout: 3000 });
    await page.waitForTimeout(3000);
    console.log('Clicked Over: Deal');
    await page.screenshot({ path: '/tmp/hs-over-deal.png' });

    // Get what appeared
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').filter(l => l.trim().length > 2);

    // Look for property list or edit options
    const relevantLines = lines.filter(l =>
      l.includes('eigenschap') || l.includes('property') || l.includes('Bewerken') ||
      l.includes('Toevoegen') || l.includes('Verwijderen') || l.includes('Sonty') ||
      l.includes('Reuzenpanda') || l.includes('reuzenpanda')
    );
    console.log('Relevant:', relevantLines.join(' | '));

    // Click edit/pencil button on "Over: Deal"
    const editBtns = await page.$$('[aria-label*="bewerken"], [aria-label*="edit"], [aria-label*="Bewerk"]');
    console.log('Edit buttons:', editBtns.length);
    for (const btn of editBtns) {
      const rect = await btn.boundingBox();
      if (rect && rect.y > 150 && rect.y < 250) { // Near "Over: Deal"
        await btn.click();
        await page.waitForTimeout(3000);
        console.log('Clicked edit on Over: Deal');
        await page.screenshot({ path: '/tmp/hs-over-deal-edit.png' });
        break;
      }
    }
  } catch(e) {
    console.log('Over: Deal click failed:', e.message.substring(0, 60));
  }

  // Check for the properties panel
  const panelText = await page.evaluate(() => {
    const panels = document.querySelectorAll('[class*="panel"], [class*="Panel"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"]');
    for (const p of panels) {
      if (p.offsetHeight > 200) return p.innerText.substring(0, 1000);
    }
    return '';
  });
  console.log('\nPanel:', panelText.substring(0, 500));

  // STEP 2: Try clicking the "..." menu on "Over: Deal" card
  console.log('\n=== Trying menu on Over: Deal ===');
  const menuBtns = await page.$$('button[aria-label*="meer"], button[aria-label*="More"], button[aria-label*="Acties"]');
  console.log('Menu buttons:', menuBtns.length);

  // Find the "..." near "Over: Deal" by position
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = await btn.textContent();
    const rect = await btn.boundingBox();
    const ariaLabel = await btn.getAttribute('aria-label');
    if (rect && rect.y > 170 && rect.y < 230 && (text === '...' || text === '⋮' || ariaLabel?.includes('meer') || ariaLabel?.includes('More'))) {
      console.log('Found menu at', rect.x, rect.y, 'text:', text, 'aria:', ariaLabel);
      await btn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/hs-over-menu.png' });

      // Check menu items
      const menuItems = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], [class*="dropdown"] button, [class*="dropdown"] a'))
          .filter(el => el.offsetHeight > 0)
          .map(el => el.textContent.trim());
      });
      console.log('Menu items:', menuItems.join(' | '));
      break;
    }
  }

  // STEP 3: Remove unnecessary cards from the layout
  // Delete: Dealscore, Dealinzichten, Tickets, Betaalkoppelingen, etc.
  console.log('\n=== Removing unnecessary cards ===');
  const cardsToRemove = ['Dealscore', 'Dealinzichten', 'Tickets', 'Betaalkoppelingen', 'Orders', 'Winkelwagens', 'Creditnota', 'Abonnementen', 'Betalingen'];

  for (const cardName of cardsToRemove) {
    // Find the "..." menu for this card
    try {
      const cardEl = await page.$('text=' + cardName);
      if (cardEl) {
        const rect = await cardEl.boundingBox();
        if (rect) {
          // Click the "..." button near this card (usually to the right)
          await page.mouse.click(rect.x + 300, rect.y);
          await page.waitForTimeout(1000);

          // Look for "Verwijderen" in the dropdown
          try {
            await page.click('text=Verwijderen', { timeout: 2000 });
            await page.waitForTimeout(1000);
            console.log('Removed: ' + cardName);
          } catch(e) {
            // Try "Remove"
            try { await page.click('text=Remove', { timeout: 1000 }); console.log('Removed: ' + cardName); } catch(e2) {}
            // Close menu
            await page.keyboard.press('Escape');
          }
        }
      }
    } catch(e) {}
  }

  // STEP 4: Save
  console.log('\n=== Saving ===');
  try {
    await page.click('button:has-text("Opslaan en afsluiten")');
    await page.waitForTimeout(5000);
    console.log('Saved!');
  } catch(e) {
    try {
      await page.click('button:has-text("Opslaan")');
      await page.waitForTimeout(3000);
      console.log('Saved (Opslaan)');
    } catch(e2) {}
  }

  await page.screenshot({ path: '/tmp/hs-layout-saved.png' });
  await browser.close();
  console.log('Done');
})().catch(console.error);
