#!/usr/bin/env node
// Inmeet-planner: leest RP-status "Inmeten inplannen" en zoekt per lead de slots die
// de MINSTE EXTRA RIJTIJD kosten.
//
// Draait standaard in SCHADUW: hij rapporteert wat hij zou plannen en raakt niets aan.
// Pas met --live boekt hij echt en zet hij de RP-status door naar "grip invullen".
//
// Waarom netto tijd + losse reistijd: de oude planning zette inmeten en reistijd samen
// in blokken van 60 min. Doorgerekend liep Sjoerds dag van 6 augustus daardoor 104
// minuten uit. Zie docs/keten-ontwerp.md.
const fs = require('fs');
const path = require('path');
const { zoekSlots, kiesAanbod, venster } = require('./lib/slotzoeker');
const { schatDuur } = require('./lib/inmeetduur');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const INMETEN_INPLANNEN = '2e9819bd-26f0-4082-8f18-32bb48f87f54';
const GRIP_INVULLEN = 'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846';

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;

// De twee inmeters waarmee we starten (Daimy 2026-08-04).
const INMETERS = [
  { naam: 'Sjoerd', uuid: '1f122d19-e43e-6da0-8ffb-661a4ff9bb36' },
  { naam: 'Joey', uuid: '1f122cfa-17a2-6580-8257-7e80f004db9c' },
];

const LIVE = process.argv.includes('--live');
const STATE = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');

// ── kleine helpers ──────────────────────────────────────────────────────────
const laadState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { aangeboden: {} }; } };
const bewaarState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: tekst }),
  }).catch(() => {});
}

async function rpGet(ep) {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + RP_API_KEY } });
  if (!r.ok) throw new Error(`RP ${r.status}`);
  return r.json();
}
async function rpZetStatus(itemId, statusId) {
  const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${BACKLOG_ID}/items/${itemId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { status_id: statusId } }),
  });
  return r.ok;
}
async function planado(ep) {
  const r = await fetch('https://api.planadoapp.com/v2' + ep, { headers: { Authorization: 'Bearer ' + PLANADO_KEY } });
  if (!r.ok) throw new Error(`Planado ${r.status}`);
  return r.json();
}

// ── lead uitlezen ───────────────────────────────────────────────────────────
// Regels die geen meetbaar product zijn. Naast montage en accessoires staan er ook
// MAATSTAFFELS als aparte "1x"-regel in de RP-omschrijving ("1x Breedte tussen 1000 mm
// - 3000 mm"). Die tellen als product mee als je ze niet uitfiltert, en dan schat de
// planner de inmeetduur structureel te hoog.
const GEEN_PRODUCT = new RegExp([
  'inclusief montage', 'connectivity', 'app bediening', 'afstandsbediening',
  'korting', 'vanaf \\d+ stuks',
  '^(breedte|hoogte|diepte|oppervlakte)\\b',     // maatstaffels
  '\\btussen\\s+\\d+\\s*mm',                      // "... tussen 1000 mm - 3000 mm"
  'montage', 'transport', 'toeslag', 'garantie',
].join('|'), 'i');

function leesLead(item) {
  const d = item.description || '';
  const veld = (naam) => (d.match(new RegExp(`^${naam}:\\s*(.+)$`, 'im')) || [])[1]?.trim() || '';

  const straat = veld('Straatnaam');
  const nummer = veld('Huisnummer');
  const postcode = veld('Postcode');
  const plaats = veld('Plaats');

  // Productregels zien eruit als "2x Windvast:" of "1x Somfy connectivity app bediening".
  const producten = [];
  for (const m of d.matchAll(/^(\d+)x\s+(.+?):?\s*$/gim)) {
    const aantal = parseInt(m[1], 10);
    const naam = m[2].trim();
    if (GEEN_PRODUCT.test(naam)) continue;
    producten.push({ type: naam.toLowerCase(), naam, aantal });
  }

  return {
    id: item.id,
    naam: item.summary || veld('Voornaam') + ' ' + veld('Achternaam'),
    telefoon: veld('Telefoonnummer'),
    email: veld('E-mailadres'),
    adres: [straat, nummer].filter(Boolean).join(' '),
    postcode,
    plaats,
    volledigAdres: [[straat, nummer].filter(Boolean).join(' '), postcode, plaats].filter(Boolean).join(', '),
    producten,
    aantalProducten: producten.reduce((a, p) => a + p.aantal, 0),
  };
}

