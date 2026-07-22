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
  // SONNY (AI-klantenservice) — moet ALTIJD aanstaan (Daimy 2026-07-17). Permanente
  // launchd-dienst met KeepAlive; log wordt elke 30s bijgeschreven, dus 1u stilte = probleem.
  { label: 'nl.sonty.sonny', log: 'sonny-watch.log', maxLogAgeH: 1, name: 'SONNY klantenservice (permanent)' },
  // SUNNY e-mail (aanvragen@) — permanente launchd-dienst, pollt elke 90s en schrijft altijd een
  // regel weg, dus 1u stilte = probleem.
  { label: 'nl.sonty.email', log: 'email-daemon.log', maxLogAgeH: 1, name: 'SUNNY e-mail (permanent)' },
  { label: 'nl.sonty.sonny-rapport', log: null, maxLogAgeH: null, name: 'Sonny ochtendrapport 08:30' },
  { label: 'nl.sonty.getekend-rapport', log: 'getekend-rapport.log', maxLogAgeH: 30, name: 'Dagrapport tekeningen + AI-resultaten 07:45' },
  // 2-uurs watchdog; drempel 14u zodat normale nachtelijke slaap/downtime geen vals alarm geeft
  // (de watchdog heeft z'n eigen credits-op-alarm, dus een echt creditprobleem meldt hij los).
  { label: 'nl.sonty.credits-check', log: 'credits-check.log', maxLogAgeH: 14, name: 'Anthropic credits-watchdog' },
  // Opvolging draait t/m ±28 juli in SCHADUW (verstuurt niets; dagelijks 10:30 een voorstel-rapport naar Daimy)
  { label: 'nl.sonty.opvolging-schaduw', log: 'opvolging.log', maxLogAgeH: 26, name: 'Opvolging (schaduwweek)' },
  // Planning-mail: verwerkt orders@/info@ in de Planning-sheet (tab Claude ai test), elke 30 min.
  // Logt elke ronde (ook "lock actief"), dus 2u stilte = probleem.
  { label: 'nl.sonty.planning-mail', log: 'planning-mail-daemon.log', maxLogAgeH: 2, name: 'Planning-mail (orders@/info@ -> sheet)' },
];

// Extra Sonny-check: staat de Telegram-inbox verdacht lang stil? (poller bevroor 2x op 16-17 juli)
async function checkTelegramInbox() {
  // Stille inbox is normaal (geen berichten = geen writes). Echte test: houdt de poller de
  // getUpdates-verbinding vast? Een 409 Conflict bewijst dat hij leeft; een 200 met
  // WACHTENDE berichten bewijst dat hij dood is (dan zou hij ze opgehaald hebben).
  try {
    const r = await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/getUpdates?timeout=0&limit=1', { signal: AbortSignal.timeout(8000) });
    if (r.status === 409) return []; // poller heeft de verbinding — gezond
    const j = await r.json().catch(() => ({}));
    if (j.ok && (j.result || []).length > 0) return ['poller haalt berichten NIET op (er staan er ' + j.result.length + '+ te wachten) — launchctl kickstart -k gui/501/nl.sonty.telegram-poll'];
    return []; // geen wachtende berichten — onbeslist maar geen alarm
  } catch { return []; } // netwerkprobleem bij de check zelf ≠ poller kapot
}
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

  // Telegram-inbox versheid (Sonny-communicatiekanaal met Daimy)
  const inboxIssues = await checkTelegramInbox();
  if (inboxIssues.length) { problems++; results.push('❌ Telegram-inbox: ' + inboxIssues.join(', ')); }
  else results.push('✅ Telegram-inbox');

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

  // MS Bookings API (showroomafspraken van de AI-KS, 21 juli): auth/refresh-token nog geldig?
  try {
    const b = require('./bookings-api.js');
    const diensten = await Promise.race([
      b.services('SontyMontage1@sontymontage.nl'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout na 30s')), 30000)),
    ]);
    if (!Array.isArray(diensten) || !diensten.length) { results.push('❌ MS Bookings API: onverwacht leeg antwoord'); problems++; }
    else results.push('✅ MS Bookings API (showroom-boeken)');
  } catch (e) { results.push('❌ MS Bookings API: ' + String(e.message).slice(0, 120) + ' — showroom-boeken werkt mogelijk niet, check scripts/.bookings-refresh-token.txt'); problems++; }

  // Sales-bot: op 16 juli 2026 DEFINITIEF uitgezet (vervangen door SONNY/AI-KS; plist in
  // uitgeschakeld/). Alarm juist als hij per ongeluk WEL geladen zou zijn.
  try {
    let loaded = true;
    try {
      const out = execSync('launchctl print gui/501/nl.sonty.sales-bot 2>&1', { encoding: 'utf8' });
      if (out.includes('Could not find service')) loaded = false;
    } catch { loaded = false; }
    if (loaded) { problems++; results.push('❌ OUDE sales-bot draait — hoort UIT te staan (vervangen door Sonny)!'); }
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
