const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3456', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Click on Changelog tab
  await page.click('[data-tab="changelog"]');
  await page.waitForTimeout(1000);
  
  await page.screenshot({ 
    path: path.join(__dirname, 'dashboard-changelog.png'), 
    fullPage: true 
  });
  console.log('Changelog screenshot saved');
  
  await browser.close();
})();
