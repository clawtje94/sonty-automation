/**
 * Eenmalige volledige agenda → Planado sync (2026-07-08)
 *
 * Fase 1 (default): DRY RUN — haalt agenda + Planado-jobs op en toont wat er
 *   aangemaakt/gefixt zou worden, zonder iets te wijzigen.
 * Fase 2 (--execute): voert de wijzigingen uit.
 *
 * Regels (zie memory "Planado sync reasoning"):
 * - vakantie/vrij/ziek/tandarts/niet inplannen = GEEN job → shift working:false
 * - geannuleerd = overslaan
 * - alleen agenda "Sonty Montage" levert jobs; persoonlijke agenda's alleen blokkades
 * - scheduled_at met juiste NL-offset (zomertijd +02:00 / wintertijd +01:00)
 * - duur: Outlook-duur indien 30-1439 min, anders productdefault
 * - geen notificaties naar monteurs (X-Planado-Notify-Assignees: false)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXECUTE = process.argv.includes('--execute');
const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'agenda-full-sync-plan.json');

const SYNC_CALENDARS = ['Sonty Montage'];
const BLOCKED_CALENDARS = {
  'Sjoerd Hoogduin | Sonty': 'Sjoerd Hoogduin',
  'Nanny van Vliet | Sonty': 'Nanny van Vliet - Kester',
  'Jaimy de Wit | Sonty': 'Jaimy de Wit',
  'Yudi den Heijer  Sonty Montage': 'Yudi den Heijer',
};
const BLOCKED_KEYWORDS = ['vakantie', 'vrij', 'niet inplannen', 'niet plannen', 'tandarts', 'dokter', 'ziek', 'verlof', 'afwezig', 'niet beschikbaar', 'feestdag'];
const TEMPLATES = {
  inmeet: '1f11c802-65cd-6aa0-9d06-7e73cee772e4',      // Inmeet afspraak
  montage: '1f11c802-6613-6d00-9d06-7e73cee772e4',     // Montage afspraak particulier
  winkel: '1f11c802-658a-62d0-9d06-7e73cee772e4',      // Winkel afspraak
  service: '1f11c802-6452-6f20-9d06-7e73cee772e4',     // Service afspraak
  reparatie: '1f11c802-66cd-6430-9d06-7e73cee772e4',   // Reparatie afspraak
  onderhoud: '1f11c802-63cb-6a80-9d06-7e73cee772e4',   // Onderhouds afspraak
  advies: '1f11c802-652e-69e0-9d06-7e73cee772e4',      // Advies afspraak
};
function pickTemplate(subject) {
  const s = (subject || '').toLowerCase();
  if (s.includes('inmeten') || s.includes('inmeet') || s.includes('opmeting')) return TEMPLATES.inmeet;
  if (s.includes('showroom') || s.includes('winkel')) return TEMPLATES.winkel;
  if (s.includes('reparatie')) return TEMPLATES.reparatie;
  if (s.includes('service')) return TEMPLATES.service;
  if (s.includes('onderhoud')) return TEMPLATES.onderhoud;
  if (s.includes('advies')) return TEMPLATES.advies;
  return TEMPLATES.montage;
}

const ATTENDEE_TO_USER = {
  'yudi@sonty.nl': 'Yudi den Heijer', 'nick@sonty.nl': 'Nick Huizer',
  'mick@sonty.nl': 'Mick Mulders', 'tygo@sonty.nl': 'Tygo Krikke', 'tygokrikke@hotmail.com': 'Tygo Krikke',
  'marvin@sonty.nl': 'Marvin Vrij', 'kevin@sonty.nl': 'Kevin Gibson', 'gibson.k.j@hotmail.com': 'Kevin Gibson',
  'sjoerd@sonty.nl': 'Sjoerd Hoogduin', 'nanny@sonty.nl': 'Nanny van Vliet - Kester',
  'jaimy@sonty.nl': 'Jaimy de Wit', 'joey@sonty.nl': 'Joey Engelen', 'jorren@sonty.nl': 'Jorren Plugge',
};

const ATTENDEE_TO_TEAM = {
  'yudi@sonty.nl': 'Yudi / Nick', 'nick@sonty.nl': 'Yudi / Nick',
  'mick@sonty.nl': 'Mick / Tygo', 'tygo@sonty.nl': 'Mick / Tygo', 'tygokrikke@hotmail.com': 'Mick / Tygo',
  'marvin@sonty.nl': 'Marvin / Kevin', 'kevin@sonty.nl': 'Marvin / Kevin', 'gibson.k.j@hotmail.com': 'Marvin / Kevin',
  'sjoerd@sonty.nl': 'Sjoerd', 'nanny@sonty.nl': 'Nanny', 'jaimy@sonty.nl': 'Jaimy',
  'joey@sonty.nl': 'Joey', 'jorren@sonty.nl': 'Jorren',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

// NL zomertijd: laatste zondag maart t/m laatste zondag oktober
function nlOffset(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const y = d.getUTCFullYear();
  const lastSun = (m) => { const x = new Date(Date.UTC(y, m + 1, 0)); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return x; };
  const dstStart = lastSun(2), dstEnd = lastSun(9);
  return (d >= dstStart && d < dstEnd) ? '+02:00' : '+01:00';
}

// "2026-07-09T13:00:00.0000000" (lokale NL-tijd) → ISO met offset
function toScheduledAt(localDateTime) {
  const base = localDateTime.substring(0, 19);
  return base + nlOffset(base.substring(0, 10));
}

async function getOutlookToken() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let token = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth?.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
      const t = auth.replace('Bearer ', '');
      try {
        const payload = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        if (Buffer.from(payload, 'base64').toString().includes('Calendar')) token = t;
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
  return token;
}

async function planado(pathname, opts = {}) {
  const res = await fetch(`${PLANADO_API}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${PLANADO_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Planado-Notify-Assignees': 'false',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { ok: res.ok, status: res.status, json, text };
}

async function fetchAllJobs() {
  let jobs = [], cursor = null;
  while (true) {
    const { json } = await planado(cursor ? `/jobs?after=${cursor}` : '/jobs');
    const batch = json?.jobs || [];
    if (batch.length === 0) break;
    jobs = jobs.concat(batch);
    cursor = batch[batch.length - 1].uuid;
    await sleep(600);
  }
  return jobs;
}

(async () => {
  console.log(`=== Agenda → Planado volledige sync (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===`);

  // 1. Outlook token + events
  console.log('Outlook-token ophalen...');
  const token = await getOutlookToken();
  if (!token) { console.error('FOUT: geen Outlook-token'); process.exit(1); }
  console.log('Token ok. Agenda ophalen...');

  const now = new Date();
  const from = new Date(now.toISOString().substring(0, 10) + 'T00:00:00Z'); // vanaf vandaag
  const to = new Date(now.getTime() + 56 * 24 * 3600 * 1000);        // 8 weken vooruit
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Prefer': 'outlook.timezone="Europe/Amsterdam"',
  };

  const calsRes = await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers });
  const cals = (await calsRes.json()).value || [];
  console.log('Agenda’s:', cals.map(c => c.Name).join(' | '));

  const jobEvents = [], blockEvents = [];
  for (const cal of cals) {
    const isSyncCal = SYNC_CALENDARS.includes(cal.Name);
    const blockedWorker = BLOCKED_CALENDARS[cal.Name];
    if (!isSyncCal && !blockedWorker) continue;

    const url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,Attendees,Location,Id,IsCancelled&startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}`;
    const evRes = await fetch(url, { headers });
    const evs = (await evRes.json()).value || [];
    console.log(`  ${cal.Name}: ${evs.length} events`);

    for (const ev of evs) {
      const subject = ev.Subject || '';
      const sl = subject.toLowerCase();
      const eventId = ev.Id || '';
      const externalId = `outlook-${eventId.substring(eventId.length - 40)}`;
      if (!subject || subject === 'Sonty Montage') continue;
      if (ev.IsCancelled || sl.startsWith('canceled:') || sl.startsWith('geannuleerd:')) continue;

      const loc = typeof ev.Location === 'string' ? ev.Location : (ev.Location?.DisplayName || '');
      const locLower = loc.toLowerCase();

      const attendeeNames = [];
      for (const att of ev.Attendees || []) {
        const email = (att.EmailAddress?.Address || '').toLowerCase();
        if (ATTENDEE_TO_USER[email] && !attendeeNames.includes(ATTENDEE_TO_USER[email])) attendeeNames.push(ATTENDEE_TO_USER[email]);
      }

      const isBlocked = BLOCKED_KEYWORDS.some(kw => sl.includes(kw)) || locLower.includes('niets plannen') || locLower.includes('niet plannen');
      if (isBlocked) {
        blockEvents.push({ subject, worker: blockedWorker || null, attendees: attendeeNames, calendar: cal.Name, start: ev.Start?.DateTime, end: ev.End?.DateTime });
        continue;
      }
      if (!isSyncCal) continue; // persoonlijke agenda's: alleen blokkades

      // Notitie-events (geen klant, locatie is een opmerking): geen job
      const heeftKlant = subject.includes(' - ');
      const NOTE_PATTERNS = ['later', 'start in', 'begint in', 'begint later'];
      if (!heeftKlant && NOTE_PATTERNS.some(p => locLower.includes(p))) {
        console.log(`  (notitie, geen job) ${subject} @ ${loc}`);
        continue;
      }
      // Kale placeholders: geen klant, geen locatie, geen deelnemers
      if (!heeftKlant && !loc && (ev.Attendees || []).length === 0) {
        console.log(`  (placeholder, geen job) ${subject} ${ev.Start?.DateTime?.substring(0,16)}`);
        continue;
      }
      const outlookMins = (ev.Start?.DateTime && ev.End?.DateTime)
        ? Math.round((new Date(ev.End.DateTime) - new Date(ev.Start.DateTime)) / 60000) : null;
      const duration = (outlookMins && outlookMins >= 30 && outlookMins < 1440) ? outlookMins : getDefaultDuration(subject);

      let teamName = null;
      for (const att of ev.Attendees || []) {
        const email = (att.EmailAddress?.Address || '').toLowerCase();
        if (ATTENDEE_TO_TEAM[email]) { teamName = ATTENDEE_TO_TEAM[email]; break; }
      }

      jobEvents.push({
        externalId, subject,
        start: ev.Start?.DateTime || null,
        scheduledAt: ev.Start?.DateTime ? toScheduledAt(ev.Start.DateTime) : null,
        duration, teamName,
        address: (loc && loc.length > 5 && !loc.includes('Frijdastraat') && (/\d/.test(loc) || loc.includes(','))) ? loc : null,
        template: pickTemplate(subject),
        workerNames: attendeeNames,
      });
    }
  }

  // 2. Planado stand
  console.log('Planado jobs/users/teams ophalen...');
  const users = (await planado('/users')).json?.users || [];
  const teams = (await planado('/teams')).json?.teams || [];
  const jobs = await fetchAllJobs();
  const jobsByExt = {};
  for (const j of jobs) if (j.external_id) jobsByExt[j.external_id] = j;
  console.log(`Planado: ${jobs.length} jobs, ${users.length} users, ${teams.length} teams`);

  // 3. Plan bepalen (toewijzing per monteur; teams bestaan niet in Planado)
  const userByName = {};
  for (const u of users) userByName[`${u.first_name} ${u.last_name}`] = u.uuid;
  // Duo-partner fallback: Yudi en Marvin hebben geen Planado-account
  const FALLBACK_USER = { 'Yudi den Heijer': 'Nick Huizer', 'Marvin Vrij': 'Kevin Gibson' };
  const pickWorkerUuid = (names) => {
    for (const n of names || []) if (userByName[n]) return { uuid: userByName[n], name: n };
    for (const n of names || []) {
      const f = FALLBACK_USER[n];
      if (f && userByName[f]) return { uuid: userByName[f], name: `${f} (team ${n.split(' ')[0]})` };
    }
    return null;
  };

  const toCreate = [], toFix = [], okJobs = [];
  for (const ev of jobEvents) {
    ev.worker = pickWorkerUuid(ev.workerNames);
    const existing = jobsByExt[ev.externalId];
    if (!existing) { toCreate.push(ev); continue; }
    const fixes = {};
    const exAt = (existing.scheduled_at || '').substring(0, 16);
    const wantAt = (ev.scheduledAt || '').substring(0, 16);
    if (wantAt && exAt !== wantAt) fixes.scheduled_at = ev.scheduledAt;
    const exDur = existing.scheduled_duration ? Math.round(existing.scheduled_duration / 60) : null; // seconds→min? check raw
    if (existing.scheduled_duration && typeof existing.scheduled_duration === 'object') {
      // API kan {minutes: n} teruggeven
    }
    const curMins = existing.scheduled_duration?.minutes ?? exDur;
    if (ev.duration && curMins !== ev.duration) fixes.scheduled_duration = { minutes: ev.duration };
    if (!existing.assignee && ev.worker) {
      fixes.assignee = { worker: { uuid: ev.worker.uuid } };
    }
    if (Object.keys(fixes).length > 0) toFix.push({ ev, existing, fixes });
    else okJobs.push(ev);
  }

  // 4. Rapport
  console.log(`\n=== PLAN ===`);
  console.log(`Nieuw aan te maken: ${toCreate.length}`);
  for (const ev of toCreate) {
    console.log(`  + ${ev.start?.substring(0, 16) || 'GEEN TIJD'} | ${ev.duration}min | ${ev.worker?.name || 'NIET TOEGEWEZEN'} | ${ev.subject.substring(0, 70)}${ev.address ? ' @ ' + ev.address.substring(0, 40) : ''}`);
  }
  console.log(`Te fixen (tijd/duur/team): ${toFix.length}`);
  for (const f of toFix) {
    console.log(`  ~ ${f.ev.subject.substring(0, 60)} → ${JSON.stringify(f.fixes).substring(0, 120)}`);
  }
  console.log(`Al correct: ${okJobs.length}`);
  console.log(`Blokkades (shift working:false): ${blockEvents.length}`);
  for (const b of blockEvents) {
    console.log(`  ⛔ ${b.worker || (b.attendees||[]).join('+') || b.calendar+' (GEEN MONTEUR)'} | ${b.subject.substring(0, 50)} | ${b.start?.substring(0, 10)} → ${b.end?.substring(0, 10)}`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: now.toISOString(), toCreate, toFix: toFix.map(f => ({ subject: f.ev.subject, uuid: f.existing.uuid, fixes: f.fixes })), okJobs: okJobs.length, blockEvents }, null, 2));
  console.log(`\nPlan opgeslagen in ${OUT_FILE}`);

  if (!EXECUTE) { console.log('\nDRY RUN klaar. Draai met --execute om uit te voeren.'); return; }

  // 5. Uitvoeren
  console.log('\n=== UITVOEREN ===');
  let created = 0, fixed = 0, blocked = 0, errors = 0;

  for (const ev of toCreate) {
    const body = { external_id: ev.externalId, description: ev.subject };
    if (ev.template) body.template_uuid = ev.template;
    if (ev.scheduledAt) body.scheduled_at = ev.scheduledAt;
    if (ev.address) body.address = { formatted: ev.address };
    const res = await planado('/jobs', { method: 'POST', body: JSON.stringify(body) });
    await sleep(800);
    if (res.ok && res.json?.job_uuid) {
      // duur + team via PATCH (create negeert deze velden)
      const patch = { version: 1, scheduled_duration: { minutes: ev.duration } };
      if (ev.worker) patch.assignee = { worker: { uuid: ev.worker.uuid } };
      const pres = await planado(`/jobs/${res.json.job_uuid}`, { method: 'PATCH', body: JSON.stringify(patch) });
      created++;
      console.log(`  ✓ ${ev.subject.substring(0, 60)} (${res.json.job_uuid.substring(0, 8)}${pres.ok ? '' : ', patch-fout: ' + pres.text.substring(0, 80)})`);
      await sleep(800);
    } else if (res.text.includes('is used by another entity')) {
      console.log(`  = bestaat al: ${ev.subject.substring(0, 60)}`);
    } else {
      errors++;
      console.log(`  ✗ ${ev.subject.substring(0, 50)} → ${res.status} ${res.text.substring(0, 120)}`);
    }
  }

  for (const f of toFix) {
    const res = await planado(`/jobs/${f.existing.uuid}`, { method: 'PATCH', body: JSON.stringify({ version: f.existing.version, ...f.fixes }) });
    if (res.ok) fixed++;
    else { errors++; console.log(`  ✗ fix ${f.ev.subject.substring(0, 40)} → ${res.status} ${res.text.substring(0, 100)}`); }
    await sleep(800);
  }

  for (const b of blockEvents) {
    if (!b.start || !b.end) continue;
    const names = b.worker ? [b.worker] : (b.attendees || []);
    if (names.length === 0) { console.log(`  (blokkade zonder monteur, overslaan) ${b.subject} ${b.start?.substring(0,10)}`); continue; }

    const startDate = b.start.substring(0, 10);
    const endDate = b.end.substring(0, 10);
    const startTijd = b.start.substring(11, 16);
    const partieel = startDate === endDate && startTijd !== '00:00';

    for (const name of names) {
      const worker = users.find(u => `${u.first_name} ${u.last_name}` === name);
      if (!worker) { console.log(`  (geen Planado-user voor blokkade: ${name})`); continue; }

      if (partieel) {
        // Middag/deel-dag vrij: shift laten eindigen bij start van de blokkade
        const off = nlOffset(startDate);
        const res = await planado(`/users/${worker.uuid}/shifts/${startDate}`, {
          method: 'PATCH',
          body: JSON.stringify({ working: true, time_from: `${startDate}T07:00:00${off}`, time_to: `${startDate}T${startTijd}:00${off}` }),
        });
        if (!res.ok) console.log(`  (partiele blokkade mislukt ${name} ${startDate}: ${res.status} ${res.text.substring(0,80)})`);
        else blocked++;
        await sleep(300);
        continue;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().substring(0, 10);
        if (dateStr < now.toISOString().substring(0, 10)) continue;
        await planado(`/users/${worker.uuid}/shifts/${dateStr}`, { method: 'PATCH', body: JSON.stringify({ working: false }) });
        await sleep(300);
        blocked++;
      }
    }
  }

  console.log(`\nKlaar: ${created} aangemaakt, ${fixed} gefixt, ${blocked} blokkade-dagen gezet, ${errors} fouten.`);
})();
