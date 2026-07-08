#!/usr/bin/env node
/**
 * Herbouwt Planado-werkroosters (shifts) voor de komende 8 weken.
 * - Rooster per monteur uit Nmbrs-ROSTERS (zelfde data als oude auto-sync.js)
 * - Vakantie-/vrij-dagen uit data/agenda-full-sync-plan.json blockEvents worden
 *   weggelaten (geen shift = niet beschikbaar in Planado)
 * - Partiële blokkades (zelfde dag, start != 00:00) korten de shift in tot de blokkade-start
 * - API: PATCH /users/{uuid}/shifts met body { shifts: [{time_from, time_to, working:true}] }
 *   (per week gebatcht, verwacht 204) - het per-datum endpoint /shifts/{date} bestaat NIET (404)
 *
 * DRY RUN standaard; --execute om echt te schrijven.
 */
const fs = require('fs');
const path = require('path');

const EXECUTE = process.argv.includes('--execute');
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const API = 'https://api.planadoapp.com/v2';
const PLAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'agenda-full-sync-plan.json'), 'utf8'));
const WEEKS_AHEAD = 8;

// Nmbrs rosters (uren per dag [ma-vr]) - overgenomen uit auto-sync.js
// Jaimy de Wit stond niet in de oude lijst: standaard monteursrooster, flaggen bij Daimy.
const ROSTERS = {
  'Sjoerd Pelle': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Jorren Plugge': { hours: [7.6, 7.6, 7.6, 7.6, 7.6], start: '07:00' },
  'Mick Mulders': { hours: [7.6, 7.6, 7.6, 7.6, 7.6], start: '07:00' },
  'Tygo Krikke': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Kevin Gibson': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Nick Huizer': { hours: [8, 8, 8, 8, 6], start: '07:00' },
  'Nanny van Vliet - Kester': { hours: [8, 8, 8, 8, 0], start: '08:00' },
  'Joey Engelen': { hours: [8, 8, 8, 8, 8], start: '08:00' },
  'Jaimy de Wit': { hours: [8, 8, 8, 8, 6], start: '07:00' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function planado(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${PLANADO_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: res.ok, status: res.status, text, json };
}

// Blokkades per monteur: Set van 'YYYY-MM-DD' (hele dag weg) + Map datum -> 'HH:MM' (shift eindigt eerder)
function buildBlocks() {
  const fullDays = {}; // name -> Set(dateStr)
  const shortDays = {}; // name -> Map(dateStr -> endTime 'HH:MM')
  for (const b of PLAN.blockEvents || []) {
    if (!b.start || !b.end) continue;
    const names = b.worker ? [b.worker] : (b.attendees || []);
    const startDate = b.start.substring(0, 10);
    const endDate = b.end.substring(0, 10);
    const startTijd = b.start.substring(11, 16);
    for (const name of names) {
      if (startDate === endDate) {
        const isVakantie = /vakantie|vrij|verlof|ziek/i.test(b.subject || '');
        if (isVakantie || startTijd === '00:00' || startTijd <= '08:00') {
          // korte 'Vakantie'/'VRIJ' marker of ochtendstart = hele dag vrij
          (fullDays[name] = fullDays[name] || new Set()).add(startDate);
        } else {
          // middagblokkade: shift eindigt bij start van de blokkade
          (shortDays[name] = shortDays[name] || new Map()).set(startDate, startTijd);
        }
      } else {
        const d = new Date(startDate + 'T12:00:00Z');
        const end = new Date(endDate + 'T12:00:00Z');
        for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          (fullDays[name] = fullDays[name] || new Set()).add(d.toISOString().substring(0, 10));
        }
      }
    }
  }
  return { fullDays, shortDays };
}

function endTime(startStr, hours) {
  const [h, m] = startStr.split(':').map(Number);
  const endMins = Math.round((h * 60 + m + hours * 60) / 15) * 15;
  return `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
}

async function main() {
  console.log(`=== Planado shifts herbouwen (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===`);
  const users = (await planado('/users')).json.users;
  const { fullDays, shortDays } = buildBlocks();

  const today = new Date();
  const monday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const todayStr = today.toISOString().substring(0, 10);

  let written = 0, skippedVak = 0, errors = 0;
  for (const [name, roster] of Object.entries(ROSTERS)) {
    const user = users.find((u) => `${u.first_name} ${u.last_name}` === name);
    if (!user) { console.log(`  (geen Planado-user: ${name})`); continue; }
    const blocked = fullDays[name] || new Set();
    const short = shortDays[name] || new Map();

    for (let w = 0; w < WEEKS_AHEAD; w++) {
      const shifts = [];
      for (let d = 0; d < 5; d++) {
        const date = new Date(monday);
        date.setUTCDate(date.getUTCDate() + w * 7 + d);
        const dateStr = date.toISOString().substring(0, 10);
        if (dateStr < todayStr) continue;
        if (roster.hours[d] <= 0) continue;
        if (blocked.has(dateStr)) { skippedVak++; continue; }
        // hele window t/m sept = CEST
        const off = '+02:00';
        const to = short.has(dateStr) ? short.get(dateStr) : endTime(roster.start, roster.hours[d]);
        shifts.push({
          time_from: `${dateStr}T${roster.start}:00${off}`,
          time_to: `${dateStr}T${to}:00${off}`,
          working: true,
        });
      }
      if (shifts.length === 0) continue;
      if (!EXECUTE) {
        for (const s of shifts) console.log(`  ${name}: ${s.time_from.substring(0, 16)} -> ${s.time_to.substring(11, 16)}`);
        written += shifts.length;
        continue;
      }
      const res = await planado(`/users/${user.uuid}/shifts`, { method: 'PATCH', body: JSON.stringify({ shifts }) });
      if (res.status === 204 || res.ok) written += shifts.length;
      else { errors++; console.log(`  ✗ ${name} week ${w}: ${res.status} ${res.text.substring(0, 150)}`); }
      await sleep(500);
    }
    console.log(`  ${name}: rooster gezet (vakantiedagen overgeslagen: ${(fullDays[name] || new Set()).size})`);
  }
  console.log(`\nKlaar: ${written} shift-dagen ${EXECUTE ? 'geschreven' : 'gepland (dry run)'}, ${skippedVak} vakantiedagen opengelaten, ${errors} fouten.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