// ── agenda per inmeter ──────────────────────────────────────────────────────
async function haalAgenda() {
  let jobs = [], after = null;
  for (let i = 0; i < 10; i++) {
    const d = await planado('/jobs' + (after ? '?after=' + after : ''));
    const lijst = d.jobs || d.data || [];
    if (!lijst.length) break;
    jobs.push(...lijst);
    after = lijst[lijst.length - 1].uuid;
    await wacht(2600);
  }
  const vanaf = new Date();
  const gepland = jobs.filter((j) => j.scheduled_at && new Date(j.scheduled_at) >= vanaf);

  const perInmeter = {};
  for (const inm of INMETERS) perInmeter[inm.naam] = [];

  for (const j of gepland) {
    const inm = INMETERS.find((i) => i.uuid === j.assignee?.worker_uuid);
    if (!inm) continue;
    // Het adres zit alleen in het job-detail, niet in de lijst.
    let adres = null;
    try {
      const det = await planado('/jobs/' + j.uuid);
      adres = (det.job || det).address?.formatted || null;
      await wacht(2600);
    } catch { /* detail niet op te halen: job overslaan */ }
    if (!adres) continue;
    perInmeter[inm.naam].push({
      start: j.scheduled_at,
      eind: new Date(+new Date(j.scheduled_at) + ((j.scheduled_duration?.minutes) || 60) * 60000).toISOString(),
      adres,
    });
  }
  return perInmeter;
}

/** Werkdagen: de komende 10 werkdagen, 08:30-17:00. */
function werkdagen(aantal = 10) {
  const dagen = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (dagen.length < aantal) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dagen.push({ datum: d.toISOString().slice(0, 10), van: '08:30', tot: '17:00' });
    }
    d.setDate(d.getDate() + 1);
  }
  return dagen;
}

// ── hoofdlus ────────────────────────────────────────────────────────────────
async function main() {
  const state = laadState();
  console.log(LIVE ? '=== LIVE ===' : '=== SCHADUW (er wordt niets geboekt) ===');

  const data = await rpGet(`/contact-service/${PID}/backlogs/${BACKLOG_ID}/items?limit=200`);
  const items = (data.items || data.data || data || []).filter((i) => i.status_id === INMETEN_INPLANNEN);
  console.log(`${items.length} lead(s) op "Inmeten inplannen"`);
  if (!items.length) return;

  const agenda = await haalAgenda();
  for (const inm of INMETERS) console.log(`  agenda ${inm.naam}: ${agenda[inm.naam].length} komende afspraken`);

  const dagen = werkdagen();
  const regels = [];

  for (const item of items) {
    const lead = leesLead(item);
    if (!lead.volledigAdres || !lead.plaats) {
      console.log(`  ! ${lead.naam}: geen bruikbaar adres, overslaan`);
      regels.push(`${lead.naam}: GEEN ADRES — handmatig`);
      continue;
    }
    const duur = schatDuur(lead.producten);

    // Beste slot over beide inmeters heen: wie het goedkoopst kan, krijgt hem.
    let beste = [];
    for (const inm of INMETERS) {
      try {
        const s = await zoekSlots({ agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur, werkdagen: dagen });
        beste.push(...s.map((x) => ({ ...x, inmeter: inm.naam })));
      } catch (e) {
        console.log(`  ! ${lead.naam} (${inm.naam}): ${e.message}`);
      }
    }
    beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
    const aanbod = kiesAanbod(beste, 3);

    console.log(`\n  ${lead.naam} — ${lead.volledigAdres}`);
    console.log(`    ${lead.aantalProducten} product(en): ${lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ') || '—'} → ${duur} min`);
    if (!aanbod.length) {
      console.log('    GEEN slot gevonden in de komende 10 werkdagen');
      regels.push(`${lead.naam} (${lead.plaats}): geen slot`);
      continue;
    }
    for (const s of aanbod) {
      console.log(`    ${s.inmeter}: ${s.datum} ${venster(s)}  +${s.extraRijtijdMin} min rijtijd (na ${s.naVorige.slice(0, 24)})`);
    }
    regels.push(`${lead.naam} (${lead.plaats}, ${duur} min): ${aanbod.map((s) => `${s.inmeter} ${s.datum.slice(5)} ${venster(s)} +${s.extraRijtijdMin}min`).join(' | ')}`);

    if (LIVE) {
      // Bewust nog niet ingevuld: boeken en RP-status doorzetten komt pas als de
      // schaduwrun bevestigt dat de slots kloppen.
      console.log('    (live boeken nog niet aangezet)');
    }
    state.aangeboden[lead.id] = { naam: lead.naam, op: new Date().toISOString(), aanbod: aanbod.length };
  }

  bewaarState(state);
  await telegram(`Inmeet-planner (${LIVE ? 'LIVE' : 'schaduw'}) — ${items.length} lead(s):\n\n` + regels.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
