#!/usr/bin/env node
/**
 * Sync-hooks Reuzenpanda/Trengo → HubSpot — draait elke 15 min via crontab.
 *
 * Spawnt (detached, met eigen logbestand in logs/):
 *  - hubspot-bel-taken.js recent        → logs/bel-taken.log
 *  - hubspot-enrich-rp-api.js recent    → logs/rp-enrich.log
 *  - hubspot-sync-trengo-wa.js recent   → logs/trengo-wa-sync.log
 *  - hubspot-trengo-summary.js recent   → logs/trengo-summary.log
 *  - sales-report.js dag (1x/dag na 18:00) → logs/sales-report.log
 *
 * De oude Playwright RP-browser-sync + WhatsApp-flow is verwijderd (2026-07-02):
 * die was al uitgeschakeld (dead code na een return), faalde structureel
 * ("Failed to fetch backend.reuzenpanda.nl") en bevatte een plaintext wachtwoord.
 * Vervanging: hubspot-enrich-rp-api.js (pure API).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

function ts() { return '[' + new Date().toISOString().substring(11, 19) + '] '; }

// Spawn een subscript detached, maar mét logging: stdout+stderr appenden naar logs/<logName>.
// (Voorheen stdio:'ignore' — daardoor stierven subscripts onzichtbaar, zonder log of alert.)
function spawnLogged(script, args, logName) {
  try {
    const logPath = path.join(LOGS_DIR, logName);
    const fd = fs.openSync(logPath, 'a');
    fs.writeSync(fd, '\n' + ts() + '=== start ' + script + ' ' + args.join(' ') + ' ===\n');
    const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
      detached: true,
      stdio: ['ignore', fd, fd],
    });
    child.unref();
    fs.closeSync(fd); // child houdt zijn eigen kopie van de fd
  } catch (e) {
    console.log(ts() + 'spawn ' + script + ' mislukt: ' + e.message);
  }
}

function main() {
  console.log(ts() + 'Sync start');

  // Bel-taken voor nieuwe leads (afgelopen 2u) — non-blocking, faalt nooit de sync.
  spawnLogged('hubspot-bel-taken.js', ['recent'], 'bel-taken.log');

  // Reuzenpanda-data (product/prijs/offerte-link) + WhatsApp/mail-status bijwerken voor nieuwe leads
  spawnLogged('hubspot-enrich-rp-api.js', ['recent'], 'rp-enrich.log');
  spawnLogged('hubspot-sync-trengo-wa.js', ['recent'], 'trengo-wa-sync.log');
  spawnLogged('hubspot-trengo-summary.js', ['recent'], 'trengo-summary.log');

  // Dagelijks sales-monitoring rapport naar Telegram (1x per dag, na 18:00)
  try {
    const mark = path.join(__dirname, '.sales-report-date.txt');
    const today = new Date().toISOString().slice(0, 10);
    let last = ''; try { last = fs.readFileSync(mark, 'utf8').trim(); } catch (e) {}
    if (new Date().getHours() >= 18 && last !== today) {
      spawnLogged('sales-report.js', ['dag'], 'sales-report.log');
      fs.writeFileSync(mark, today);
    }
  } catch (e) {
    console.log(ts() + 'sales-report check mislukt: ' + e.message);
  }

  console.log(ts() + 'API-hooks gestart.');
}

main();
