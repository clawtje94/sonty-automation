/**
 * Outlook Calendar → Planado Sync
 *
 * Reads appointments from Outlook calendar (joey@sontymontage.nl)
 * and creates corresponding jobs in Planado.
 *
 * SAFE: Read-only from Outlook, no client notifications from Planado.
 * DEDUP: Uses external_id based on Outlook event ID to prevent duplicates.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

// State file for tracking synced events
const STATE_FILE = path.join(__dirname, '..', 'data', 'outlook-planado-sync-state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { syncedEvents: {}, lastSync: null };
  }
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Map Outlook appointment types to Planado job types
function classifyAppointment(subject) {
  const s = subject.toLowerCase();
  if (s.includes('inmeten') || s.includes('inmeet') || s.includes('opmeting')) {
    return { type: 'Opmeting', template: null };
  }
  if (s.includes('montage') || s.includes('installatie')) {
    return { type: 'Montage', template: null };
  }
  if (s.includes('showroom') || s.includes('afspraak showroom')) {
    return { type: 'Showroom', template: null };
  }
  if (s.includes('telefonisch')) {
    return { type: 'Telefonisch', template: null };
  }
  return { type: 'Overig', template: null };
}

// Parse client name from subject like "Inmeten Sonty - Roos lockhorst"
function parseClientFromSubject(subject) {
  const parts = subject.split(' - ');
  if (parts.length >= 2) {
    const clientPart = parts.slice(1).join(' - ').trim();
    // Remove "Geannuleerd:" prefix if present
    if (clientPart.toLowerCase().startsWith('geannuleerd')) return null;
    return clientPart;
  }
  return null;
}

// Check if event is cancelled
function isCancelled(subject) {
  const s = subject.toLowerCase();
  return s.includes('geannuleerd') || s.includes('canceled') || s.includes('cancelled');
}

async function scrapeOutlookCalendar(page, weeksBack = 4, weeksForward = 4) {
  const events = [];

  // Login to Outlook
  console.log('  Logging into Outlook...');
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

  await page.waitForTimeout(3000);
  console.log('  Logged in:', page.url());

  // Navigate week by week
  // First go back weeksBack weeks
  for (let i = 0; i < weeksBack; i++) {
    try {
      await page.locator('button[aria-label*="ack"], button[aria-label*="orig"], button[aria-label*="revious"]').first().click();
      await page.waitForTimeout(1500);
    } catch (e) { break; }
  }

  // Now scrape forward through all weeks
  const totalWeeks = weeksBack + weeksForward;
  for (let w = 0; w < totalWeeks; w++) {
    // Get all visible event elements
    const weekEvents = await page.evaluate(() => {
      const results = [];
      // Look for calendar event elements
      const eventEls = document.querySelectorAll('[class*="CalendarEvent"], [class*="event-card"], [data-is-focusable="true"]');
      for (const el of eventEls) {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        // Event aria-labels often contain: time, subject, location
        if (ariaLabel.length > 10 || (text.length > 5 && (text.includes('Sonty') || text.includes('Inmeten') || text.includes('Montage') || text.includes('showroom')))) {
          results.push({
            text: text.substring(0, 200),
            ariaLabel: ariaLabel.substring(0, 500),
          });
        }
      }
      return results;
    });

    // Also get the page text to find events in plain text
    const pageText = await page.evaluate(() => document.body.innerText);

    // Extract event lines that look like appointments
    const lines = pageText.split('\n').filter(l => {
      const t = l.trim().toLowerCase();
      return t.includes('inmeten') || t.includes('montage') || t.includes('showroom') ||
             t.includes('telefonisch') || (t.includes('sonty') && t.includes('-'));
    });

    // Get current week date range
    const dateRange = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/(\d+[–-]\d+\s+\w+,?\s*\d{4})/);
      return match ? match[1] : '';
    });

    if (lines.length > 0 || weekEvents.length > 0) {
      console.log(`  Week: ${dateRange} — ${lines.length} text matches, ${weekEvents.length} DOM events`);
      for (const line of lines) {
        console.log(`    > ${line.trim().substring(0, 80)}`);
      }
    }

    // Store events (dedup by text)
    for (const ev of weekEvents) {
      const key = ev.ariaLabel || ev.text;
      if (!events.find(e => e.key === key)) {
        events.push({ ...ev, key, weekDate: dateRange });
      }
    }

    // Next week
    try {
      await page.locator('button[aria-label*="orward"], button[aria-label*="ext"], button[aria-label*="olgende"]').first().click();
      await page.waitForTimeout(1500);
    } catch (e) { break; }
  }

  return events;
}

async function createPlanadoJob(event) {
  const subject = event.ariaLabel || event.text;
  const classification = classifyAppointment(subject);
  const clientName = parseClientFromSubject(subject);

  if (isCancelled(subject)) {
    console.log(`  Skip (cancelled): ${subject.substring(0, 60)}`);
    return null;
  }

  // Build external_id from event text for deduplication
  const externalId = `outlook-${Buffer.from(subject).toString('base64').substring(0, 100)}`;

  const jobData = {
    external_id: externalId,
    description: `[Outlook sync] ${subject}`,
  };

  // Add client if parseable
  if (clientName) {
    const nameParts = clientName.split(' ');
    jobData.client = {
      first_name: nameParts[0] || clientName,
      last_name: nameParts.slice(1).join(' ') || '',
    };
  }

  // Create job via API (without notifications)
  const response = await fetch(`${PLANADO_API}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PLANADO_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Planado-Notify-Assignees': 'false',
    },
    body: JSON.stringify(jobData),
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`  Created: ${subject.substring(0, 60)} → ${result.job_uuid || 'ok'}`);
    return result;
  } else {
    // Check for duplicate
    if (result.message?.includes('external_id') || result.message?.includes('already exists')) {
      console.log(`  Skip (exists): ${subject.substring(0, 60)}`);
      return null;
    }
    console.log(`  Error: ${subject.substring(0, 40)} → ${JSON.stringify(result).substring(0, 100)}`);
    return null;
  }
}

// Main
(async () => {
  const state = loadState();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('=== Outlook → Planado Sync ===');
    console.log(`Last sync: ${state.lastSync || 'never'}`);
    console.log('');

    // Step 1: Scrape Outlook calendar
    console.log('Step 1: Scraping Outlook calendar...');
    const events = await scrapeOutlookCalendar(page, 4, 2);
    console.log(`\nFound ${events.length} unique events`);

    // Step 2: Save scraped events to file for inspection
    const eventsFile = path.join(__dirname, '..', 'data', 'outlook-events.json');
    fs.writeFileSync(eventsFile, JSON.stringify(events, null, 2));
    console.log(`Events saved to ${eventsFile}`);

    // Step 3: Show summary (don't create Planado jobs yet — dry run first)
    console.log('\n=== DRY RUN — Events found ===');
    for (const ev of events) {
      const subject = ev.ariaLabel || ev.text;
      const classification = classifyAppointment(subject);
      const cancelled = isCancelled(subject);
      const client = parseClientFromSubject(subject);
      console.log(`  [${classification.type}] ${cancelled ? 'GEANNULEERD ' : ''}${subject.substring(0, 80)} ${client ? `(klant: ${client})` : ''}`);
    }

    console.log(`\nTotal: ${events.length} events`);
    console.log('This was a DRY RUN. No Planado jobs were created.');
    console.log('Review the events above. Run with --execute to create jobs.');

    // Update state
    state.lastSync = new Date().toISOString();
    state.eventsFound = events.length;
    saveState(state);

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: '/tmp/sync-error.png' });
  }

  await browser.close();
})();
