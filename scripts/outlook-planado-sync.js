/**
 * Outlook Calendar → Planado Job Sync
 *
 * SAFE:
 * - Read-only from Outlook (no modifications)
 * - Planado jobs created with X-Planado-Notify-Assignees: false
 * - Deduplication via external_id (Outlook event ID)
 * - Dry run by default, pass --execute to actually create jobs
 *
 * Usage:
 *   node outlook-planado-sync.js                    # dry run, future events only
 *   node outlook-planado-sync.js --execute          # create jobs, future events only
 *   node outlook-planado-sync.js --include-past     # dry run, include past events
 *   node outlook-planado-sync.js --execute --include-past  # full sync
 */

const fs = require('fs');
const path = require('path');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';
const EVENTS_FILE = path.join(__dirname, '..', 'data', 'outlook-all-events.json');
const STATE_FILE = path.join(__dirname, '..', 'data', 'sync-state.json');

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const INCLUDE_PAST = args.includes('--include-past');

// Planado worker UUIDs (will be populated from API)
let planadoWorkers = {};

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return { synced: {} }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Parse client name from subject like "Inmeten Sonty - Roos lockhorst"
function parseClient(subject) {
  const parts = subject.split(' - ');
  if (parts.length >= 2) {
    let name = parts.slice(1).join(' - ').trim();
    // Skip internal notes
    if (/^(VRIJ|NIET PLANNEN|DJO|BUS|MAGAZIJN|STALEN|GORDIJN|VITRAGE|SERVICE|SJOERD|JOEY)/i.test(name)) return null;
    if (/^(Geannuleerd|Canceled)/i.test(name)) return null;
    // Clean up HTML entities
    name = name.replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&lt;/g, '<');
    const nameParts = name.split(' ');
    return {
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || '',
    };
  }
  return null;
}

// Classify event type
function classifyEvent(subject) {
  const s = subject.toLowerCase();
  if (s.includes('inmeten') || s.includes('opmeting')) return 'Opmeting';
  if (s.includes('montage') || s.includes('installatie')) return 'Montage';
  if (s.includes('showroom') || s.includes('afspraak showroom')) return 'Showroom';
  if (s.includes('telefonisch')) return 'Telefonisch';
  return 'Overig';
}

// Check if event should be skipped — minimal filtering, everything goes to Planado
function shouldSkip(event) {
  const subject = (event.Subject || '').toLowerCase().trim();

  // Only skip completely empty subjects or pure calendar headers
  if (!subject) return 'leeg';
  if (subject === 'sonty montage') return 'kalender header';

  // Everything else goes through — including DJO HALEN, MAGAZIJN, NIET PLANNEN, VAKANTIE, etc.
  return null;
}

// Map calendar owner to Planado worker
function mapWorker(calendarName) {
  const name = calendarName.toLowerCase();
  // Sjoerd Hoogduin (Outlook) = Sjoerd Pelle (Planado)
  if (name.includes('sjoerd')) return planadoWorkers['Sjoerd Pelle'] || null;
  if (name.includes('yudi')) return null; // Yudi not in Planado yet
  if (name.includes('jaimy')) return null; // Jaimy is klantenservice, not field worker
  if (name.includes('nanny')) return planadoWorkers['Nanny van Vliet - Kester'] || null;
  // Sonty Montage / Agenda = unassigned (no specific worker)
  return null;
}

