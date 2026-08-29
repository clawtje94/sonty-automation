#!/usr/bin/env node
// BREIN-verzamelaar (launchd nl.sonty.brein-collect, elke 60 s). Alleen-lezen op alles behalve
// data/brein/. Bouwt één momentopname van "het bedrijf" en pusht die naar /api/admin/brein:
//   1. launchd-jobs nl.sonty.* — wat, hoe vaak, laatste run, laatste exitcode, draait nu, log-staart, ALARM
//   2. collega's — aangemelde Claude-sessies (sessies.json) + ongeregistreerde sessies uit ~/.claude
//      (transcripten met recente activiteit), plus de vaste rollen (Sunny, Nanny, …) met hun jobs
//   3. wachtrijen — open aanbiedingen, open mutaties, gesprek-claims, stil-lijst, Sunny-hartslag
//   4. tijdlijn — gebeurtenissen.jsonl + genormaliseerde staarten van de belangrijkste logs
//   5. postvak — opdrachten van de pagina ophalen (nieuw → inbox van de collega), antwoorden terugsturen
// Optioneel (vlag data/brein/.werknemer-aan): opdracht aan "nieuwe werknemer" → start `claude -p` met de taak.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');
const B = require('./lib/brein.js');
const SECRETS = require('./secrets.js');

const HOME = os.homedir();
const SONTY = path.join(HOME, 'sonty');
const LOGS = path.join(SONTY, 'logs');
const API = process.env.BREIN_API || 'https://sonty-website.vercel.app/api/admin/brein';
const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.ADMIN_PASSWORD };
const NU = Date.now();

// ── rollen: welke job hoort bij welke "collega" ──
const ROLLEN = [
  { naam: 'Sunny', rol: 'Klantenservice WhatsApp/mail (AI)', match: /sonny|ai-ks|whatsapp|email-daemon|mail-daemon/ },
  { naam: 'Nanny', rol: 'Planning inmeten', match: /inmeet|aanbod|planner|nacontrole|boeking|planning|vakanties/ },
  { naam: 'Data-bot', rol: 'Data & rapportage', match: /data|rapport|conversie|sheet|capaciteit|selfcheck|v4/ },
  { naam: 'Marketing', rol: 'E-mail & ads', match: /klaviyo|email-|mail-marketing|linkedin|seo|ads|zonradar|vve/ },
  { naam: 'Offerte-controle', rol: 'Offertes & Gripp', match: /offerte|gripp|prijs|meetbon/ },
  { naam: 'Telegram', rol: 'Berichtenverkeer Daimy', match: /telegram|poller|webhook/ },
];
function rolVoor(label) { const l = label.toLowerCase(); return (ROLLEN.find((r) => r.match.test(l)) || { naam: 'Techniek', rol: 'Onderhoud & overig' }); }

