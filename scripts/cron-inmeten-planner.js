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
const { zoekSlots, kiesAanbod, venster, waaromGeenAanbod } = require('./lib/slotzoeker');
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
// VEILIGHEIDSKLEP: --live zonder filter zou elke lead op "Inmeten inplannen" boeken,
// dus ook echte klanten. Met --alleen <tekst> verwerkt hij uitsluitend de leads
// waarvan de naam die tekst bevat.
const ALLEEN = (process.argv.find((a) => a.startsWith('--alleen=')) || '').split('=')[1] || null;
const STATE = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');

function werkdagenTussen(van, tot) {
  let n = 0;
  const d = new Date(van);
  while (d < tot) {
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// Wachten op een buur mag, eindeloos wachten niet. Staat een lead langer dan dit te
// wachten, dan gaat het beste beschikbare slot alsnog naar de klant en krijgt kantoor
// een seintje. Anders bespaar je kilometers over de rug van je doorlooptijd.
const MAX_WACHTDAGEN = 5;

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

// Winkelleads (en alles wat via een RP-offerte loopt) hebben GEEN producten in de
// leadtekst — daar staat alleen "1x Winkel offerte". De echte producten zitten in het
// RP-offertedocument. Zonder dit leest de planner 1 product waar er 3 staan, en schat
// hij de inmeetduur veel te laag.
const GEEN_PRODUCT_REGEL = /^inmeten \+ montage|^montage\b|^korting|^toeslag|^transport/i;

const { leesOfferte } = require('./inmeten-planner-lees.js');

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

/** Lead met producten uit de beste bron: leadtekst, anders het RP-offertedocument. */
async function leesLeadCompleet(item) {
  const lead = leesLead(item);
  // "1x Winkel offerte" is geen product maar een placeholder.
  const bruikbaar = lead.producten.filter((p) => !/winkel offerte|offerte$/i.test(p.naam));
  if (bruikbaar.length) return { ...lead, producten: bruikbaar, aantalProducten: bruikbaar.reduce((a, p) => a + p.aantal, 0), bron: 'leadtekst' };
  const offerte = await leesOfferte(item);
  // Meerdere offertedocumenten zonder één getekende: NIET automatisch verder.
  // De klant moet er echt zelf één tekenen (Daimy 05-08).
  if (offerte.ambigu) return { ...lead, bron: 'AMBIGU', ambigu: true, aantalDocs: offerte.aantalDocs };
  if (!offerte.producten.length) return { ...lead, bron: 'leadtekst (leeg)' };
  return { ...lead, producten: offerte.producten, aantalProducten: offerte.producten.reduce((a, p) => a + p.aantal, 0), bron: 'RP-offerte (' + (offerte.status || '?') + ')' };
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

// ── echt boeken ─────────────────────────────────────────────────────────────
// De volgorde is bewust deze: pas als de afspraak vaststaat gaat de RP-status door,
// en pas als de Gripp-offerte bestaat hangen we de meetbon-link aan de opdracht.
// Zo ontstaat er nooit een status "grip invullen" zonder afspraak, of een opdracht
// die naar een meetbon wijst die niet bestaat.
const GRIPP_KEY = require('./secrets.js').GRIPP_API_KEY;

async function grippCall(method, params) {
  const r = await fetch('https://api.gripp.com/public/api3.php', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + GRIPP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ method, params, id: 1 }]),
  });
  return (await r.json())?.[0]?.result;
}

/** Gripp-offertenummer zoeken dat cron-gripp-invullen zojuist heeft aangemaakt. */
async function zoekGrippNummer(naam) {
  let log = {};
  try { log = JSON.parse(fs.readFileSync(path.join(__dirname, '.gripp-invullen-sent.json'), 'utf8')); } catch { return null; }
  const regel = log[naam];
  if (!regel?.grippOfferId) return null;
  // Nooit op naam koppelen in Gripp zelf: we hebben de id, dus we halen het nummer op.
  const res = await grippCall('offer.get', [
    [{ field: 'offer.id', operator: 'equals', value: regel.grippOfferId }],
    { paging: { firstresult: 0, maxresults: 1 } },
  ]);
  const nr = res?.rows?.[0]?.number;
  return nr ? String(nr) : null;
}

