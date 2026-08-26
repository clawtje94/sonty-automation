#!/usr/bin/env node
const { planadoFetch } = require('./lib/planado-fetch.js');
// WERKBON-AFHANDELING (Daimy 2026-08-20): zodra een bus-opdracht (montage/service)
// in Planado is AFGEROND, kijkt deze verwerker naar het werkbon-rapport:
//   - "Werk gereed?" = JA  → melding op de planning-bot dat de EINDFACTUUR via
//     Gripp verstuurd kan worden (met Gripp-nummer en klant erbij).
//   - "Werk gereed?" = NEE → de complete werkbon wordt gemaild naar
//     werkbonnen@sonty.nl (interne mail via joey@) + melding op de planning-bot.
// Alleen opdrachten die NA de start van deze verwerker zijn afgerond tellen mee
// (oude afgeronde klussen hebben de nieuwe werkbon-velden niet).
// Draait elke 30 min via launchd nl.sonty.werkbon-afhandeling.
const fs = require('fs');
const path = require('path');
const { planningTelegram } = require('./lib/telegram-planning.js');

const PH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim() };
const STATE_PAD = path.join(__dirname, '..', 'data', 'werkbon-verwerkt.json');
const BUSSEN = {
  '1f19ca1a-5a2d': 'Bus 1 | Frenk & Dennis', '1f122f72-777f': 'Bus 2 | Tygo & Kevin',
  '1f122f37-76db': 'Bus 3 | Yudi & Nick', '1f19ca1c-8ecb': 'Bus 4 | Marvin & Bart',
  '1f19ca1d-fec8': 'Bus 5 | Marvin & Moa', '1f19ca28-ce10': 'Bus 6 | Arnold',
  '1f122cfa-4eba': 'Nanny',
};
const VELDEN = ['Werk gereed', 'Waarom niet gereed',
  'Wat is er nodig om te herstellen', 'Welke kleur', 'producten bij de klant', 'Hoeveel uur',
  'Uitleg voor de volgende service-afspraak', 'Foto NIET-GEREED'];
// 'Wie heeft deze fout gemaakt' verwijderd op verzoek Daimy 20-08 ("daar hebben we niks aan")

const laadState = () => { try { return JSON.parse(fs.readFileSync(STATE_PAD, 'utf8')); } catch { return { vanaf: new Date().toISOString(), verwerkt: {} }; } };

/** Zoek rapportwaardes in de job-JSON, ongeacht de exacte structuur die de API
 *  gebruikt: alles met een naam/label dat op een van onze velden lijkt. */
function rapportUit(jobJson) {
  const uit = {};
  const loop = (o) => {
    if (Array.isArray(o)) return o.forEach(loop);
    if (!o || typeof o !== 'object') return;
    const naam = o.name || o.label || o.field_name || o.title;
    if (naam && ('value' in o || 'result' in o || 'checked' in o)) {
      const veld = VELDEN.find((v) => String(naam).toLowerCase().includes(v.toLowerCase()));
      if (veld) uit[veld] = o.value ?? o.result ?? o.checked;
    }
    Object.values(o).forEach(loop);
  };
  loop(jobJson);
  return uit;
}

async function mailWerkbon(onderwerp, tekst) {
  const OH = { Authorization: 'Bearer ' + fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim(), 'Content-Type': 'application/json' };
  const r = await fetch('https://outlook.office.com/api/v2.0/me/sendmail', {
    method: 'POST', headers: OH,
    body: JSON.stringify({
      Message: {
        Subject: onderwerp,
        Body: { ContentType: 'Text', Content: tekst },
        ToRecipients: [{ EmailAddress: { Address: 'werkbonnen@sonty.nl' } }],
      },
      SaveToSentItems: true,
    }),
  });
  return r.ok || r.status === 202;
}

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
    const rapport = rapportUit(job);
    const kop = String(job.description || '').split('\n')[0].slice(0, 60) || ('#' + job.serial_no);
    const grippNr = (String(job.description || '').match(/Gripp:\s*(\d+)/) || [])[1] || null;
    const contact = (job.contacts || [])[0] || {};
    const adres = job.address?.formatted || '';

    if (!('Werk gereed' in rapport)) {
      // werkbon niet ingevuld (oude template of overgeslagen): wel signaleren
      await planningTelegram(`📋 #${job.serial_no} (${kop}) is afgerond door ${busNaam}, maar de werkbon-velden zijn niet ingevuld. Even navragen bij het team.`);
      state.verwerkt[j.uuid] = { op: new Date().toISOString(), uitkomst: 'geen werkbon' };
      fs.writeFileSync(STATE_PAD, JSON.stringify(state, null, 1));
      continue;
    }

    if (jaNee(rapport['Werk gereed'])) {
      await planningTelegram(`✅ WERK GEREED: #${job.serial_no} ${kop} (${busNaam})${adres ? ' — ' + adres : ''}.\n` +
        (grippNr ? `→ EINDFACTUUR versturen via Gripp (offerte/order ${grippNr}).` : '→ EINDFACTUUR versturen via Gripp (geen Gripp-nummer op de opdracht — even opzoeken).'));
      state.verwerkt[j.uuid] = { op: new Date().toISOString(), uitkomst: 'gereed → factuurmelding' };
    } else {
      const regels = [
        `WERKBON — NIET GEREED`,
        `Opdracht: #${job.serial_no} ${kop}`,
        `Team: ${busNaam}`,
        `Klant: ${contact.name || '-'} (${contact.value || '-'})`,
        `Adres: ${adres || '-'}`,
        grippNr ? `Gripp: ${grippNr}` : null,
        ``,
        `Werk gereed: nee`,
        `Waarom niet gereed: ${rapport['Waarom niet gereed'] ?? '-'}`,
        `Wie heeft deze fout gemaakt: ${rapport['Wie heeft deze fout gemaakt'] ?? '-'}`,
        `Wat is er nodig om te herstellen: ${rapport['Wat is er nodig om te herstellen'] ?? '-'}`,
        `Welke kleur: ${rapport['Welke kleur'] ?? '-'}`,
        `Producten bij de klant gebleven: ${jaNee(rapport['producten bij de klant']) ? 'ja' : 'nee'}`,
        `Uren nodig voor herstel: ${rapport['Hoeveel uur'] ?? '-'}`,
        `Uitleg voor de volgende service-afspraak: ${rapport['Uitleg voor de volgende service-afspraak'] ?? '-'}`,
        `Foto van de niet-gerede situatie: ${rapport['Foto NIET-GEREED'] ? 'toegevoegd — zie het rapport van opdracht #' + job.serial_no + ' in Planado' : 'niet toegevoegd'}`,
      ].filter((x) => x !== null).join('\n');
      const ok = await mailWerkbon(`Werkbon NIET GEREED — #${job.serial_no} ${kop}`, regels);
      await planningTelegram(`⚠️ NIET GEREED: #${job.serial_no} ${kop} (${busNaam}). Werkbon ${ok ? 'gemaild naar werkbonnen@sonty.nl' : 'MAILEN MISLUKT — handmatig doorsturen'}.\nReden: ${rapport['Waarom niet gereed'] ?? '-'}`);
      state.verwerkt[j.uuid] = { op: new Date().toISOString(), uitkomst: ok ? 'werkbon gemaild' : 'mail mislukt' };
    }
    fs.writeFileSync(STATE_PAD, JSON.stringify(state, null, 1));
    await new Promise((r) => setTimeout(r, 1500));
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
