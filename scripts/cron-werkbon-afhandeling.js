#!/usr/bin/env node
const { planadoFetch } = require('./lib/planado-fetch.js');
// WERKBON-AFHANDELING (Daimy 2026-08-20): zodra een bus-opdracht (montage/service)
// in Planado is AFGEROND, kijkt deze verwerker naar het werkbon-rapport:
//   - ELKE afgeronde werkbon (gereed, niet gereed of leeg) wordt IN Z'N GEHEEL gemaild
//     (regel Daimy 2026-08-27; adressen in data/werkbon-mail-adressen.txt, lib/werkbon-mail.js).
//   - "Werk gereed?" = JA  → daarbij melding op de planning-bot dat de EINDFACTUUR via
//     Gripp verstuurd kan worden (met Gripp-nummer en klant erbij).
//   - "Werk gereed?" = NEE of leeg → waarschuwing op de planning-bot.
// Alleen opdrachten die NA de start van deze verwerker zijn afgerond tellen mee
// (oude afgeronde klussen hebben de nieuwe werkbon-velden niet).
// Draait elke 30 min via launchd nl.sonty.werkbon-afhandeling.
const fs = require('fs');
const path = require('path');
const { planningTelegram } = require('./lib/telegram-planning.js');
const { bouwWerkbonMail, verstuurWerkbonMail, werkbonAdressen } = require('./lib/werkbon-mail.js');

const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim() };
const STATE_PAD = path.join(__dirname, '..', 'data', 'werkbon-verwerkt.json');
const BUSSEN = {
  '1f19ca1a-5a2d': 'Bus 1 | Frenk & Dennis', '1f122f72-777f': 'Bus 2 | Tygo & Kevin',
  '1f122f37-76db': 'Bus 3 | Yudi & Nick', '1f19ca1c-8ecb': 'Bus 4 | Marvin & Bart',
  '1f19ca1d-fec8': 'Bus 5 | Marvin & Moa', '1f19ca28-ce10': 'Bus 6 | Arnold',
  '1f122cfa-4eba': 'Nanny',
};
// 'Wie heeft deze fout gemaakt' verwijderd op verzoek Daimy 20-08 ("daar hebben we niks aan")

const laadState = () => { try { return JSON.parse(fs.readFileSync(STATE_PAD, 'utf8')); } catch { return { vanaf: new Date().toISOString(), verwerkt: {} }; } };

const jaNee = (v) => v === true || /^(ja|yes|true|1)$/i.test(String(v ?? '').trim());

(async () => {
  const state = laadState();
  let after = null; const klaarStaand = [];
  for (let i = 0; i < 20; i++) {
    const d = await (await planadoFetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || []; if (!l.length) break;
    for (const j of l) {
      const bus = Object.keys(BUSSEN).find((p) => (j.assignee?.worker_uuid || '').startsWith(p));
      if (!bus) continue;
      if (j.status !== 'finished') continue;
      if (state.verwerkt[j.uuid]) continue;
      // alleen klussen die sinds de start van deze verwerker gepland stonden
      if (j.scheduled_at && j.scheduled_at < state.vanaf.slice(0, 10)) continue;
      klaarStaand.push({ j, busNaam: BUSSEN[bus] });
    }
    after = l[l.length - 1].uuid;
    await new Promise((r) => setTimeout(r, 700));
  }
  console.log(`[${new Date().toISOString()}] werkbon-afhandeling: ${klaarStaand.length} nieuw afgeronde bus-opdracht(en)`);

  for (const { j, busNaam } of klaarStaand) {
    const det = await (await planadoFetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    // REGEL Daimy 2026-08-27: ELKE afgeronde werkbon wordt in z'n geheel gemaild (gereed of niet,
    // ook als de velden leeg zijn). De planning-bot krijgt daarnaast de korte melding.
    const mail = bouwWerkbonMail(job, busNaam);
    const adressen = werkbonAdressen();
    let ok = false;
    try { ok = await verstuurWerkbonMail(mail, adressen); } catch (e) { console.error('mail-fout #' + job.serial_no + ':', e.message); }
    const adres = job.address?.formatted || '';
    const kop = mail.kop, grippNr = mail.grippNr;
    const mailNoot = ok ? `Werkbon gemaild naar ${adressen.join(', ')}.` : 'WERKBON MAILEN MISLUKT — handmatig doorsturen vanuit Planado.';

    if (mail.gereed.status === 'ja') {
      await planningTelegram(`✅ WERK GEREED: #${job.serial_no} ${kop} (${busNaam})${adres ? ' — ' + adres : ''}.\n` +
        (grippNr ? `→ EINDFACTUUR versturen via Gripp (offerte/order ${grippNr}).` : '→ EINDFACTUUR versturen via Gripp (geen Gripp-nummer op de opdracht — even opzoeken).') +
        `\n${mailNoot}`);
    } else if (mail.gereed.status === 'nee') {
      await planningTelegram(`⚠️ NIET GEREED: #${job.serial_no} ${kop} (${busNaam}). ${mailNoot}`);
    } else {
      await planningTelegram(`📋 #${job.serial_no} (${kop}) is afgerond door ${busNaam}, maar de werkbon-velden zijn niet ingevuld. Even navragen bij het team. ${mailNoot}`);
    }
    state.verwerkt[j.uuid] = { op: new Date().toISOString(), uitkomst: `${mail.gereed.label.toLowerCase()} → ${ok ? 'gemaild' : 'mail mislukt'}` };
    fs.writeFileSync(STATE_PAD, JSON.stringify(state, null, 1));
    await new Promise((r) => setTimeout(r, 1500));
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
