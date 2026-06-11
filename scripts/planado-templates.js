const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  // Go to templates
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/planado-templates.png', fullPage: true });
  console.log('Templates URL:', page.url());

  // List all templates
  const templates = await page.$$eval('a, tr, [class*="template"], [class*="row"]', els =>
    els.map(e => ({ text: e.textContent?.trim()?.substring(0, 100), href: e.href || '' }))
      .filter(e => e.text && (e.href.includes('template') || e.text.includes('afspraak')))
  );
  console.log('Templates found:');
  templates.forEach(t => console.log(`  "${t.text}" → ${t.href}`));

  // Click on "Inmeet afspraak" to edit it
  const inmeetLink = await page.$('a:has-text("Inmeet afspraak")');
  if (inmeetLink) {
    await inmeetLink.click();
    console.log('\nClicked Inmeet afspraak');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/planado-inmeet-template.png', fullPage: true });
    console.log('Edit URL:', page.url());
    
    // Get all elements on the template edit page
    const elements = await page.$$eval('button, a, input, select, [role="button"]', els =>
      els.map(e => {
        const rect = e.getBoundingClientRect();
        return {
          tag: e.tagName,
          text: e.textContent?.trim()?.substring(0, 80),
          href: e.href || '',
          type: e.type || '',
          visible: rect.width > 0 && rect.height > 0,
          y: Math.round(rect.y)
        };
      }).filter(e => e.visible && e.text).sort((a, b) => a.y - b.y)
    );
    console.log('\nTemplate edit elements:');
    elements.forEach(e => console.log(`  y=${e.y} [${e.tag}] "${e.text}" ${e.href}`));
  }

  await browser.close();
  console.log('\nDone');
})().catch(err => console.error('Error:', err.message));
