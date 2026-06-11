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
  { label: 'nl.sonty.offerte-controle-v3', log: 'offerte-controle-v3.log', maxLogAgeH: 30, name: 'Offerte controle v3' },
  { label: 'nl.sonty.gripp-invullen', log: 'gripp-invullen.log', maxLogAgeH: 26, name: 'Gripp invullen' },
  { label: 'nl.sonty.followup-whatsapp', log: 'followup-whatsapp.log', maxLogAgeH: 26, name: 'Follow-up WhatsApp' },
  { label: 'nl.sonty.telegram-poll', log: null, maxLogAgeH: null, name: 'Telegram poll' },
  { label: 'nl.sonty.auto-sync', log: 'sync.log', maxLogAgeH: 3, name: 'Auto-sync (Outlook/Planado)' },
  { label: 'nl.sonty.auto-resume', log: null, maxLogAgeH: null, name: 'Auto-resume' },
  { label: 'nl.sonty.feedback-processor', log: null, maxLogAgeH: null, name: 'Feedback processor' },
];

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
        if (/(TypeError|ReferenceError|ECONNREFUSED|ECONNRESET|UnhandledPromise)/.test(lastRun)) issues.push('error in laatste run');
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
    await sendTelegram('✅ Health check: alle ' + DAEMONS.length + ' daemons healthy');
  }
}

main().catch(async (e) => {
  console.error(e);
  await sendTelegram('🚨 Health check script zelf gecrasht: ' + e.message);
  process.exit(1);
});