// ── 1. launchd-jobs ──
function plistWaarde(xml, key, tag) {
  const m = xml.match(new RegExp(`<key>${key}</key>\\s*<${tag}>([^<]*)</${tag}>`)); return m ? m[1] : null;
}
function leesPlist(p) {
  const xml = fs.readFileSync(p, 'utf8');
  const label = plistWaarde(xml, 'Label', 'string');
  const args = [...xml.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
  const script = args.find((a) => /\.(js|mts|ts|sh|py)$/.test(a)) || args[1] || '';
  const interval = plistWaarde(xml, 'StartInterval', 'integer');
  const keepAlive = /<key>KeepAlive<\/key>\s*<true\/>/.test(xml) || /<key>KeepAlive<\/key>\s*<dict>/.test(xml);
  const runAtLoad = /<key>RunAtLoad<\/key>\s*<true\/>/.test(xml);
  const maandelijks = /<key>Day<\/key>/.test(xml);
  const cal = [...xml.matchAll(/<key>(Hour|Minute|Weekday)<\/key>\s*<integer>(\d+)<\/integer>/g)];
  const uren = cal.filter((c) => c[1] === 'Hour').map((c) => +c[2]);
  const minuten = cal.filter((c) => c[1] === 'Minute').map((c) => +c[2]);
  const weekdagen = cal.filter((c) => c[1] === 'Weekday').map((c) => +c[2]);
  const log = plistWaarde(xml, 'StandardOutPath', 'string') || plistWaarde(xml, 'StandardErrorPath', 'string');
  let schema = keepAlive ? 'permanent (KeepAlive)' : interval ? `elke ${+interval >= 3600 ? Math.round(+interval / 3600) + ' u' : Math.round(+interval / 60) + ' min'}` : uren.length ? `dagelijks ${[...new Set(uren.map((h, i) => `${String(h).padStart(2, '0')}:${String(minuten[i] ?? minuten[0] ?? 0).padStart(2, '0')}`))].join(', ')}${weekdagen.length ? ' (' + [...new Set(weekdagen)].map((d) => ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d]).join('/') + ')' : ''}` : runAtLoad ? 'bij start' : 'handmatig';
  return { label, script: script.replace(HOME, '~'), interval: interval ? +interval : null, keepAlive, uren, minuten, weekdagen, maandelijks, log, schema: maandelijks ? schema.replace('dagelijks', 'maandelijks') : schema };
}
function launchctlPrint(label) {
  try {
    const out = execFileSync('launchctl', ['print', `gui/501/${label}`], { encoding: 'utf8', timeout: 4000 });
    const pak = (re) => { const m = out.match(re); return m ? m[1] : null; };
    return { state: pak(/^\s*state = (.+)$/m), runs: +(pak(/runs = (\d+)/) || 0), exit: pak(/last exit code = (.+)/), pid: pak(/^\s*pid = (\d+)/m) };
  } catch { return { state: 'niet geladen', runs: 0, exit: null, pid: null }; }
}
function logStaart(p, n = 3) {
  try {
    const st = fs.statSync(p); const fd = fs.openSync(p, 'r'); const len = Math.min(st.size, 6000);
    const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, st.size - len); fs.closeSync(fd);
    const regels = buf.toString('utf8').split('\n').filter((r) => r.trim()).slice(-n).map((r) => r.slice(0, 220));
    return { mtime: st.mtimeMs, regels };
  } catch { return { mtime: null, regels: [] }; }
}
function jobs() {
  const dir = path.join(HOME, 'Library', 'LaunchAgents');
  const uit = [];
  for (const f of fs.readdirSync(dir).filter((f) => /^nl\.sonty\..*\.plist$/.test(f))) {
    try {
      const pl = leesPlist(path.join(dir, f));
      const lc = launchctlPrint(pl.label);
      const st = pl.log ? logStaart(pl.log) : { mtime: null, regels: [] };
      const draait = !!lc.pid;
      const laatst = st.mtime;
      let alarm = null;
      const exitSlecht = lc.exit && lc.exit !== '0' && lc.exit !== '(never exited)';
      if (lc.state === 'niet geladen') alarm = 'niet geladen in launchd (plist staat er wel)';
      else if (pl.keepAlive && !draait) alarm = 'permanente job draait NIET';
      else if (pl.interval && laatst && NU - laatst > Math.max(2.5 * pl.interval * 1000, 10 * 60000)) alarm = `al ${Math.round((NU - laatst) / 60000)} min niets in de log (verwacht elke ${pl.schema.replace('elke ', '')})`;
      else if (pl.uren.length && laatst && !pl.maandelijks) {
        const d = new Date(); const vandaagGepland = pl.uren.some((h, i) => d.getHours() * 60 + d.getMinutes() > h * 60 + (pl.minuten[i] ?? pl.minuten[0] ?? 0) + 15);
        const vandaag = new Date(laatst).toDateString() === d.toDateString();
        const dagOk = !pl.weekdagen.length || pl.weekdagen.includes(d.getDay());
        if (vandaagGepland && !vandaag && dagOk) alarm = 'vandaag nog niet gedraaid';
      }
      if (!alarm && exitSlecht && !draait) alarm = `laatste exitcode ${lc.exit}`;
      if (!alarm && st.regels.some((r) => /\b(FOUT|ERROR|Error:|FATAL|ENOENT)\b/.test(r)) && laatst && NU - laatst < 3600000) alarm = 'fout in de laatste logregels';
      const r = rolVoor(pl.label);
      uit.push({ label: pl.label, kort: pl.label.replace('nl.sonty.', ''), script: pl.script, schema: pl.schema, collega: r.naam, draait, pid: lc.pid, runs: lc.runs, exit: lc.exit, laatst: laatst ? new Date(laatst).toISOString() : null, log: pl.log ? pl.log.replace(HOME, '~') : null, staart: st.regels, alarm });
    } catch (e) { uit.push({ label: f, kort: f, alarm: 'plist onleesbaar: ' + e.message.slice(0, 80), staart: [] }); }
  }
  return uit.sort((a, b) => (b.alarm ? 1 : 0) - (a.alarm ? 1 : 0) || (b.laatst || '').localeCompare(a.laatst || ''));
}