// Parse address from location
function parseAddress(location) {
  if (!location) return null;
  const loc = typeof location === 'string' ? location : (location.DisplayName || '');
  if (!loc || loc.length < 5) return null;
  if (loc.includes('Frijdastraat')) return null; // Showroom address, not client
  return { formatted: loc };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPlanadoWorkers() {
  const res = await fetch(`${PLANADO_API}/users`, {
    headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
  });
  const data = await res.json();
  for (const u of data.users || []) {
    planadoWorkers[`${u.first_name} ${u.last_name}`] = u.uuid;
  }
  console.log(`Planado workers: ${Object.keys(planadoWorkers).join(', ')}`);
}

async function createPlanadoJob(event, externalId) {
  const subject = event.Subject || '';
  const type = classifyEvent(subject);
  const client = parseClient(subject);
  const address = parseAddress(event.Location);
  const startDt = event.Start?.DateTime;
  const endDt = event.End?.DateTime;
  const calendar = event._calendar || '';
  const workerUuid = mapWorker(calendar);

  // Calculate duration in minutes
  let duration = null;
  if (startDt && endDt) {
    const diffMs = new Date(endDt) - new Date(startDt);
    const mins = Math.round(diffMs / 60000);
    if (mins > 0 && mins < 1440) {
      duration = { hours: Math.floor(mins / 60), minutes: mins % 60 };
    }
  }

  // Build description with client name included (client object requires pre-existing client in Planado)
  const clientStr = client ? `\nKlant: ${client.first_name} ${client.last_name}` : '';
  const addressStr = address ? `\nAdres: ${address.formatted}` : '';

  const jobData = {
    external_id: externalId,
    description: `[${type}] ${subject}${clientStr}${addressStr}\n\nKalender: ${calendar}`,
  };

  if (startDt) jobData.scheduled_at = startDt;
  if (duration) jobData.scheduled_duration = duration;
  if (address) jobData.address = address;
  // Only assign if we have a valid UUID
  if (workerUuid) {
    jobData.assignee = { uuid: workerUuid };
  }

  if (!EXECUTE) return { dry_run: true, type, client: client?.first_name };

  // Rate limit: wait between API calls (Planado has strict limits)
  await sleep(2000);

  const res = await fetch(`${PLANADO_API}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PLANADO_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Planado-Notify-Assignees': 'false',
    },
    body: JSON.stringify(jobData),
  });

  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch (e) {
    // Rate limited or other non-JSON response — wait and retry
    if (res.status === 429 || text.includes('Rate Limit') || text.includes('Cannot process')) {
      await sleep(5000);
      const retry = await fetch(`${PLANADO_API}/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PLANADO_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Planado-Notify-Assignees': 'false',
        },
        body: JSON.stringify(jobData),
      });
      const retryText = await retry.text();
      try { result = JSON.parse(retryText); } catch (e2) {
        return { error: `Rate limited: ${retryText.substring(0, 50)}` };
      }
      if (retry.ok) return { success: true, uuid: result.job_uuid };
      return { error: result.message || 'retry failed' };
    }
    return { error: `Invalid response: ${text.substring(0, 50)}` };
  }
  if (res.ok) return { success: true, uuid: result.job_uuid };

  // If "Cannot process request", it might be rate limiting disguised as validation error — retry
  if (result.message === 'Cannot process request') {
    // If assignee error, retry without assignee
    if (result.errors?.assignee) {
      delete jobData.assignee;
      await sleep(2000);
      const retry = await fetch(`${PLANADO_API}/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PLANADO_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Planado-Notify-Assignees': 'false',
        },
        body: JSON.stringify(jobData),
      });
      const retryText = await retry.text();
      let retryResult;
      try { retryResult = JSON.parse(retryText); } catch (e) { return { error: 'retry parse error' }; }
      if (retry.ok) return { success: true, uuid: retryResult.job_uuid };
      if (retryResult.errors?.external_id?.includes('is used by another entity')) return { already_exists: true };
      return { error: retryResult.message || 'retry failed' };
    }

    // Other errors — just retry once
    await sleep(3000);
    const retry = await fetch(`${PLANADO_API}/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PLANADO_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Planado-Notify-Assignees': 'false',
      },
      body: JSON.stringify(jobData),
    });
    const retryResult = await retry.json().catch(() => ({}));
    if (retry.ok) return { success: true, uuid: retryResult.job_uuid };
    if (retryResult.errors?.external_id?.includes('is used by another entity')) return { already_exists: true };
    return { error: retryResult.message || 'retry failed' };
  }

  // If external_id already exists, treat as already synced
  if (result.errors?.external_id?.includes('is used by another entity')) {
    return { already_exists: true };
  }

  return { error: result.message || 'unknown error' };
}

