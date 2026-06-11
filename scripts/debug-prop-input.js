const { chromium } = require('playwright');
const path = require('path');
const SESSION_FILE = path.join(__dirname, 'hubspot-session.json');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto('https://app-eu1.hubspot.com/property-settings/147970649/properties?type=0-3&action=create', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // Zoek het label veld via getByLabel
  const labelField = page.getByLabel('Eigenschapslabel');
  console.log('getByLabel visible:', await labelField.isVisible().catch(() => false));

  // Probeer te vullen
  if (await labelField.isVisible().catch(() => false)) {
    await labelField.fill('TEST PROPERTY');
    console.log('Label ingevuld!');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    // Ga naar veldtype
    await page.getByText('Veldtype', { exact: true }).click();
    await page.waitForTimeout(2000);

    // Klik de dropdown
    const dd = page.locator('button, [role="button"]').filter({ hasText: /Eén regel met tekst/i }).first();
    await dd.click();
    await page.waitForTimeout(1500);

    // Selecteer Datumkiezer
    await page.getByText('Datumkiezer', { exact: true }).click();
    await page.waitForTimeout(1500);

    // Check Aanmaken knop
    const createBtn = page.locator('button').filter({ hasText: /^Aanmaken$/ }).first();
    const disabled = await createBtn.evaluate(el => el.disabled).catch(() => 'unknown');
    console.log('Aanmaken disabled:', disabled);

    await page.screenshot({ path: path.join(__dirname, 'wf-debug-PROP-test.png') });

    // Klik aanmaken
    if (!disabled) {
      await createBtn.click();
      await page.waitForTimeout(3000);
      console.log('Aangemaakt!');
    } else {
      // Klik Annuleren
      await page.locator('button').filter({ hasText: /^Annuleren$/ }).first().click();
      await page.waitForTimeout(2000);
    }
  }

  await context.close();
  await browser.close();
})();
