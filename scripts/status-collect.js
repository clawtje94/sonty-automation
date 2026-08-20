#!/usr/bin/env node
// Verzamelt de status van alle nl.sonty.*-diensten en pusht die naar het dashboard
// sonty-website.vercel.app/admin/systemen. Sinds 15-08 register-gedreven:
//
//   data/systemen-register.json  = DE bron van waarheid (naam, functie, bewaking)
//   KV systemen:config           = bewerkingen vanuit het dashboard (declaratief);
//                                  worden hier elke ronde op het register toegepast
//                                  en teruggeschreven, zodat Mac en site gelijk lopen
//
// Bewaakt bovendien de SAMENWERKING, niet alleen het draaien:
//   - drift: dienst zonder registratie / registratie zonder dienst → zichtbaar + melding
//   - heartbeat: permanente pollers die stil vallen worden ZELF herstart (kickstart)
//   - nieuw-rood: elke dienst die rood wordt → één gebundelde Telegram-melding
// Schrijft lokaal data/system-status.json (ook de dedupe-basis voor meldingen).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const SECRETS = require('./secrets.js');

const HOME = process.env.HOME;
const LOGS = '/Users/clawdboot/sonty/logs';
const AGENTS = path.join(HOME, 'Library', 'LaunchAgents');
const REGISTER = '/Users/clawdboot/sonty/data/systemen-register.json';
const UIT = '/Users/clawdboot/sonty/data/system-status.json';
const KILL_DIR = '/Users/clawdboot/sonty/data/kill';
const API = 'https://sonty-website.vercel.app/api/admin/systemen';

function launchStatus(label) {
  try {
    const out = execSync(`launchctl print gui/501/${label} 2>&1`, { encoding: 'utf8' });
    const pid = (out.match(/pid = (\d+)/) || [])[1];
    const exit = (out.match(/last exit code = ([^\n]+)/) || [])[1]?.trim();
    const interval = (out.match(/run interval = (\d+)/) || [])[1];
    return { geladen: true, draait: !!pid, laatsteExit: exit || null, intervalSec: interval ? +interval : null };
  } catch { return { geladen: false, draait: false, laatsteExit: null, intervalSec: null }; }
}