async function main() {
  console.log('=== Outlook → Planado Sync ===');
  console.log(`Mode: ${EXECUTE ? '🔴 EXECUTE' : '🟢 DRY RUN'}`);
  console.log(`Include past: ${INCLUDE_PAST ? 'yes' : 'no (future only)'}`);
  console.log('');

  // Load events
  if (!fs.existsSync(EVENTS_FILE)) {
    console.error(`Events file not found: ${EVENTS_FILE}`);
    console.error('Run outlook-calendar-token.js first to fetch events.');
    process.exit(1);
  }

  const allEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  console.log(`Total events in file: ${allEvents.length}`);

  // Fetch Planado workers
  await fetchPlanadoWorkers();

  const state = loadState();
  const now = new Date().toISOString();

  // Filter events
  const events = allEvents.filter(e => {
    const startDt = e.Start?.DateTime;
    if (!startDt) return false;
    if (!INCLUDE_PAST && new Date(startDt) < new Date()) return false;
    return true;
  });

  console.log(`Events to process: ${events.length} (after date filter)`);
  console.log('');

  const stats = { created: 0, skipped: 0, errors: 0, already_synced: 0 };
  const results = [];

  for (const event of events) {
    const subject = event.Subject || '';
    const startDt = event.Start?.DateTime?.substring(0, 16) || '';
    const eventId = event.Id || '';
    const externalId = `outlook-${eventId.substring(eventId.length - 40)}`;

    // Check if already synced in our state
    if (state.synced[externalId]) {
      stats.already_synced++;
      continue;
    }


    // Check if should skip
    const skipReason = shouldSkip(event);
    if (skipReason) {
      stats.skipped++;
      results.push({ status: 'skip', reason: skipReason, subject: subject.substring(0, 60) });
      continue;
    }

    const type = classifyEvent(subject);
    const client = parseClient(subject);

    // Create job
    const result = await createPlanadoJob(event, externalId);

    if (result.dry_run) {
      stats.created++;
      results.push({
        status: 'would_create',
        type,
        date: startDt,
        subject: subject.substring(0, 60),
        client: client ? `${client.first_name} ${client.last_name}` : null,
        calendar: event._calendar,
      });
    } else if (result.success) {
      stats.created++;
      state.synced[externalId] = { uuid: result.uuid, synced_at: now };
      results.push({ status: 'created', type, subject: subject.substring(0, 60) });
    } else if (result.already_exists) {
      stats.already_synced++;
      state.synced[externalId] = { existing: true, synced_at: now };
    } else {
      stats.errors++;
      results.push({ status: 'error', error: result.error, subject: subject.substring(0, 60) });
    }
  }

  // Save state
  if (EXECUTE) saveState(state);

  // Print results
  console.log('\n=== Results ===');
  console.log(`Created: ${stats.created}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Already synced: ${stats.already_synced}`);
  console.log(`Errors: ${stats.errors}`);

  console.log('\n--- Details ---');
  for (const r of results) {
    if (r.status === 'would_create') {
      console.log(`  ✅ [${r.type}] ${r.date} ${r.subject} ${r.client ? `(${r.client})` : ''} — ${r.calendar}`);
    } else if (r.status === 'created') {
      console.log(`  ✅ Created: [${r.type}] ${r.subject}`);
    } else if (r.status === 'skip') {
      console.log(`  ⏭  Skip (${r.reason}): ${r.subject}`);
    } else if (r.status === 'error') {
      console.log(`  ❌ Error: ${r.subject} — ${r.error}`);
    }
  }
}

main().catch(console.error);
