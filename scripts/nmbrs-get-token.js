const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('1. Navigating to Nmbrs...');
    await page.goto('https://maasaccountants.nmbrs.nl/');
    await page.waitForLoadState('networkidle');
    try {
      const acceptBtn = page.locator('button:has-text("Accept All")');
      if (await acceptBtn.isVisible({ timeout: 3000 })) await acceptBtn.click();
    } catch (e) {}

    console.log('2. Email...');
    await page.fill('#Username', 'daimy@sonty.nl');
    await page.click('#LoginButton');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('3. Password...');
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await pw.fill('k4Fb8cS4Rs^@!q');
      const sub = await page.$('input[type="submit"], button[type="submit"]');
      if (sub) await sub.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }

    // Skip recovery prompt
    console.log('4. Recovery prompt...');
    try {
      const skip = page.locator('text=Herinner me later');
      if (await skip.isVisible({ timeout: 3000 })) {
        await skip.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
    } catch (e) {}

    console.log('5. URL:', page.url());
    await page.screenshot({ path: '/tmp/nmbrs-05-dashboard.png' });

    // Click Medewerkers
    console.log('6. Medewerkers...');
    try {
      await page.click('text=Medewerkers');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/nmbrs-06-medewerkers.png' });
      console.log('   URL:', page.url());
    } catch (e) {
      console.log('   Error:', e.message.substring(0, 100));
    }

    // Kalender
    console.log('7. Kalender...');
    try {
      await page.click('text=Kalender');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/nmbrs-07-kalender.png' });
      console.log('   URL:', page.url());
    } catch (e) {
      console.log('   Error:', e.message.substring(0, 100));
    }

    // Navigate to Overzichten (reports)
    console.log('8. Overzichten...');
    try {
      await page.click('text=Overzichten');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/nmbrs-08-overzichten.png' });
      console.log('   URL:', page.url());
    } catch (e) {
      console.log('   Error:', e.message.substring(0, 100));
    }

    // Try to find settings - look at hamburger menu / three lines icon top right
    console.log('9. Settings...');

    // Check all links/hrefs on the page
    const allLinks = await page.$$eval('a[href]', links =>
      links.map(l => ({ href: l.href, text: l.textContent.trim().substring(0, 50) }))
    );
    console.log('   Links on page:');
    for (const link of allLinks.filter(l => l.text.length > 0).slice(0, 30)) {
      console.log(`   - ${link.text}: ${link.href}`);
    }

    // Check for settings/gear icon
    const allButtons = await page.$$eval('button, [role="button"]', btns =>
      btns.map(b => ({ text: b.textContent.trim().substring(0, 50), class: b.className.substring(0, 50) }))
    );
    console.log('   Buttons:');
    for (const btn of allButtons.slice(0, 20)) {
      console.log(`   - "${btn.text}" (${btn.class})`);
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/nmbrs-error.png' });
  }

  await browser.close();
})();
