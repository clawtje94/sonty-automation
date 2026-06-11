/**
 * Nmbrs diensten/beschikbaarheid export
 * Haalt rooster + verlof op voor alle medewerkers, meerdere maanden
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'nmbrs-beschikbaarheid.json');

async function login(page) {
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
}

async function scrapeCalendarMonth(page, year, monthIndex) {
  // monthIndex: 0-based (0=jan)
  const monthNames = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const monthName = monthNames[monthIndex];

  console.log(`  Scraping ${monthName} ${year}...`);

  // Navigate to Kalender
  await page.click('text=Kalender');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // The calendar shows current month by default
  // We need to navigate to the right month using the arrows
  // First check what month is currently displayed
  const currentMonthText = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/(Januari|Februari|Maart|April|Mei|Juni|Juli|Augustus|September|Oktober|November|December)\s+(\d{4})/i);
    return match ? { month: match[1].toLowerCase(), year: parseInt(match[2]) } : null;
  });

  if (currentMonthText) {
    const currentIdx = monthNames.indexOf(currentMonthText.month);
    const targetIdx = monthIndex;
    const currentYear = currentMonthText.year;

    // Calculate how many months to navigate
    const diff = (year * 12 + targetIdx) - (currentYear * 12 + currentIdx);

    if (diff !== 0) {
      // Click forward or back arrow
      const arrowSelector = diff > 0 ? 'text=▶' : 'text=◀';
      const altArrowSelector = diff > 0 ? '[class*="next"], [class*="forward"]' : '[class*="prev"], [class*="back"]';

      for (let i = 0; i < Math.abs(diff); i++) {
        try {
          // Try clicking the navigation arrows near the month title
          const arrows = await page.$$('a, button, span');
          for (const arrow of arrows) {
            const text = await arrow.textContent();
            if ((diff > 0 && text.trim() === '›') || (diff > 0 && text.trim() === '▶') ||
                (diff < 0 && text.trim() === '‹') || (diff < 0 && text.trim() === '◀')) {
              await arrow.click();
              await page.waitForTimeout(1000);
              break;
            }
          }
        } catch (e) {}
      }
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/nmbrs-cal-${monthName}.png` });

  // Scrape the calendar table
  const calendarData = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n');

    // Find the calendar header and data rows
    const result = { month: '', employees: [] };

    // Find month title
    const monthMatch = text.match(/(Januari|Februari|Maart|April|Mei|Juni|Juli|Augustus|September|Oktober|November|December)\s+(\d{4})/i);
    if (monthMatch) result.month = `${monthMatch[1]} ${monthMatch[2]}`;

    return result;
  });

  // Better approach: get the full page text and parse the calendar structure
  const fullText = await page.evaluate(() => document.body.innerText);

  return { month: `${monthName} ${year}`, rawText: fullText.substring(0, 5000) };
}

async function scrapeVerlofoverzicht(page, year, monthName) {
  console.log(`  Scraping verlofoverzicht ${monthName} ${year}...`);

  await page.click('text=Overzichten');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await page.click('text=Verlofoverzicht');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Change year and month dropdowns
  try {
    const yearSelect = page.locator('select').first();
    await yearSelect.selectOption(String(year));
    await page.waitForTimeout(1000);

    const monthSelect = page.locator('select').nth(1);
    await monthSelect.selectOption({ label: monthName });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log(`    Could not change to ${monthName} ${year}: ${e.message.substring(0, 50)}`);
  }

  await page.screenshot({ path: `/tmp/nmbrs-verlof-${monthName}.png` });

  // Scrape the verlof table
  const verlofText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  return verlofText;
}

async function scrapeVerlofsaldo(page) {
  console.log('  Scraping verlofsaldo...');

  await page.click('text=Overzichten');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  try {
    await page.click('text=Verlofsaldo');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/nmbrs-verlofsaldo.png' });

    const saldoText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    return saldoText;
  } catch (e) {
    console.log('    Verlofsaldo niet gevonden');
    return null;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Login to Nmbrs...');
    await login(page);
    console.log('   OK');

    const data = {
      scraped_at: new Date().toISOString(),
      calendars: {},
      verlof: {},
      verlofsaldo: null,
    };

    // Scrape calendar for march, april, may 2026
    console.log('\n2. Kalender per maand...');
    for (const [year, monthIdx, name] of [[2026, 2, 'maart'], [2026, 3, 'april'], [2026, 4, 'mei']]) {
      const calData = await scrapeCalendarMonth(page, year, monthIdx);
      data.calendars[name] = calData;
    }

    // Scrape verlofoverzicht
    console.log('\n3. Verlofoverzicht per maand...');
    for (const month of ['maart', 'april', 'mei']) {
      const verlof = await scrapeVerlofoverzicht(page, 2026, month);
      data.verlof[month] = verlof;
    }

    // Scrape verlofsaldo
    console.log('\n4. Verlofsaldo...');
    data.verlofsaldo = await scrapeVerlofsaldo(page);

    // Save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`\nData opgeslagen: ${OUTPUT_FILE}`);

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/nmbrs-error.png' });
  }

  await browser.close();
})();
