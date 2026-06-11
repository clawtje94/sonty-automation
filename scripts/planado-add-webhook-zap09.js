const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  console.log('Logging in...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  // Try multiple possible URLs for the API/webhook page
  const urls = [
    'https://sonty.planadoapp.com/admin/integrations/api',
    'https://sonty.planadoapp.com/admin/api',
    'https://sonty.planadoapp.com/admin/integrations',
  ];

  for (const url of urls) {
    await page.goto(url);
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').textContent();
    console.log(`\nURL: ${url}`);
    console.log(`Has "Webhook toevoegen": ${bodyText.includes('Webhook toevoegen')}`);

    if (bodyText.includes('Webhook toevoegen')) {
      console.log('Found webhook section!');
      await page.screenshot({ path: '/tmp/planado-webhook-page-found.png', fullPage: true });

      // Click "+ Webhook toevoegen"
      await page.click('text=Webhook toevoegen');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/planado-zap09-form.png', fullPage: true });

      // Fill the new webhook form
      const textInputs = await page.$$('input[type="text"], input[type="url"]');
      console.log(`Found ${textInputs.length} text inputs`);

      // Log all inputs with values
      for (let i = 0; i < textInputs.length; i++) {
        const val = await textInputs[i].inputValue();
        const ph = await textInputs[i].getAttribute('placeholder');
        console.log(`  Input ${i}: value="${val}" placeholder="${ph}"`);
      }

      // Find empty inputs for the new webhook
      const emptyInputs = [];
      for (const inp of textInputs) {
        const val = await inp.inputValue();
        if (!val || val === '') emptyInputs.push(inp);
      }

      if (emptyInputs.length >= 2) {
        await emptyInputs[0].fill('ZAP-09: Installatie Voltooid');
        await emptyInputs[1].fill('https://hooks.zapier.com/hooks/catch/22982966/uxpj6xx/');
        if (emptyInputs.length >= 3) {
          await emptyInputs[2].fill('sonty-zap09');
        }
        console.log('Form filled');
      }

      // Check event checkbox
      const checkboxes = await page.$$('input[type="checkbox"]');
      for (const cb of checkboxes) {
        const isChecked = await cb.isChecked();
        if (!isChecked) {
          const labelText = await cb.evaluate(el => {
            let n = el.parentElement;
            for (let i = 0; i < 4; i++) {
              if (!n) break;
              const t = n.textContent?.trim() || '';
              if (t.length > 5) return t.substring(0, 80);
              n = n.parentElement;
            }
            return '';
          });
          if (labelText.includes('voltooid') || labelText.includes('finished')) {
            await cb.check();
            console.log(`Checked: ${labelText}`);
          }
        }
      }

      await page.screenshot({ path: '/tmp/planado-zap09-filled.png', fullPage: true });

      // Save
      const saveBtn = await page.$('button:has-text("Opslaan"), input[type="submit"]');
      if (saveBtn) {
        await saveBtn.scrollIntoViewIfNeeded();
        await saveBtn.click();
        await page.waitForTimeout(3000);
        console.log('✅ Webhook saved!');
      }
      await page.screenshot({ path: '/tmp/planado-zap09-result.png', fullPage: true });
      break;
    }
  }

  await browser.close();
})().catch(err => console.error('Error:', err.message));
