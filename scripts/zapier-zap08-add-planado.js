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
  console.log('🎬 ZAP-08 Planado Installatie toevoegen');

  // ZAP-08 ID = 353424667
  await page.goto('https://zapier.com/editor/353424667/draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  await ss(page, 'Z08PL-01-loaded');

  // Check current state — do we already have a Step 2?
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Page state:', pageText.substring(0, 800));

  // Look for "Add step" or "+" button to add Step 2
  // First check if there's already a Planado step
  if (pageText.includes('Planado') && pageText.includes('Create Job')) {
    console.log('Planado step al aanwezig!');
  } else {
    // Click the "+" button between steps or "Add step" link
    const addStepBtn = await page.evaluate(() => {
      // Look for the "+" or "Add step" between the trigger and the end
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === 'Add step') {
          const rect = el.getBoundingClientRect();
          if (rect.y > 300) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
        }
      }
      // Try the visual "+" buttons
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Add') || ariaLabel.includes('step')) {
          const rect = btn.getBoundingClientRect();
          if (rect.y > 300 && rect.x > 500 && rect.x < 900) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text: ariaLabel };
        }
      }
      return null;
    });

    if (addStepBtn) {
      console.log('Add step:', addStepBtn.text);
      await page.mouse.click(addStepBtn.x, addStepBtn.y);
      await page.waitForTimeout(3000);
    } else {
      // Click the "+" connector between steps
      const plusConnector = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg');
        for (const svg of svgs) {
          const rect = svg.getBoundingClientRect();
          if (rect.y > 300 && rect.y < 500 && rect.x > 600 && rect.x < 700 && rect.width < 40) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });
      if (plusConnector) {
        await page.mouse.click(plusConnector.x, plusConnector.y);
        await page.waitForTimeout(3000);
      }
    }

    await ss(page, 'Z08PL-02-addstep');

    // Now we should see the app picker or a new step panel
    // Search for Planado
    const searchInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const ph = (inp.placeholder || '').toLowerCase();
        if (ph.includes('search') || ph.includes('zoek')) {
          const rect = inp.getBoundingClientRect();
          if (rect.width > 150) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), ph: inp.placeholder };
        }
      }
      return null;
    });

    if (searchInput) {
      console.log('Search input:', searchInput.ph);
      await page.mouse.click(searchInput.x, searchInput.y);
      await page.keyboard.type('Planado');
      await page.waitForTimeout(3000);

      // Click Planado in results
      const planadoResult = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Planado') {
            const rect = el.getBoundingClientRect();
            if (rect.y > 150 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (planadoResult) {
        await page.mouse.click(planadoResult.x, planadoResult.y);
        console.log('  Planado geselecteerd');
        await page.waitForTimeout(5000);
      }
    } else {
      // Maybe we need to click on the new step card first
      console.log('Geen search input, check side panel...');
      // Look for "Choose app" or click on the new step card
      const newStep = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          const text = el.textContent?.trim() || '';
          if (text === 'Action' || text === 'Choose app') {
            const rect = el.getBoundingClientRect();
            if (rect.y > 350) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), text };
          }
        }
        return null;
      });
      if (newStep) {
        await page.mouse.click(newStep.x, newStep.y);
        await page.waitForTimeout(3000);
      }
    }

    await ss(page, 'Z08PL-03-planado');

    // Select "Create Job" event
    const eventDropdown = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        const text = btn.textContent?.trim() || '';
        if (text.includes('Choose an event') || text.includes('Choose event')) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 800) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (eventDropdown) {
      await page.mouse.click(eventDropdown.x, eventDropdown.y);
      await page.waitForTimeout(3000);

      // Search for "Create Job"
      const eventSearch = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.offsetParent === null) continue;
          const ph = (inp.placeholder || '').toLowerCase();
          if (ph.includes('search')) {
            const rect = inp.getBoundingClientRect();
            if (rect.y > 200) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (eventSearch) {
        await page.mouse.click(eventSearch.x, eventSearch.y);
        await page.keyboard.type('Create Job');
        await page.waitForTimeout(2000);
      }

      const createJobOpt = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          if (el.textContent?.trim() === 'Create Job') {
            const rect = el.getBoundingClientRect();
            if (rect.y > 250 && rect.width > 30) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
        return null;
      });

      if (createJobOpt) {
        await page.mouse.click(createJobOpt.x, createJobOpt.y);
        console.log('  ✅ Create Job geselecteerd');
        await page.waitForTimeout(3000);
      }
    }

    // Click Continue past Setup (account should already be connected)
    await page.waitForTimeout(3000);
    const continueBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.offsetParent === null) continue;
        if (btn.textContent?.trim() === 'Continue' && !btn.disabled) {
          const rect = btn.getBoundingClientRect();
          if (rect.x > 850) return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
      return null;
    });

    if (continueBtn) {
      await page.mouse.click(continueBtn.x, continueBtn.y);
      console.log('  Continue (Setup)');
      await page.waitForTimeout(5000);
    }
  }

  await ss(page, 'Z08PL-04-setup');

  // Now click Configure breadcrumb
  await page.mouse.click(1005, 170);
  await page.waitForTimeout(5000);

  await ss(page, 'Z08PL-05-configure');

  // Check if we're on Configure tab
  const configText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Config state:', configText.substring(0, 800));

  // Save session
  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
