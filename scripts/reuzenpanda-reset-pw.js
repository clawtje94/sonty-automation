const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Follow the reset link from the email
  const resetLink = 'https://email.email.reuzenpanda.app/c/eJyMkMGOmzAQhp_G3EAwGAMHH9AS2pW6zXbTNNleorE9BKcEpxjSTZ6-Sg5tL5X2Mvr1jUb65jeSjBBtQDLJcy5AxFkWdBJjroC3OcaceJFwhVqhyUlzQm4EBlZCnvNMJJBEWZpGf68FxIzHs6cx9DSeraYwK4UWPC94Hhr1BiLoZTdNJ8_SikHDoOlmFY00X2k44WAwGnoGTciguYfe7e3AoDFojxfl3MQg4_H-iLaPtDsyaFo37t0UntD7X240LG2sYWkNpTKCyjbMCmxDjoRhKcoyLJTQCtEUmTYMhHaGWFp3b8vi--JT8fr8kL4-rvtL93XDIIPECd6fn_Rp0yHfzts7uw_7uIaSqi-HYnmoquvPb6sf9LQdDn7PQNDNj6X1f6yDUdZ_Nv_ySfqLn-gWFB6VcztPeh7tdAkmuV4tXnYPH6vPHxa752q12ixf6uDW9c4a-Z53g7OE3wEAAP__njKbFQ';

  await page.goto(resetLink);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/rp-reset-page.png' });
  console.log('Reset page URL:', page.url());

  // Check what's on the page
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Page text:', bodyText.substring(0, 400));

  // Find password fields
  const inputs = await page.$$('input');
  console.log('\nInputs:', inputs.length);
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const placeholder = await inp.getAttribute('placeholder');
    console.log('  ', type, name, placeholder);
  }

  // Set new password
  const newPassword = 'SontyRP2026!secure';
  const pwInputs = await page.$$('input[type="password"]');
  if (pwInputs.length >= 2) {
    await pwInputs[0].fill(newPassword);
    await pwInputs[1].fill(newPassword);
    console.log('Password filled');

    // Submit
    const submitBtn = await page.$('button[type="submit"], button:has-text("Instellen"), button:has-text("Opslaan"), button:has-text("Bevestig")');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
      console.log('Submitted');
      await page.screenshot({ path: '/tmp/rp-pw-set.png' });
      console.log('After submit URL:', page.url());
    }
  } else if (pwInputs.length === 1) {
    await pwInputs[0].fill(newPassword);
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
    }
    await page.screenshot({ path: '/tmp/rp-pw-set.png' });
    console.log('After submit URL:', page.url());
  } else {
    console.log('No password fields found');
  }

  // If logged in, go to settings
  if (!page.url().includes('login') && !page.url().includes('reset')) {
    console.log('\nLogged in! Going to settings...');

    // Try various settings/API URLs
    for (const url of [
      'https://hub.reuzenpanda.nl/app/settings',
      'https://hub.reuzenpanda.nl/app/settings/api',
      'https://hub.reuzenpanda.nl/app/settings/integrations',
      'https://hub.reuzenpanda.nl/app/automation',
    ]) {
      await page.goto(url);
      await page.waitForTimeout(3000);
      const pageUrl = page.url();
      const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('\n' + url + ' → ' + pageUrl);
      if (text.toLowerCase().includes('api') || text.toLowerCase().includes('key') || text.toLowerCase().includes('token')) {
        console.log('API-RELATED CONTENT FOUND!');
        console.log(text);
        await page.screenshot({ path: '/tmp/rp-api-found.png' });
      }
    }

    // Also look for company profile
    await page.goto('https://hub.reuzenpanda.nl/app/settings');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-settings-main.png' });

    // List all navigation/menu items
    const navItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a, button, [role="menuitem"]'))
        .filter(el => el.offsetHeight > 0)
        .map(el => ({ text: el.textContent.trim().substring(0, 40), href: el.href || '' }))
        .filter(l => l.text.length > 1 && l.text.length < 40);
    });
    console.log('\nAll nav items:');
    navItems.forEach(n => console.log('  ' + n.text + (n.href ? ' → ' + n.href : '')));
  }

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
