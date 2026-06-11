const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 ZAP-01 Step 4 via Copilot');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Open Copilot by clicking the chat bubble (bottom right)
  await page.mouse.click(1224, 668);
  await page.waitForTimeout(3000);

  // Try finding the textarea in the copilot panel
  let chatArea = page.locator('textarea').first();
  if (!await chatArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Copilot may be the sidebar - look for input in sidebar
    // Try the "Chat with Copilot" placeholder
    chatArea = page.locator('[placeholder*="Chat"]').first()
      .or(page.locator('textarea').first());
  }

  if (await chatArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatArea.click();
    await chatArea.fill('Please configure step 4 "Create Associations": set "Type of the objects the from object is being associated with" to "contact". The From Object ID should use the contact ID from step 2. Then skip the test for step 4.');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('  Copilot instructie verstuurd');

    await page.waitForTimeout(40000);
    await ss(page, 'Z01-COP4-01-working');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('Na copilot:', text.substring(0, 800));

    if (text.includes('Working') || text.includes('called') || text.includes('Thought')) {
      await page.waitForTimeout(30000);
      await ss(page, 'Z01-COP4-02-more');
    }
  } else {
    console.log('  Chat input niet gevonden');
    // Try scrolling copilot panel to bottom
    await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.offsetParent !== null) {
          ta.scrollIntoView();
          return ta.placeholder || 'found';
        }
      }
      return 'none';
    });
    await page.waitForTimeout(2000);
    await ss(page, 'Z01-COP4-00-no-chat');
  }

  await ss(page, 'Z01-COP4-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
