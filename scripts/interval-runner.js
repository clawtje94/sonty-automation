#!/usr/bin/env node
// Interval-runner: vangnet voor launchd StartInterval-jobs.
//
// Waarom (02-09-2026): om 00:42 stopten ALLE nl.sonty.*-jobs met StartInterval in het
// gui/501-domein (brein-collect 60s, inmeet-dashboard 1800s, vakanties-collect 300s, ...).
// Kalender-jobs (StartCalendarInterval) en KeepAlive-daemons bleven wél draaien. Kickstart
// werkt, herladen (bootout+bootstrap) niet, een verse 15s-testjob vuurde ook niet: de
// timer-planning van launchd zelf lag stil. Gevolg: 12 uur geen inmeet-rondes, geen Sunny-
// voorstellen, geen brein, geen vakantie-sync.
//
// Wat dit doet: als KeepAlive-daemon elke 10 s alle StartInterval-plists lezen en per job
// `launchctl kickstart` doen zodra zijn interval verstreken is. Kickstart op een job die
// nog loopt is een no-op (launchd weigert), dus geen dubbele instanties.
// Zelfrem: als launchd zelf weer runs telt die wij niet aanjoegen (runs-teller stijgt zonder
// onze kickstart), gaat de runner PASSIEF voor die job en logt dat — geen dubbel werk als
// launchd herstelt (bijv. na uit-/inloggen of herstart).
//
// Handmatig: node scripts/interval-runner.js --eens   (één ronde, toont wat hij zou doen)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME = process.env.HOME || '/Users/clawdboot';
const AGENTS = path.join(HOME, 'Library', 'LaunchAgents');
const LOG = path.join(__dirname, '..', 'logs', 'interval-runner.log');
const STATE = path.join(__dirname, '..', 'data', 'interval-runner-state.json');
const EIGEN = 'nl.sonty.interval-runner';
const TIK_MS = 10_000;
const EENS = process.argv.includes('--eens');

function log(t) {
  const r = `${new Date().toISOString()} ${t}\n`;
  try { fs.appendFileSync(LOG, r); } catch { /* geen log is geen ramp */ }
  if (EENS) process.stdout.write(r);
}
function laadState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } }
function bewaarState(s) { try { fs.writeFileSync(STATE, JSON.stringify(s, null, 1)); } catch { /* best effort */ } }

/** Alle nl.sonty.*-plists met StartInterval: { label, interval } */
function intervalJobs() {
  const uit = [];
  for (const f of fs.readdirSync(AGENTS)) {
    if (!f.startsWith('nl.sonty.') || !f.endsWith('.plist')) continue;
    const label = f.slice(0, -6);
    if (label === EIGEN) continue;
    let xml = '';
    try { xml = fs.readFileSync(path.join(AGENTS, f), 'utf8'); } catch { continue; }
    const m = xml.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/);
    if (!m) continue;
    uit.push({ label, interval: Number(m[1]) });
  }
  return uit;
}

/** launchctl print → { geladen, runs, draait } */
function status(label) {
  try {
    const t = execFileSync('launchctl', ['print', `gui/501/${label}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const runs = Number((t.match(/\bruns = (\d+)/) || [])[1] || 0);
    const draait = /^\s*state = running/m.test(t) || /\bpid = \d+/.test(t);
    return { geladen: true, runs, draait };
  } catch { return { geladen: false, runs: 0, draait: false }; }
}

function kickstart(label) {
  try { execFileSync('launchctl', ['kickstart', `gui/501/${label}`], { stdio: 'ignore' }); return true; } catch { return false; }
}

function ronde() {
  const state = laadState();
  const nu = Date.now();
  let aangejaagd = 0, passief = 0;
  for (const job of intervalJobs()) {
    const st = status(job.label);
    if (!st.geladen) continue; // uitgeschakeld/niet geladen: niet onze zaak
    const s = state[job.label] || { laatste: 0, runs: st.runs, passiefTot: 0, eersteGezien: nu };
    // Zelfrem: telt launchd runs die wij niet aanjoegen? Dan leeft de timer → 2 intervallen passief.
    const verwacht = s.runs + (s.kickTeller || 0);
    if (st.runs > verwacht) {
      s.passiefTot = nu + 2 * job.interval * 1000;
      if (!s.passiefGemeld) { log(`${job.label}: launchd telt zelf runs (${st.runs} > ${verwacht}) — timer leeft, runner passief`); s.passiefGemeld = true; }
    }
    s.runs = st.runs; s.kickTeller = 0;
    if (nu < (s.passiefTot || 0)) { passief++; state[job.label] = s; continue; }
    s.passiefGemeld = false;
    const basis = s.laatste || s.eersteGezien || nu;
    if (nu - basis >= job.interval * 1000 && !st.draait) {
      if (EENS) log(`zou kickstarten: ${job.label} (interval ${job.interval}s, laatste ${s.laatste ? new Date(s.laatste).toISOString() : 'nooit'})`);
      else if (kickstart(job.label)) { s.laatste = nu; s.kickTeller = 1; aangejaagd++; log(`kickstart ${job.label} (elke ${job.interval}s)`); }
      else log(`kickstart ${job.label} MISLUKT`);
    }
    state[job.label] = s;
  }
  bewaarState(state);
  return { aangejaagd, passief };
}

if (EENS) { const r = ronde(); log(`eens: ${JSON.stringify(r)}`); process.exit(0); }
log(`interval-runner gestart (${intervalJobs().length} interval-jobs, tik ${TIK_MS / 1000}s)`);
setInterval(() => { try { ronde(); } catch (e) { log(`ronde-fout: ${e.message}`); } }, TIK_MS);
