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
  console.log('🎬 ZAP-03 configureren via Copilot');

  // Use the newest zap (just created)
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Click the first (newest) "Untitled Zap"
  const untitledZap = page.locator('text=Untitled Zap').first();
  if (await untitledZap.isVisible({ timeout: 5000 }).catch(() => false)) {
    await untitledZap.click({ force: true });
    await page.waitForTimeout(10000);
  }

  await ss(page, 'Z03-01-opened');
  console.log('URL:', page.url());

  // Try using Copilot to set up the zap
  const copilotArea = page.locator('textarea').first();
  if (await copilotArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    const msg = `Set up this zap with:
1. Trigger: HubSpot "Updated Deal Stage" - Pipeline "Sonty Verkooppijplijn", Stage "Opmeting Ingepland"
2. Action 1: Planado "Create Job" - Job type Opmeting, with contact info from HubSpot deal
3. Action 2: HubSpot "Update Deal" - store Planado job ID
Please set up the trigger and actions, I'll configure the details later.`;

    await copilotArea.click();
    await copilotArea.fill(msg);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('Copilot instructie verstuurd');
    await page.waitForTimeout(45000);
    await ss(page, 'Z03-02-copilot');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('After copilot:', text.substring(0, 1000));

    // Wait more if still working
    if (text.includes('Working') || text.includes('Thought') || text.includes('called')) {
      console.log('Copilot nog bezig, wacht 30s...');
      await page.waitForTimeout(30000);
      await ss(page, 'Z03-03-copilot-done');
    }
  } else {
    console.log('Copilot textarea niet gevonden');

    // Manual approach: click on Step 1 trigger
    const triggerStep = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === 'Select the event that starts your Zap') {
          const rect = el.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (triggerStep) {
      await page.mouse.click(triggerStep.x, triggerStep.y);
      await page.waitForTimeout(3000);

      // Search for HubSpot
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill('HubSpot');
        await page.waitForTimeout(3000);

        // Click HubSpot in results
        const hubspotResult = await page.evaluate(() => {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const text = el.textContent?.trim() || '';
            if (text === 'HubSpot') {
              const rect = el.getBoundingClientRect();
              if (rect.y > 200 && rect.width > 30) {
                return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
              }
            }
          }
          return null;
        });

        if (hubspotResult) {
          await page.mouse.click(hubspotResult.x, hubspotResult.y);
          await page.waitForTimeout(3000);
          console.log('HubSpot geselecteerd');

          // Search for "Updated Deal Stage" event
          const eventInput = page.locator('input[placeholder*="Search"]').first();
          if (await eventInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await eventInput.fill('Updated Deal Stage');
            await page.waitForTimeout(3000);

            const eventResult = await page.evaluate(() => {
              const allEls = document.querySelectorAll('*');
              for (const el of allEls) {
                const text = el.textContent?.trim() || '';
                if (text.includes('Updated Deal Stage')) {
                  const rect = el.getBoundingClientRect();
                  if (rect.y > 200 && rect.width > 30) {
                    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
                  }
                }
              }
              return null;
            });

            if (eventResult) {
              await page.mouse.click(eventResult.x, eventResult.y);
              await page.waitForTimeout(3000);
              console.log('Updated Deal Stage geselecteerd');
            }
          }
        }
      }
    }
  }

  // Rename the zap
  const namePos = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() === 'Untitled Zap') {
        const rect = el.getBoundingClientRect();
        if (rect.y < 50 && rect.width > 50) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (namePos) {
    await page.mouse.click(namePos.x, namePos.y);
    await page.waitForTimeout(2000);
    const renameItem = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() === 'Rename') {
          const rect = el.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });
    if (renameItem) {
      await page.mouse.click(renameItem.x, renameItem.y);
      await page.waitForTimeout(1000);
      await page.keyboard.type('ZAP-03: Planado Opmeting Aanmaken');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      console.log('ZAP-03 hernoemd');
    }
  }

  await ss(page, 'Z03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
