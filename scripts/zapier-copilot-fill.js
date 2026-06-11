const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/zapier-chrome-profile6', {
    headless: true, viewport: { width: 1400, height: 900 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://zapier.com/editor/353405789/draft');
  await page.waitForTimeout(8000);

  if (page.url().includes('login')) {
    try { await page.click('button:has-text("Accept all cookies")', { timeout: 2000 }); } catch(e) {}
    await page.fill('input[type="email"]', 'daimy@sonty.nl');
    let b = await page.$$('button');
    for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(4000);
    await page.fill('input[type="password"]', 'D^mR&F%82WtBrVK&fnm8');
    b = await page.$$('button');
    for (const btn of b) { if ((await btn.textContent()).trim() === 'Continue') { await btn.click(); break; } }
    await page.waitForTimeout(12000);
    await page.goto('https://zapier.com/editor/353405789/draft');
    await page.waitForTimeout(8000);
  }

  console.log('On editor');

  // Click step 3 → Configure
  await page.click('text=Create Deal');
  await page.waitForTimeout(3000);

  // Make sure we're on Configure tab
  try {
    await page.click('text=Configure', { timeout: 3000 });
    await page.waitForTimeout(2000);
    console.log('On Configure tab');
  } catch(e) {
    console.log('Configure tab click failed');
  }

  await page.screenshot({ path: '/tmp/zap01-cop-1.png' });

  // Use Copilot to set the fields
  console.log('\nUsing Copilot chat...');
  const copilotInput = await page.$('textarea[placeholder*="Chat"], [placeholder*="chat"], textarea');
  if (!copilotInput) {
    // Try finding the chat input area at the bottom
    const textareas = await page.$$('textarea');
    console.log('Found', textareas.length, 'textareas');
    for (const ta of textareas) {
      const rect = await ta.boundingBox();
      console.log('  textarea at y=' + Math.round(rect?.y || 0) + ' x=' + Math.round(rect?.x || 0));
    }
  }

  // Click on the Copilot chat area
  try {
    await page.click('text=Chat with Copilot', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch(e) {}

  // Find and use the textarea
  const textareas = await page.$$('textarea');
  let chatInput = null;
  for (const ta of textareas) {
    const rect = await ta.boundingBox();
    if (rect && rect.y > 700) { // Bottom of page
      chatInput = ta;
      break;
    }
  }

  if (chatInput) {
    const prompt = 'In step 3 "Create Deal", please set these 3 fields: 1) Set "Reuzenpanda omschrijving" to the Description from step 1. 2) Set "Reuzenpanda offerte link" to the text "https://hub.reuzenpanda.nl/app/deals/pipeline?item=" followed by the ID from step 1. 3) Set "Reuzenpanda Lead ID" to the ID from step 1.';

    await chatInput.click();
    await chatInput.fill(prompt);
    await page.waitForTimeout(500);

    // Press Enter or click Build/Send
    try {
      await page.click('text=Build', { timeout: 2000 });
    } catch(e) {
      await page.keyboard.press('Enter');
    }

    console.log('Sent Copilot request');
    await page.waitForTimeout(15000);
    await page.screenshot({ path: '/tmp/zap01-cop-2.png' });

    // Check Copilot response
    const responseText = await page.evaluate(() => {
      const msgs = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="chat"]');
      let text = '';
      msgs.forEach(m => text += m.textContent + '\n');
      return text;
    });
    console.log('Copilot response:', responseText.substring(0, 500));
  } else {
    console.log('Chat input not found, trying manual approach...');

    // Manual approach: click on step 3 Configure and scroll to find fields
    // Use Search fields box
    const searchBox = await page.$('input[placeholder="Search fields"]');
    if (searchBox) {
      console.log('Found Search fields box');

      // Search and fill each field
      for (const [fieldName, instruction] of [
        ['Reuzenpanda omschrijving', 'FILL_DESCRIPTION'],
        ['Reuzenpanda offerte', 'FILL_LINK'],
        ['Reuzenpanda Lead ID', 'FILL_ID'],
      ]) {
        await searchBox.click({ clickCount: 3 });
        await searchBox.fill(fieldName);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: '/tmp/zap01-search-' + fieldName.replace(/ /g, '_') + '.png' });

        // Find the input field that appeared
        const slateEditors = await page.$$('[data-slate-editor="true"]');
        for (const ed of slateEditors) {
          const rect = await ed.boundingBox();
          if (rect && rect.left > 450 && rect.width > 100) {
            const text = await ed.textContent();
            if (text.includes('Enter text') || text.trim() === '') {
              await ed.click();
              await page.waitForTimeout(300);

              if (instruction === 'FILL_DESCRIPTION') {
                // Type {{ to trigger data picker
                await page.keyboard.type('{{');
                await page.waitForTimeout(1000);
                // Search for Description
                await page.keyboard.type('Description');
                await page.waitForTimeout(1000);
                await page.screenshot({ path: '/tmp/zap01-desc-picker.png' });
                // Select first result
                await page.keyboard.press('Enter');
                await page.waitForTimeout(500);
                console.log('Filled Description');
              } else if (instruction === 'FILL_LINK') {
                await page.keyboard.type('https://hub.reuzenpanda.nl/app/deals/pipeline?item=');
                await page.keyboard.type('{{');
                await page.waitForTimeout(1000);
                await page.keyboard.type('ID');
                await page.waitForTimeout(1000);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(500);
                console.log('Filled Link');
              } else if (instruction === 'FILL_ID') {
                await page.keyboard.type('{{');
                await page.waitForTimeout(1000);
                await page.keyboard.type('ID');
                await page.waitForTimeout(1000);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(500);
                console.log('Filled ID');
              }
              break;
            }
          }
        }
      }

      // Clear search
      await searchBox.click({ clickCount: 3 });
      await searchBox.fill('');
      await page.waitForTimeout(500);
    }
  }

  // Try to publish
  console.log('\nPublishing...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.trim() === 'Publish') { b.click(); return true; }
    }
    return false;
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/zap01-final-pub.png' });

  await ctx.close();
  console.log('Done');
})().catch(console.error);
