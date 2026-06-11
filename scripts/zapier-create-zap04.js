const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '.zapier-session.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  let context = await browser.newContext({ storageState: STORAGE_FILE });
  const page = await context.newPage();

  await page.goto('https://zapier.com/editor/354159297/draft/354159297/setup');
  await page.waitForTimeout(5000);
  if (page.url().includes('login')) { console.log('Session expired'); await browser.close(); return; }

  // Get the webhook URL
  const bodyText = await page.textContent('body').catch(() => '');
  const webhookUrlMatch = bodyText.match(/(https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+\/)/);
  if (webhookUrlMatch) {
    console.log('WEBHOOK URL:', webhookUrlMatch[1]);
    fs.writeFileSync(path.join(__dirname, '.zapier-webhook-url-zap04.txt'), webhookUrlMatch[1]);
  }

  // Now click on the Action box to set up HubSpot
  console.log('\nSetting up Action...');
  const actionBox = await page.$('div:has-text("Select the event for your Zap to run")');
  if (actionBox) {
    await actionBox.click();
    await page.waitForTimeout(2000);
  }

  // Search for HubSpot
  const searchInput = await page.$('input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.fill('HubSpot');
    await page.waitForTimeout(2000);
    
    // Click HubSpot option
    const hubspotBtn = await page.$('[role="button"]:has-text("HubSpot"), div:has-text("HubSpot")');
    if (hubspotBtn) {
      const rect = await hubspotBtn.boundingBox();
      if (rect && rect.y > 60) { // Skip search bar itself
        await hubspotBtn.click();
        console.log('Selected HubSpot');
        await page.waitForTimeout(3000);
      }
    }
  }

  await page.screenshot({ path: '/tmp/zapier-hubspot-action.png', fullPage: true });

  // Look for event selection
  const eventBtn = await page.$('button:has-text("Choose an event")');
  if (eventBtn) {
    await eventBtn.click();
    await page.waitForTimeout(2000);
    
    // Look for "Update Deal" option
    const updateDeal = await page.$('[role="option"]:has-text("Update Deal"), li:has-text("Update Deal")');
    if (updateDeal) {
      await updateDeal.click();
      console.log('Selected "Update Deal"');
    } else {
      const options = await page.$$eval('[role="option"], [role="listbox"] > *', els =>
        els.map(e => e.textContent?.trim()?.substring(0, 80)).filter(Boolean)
      );
      console.log('Available HubSpot actions:', options.slice(0, 15));
    }
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: '/tmp/zapier-hubspot-event.png', fullPage: true });

  // Check for Continue
  const continueBtn = await page.$('button:has-text("Continue")');
  if (continueBtn) {
    await continueBtn.click();
    console.log('Clicked Continue');
    await page.waitForTimeout(3000);
  }

  // Elements check
  const elements = await page.$$eval('button, input, select, [role="button"]', els =>
    els.map(e => {
      const rect = e.getBoundingClientRect();
      return { tag: e.tagName, text: e.textContent?.trim()?.substring(0, 80), visible: rect.width > 0 && rect.height > 0, y: Math.round(rect.y) };
    }).filter(e => e.visible && e.text).sort((a, b) => a.y - b.y)
  );
  console.log('\nElements:');
  elements.slice(0, 25).forEach(e => console.log(`  y=${e.y} [${e.tag}] "${e.text}"`));

  await context.storageState({ path: STORAGE_FILE });
  await browser.close();
})().catch(err => console.error('Error:', err.message));
