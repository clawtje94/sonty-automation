/**
 * Sonty Auto-Sync Daemon
 *
 * Periodically syncs:
 * 1. Outlook calendar → Planado jobs (new events)
 * 2. New Planado user activations → set shifts + assign jobs
 * 3. Nmbrs verlof → Planado shifts (working: false)
 *
 * Run: node scripts/auto-sync.js
 * Or via cron: every 30 minutes
 *
 * SAFE: No client notifications, read-only from Outlook/Nmbrs
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'auto-sync-state.json');
const LOG_FILE = path.join(DATA_DIR, 'auto-sync.log');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return { knownUsers: [], syncedEventIds: {}, lastOutlookSync: null, lastShiftSync: null }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Nmbrs rosters (hours per day [ma-vr])
const ROSTERS = {
  'Sjoerd Hoogduin': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Jorren Plugge': { hours: [7.6, 7.6, 7.6, 7.6, 7.6], start: '07:00' },
  'Marvin Vrij': { hours: [8, 8, 8, 8, 8], start: '07:00' },
  'Mick Mulders': { hours: [7.6, 7.6, 7.6, 7.6, 7.6], start: '07:00' },
  'Tygo Krikke': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Kevin Gibson': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Nick Huizer': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Yudi den Heijer': { hours: [8, 8, 8, 8, 8], start: '07:00' },
  'Nanny van Vliet - Kester': { hours: [8, 8, 8, 8, 0], start: '08:00' },
  'Joey Engelen': { hours: [8, 8, 8, 8, 8], start: '08:00' },
};

// Outlook attendee email → Planado team name
const ATTENDEE_TO_TEAM = {
  'yudi@sonty.nl': 'Yudi / Nick',       // Team not yet created (Yudi pending)
  'mick@sonty.nl': 'Mick / Tygo',
  'marvin@sonty.nl': 'Marvin / Kevin',   // Team not yet created (Marvin pending)
  'sjoerd@sonty.nl': 'Sjoerd',
  'nanny@sonty.nl': 'Nanny',
  'jaimy@sonty.nl': 'Jaimy',
  'joey@sonty.nl': 'Joey',
  'nick@sonty.nl': 'Yudi / Nick',       // Nick hoort bij Yudi (team pending)
  'kevin@sonty.nl': 'Marvin / Kevin',   // Kevin hoort bij Marvin (team pending)
  'gibson.k.j@hotmail.com': 'Marvin / Kevin',
  'tygo@sonty.nl': 'Mick / Tygo',
  'tygokrikke@hotmail.com': 'Mick / Tygo',
  'jorren@sonty.nl': 'Jorren',          // Solo team
};

// Calendars to sync from (only shared calendar, not personal ones to avoid duplicates)
const SYNC_CALENDARS = ['Sonty Montage'];

// Calendars to check for blocked/unavailable events (personal calendars)
const BLOCKED_CALENDARS = {
  'Sjoerd Hoogduin | Sonty': 'Sjoerd Hoogduin',
  'Nanny van Vliet | Sonty': 'Nanny van Vliet - Kester',
  'Jaimy de Wit | Sonty': 'Jaimy de Wit',
  'Yudi den Heijer  Sonty Montage': 'Yudi den Heijer',
};

// Default durations based on appointment type (from product-tijden.json analysis)
function getDefaultDuration(subject) {
  const s = (subject || '').toLowerCase();
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

// ── Step 1: Check for new Planado user activations ──
async function checkNewActivations(state) {
  log('Step 1: Checking new user activations...');

  const res = await fetch(`${PLANADO_API}/users`, {
    headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
  });
  const data = await res.json();
  const currentUsers = (data.users || []).map(u => ({
    name: `${u.first_name} ${u.last_name}`,
    uuid: u.uuid,
    email: u.email,
  }));

  const knownNames = state.knownUsers.map(u => u.name);
  const newUsers = currentUsers.filter(u => !knownNames.includes(u.name));

  if (newUsers.length > 0) {
    log(`  New activations: ${newUsers.map(u => u.name).join(', ')}`);

    for (const user of newUsers) {
      // Set up shifts for new user
      const roster = ROSTERS[user.name];
      if (roster) {
        await setupShifts(user.uuid, user.name, roster);
      }

      // Fix permissions (allow completing jobs)
      await sleep(1500);
      await fetch(`${PLANADO_API}/users/${user.uuid}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: { mobile: { login: true, jobs: { view: true, complete: true, create: false } } }
        }),
      });
      log(`  Permissions fixed for ${user.name}`);
    }

    // Re-assign unassigned jobs
    await assignUnassignedJobs(currentUsers);
  } else {
    log('  No new activations');
  }

  state.knownUsers = currentUsers;
  return newUsers;
}

// ── Step 2: Sync new Outlook events ──
async function syncOutlookEvents(state) {
  log('Step 2: Syncing Outlook events...');

  // Pre-fetch all Planado users + teams for mapping
  const allUsersRes = await fetch(`${PLANADO_API}/users`, {
    headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
  });
  const allUsers = (await allUsersRes.json()).users || [];

  const allTeamsRes = await fetch(`${PLANADO_API}/teams`, {
    headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
  });
  const allTeams = (await allTeamsRes.json()).teams || [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Get Outlook token
    let token = null;
    page.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth?.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
        const t = auth.replace('Bearer ', '');
        // Check if it has Calendar scope
        try {
          const payload = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          const decoded = Buffer.from(payload, 'base64').toString();
          if (decoded.includes('Calendar')) token = t;
        } catch (e) {}
      }
    });

    await page.goto('https://outlook.office.com/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
    if (emailInput) {
      await emailInput.fill('joey@sontymontage.nl');
      await page.locator('input[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      const pwInput = await page.$('input[type="password"]');
      if (pwInput) {
        await pwInput.fill('Shja..59');
        await page.locator('input[type="submit"]').click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
      try {
        const yesBtn = page.locator('input[value="Yes"], input[value="Ja"]');
        if (await yesBtn.first().isVisible({ timeout: 5000 })) {
          await yesBtn.first().click();
          await page.waitForTimeout(5000);
        }
      } catch (e) {}
    }

    await page.waitForTimeout(8000);
    await browser.close();
    browser = null;

    if (!token) {
      log('  Could not get Outlook token');
      return 0;
    }

    // Fetch events from today + 4 weeks
    const now = new Date();
    const futureDate = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Prefer': 'outlook.timezone="Europe/Amsterdam"'
    };

    // Get all calendars
    const calsRes = await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers });
    const calsData = await calsRes.json();

    let newEvents = 0;
    for (const cal of calsData.value || []) {
      if (cal.Name.includes('Feestdag') || cal.Name.includes('Verjaardag') || cal.Name.toLowerCase().includes('holiday')) continue;

      const isSyncCal = SYNC_CALENDARS.includes(cal.Name);
      const blockedWorkerName = BLOCKED_CALENDARS[cal.Name];

      // Skip calendars that are neither sync nor blocked calendars
      if (!isSyncCal && !blockedWorkerName) continue;

      const selectFields = isSyncCal
        ? 'Subject,Start,End,Attendees,Location,Id,IsCancelled'
        : 'Subject,Start,End,Id,IsCancelled';

      const url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=200&$select=${selectFields}&startDateTime=${now.toISOString()}&endDateTime=${futureDate.toISOString()}`;
      const evRes = await fetch(url, { headers });
      const evData = await evRes.json();

      for (const ev of evData.value || []) {
        const eventId = ev.Id || '';
        const externalId = `outlook-${eventId.substring(eventId.length - 40)}`;

        if (state.syncedEventIds[externalId]) continue;

        const subject = ev.Subject || '';
        if (!subject || subject === 'Sonty Montage') continue;

        const subjectLower = subject.toLowerCase();
        if (subjectLower.startsWith('canceled:') || subjectLower.startsWith('geannuleerd:')) {
          state.syncedEventIds[externalId] = true;
          continue;
        }

        // Check for blocked/unavailable events (from personal calendars)
        const BLOCKED_KEYWORDS = ['vakantie', 'vrij', 'niet inplannen', 'niet plannen', 'tandarts', 'dokter', 'ziek', 'verlof', 'afwezig', 'niet beschikbaar'];
        const isBlocked = BLOCKED_KEYWORDS.some(kw => subjectLower.includes(kw));

        if (isBlocked && blockedWorkerName) {
          const worker = allUsers.find(u => `${u.first_name} ${u.last_name}` === blockedWorkerName);
          if (worker && ev.Start?.DateTime && ev.End?.DateTime) {
            const startDate = ev.Start.DateTime.substring(0, 10);
            const endDate = ev.End.DateTime.substring(0, 10);
            log(`  Blocked: ${blockedWorkerName} - ${subject} (${startDate})`);
            const start = new Date(startDate);
            const end = new Date(endDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().substring(0, 10);
              try {
                await fetch(`${PLANADO_API}/users/${worker.uuid}/shifts/${dateStr}`, {
                  method: 'PATCH',
                  headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ working: false }),
                });
                await sleep(300);
              } catch (e) {}
            }
          }
          state.syncedEventIds[externalId] = true;
          continue;
        }

        // Only create jobs from SYNC_CALENDARS (Sonty Montage)
        if (!isSyncCal) {
          state.syncedEventIds[externalId] = true;
          continue;
        }

        // Skip blocked events in sync calendar too
        if (isBlocked) {
          state.syncedEventIds[externalId] = true;
          continue;
        }

        const loc = typeof ev.Location === 'string' ? ev.Location : (ev.Location?.DisplayName || '');
        const address = (loc && loc.length > 5 && !loc.includes('Frijdastraat')) ? { formatted: loc } : undefined;

        // Use product-based duration (more accurate than Outlook duration)
        const defaultMins = getDefaultDuration(subject);

        const jobData = {
          external_id: externalId,
          description: subject,
          scheduled_duration: { minutes: defaultMins },
        };
        if (ev.Start?.DateTime) jobData.scheduled_at = ev.Start.DateTime;

        // Use Outlook duration only if it's reasonable (>= 30 min), otherwise use product default
        if (ev.Start?.DateTime && ev.End?.DateTime) {
          const outlookMins = Math.round((new Date(ev.End.DateTime) - new Date(ev.Start.DateTime)) / 60000);
          if (outlookMins >= 30 && outlookMins < 1440) {
            jobData.scheduled_duration = { minutes: outlookMins };
          }
        }

        if (address) jobData.address = address;

        // Map worker from attendees → team assignment
        const attendees = ev.Attendees || [];
        let assignedTeamUuid = null;
        for (const att of attendees) {
          const email = (att.EmailAddress?.Address || '').toLowerCase();
          const teamName = ATTENDEE_TO_TEAM[email];
          if (teamName) {
            // Find team UUID from allTeams
            const team = allTeams.find(t => t.name === teamName);
            if (team) {
              assignedTeamUuid = team.uuid;
              break;
            }
          }
        }
        if (assignedTeamUuid) {
          jobData.assignee = { team: { uuid: assignedTeamUuid } };
        }

        await sleep(2000);
        const createRes = await fetch(`${PLANADO_API}/jobs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PLANADO_KEY}`,
            'Content-Type': 'application/json',
            'X-Planado-Notify-Assignees': 'false',
          },
          body: JSON.stringify(jobData),
        });

        const text = await createRes.text();
        let result;
        try { result = JSON.parse(text); } catch (e) { continue; }

        if (createRes.ok) {
          state.syncedEventIds[externalId] = true;
          newEvents++;

          // Planado ignores scheduled_duration + assignee on create — must PATCH separately
          const jobUuid = result.job_uuid;
          if (jobUuid) {
            const patchData = { version: 1 };
            if (jobData.scheduled_duration) {
              patchData.scheduled_duration = { minutes: jobData.scheduled_duration.minutes || 60 };
            }
            if (assignedTeamUuid) {
              patchData.assignee = { team: { uuid: assignedTeamUuid } };
            }
            await sleep(500);
            await fetch(`${PLANADO_API}/jobs/${jobUuid}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${PLANADO_KEY}`,
                'Content-Type': 'application/json',
                'X-Planado-Notify-Assignees': 'false',
              },
              body: JSON.stringify(patchData),
            });
          }
        } else if (result.errors?.external_id?.includes('is used by another entity')) {
          state.syncedEventIds[externalId] = true;
        }
      }
    }

    log(`  Synced ${newEvents} new events`);
    state.lastOutlookSync = now.toISOString();
    return newEvents;

  } catch (err) {
    log(`  Outlook sync error: ${err.message}`);
    if (browser) await browser.close();
    return 0;
  }
}

// ── Helpers ──
async function setupShifts(uuid, name, roster, weeksAhead = 6) {
  log(`  Setting shifts for ${name}...`);
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  let created = 0;
  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() + w * 7);

    const shifts = [];
    for (let d = 0; d < 5; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const hours = roster.hours[d];
      if (hours > 0) {
        const [startH, startM] = roster.start.split(':').map(Number);
        const endMins = Math.round(startH * 60 + startM + hours * 60);
        const rounded = Math.round(endMins / 15) * 15;
        shifts.push({
          time_from: `${dateStr}T${roster.start}:00+01:00`,
          time_to: `${dateStr}T${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}:00+01:00`,
          working: true,
        });
      }
    }

    if (shifts.length === 0) continue;
    await sleep(1500);
    const res = await fetch(`${PLANADO_API}/users/${uuid}/shifts`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shifts }),
    });
    if (res.status === 204) created += shifts.length;
  }
  log(`    ${created} shifts created`);
}

async function assignUnassignedJobs(activeUsers) {
  log('  Assigning unassigned jobs...');
  const workers = {};
  for (const u of activeUsers) workers[u.name] = u.uuid;

  // Load event → calendar mapping
  let eventCalMap = {};
  try {
    const events = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'outlook-all-events.json'), 'utf8'));
    for (const ev of events) {
      const eventId = ev.Id || '';
      const externalId = `outlook-${eventId.substring(eventId.length - 40)}`;
      eventCalMap[externalId] = ev._calendar;
    }
  } catch (e) {}

  // Get all unassigned jobs
  let jobs = [];
  let cursor = null;
  while (true) {
    await sleep(1000);
    const url = cursor ? `${PLANADO_API}/jobs?after=${cursor}` : `${PLANADO_API}/jobs`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' } });
    const data = await res.json();
    const batch = data.jobs || [];
    if (batch.length === 0) break;
    jobs = jobs.concat(batch);
    cursor = batch[batch.length - 1].uuid;
  }

  let assigned = 0;
  for (const job of jobs) {
    if (job.assignee) continue;
    const cal = eventCalMap[job.external_id];
    if (!cal) continue;
    const workerName = CAL_WORKER_MAP[cal];
    if (!workerName || !workers[workerName]) continue;

    await sleep(2000);
    const res = await fetch(`${PLANADO_API}/jobs/${job.uuid}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${PLANADO_KEY}`,
        'Content-Type': 'application/json',
        'X-Planado-Notify-Assignees': 'false',
      },
      body: JSON.stringify({ assignee: { worker: { uuid: workers[workerName] } } }),
    });
    if (res.ok) assigned++;
  }
  log(`  Assigned ${assigned} jobs`);
}

// ── Main ──
async function main() {
  log('=== Sonty Auto-Sync ===');
  const state = loadState();

  // Step 1: Check activations
  const newUsers = await checkNewActivations(state);

  // Step 2: Sync Outlook events
  const newEvents = await syncOutlookEvents(state);

  // Save state
  saveState(state);

  log(`Done. New users: ${newUsers.length}, New events: ${newEvents}`);

  // Send Telegram notification if anything changed
  if (newUsers.length > 0 || newEvents > 0) {
    const msg = [];
    if (newUsers.length > 0) msg.push(`Nieuwe activaties: ${newUsers.map(u => u.name).join(', ')}`);
    if (newEvents > 0) msg.push(`${newEvents} nieuwe Outlook events gesynced`);

    await fetch(`https://api.telegram.org/bot8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: `🔄 Auto-sync update:\n${msg.join('\n')}` }),
    });
  }
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
