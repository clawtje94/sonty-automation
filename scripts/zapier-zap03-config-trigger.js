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
  console.log('🎬 ZAP-03 trigger configureren — Stage wijzigen naar Opmeting Ingepland');

  // 1. Open ZAP-03 editor
  await page.goto('https://zapier.com/editor/353373774/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await ss(page, 'Z03-01-loaded');

  // Dismiss any popup
  const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
  if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }

  // Close Copilot sidebar if visible (the < arrow button)
  const collapseBtn = page.locator('button[aria-label="Collapse sidebar"]').first();
  if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await collapseBtn.click();
    await page.waitForTimeout(1000);
  } else {
    // Try the chevron/close button near Copilot
    const chevron = page.locator('svg').locator('..').filter({ hasText: '' });
    // Just click the < arrow at approximately (463, 107)
    await page.mouse.click(463, 107);
    await page.waitForTimeout(1000);
  }
  await ss(page, 'Z03-02-sidebar-closed');

  // 2. Find and double-click Step 1 - find the "Updated Deal Stage" card
  const step1Card = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.textContent.includes('Updated Deal Stage') && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        // Look for the card-like element (reasonable size, in the center area)
        if (rect.width > 200 && rect.width < 500 && rect.height > 50 && rect.height < 150 && rect.left > 400) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  });

  if (step1Card) {
    console.log(`Step 1 card at (${step1Card.x}, ${step1Card.y})`);
    await page.mouse.dblclick(step1Card.x, step1Card.y);
  } else {
    // Fallback: try common position
    console.log('Card niet gevonden via DOM, probeer (660, 370)');
    await page.mouse.dblclick(660, 370);
  }
  await page.waitForTimeout(5000);
  await ss(page, 'Z03-03-step1-open');

  // Check if config panel opened
  let bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Panel check:', bodyText.includes('Setup') && bodyText.includes('Configure') && bodyText.includes('Test') ? 'Config panel OPEN' : 'Config panel NOT open');

  if (!bodyText.includes('Setup') || !bodyText.includes('Configure')) {
    // Try clicking directly on the step text
    const stepText = page.locator('text=Updated Deal Stage').first();
    if (await stepText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stepText.dblclick();
      await page.waitForTimeout(5000);
      await ss(page, 'Z03-03b-retry-open');
      bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    }
  }

  // 3. Click Configure tab
  // Find the Configure tab button using role="tab"
  const configTabCoords = await page.evaluate(() => {
    const tabs = document.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent.includes('Configure')) {
        const rect = tab.getBoundingClientRect();
        return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      }
    }
    return null;
  });

  if (configTabCoords) {
    console.log(`Configure tab at (${configTabCoords.x}, ${configTabCoords.y})`);
    await page.mouse.click(configTabCoords.x, configTabCoords.y);
    await page.waitForTimeout(4000);
    await ss(page, 'Z03-04-configure-tab');
  } else {
    console.log('Configure tab niet gevonden');
    await ss(page, 'Z03-04-no-config-tab');
  }

  // Check what we see
  bodyText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  const hasPipeline = bodyText.includes('Sonty Verkooppijplijn');
  const hasOpmeting = bodyText.includes('Opmeting Ingepland');
  const hasPrijs = bodyText.includes('Prijsindicatie Verstuurd');
  console.log(`\nPipeline = Sonty: ${hasPipeline}`);
  console.log(`Stage = Opmeting Ingepland: ${hasOpmeting}`);
  console.log(`Stage = Prijsindicatie Verstuurd: ${hasPrijs}`);

  // 4. Change the Stage dropdown
  if (!hasOpmeting && (hasPrijs || bodyText.includes('Deal Stage'))) {
    console.log('\n--- Stage wijzigen naar Opmeting Ingepland ---');

    // Find the stage combobox/button (contains current stage value)
    const stageBtn = await page.evaluate(() => {
      // Method 1: Find combobox with current stage text
      const combos = document.querySelectorAll('[role="combobox"]');
      for (const c of combos) {
        if (c.offsetParent === null) continue;
        const text = c.textContent.trim();
        if (text.includes('Verstuurd') || text.includes('Stage')) {
          const rect = c.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text, method: 'combobox' };
        }
      }
      // Method 2: Find button with current stage text
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent.trim();
        if (text.includes('Prijsindicatie Verstuurd')) {
          const rect = btn.getBoundingClientRect();
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text, method: 'button' };
        }
      }
      // Method 3: Second "Choose value" or second combobox in panel
      const allCombos = [];
      for (const c of combos) {
        if (c.offsetParent === null) continue;
        const rect = c.getBoundingClientRect();
        if (rect.left > 850 && rect.top > 200) {
          allCombos.push({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: c.textContent.trim().substring(0, 50), top: rect.top, method: 'combo-pos' });
        }
      }
      allCombos.sort((a, b) => a.top - b.top);
      // Pipeline is first, Stage is second
      return allCombos[1] || null;
    });

    if (stageBtn) {
      console.log(`Stage element at (${stageBtn.x}, ${stageBtn.y}): "${stageBtn.text}" [${stageBtn.method}]`);
      await page.mouse.click(stageBtn.x, stageBtn.y);
      await page.waitForTimeout(3000);
      await ss(page, 'Z03-05-stage-popup');

      // Log all visible radio options
      const allRadios = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="radio"]');
        const opts = [];
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const rect = inp.getBoundingClientRect();
          let parent = inp.parentElement;
          let text = '';
          for (let i = 0; i < 5; i++) {
            if (parent) {
              text = parent.textContent?.trim() || '';
              parent = parent.parentElement;
            }
          }
          opts.push({
            x: Math.round(rect.x + 8),
            y: Math.round(rect.y + 8),
            val: inp.value,
            checked: inp.checked,
            text: text.substring(0, 60)
          });
        }
        return opts;
      });
      console.log('Radio options:', JSON.stringify(allRadios, null, 2));

      // Find "Opmeting Ingepland"
      const opmetingOpt = allRadios.find(r => r.text.includes('Opmeting Ingepland'));
      if (opmetingOpt) {
        await page.mouse.click(opmetingOpt.x, opmetingOpt.y);
        console.log('  ✅ Opmeting Ingepland geselecteerd!');
        await page.waitForTimeout(4000);
        await ss(page, 'Z03-06-stage-selected');
      } else {
        console.log('  Opmeting Ingepland niet in radio opties, probeer tekst locator...');
        // Try scrolling in the popup to find it
        const opmetingLoc = page.locator('text=Opmeting Ingepland').first();
        if (await opmetingLoc.isVisible({ timeout: 3000 }).catch(() => false)) {
          await opmetingLoc.click();
          await page.waitForTimeout(4000);
          console.log('  ✅ Via tekst geklikt');
        } else {
          // May need to scroll the popup
          console.log('  Probeer scrollen in popup...');
          // Find the popup/modal and scroll it
          const scrolled = await page.evaluate(() => {
            const modals = document.querySelectorAll('[role="dialog"], [role="listbox"], [class*="modal"], [class*="popover"], [class*="overlay"]');
            for (const m of modals) {
              if (m.scrollHeight > m.clientHeight) {
                m.scrollTop += 200;
                return true;
              }
            }
            return false;
          });
          if (scrolled) {
            await page.waitForTimeout(1000);
            // Try again
            const opmetingLoc2 = page.locator('text=Opmeting Ingepland').first();
            if (await opmetingLoc2.isVisible({ timeout: 3000 }).catch(() => false)) {
              await opmetingLoc2.click();
              await page.waitForTimeout(4000);
              console.log('  ✅ Na scrollen geklikt');
            }
          }
          await ss(page, 'Z03-06-stage-scroll');
        }
      }
    } else {
      console.log('  Stage element niet gevonden');
    }
  } else if (hasOpmeting) {
    console.log('\n✅ Stage is al correct: Opmeting Ingepland');
  }

  // 5. Verify
  await page.waitForTimeout(2000);
  const verifyText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
  console.log(`\nVerificatie - Opmeting Ingepland in tekst: ${verifyText.includes('Opmeting Ingepland')}`);
  await ss(page, 'Z03-07-verified');

  // 6. Click Continue
  console.log('\n--- Continue ---');
  const continueBtn = page.locator('button').filter({ hasText: /^Continue$/ });
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const disabled = await continueBtn.evaluate(el => el.disabled || el.getAttribute('data-disabled') === 'true');
    if (!disabled) {
      await continueBtn.click({ force: true });
      console.log('  Continue geklikt!');
      await page.waitForTimeout(5000);
      await ss(page, 'Z03-08-continued');
    }
  } else {
    console.log('  Continue niet zichtbaar');
  }

  // 7. Test or skip
  const testBtn = page.locator('button').filter({ hasText: /Test trigger/i });
  const skipBtn = page.locator('button').filter({ hasText: /Skip test/i });

  if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await testBtn.click();
    console.log('  Test trigger geklikt!');
    await page.waitForTimeout(15000);
    await ss(page, 'Z03-09-test-result');

    const testResult = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    // Handle test outcomes
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      console.log('  Test geskipt');
      await page.waitForTimeout(3000);
    }
    const contBtn = page.locator('button').filter({ hasText: /^Continue$/ });
    if (await contBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contBtn.click();
      await page.waitForTimeout(3000);
    }
  } else if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    console.log('  Test geskipt');
    await page.waitForTimeout(3000);
  }

  // Final
  await ss(page, 'Z03-final');
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('\nFinal:', finalText.substring(0, 1000));
  console.log('URL:', page.url());

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  console.log('\nSessie opgeslagen!');

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
