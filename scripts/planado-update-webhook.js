const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login to Planado
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);

  // Go to the existing webhook edit page
  await page.goto('https://sonty.planadoapp.com/admin/integrations/api');
  await page.waitForTimeout(3000);

  // Click on the webhook link to edit it
  const webhookLink = await page.$('a:has-text("Sonty Zapier")');
  if (webhookLink) {
    await webhookLink.click();
    console.log('Clicked webhook link');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/planado-edit-webhook.png', fullPage: true });
    
    // Find the URL field and update it
    const textInputs = await page.$$('input[type="text"]');
    console.log('Found', textInputs.length, 'text inputs');
    
    if (textInputs.length >= 2) {
      // Input 1 should be URL
      const currentUrl = await textInputs[1].inputValue();
      console.log('Current URL:', currentUrl);
      
      // Clear and update
      await textInputs[1].click();
      await textInputs[1].fill('');
      await page.waitForTimeout(200);
      await textInputs[1].fill('https://hooks.zapier.com/hooks/catch/22982966/uxppbhy/');
      console.log('Updated URL to Zapier webhook');
      
      // Also fix the name (it's duplicated)
      const currentName = await textInputs[0].inputValue();
      console.log('Current name:', currentName);
      await textInputs[0].click();
      await textInputs[0].fill('');
      await page.waitForTimeout(200);
      await textInputs[0].fill('ZAP-04/09: Opdracht Voltooid');
      console.log('Fixed name');
      
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/planado-webhook-updated.png', fullPage: true });
      
      // Click Save
      const saveBtn = await page.$('button:has-text("Opslaan")');
      if (saveBtn) {
        await saveBtn.click();
        console.log('Saved!');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/planado-webhook-saved2.png', fullPage: true });
      }
    }
  } else {
    console.log('Webhook link not found');
    await page.screenshot({ path: '/tmp/planado-api-page.png', fullPage: true });
  }

  await browser.close();
  console.log('Done');
})().catch(err => console.error('Error:', err.message));
