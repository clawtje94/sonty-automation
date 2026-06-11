const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login with Joey
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
  const DOC_ID = '23c8c5ed-f25c-45bd-bd6c-1f0b52437064';

  // Get full version data
  console.log('=== Full quotation version data ===');
  const versionData = await page.evaluate(async ({ profileId, docId }) => {
    const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/documents/${docId}/versions`, { credentials: 'include' });
    return await res.json();
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  console.log(JSON.stringify(versionData, null, 2).substring(0, 3000));

  // Also get full quotation data
  console.log('\n=== Full quotation data ===');
  const quotData = await page.evaluate(async ({ profileId, docId }) => {
    const res = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${profileId}/quotations/${docId}`, { credentials: 'include' });
    return await res.json();
  }, { profileId: PROFILE_ID, docId: DOC_ID });

  console.log(JSON.stringify(quotData, null, 2).substring(0, 3000));

  // Check the automation page for webhook options
  console.log('\n=== Automation: webhook capability ===');
  await page.goto('https://hub.reuzenpanda.nl/app/automation');
  await page.waitForTimeout(3000);

  // Click "Sjablonen" (templates) to see available action types
  try {
    await page.click('text=Sjablonen');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/rp-auto-templates.png' });
    const templateText = await page.evaluate(() => document.body.innerText);
    console.log(templateText.substring(0, 500));
  } catch(e) {}

  // Try creating a new automation to see webhook options
  try {
    await page.click('text=Mijn automatiseringen');
    await page.waitForTimeout(2000);
    // Look for "+" or "Nieuw" button
    const addBtn = await page.$('text=Nieuwe automatisering, button:has-text("+"), button:has-text("Nieuw")');
    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/rp-auto-new.png' });
      const newText = await page.evaluate(() => document.body.innerText);
      // Look for webhook/API action options
      const webhookLines = newText.split('\n').filter(l =>
        l.toLowerCase().includes('webhook') || l.toLowerCase().includes('api') ||
        l.toLowerCase().includes('http') || l.toLowerCase().includes('url')
      );
      console.log('Webhook-related:', webhookLines.join(' | '));
    }
  } catch(e) {}

  await browser.close();
  console.log('\nDone');
})().catch(console.error);
