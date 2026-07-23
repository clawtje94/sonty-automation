/**
 * Scrape all Planado job UUIDs via the web UI, then fix durations + assign workers via API.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

const CAL_WORKER_MAP = {
  'Sjoerd Hoogduin': 'Sjoerd Hoogduin',
  'Sjoerd': 'Sjoerd Hoogduin',
  'Nanny van Vliet': 'Nanny van Vliet - Kester',
  'Nanny': 'Nanny van Vliet - Kester',
  'Jaimy de Wit': 'Jaimy de Wit',
  'Jaimy': 'Jaimy de Wit',
  'Yudi den Heijer': 'Yudi den Heijer',
  'Yudi': 'Yudi den Heijer',
};

function classifyDuration(desc) {
  const s = (desc || '').toLowerCase();
  if (s.includes('inmeten') || s.includes('inmeet') || s.includes('opmeting')) return 60;
  if (s.includes('pergola')) return 480;
  if (s.includes('markies') || s.includes('knikarm')) return 240;
  if (s.includes('screen')) return 150;
  if (s.includes('rolluik')) return 180;
  if (s.includes('behang')) return 240;
  if (s.includes('shutter')) return 120;
  if (s.includes('montage') || s.includes('installatie')) return 120;
  if (s.includes('showroom') || s.includes('winkel')) return 60;
  if (s.includes('service') || s.includes('reparatie')) return 60;
  return 60;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('=== Planado Job Scraper + Fixer ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept API calls to capture job data
  const allJobUuids = new Set();

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') && url.includes('jobs') && response.status() === 200) {
      try {
        const data = await response.json();
        const jobs = data.jobs || data.data || [];
        if (Array.isArray(jobs)) {
          for (const j of jobs) {
            if (j.uuid) allJobUuids.add(j.uuid);
            if (j.id) allJobUuids.add(String(j.id));
          }
        }
      } catch (e) {}
    }
  });

  // Login
  console.log('1. Login...');
  await page.goto('https://sonty.planadoapp.com/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="E-mail"]', 'daimy@sonty.nl');
  await page.fill('input[placeholder="Wachtwoord"]', '^XU6C&SuS*FFnb');
  await page.locator('button:has-text("Inloggen")').click();
  await page.waitForTimeout(5000);

  // Go to jobs list
  console.log('2. Loading jobs list...');
  await page.goto('https://sonty.planadoapp.com/jobs');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Scrape job links from the page
  let jobUuids = new Set();

  // Get all job links on the page
  const scrapeLinks = async () => {
    const links = await page.$$eval('a[href*="/jobs/"]', els =>
      els.map(a => a.getAttribute('href')).filter(h => h && h.match(/\/jobs\/[0-9a-f-]{36}/))
    );
    for (const link of links) {
      const match = link.match(/\/jobs\/([0-9a-f-]{36})/);
      if (match) jobUuids.add(match[1]);
    }
  };

  await scrapeLinks();
  console.log(`   Found ${jobUuids.size} jobs on first page`);

  // Scroll down to load more jobs (infinite scroll)
  let prevCount = 0;
  let scrollAttempts = 0;
  while (scrollAttempts < 100) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await scrapeLinks();

    if (jobUuids.size === prevCount) {
      scrollAttempts++;
      if (scrollAttempts >= 5) break; // No new jobs after 5 scrolls
    } else {
      scrollAttempts = 0;
      prevCount = jobUuids.size;
      if (jobUuids.size % 50 === 0) console.log(`   ... ${jobUuids.size} jobs found`);
    }
  }

  console.log(`\n3. Total unique job UUIDs: ${jobUuids.size}`);
  await browser.close();

  // Save UUIDs
  const uuidArr = [...jobUuids];
  fs.writeFileSync('data/all-job-uuids.json', JSON.stringify(uuidArr, null, 2));
  console.log('   Saved to data/all-job-uuids.json');

  // Get Planado users for assignment
  const uRes = await fetch(PLANADO_API + '/users', {
    headers: { 'Authorization': 'Bearer ' + PLANADO_KEY, 'Accept': 'application/json' }
  });
  const users = (await uRes.json()).users;
  const userMap = {};
  for (const u of users) userMap[u.first_name + ' ' + u.last_name] = u.uuid;

  // Fix durations and assign workers
  console.log('\n4. Fixing durations + assigning workers...');
  let fixedDur = 0, assignedWorker = 0, alreadyOk = 0, errors = 0;

  for (let i = 0; i < uuidArr.length; i++) {
    try {
      const res = await fetch(PLANADO_API + '/jobs/' + uuidArr[i], {
        headers: { 'Authorization': 'Bearer ' + PLANADO_KEY, 'Accept': 'application/json' }
      });
      if (!res.ok) { errors++; continue; }
      const { job } = await res.json();
      if (!job) { errors++; continue; }

      const desc = job.description || '';
      const dur = job.scheduled_duration;
      const curMin = dur ? (dur.hours || 0) * 60 + (dur.minutes || 0) : 0;
      const targetMin = classifyDuration(desc);

      const patch = {};
      let needsPatch = false;

      // Fix duration
      if (curMin !== targetMin) {
        patch.scheduled_duration = { hours: Math.floor(targetMin / 60), minutes: targetMin % 60 };
        needsPatch = true;
      }

      // Assign worker if missing
      if (!job.assignee) {
        const calMatch = desc.match(/Kalender: (.+)$/m);
        const calName = calMatch ? calMatch[1].trim() : '';
        let workerName = null;
        for (const [cal, worker] of Object.entries(CAL_WORKER_MAP)) {
          if (calName.includes(cal)) { workerName = worker; break; }
        }
        if (workerName && userMap[workerName]) {
          patch.assignee = { worker: { uuid: userMap[workerName] } };
          needsPatch = true;
        }
      }

      if (needsPatch) {
        patch.version = job.version;
        const pRes = await fetch(PLANADO_API + '/jobs/' + uuidArr[i], {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' },
          body: JSON.stringify(patch)
        });
        if (pRes.ok) {
          if (patch.scheduled_duration) fixedDur++;
          if (patch.assignee) assignedWorker++;
        } else errors++;
      } else {
        alreadyOk++;
      }

      if ((i + 1) % 50 === 0) console.log(`   Progress: ${i + 1}/${uuidArr.length} | dur: ${fixedDur} | assigned: ${assignedWorker} | ok: ${alreadyOk}`);
      await sleep(150);
    } catch (e) { errors++; }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Duration fixed: ${fixedDur}`);
  console.log(`Workers assigned: ${assignedWorker}`);
  console.log(`Already OK: ${alreadyOk}`);
  console.log(`Errors: ${errors}`);
})();
