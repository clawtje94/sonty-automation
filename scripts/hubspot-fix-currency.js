const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(__dirname, '..', 'data', 'hubspot-browser'), {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://app-eu1.hubspot.com/settings/147970649/account-defaults');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    console.log('Session expired');
    await ctx.close();
    return;
  }

  console.log('On settings page:', page.url());
  await page.screenshot({ path: '/tmp/hs-settings-currency.png' });

  // Get page text to understand layout
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 1000));

  // Look for currency-related elements
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, select, [role="tab"]'))
      .filter(el => el.offsetHeight > 0)
      .map(el => ({ text: el.textContent.trim().substring(0, 50), tag: el.tagName, href: el.href || '' }))
      .filter(l => l.text.length > 1 && (
        l.text.toLowerCase().includes('valuta') || l.text.toLowerCase().includes('currency') ||
        l.text.toLowerCase().includes('dollar') || l.text.toLowerCase().includes('eur') ||
        l.text.toLowerCase().includes('account') || l.text.toLowerCase().includes('default')
      ));
  });
  console.log('\nCurrency elements:', links.length);
  links.forEach(l => console.log('  [' + l.tag + '] ' + l.text));

  // Try navigating to currency-specific settings
  await page.goto('https://app-eu1.hubspot.com/settings/147970649/account-defaults/currency');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/hs-currency-page.png' });
  console.log('\nCurrency page URL:', page.url());

  const currText = await page.evaluate(() => document.body.innerText);
  const currLines = currText.split('\n').filter(l => l.trim().length > 2).slice(0, 20);
  console.log('Currency page:');
  currLines.forEach(l => console.log('  ' + l.trim().substring(0, 80)));

  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
