const { chromium } = require('playwright');

const SCREENSHOT_DIR = '/Users/clawdboot/sonty/scripts';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Handle native browser dialogs
  page.on('dialog', async dialog => {
    console.log(`   Native dialog: "${dialog.message()}" — accepting`);
    await dialog.accept();
  });

  try {
    // ── 1. Login ──
    console.log('1. Logging in to Planado...');
    await page.goto('https://sonty.planadoapp.com/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
    await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
    await page.locator('button:has-text("Inloggen")').click();
    await page.waitForTimeout(5000);
    console.log('   Logged in OK');

    // ── 2. Navigate to Diensten > Teams ──
    console.log('\n2. Going to Diensten > Teams...');
    await page.goto('https://sonty.planadoapp.com/shifts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.locator('button:has-text("Teams")').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-01-teams-list.png` });
    console.log('   Teams page loaded');

    // ── 3. Delete "Kevin / Nick" team ──
    console.log('\n3. Deleting team "Kevin / Nick"...');

    // Click the fa-cog icon within the Kevin / Nick row
    const kevinCogClicked = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')];
      const kevinSpan = spans.find(s => s.textContent.trim() === 'Kevin / Nick');
      if (!kevinSpan) return false;
      const nameDiv = kevinSpan.parentElement;
      const cogIcon = nameDiv.querySelector('i.fa-cog');
      if (cogIcon) { cogIcon.click(); return true; }
      return false;
    });
    console.log('   Clicked cog:', kevinCogClicked);
    await page.waitForTimeout(2000);

    // Click "Teaminstellingen" to open the edit modal
    const teamSettingsLink = page.locator('a:has-text("Teaminstellingen")').first();
    await teamSettingsLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-02-kevin-settings.png` });
    console.log('   Kevin / Nick settings modal opened');

    // Click "Verwijderen" (red delete button)
    // Use class-based selector to avoid matching "Opdracht toevoegen"
    const deleteBtn = page.locator('button:has-text("Verwijderen")').first();
    await deleteBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-03-confirm-dialog.png` });
    console.log('   Clicked Verwijderen, confirmation dialog appeared');

    // Click "Ja, verwijderen" to confirm deletion
    const confirmBtn = page.locator('button:has-text("Ja, verwijderen")').first();
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
      console.log('   Confirmed deletion - clicked "Ja, verwijderen"');
    } else {
      console.log('   "Ja, verwijderen" button not found!');
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-04-after-delete.png` });
    console.log('   After delete. URL:', page.url());

    // ── 4. Create "Jorren" team ──
    console.log('\n4. Creating team "Jorren"...');

    // Navigate to new team form via URL
    await page.goto('https://sonty.planadoapp.com/shifts/teams/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-05-new-team-form.png` });
    console.log('   New team form loaded');

    // Fill team name
    const nameInput = page.locator('input.pd-form-control').first();
    await nameInput.fill('Jorren');
    console.log('   Filled team name: Jorren');
    await page.waitForTimeout(500);

    // Select Jorren Plugge in the Medewerkers (Workers) React Select dropdown
    // The React Select has a .Select-control div that we need to click to open
    // Then type to filter, then click the option

    // Click the Medewerkers dropdown container
    // Using evaluate to click the Select-control wrapping #team-workers
    await page.evaluate(() => {
      const input = document.getElementById('team-workers');
      if (!input) return;
      // Traverse up to find the .Select container, then click .Select-control
      let el = input;
      while (el && !el.classList.contains('Select')) {
        el = el.parentElement;
      }
      if (el) {
        const control = el.querySelector('.Select-control');
        if (control) control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    });
    await page.waitForTimeout(1000);

    // Type to search for Jorren
    await page.locator('#team-workers').fill('Jorren', { force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-06-workers-search.png` });

    // Click on the dropdown option
    const jorrenWorkerOpt = page.locator('.Select-option:has-text("Jorren"), [role="option"]:has-text("Jorren"), div[class*="option"]:has-text("Jorren")').first();
    const jwVisible = await jorrenWorkerOpt.isVisible().catch(() => false);
    if (jwVisible) {
      await jorrenWorkerOpt.click();
      console.log('   Selected Jorren Plugge as worker');
    } else {
      // Try alternative: keyboard approach — press Enter on the first option
      console.log('   Trying keyboard approach for Medewerkers...');

      // Focus the input and use keyboard
      await page.evaluate(() => {
        const input = document.getElementById('team-workers');
        if (input) {
          input.focus();
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.waitForTimeout(500);
      await page.keyboard.type('Jorren', { delay: 100 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-06b-workers-typed.png` });

      // Check for visible options again
      const options = await page.$$eval('.Select-option, [class*="Option"]', els =>
        els.map(e => ({ text: e.textContent.trim(), visible: e.offsetParent !== null })).filter(e => e.visible)
      );
      console.log('   Options after typing:', JSON.stringify(options));

      if (options.length > 0) {
        await page.locator('.Select-option').first().click();
        console.log('   Clicked first option');
      } else {
        // Last resort: press Enter/Down+Enter
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        console.log('   Used keyboard Down+Enter');
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-07-form-ready.png` });

    // Click "Toevoegen" button in the modal (not "Opdracht toevoegen" in nav)
    // The form has: "Annuleren" and "Toevoegen" buttons
    // Use a more specific selector to get the form submit button
    const addBtnClicked = await page.evaluate(() => {
      // Find buttons with text "Toevoegen" that are NOT in the nav bar
      const buttons = [...document.querySelectorAll('button')];
      for (const btn of buttons) {
        const text = btn.textContent.trim();
        // The submit button has class btn-primary and text exactly "Toevoegen"
        if (text === 'Toevoegen' && btn.className.includes('btn-primary')) {
          btn.click();
          return true;
        }
      }
      // Fallback: any "Toevoegen" button that's not "Opdracht toevoegen"
      for (const btn of buttons) {
        if (btn.textContent.trim() === 'Toevoegen') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('   Clicked Toevoegen:', addBtnClicked);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-08-after-create.png` });
    console.log('   After create. URL:', page.url());

    // ── 5. Final verification ──
    console.log('\n5. Verification...');
    await page.goto('https://sonty.planadoapp.com/shifts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Teams")').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-09-final.png` });

    const finalBody = await page.textContent('body');
    console.log('   "Kevin / Nick" still present:', finalBody.includes('Kevin / Nick'));
    console.log('   "Jorren" present:', finalBody.includes('Jorren'));

    // Also verify via API
    const teamsApi = await (await fetch('https://api.planadoapp.com/v2/teams', {
      headers: { 'Authorization': 'Bearer b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef', 'Accept': 'application/json' }
    })).json();
    console.log('   API teams:', teamsApi.teams.map(t => t.name));

  } catch (err) {
    console.error('ERROR:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/wf-debug-TEAMS-ERROR.png` }).catch(() => {});
  }

  await browser.close();
  console.log('\nDone.');
})();
