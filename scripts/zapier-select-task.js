const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile5', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    const b1 = await page.$$('button');
    for (const b of b1) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(4000);
    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    const b2 = await page.$$('button');
    for (const b of b2) { if ((await b.textContent()).trim() === 'Continue') { await b.click(); break; } }
    await page.waitForTimeout(12000);
    await page.goto('https://zapier.com/editor/353405789/draft');
    await page.waitForTimeout(8000);
  }

  console.log('On draft editor');

  // Scroll to step 4 and find the + button after it
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Find and click the Add step button after step 4
  const addButtons = await page.$$('button');
  for (const btn of addButtons) {
    try {
      const text = (await btn.textContent()).trim();
      const rect = await btn.boundingBox();
      if (text === 'Add step' && rect && rect.y > 550) {
        await btn.click({ force: true });
        await page.waitForTimeout(3000);
        console.log('Clicked Add step');
        break;
      }
    } catch(e) {}
  }

  // Click HubSpot from the app list
  try {
    // First try clicking HubSpot directly from "Your top apps"
    const hubspotLinks = await page.$$('text=HubSpot');
    for (const link of hubspotLinks) {
      const rect = await link.boundingBox();
      if (rect && rect.x > 200 && rect.x < 500) { // In the app list, not in the steps
        await link.click();
        await page.waitForTimeout(3000);
        console.log('Selected HubSpot');
        await page.screenshot({ path: '/tmp/zap01-hubspot-selected.png' });
        break;
      }
    }
  } catch(e) {
    console.log('HubSpot click failed:', e.message.substring(0, 60));
  }

  // Now search for "Create Task" event
  await page.screenshot({ path: '/tmp/zap01-event-select.png' });

  // Look for event search/selection
  const eventSearch = await page.$('input[placeholder*="Search"], input[type="search"]');
  if (eventSearch) {
    await eventSearch.fill('Create Task');
    await page.waitForTimeout(2000);
    console.log('Searched for Create Task');
  }

  // Click Create Task
  try {
    await page.click('text=Create Task', { timeout: 5000 });
    await page.waitForTimeout(3000);
    console.log('Selected Create Task!');
    await page.screenshot({ path: '/tmp/zap01-task-selected.png' });
  } catch(e) {
    console.log('Create Task not found, listing options...');
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lines = bodyText.split('\n').filter(l => l.trim().toLowerCase().includes('task') || l.trim().toLowerCase().includes('create'));
    lines.forEach(l => console.log('  ' + l.trim().substring(0, 80)));
  }

  // Click Continue if there's a button
  try {
    await page.click('button:has-text("Continue")', { timeout: 3000 });
    await page.waitForTimeout(3000);
    console.log('Clicked Continue');
  } catch(e) {}

  // Account selection - should auto-select the connected HubSpot account
  try {
    await page.click('button:has-text("Continue")', { timeout: 5000 });
    await page.waitForTimeout(3000);
    console.log('Account Continue');
  } catch(e) {}

  // Now we should be on the Configure step for the task
  await page.screenshot({ path: '/tmp/zap01-task-configure.png' });

  // Get the configuration fields
  const configText = await page.evaluate(() => {
    const panel = document.querySelector('[class*="sidebar"], [class*="panel"]');
    if (panel) return panel.innerText.substring(0, 2000);
    return '';
  });
  console.log('\nConfig panel:');
  const lines = configText.split('\n').filter(l => l.trim().length > 2);
  lines.slice(0, 30).forEach(l => console.log('  ' + l.trim().substring(0, 80)));

  await ctx.close();
  console.log('\nDone');
})().catch(console.error);