// ── 2. collega's: Claude-sessies ──
function claudeProcessen() {
  try {
    const out = execFileSync('ps', ['-axo', 'pid=,lstart=,command='], { encoding: 'utf8', maxBuffer: 8e6 });
    return out.split('\n').filter((r) => /(^|[\s/])claude(\s|$)/.test(r) && !/brein-collect|grep|shell-snapshots/.test(r)).map((r) => { const m = r.trim().match(/^(\d+)\s+(.{24})\s+(.*)$/); return m ? { pid: +m[1], start: m[2], cmd: m[3].slice(0, 120) } : null; }).filter(Boolean);
  } catch { return []; }
}
function transcriptSessies() {
  // ~/.claude/projects/<map>/<sessionId>.jsonl — recent gewijzigd = levende sessie
  const uit = [];
  const root = path.join(HOME, '.claude', 'projects');
  let mappen = []; try { mappen = fs.readdirSync(root); } catch { return uit; }
  for (const map of mappen) {
    let files = []; try { files = fs.readdirSync(path.join(root, map)).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const p = path.join(root, map, f); let st; try { st = fs.statSync(p); } catch { continue; }
      if (NU - st.mtimeMs > 3 * 3600000) continue;
      let eerste = '', laatsteRol = null, cwd = null;
      try {
        const kop = fs.readFileSync(p, { encoding: 'utf8', flag: 'r' }).slice(0, 200000).split('\n');
        for (const regel of kop) {
          if (!regel) continue; let r; try { r = JSON.parse(regel); } catch { continue; }
          if (!cwd && r.cwd) cwd = r.cwd;
          if (!eerste && r.type === 'user' && r.message && typeof r.message.content === 'string' && !r.message.content.startsWith('<') && !/^(A session-scoped|Stop hook|Caveat:|This session is being continued)/.test(r.message.content)) eerste = r.message.content.slice(0, 140);
          if (!eerste && r.type === 'user' && r.message && Array.isArray(r.message.content)) { const t = r.message.content.find((c) => c.type === 'text'); if (t && !t.text.startsWith('<') && !/^(A session-scoped|Stop hook|Caveat:|This session is being continued)/.test(t.text)) eerste = t.text.slice(0, 140); }
          if (eerste && cwd) break;
        }
        const staart = logStaart(p, 2).regels;
        for (const regel of staart) { try { const r = JSON.parse(regel); if (r.type === 'user' || r.type === 'assistant') laatsteRol = r.type; } catch { /* half geschreven regel */ } }
      } catch { /* transcript onleesbaar */ }
      uit.push({ sessionId: f.replace('.jsonl', ''), map: map.replace(/^-Users-clawdboot-?/, '~/'), cwd: cwd ? cwd.replace(HOME, '~') : null, eerste, laatst: new Date(st.mtimeMs).toISOString(), wachtOpMens: laatsteRol === 'assistant' && NU - st.mtimeMs > 90000 });
    }
  }
  return uit.sort((a, b) => b.laatst.localeCompare(a.laatst));
}
function collegas(jobLijst) {
  const gemeld = B.sessies();
  const transcripten = transcriptSessies();
  const procs = claudeProcessen();
  const sessies = [];
  for (const naam of Object.keys(gemeld)) {
    const s = gemeld[naam];
    const tr = transcripten.find((t) => t.sessionId && t.sessionId === s.sessionId);
    const verlopen = s.status !== 'klaar' && NU - Date.parse(s.laatst) > 6 * 3600000 && !(tr && NU - Date.parse(tr.laatst) < 3 * 3600000);
    sessies.push({ naam, rol: s.rol, taak: s.taak, status: verlopen ? 'verlopen' : s.status, sinds: s.sinds, laatst: tr && tr.laatst > s.laatst ? tr.laatst : s.laatst, cwd: s.cwd ? String(s.cwd).replace(HOME, '~') : null, sessionId: s.sessionId, wachtOpMens: tr ? tr.wachtOpMens : null, openOpdrachten: B.opdrachtenVoor(naam).length, aangemeld: true });
  }
  const bekend = new Set(sessies.map((s) => s.sessionId).filter(Boolean));
  for (const t of transcripten.filter((t) => !bekend.has(t.sessionId))) {
    sessies.push({ naam: 'sessie-' + t.sessionId.slice(0, 6), rol: 'claude-sessie (niet aangemeld)', taak: t.eerste, status: NU - Date.parse(t.laatst) < 15 * 60000 ? 'bezig' : 'stil', sinds: null, laatst: t.laatst, cwd: t.cwd || t.map, sessionId: t.sessionId, wachtOpMens: t.wachtOpMens, openOpdrachten: 0, aangemeld: false });
  }
  const rollen = ROLLEN.map((r) => {
    const mijn = jobLijst.filter((j) => j.collega === r.naam);
    return { naam: r.naam, rol: r.rol, jobs: mijn.length, draait: mijn.filter((j) => j.draait).length, alarmen: mijn.filter((j) => j.alarm).length, laatst: mijn.map((j) => j.laatst).filter(Boolean).sort().pop() || null };
  }).concat([{ naam: 'Techniek', rol: 'Onderhoud & overig', jobs: jobLijst.filter((j) => j.collega === 'Techniek').length, draait: jobLijst.filter((j) => j.collega === 'Techniek' && j.draait).length, alarmen: jobLijst.filter((j) => j.collega === 'Techniek' && j.alarm).length, laatst: null }]);
  return { sessies, rollen, claudeProcessen: procs.length };
}

