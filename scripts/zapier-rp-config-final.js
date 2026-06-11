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
  console.log('🎬 ZAP-01 Reuzenpanda configureren (final)');

  await page.goto('https://zapier.com/editor/353405789/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Dismiss popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Double-click step 1 to open config panel
  console.log('Double-click step 1...');
  await page.mouse.dblclick(660, 170);
  await page.waitForTimeout(5000);
  await ss(page, 'Z01-FIN-01-dblclick');

  // Check if config panel opened
  let hasPanel = await page.evaluate(() => document.body.innerText.includes('Select a Profile'));
  console.log('Panel met Profile veld:', hasPanel);

  if (!hasPanel) {
    // Try clicking the step text
    console.log('  Probeer klik op "1. Lead Created"...');
    // Navigate directly to step URL
    await page.goto('https://zapier.com/editor/353405789/draft/trigger/fields', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    await ss(page, 'Z01-FIN-01b-direct-url');

    hasPanel = await page.evaluate(() => document.body.innerText.includes('Select a Profile'));
    console.log('Panel na direct URL:', hasPanel);
  }

  if (!hasPanel) {
    // Try the step-specific URL pattern
    const stepUrls = [
      'https://zapier.com/editor/353405789/draft/_GEN_1773140876863/fields',
      'https://zapier.com/editor/353405789/draft/trigger',
    ];
    for (const url of stepUrls) {
      console.log(`  Probeer: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(8000);
      hasPanel = await page.evaluate(() => document.body.innerText.includes('Select a Profile'));
      console.log('  Panel:', hasPanel);
      if (hasPanel) break;
    }
  }

  if (hasPanel) {
    // Now find and click the Profile dropdown
    // The text is "Choose value…" (with Unicode ellipsis)
    console.log('\n--- Profile selecteren ---');

    // Find all elements with "Choose value" text
    const chooseCoords = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const results = [];
      for (const el of all) {
        const text = el.textContent.trim();
        if (text === 'Choose value…' && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 10 && rect.height > 10) {
            // Walk up to find clickable parent
            let clickable = el;
            for (let i = 0; i < 10; i++) {
              if (!clickable.parentElement) break;
              clickable = clickable.parentElement;
              const tag = clickable.tagName;
              const role = clickable.getAttribute('role');
              if (tag === 'BUTTON' || role === 'button' || role === 'combobox' ||
                  clickable.getAttribute('tabindex') !== null ||
                  clickable.onclick) {
                break;
              }
            }
            const cRect = clickable.getBoundingClientRect();
            results.push({
              text,
              tag: clickable.tagName,
              role: clickable.getAttribute('role'),
              x: cRect.x + cRect.width / 2,
              y: cRect.y + cRect.height / 2,
              w: cRect.width,
              h: cRect.height,
              disabled: clickable.getAttribute('disabled'),
              ariaDisabled: clickable.getAttribute('aria-disabled'),
              dataDisabled: clickable.getAttribute('data-disabled')
            });
          }
        }
      }
      return results;
    });

    console.log('Choose value triggers:', JSON.stringify(chooseCoords, null, 2));

    // Click first non-disabled "Choose value" (Profile)
    for (const c of chooseCoords) {
      if (c.disabled === null && c.ariaDisabled !== 'true' && c.dataDisabled !== 'true') {
        console.log(`  Klikken op (${Math.round(c.x)}, ${Math.round(c.y)}) - ${c.tag} ${c.role || ''}`);
        await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(3000);
        await ss(page, 'Z01-FIN-02-profile-open');

        // Now select Sonty B.V. via label
        const sontyLabel = page.locator('label').filter({ hasText: /Sonty/ }).first();
        if (await sontyLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sontyLabel.click();
          console.log('  Sonty B.V. geselecteerd!');
          await page.waitForTimeout(4000);
        } else {
          // Try clicking the text
          const sontyText = page.locator('text=Sonty B.V.').first();
          if (await sontyText.isVisible({ timeout: 3000 }).catch(() => false)) {
            await sontyText.click();
            console.log('  Sonty B.V. text geklikt');
            await page.waitForTimeout(4000);
          }
        }
        await ss(page, 'Z01-FIN-03-profile-done');
        break;
      }
    }

    // Wait for Board to load
    await page.waitForTimeout(3000);

    // === BOARD ===
    console.log('\n--- Board ---');
    const boardCoords = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const results = [];
      for (const el of all) {
        const text = el.textContent.trim();
        if (text === 'Choose value…' && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 10 && rect.height > 10) {
            let clickable = el;
            for (let i = 0; i < 10; i++) {
              if (!clickable.parentElement) break;
              clickable = clickable.parentElement;
              if (clickable.tagName === 'BUTTON' || clickable.getAttribute('role') === 'button' ||
                  clickable.getAttribute('tabindex') !== null) break;
            }
            const cRect = clickable.getBoundingClientRect();
            results.push({
              x: cRect.x + cRect.width / 2,
              y: cRect.y + cRect.height / 2,
              disabled: clickable.getAttribute('disabled'),
              ariaDisabled: clickable.getAttribute('aria-disabled'),
              dataDisabled: clickable.getAttribute('data-disabled')
            });
          }
        }
      }
      return results;
    });

    for (const c of boardCoords) {
      if (c.disabled === null && c.ariaDisabled !== 'true' && c.dataDisabled !== 'true') {
        console.log(`  Board klikken op (${Math.round(c.x)}, ${Math.round(c.y)})`);
        await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(3000);
        await ss(page, 'Z01-FIN-04-board-open');

        // Select first option
        const firstLabel = page.locator('label').first();
        if (await firstLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
          const txt = await firstLabel.innerText().catch(() => 'unknown');
          console.log(`  Board optie: "${txt}"`);
          await firstLabel.click();
          console.log('  Board geselecteerd!');
          await page.waitForTimeout(4000);
        }
        await ss(page, 'Z01-FIN-05-board-done');
        break;
      }
    }

    // === BACKLOG ===
    console.log('\n--- Backlog ---');
    await page.waitForTimeout(3000);

    const blCoords = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const results = [];
      for (const el of all) {
        const text = el.textContent.trim();
        if (text === 'Choose value…' && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 10 && rect.height > 10) {
            let clickable = el;
            for (let i = 0; i < 10; i++) {
              if (!clickable.parentElement) break;
              clickable = clickable.parentElement;
              if (clickable.tagName === 'BUTTON' || clickable.getAttribute('role') === 'button' ||
                  clickable.getAttribute('tabindex') !== null) break;
            }
            const cRect = clickable.getBoundingClientRect();
            results.push({
              x: cRect.x + cRect.width / 2,
              y: cRect.y + cRect.height / 2,
              disabled: clickable.getAttribute('disabled'),
              ariaDisabled: clickable.getAttribute('aria-disabled'),
              dataDisabled: clickable.getAttribute('data-disabled')
            });
          }
        }
      }
      return results;
    });

    for (const c of blCoords) {
      if (c.disabled === null && c.ariaDisabled !== 'true' && c.dataDisabled !== 'true') {
        console.log(`  Backlog klikken op (${Math.round(c.x)}, ${Math.round(c.y)})`);
        await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(3000);
        await ss(page, 'Z01-FIN-06-backlog-open');

        // Select first option (may be checkbox)
        const firstLabel = page.locator('label').first();
        if (await firstLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
          const txt = await firstLabel.innerText().catch(() => 'unknown');
          console.log(`  Backlog optie: "${txt}"`);
          await firstLabel.click();
          console.log('  Backlog geselecteerd!');
          await page.waitForTimeout(2000);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
        await ss(page, 'Z01-FIN-07-backlog-done');
        break;
      }
    }

    // === CONTINUE ===
    await page.waitForTimeout(2000);
    await ss(page, 'Z01-FIN-08-before-continue');

    const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('\nStatus:', text.substring(0, 800));

    const continueBtn = page.locator('button').filter({ hasText: /Continue/ }).first();
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const disabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
      if (!disabled) {
        await continueBtn.click();
        console.log('  Continue geklikt!');
        await page.waitForTimeout(8000);
        await ss(page, 'Z01-FIN-09-continued');
      } else {
        console.log('  Continue disabled');
      }
    }
  } else {
    console.log('Config panel niet gevonden');
  }

  await ss(page, 'Z01-FIN-final');

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
