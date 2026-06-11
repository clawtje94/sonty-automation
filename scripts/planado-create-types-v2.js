const { chromium } = require('playwright');

async function login(page) {
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  try {
    await login(page);

    // ── Job Types ──
    console.log('Job Types...');
    await page.goto('https://sonty.planadoapp.com/admin/job-types');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/planado-types-page.png' });

    // Get page structure
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Page text:', pageText.substring(0, 500));

    // Look for "Toevoegen" or "Add" button
    const buttons = await page.$$eval('a, button', els =>
      els.map(e => ({ text: e.textContent.trim().substring(0, 40), tag: e.tagName, href: e.href || '' }))
        .filter(e => e.text.length > 0)
    );
    console.log('Buttons:', buttons.filter(b => b.text.includes('oevoegen') || b.text.includes('Nieuw') || b.text.includes('Add')));

    // Try clicking the add button
    const addBtn = page.locator('a:has-text("Type toevoegen"), button:has-text("Type toevoegen"), a:has-text("Toevoegen")').first();
    try {
      if (await addBtn.isVisible({ timeout: 3000 })) {
        await addBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/planado-types-add.png' });

        // Check the add form
        const formText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
        console.log('Add form:', formText.substring(0, 500));

        // Try to find input fields
        const inputs = await page.$$eval('input:not([type="hidden"])', els =>
          els.map(e => ({ type: e.type, placeholder: e.placeholder, name: e.name, visible: e.offsetParent !== null }))
        );
        console.log('Inputs:', inputs.filter(i => i.visible));
      }
    } catch (e) {
      console.log('No add button found');
    }

    // ── Skills ──
    console.log('\nSkills...');
    await page.goto('https://sonty.planadoapp.com/admin/skills');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/planado-skills-page.png' });

    const skillsText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('Skills page:', skillsText.substring(0, 500));

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
})();