// ── 3. wachtrijen ──
function lees(p, leeg) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return leeg; } }
async function wachtrijen() {
  const planner = lees(path.join(SONTY, 'data', 'inmeten-planner-state.json'), {});
  const tickets = planner.aanbodTickets || {};
  const openAanbod = Object.values(tickets).filter((t) => t && t.verstuurdOp && NU - Date.parse(t.verstuurdOp) < 24 * 3600000).length; // keuzelink geldig 24 u
  const claims = lees(path.join(SONTY, 'data', 'gesprek-claims.json'), {});
  const actieveClaims = Object.entries(claims).filter(([, c]) => c && NU - Date.parse(c.op || c.sinds || 0) < 2 * 3600000).map(([id, c]) => ({ ticket: id, door: c.door || c.wie || '?', op: c.op || c.sinds })).slice(0, 30);
  const stil = lees(path.join(SONTY, 'data', 'monitor-stil.json'), {});
  let hartslag = null; try { hartslag = fs.statSync(path.join(SONTY, 'data', 'sunny-heartbeat.txt')).mtime.toISOString(); } catch { /* geen hartslag */ }
  let mutaties = { open: null, fout: null };
  try {
    const r = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie?status=open', { headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' }, signal: AbortSignal.timeout(15000) });
    const d = await r.json(); const lijst = d.mutaties || [];
    mutaties = { open: lijst.length, items: lijst.slice(0, 20).map((m) => ({ id: m.id, type: m.type, naam: m.naam, bron: m.bron || null, sinds: m.aangemaakt, pogingen: m.pogingen || null, laatsteFout: (m.laatsteFout || m.fout || '').slice(0, 140) })) };
  } catch (e) { mutaties.fout = e.message.slice(0, 100); }
  return { openAanbod, claims: actieveClaims, stilLijst: Object.keys(stil).length, stilNamen: Object.values(stil).map((s) => s.naam).filter(Boolean).slice(0, 20), sunnyHartslag: hartslag, sunnyLeeft: hartslag ? NU - Date.parse(hartslag) < 20 * 60000 : false, mutaties };
}

// ── 4. tijdlijn ──
const LOG_BRONNEN = [
  { wie: 'Nanny', log: 'inmeet-verzoeken.log', re: /^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/ },
  { wie: 'Nanny', log: 'inmeet-dashboard.log', re: /^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/ },
  { wie: 'Nanny', log: 'aanbod-replies.log', re: /^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/ },
  { wie: 'Sunny', log: 'sonny.log', re: /^\[?(\d{4}-\d\d-\d\dT[\d:.]+Z)\]? ?(.*)$/ },
  { wie: 'Sunny', log: 'email-daemon.log', re: /^\[?(\d{4}-\d\d-\d\dT[\d:.]+Z)\]? ?(.*)$/ },
  { wie: 'Nanny', log: 'boeking-nacontrole.log', re: /^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/ },
  { wie: 'Telegram', log: 'telegram-onderdrukt.log', re: /^\[(\d{4}-\d\d-\d\dT[\d:.]+Z)\] (.*)$/ },
];
function tijdlijn() {
  const uit = B.gebeurtenissen({ max: 200, sindsMs: 3 * 86400000 }).map((g) => ({ t: g.t, wie: g.wie, wat: g.wat, bron: 'brein' }));
  for (const b of LOG_BRONNEN) {
    const p = path.join(LOGS, b.log); if (!fs.existsSync(p)) continue;
    for (const regel of logStaart(p, 40).regels) {
      const m = regel.match(b.re); if (!m) continue;
      if (NU - Date.parse(m[1]) > 2 * 86400000) continue;
      if (/^(ronde|ticket|scan|poll|check|\.\.\.)/i.test(m[2]) || m[2].length < 12) continue;
      uit.push({ t: m[1], wie: b.wie, wat: m[2].slice(0, 200), bron: b.log });
    }
  }
  // dubbele regels (zelfde collega + zelfde tekst binnen 30 min) één keer tonen
  uit.sort((a, b) => b.t.localeCompare(a.t));
  const gezien = []; const uniek = [];
  for (const g of uit) {
    const sleutel = g.wie + '|' + g.wat.slice(0, 80);
    const eerder = gezien.find((x) => x.s === sleutel && Math.abs(Date.parse(x.t) - Date.parse(g.t)) < 30 * 60000);
    if (eerder) continue;
    gezien.push({ s: sleutel, t: g.t }); uniek.push(g);
  }
  return uniek.slice(0, 250);
}

