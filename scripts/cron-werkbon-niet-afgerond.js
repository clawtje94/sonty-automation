#!/usr/bin/env node
// NIET-AFGERONDE BUS-OPDRACHTEN (Daimy 2026-08-27, "oke doe het maar"): elke ochtend één
// melding op de planning-bot met de klussen van GISTEREN (en eerder, sinds 20-08) die in
// Planado nog niet zijn afgerond. Zonder "Afronden" in de app komt er geen werkbon-mail en
// geen factuurmelding, dus dit is het signaal om de teams erop aan te spreken.
// Alleen-lezen t.o.v. Planado. Draait dagelijks 08:10 via launchd nl.sonty.werkbon-niet-afgerond.
// Dry-run: node scripts/cron-werkbon-niet-afgerond.js --dry (print, geen Telegram).
const fs = require('fs');
const path = require('path');
const { planningTelegram } = require('./lib/telegram-planning.js');
let planadoFetch; try { ({ planadoFetch } = require('./lib/planado-fetch.js')); } catch { planadoFetch = (u, o) => fetch(u, o); }

const DRY = process.argv.includes('--dry');
const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim() };
const BUSSEN = {
  '1f19ca1a-5a2d': 'Bus 1 | Frenk & Dennis', '1f122f72-777f': 'Bus 2 | Tygo & Kevin',
  '1f122f37-76db': 'Bus 3 | Yudi & Nick', '1f19ca1c-8ecb': 'Bus 4 | Marvin & Bart',
  '1f19ca1d-fec8': 'Bus 5 | Marvin & Moa', '1f19ca28-ce10': 'Bus 6 | Arnold',
};
const VANAF = '2026-08-20'; // start werkbon-flow
const OPEN = new Set(['published', 'scheduled', 'en_route', 'started', 'suspended', 'in_progress']);

const dagNL = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit' });

(async () => {
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // YYYY-MM-DD
  let after = null; const open = [];
  for (let i = 0; i < 40; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break;
    for (const j of l) {
      const bus = Object.keys(BUSSEN).find((p) => (j.assignee?.worker_uuid || '').startsWith(p));
      if (!bus || !j.scheduled_at) continue;
      const dag = j.scheduled_at.slice(0, 10);
      if (dag < VANAF || dag >= vandaag) continue;          // alleen verleden dagen
      if (!OPEN.has(j.status)) continue;                     // finished/canceled tellen niet
      open.push({ dag, bus: BUSSEN[bus], nr: j.serial_no, kop: String(j.description || '').split('\n')[0].slice(0, 40) });
    }
    after = l[l.length - 1].uuid;
    await new Promise((r) => setTimeout(r, 600));
  }

  const gisteren = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const perBus = {};
  for (const o of open) { (perBus[o.bus] = perBus[o.bus] || { gisteren: [], ouder: 0 }); if (o.dag === gisteren) perBus[o.bus].gisteren.push(o); else perBus[o.bus].ouder++; }
  const bussen = Object.keys(perBus).sort();
  const regels = bussen.map((b) => {
    const g = perBus[b].gisteren, o = perBus[b].ouder;
    const nrs = g.slice(0, 6).map((x) => '#' + x.nr).join(' ') + (g.length > 6 ? ' …' : '');
    return `• ${b.split(' | ')[0]}: ${g.length} van gisteren${g.length ? ' (' + nrs + ')' : ''}${o ? `, ${o} ouder` : ''}`;
  });
  const totGisteren = open.filter((o) => o.dag === gisteren).length;
  const tekst = open.length
    ? `📋 WERKBONNEN NIET AFGEROND (stand ${dagNL(vandaag)} 08:10)\n` +
      `Gisteren ${dagNL(gisteren)}: ${totGisteren} klus(sen) staan in Planado nog open, in totaal ${open.length} sinds 20-08.\n` +
      regels.join('\n') +
      `\n\nZonder "Afronden" in de Planado-app komt er geen werkbon-mail en geen factuurmelding. Graag de teams laten afronden (werkbon invullen → Afronden).`
    : `✅ Werkbonnen: alle bus-opdrachten t/m gisteren zijn in Planado afgerond.`;
  console.log(`[${new Date().toISOString()}] werkbon-niet-afgerond: ${open.length} open (${totGisteren} van gisteren)`);
  if (DRY) { console.log(tekst); return; }
  await planningTelegram(tekst);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
