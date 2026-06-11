const { chromium } = require('playwright');

const WEBHOOK_SECRET = 'sonty_planado_f84c5c34ba89';

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
  console.log('Logged in:', page.url());

  // Go to webhook creation form
  await page.goto('https://sonty.planadoapp.com/admin/integrations/webhooks/new');
  await page.waitForTimeout(3000);

  // Use keyboard to fill fields (React controlled inputs)
  // Name field - click then type
  const nameLabel = await page.$('label:has-text("Naam")');
  if (nameLabel) {
    const nameInput = await nameLabel.evaluateHandle(el => el.parentElement.querySelector('input') || el.nextElementSibling);
    if (nameInput) {
      await nameInput.asElement().click();
      await page.keyboard.type('Sonty Zapier - Opdracht Voltooid');
      console.log('Typed name');
    }
  }

  // Try direct input approach - get all text inputs in order
  const textInputs = await page.$$('input[type="text"]');
  console.log('Found', textInputs.length, 'text inputs');
  
  if (textInputs.length >= 3) {
    // Input 0 = Name
    await textInputs[0].click();
    await textInputs[0].press('Control+a');
    await page.keyboard.type('Sonty Zapier - Opdracht Voltooid');
    console.log('Filled name via direct input');
    
    // Input 1 = URL  
    await textInputs[1].click();
    await textInputs[1].press('Control+a');
    await page.keyboard.type('https://hooks.zapier.com/hooks/catch/sonty-planado-webhook');
    console.log('Filled URL');
    
    // Input 2 = Secret
    await textInputs[2].click();
    await textInputs[2].press('Control+a');
    await page.keyboard.type(WEBHOOK_SECRET);
    console.log('Filled secret');
  }

  await page.waitForTimeout(500);

  // Check "Opdracht voltooid" checkbox using label click
  const allLabels = await page.$$('label');
  for (const label of allLabels) {
    const text = await label.textContent();
    if (text.trim() === 'Opdracht voltooid') {
      await label.click();
      console.log('Clicked Opdracht voltooid label');
      break;
    }
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/planado-webhook-filled2.png', fullPage: true });

  // Verify input values
  for (let i = 0; i < Math.min(3, textInputs.length); i++) {
    const val = await textInputs[i].inputValue();
    console.log(`Input ${i} value: "${val}"`);
  }

  // Check if opdracht voltooid is checked
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const isChecked = await cb.isChecked();
    if (isChecked) {
      const parent = await cb.evaluateHandle(el => el.closest('label')?.textContent?.trim() || 'unknown');
      console.log('Checked checkbox:', await parent.jsonValue());
    }
  }

  // Click Opslaan (Save)
  console.log('\nSaving webhook...');
  await page.click('button:has-text("Opslaan")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/planado-webhook-saved.png', fullPage: true });
  console.log('After save URL:', page.url());

  // Check for errors
  const errorText = await page.textContent('.error, .alert, [class*="error"]').catch(() => '');
  if (errorText) console.log('Error:', errorText);

  await browser.close();
  console.log('Done! Secret:', WEBHOOK_SECRET);
})().catch(err => console.error('Error:', err.message));
