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
  console.log('🎬 ZAP-02 handmatig configureren');

  await page.goto('https://zapier.com/editor/353406808/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Click on step 1 to open config
  await page.mouse.dblclick(660, 275);
  await page.waitForTimeout(5000);
  await ss(page, 'Z02-CFG-01-step1');

  // Check what tab we're on
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Step 1 status:', text.substring(0, 600));

  // If we see "Pipeline" dropdown, we need to configure it
  if (text.includes('Pipeline') || text.includes('Configure') || text.includes('Setup')) {
    // Check if we need to go to Configure tab
    const configureTab = page.locator('text=Configure').first();
    if (await configureTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await configureTab.click();
      await page.waitForTimeout(3000);
      await ss(page, 'Z02-CFG-02-configure-tab');
    }

    // Look for Pipeline field
    const pipelineDropdown = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
          const rect = btn.getBoundingClientRect();
          if (rect.left > 800) {
            // Check if the label above is Pipeline
            let prev = btn.previousElementSibling || btn.parentElement;
            const label = prev?.textContent || '';
            return {
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
              label: label.substring(0, 50)
            };
          }
        }
      }
      return null;
    });

    if (pipelineDropdown) {
      console.log(`\nPipeline dropdown at (${pipelineDropdown.x}, ${pipelineDropdown.y})`);
      await page.mouse.click(pipelineDropdown.x, pipelineDropdown.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z02-CFG-03-pipeline-popup');

      // Find and click "Sonty Verkooppijplijn"
      const sontyRadio = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="radio"]');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          let parent = inp.parentElement;
          for (let i = 0; i < 5; i++) {
            if (parent && parent.textContent.includes('Sonty')) {
              const rect = inp.getBoundingClientRect();
              return { x: Math.round(rect.x + 8), y: Math.round(rect.y + 8), val: inp.value };
            }
            if (parent) parent = parent.parentElement;
          }
        }
        return null;
      });

      if (sontyRadio) {
        await page.mouse.click(sontyRadio.x, sontyRadio.y);
        console.log('  Sonty Verkooppijplijn geselecteerd!');
        await page.waitForTimeout(4000);
      }
    }

    // Now select the stage: "Prijsindicatie Verstuurd"
    await page.waitForTimeout(2000);
    const stageDropdown = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim().startsWith('Choose value') && !btn.disabled) {
          const rect = btn.getBoundingClientRect();
          if (rect.left > 800) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (stageDropdown) {
      console.log(`\nStage dropdown at (${stageDropdown.x}, ${stageDropdown.y})`);
      await page.mouse.click(stageDropdown.x, stageDropdown.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z02-CFG-04-stage-popup');

      // Find "Prijsindicatie Verstuurd"
      const prijsRadio = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="radio"]');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          let parent = inp.parentElement;
          for (let i = 0; i < 5; i++) {
            if (parent && parent.textContent.includes('Prijsindicatie')) {
              const rect = inp.getBoundingClientRect();
              return { x: Math.round(rect.x + 8), y: Math.round(rect.y + 8), val: inp.value };
            }
            if (parent) parent = parent.parentElement;
          }
        }
        return null;
      });

      if (prijsRadio) {
        await page.mouse.click(prijsRadio.x, prijsRadio.y);
        console.log('  Prijsindicatie Verstuurd geselecteerd!');
        await page.waitForTimeout(4000);
      }
    }

    // Click Continue
    const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
      if (!disabled) {
        await continueBtn.click({ force: true });
        console.log('  Continue geklikt!');
        await page.waitForTimeout(5000);

        // Test or skip
        const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });
        const testBtn = page.locator('button').filter({ hasText: /Test trigger/i });

        if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await testBtn.click();
          console.log('  Test trigger geklikt!');
          await page.waitForTimeout(15000);
        } else if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await skipBtn.click();
          console.log('  Test geskipt');
          await page.waitForTimeout(3000);
        }
      }
    }
  }

  await ss(page, 'Z02-CFG-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
