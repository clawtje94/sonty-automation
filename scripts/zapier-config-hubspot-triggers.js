const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ZAPIER_SESSION = path.join(__dirname, 'zapier-session.json');

async function ss(page, name) {
  await page.screenshot({ path: path.join(__dirname, `wf-debug-${name}.png`) });
  console.log(`  📸 ${name}`);
}

// First: find the zap URLs from the zaps list page
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ storageState: ZAPIER_SESSION });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  console.log('🎬 Zap lijst ophalen + HubSpot triggers configureren');

  // Get the zap list to find our zap IDs
  await page.goto('https://zapier.com/app/zaps', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await ss(page, 'TRIG-00-list');

  const zapLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/editor/"]');
    const result = [];
    for (const link of links) {
      const text = link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';
      if (text.length > 3 && text.length < 200) {
        result.push({ text: text.substring(0, 80), href });
      }
    }
    return result;
  });
  console.log('Zap links:', JSON.stringify(zapLinks, null, 2));

  // Also get full text
  const listText = await page.evaluate(() => document.body.innerText.substring(0, 4000));
  console.log('\nList text:', listText.substring(0, 2000));

  // Find zap IDs for our target zaps
  const targetZaps = ['ZAP-05', 'ZAP-06', 'ZAP-08'];
  const zapUrls = {};

  // Also look for href patterns in table rows
  const rows = await page.evaluate(() => {
    const trs = document.querySelectorAll('tr');
    const result = [];
    for (const tr of trs) {
      const text = tr.textContent?.trim() || '';
      const link = tr.querySelector('a[href*="/editor/"]');
      if (link) {
        result.push({ text: text.substring(0, 100), href: link.getAttribute('href') });
      }
    }
    return result;
  });
  console.log('\nTable rows:', JSON.stringify(rows, null, 2));

  for (const row of rows) {
    for (const target of targetZaps) {
      if (row.text.includes(target) && row.href) {
        zapUrls[target] = row.href;
      }
    }
  }
  console.log('\nTarget zap URLs:', JSON.stringify(zapUrls, null, 2));

  // Now configure each zap with HubSpot trigger
  for (const [zapName, zapUrl] of Object.entries(zapUrls)) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔧 ${zapName} trigger configureren`);
    console.log('='.repeat(50));

    const fullUrl = zapUrl.startsWith('http') ? zapUrl : `https://zapier.com${zapUrl}`;
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    const prefix = zapName.replace('-', '');

    // Dismiss popups
    const gotIt = page.locator('button').filter({ hasText: /Got it/i }).first();
    if (await gotIt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gotIt.click();
      await page.waitForTimeout(1000);
    }

    // Double-click on Step 1 to open it
    const step1 = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        if (text === '1.' || text === 'Trigger' || text === 'Select the event that starts your Zap') {
          const rect = el.getBoundingClientRect();
          if (rect.y > 150 && rect.width > 10) {
            return { x: Math.round(rect.x + 50), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (step1) {
      await page.mouse.dblclick(step1.x, step1.y);
      await page.waitForTimeout(5000);
    } else {
      // Click center of the step card area
      await page.mouse.dblclick(660, 275);
      await page.waitForTimeout(5000);
    }

    await ss(page, `${prefix}-01-step-opened`);

    // Check if we need to select app or if it's already in setup
    const panelText = await page.evaluate(() => document.body.innerText.substring(0, 3000));

    if (panelText.includes('HubSpot') && panelText.includes('Updated Deal Stage')) {
      console.log('  Trigger al geconfigureerd!');
      continue;
    }

    // Look for "Choose App" or search input in the side panel
    // The side panel search is different from the main app picker modal
    const searchInput = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        const placeholder = inp.getAttribute('placeholder') || '';
        if (placeholder.includes('Search') || placeholder.includes('search')) {
          const rect = inp.getBoundingClientRect();
          if (rect.x > 800 || rect.width > 200) { // Side panel or large modal
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), placeholder };
          }
        }
      }
      return null;
    });

    if (searchInput) {
      console.log(`  Search input: "${searchInput.placeholder}" at (${searchInput.x}, ${searchInput.y})`);
      await page.mouse.click(searchInput.x, searchInput.y);
      await page.waitForTimeout(500);
      await page.keyboard.type('HubSpot');
      await page.waitForTimeout(3000);
      await ss(page, `${prefix}-02-search`);

      // Click HubSpot - wider y range
      const hubspot = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const text = el.textContent?.trim() || '';
          if (text === 'HubSpot') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 30 && rect.height > 10 && rect.height < 60) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
        return null;
      });

      if (hubspot) {
        await page.mouse.click(hubspot.x, hubspot.y);
        console.log('  HubSpot geselecteerd');
        await page.waitForTimeout(5000);
        await ss(page, `${prefix}-03-hubspot`);

        // Now search for Updated Deal Stage event
        const eventInput = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input');
          for (const inp of inputs) {
            if (inp.offsetParent === null) continue;
            const placeholder = inp.getAttribute('placeholder') || '';
            if (placeholder.includes('Search') || placeholder.includes('search')) {
              const rect = inp.getBoundingClientRect();
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
          return null;
        });

        if (eventInput) {
          await page.mouse.click(eventInput.x, eventInput.y);
          await page.keyboard.type('Updated Deal Stage');
          await page.waitForTimeout(3000);

          const event = await page.evaluate(() => {
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
              const text = el.textContent?.trim() || '';
              if (text.includes('Updated Deal Stage')) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 30 && rect.height > 10) {
                  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
                }
              }
            }
            return null;
          });

          if (event) {
            await page.mouse.click(event.x, event.y);
            console.log('  Updated Deal Stage geselecteerd');
            await page.waitForTimeout(5000);
          }
        }

        // Click Continue buttons (account setup, configure)
        for (let i = 0; i < 3; i++) {
          const btn = page.locator('button').filter({ hasText: /^Continue$/ });
          if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
            const disabled = await btn.evaluate(el => el.disabled).catch(() => true);
            if (!disabled) {
              await btn.click({ force: true });
              console.log(`  Continue ${i + 1}`);
              await page.waitForTimeout(4000);
            } else break;
          } else break;
        }
      }
    } else {
      console.log('  Search input niet gevonden, probeer via modal...');
      // Check if there's a modal with the app picker open already
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
      console.log('  Panel text:', bodyText.substring(0, 500));
    }

    await ss(page, `${prefix}-final`);
    const storageState = await context.storageState();
    fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  }

  if (Object.keys(zapUrls).length === 0) {
    console.log('\n⚠️ Geen target zaps gevonden! Mogelijk zijn ze niet correct aangemaakt.');
    console.log('Bekijk de zaps list screenshot voor details.');
  }

  const storageState = await context.storageState();
  fs.writeFileSync(ZAPIER_SESSION, JSON.stringify(storageState));
  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
})();
