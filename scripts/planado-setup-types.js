/**
 * Set up Planado job types, skills and territories via Playwright
 * (API is read-only for these)
 */
const { chromium } = require('playwright');

const JOB_TYPES = ['Opmeting', 'Montage', 'Service', 'Reparatie'];
const SKILLS = ['Zonwering buiten', 'Raamdeco binnen', 'Rolluiken', 'Screens', 'Pergola', 'Markiezen'];

async function login(page) {
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then(c => c.newPage());

  try {
    await login(page);
    console.log('Logged in');

    // ── Job Types ──
    console.log('\n1. Job Types...');
    await page.goto('https://sonty.planadoapp.com/admin/job-types');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const existingTypes = await page.evaluate(() =>
      [...document.querySelectorAll('table td a, .list-item a')].map(a => a.textContent.trim())
    );
    console.log('   Existing:', existingTypes.join(', ') || 'none');

    for (const typeName of JOB_TYPES) {
      if (existingTypes.some(t => t.toLowerCase() === typeName.toLowerCase())) {
        console.log(`   Skip: ${typeName} (exists)`);
        continue;
      }

      try {
        // Look for add button
        const addBtn = page.locator('a:has-text("Toevoegen"), button:has-text("Toevoegen"), a:has-text("nieuw"), button:has-text("Type toevoegen")').first();
        if (await addBtn.isVisible({ timeout: 2000 })) {
          await addBtn.click();
          await page.waitForTimeout(1500);

          // Fill name field
          const nameInput = page.locator('input[type="text"]').first();
          await nameInput.fill(typeName);

          // Save
          const saveBtn = page.locator('button:has-text("Opslaan"), button:has-text("Aanmaken"), button.btn-primary').first();
          await saveBtn.click();
          await page.waitForTimeout(2000);
          console.log(`   OK: ${typeName}`);

          // Go back to list
          await page.goto('https://sonty.planadoapp.com/admin/job-types');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log(`   FAIL: ${typeName} — ${e.message.substring(0, 60)}`);
      }
    }

    // ── Skills ──
    console.log('\n2. Skills...');
    await page.goto('https://sonty.planadoapp.com/admin/skills');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-skills.png' });

    const existingSkills = await page.evaluate(() =>
      [...document.querySelectorAll('table td a, .list-item a, td')].map(a => a.textContent.trim()).filter(t => t.length > 2)
    );
    console.log('   Existing:', existingSkills.join(', ') || 'none');

    for (const skill of SKILLS) {
      if (existingSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
        console.log(`   Skip: ${skill} (exists)`);
        continue;
      }

      try {
        const addBtn = page.locator('a:has-text("Toevoegen"), button:has-text("Toevoegen"), a:has-text("Vaardigheid toevoegen")').first();
        if (await addBtn.isVisible({ timeout: 2000 })) {
          await addBtn.click();
          await page.waitForTimeout(1500);

          const nameInput = page.locator('input[type="text"]').first();
          await nameInput.fill(skill);

          const saveBtn = page.locator('button:has-text("Opslaan"), button:has-text("Aanmaken"), button.btn-primary').first();
          await saveBtn.click();
          await page.waitForTimeout(2000);
          console.log(`   OK: ${skill}`);

          await page.goto('https://sonty.planadoapp.com/admin/skills');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.log(`   FAIL: ${skill} — ${e.message.substring(0, 60)}`);
      }
    }

    // ── Screenshot final state ──
    await page.goto('https://sonty.planadoapp.com/admin/job-types');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-jobtypes-final.png' });

    await page.goto('https://sonty.planadoapp.com/admin/skills');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/planado-skills-final.png' });

    console.log('\nDone');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/planado-error.png' });
  }

  await browser.close();
}

main().catch(console.error);