async function telegram(tekst) {
  try {
    await fetch(`https://api.telegram.org/bot${SECRETS.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: SECRETS.TELEGRAM_CHAT_ID, text: tekst }),
    });
  } catch { /* melding is best effort; dashboard toont het ook */ }
}

/** Dashboard-bewerkingen (KV systemen:config) toepassen op het register. Declaratief:
 *  elke ronde opnieuw toepassen is veilig; alleen bij echte wijziging schrijven we terug. */
async function pasConfigToe(register) {
  let config = null;
  try {
    const r = await fetch(API + '?config=1', { headers: { Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD } });
    if (r.ok) config = (await r.json()).config || null;
  } catch { /* geen config te halen: register blijft zoals het is */ }
  if (!config) return false;
  let gewijzigd = false;
  for (const [label, wijziging] of Object.entries(config)) {
    const d = register.diensten[label];
    if (!d || typeof wijziging !== 'object') continue;
    for (const veld of ['naam', 'functie', 'groep', 'ritme']) {
      if (typeof wijziging[veld] === 'string' && wijziging[veld].trim() && wijziging[veld] !== d[veld]) {
        d[veld] = wijziging[veld].trim().slice(0, 300);
        gewijzigd = true;
      }
    }
    if ((typeof wijziging.maxUur === 'number' || wijziging.maxUur === null) && wijziging.maxUur !== d.maxUur) {
      d.maxUur = wijziging.maxUur;
      gewijzigd = true;
    }
    // aan/uit via kill-switch-bestand: dashboard zet gewenste staat, wij voeren uit
    if (typeof wijziging.uit === 'boolean') {
      const killPad = path.join(KILL_DIR, label);
      const staatUit = fs.existsSync(killPad);
      if (wijziging.uit && !staatUit) {
        fs.mkdirSync(KILL_DIR, { recursive: true });
        fs.writeFileSync(killPad, 'via dashboard ' + new Date().toISOString());
        console.log(`  kill-switch AAN voor ${label} (via dashboard)`);
      } else if (!wijziging.uit && staatUit) {
        fs.unlinkSync(killPad);
        console.log(`  kill-switch UIT voor ${label} (via dashboard)`);
      }
    }
  }
  return gewijzigd;
}

(async () => {
  const register = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const configGewijzigd = await pasConfigToe(register);
  if (configGewijzigd) {
    register.bijgewerkt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(REGISTER, JSON.stringify(register, null, 1));
    console.log('  register bijgewerkt vanuit dashboard-bewerkingen');
  }

  const plists = fs.readdirSync(AGENTS).filter((f) => f.startsWith('nl.sonty.') && f.endsWith('.plist'));
  const actieveLabels = plists.filter((f) => !f.includes('.disabled')).map((f) => f.replace('.plist', ''));
  const disabledLabels = plists.filter((f) => f.includes('.disabled')).map((f) => f.replace('.disabled.plist', '').replace('.plist', ''));

  // vorige statussen voor nieuw-rood-detectie
  let vorige = {};
  try { vorige = Object.fromEntries((JSON.parse(fs.readFileSync(UIT, 'utf8')).systemen || []).map((s) => [s.label, s.status])); } catch {}

  const meldingen = [];
  const systemen = [];

  const alleLabels = [...new Set([...actieveLabels, ...disabledLabels, ...Object.keys(register.diensten)])];
  for (const label of alleLabels) {
    const info = register.diensten[label];
    const heeftPlist = actieveLabels.includes(label);
    const isDisabled = disabledLabels.includes(label) || info?.uitgeschakeld;

    // DRIFT 1: draaiende dienst zonder registratie — zichtbaar maken, niet verstoppen
    if (!info) {
      const ls = launchStatus(label);
      systemen.push({
        label, naam: label, functie: 'NIET GEREGISTREERD — voeg toe aan data/systemen-register.json', groep: 'Overig',
        ...ls, logLeeftijdMin: null, logLaatste: null, killSwitch: false, status: 'oranje',
      });
      if (vorige[label] !== 'oranje') meldingen.push(`🆕 Dienst ${label} draait maar staat niet in het systemen-register — registreren graag.`);
      continue;
    }

    // DRIFT 2: geregistreerd maar dienst bestaat niet meer (en is niet bewust uit)
    if (!heeftPlist && !isDisabled) {
      systemen.push({
        label, naam: info.naam, functie: info.functie, groep: info.groep, ritme: info.ritme,
        geladen: false, draait: false, laatsteExit: null, intervalSec: null,
        logLeeftijdMin: null, logLaatste: null, killSwitch: false, status: 'rood',
      });
      if (vorige[label] !== 'rood') meldingen.push(`❌ ${info.naam} (${label}) staat in het register maar de launchd-dienst is verdwenen.`);
      continue;
    }

    const ls = isDisabled ? { geladen: false, draait: false, laatsteExit: null, intervalSec: null } : launchStatus(label);
    let logLeeftijdMin = null, logLaatste = null;
    if (info.log) {
      try {
        const p = info.log.startsWith('/') ? info.log : path.join(LOGS, info.log);
        logLeeftijdMin = Math.round((Date.now() - fs.statSync(p).mtimeMs) / 60000);
        const regels = fs.readFileSync(p, 'utf8').trim().split('\n');
        logLaatste = (regels[regels.length - 1] || '').slice(0, 160);
      } catch {}
    }
    const killSwitch = fs.existsSync(path.join(KILL_DIR, label));

    let status = 'groen';
    if (isDisabled) status = 'uit';
    else if (!ls.geladen) status = 'rood';
    else if (ls.laatsteExit && ls.laatsteExit !== '0' && ls.laatsteExit !== '(never exited)' && ls.laatsteExit !== '-15'
      && !ls.draait /* draait hij nu, dan is een oude exitcode geschiedenis (Daimy 20-08) */
      && !/exit 1 betekent/i.test(info.functie || '') /* gesprek-lab: exit 1 is zijn rapport */) status = 'rood';
    else if (info.maxUur && logLeeftijdMin !== null && logLeeftijdMin > info.maxUur * 60) status = 'rood';
    else if (info.log && logLeeftijdMin === null) status = 'oranje';

    // HEARTBEAT + ZELFHERSTEL: permanente pollers die stil vallen zelf herstarten
    // (telegram-poll hing 11-08 en 15-08 2x zonder alarm — Daimy's lijn naar Claude).
    if (info.heartbeat && !isDisabled && !killSwitch) {
      let stilMin = null;
      try { stilMin = Math.round((Date.now() - fs.statSync(info.heartbeat.bestand).mtimeMs) / 60000); } catch {}
      if (stilMin === null || stilMin > info.heartbeat.maxStilMin) {
        status = 'rood';
        if (info.heartbeat.zelfherstel) {
          try {
            execSync(`launchctl kickstart -k gui/501/${label}`, { encoding: 'utf8' });
            meldingen.push(`🔄 ${info.naam} was ${stilMin === null ? 'zonder levensteken' : stilMin + ' min stil'} — automatisch herstart. Volgende ronde hoort hij weer groen te zijn.`);
            status = 'oranje'; // herstart ingezet; volgende ronde bewijst het
          } catch {
            meldingen.push(`❌ ${info.naam} is stil EN de automatische herstart faalde — handmatig kijken (launchctl kickstart -k gui/501/${label}).`);
          }
        }
      }
    }
    if (killSwitch) status = 'uit';

    if (status === 'rood' && vorige[label] !== 'rood') {
      meldingen.push(`🔴 ${info.naam} (${label}) is ROOD: ${!ls.geladen ? 'niet geladen' : (info.maxUur && logLeeftijdMin > info.maxUur * 60 ? `log al ${Math.round(logLeeftijdMin / 60)}u stil` : 'exitcode ' + ls.laatsteExit)}.`);
    }

    systemen.push({ label, naam: info.naam, functie: info.functie, groep: info.groep, ritme: info.ritme, keten: info.keten || null, ...ls, logLeeftijdMin, logLaatste, killSwitch, status });
  }

  const payload = { bijgewerkt: new Date().toISOString(), host: 'mac-mini', systemen };
  fs.mkdirSync(path.dirname(UIT), { recursive: true });
  fs.writeFileSync(UIT, JSON.stringify(payload, null, 1));

  if (meldingen.length) await telegram('SYSTEMEN:\n' + meldingen.slice(0, 10).join('\n'));

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD },
      body: JSON.stringify(payload),
    });
    console.log(`[${new Date().toLocaleTimeString()}] ${systemen.length} diensten, ${meldingen.length} melding(en), push: ${r.status}`);
  } catch (e) { console.log('push mislukt (dashboard loopt achter, verder geen impact):', e.message); }
})();
