#!/usr/bin/env node
// Verzamelt de status van alle nl.sonty.*-diensten (read-only: launchctl + log-mtimes)
// en pusht die naar het dashboard sonty-website.vercel.app/admin/systemen.
// Schrijft ook lokaal data/system-status.json. Raakt verder NIETS aan.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const SECRETS = require('./secrets.js');

const LOGS = '/Users/clawdboot/sonty/logs';
const AGENTS = path.join(process.env.HOME, 'Library', 'LaunchAgents');
const UIT = '/Users/clawdboot/sonty/data/system-status.json';
const KILL_DIR = '/Users/clawdboot/sonty/data/kill';
const API = 'https://sonty-website.vercel.app/api/admin/systemen';

// Omschrijving + verwachte log per dienst (sync met SYSTEMEN.md)
const INFO = {
  'nl.sonty.sonny': { naam: 'AI-klantenservice WhatsApp', groep: 'Klantgericht', log: 'sonny-watch.log', maxUur: 1 },
  'nl.sonty.email': { naam: 'AI-klantenservice e-mail (aanvragen@ + info@)', groep: 'Klantgericht', log: 'email-daemon.log', maxUur: 1 },
  'nl.sonty.opvolging-schaduw': { naam: 'Offerte-opvolging (schaduw)', groep: 'Klantgericht', log: 'opvolging.log', maxUur: 26 },
  'nl.sonty.planning-mail': { naam: 'Planning: orders@/info@ naar sheet', groep: 'Planning & orders', log: 'planning-mail-daemon.log', maxUur: 2 },
  'nl.sonty.markiezen': { naam: 'Markiezen-workflow', groep: 'Planning & orders', log: 'markiezen.log', maxUur: 30 },
  'nl.sonty.vacaturemail': { naam: 'Vacaturemail-batches (10:30)', groep: 'Rapportage', log: 'vacaturemail.log', maxUur: 30 },
  'nl.sonty.offerte-v4': { naam: 'Offerte-controle v4', groep: 'Offertes & CRM', log: 'v4.log', maxUur: 30 },
  'nl.sonty.v4-selfcheck': { naam: 'V4 self-check', groep: 'Offertes & CRM', log: 'v4-selfcheck.log', maxUur: 30 },
  'nl.sonty.gripp-invullen': { naam: 'Gripp invullen', groep: 'Offertes & CRM', log: 'gripp-invullen.log', maxUur: 26 },
  'nl.sonty.auto-sync': { naam: 'RP naar HubSpot lead-sync', groep: 'Offertes & CRM', log: 'sync.log', maxUur: 2 },
  'nl.sonty.prijs-steekproef': { naam: 'Prijs-steekproef configurator', groep: 'Offertes & CRM', log: 'prijs-steekproef.log', maxUur: 30 },
  'nl.sonty.health-check': { naam: 'Health-check (2x/dag)', groep: 'Bewaking', log: 'health-check.log', maxUur: 14 },
  'nl.sonty.credits-check': { naam: 'Anthropic credits-watchdog', groep: 'Bewaking', log: 'credits-check.log', maxUur: 14 },
  'nl.sonty.tickets-rapport': { naam: 'Dagrapport tickets AI vs Mens (08:15)', groep: 'Rapportage', log: 'tickets-rapport.log', maxUur: 30 },
  'nl.sonty.sonny-rapport': { naam: 'Ochtendrapport AI-gesprekken (08:30)', groep: 'Rapportage', log: 'sonny-rapport.log', maxUur: 26 },
  'nl.sonty.getekend-rapport': { naam: 'Dagrapport tekeningen (07:45)', groep: 'Rapportage', log: 'getekend-rapport.log', maxUur: 30 },
  'nl.sonty.weekrapport': { naam: 'Weekrapport conversie', groep: 'Rapportage', log: 'weekrapport.log', maxUur: 24 * 8 },
  'nl.sonty.qa-leren': { naam: 'QA-leerpunten (07:45)', groep: 'Rapportage', log: 'qa-leren.log', maxUur: 30 },
  'nl.sonty.reviews-sync': { naam: 'Google-reviews naar website', groep: 'Rapportage', log: 'reviews-sync.log', maxUur: 26 },
  'nl.sonty.telegram-poll': { naam: 'Telegram-inbox (berichten Daimy)', groep: 'Infrastructuur', log: null, maxUur: null },
  'nl.sonty.auto-resume': { naam: 'Auto-resume na crash', groep: 'Infrastructuur', log: null, maxUur: null },
  'nl.sonty.feedback-processor': { naam: 'Feedback-verwerker', groep: 'Infrastructuur', log: null, maxUur: null },
  'nl.sonty.status-push': { naam: 'Dit dashboard (status-push)', groep: 'Infrastructuur', log: 'status-push.log', maxUur: 1 },
  'nl.sonty.dummy4k': { naam: 'Virtueel 4K-scherm', groep: 'Infrastructuur', log: null, maxUur: null },
  'nl.sonty.dummy4k-resolution': { naam: 'Schermresolutie bij boot', groep: 'Infrastructuur', log: null, maxUur: null },
};

