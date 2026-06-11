/**
 * Set up Planado shifts (beschikbaarheid) based on Nmbrs rooster data
 * + Assign existing jobs to the right workers based on Outlook calendar mapping
 */

const fs = require('fs');
const path = require('path');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = 'b9877b84119475b39953cb5dd0c409a7704ef669fe569bc1745c99275cef';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Nmbrs roster data (from screenshots/scraping)
// Format: hours per day [ma, di, wo, do, vr] — 0 means not working
const ROSTERS = {
  'Sjoerd Pelle': { hours: [8, 8, 8, 8, 6], start: '07:00', nmbrs_id: 6 },
  'Jorren Plugge': { hours: [7.6, 7.6, 7.6, 7.6, 7.6], start: '07:00', nmbrs_id: 10 },
  'Marvin Vrij': { hours: [8, 8, 8, 8, 8], start: '07:00', nmbrs_id: 14 },
  'Mick Mulders': { hours: [7.6, 7.6, 7.6, 7.6, 7.6], start: '07:00', nmbrs_id: 17 },
  'Tygo Krikke': { hours: [8, 8, 8, 8, 6], start: '07:00', nmbrs_id: 13 },
  'Kevin Gibson': { hours: [0, 0, 0, 0, 0], start: '07:00', nmbrs_id: 18 }, // unknown schedule
  'Nick Huizer': { hours: [8, 8, 8, 8, 6], start: '07:00', nmbrs_id: 7 },
  // Non-field workers with schedules
  'Nanny van Vliet - Kester': { hours: [8, 8, 8, 8, 0], start: '08:00', nmbrs_id: 5 },
  'Joey Engelen': { hours: [8, 8, 8, 8, 8], start: '08:00', nmbrs_id: null },
};

// Known leave days from Nmbrs
const LEAVE = [
  { name: 'Nick Huizer', from: '2026-03-10', to: '2026-03-14' },
  { name: 'Nanny van Vliet - Kester', from: '2026-05-12', to: '2026-05-12' },
  { name: 'Nanny van Vliet - Kester', from: '2026-05-15', to: '2026-05-15' },
];

async function fetchPlanadoUsers() {
  const res = await fetch(`${PLANADO_API}/users`, {
    headers: { 'Authorization': `Bearer ${PLANADO_KEY}`, 'Accept': 'application/json' }
  });
  const data = await res.json();
  const users = {};
  for (const u of data.users || []) {
    users[`${u.first_name} ${u.last_name}`] = u.uuid;
  }
  return users;
}

function generateWeekShifts(roster, weekStartDate) {
  const shifts = [];
  const dayNames = ['ma', 'di', 'wo', 'do', 'vr'];

  for (let d = 0; d < 5; d++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    const hours = roster.hours[d];

    if (hours > 0) {
      const [startH, startM] = roster.start.split(':').map(Number);
      const endMinutes = startH * 60 + startM + Math.round(hours * 60);
      // Round to nearest 15 minutes (Planado requires rounding)
      const rounded = Math.round(endMinutes / 15) * 15;
      const endH = Math.floor(rounded / 60);
      const endM = rounded % 60;

      shifts.push({
        time_from: `${dateStr}T${roster.start}:00+01:00`,
        time_to: `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00+01:00`,
        working: true,
      });
    }
  }

  return shifts;
}

function isOnLeave(name, dateStr) {
  for (const leave of LEAVE) {
    if (leave.name === name) {
      const d = new Date(dateStr);
      const from = new Date(leave.from);
      const to = new Date(leave.to);
      if (d >= from && d <= to) return true;
    }
  }
  return false;
}

async function setShiftsForUser(userUuid, name, roster, weeksAhead = 6) {
  console.log(`  Setting shifts for ${name}...`);

  // Generate shifts for each week
  const today = new Date();
  // Start from Monday of current week
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  let created = 0;
  let errors = 0;

  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() + w * 7);

    const shifts = generateWeekShifts(roster, weekStart);

    // Mark leave days as non-working
    const finalShifts = shifts.map(s => {
      const dateStr = s.time_from.split('T')[0];
      if (isOnLeave(name, dateStr)) {
        return { ...s, working: false };
      }
      return s;
    });

    if (finalShifts.length === 0) continue;

    // Planado shifts API: max 1 week at a time
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    await sleep(1500);

    const res = await fetch(`${PLANADO_API}/users/${userUuid}/shifts`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${PLANADO_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shifts: finalShifts }),
    });

    if (res.status === 204) {
      created += finalShifts.length;
    } else {
      const text = await res.text();
      errors++;
      if (w === 0) console.log(`    Week ${w} error: ${text.substring(0, 100)}`);
    }
  }

  console.log(`    ${created} shifts OK, ${errors} errors`);
  return { created, errors };
}

async function main() {
  console.log('=== Planado Shifts Setup ===\n');

  const users = await fetchPlanadoUsers();
  console.log(`Active users: ${Object.keys(users).join(', ')}\n`);

  let totalCreated = 0;
  let totalErrors = 0;

  for (const [name, roster] of Object.entries(ROSTERS)) {
    const uuid = users[name];
    if (!uuid) {
      console.log(`  ⏭ ${name} — not yet activated in Planado`);
      continue;
    }

    // Skip Daimy (backoffice only)
    if (name === 'Daimy Boot') {
      console.log(`  ⏭ ${name} — backoffice, no shifts`);
      continue;
    }

    const result = await setShiftsForUser(uuid, name, roster);
    totalCreated += result.created;
    totalErrors += result.errors;
  }

  console.log(`\n=== Results ===`);
  console.log(`Shifts created: ${totalCreated}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(console.error);
