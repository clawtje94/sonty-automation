const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: undefined
  });
  const page = await context.newPage();

  // Login first
  console.log('Loading HubSpot login page...');
  await page.goto('https://app.hubspot.com/login');
  await page.waitForTimeout(3000);

  const acceptBtn = await page.$('button:has-text("Alles Accepteren")');
  if (acceptBtn) { await acceptBtn.click(); await page.waitForTimeout(1000); }

  const emailField = await page.$('#username');
  if (emailField) {
    await emailField.fill('daimy@sonty.nl');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await page.waitForTimeout(3000);
  }

  const pwLink = await page.$('button:has-text("Sign in with password")') ||
                 await page.$('a:has-text("Sign in with password")');
  if (pwLink) {
    await pwLink.click();
    await page.waitForTimeout(3000);
    const pwField = await page.$('input[type="password"]');
    if (pwField) {
      await pwField.fill('Ta4ZERam3$ka$g');
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await page.waitForTimeout(8000);
    }
  }

  const url = page.url();
  console.log('After login URL:', url);

  if (url.includes('confirm-to-login') || url.includes('verify')) {
    console.log('ERROR: 2FA verification needed again. Code expired.');
    await page.screenshot({ path: '/tmp/hubspot-2fa-again.png', fullPage: true });
    await browser.close();
    return;
  }

  console.log('Logged in! Closing popups...');

  // Close any popups/modals
  const closeButtons = await page.$$('button[aria-label="Close"], button:has-text("×"), .close-button, [data-test-id="close-button"]');
  for (const btn of closeButtons) {
    try { await btn.click(); await page.waitForTimeout(500); } catch(e) {}
  }

  // Also try clicking X buttons on modals
  const modalClose = await page.$('.modal-close, .uiDialogCloseBtn, button[data-selenium-test="modal-dialog-close"]');
  if (modalClose) { await modalClose.click(); await page.waitForTimeout(500); }

  // Try multiple possible URLs for meetings scheduling page
  const meetingsUrls = [
    'https://app-eu1.hubspot.com/meetings/147970649',
    'https://app-eu1.hubspot.com/sales/147970649/meetings',
    'https://app-eu1.hubspot.com/meetings/147970649/link/new',
    'https://app-eu1.hubspot.com/scheduling/147970649',
  ];

  for (const meetingUrl of meetingsUrls) {
    console.log(`\nTrying: ${meetingUrl}`);
    await page.goto(meetingUrl);
    await page.waitForTimeout(4000);

    // Close popups again
    const popupCloseButtons = await page.$$('button[aria-label="Close"], button[aria-label="Sluiten"], .uiCloseButton');
    for (const btn of popupCloseButtons) {
      try { await btn.click(); await page.waitForTimeout(300); } catch(e) {}
    }

    const currentUrl = page.url();
    console.log('Landed on:', currentUrl);

    const pageText = await page.textContent('body');
    const hasScheduling = pageText.includes('scheduling') || pageText.includes('Vergadering') ||
                         pageText.includes('meeting') || pageText.includes('Planningslink') ||
                         pageText.includes('Vergaderingslink');
    console.log('Has meeting-related content:', hasScheduling);

    await page.screenshot({ path: `/tmp/hubspot-meetings-try-${meetingsUrls.indexOf(meetingUrl)}.png`, fullPage: true });

    if (hasScheduling) {
      console.log('Found meetings page!');
      break;
    }
  }

  // Also check what's available in the Sales dropdown menu
  console.log('\nChecking Sales/Verkoop menu...');
  await page.goto('https://app-eu1.hubspot.com/contacts/147970649/objects/0-3/views/all/list');
  await page.waitForTimeout(3000);

  // Try to find the main nav and list all links
  const navLinks = await page.$$eval('nav a, [role="menubar"] a, .navItem a', links =>
    links.map(l => ({ text: l.textContent?.trim(), href: l.href })).filter(l => l.text)
  );
  console.log('Nav links:', JSON.stringify(navLinks.slice(0, 20)));

  // Also dump the sidebar menu items
  const sidebarItems = await page.$$eval('aside a, [data-selenium-test] a', links =>
    links.map(l => ({ text: l.textContent?.trim(), href: l.href })).filter(l => l.text)
  );
  console.log('Sidebar links:', JSON.stringify(sidebarItems.slice(0, 20)));

  await browser.close();
})().catch(err => console.error('Error:', err.message));
