#!/usr/bin/env node
/**
 * Health check voor alle Sonty daemons/processen
 *
 * Draait 2x per dag (08:00 en 19:00) via launchd
 *
 * Checkt per daemon:
 * 1. Geladen in launchd?
 * 2. Laatste exit code = 0?
 * 3. Log recent genoeg (heeft hij gedraaid wanneer verwacht)?
 * 4. Errors in recente log output?
 *
 * Stuurt Telegram alert ALLEEN bij problemen + korte dagelijkse OK-melding om 08:00
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const LOGS_DIR = '/Users/clawdboot/sonty/logs';

// Verwachte actieve daemons + max uren sinds laatste log update
const DAEMONS = [
  { label: 'nl.sonty.offerte-v4', log: 'v4.log', maxLogAgeH: 30, name: 'Offerte controle v4' },
  { label: 'nl.sonty.v4-selfcheck', log: 'v4-selfcheck.log', maxLogAgeH: 30, name: 'V4 self-check' },
  { label: 'nl.sonty.gripp-invullen', log: 'gripp-invullen.log', maxLogAgeH: 26, name: 'Gripp invullen' },
  // Follow-up WhatsApp bewust verwijderd uit de check (Daimy 2026-07-14: "gaan we nooit meer aanzetten")
  { label: 'nl.sonty.telegram-poll', log: null, maxLogAgeH: null, name: 'Telegram poll' },
  { label: 'nl.sonty.reviews-sync', log: 'reviews-sync.log', maxLogAgeH: 26, name: 'Reviews-sync' },
  { label: 'nl.sonty.auto-resume', log: null, maxLogAgeH: null, name: 'Auto-resume' },
  { label: 'nl.sonty.feedback-processor', log: null, maxLogAgeH: null, name: 'Feedback processor' },
];
// NB: nl.sonty.auto-sync is hier bewust weg — de RP→HubSpot-sync draait via crontab,
// niet via launchd. Die wordt hieronder gecheckt op de mtime van logs/sync.log.
// De Outlook/Planado-sync uit de oude naam bestaat niet meer als daemon.

async function sendTelegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

function checkDaemon(d) {
  const issues = [];
  let out = '';
  try {
    out = execSync('launchctl print gui/501/' + d.label + ' 2>&1', { encoding: 'utf8' });
  } catch {
    issues.push('NIET GELADEN in launchd');
    return issues;
  }
  if (out.includes('Could not find service')) {
    issues.push('NIET GELADEN in launchd');
    return issues;
  }

  // Exit code check
  const exitMatch = out.match(/last exit code = (\S+)/);
  if (exitMatch && exitMatch[1] !== '0' && exitMatch[1] !== '(never') {
    issues.push('laatste exit code: ' + exitMatch[1]);
  }

  // Log leeftijd check
  if (d.log && d.maxLogAgeH) {
    const logPath = path.join(LOGS_DIR, d.log);
    if (fs.existsSync(logPath)) {
      const ageH = (Date.now() - fs.statSync(logPath).mtimeMs) / 3600000;
      if (ageH > d.maxLogAgeH) {
        issues.push('log ' + Math.round(ageH) + 'u oud (max ' + d.maxLogAgeH + 'u) — draait hij wel?');
      }
      // Errors in output van de LAATSTE run (na laatste "start" marker)
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const lastStart = content.lastIndexOf('start');
        const lastRun = lastStart >= 0 ? content.substring(lastStart) : content.slice(-3000);
        if (/SELF-CHECK FAIL/i.test(lastRun)) issues.push('SELF-CHECK FAIL in laatste run');
        // Filter retry-meldingen eruit — alleen echte crashes tellen
        const lastRunClean = lastRun.replace(/\(netwerkfout, poging .+?\)/g, '');
        if (/(TypeError|ReferenceError|ECONNREFUSED|ECONNRESET|UnhandledPromise)/.test(lastRunClean)) issues.push('error in laatste run');
      } catch {}
    } else {
      issues.push('logbestand ontbreekt');
    }
  }

  return issues;
}

async function main() {
  const now = new Date();
  const results = [];
  let problems = 0;

  for (const d of DAEMONS) {
    const issues = checkDaemon(d);
    if (issues.length > 0) {
      problems++;
      results.push('❌ ' + d.name + ': ' + issues.join(', '));
    } else {
      results.push('✅ ' + d.name);
    }
  }

  // RP→HubSpot sync (crontab, elke 15 min): check dat logs/sync.log vers is
  try {
    const syncLog = path.join(LOGS_DIR, 'sync.log');
    if (!fs.existsSync(syncLog)) { results.push('❌ RP→HubSpot sync (cron): sync.log ontbreekt'); problems++; }
    else {
      const ageMin = (Date.now() - fs.statSync(syncLog).mtimeMs) / 60000;
      if (ageMin > 30) { results.push('❌ RP→HubSpot sync (cron): laatste run ' + Math.round(ageMin) + ' min geleden (verwacht elke 15 min)'); problems++; }
      else results.push('✅ RP→HubSpot sync (cron)');
    }
  } catch (e) { results.push('❌ RP→HubSpot sync (cron): check faalde: ' + e.message); problems++; }

  // Sales-bot: staat sinds 20 mei uit (plist bestaat, niet geladen). Waarschuwing, geen alarm.
  try {
    let loaded = true;
    try {
      const out = execSync('launchctl print gui/501/nl.sonty.sales-bot 2>&1', { encoding: 'utf8' });
      if (out.includes('Could not find service')) loaded = false;
    } catch { loaded = false; }
    results.push(loaded ? '✅ Sales-bot (WhatsApp AI)' : '⚠️ Sales-bot (WhatsApp AI): staat uit sinds 20 mei — bewust? (plist bestaat, niet geladen)');
  } catch {}

  // Schijfruimte check
  try {
    const df = execSync("df -h / | tail -1 | awk '{print $5}'", { encoding: 'utf8' }).trim();
    const pct = parseInt(df);
    if (pct > 90) { results.push('❌ Schijf ' + df + ' vol'); problems++; }
  } catch {}

  console.log('[' + now.toISOString().substring(11, 19) + '] Health check:');
  console.log(results.join('\n'));

  // Telegram: altijd bij problemen, anders alleen korte OK-melding bij ochtendrun (voor 12:00)
  if (problems > 0) {
    await sendTelegram('🚨 HEALTH CHECK: ' + problems + ' probleem(en)\n\n' + results.join('\n'));
  } else if (now.getHours() < 12) {
    const warnings = results.filter(r => r.startsWith('⚠️'));
    await sendTelegram('✅ Health check: alles healthy' + (warnings.length ? '\n\n' + warnings.join('\n') : ''));
  }
}

main().catch(async (e) => {
  console.error(e);
  await sendTelegram('🚨 Health check script zelf gecrasht: ' + e.message);
  process.exit(1);
});