function launchStatus(label) {
  try {
    const out = execSync(`launchctl print gui/501/${label} 2>&1`, { encoding: 'utf8' });
    const pid = (out.match(/pid = (\d+)/) || [])[1];
    const exit = (out.match(/last exit code = ([^\n]+)/) || [])[1]?.trim();
    const interval = (out.match(/run interval = (\d+)/) || [])[1];
    return { geladen: true, draait: !!pid, laatsteExit: exit || null, intervalSec: interval ? +interval : null };
  } catch { return { geladen: false, draait: false, laatsteExit: null, intervalSec: null }; }
}

(async () => {
  const labels = fs.readdirSync(AGENTS).filter((f) => f.startsWith('nl.sonty.') && f.endsWith('.plist')).map((f) => f.replace('.plist', ''));
  const systemen = labels.map((label) => {
    const info = INFO[label] || { naam: label, groep: 'Overig', log: null, maxUur: null };
    const ls = launchStatus(label);
    let logLeeftijdMin = null, logLaatste = null;
    if (info.log) {
      try {
        const p = path.join(LOGS, info.log);
        logLeeftijdMin = Math.round((Date.now() - fs.statSync(p).mtimeMs) / 60000);
        const regels = fs.readFileSync(p, 'utf8').trim().split('\n');
        logLaatste = (regels[regels.length - 1] || '').slice(0, 160);
      } catch {}
    }
    const killSwitch = fs.existsSync(path.join(KILL_DIR, label));
    // status: rood = niet geladen, exitfout of te oude log; oranje = geen data; groen = ok
    let status = 'groen';
    if (!ls.geladen) status = 'rood';
    else if (ls.laatsteExit && ls.laatsteExit !== '0' && ls.laatsteExit !== '(never exited)') status = 'rood';
    else if (info.maxUur && logLeeftijdMin !== null && logLeeftijdMin > info.maxUur * 60) status = 'rood';
    else if (info.log && logLeeftijdMin === null) status = 'oranje';
    if (killSwitch) status = 'uit';
    return { label, ...info, ...ls, logLeeftijdMin, logLaatste, killSwitch, status };
  });
  const payload = { bijgewerkt: new Date().toISOString(), host: 'mac-mini', systemen };
  fs.mkdirSync(path.dirname(UIT), { recursive: true });
  fs.writeFileSync(UIT, JSON.stringify(payload, null, 1));
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD },
      body: JSON.stringify(payload),
    });
    console.log(`[${new Date().toLocaleTimeString()}] ${systemen.length} diensten, push: ${r.status}`);
  } catch (e) { console.log('push mislukt (dashboard loopt achter, verder geen impact):', e.message); }
})();
