const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login + select Sonty
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  await page.click('text=Sonty B.V.');
  await page.waitForTimeout(5000);

  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

  // Check permissions
  console.log('=== Permissions ===');
  const perms = await page.evaluate(async (profileId) => {
    const res = await fetch(`https://hub.reuzenpanda.nl/api/auth/permissions?profileId=${profileId}`, { credentials: 'include' });
    return await res.text();
  }, PROFILE_ID);
  console.log(perms.substring(0, 1000));

  // Check team members page
  console.log('\n=== Team Members ===');
  await page.goto('https://hub.reuzenpanda.nl/app/settings/team');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-team.png' });
  const teamText = await page.evaluate(() => document.body.innerText);
  console.log(teamText.substring(0, 500));

  // Check subscription/plan
  console.log('\n=== Subscription ===');
  await page.goto('https://hub.reuzenpanda.nl/app/settings/subscription');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-subscription.png' });
  const subText = await page.evaluate(() => document.body.innerText);
  console.log(subText.substring(0, 500));

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
