const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  console.log('Logging in to Planado...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="text"]', 'daimy@sonty.nl');
  await page.fill('input[type="password"]', '^XU6C&SuS*FFnb');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  console.log('Logged in:', page.url());

  // Go to Inmeet template
  await page.goto('https://sonty.planadoapp.com/admin/templates');
  await page.waitForTimeout(3000);

  // Click on Inmeet afspraak
  await page.click('a:has-text("Inmeet afspraak")');
  await page.waitForTimeout(3000);
  console.log('Opened Inmeet template');
  await page.screenshot({ path: '/tmp/inmeet-01-opened.png', fullPage: true });

  // Step 1: Delete all existing English report fields
  console.log('\n=== Deleting English report fields ===');

  // Count trash buttons in the report section
  let trashButtons = await page.$$('button[class*="delete"], [class*="trash"], [class*="remove"]');
  console.log(`Found ${trashButtons.length} delete buttons`);

  // The trash icons are in the Opdrachtrapport section - they look like 🗑 icons
  // Let's find all the delete/trash buttons near the report fields
  const allTrashIcons = await page.$$('[class*="bin"], [class*="trash"], [class*="delete"], button[title*="Verwijder"], button[title*="Delete"]');
  console.log(`Found ${allTrashIcons.length} trash icons total`);

  // Let's try clicking the trash icon buttons (they appear as 🗑️)
  // First, let's identify them by looking at the page structure
  const reportSection = await page.$('text=Opdrachtrapport');
  if (reportSection) {
    console.log('Found Opdrachtrapport section');
  }

  // Delete existing fields one by one (there are 5 English fields)
  for (let i = 0; i < 5; i++) {
    // Find trash/delete buttons in the report area
    // They're the small trash icon buttons next to each field
    const deleteBtn = await page.$('.report-fields button[class*="delete"], .report-fields [class*="trash"], .report-fields button[class*="remove"]');
    if (deleteBtn) {
      await deleteBtn.click();
      await page.waitForTimeout(500);
      // Confirm deletion if dialog appears
      const confirmBtn = await page.$('button:has-text("OK"), button:has-text("Ja"), button:has-text("Bevestigen"), button:has-text("Verwijderen")');
      if (confirmBtn) await confirmBtn.click();
      await page.waitForTimeout(500);
      console.log(`Deleted field ${i + 1}`);
    } else {
      // Try alternative: the trash icons might be rendered differently
      // Look for any clickable trash-like element
      const trashIcon = await page.locator('button:near(:text("Opdrachtrapport"))').first();
      console.log(`Could not find delete button for field ${i + 1}, trying alternative approach`);
      break;
    }
  }

  await page.screenshot({ path: '/tmp/inmeet-02-after-delete-attempt.png', fullPage: true });

  // Let's take a different approach - look at all interactive elements in the report section
  const reportElements = await page.$$eval('*', els => {
    const reportHeader = els.find(e => e.textContent?.trim() === 'Opdrachtrapport');
    if (!reportHeader) return [];

    // Get all elements after the report header
    const allEls = [];
    let found = false;
    for (const el of els) {
      if (el === reportHeader) { found = true; continue; }
      if (found && el.tagName === 'BUTTON') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          allEls.push({
            text: el.textContent?.trim()?.substring(0, 50),
            className: el.className?.substring(0, 80),
            title: el.title,
            ariaLabel: el.getAttribute('aria-label'),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
          });
        }
      }
      // Stop when we hit Diensten section
      if (found && el.textContent?.trim() === 'Diensten') break;
    }
    return allEls;
  });
  console.log('\nButtons near Opdrachtrapport:');
  reportElements.forEach(e => console.log(`  [${e.w}x${e.h}] at (${e.x},${e.y}) "${e.text}" class="${e.className}" title="${e.title}"`));

  // Also look for SVG trash icons which are common
  const svgButtons = await page.$$eval('button svg, button img, a svg', els =>
    els.map(e => {
      const btn = e.closest('button') || e.closest('a');
      const rect = btn?.getBoundingClientRect();
      return {
        tag: btn?.tagName,
        text: btn?.textContent?.trim()?.substring(0, 30),
        className: btn?.className?.substring(0, 60),
        y: Math.round(rect?.y || 0),
        w: Math.round(rect?.width || 0)
      };
    }).filter(e => e.y > 400 && e.y < 800 && e.w > 0 && e.w < 60) // In the report section area
  );
  console.log('\nSmall SVG buttons in report area:');
  svgButtons.forEach(e => console.log(`  y=${e.y} [${e.tag}] "${e.text}" class="${e.className}"`));

  // Get all input/text fields visible to understand the current structure
  const allInputs = await page.$$eval('input[type="text"], input:not([type]), textarea', els =>
    els.map(e => {
      const rect = e.getBoundingClientRect();
      return {
        value: e.value?.substring(0, 50),
        placeholder: e.placeholder?.substring(0, 50),
        name: e.name,
        y: Math.round(rect.y),
        visible: rect.width > 0
      };
    }).filter(e => e.visible)
  );
  console.log('\nAll text inputs:');
  allInputs.forEach(e => console.log(`  y=${e.y} value="${e.value}" placeholder="${e.placeholder}" name="${e.name}"`));

  await browser.close();
  console.log('\nDone - check screenshots for visual reference');
})().catch(err => console.error('Error:', err.message));
