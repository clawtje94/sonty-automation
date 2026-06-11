const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('1. Login...');
    await page.goto('https://maasaccountants.nmbrs.nl/');
    await page.waitForLoadState('networkidle');
    try { await page.locator('button:has-text("Accept All")').click({ timeout: 3000 }); } catch (e) {}
    await page.fill('#Username', 'daimy@sonty.nl');
    await page.click('#LoginButton');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await pw.fill('k4Fb8cS4Rs^@!q');
      const sub = await page.$('input[type="submit"], button[type="submit"]');
      if (sub) await sub.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    try { await page.locator('text=Herinner me later').click({ timeout: 3000 }); } catch (e) {}
    await page.waitForTimeout(2000);

    const data = { employees: [], calendar: {}, leave: [] };

    // Get employee list from Medewerkers page
    console.log('2. Scraping employees...');
    await page.click('text=Medewerkers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Get full page HTML structure for employee data
    const empData = await page.evaluate(() => {
      const rows = document.querySelectorAll('.content-area tr, .employee-row, [class*="list"] [class*="item"]');
      const results = [];
      rows.forEach(row => {
        const text = row.textContent.trim();
        if (text.length > 2) results.push(text.replace(/\s+/g, ' '));
      });

      // Also try getting from the visible table-like structure
      const allText = document.body.innerText;
      return { rows: results, fullText: allText.substring(0, 5000) };
    });

    console.log('   Employee page text (first 2000 chars):');
    console.log(empData.fullText.substring(0, 2000));

    // Kalender - scrape for multiple months
    for (const month of ['maart', 'april', 'mei']) {
      console.log(`\n3. Scraping kalender ${month} 2026...`);
      await page.click('text=Kalender');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Navigate to the right month if needed
      if (month !== 'maart') {
        await page.click('text=▶'); // next month arrow
        await page.waitForTimeout(2000);
        if (month === 'mei') {
          await page.click('text=▶');
          await page.waitForTimeout(2000);
        }
      }

      // Scrape calendar data
      const calData = await page.evaluate(() => {
        const rows = [];
        // Get all calendar rows
        const trs = document.querySelectorAll('table tr, .calendar-row, [class*="kalender"] tr');
        trs.forEach(tr => {
          const cells = tr.querySelectorAll('td, th');
          const rowData = [];
          cells.forEach(cell => {
            const text = cell.textContent.trim();
            const bg = window.getComputedStyle(cell).backgroundColor;
            const cls = cell.className;
            rowData.push({ text, bg, cls: cls.substring(0, 50) });
          });
          if (rowData.length > 0) rows.push(rowData);
        });

        // Also get the full visible text
        const bodyText = document.body.innerText;
        return { rows, text: bodyText.substring(0, 3000) };
      });

      console.log(`   Calendar text:`);
      console.log(calData.text.substring(0, 1500));
    }

    // Verlofoverzicht for current and next months
    console.log('\n4. Scraping verlofoverzicht...');
    await page.click('text=Overzichten');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.click('text=Verlofoverzicht');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Scrape verlof data
    const verlofData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.substring(0, 3000);
    });
    console.log('   Verlofoverzicht:');
    console.log(verlofData.substring(0, 2000));

    // Check April and May verlof too
    for (const month of ['april', 'mei']) {
      console.log(`\n5. Verlofoverzicht ${month}...`);
      try {
        // Change month dropdown
        await page.selectOption('select:near(:text("maart"))', { label: month });
        await page.waitForTimeout(2000);
        const vData = await page.evaluate(() => document.body.innerText.substring(0, 2000));
        console.log(vData.substring(0, 1000));
      } catch (e) {
        console.log('   Error changing month:', e.message.substring(0, 100));
      }
    }

    // Verlofsaldo
    console.log('\n6. Verlofsaldo...');
    await page.click('text=Overzichten');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    try {
      await page.click('text=Verlofsaldo');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/nmbrs-verlofsaldo.png' });
      const saldoData = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      console.log('   Verlofsaldo:');
      console.log(saldoData.substring(0, 2000));
    } catch (e) {
      console.log('   Error:', e.message.substring(0, 100));
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/nmbrs-error.png' });
  }

  await browser.close();
})();