async function planadoPost(ep, body, methode = 'POST') {
  const r = await fetch('https://api.planadoapp.com/v2' + ep, {
    method: methode,
    headers: {
      Authorization: 'Bearer ' + PLANADO_KEY,
      'Content-Type': 'application/json',
      'X-Planado-Notify-Assignees': 'false',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Planado ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.status === 204 ? {} : r.json();
}

async function verwerkLead(lead, item, slot, duurMin) {
  const inmeter = INMETERS.find((i) => i.naam === slot.inmeter);

  // 1. de afspraak zelf
  const job = await planadoPost('/jobs', {
    template_uuid: '1f11c802-65cd-6aa0-9d06-7e73cee772e4',
    // Zonder type valt de opdracht op "default" en toont de app "Opdracht" i.p.v.
    // "Inmeting" (Daimy 2026-08-05).
    type_uuid: '1f11c802-6340-6680-9d06-7e73cee772e4',
    description: `Inmeten — ${lead.naam}\n${lead.volledigAdres}\n\n${lead.aantalProducten} product(en): ${lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ')}`,
    contacts: [{ type: 'phone', name: lead.naam, value: lead.telefoon || '-' }],
    address: { formatted: lead.volledigAdres },
    scheduled_at: slot.aankomst.toISOString(),
    scheduled_duration: { minutes: duurMin },
    // Planado wil de toewijzing als worker-object (422 'either team or worker must present')
    assignee: { worker: { uuid: inmeter.uuid } },
    external_id: `rp-${lead.id}`,
  });
  const jobUuid = job.job_uuid || job.uuid;

  // 2. RP door naar "grip invullen" — de enige toegestane schrijfactie in RP
  const statusOk = await rpZetStatus(lead.id, GRIP_INVULLEN);
  if (!statusOk) throw new Error('afspraak staat, maar RP-status kon niet worden gezet');

  // 3. Gripp-offerte laten aanmaken door het bestaande script
  await new Promise((klaar, mis) => {
    require('child_process').execFile(
      process.execPath, [path.join(__dirname, 'cron-gripp-invullen.js')],
      { timeout: 5 * 60 * 1000 },
      (e) => (e && !/timeout/i.test(e.message) ? mis(new Error('gripp-invullen: ' + e.message)) : klaar()),
    );
  });

  // 4. meetbon-link pas nu, want nu bestaat het Gripp-nummer
  const grippNr = await zoekGrippNummer(lead.naam);
  if (grippNr) {
    const detail = await (await fetch(`https://api.planadoapp.com/v2/jobs/${jobUuid}`, {
      headers: { Authorization: 'Bearer ' + PLANADO_KEY },
    })).json();
    const huidig = detail.job || detail;
    await planadoPost(`/jobs/${jobUuid}`, {
      version: huidig.version,
      description: `${huidig.description}\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${grippNr}`,
      external_id: `gripp-${grippNr}`,
    }, 'PATCH');
    // De bon zelf aanmaken en voorvullen uit Gripp.
    await fetch(`https://sonty-website.vercel.app/api/meetbon/bon/${grippNr}`, {
      headers: { 'x-meet-code': process.env.BELSCHERM_CODE || 'sonty2288' },
    }).catch(() => {});
  }

  const tijd = slot.aankomst.toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return {
    samenvatting: `${slot.inmeter} ${tijd} (${duurMin} min, +${slot.extraRijtijdMin} min rijtijd)` +
      (grippNr ? ` · Gripp ${grippNr} · meetbon klaar` : ' · LET OP: Gripp-nummer nog niet gevonden, meetbon-link ontbreekt'),
    grippNr,
  };
}

// ── hoofdlus ────────────────────────────────────────────────────────────────
async function main() {
  const state = laadState();
  console.log(LIVE ? '=== LIVE ===' : '=== SCHADUW (er wordt niets geboekt) ===');

  const data = await rpGet(`/contact-service/${PID}/backlogs/${BACKLOG_ID}/items?limit=200`);
  const items = (data.items || data.data || data || []).filter((i) => i.status_id === INMETEN_INPLANNEN);
  console.log(`${items.length} lead(s) op "Inmeten inplannen"`);
  if (LIVE && !ALLEEN) {
    console.log('GEWEIGERD: --live zonder --alleen=<naam> zou alle leads boeken, ook echte klanten.');
    return;
  }
  if (!items.length) return;

  const agenda = await haalAgenda();
  for (const inm of INMETERS) console.log(`  agenda ${inm.naam}: ${agenda[inm.naam].length} komende afspraken`);

  const dagen = werkdagen();
  const regels = [];

  for (const item of items) {
    const lead = await leesLeadCompleet(item);
    if (ALLEEN && !`${lead.naam} ${item.id}`.toLowerCase().includes(ALLEEN.toLowerCase())) continue;
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
    // hoe lang wacht deze lead al? (verre-klant-regel: na 5 werkdagen filter los)
    const sindsIso = state.wachtend?.[lead.id];
    const wachtWerkdagen = sindsIso ? werkdagenTussen(new Date(sindsIso), new Date()) : 0;
    const aanbod = kiesAanbod(beste, 3, { wachtWerkdagen });

    console.log(`\n  ${lead.naam} — ${lead.volledigAdres}`);
    console.log(`    ${lead.aantalProducten} product(en) uit ${lead.bron}: ${lead.producten.map((p) => `${p.aantal}x ${p.naam}${p.breedte ? ` ${p.breedte}mm` : ''}`).join(', ') || '—'} → ${duur} min`);
    if (!aanbod.length) {
      const reden = waaromGeenAanbod(beste);
      const sinds = state.wachtend?.[lead.id] || new Date().toISOString();
      state.wachtend = { ...(state.wachtend || {}), [lead.id]: sinds };
      const dagen = Math.floor((Date.now() - new Date(sinds)) / 86400000);

      if (dagen >= MAX_WACHTDAGEN && beste.length) {
        // Te lang gewacht: de klant gaat voor de route.
        const noodAanbod = beste.slice(0, 3);
        console.log(`    NA ${dagen} DAGEN WACHTEN TOCH AANBIEDEN (duurder, maar de klant wacht al te lang)`);
        for (const s2 of noodAanbod) console.log(`    ${s2.inmeter}: ${s2.datum} ${venster(s2)}  +${s2.extraRijtijdMin} min`);
        regels.push(`${lead.naam} (${lead.plaats}): ${dagen} dagen gewacht, nu toch aangeboden — ${noodAanbod.map((s2) => `${s2.inmeter} ${s2.datum.slice(5)} ${venster(s2)} +${s2.extraRijtijdMin}min`).join(' | ')}`);
      } else {
        console.log(`    NOG GEEN AANBOD (${dagen} dag(en) wachtend): ${reden}`);
        regels.push(`${lead.naam} (${lead.plaats}): wacht ${dagen}/${MAX_WACHTDAGEN} dagen — ${reden}`);
      }
      continue;
    }
    delete state.wachtend?.[lead.id];
    for (const s of aanbod) {
      console.log(`    ${s.inmeter}: ${s.datum} ${venster(s)}  +${s.extraRijtijdMin} min rijtijd (na ${s.naVorige.slice(0, 24)})`);
    }
    regels.push(`${lead.naam} (${lead.plaats}, ${duur} min): ${aanbod.map((s) => `${s.inmeter} ${s.datum.slice(5)} ${venster(s)} +${s.extraRijtijdMin}min`).join(' | ')}`);

    if (LIVE) {
      const gekozen = aanbod[0];
      try {
        const uitkomst = await verwerkLead(lead, item, gekozen, duur);
        console.log(`    GEBOEKT: ${uitkomst.samenvatting}`);
        regels.push(`  → geboekt: ${uitkomst.samenvatting}`);
      } catch (e) {
        console.log(`    FOUT bij boeken: ${e.message}`);
        regels.push(`  → boeken MISLUKT: ${e.message}`);
      }
    }
    state.aangeboden[lead.id] = { naam: lead.naam, op: new Date().toISOString(), aanbod: aanbod.length };
  }

  bewaarState(state);
  await telegram(`Inmeet-planner (${LIVE ? 'LIVE' : 'schaduw'}) — ${items.length} lead(s):\n\n` + regels.join('\n'));
}

// ── aanbod-verwerker ────────────────────────────────────────────────────────
// De klant heeft via de keuzepagina een slot gekozen; hier wordt het echt:
// Planado-opdracht bij de juiste inmeter, RP door naar "grip invullen",
// Gripp-offerte via het bestaande script, meetbon klaargezet. Daarna pas
// markeren we het aanbod als verwerkt — mislukt er iets, dan blijft het staan
// en wordt het de volgende run opnieuw geprobeerd.
const AANBOD_API = 'https://sonty-website.vercel.app/api/inmeet-aanbod';
const MEET_CODE = process.env.BELSCHERM_CODE || 'sonty2288';

async function aanbodApi(pad, opties = {}) {
  const r = await fetch(AANBOD_API + pad, {
    ...opties,
    headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE, ...(opties.headers || {}) },
  });
  if (!r.ok) throw new Error(`aanbod-api ${pad}: HTTP ${r.status}`);
  return r.json();
}

async function verwerkAanbiedingen() {
  // 1. verlopen aanbiedingen opruimen + melden (de 24-uursklok)
  const { aanbiedingen: open } = await aanbodApi('?status=open');
  for (const a of open) {
    if (Date.now() > Date.parse(a.verlooptOp)) {
      await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen' }) });
      await telegram(`⏰ Inmeet-aanbod voor ${a.lead.naam} is na 24 uur verlopen zonder keuze. Volgende stap: nieuw aanbod of bellen (belscherm).`);
    }
  }

  // 2. gekozen aanbiedingen boeken
  const { aanbiedingen: gekozen } = await aanbodApi('?status=gekozen');
  console.log(`${gekozen.length} gekozen aanbod(en) te verwerken`);
  for (const a of gekozen) {
    const slot = a.slots[a.gekozenIndex];
    const lead = {
      id: a.lead.rpItemId,
      naam: a.lead.naam,
      telefoon: a.lead.telefoon,
      volledigAdres: a.lead.volledigAdres,
      producten: (a.lead.producten || []).map((p) => ({ naam: p.naam, aantal: p.aantal })),
      aantalProducten: (a.lead.producten || []).reduce((n, p) => n + (p.aantal || 1), 0),
    };
    const gekozenSlot = {
      inmeter: slot.inmeter,
      aankomst: new Date(slot.aankomst),
      extraRijtijdMin: 0,
    };
    try {
      const uitkomst = await verwerkLead(lead, null, gekozenSlot, a.duurMin);
      await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verwerkt' }) });
      console.log(`  ✓ ${a.lead.naam}: ${uitkomst.samenvatting}`);
      await telegram(`✅ Inmeetafspraak GEBOEKT na klantkeuze:\n${a.lead.naam} — ${slot.datum}, ${slot.inmeter}\n${uitkomst.samenvatting}`);
    } catch (e) {
      console.log(`  ✗ ${a.lead.naam}: ${e.message}`);
      await telegram(`⚠️ Boeken na klantkeuze MISLUKT voor ${a.lead.naam}: ${e.message.slice(0, 160)}\nAanbod blijft op "gekozen" staan; volgende run opnieuw.`);
    }
  }
}

if (process.argv.includes('--verwerk-aanbod')) {
  verwerkAanbiedingen().catch((e) => { console.error(e); process.exit(1); });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
