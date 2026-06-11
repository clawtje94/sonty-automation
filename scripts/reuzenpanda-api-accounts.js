const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login with Joey (has more access)
  await page.goto('https://hub.reuzenpanda.nl/login');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'Joey@sonty.nl');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'Shja..59');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  await page.click('text=Sonty B.V.');
  await page.waitForTimeout(5000);

  const PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';

  // Check automation settings for webhooks
  console.log('=== Automation page ===');
  await page.goto('https://hub.reuzenpanda.nl/app/automation');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rp-automation-joey.png' });

  // Click on an automation to see webhook/action settings
  try {
    await page.click('text=Offerte versturen');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-auto-offerte.png' });
    const autoText = await page.evaluate(() => document.body.innerText);
    console.log('Offerte versturen automation:');
    console.log(autoText.substring(0, 600));
  } catch(e) {
    console.log('Could not open automation');
  }

  // Check the API service accounts in team settings
  console.log('\n=== API Service Accounts ===');
  await page.goto('https://hub.reuzenpanda.nl/app/settings/team');
  await page.waitForTimeout(3000);

  // Click on an API account to see its details/token
  const apiAccounts = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    const results = [];
    for (const el of els) {
      if (el.textContent.includes('api.') && el.textContent.includes('@no-reply') && el.children.length < 3) {
        const r = el.getBoundingClientRect();
        if (r.height > 5 && r.height < 40) {
          results.push({ text: el.textContent.trim(), x: r.x + r.width/2, y: r.y + r.height/2 });
        }
      }
    }
    return results;
  });

  console.log('API accounts found:', apiAccounts.length);
  apiAccounts.forEach(a => console.log('  ' + a.text));

  // Click on first API account
  if (apiAccounts.length > 0) {
    await page.mouse.click(apiAccounts[0].x, apiAccounts[0].y);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-api-account-detail.png' });
    const detailText = await page.evaluate(() => document.body.innerText);
    const tokenLines = detailText.split('\n').filter(l =>
      l.includes('token') || l.includes('key') || l.includes('api') || l.includes('Token') || l.includes('Key')
    );
    console.log('Detail text (token-related):');
    tokenLines.forEach(l => console.log('  ' + l.trim()));
  }

  // Also check the Zapier integration settings
  console.log('\n=== Integration/Zapier settings ===');
  const integrationUrls = [
    'https://hub.reuzenpanda.nl/app/settings/integrations',
    'https://hub.reuzenpanda.nl/app/settings/api',
    'https://hub.reuzenpanda.nl/app/settings/zapier',
    'https://hub.reuzenpanda.nl/app/settings/webhooks',
  ];

  for (const url of integrationUrls) {
    await page.goto(url);
    await page.waitForTimeout(2000);
    const curUrl = page.url();
    const text = await page.evaluate(() => document.body.innerText);
    const has404 = text.includes('404');
    if (!has404) {
      console.log(url.split('settings/')[1] + ': ✅ exists');
      console.log(text.substring(0, 300));
      await page.screenshot({ path: '/tmp/rp-' + url.split('settings/')[1] + '.png' });
    }
  }

  // Try the full quotation data (version content) which we know works
  console.log('\n=== Full quotation version data ===');
  const DOC_ID = '23c8c5ed-f25c-45bd-bd6c-1f0b52437064';
  const versionData = await page.evaluate(async ({ profileId, docId }) => {
    const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/versions`, { credentials: 'include' });
    return await res.text();
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  // Parse and show the structure
  try {
    const parsed = JSON.parse(versionData);
    const version = parsed.versions?.[0];
    if (version) {
      console.log('Version ID:', version.id);
      console.log('Segments:', JSON.stringify(version.data?.segments?.map(s => s.type || s.ref)).substring(0, 200));
      // Check if there's product/pricing data
      const dataStr = JSON.stringify(version.data);
      if (dataStr.includes('product') || dataStr.includes('prijs') || dataStr.includes('amount')) {
        console.log('Contains product/pricing data!');
      }
      console.log('Full data length:', dataStr.length, 'chars');
    }
  } catch(e) {
    console.log('Parse error:', e.message);
  }

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