// ── 5. postvak-uitwisseling met de pagina ──
async function pushEnHaalOp(snapshot) {
  const antwoorden = B.postvak().filter((o) => o.status !== 'nieuw').slice(-200).map((o) => ({ id: o.id, status: o.status, antwoord: o.antwoord, antwoordOp: o.antwoordOp }));
  const r = await fetch(API, { method: 'POST', headers: AUTH, body: JSON.stringify({ snapshot, antwoorden }), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const d = await r.json();
  let nieuw = 0;
  for (const o of d.nieuweOpdrachten || []) {
    if (o.aan === 'nieuwe werknemer') { startWerknemer(o); continue; }
    if (fs.existsSync(path.join(SONTY, 'medewerkers', o.aan, 'profiel.md'))) { startMedewerkerOpdracht(o); continue; }
    if (B.nieuweOpdracht({ aan: o.aan, tekst: o.tekst, van: o.van || 'Daimy', id: o.id })) nieuw++;
  }
  return nieuw;
}
function startMedewerkerOpdracht(o) {
  if (B.postvak().some((x) => x.id === o.id)) return;
  B.nieuweOpdracht({ aan: o.aan, tekst: o.tekst, van: o.van, id: o.id });
  B.markeer(o.id, 'gestart', `${o.aan} is ermee bezig (medewerker.js opdracht)`);
  const uit = fs.openSync(path.join(B.DIR, `opdracht-${o.id}.log`), 'a');
  const kind = spawn('/opt/homebrew/bin/node', [path.join(SONTY, 'scripts', 'medewerker.js'), 'opdracht', o.aan, o.tekst, o.id], { cwd: SONTY, detached: true, stdio: ['ignore', uit, uit], env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });
  kind.unref();
}
function startWerknemer(o) {
  const vlag = path.join(B.DIR, '.werknemer-aan');
  if (B.postvak().some((x) => x.id === o.id)) return;
  if (!fs.existsSync(vlag)) {
    B.nieuweOpdracht({ aan: 'nieuwe werknemer', tekst: o.tekst, van: o.van, id: o.id });
    B.markeer(o.id, 'geweigerd', 'Werknemers starten staat uit (vlag data/brein/.werknemer-aan ontbreekt). Daimy moet dit eerst aanzetten.');
    return;
  }
  const naam = 'werknemer-' + o.id;
  B.nieuweOpdracht({ aan: naam, tekst: o.tekst, van: o.van, id: o.id });
  const logPad = path.join(B.DIR, `werk-${o.id}.log`);
  const prompt = `Je bent een nieuwe werknemer in het Sonty-bedrijf op deze Mac mini. Meld je eerst aan: node ~/sonty/scripts/brein-sessie.js meld "${naam}" "<korte taakomschrijving>". Voer daarna deze opdracht van ${o.van} uit:\n\n${o.tekst}\n\nRond af met: node ~/sonty/scripts/brein-sessie.js antwoord ${o.id} "<wat je gedaan hebt, kort>" en daarna node ~/sonty/scripts/brein-sessie.js klaar "${naam}". Lees ~/sonty/HANDOFF.md en de memory-regels; werk token-zuinig; stuur GEEN Telegram-berichten behalve als de opdracht dat vraagt.`;
  const uit = fs.openSync(logPad, 'a');
  const kind = spawn('/opt/homebrew/bin/claude', ['-p', prompt, '--permission-mode', 'acceptEdits'], { cwd: SONTY, detached: true, stdio: ['ignore', uit, uit], env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });
  kind.unref();
  B.meld(naam, { taak: o.tekst.slice(0, 140), status: 'gestart', rol: 'werknemer (claude -p)', pid: kind.pid });
  B.markeer(o.id, 'gestart', `gestart als ${naam} (pid ${kind.pid}), log data/brein/werk-${o.id}.log`);
}

// ── 6. medewerkers (agents met profiel) ──
function medewerkers(jobLijst) {
  let team = [];
  try { team = require('./medewerker.js').team(); } catch (e) { return { fout: e.message, lijst: [] }; }
  const st = lees(path.join(B.DIR, 'medewerkers.json'), {});
  return { lijst: team.map((m) => {
    const s = st[m.slug] || {};
    const mijnJobs = jobLijst.filter((j) => m.jobs.includes(j.kort));
    return { slug: m.slug, naam: m.naam, functie: m.functie, afdeling: m.afdeling || '', niveau: m.niveau || 'medewerker', rapporteertAan: m.rapporteertAan || 'daimy', model: m.model, dienst: m.dienst || null, kpis: m.kpis, magZelf: m.magZelf, fout: m.fout || s.fout || null,
      status: s.status || 'nog nooit gedraaid', laatsteDienst: s.laatsteDienst || null, laatsteActie: s.laatsteActie || null, bezigMet: s.bezigMet || null, duurMin: s.duurMin ?? null, kostenUsd: s.kostenUsd ?? null,
      rapport: s.rapport || null, jobs: mijnJobs.map((j) => ({ kort: j.kort, schema: j.schema, draait: j.draait, laatst: j.laatst, alarm: j.alarm })), openOpdrachten: B.opdrachtenVoor(m.slug).length };
  }) };
}

// ── main ──
(async () => {
  const t0 = Date.now();
  const jobLijst = jobs();
  const col = collegas(jobLijst);
  const wr = await wachtrijen();
  const alarmen = [
    ...jobLijst.filter((j) => j.alarm).map((j) => ({ ernst: j.laatst && NU - Date.parse(j.laatst) > 3 * 86400000 ? 'laag' : (j.label.includes('sonny') || /inmeet|aanbod|telegram/.test(j.label)) ? 'hoog' : 'midden', wie: j.collega, wat: `${j.kort}: ${j.alarm}${j.laatst && NU - Date.parse(j.laatst) > 3 * 86400000 ? ' (al dagen stil, waarschijnlijk bewust uit)' : ''}` })),
    ...(wr.sunnyLeeft ? [] : [{ ernst: 'hoog', wie: 'Sunny', wat: 'geen hartslag in de laatste 20 min' }]),
    ...(wr.mutaties.open > 5 ? [{ ernst: 'midden', wie: 'Nanny', wat: `${wr.mutaties.open} mutaties staan open` }] : []),
    ...col.sessies.filter((s) => s.wachtOpMens && s.status !== 'klaar').map((s) => ({ ernst: 'laag', wie: s.naam, wat: 'wacht op Daimy' })),
  ];
  const snapshot = {
    bijgewerkt: new Date().toISOString(), host: os.hostname(), uptimeUur: Math.round(os.uptime() / 360) / 10, load: os.loadavg()[0].toFixed(2),
    alarmen, jobs: jobLijst, collegas: col, wachtrijen: wr, tijdlijn: tijdlijn(), medewerkers: medewerkers(jobLijst),
    postvak: B.postvak().slice(-100).reverse(), werknemerAan: fs.existsSync(path.join(B.DIR, '.werknemer-aan')),
    collegaNamen: [...new Set([...medewerkers(jobLijst).lijst.map((m) => m.slug), ...col.sessies.filter((s) => s.status !== 'klaar' && s.status !== 'verlopen').map((s) => s.naam), 'nieuwe werknemer'])],
  };
  fs.mkdirSync(B.DIR, { recursive: true });
  fs.writeFileSync(path.join(B.DIR, 'snapshot.json'), JSON.stringify(snapshot));
  let nieuw = 0, fout = null;
  try { nieuw = await pushEnHaalOp(snapshot); } catch (e) { fout = e.message; }
  console.log(`${snapshot.bijgewerkt} brein: ${jobLijst.length} jobs (${alarmen.length} alarm), ${col.sessies.length} sessies, ${nieuw} nieuwe opdrachten, ${Date.now() - t0} ms${fout ? ' — PUSH FOUT: ' + fout : ''}`);
  if (fout) process.exit(1);
})();
