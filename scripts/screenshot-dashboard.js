const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3456', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Wait for charts to render
  
  // Full page screenshot
  await page.screenshot({ 
    path: path.join(__dirname, 'dashboard-full.png'), 
    fullPage: true 
  });
  console.log('Full page screenshot saved');
  
  // Header + KPIs area
  await page.screenshot({ 
    path: path.join(__dirname, 'dashboard-header.png'),
    clip: { x: 0, y: 0, width: 1440, height: 500 }
  });
  console.log('Header screenshot saved');
  
  // Charts area  
  await page.screenshot({ 
    path: path.join(__dirname, 'dashboard-charts.png'),
    clip: { x: 0, y: 500, width: 1440, height: 900 }
  });
  console.log('Charts screenshot saved');
  
  await browser.close();
  console.log('Done!');
})();
