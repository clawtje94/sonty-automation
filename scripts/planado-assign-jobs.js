/**
 * Assign Planado jobs to the right workers based on Outlook calendar mapping
 */
const fs = require('fs');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Outlook calendar → Planado worker mapping
const CAL_WORKER_MAP = {
  'Sjoerd Hoogduin | Sonty': 'Sjoerd Hoogduin',
  'Nanny van Vliet | Sonty': 'Nanny van Vliet - Kester',
  // Yudi, Jaimy = not in Planado as field workers
  // Agenda, Sonty Montage = general, no specific worker
};

async function main() {
  console.log('=== Assign Jobs to Workers ===\n');

  // Get Planado users
  const usersRes = await fetch(`${PLANADO_API}/users`, {
    headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
  });
  const usersData = await usersRes.json();
  const workers = {};
  for (const u of usersData.users || []) {
    workers[`${u.first_name} ${u.last_name}`] = u.uuid;
  }
  console.log('Workers:', Object.keys(workers).join(', '));

  // Get ALL Planado jobs (cursor-based pagination with 'after')
  let jobs = [];
  let afterCursor = null;
  while (true) {
    await sleep(1000);
    const url = afterCursor
      ? `${PLANADO_API}/jobs?after=${afterCursor}`
      : `${PLANADO_API}/jobs`;
    const jobsRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
    });
    const jobsData = await jobsRes.json();
    const batch = jobsData.jobs || [];
    if (batch.length === 0) break;
    jobs = jobs.concat(batch);
    afterCursor = batch[batch.length - 1].uuid;
    console.log(`  Fetched ${batch.length} jobs (total: ${jobs.length})`);
  }
  console.log(`Total jobs in Planado: ${jobs.length}`);

  // Load Outlook events for calendar mapping
  const events = JSON.parse(fs.readFileSync('data/outlook-all-events.json', 'utf8'));

  // Build external_id → calendar mapping
  const eventCalMap = {};
  for (const ev of events) {
    const eventId = ev.Id || '';
    const externalId = `outlook-${eventId.substring(eventId.length - 40)}`;
    eventCalMap[externalId] = ev._calendar;
  }

  let assigned = 0;
  let skipped = 0;
  let errors = 0;

  for (const job of jobs) {
    const extId = job.external_id;
    if (!extId) { skipped++; continue; }

    // Already has assignee?
    if (job.assignee) { skipped++; continue; }

    // Find calendar from external_id
    const calendar = eventCalMap[extId];
    if (!calendar) { skipped++; continue; }

    // Map to worker
    const workerName = CAL_WORKER_MAP[calendar];
    if (!workerName) { skipped++; continue; }

    const workerUuid = workers[workerName];
    if (!workerUuid) { skipped++; continue; }

    // Assign the job
    await sleep(2000);
    const res = await fetch(`${PLANADO_API}/jobs/${job.uuid}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${PLANADO_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Planado-Notify-Assignees': 'false',
      },
      body: JSON.stringify({ assignee: { worker: { uuid: workerUuid } } }),
    });

    if (res.status === 204 || res.ok) {
      assigned++;
      const desc = (job.description || '').substring(0, 50);
      console.log(`  ✅ ${desc} → ${workerName}`);
    } else {
      const text = await res.text();
      errors++;
      if (errors <= 3) console.log(`  ❌ ${(job.description || '').substring(0, 40)} → ${text.substring(0, 80)}`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Assigned: ${assigned}`);
  console.log(`Skipped: ${skipped} (no mapping or already assigned)`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
