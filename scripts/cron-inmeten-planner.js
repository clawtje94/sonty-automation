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
const { PLANNING_TG_TOKEN: TG_TOKEN, PLANNING_TG_CHAT: TG_CHAT } = require('./lib/telegram-planning.js');

// De twee inmeters waarmee we starten (Daimy 2026-08-04).
const INMETERS = [
  { naam: 'Sjoerd', uuid: '1f122d19-e43e-6da0-8ffb-661a4ff9bb36' },
  { naam: 'Joey', uuid: '1f122cfa-17a2-6580-8257-7e80f004db9c' },
];

const LIVE = process.argv.includes('--live');
// SUNNY PLANT ZELF (Daimy 28-08): eerste voorstel automatisch, door dezelfde poorten. Zie lib/sunny-start.js.
const sunnyStart = require('./lib/sunny-start.js');
const SUNNY_MAX_PER_RUN = 5;
// VEILIGHEIDSKLEP: --live zonder filter zou elke lead op "Inmeten inplannen" boeken,
// dus ook echte klanten. Met --alleen <tekst> verwerkt hij uitsluitend de leads
// waarvan de naam die tekst bevat.
const ALLEEN = (process.argv.find((a) => a.startsWith('--alleen=')) || '').split('=')[1] || null;
const STATE = path.join(__dirname, '..', 'data', 'inmeten-planner-state.json');

// Datum van een moment als YYYY-MM-DD in Nederlandse tijd, om hele dagen te kunnen
// uitsluiten zonder dat een tijdstip 's ochtends vroeg op de vorige dag valt.
function dagSleutel(moment) {
  const d = new Date(moment);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(d);
}

function werkdagenTussen(van, tot) {
  let n = 0;
  const d = new Date(van);
  while (d < tot) {
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// BELOFTE aan de klant (Daimy 06-08): "de planning neemt binnen 5 dagen contact op."
// Wachten op een buur mag dus, maar uiterlijk op dag 4 (1 dag marge) krijgt de klant
// het beste beschikbare aanbod, ook als dat omrijden kost. Nodig je de tijd niet?
// Dan gewoon direct plannen — wachten is alleen voor dure routes.
const MAX_WACHTDAGEN = require('./lib/slotzoeker.js').MAX_WACHT_DAGEN;

// ── kleine helpers ──────────────────────────────────────────────────────────
const laadState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { aangeboden: {} }; } };
// aanbodTickets is gedeeld eigendom (planner, monitor, daemon, handmatig herstel):
// bij het opslaan altijd de unie nemen met wat er NU op disk staat, waarbij disk
// per token wint. Een lange planner-ronde schreef op 07-08 anders met zijn oude
// kopie een zojuist toegevoegd/omgezet token weg. Verwijderen doet alleen de
// reply-monitor (die werkt rechtstreeks op een verse kopie).
const bewaarState = (s) => {
  try {
    const disk = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    s.aanbodTickets = { ...(s.aanbodTickets || {}), ...(disk.aanbodTickets || {}) };
    // OPVOLGING OOK SAMENVOEGEN (Fatih 20/21-08: twee ochtenden achter elkaar "ronde 2",
    // omdat een lange ronde met zijn oude kopie de teller van de daemon overschreef).
    // Tellers: hoogste wint; tijdstempels: wat er is blijft staan.
    const op = { ...(disk.opvolging || {}) };
    for (const [k, v] of Object.entries(s.opvolging || {})) {
      if (typeof v === 'number' && typeof op[k] === 'number') op[k] = Math.max(v, op[k]);
      else if (op[k] === undefined) op[k] = v;
    }
    s.opvolging = op;
  } catch { /* eerste keer: geen disk-versie */ }
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
};
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));


/** Boekingsmelding voor de planning-groep (Daimy 09-08: "stuur alles wat ingeboekt
 * wordt naar de planning-groep"). Eén vaste opmaak, zodat iedereen in de groep in
 * één oogopslag ziet wie, wanneer, waar en bij wie — en of alles echt rond is. */
function boekingsMelding({ naam, aankomst, inmeter, plaats, adres, duurMin, samenvatting, via, automatisch }) {
  const wanneer = new Date(aankomst).toLocaleString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  });
  const regels = [
    `✅ INMEETAFSPRAAK GEBOEKT`,
    `${naam}${plaats ? ` uit ${plaats}` : ''}`,
    `${wanneer} bij ${inmeter}${duurMin ? ` (${duurMin} min)` : ''}`,
  ];
  if (adres) regels.push(adres);
  if (via) regels.push(`Via: ${via}`);
  if (samenvatting) regels.push(samenvatting);
  // Daimy 26-08: "onder het bericht dat jij volledig zelf inboekt dat ook even zetten"
  if (automatisch) regels.push('🤖 Volledig door de bot geregeld: gekozen tijd gecontroleerd, geboekt en bevestigd.');
  return regels.join('\n');
}

/** Max één GEBOEKT-melding per persoon per afspraak (Daimy 26-08: hij kreeg
 *  Alexander twee keer — een retry mag nooit een tweede melding opleveren). */
function magBoekingMelden(sleutel) {
  const p = path.join(__dirname, '..', 'data', 'boeking-meldingen.json');
  let d = {};
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* eerste keer */ }
  if (d[sleutel]) return false;
  d[sleutel] = new Date().toISOString();
  for (const [k, v] of Object.entries(d)) if (Date.now() - Date.parse(v) > 14 * 86400000) delete d[k];
  try { fs.writeFileSync(p, JSON.stringify(d, null, 1)); } catch { /* melding is belangrijker dan dedup */ }
  return true;
}

// Routering (Daimy 09-08): boekingen naar de planning-groep, al het andere naar de
// data-bot. Zie lib/telegram-planning.js — de groep is de werklijst van het team en
// moet schoon blijven.
const { planningTelegram } = require('./lib/telegram-planning.js');
async function telegram(tekst, opties) { await planningTelegram(tekst, opties); }

/** Laatste klantbericht (WA of mail) van NA `sinds` (ISO) — voor het antwoord op Sunny's wachtmelding.
 *  Mail: alleen het nieuwe deel, niet het gequote origineel. Geen bericht → null. */
async function klantReactieNa({ telefoon, email }, sinds) {
  const { trengoFetch } = require('./lib/trengo-fetch');
  const { laatsteWoordNa } = require('./lib/boek-poort.js');
  const tickets = [];
  if (telefoon) {
    try {
      const av = require('./lib/aanbod-versturen');
      const zoek = av.zoekWaTicketBreed || av.zoekWaTicket;
      const t = zoek ? await zoek(telefoon, { ookGesloten: true }) : null;
      if (t) tickets.push(typeof t === 'object' ? t.id : t);
    } catch { /* geen WA-gesprek is geen fout */ }
  }
  if (email) {
    const rc = await trengoFetch(`/contacts?term=${encodeURIComponent(email)}`);
    if (rc.ok) {
      const cs = (((await rc.json().catch(() => ({}))).data) || []).filter((c) => String(c.email || '').toLowerCase() === String(email).toLowerCase()).slice(0, 2);
      for (const c of cs) {
        const rt = await trengoFetch(`/tickets?contact_id=${c.id}&page=1`);
        if (!rt.ok) continue;
        const ts = (((await rt.json().catch(() => ({}))).data) || [])
          .filter((t) => t.contact?.id === c.id && String(t.updated_at || '') >= String(sinds).slice(0, 10)).slice(0, 4);
        for (const t of ts) if (!tickets.includes(t.id)) tickets.push(t.id);
      }
    }
  }
  let beste = null;
  for (const id of tickets.slice(0, 5)) {
    const rm = await trengoFetch(`/tickets/${id}/messages?page=1`);
    if (!rm.ok) continue;
    const d = await rm.json().catch(() => ({}));
    let alle = d.data || [];
    const lp = d.meta?.last_page || 1;
    if (lp > 1) { const r2 = await trengoFetch(`/tickets/${id}/messages?page=${lp}`); if (r2.ok) alle = alle.concat(((await r2.json().catch(() => ({}))).data) || []); }
    const inbound = alle.filter((m) => (m.message_type || m.type) === 'INBOUND').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const l = laatsteWoordNa(inbound, sinds);
    if (!l) continue;
    const tekst = String(l.message || l.body || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
    // gequote origineel eraf: Gmail ("Op ma 31 aug ... schreef"), Apple/Outlook-EN ("On ... wrote:"),
    // Outlook-NL ("Van: Aanvragen | Sonty ... Verzonden:"), klassiek ("-----Oorspronkelijk bericht-----")
    const kort = tekst.split(/\bOn .{5,80}? wrote:|\bOp .{5,120}? schreef\b|\bVan: .{0,120}?Verzonden:|-{3,} ?Oorspronkelijk bericht ?-{3,}|\bFrom: .{0,120}?Sent:/i)[0].trim();
    if (kort && (!beste || String(l.created_at) > beste.op)) beste = { tekst: kort, op: l.created_at, ticket: id };
  }
  return beste;
}

async function rpGet(ep) {
  // RP uit (vlag data/.rp-uit, scripts/rp-uitzetten.js): geen RP-calls meer; lijsten leeg, losse items null. Eigen leads komen via eigen-crm.
  if (require('./lib/dossiers.js').rpUit()) return /\/items\?|\/items$/.test(ep) ? { items: [] } : null;
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { Authorization: 'Bearer ' + RP_API_KEY } });
  if (!r.ok) throw new Error(`RP ${r.status}`);
  return r.json();
}
async function rpZetStatus(itemId, statusId) {
  // eigen CRM-lead: kolom in de eigen pipeline i.p.v. RP-status (blok 1 RP-uitzetten)
  if (require('./lib/eigen-crm.js').isEigen(itemId)) { try { return await require('./lib/eigen-crm.js').zetKolom(itemId, statusId); } catch (e) { console.log('  eigen-crm kolom mislukt: ' + e.message.slice(0, 80)); return false; } }
  const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${BACKLOG_ID}/items/${itemId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { status_id: statusId } }),
  });
  return r.ok;
}
async function planado(ep) {
  // Drukte-rem van Planado (429, of kale tekst "Rate Limit Exceeded") mag de ronde
  // niet laten crashen (SYSTEMEN-rood 24-08) — rustig opnieuw proberen.
  for (let poging = 0; poging < 5; poging++) {
    const r = await fetch('https://api.planadoapp.com/v2' + ep, { headers: { Authorization: 'Bearer ' + PLANADO_KEY } });
    if (r.ok) {
      const tekst = await r.text();
      try { return JSON.parse(tekst); } catch { /* toch rate-limit-tekst */ }
    } else if (r.status !== 429 && r.status < 500) {
      throw new Error(`Planado ${r.status}`);
    }
    await wachtEven(15000 * (poging + 1));
  }
  throw new Error('Planado blijft weigeren (rate limit?) voor ' + ep);
}
const wachtEven = (ms) => new Promise((r) => setTimeout(r, ms));

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

  let adres = [straat, nummer].filter(Boolean).join(' ');
  let pc = postcode;
  let woonplaats = plaats;
  // VANGNET fields.address (bug Franken 07-08): het winkel-adresformulier schrijft
  // naar item.fields.address, maar de lezer keek alleen naar de beschrijvings-
  // velden — de kaart bleef dus op "geen adres" staan terwijl het adres er wél was.
  if ((!adres || !woonplaats) && item.fields?.address) {
    try {
      const { adresUitTekst } = require('./lib/offerte-adres.js');
      const gevonden = adresUitTekst(String(item.fields.address));
      if (gevonden) { adres = gevonden.adres; pc = gevonden.postcode; woonplaats = gevonden.plaats; }
    } catch { /* vangnet is optioneel */ }
  }

  return {
    id: item.id,
    naam: item.summary || veld('Voornaam') + ' ' + veld('Achternaam'),
    telefoon: veld('Telefoonnummer'),
    email: veld('E-mailadres'),
    adres,
    postcode: pc,
    plaats: woonplaats,
    volledigAdres: [adres, pc, woonplaats].filter(Boolean).join(', '),
    // Wat de klant bij de aanvraag zelf heeft ingevuld ("het dakje wordt nog hersteld",
    // "graag het oude scherm meenemen"). Stond tot 16-08 nergens meer: niet in de
    // opdracht, niet in de agenda, dus de inmeter las het nooit.
    opmerking: veld('Opmerking'),
    producten,
    aantalProducten: producten.reduce((a, p) => a + p.aantal, 0),
  };
}

/** Lead met producten uit de beste bron: leadtekst, anders het RP-offertedocument. */
async function leesLeadCompleet(item) {
  const lead = leesLead(item);
  // TAALREGEL (Daimy 13-08): Engelstalige klant → alleen Sjoerd, nooit Joey.
  try { lead.engels = require('./lib/taal-voorkeur.js').isEngels(lead.telefoon, item.id); } catch { lead.engels = false; }
  const offerte = await leesOfferte(item); // ook voor de RP-nummers (sheet-sleutel)
  lead.rpNummers = offerte.nummers || [];
  lead.rpDatums = offerte.datums || [];
  // ADRES-VANGNET (Daimy 07-08, geval Franken/Kenny): winkel-/telefoonleads hebben
  // vaak geen adresvelden in de lead-tekst, maar het adres staat wél in het
  // getekende offerte-PDF. Uitzondering: staat er een adres-CORRECTIE in de lead
  // (Franken: "moet zijn Houtrijk 10, NIET Haarlemmermeer 10"), dan beslist een
  // mens — blind het offerte-adres pakken zou precies het foute adres geven.
  if (!lead.volledigAdres || !lead.plaats) {
    const { adresUitOfferte, heeftAdresCorrectie } = require('./lib/offerte-adres.js');
    if (heeftAdresCorrectie(item.description)) {
      lead.adresCorrectie = true;
    } else if (offerte.documentId) {
      try {
        const gevonden = await adresUitOfferte(PID, offerte.documentId);
        if (gevonden) {
          Object.assign(lead, gevonden, { adresBron: 'offerte-pdf' });
          console.log(`  (adres uit offerte-PDF: ${lead.naam} → ${lead.volledigAdres})`);
        }
      } catch { /* vangnet mislukt: kaart blijft gewoon op geen-adres */ }
    }
  }
  // DE OFFERTE WINT VAN DE LEADTEKST (Daimy 18-08, geval Irene Kersseboom).
  //
  // Tot nu toe stond het andersom: leverde de leadtekst ook maar één regel op, dan werd
  // de offerte niet eens opengeslagen. De leadtekst is het aanvraagformulier, en daarin
  // heet een screen gewoon "Windvast" met de maten als sub-regels eronder die we niet
  // lezen. Irene kreeg daardoor een opdracht met "1 product(en): 1x Windvast" terwijl
  // haar getekende offerte 202610734 een Zip Design 110 van 2500×2100 bevat. Dat raakt
  // 243 van 1000 leads: die hebben in de leadtekst alleen zo'n bijzaakregel staan.
  //
  // De commit van 05-08 heette al "Getekende RP-offerte is leidend", maar regelde alleen
  // wélk offertedocument je pakt (ACCEPTED wint van concept), niet of je er überhaupt
  // naar kijkt. Dit zet dat recht. Het kost geen extra RP-verkeer: leesOfferte werd
  // hierboven toch al aangeroepen voor de offertenummers.
  //
  // "1x Winkel offerte" is geen product maar een placeholder.
  const bruikbaar = lead.producten.filter((p) => !/winkel offerte|offerte$/i.test(p.naam));
  if (offerte.producten.length) {
    // Wat de klant in de AANVRAAG noemde maar niet in de offerte staat, gaat niet verloren:
    // dat komt als losse regel in de opdracht (Helene Beek 18-08 — lead noemt raamdecoratie,
    // haar offerte is alleen een rolluik). De inmeter weet dan dat er nog iets speelt zonder
    // dat het als "te meten" wordt gepresenteerd. Formulier-ruis (Windvast, windsensor,
    // Somfy/Tahoma, "Offerte op maat") blijft eruit; dat zijn geen losse producten.
    const restant = require('./lib/lead-restant.js').leadRestant(bruikbaar, offerte.producten);
    return {
      ...lead,
      producten: offerte.producten,
      aantalProducten: offerte.producten.reduce((a, p) => a + p.aantal, 0),
      bron: 'RP-offerte (' + (offerte.status || '?') + ')',
      leadRestant: restant,
    };
  }
  // Geen leesbare offerte? Dan is de leadtekst nog altijd beter dan niets.
  if (bruikbaar.length) return { ...lead, producten: bruikbaar, aantalProducten: bruikbaar.reduce((a, p) => a + p.aantal, 0), bron: 'leadtekst (geen offerteregels)' };
  // Meerdere offertedocumenten zonder één getekende: NIET automatisch verder.
  // De klant moet er echt zelf één tekenen (Daimy 05-08).
  if (offerte.ambigu) return { ...lead, bron: 'AMBIGU', ambigu: true, aantalDocs: offerte.aantalDocs };
  return { ...lead, bron: 'leadtekst (leeg)' };
}

// ── agenda per inmeter ──────────────────────────────────────────────────────
async function haalAgenda() {
  let jobs = [], after = null;
  // ruim genoeg pagineren: na de type-herbouw (05-08) staan de actuele opdrachten
  // achteraan de cursor — 10 pagina's gaf een vrijwel lege agenda (stil gevaar!)
  for (let i = 0; i < 40; i++) {
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

  // dekking bijhouden: hoeveel opdrachten er per inmeter in de LIJST staan, zodat we
  // kunnen zien of de detail-stap (adressen) stilletjes opdrachten laat vallen
  const lijstTelling = {};
  for (const j of gepland) {
    const inm = INMETERS.find((i) => i.uuid === j.assignee?.worker_uuid);
    if (inm) lijstTelling[inm.naam] = (lijstTelling[inm.naam] || 0) + 1;
  }

  // Adres-cache: details kosten 2,6s per stuk (rate-limit) — zonder cache duurt elke
  // run 20 minuten. Adressen wijzigen vrijwel nooit; verzetten maakt een nieuwe job
  // (nieuw uuid), dus cache op uuid is veilig.
  const CACHE_PAD = path.join(__dirname, '..', 'data', 'planner-adres-cache.json');
  let adresCache = {};
  try { adresCache = JSON.parse(fs.readFileSync(CACHE_PAD, 'utf8')); } catch {}

  for (const j of gepland) {
    const inm = INMETERS.find((i) => i.uuid === j.assignee?.worker_uuid);
    if (!inm) continue;
    let adres = adresCache[j.uuid]?.adres ?? null;
    let omschrijving = adresCache[j.uuid]?.omschrijving ?? '';
    // Het adres zit alleen in het job-detail, niet in de lijst. Rate-limits (429)
    // met retry afvangen — één gemiste wachttijd liet eerder bijna de hele agenda
    // stilletjes wegvallen (schaduwrun 06-08: 5 van 167 afspraken over).
    if (!(j.uuid in adresCache)) {
      for (let poging = 0; poging < 3 && !adres; poging++) {
        try {
          const det = await planado('/jobs/' + j.uuid);
          const h = det.job || det;
          adres = h.address?.formatted || null;
          omschrijving = omschrijving || h.description || '';
          if (adres) break;
        } catch { await wacht(6000); }
        await wacht(2600);
      }
      await wacht(2600);
      adresCache[j.uuid] = { adres, omschrijving: omschrijving.split('\n')[0].slice(0, 60) };
      fs.writeFileSync(CACHE_PAD, JSON.stringify(adresCache));
    }
    // STOFFERING/BEHANGEN BLOKKEERT NIET (Daimy 11-08: "dan is hij gewoon vrij om te
    // boeken; dat werd door het personeel verkeerd ingepland"). Zo'n blok liet
    // bijvoorbeeld heel di 18 aug bij Sjoerd vol lijken terwijl hij gewoon kon
    // inmeten. Vakantie blokkeert uiteraard nog steeds (laadVakanties).
    if (/stoffering|behangen/i.test(omschrijving)) continue;
    // GEEN adres (winkeldienst, intern overleg): telt WEL als bezette tijd — anders
    // plant de bot dwars door een winkeldienst heen. Als anker-adres nemen we de
    // winkel (Rijswijk) voor winkeldiensten en het magazijn voor de rest.
    if (!adres) {
      const soort = /winkel|showroom/i.test(omschrijving) ? 'Frijdastraat 8F, 2288 EZ Rijswijk' : null;
      adres = soort || require('./lib/reistijd').MAGAZIJN;
    }
    perInmeter[inm.naam].push({
      uuid: j.uuid, externalId: j.external_id || null,
      start: j.scheduled_at,
      eind: new Date(+new Date(j.scheduled_at) + ((j.scheduled_duration?.minutes) || 60) * 60000).toISOString(),
      adres,
      // Eerste regel van de omschrijving ("Inmeten — Astrid Verkaaik") als klant-veld:
      // de botst-checks filteren hierop om een EIGEN (halve) boeking niet als bezetting
      // te zien. Zonder dit veld matchte dat filter nooit en kreeg een klant wiens
      // boeking half was blijven hangen een onterecht "tijd is net vergeven"-excuus
      // plus een nieuw aanbod (Astrid Verkaaik 26-08).
      klant: (adresCache[j.uuid]?.omschrijving || omschrijving || '').split('\n')[0],
    });
  }
  // Losse showroom-boekingen (Bookings) blokkeren BEWUST NIET (Daimy 06-08:
  // "een losse showroomafspraak van een half uur hoeft niet geblokkeerd te worden" —
  // de winkel vangt die op; alleen een JOEY WINKEL-dienstblok blokkeert inmetingen).

  // dekkinsgcontrole: als de detail-stap >20% van de lijst liet vallen is de agenda
  // onbetrouwbaar en mag er NIET op gepland worden
  for (const inm of INMETERS) {
    const inLijst = lijstTelling[inm.naam] || 0;
    const opgehaald = perInmeter[inm.naam].length;
    if (inLijst >= 5 && opgehaald < inLijst * 0.9) {
      throw new Error(`agenda ${inm.naam} onvolledig: ${opgehaald}/${inLijst} afspraken met adres — niet op plannen`);
    }
  }
  // EIGEN OUTLOOK-AGENDA per inmeter (Daimy 02-09: 'meelezen MOET'): Joey had op 28-09
  // Tandarts + WINKEL alleen in zijn eigen agenda staan (niet in Planado, niet in Sonty
  // Montage) en daar zijn 4 inmetingen doorheen geboekt. Alles wat daar 'bezet' staat
  // telt nu mee. Faalt het ophalen, dan NIET plannen (zelfde beleid als laadVakanties).
  // Snapshot van de Planado-agenda (vóór de eigen-agendablokken, die hebben geen uuid) voor het
  // meetbon-dashboard per dag/adviseur (scripts/meetbon-afspraken-sync.js) — geen extra Planado-calls.
  try {
    const items = [];
    for (const inm of INMETERS) for (const x of perInmeter[inm.naam]) if (x.uuid) items.push({ uuid: x.uuid, externalId: x.externalId, start: x.start, eind: x.eind, inmeter: inm.naam, klant: x.klant || '' });
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'planado-agenda-snapshot.json'), JSON.stringify({ ts: new Date().toISOString(), items }));
  } catch (e) { console.log('  ! agenda-snapshot niet weggeschreven: ' + e.message); }
  await laadEigenAgendas(perInmeter);
  return perInmeter;
}

/** Eigen Outlook-agenda's: welk postvak hoort bij welke inmeter. Uitbreidbaar via
 * data/inmeters-rooster.json (veld eigenAgendaEmail), anders deze vaste lijst. */
const EIGEN_AGENDA_EMAIL = { Joey: 'joey@sonty.nl', Sjoerd: 'sjoerd@sonty.nl' };
const WINKEL_ADRES = 'Frijdastraat 8F, 2288 EZ Rijswijk';
/** Pure functie (los getest in tests/eigen-agenda-regressie.js): Outlook-events → bezette blokken.
 * Regels: geannuleerd of 'Vrij' telt niet; 'Inmeten Sonty/—' komt al uit Planado (overslaan,
 * anders ziet de botst-check een eigen halve boeking als vreemde bezetting); hele-dag-events
 * blokkeren de hele dag; geen adres → winkel bij winkel/showroom, anders magazijn. */
function eigenAgendaBlokken(events) {
  const uit = [];
  for (const e of events || []) {
    const onderwerp = String(e.Subject || '').trim();
    if (e.IsCancelled || /^(geannuleerd|canceled|cancelled):/i.test(onderwerp)) continue;
    if (String(e.ShowAs || '').toLowerCase() === 'free') continue;
    if (/^inmeten (sonty|—|-)/i.test(onderwerp)) continue;
    if (!e.Start?.DateTime || !e.End?.DateTime) continue;
    let s0, e0;
    if (e.IsAllDay) {
      s0 = new Date(e.Start.DateTime.slice(0, 10) + 'T00:00:00+02:00');
      e0 = new Date(e.End.DateTime.slice(0, 10) + 'T00:00:00+02:00');
      if (!isNaN(+s0) && !(e0 > s0)) e0 = new Date(+s0 + 86400000);
    } else {
      s0 = new Date(e.Start.DateTime.replace(/Z?$/, 'Z'));
      e0 = new Date(e.End.DateTime.replace(/Z?$/, 'Z'));
    }
    if (isNaN(+s0) || isNaN(+e0) || e0 <= s0) continue;
    const start = s0.toISOString(), eind = e0.toISOString();
    const adres = /winkel|showroom/i.test(onderwerp) ? WINKEL_ADRES : require('./lib/reistijd').MAGAZIJN;
    uit.push({ start, eind, adres, klant: 'eigen agenda: ' + onderwerp.slice(0, 60), eigenAgenda: true });
  }
  return uit;
}
async function laadEigenAgendas(perInmeter, dagenVooruit = 100) {
  const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
  const OH = { Authorization: 'Bearer ' + token };
  const cals = (((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars?$top=50', { headers: OH })).json()).value) || []);
  if (!cals.length) throw new Error('eigen agendas: geen kalenderlijst (token verlopen?) — niet plannen');
  const van = new Date(Date.now() - 86400000), tot = new Date(Date.now() + dagenVooruit * 86400000);
  for (const inm of INMETERS) {
    const email = (ROOSTER[inm.naam]?.eigenAgendaEmail || EIGEN_AGENDA_EMAIL[inm.naam] || '').toLowerCase();
    if (!email) { console.log(`  eigen agenda ${inm.naam}: geen postvak bekend — overgeslagen`); continue; }
    const cal = cals.find((c) => String(c.Owner?.Address || '').toLowerCase() === email && (c.IsDefaultCalendar || !/feestdagen|verjaardagen|holidays/i.test(c.Name)));
    if (!cal) throw new Error(`eigen agenda van ${inm.naam} (${email}) niet gevonden in Outlook — niet plannen`);
    let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?$top=500&$select=Subject,Start,End,IsAllDay,IsCancelled,ShowAs&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
    const evs = [];
    while (url) {
      const j = await (await fetch(url, { headers: OH })).json();
      if (j.error) throw new Error(`eigen agenda ${inm.naam}: ${j.error.message || 'fout'} — niet plannen`);
      evs.push(...(j.value || []));
      url = j['@odata.nextLink'] || null;
    }
    const blokken = eigenAgendaBlokken(evs);
    perInmeter[inm.naam].push(...blokken);
    const vb = blokken.slice(0, 2).map((b) => `${b.klant.replace('eigen agenda: ', '')} ${b.start.slice(0, 10)}`).join(', ');
    console.log(`  eigen agenda ${inm.naam} (${cal.Name}): ${blokken.length} bezette blokken${vb ? ' — o.a. ' + vb : ''}`);
  }
}

/** Werkdagen PER INMETER uit het echte rooster (data/inmeters-rooster.json is
 * leidend — Daimy 04-08; generieke 08:30-17:00 bood tijden aan buiten het rooster).
 * Vrije dagen (Joey wo/vr) vallen weg; startDatum (nieuwe inmeter) wordt gerespecteerd. */
const ROOSTER = require('../data/inmeters-rooster.json').inmeters;
const DAGCODE = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

// Vakanties komen NIET uit het rooster maar uit Outlook ("vakantie/verlof/vrij"-
// afspraken). De sync slaat die bewust over (geen klus), dus zonder deze stap zag de
// planner een inmeter met vakantie als beschikbaar (gezien 06-08: slot bij Sjoerd
// op 24 aug, midden in zijn vakantie).
const VAKANTIES = {}; // naam -> Set('YYYY-MM-DD')
async function laadVakanties(dagenVooruit = 70) {
  try {
    const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
    const OH = { Authorization: 'Bearer ' + token };
    const cal = (((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value) || [])
      .find((c) => c.Name === 'Sonty Montage');
    const van = new Date();
    const tot = new Date(); tot.setDate(tot.getDate() + dagenVooruit);
    let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView`
      + `?$top=500&$select=Subject,Start,End,IsCancelled,Attendees&startDateTime=${van.toISOString()}&endDateTime=${tot.toISOString()}`;
    const evs = [];
    while (url) {
      const j = await (await fetch(url, { headers: OH })).json();
      evs.push(...(j.value || []));
      url = j['@odata.nextLink'] || null;
    }
    for (const naam of Object.keys(ROOSTER)) VAKANTIES[naam] = new Set();
    for (const e of evs) {
      if (e.IsCancelled || !/vakantie|verlof|\bvrij\b/i.test(e.Subject || '')) continue;
      const namen = (e.Attendees || []).map((a) => (a.EmailAddress?.Name || '').split(' ')[0]);
      const wie = Object.keys(ROOSTER).filter((n) => namen.includes(n.split(' ')[0]));
      const d = new Date(e.Start.DateTime + 'Z');
      const eind = new Date(e.End.DateTime + 'Z');
      while (d < eind) {
        for (const n of wie) VAKANTIES[n].add(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }
    const telling = Object.entries(VAKANTIES).map(([n, v]) => `${n}: ${v.size}`).join(', ');
    console.log(`  vakantie-dagen geblokkeerd — ${telling}`);
  } catch (e) {
    console.log('  ! vakanties niet op te halen (' + e.message.slice(0, 60) + ') — voorzichtigheidshalve GEEN aanbod doen');
    throw new Error('vakanties onbekend: niet plannen');
  }
}
function werkdagenVoor(inmeterNaam, aantal = 15, vanafDatum) {
  // 15 roosterdagen (was 10): de agenda's zitten momenteel ~3 weken vol, waardoor
  // 10 dagen horizon "geen enkel gat" gaf terwijl er eind augustus wél plek is.
  const vast = ROOSTER[inmeterNaam]?.dagen;
  const startDatum = ROOSTER[inmeterNaam]?.startDatum;
  const dagen = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Noemt de klant zelf een datum ("pas vanaf 5 oktober"), dan begint de horizon
  // dáár — anders viel alles voorbij de 15 roosterdagen af en kreeg de klant
  // "geen enkele plek" terwijl de agenda daar leeg is (Laura Idzinga 15-08).
  if (vanafDatum && Date.parse(vanafDatum + 'T12:00:00') > +d) {
    d.setTime(Date.parse(vanafDatum + 'T12:00:00'));
  }
  let bekeken = 0;
  while (dagen.length < aantal && bekeken < aantal * 3) {
    bekeken++;
    const code = DAGCODE[d.getDay()];
    const blok = vast?.[code];
    const datum = d.toISOString().slice(0, 10);
    const naStart = !startDatum || datum >= startDatum;
    const vakantie = VAKANTIES[inmeterNaam]?.has(datum);
    if (blok && naStart && !vakantie) dagen.push({ datum, van: blok.van, tot: blok.tot });
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
// Is het 1-moment-template al beschikbaar (door Daimy aangemaakt + door Meta
// goedgekeurd)? Sleutels "moment"/"momentVer" in data/wa-templates.json.
function heeftMomentTemplate() {
  try {
    const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'wa-templates.json'), 'utf8'));
    return !!ids.moment;
  } catch { return false; }
}

async function zoekGrippNummer(naam, rpItemId) {
  let log = {};
  try { log = JSON.parse(fs.readFileSync(path.join(__dirname, '.gripp-invullen-sent.json'), 'utf8')); } catch { return null; }
  // Sinds de dedup-migratie zijn de sleutels 'item:<rp-id>'; de naam-sleutel is
  // legacy. Alleen op naam zoeken vond daardoor NOOIT meer iets (06-08: Eric en
  // Carlo hadden allang een offerte, maar de boeking bleef "zonder Gripp-nummer").
  const regel = (rpItemId && log['item:' + rpItemId]) || log[naam];
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
  // Zelfde 429-geduld als de planado()-leeshelper (fix 24-08): een boeking mag niet
  // stranden omdat Planado even "Rate Limit Exceeded" zegt (Astrid/Chebon 26-08).
  let laatste = '';
  for (let poging = 0; poging < 5; poging++) {
    const r = await fetch('https://api.planadoapp.com/v2' + ep, {
      method: methode,
      headers: {
        Authorization: 'Bearer ' + PLANADO_KEY,
        'Content-Type': 'application/json',
        'X-Planado-Notify-Assignees': 'false',
      },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.status === 204 ? {} : r.json();
    laatste = `Planado ${r.status}: ${(await r.text()).slice(0, 120)}`;
    if (r.status !== 429 && r.status < 500) break;
    await wacht(3000 * (poging + 1));
  }
  throw new Error(laatste);
}

/** Planado weigert een job als de external_id nog "bezet" is door een restant van een
 *  eerdere (halve) boekingspoging (Kranenburg 26-08: 422 "is used by another entity"
 *  na de rate-limit-cascade van die ochtend). De external_id wordt verderop toch
 *  overschreven naar gripp-{nr}, dus bij precies dít conflict proberen we één keer
 *  opnieuw zonder external_id in plaats van de klant te laten stranden. */
async function maakJobMetIdVangnet(maak, body) {
  try {
    return await maak(body);
  } catch (e) {
    if (!/external_id.*(used|another entity)/i.test(e.message)) throw e;
    console.log('  external_id bezet door restant — opnieuw zonder external_id (wordt later gripp-nr)');
    // ZICHTBAAR (28-08): dit betekent bijna altijd dat er al een (halve) opdracht staat — kantoor moet even kijken.
    try { await telegram(`⚠️ Planado weigerde external_id ${body.external_id} (al in gebruik) — nieuwe opdracht zonder id aangemaakt; controleer op een dubbele/oude opdracht voor deze klant.`); } catch { /* melding is extra */ }
    const { external_id, ...zonder } = body;
    return maak(zonder);
  }
}

async function verwerkLead(lead, item, slot, duurMin) {
  const inmeter = INMETERS.find((i) => i.naam === slot.inmeter);

  // 1. de afspraak zelf
  const maakJob = (body) => planadoPost('/jobs', body);
  // HALVE BOEKING HERGEBRUIKEN (Daimy 28-08): crashte een eerdere poging ná het aanmaken
  // van de Planado-opdracht, dan staat die in het register als 'bezig' — dezelfde tijd bij
  // dezelfde inmeter = die opdracht hergebruiken, nooit een tweede maken.
  const mut = require('./lib/inmeet-mutatie.js');
  const half = mut.halveBoeking(lead.id);
  const zelfdeSlot = !!(half && half.inmeter === slot.inmeter && Math.abs(Date.parse(half.aankomst) - +slot.aankomst) < 60000);
  if (half && !zelfdeSlot) await telegram(`⚠️ ${lead.naam}: er staat nog een halve Planado-opdracht (${half.planadoJobUuid}, ${half.aankomst}) van een eerdere poging op een ÁNDER moment — nieuwe boeking gaat door, die oude opdracht handmatig verwijderen.`);
  if (zelfdeSlot) console.log(`  halve boeking hergebruikt: Planado-opdracht ${half.planadoJobUuid} bestond al`);
  const job = zelfdeSlot ? { uuid: half.planadoJobUuid } : await maakJobMetIdVangnet(maakJob, {
    // Planado wil template/job_type als OBJECT ({uuid}/{code}); de platte *_uuid-velden
    // worden stil genegeerd en dan toont de app "Opdracht" i.p.v. "Inmeet afspraak"
    // (Daimy 2026-08-05 én 2026-08-06 — geverifieerd tegen de API-docs en een testjob).
    template: { uuid: '1f11c802-65cd-6aa0-9d06-7e73cee772e4' },
    job_type: { code: 'Inmeet afspraak' },
    // Wat de klant onderweg heeft doorgegeven hoort hier te staan: de inmeter leest de
    // opdracht, niet het WhatsApp-gesprek (Daimy 10-08, contactpersoon van Connie).
    description: `Inmeten — ${lead.naam}\n${lead.volledigAdres}\n\n${lead.aantalProducten} product(en): ${lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ')}`
      + (lead.leadRestant?.length ? `\n\nKlant vroeg in de aanvraag ook naar: ${lead.leadRestant.join(', ')} (staat NIET in de offerte)` : '')
      + (lead.opmerking ? `\n\nOPMERKING BIJ DE OFFERTE:\n${lead.opmerking}` : '')
      + require('./lib/inmeet-opmerkingen.js').alsTekst(lead.id),
    contacts: [{ type: 'phone', name: lead.naam, value: lead.telefoon || '-' }],
    address: { formatted: lead.volledigAdres },
    scheduled_at: slot.aankomst.toISOString(),
    scheduled_duration: { minutes: duurMin },
    // Planado wil de toewijzing als worker-object (422 'either team or worker must present')
    assignee: { worker: { uuid: inmeter.uuid } },
    external_id: `rp-${lead.id}`,
  });
  const jobUuid = job.job_uuid || job.uuid;
  try { mut.noteerHalveBoeking(lead.id, { naam: lead.naam, telefoon: lead.telefoon, planadoJobUuid: jobUuid, aankomst: slot.aankomst.toISOString(), inmeter: slot.inmeter }); } catch { /* register is vangnet */ }

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
  const grippNr = await zoekGrippNummer(lead.naam, lead.id);
  if (grippNr) {
    // via de retry-helper: een 429 gaf hier "Unexpected token 'R'" omdat de kale
    // tekst "Rate Limit Exceeded" als JSON werd gelezen (Astrid/Chebon 26-08)
    const detail = await planado(`/jobs/${jobUuid}`);
    const huidig = detail.job || detail;
    await planadoPost(`/jobs/${jobUuid}`, {
      version: huidig.version,
      description: `${huidig.description}\n\nMEETBON (invullen op telefoon):\nhttps://sonty-website.vercel.app/admin/meetbon/${grippNr}`,
      external_id: `gripp-${grippNr}`,
    }, 'PATCH');
    // De bon zelf aanmaken en voorvullen uit Gripp.
    await fetch(`https://sonty-website.vercel.app/api/meetbon/bon/${grippNr}`, {
      headers: { 'x-meet-code': process.env.MEETBON_CODE || '2288' },
    }).catch(() => {});
  }

  // SHEET (Daimy 06-08): inplanning = akkoord-administratie — inkoop "1",
  // inmeetdatum, en wie er gaat. Mislukt dit, dan blokkeert het de boeking niet
  // maar komt er wel een melding: de sheet is de conversie-administratie.
  let sheetNote = '';
  let sheetLocatie = null;
  try {
    const { schrijfInplanning } = require('./lib/sheet-inplannen.js');
    const dd = slot.aankomst;
    const inmeetDatum = `${String(dd.getDate()).padStart(2, '0')}-${String(dd.getMonth() + 1).padStart(2, '0')}-${dd.getFullYear()}`;
    const res = await schrijfInplanning({ rpNummers: lead.rpNummers || [], docDatums: lead.rpDatums || [], grippNr, naam: lead.naam, telefoon: lead.telefoon, inmeetDatum, inmeter: slot.inmeter });
    if (Number.isInteger(res.rij)) sheetLocatie = { tab: res.tab, rij: res.rij, kolomInkoop: res.kolomInkoop };
    sheetNote = res.gevonden ? ` · sheet ${res.tab} r${res.rij}` : ` · sheet: NIEUWE rij in ${res.tab} (klant stond er nog niet)`;
  } catch (e) {
    sheetNote = ' · SHEET NIET BIJGEWERKT: ' + e.message.slice(0, 60);
    try {
      const { zetInWachtrij } = require('./lib/sheet-wachtrij.js');
      zetInWachtrij({ rpNummers: lead.rpNummers || [], docDatums: lead.rpDatums || [], grippNr, naam: lead.naam, telefoon: lead.telefoon, inmeetDatum, inmeter: slot.inmeter });
    } catch {}
    await telegram(`⚠️ Sheet bijwerken mislukt voor ${lead.naam} (inkoop-1/datum/inmeter): ${e.message.slice(0, 120)} — staat in de wachtrij en wordt automatisch opnieuw geprobeerd.`);
  }

  // DASHBOARD DIRECT VERVERSEN (Daimy 11-08: "na elke boeking of sync moet het
  // dashboard gerefreshd worden"). Fire-and-forget: een mislukte ververs mag een
  // geslaagde boeking nooit blokkeren; de eerstvolgende planner-run herstelt hem dan.
  fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
    body: JSON.stringify({ type: 'ververs', bron: 'na-boeking' }),
  }).catch(() => {});

  const tijd = slot.aankomst.toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return {
    samenvatting: `${slot.inmeter} ${tijd} (${duurMin} min, +${slot.extraRijtijdMin} min rijtijd)` +
      (grippNr ? ` · Gripp ${grippNr} · meetbon klaar` : ' · LET OP: Gripp-nummer nog niet gevonden, meetbon-link ontbreekt') + sheetNote,
    grippNr,
    planadoJobUuid: jobUuid,
    sheetLocatie,
  };
}

// ── hoofdlus ────────────────────────────────────────────────────────────────
// Gebouwd op drukte (Daimy 06-08 "wat als er 20 man in inmeten inplannen staan?"):
//  - oudste lead eerst (eerlijk, en de 5-dagen-belofte telt per klant)
//  - openstaande én gekozen aanbiedingen tellen als bezet (geen dubbel aanbod)
//  - binnen één run worden zojuist aangeboden slots direct gereserveerd voor de rest
//  - een lead met een lopend aanbod wordt overgeslagen (geen dubbele mails)
//  - LIVE stuurt een KEUZE-aanbod (mail+WhatsApp); boeken gebeurt pas na klantkeuze
//    door --verwerk-aanbod. Direct boeken bestaat niet meer.
async function main() {
  const state = laadState();
  state.gezien = state.gezien || {};
  // Eerst de sheet-wachtrij: gefaalde akkoord-schrijfacties (beveiligde cellen)
  // opnieuw proberen zodra de rechten zijn opengezet. Geslaagde rijen krijgen
  // hun sheet-locatie alsnog in de boekingen-administratie.
  try {
    const { verwerkWachtrij } = require('./lib/sheet-wachtrij.js');
    const gelukt = await verwerkWachtrij();
    for (const g of gelukt) {
      try {
        const bo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
        for (const b of Object.values(bo)) {
          if (String(b.grippNr) === String(g.grippNr) && Number.isInteger(g.res.rij)) b.sheet = { tab: g.res.tab, rij: g.res.rij, kolomInkoop: g.res.kolomInkoop };
        }
        fs.writeFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), JSON.stringify(bo, null, 1));
      } catch {}
      await telegram(`✅ Sheet alsnog bijgewerkt voor ${g.naam} (stond in de wachtrij): ${g.res.tab} r${g.res.rij}.`);
    }
  } catch (e) { console.log('sheet-wachtrij overgeslagen: ' + e.message.slice(0, 60)); }
  console.log(LIVE ? '=== LIVE (aanbod wordt echt verstuurd) ===' : '=== SCHADUW (er wordt niets verstuurd) ===');

  // ALLE kaarten pagineren (Daimy 06-08: "18 mensen op inmeten inplannen maar veel
  // minder in de tool" — de eerste 200 kaarten bevatten maar een deel; het echte
  // aantal stond op 35). Testkaarten filteren we er wel uit.
  // API-ZUINIG (Daimy 06-08): volle scan (±19 calls) maximaal 1x per 3 uur;
  // tussenrondes 1 pagina voor verse instroom + de bekende leads uit de vorige scan.
  const items = [];
  const gezien = new Set();
  const volleScanNodig = !state.laatsteVolleScan || Date.now() - Date.parse(state.laatsteVolleScan) > 3 * 3600000;
  {
    let offset = 0;
    while (true) {
      const data = await rpGet(`/contact-service/${PID}/backlogS/${BACKLOG_ID}/items?limit=1000&offset=${offset}`.replace('backlogS', 'backlogs'));
      for (const i of data.items || []) {
        gezien.add(i.id);
        // gearchiveerde kaarten staan niet op het bord maar komen wel uit de API
        // (Daimy 06-08: "er staan er 18, niet 35" — 17 waren ITEM_ARCHIVED)
        const gearchiveerd = (i.technical_labels || []).some((l) => l?.type === 'ITEM_ARCHIVED');
        if (i.status_id === INMETEN_INPLANNEN && !gearchiveerd) items.push(i);
      }
      if (!volleScanNodig || !data.has_more) break;
      offset += 1000;
    }
  }
  if (volleScanNodig) {
    state.laatsteVolleScan = new Date().toISOString();
    state.inmeetLeads = items.map((i) => ({ id: i.id, summary: i.summary, item_subject: i.item_subject, description: i.description, fields: i.fields }));
  } else {
    // bekende leads van de laatste volle scan toevoegen (voor zover niet net op de pagina gezien)
    for (const b of state.inmeetLeads || []) if (!gezien.has(b.id)) items.push(b);
  }
  // EIGEN CRM (blok 1 RP-uitzetten): leads uit de eigen pipeline op "Inmeten inplannen" doen mee, in RP-vorm.
  // Alleen met vlag data/.eigen-crm-bron; fout = zichtbaar in de log, nooit stil.
  try {
    const eigen = require('./lib/eigen-crm.js');
    if (eigen.bronAan()) {
      const ei = await eigen.haalInmeetItems();
      for (const it of ei) if (!items.some((x) => x.id === it.id)) items.push(it);
      console.log(`${ei.length} eigen-CRM lead(s) op "Inmeten inplannen" meegenomen`);
    }
  } catch (e) { console.log('eigen-CRM bron niet bereikbaar: ' + e.message.slice(0, 80)); }
  bewaarState(state);
  const TESTKAART = /\btest\b|reuzenpanda|^[\s/|-]+$/i;
  const testkaarten = items.filter((i) => TESTKAART.test(i.summary || ''));
  for (const t of testkaarten) items.splice(items.indexOf(t), 1);
  console.log(`${items.length} lead(s) op "Inmeten inplannen" (${testkaarten.length} testkaart(en) overgeslagen)`);
  if (LIVE && !ALLEEN) {
    console.log('GEWEIGERD: --live zonder --alleen=<naam> zou alle leads aanschrijven, ook echte klanten.');
    return;
  }
  if (!items.length) {
    // OOK MET NUL WACHTENDE LEADS het dashboard publiceren (Monique 13-08): de vroege
    // return sloeg de publicatie over, waardoor het dashboard op een oude momentopname
    // bleef staan waarin haar boeking nog niet bestond — de kaart bleef ten onrechte
    // "niet geboekt" roepen. Boekingen en agenda veranderen ook zonder wachtenden.
    try {
      const { laadBoekingen } = require('./lib/inmeet-mutatie.js');
      const boekingenNu = Object.entries(laadBoekingen())
        .filter(([, b2]) => b2.status === 'geboekt' && b2.aankomst && new Date(b2.aankomst) > new Date())
        .map(([rpItemId, b2]) => ({ rpItemId, naam: b2.naam, aankomst: b2.aankomst, inmeter: b2.inmeter, duurMin: b2.duurMin, grippNr: b2.grippNr, telefoon: b2.telefoon }));
      await fetch('https://sonty-website.vercel.app/api/inmeet-dashboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
        body: JSON.stringify({ bijgewerkt: new Date().toISOString(), leads: [], boekingen: boekingenNu }),
      });
    } catch (e) { console.log('dashboard publiceren (leeg) mislukt: ' + e.message.slice(0, 60)); }
    return;
  }

  // eerste-keer-gezien bijhouden en oudste eerst behandelen
  const nu = new Date().toISOString();
  for (const it of items) state.gezien[it.id] = state.gezien[it.id] || nu;
  items.sort((a, b) => state.gezien[a.id].localeCompare(state.gezien[b.id]));

  const agenda = await haalAgenda();
  await laadVakanties();
  const inst = await require('./lib/instellingen.js').haalInstellingen();

  // lopende aanbiedingen: slots bezetten + die leads overslaan
  let lopendeLeads;
  try {
    lopendeLeads = await voegAanbiedingenToe(agenda);
    console.log(`  (${lopendeLeads.size} lead(s) met lopend aanbod: slots bezet, lead overgeslagen)`);
    await herbezorgSpookAanbiedingen(state);
  } catch (e) {
    console.log(`  ! aanbod-register niet bereikbaar (${e.message}) — VEILIGHEIDSSTOP, anders dreigt dubbel aanbod`);
    await telegram(`⚠️ Inmeet-planner gestopt: aanbod-register onbereikbaar, kan dubbel aanbod niet uitsluiten.`);
    return;
  }
  for (const inm of INMETERS) console.log(`  agenda ${inm.naam}: ${agenda[inm.naam].length} afspraken/ankers`);
  // VEILIGHEIDSSTOP: een inmeter zonder één komende afspraak bestaat in de praktijk
  // niet — dat betekent dat de agenda-ophaler stuk is. Doorplannen zou dubbel boeken.
  const leeg = INMETERS.filter((i) => !agenda[i.naam].length);
  if (leeg.length) {
    await telegram(`⚠️ Inmeet-planner GESTOPT: agenda van ${leeg.map((i) => i.naam).join(' + ')} kwam LEEG terug — dat kan niet kloppen (ophaler stuk?). Er is niets gepland of verstuurd.`);
    console.log('VEILIGHEIDSSTOP: lege agenda voor ' + leeg.map((i) => i.naam).join(', '));
    return;
  }

  const regels = [];
  const wachtenden = []; // leads zonder aanbod: kandidaten voor de combi-pas
  const dash = { bijgewerkt: new Date().toISOString(), leads: [], boekingen: [] };
  let sunnyVerstuurd = 0;

  for (const item of items) {
    if (lopendeLeads.has(item.id)) { dash.leads.push({ rpItemId: item.id, naam: item.summary, status: 'aanbod-loopt' }); continue; }
    const lead = await leesLeadCompleet(item);
    if (ALLEEN && !`${lead.naam} ${item.id}`.toLowerCase().includes(ALLEEN.toLowerCase())) continue;
    // AKKOORDDATUM IN DE SHEET (Daimy 29-08): zodra een klant op "Inmeten inplannen" komt, de datum in de
    // "Akkoord → Datum"-kolom (T) van zijn offerterij zetten — 1x, alleen als leeg, alleen voor leads die
    // vanaf 29-08-2026 binnenkwamen (geen stille backfill). Mislukt = volgende ronde opnieuw.
    try {
      const gezienOp = state.gezien?.[item.id];
      state.akkoordDatumSheet = state.akkoordDatumSheet || {};
      if (gezienOp && Date.parse(gezienOp) >= Date.parse('2026-08-29T00:00:00+02:00') && !state.akkoordDatumSheet[item.id]) {
        const { schrijfAkkoordDatum } = require('./lib/sheet-inplannen.js');
        const rA = await schrijfAkkoordDatum({ rpNummers: lead.rpNummers || [], telefoon: lead.telefoon, datum: new Date(gezienOp), docDatums: lead.rpDatums || [] });
        if (rA.gevonden) {
          state.akkoordDatumSheet[item.id] = { op: new Date().toISOString(), tab: rA.tab, rij: rA.rij, geschreven: rA.geschreven || null, overgeslagen: rA.overgeslagen || null };
          console.log(`    akkoorddatum sheet: ${rA.geschreven ? 'geschreven ' + rA.geschreven : rA.overgeslagen} (${rA.tab} r${rA.rij})`);
        } else {
          console.log('    akkoorddatum sheet: offerterij niet gevonden — volgende ronde opnieuw');
        }
      }
    } catch (e) { console.log('    akkoorddatum sheet mislukt: ' + String(e.message).slice(0, 80)); }
    if (lead.ambigu) {
      console.log(`  ! ${lead.naam}: ${lead.aantalDocs} offerteversies, geen enkele getekend — klant moet eerst tekenen`);
      regels.push(`${lead.naam}: ${lead.aantalDocs} offerteversies, GEEN getekend — klant moet tekenen (Mens nodig)`);
      dash.leads.push({ rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, telefoon: lead.telefoon, status: 'klant-moet-tekenen' });
      continue;
    }
    if (!lead.volledigAdres || !lead.plaats) {
      console.log(`  ! ${lead.naam}: geen bruikbaar adres, overslaan`);
      regels.push(`${lead.naam}: GEEN ADRES — handmatig`);
      dash.leads.push({
        rpItemId: item.id, naam: lead.naam, telefoon: lead.telefoon, status: 'geen-adres',
        reden: lead.adresCorrectie
          ? 'Er staat een adres-correctie in de lead (zie RP): check welk adres klopt en vul het hier in.'
          : undefined,
      });
      continue;
    }
    const duur = schatDuur(lead.producten);

    // Beste slot over beide inmeters heen: wie het goedkoopst kan, krijgt hem.
    let beste = [];
    for (const inm of inmetersVoor(lead)) {
      try {
        const s = await zoekSlots({
          agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur,
          werkdagen: werkdagenVoor(inm.naam),
          startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
          eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
        });
        beste.push(...s.map((x) => ({ ...x, inmeter: inm.naam })));
      } catch (e) {
        console.log(`  ! ${lead.naam} (${inm.naam}): ${e.message}`);
      }
    }
    beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
    // 5-dagen-belofte: kalenderdagen sinds we de lead voor het eerst zagen
    const wachtDagen = Math.floor((Date.now() - Date.parse(state.gezien[item.id])) / 86400000);
    let aanbod = kiesAanbod(beste, 3, { wachtDagen, deadlineDagen: inst.contactDeadlineDagen, maxOmrijdenMin: inst.maxOmrijdenMin });
    // het dashboard (en het template) moet ALTIJD 3 tijden hebben — te weinig binnen
    // de normale horizon? Verder vooruit kijken (Daimy 06-08: "bijna alles met 1 tijd,
    // het moet 100% goed gaan").
    // OOK BIJ NUL (Daimy 22-08: "heel veel zonder ook maar 1 tijd"): met Sjoerd op
    // vakantie t/m 11 sep zat er in de 15-werkdagen-horizon voor 9 leads geen enkel
    // gat, en de verlenging trad alleen in werking als er al minstens 1 tijd was.
    // Alleen als er wél gaten zijn maar de omrij-wachtlogica bewust wacht op een
    // klus in de buurt (beste.length > 0, aanbod leeg) blijven we gewoon wachten.
    if (aanbod.length < 3 && (aanbod.length || !beste.length)) aanbod = await zorgVoorDrieOpties(lead, duur, agenda, aanbod);

    console.log(`\n  ${lead.naam} — ${lead.volledigAdres}`);
    console.log(`    ${lead.aantalProducten} product(en) uit ${lead.bron}: ${lead.producten.map((p) => `${p.aantal}x ${p.naam}${p.breedte ? ` ${p.breedte}mm` : ''}`).join(', ') || '—'} → ${duur} min | wacht ${wachtDagen}/${inst.contactDeadlineDagen} dgn`);
    if (!aanbod.length) {
      const reden = waaromGeenAanbod(beste);
      if (wachtDagen >= inst.contactDeadlineDagen && !beste.length) {
        // agenda echt vol: dit kan de bot niet oplossen, dus hard escaleren
        console.log(`    DEADLINE VERSTREKEN en geen enkel gat — capaciteitsprobleem`);
        regels.push(`🚨 ${lead.naam} (${lead.plaats}): dag ${wachtDagen} en GEEN ENKEL gat — belofte "binnen 5 dagen" breekt, handmatig oplossen`);
      } else {
        console.log(`    NOG GEEN AANBOD (dag ${wachtDagen}): ${reden}`);
        regels.push(`${lead.naam} (${lead.plaats}): wacht dag ${wachtDagen}/${inst.contactDeadlineDagen} — ${reden}`);
        wachtenden.push({ lead, item, duur, wachtDagen });
        let sunnyWachtTekst = '';
        // VERRE KLANT NIET IN STILTE LATEN WACHTEN (Daimy 28-08, Mickey): Sunny meldt één keer
        // dat hij zo efficiënt mogelijk inplant en vraagt meteen de voorkeur.
        if (!LIVE && sunnyStart.aan() && !(sunnyStart.alleenNaam() && !`${lead.naam} ${item.id}`.toLowerCase().includes(sunnyStart.alleenNaam()))) {
          const wb = sunnyStart.wachtmeldingBesluit({ lead: { ...lead, rpItemId: item.id }, state, wachtDagen, maxWachtDagen: MAX_WACHTDAGEN });
          sunnyWachtTekst = wb.reden;
          if (wb.actie === 'melden') {
            try {
              const { taalVan, stuurVrijBericht } = require('./lib/aanbod-versturen');
              const taalW = taalVan({ telefoon: lead.telefoon, email: lead.email, rpItemId: item.id });
              const poortW = await require('./lib/verzend-poort.js').magSturen({ telefoon: lead.telefoon, email: lead.email, ticketId: null, soort: 'wachtmelding' });
              if (!poortW.ok) throw new Error('verzendpoort: ' + poortW.reden);
              const uitW = await stuurVrijBericht({ telefoon: lead.telefoon, email: lead.email, naam: lead.naam, tekst: sunnyStart.wachtmeldingTekst({ voornaam: (lead.naam || 'daar').split(' ')[0], taal: taalW, maxWachtDagen: MAX_WACHTDAGEN }), onderwerp: taalW === 'en' ? 'Your measuring appointment at Sonty' : 'Je inmeetafspraak bij Sonty', afzender: 'Sunny' });
              if (!uitW.ok) throw new Error(uitW.reden);
              state.sunnyWachtmelding = { ...(state.sunnyWachtmelding || {}), [item.id]: { op: new Date().toISOString(), via: uitW.via } };
              if (uitW.via === 'wa' && uitW.ticket) { try { require('./lib/gesprek-claims.js').claim(uitW.ticket, 'sunny-voorstel'); sunnyStart.registreerActiefTicket(uitW.ticket, lead.naam); } catch { /* vangnet */ } }
              regels.push(`  → Sunny meldde de wachttijd via ${uitW.via}`);
              console.log(`    SUNNY MELDDE WACHTTIJD via ${uitW.via}`);
            } catch (e) { console.log(`    Sunny wachtmelding mislukt: ${e.message}`); }
          }
        }
        // ANTWOORD OP DE WACHTMELDING (Daimy 02-09, Rowie Post: "donderdag of vrijdag deze week" bleef 2 dagen
        // onbeantwoord en eindigde als Mens nodig zonder antwoord). Sunny vraagt voorkeursdagen, dus leest hij
        // het antwoord ook: voorkeur → nieuw aanbod op die dagen via de stuur-aanbod-route (omrij-grens telt dan
        // niet); anders → Mens nodig mét de klanttekst op Telegram. Eén keer per reactie, nooit stil.
        const wm = state.sunnyWachtmelding?.[item.id];
        if (!LIVE && wm?.op && !state.wachtmeldingReactie?.[item.id]) {
          try {
            const reactie = await klantReactieNa({ telefoon: lead.telefoon, email: lead.email }, wm.op);
            if (reactie) {
              const { leesReactie } = require('./lib/planning-antwoord.js');
              const duiding = await leesReactie(reactie.tekst, []);
              const pogingen = state.wachtmeldingReactiePoging?.[item.id] || 0;
              const besluit = sunnyStart.wachtmeldingReactieBesluit({ tekst: reactie.tekst, duiding, gemeldOp: wm.op, reactieOp: reactie.op, pogingen });
              if (besluit.actie === 'later') {
                // lezer (LLM) faalde tijdelijk: volgende ronde opnieuw, niet markeren, niet melden
                state.wachtmeldingReactiePoging = { ...(state.wachtmeldingReactiePoging || {}), [item.id]: pogingen + 1 };
                bewaarState(state);
                console.log(`    WACHTMELDING-ANTWOORD: ${besluit.reden}`);
              }
              const noteer = (actie, extra = {}) => {
                state.wachtmeldingReactie = { ...(state.wachtmeldingReactie || {}), [item.id]: { op: new Date().toISOString(), actie, tekst: reactie.tekst.slice(0, 200), ticket: reactie.ticket, ...extra } };
                bewaarState(state);
              };
              if (besluit.actie === 'stuur-aanbod') {
                const rW = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                  body: JSON.stringify({
                    type: 'stuur-aanbod', rpItemId: item.id, naam: lead.naam, bron: 'wachtmelding-reply', wilEerder: true,
                    voorkeurDagen: besluit.voorkeur.dagen, voorkeurDagdeel: besluit.voorkeur.dagdeel || undefined, vanaf: besluit.voorkeur.vanaf || undefined,
                  }),
                }).catch(() => null);
                noteer('stuur-aanbod', { ok: !!rW?.ok, reden: besluit.reden });
                sunnyWachtTekst = `klant antwoordde (${besluit.reden}) → nieuw aanbod met voorkeur ${rW?.ok ? 'in de rij' : 'AANVRAGEN MISLUKT'}`;
                console.log(`    WACHTMELDING-ANTWOORD: ${sunnyWachtTekst}`);
                await telegram(`🔁 ${lead.naam} (${lead.plaats}) antwoordde op de wachtmelding: "${reactie.tekst.slice(0, 120)}" → ${besluit.reden}. Nieuw aanbod met die voorkeur ${rW?.ok ? 'staat in de rij' : 'AANVRAGEN MISLUKT — handmatig sturen'}.${besluit.overigeVraag ? ' Vraag van de klant: ' + besluit.overigeVraag : ''}`);
              } else if (besluit.actie === 'mens') {
                noteer('mens', { reden: besluit.reden });
                sunnyWachtTekst = `Mens nodig: ${besluit.reden}`;
                console.log(`    WACHTMELDING-ANTWOORD: ${sunnyWachtTekst}`);
                await telegram(`✋ ${lead.naam} (${lead.plaats}) antwoordde op de wachtmelding, maar ik haal er geen voorkeur uit: "${reactie.tekst.slice(0, 160)}". Mens nodig: antwoord de klant en plan zelf (${besluit.reden}).`);
              }
            }
          } catch (e) { console.log(`    wachtmelding-antwoord lezen mislukt: ${e.message}`); }
        }
        // óók wachtende klanten krijgen hun best beschikbare 3 tijden op de kaart
        // (mét omrij-minuten): de bot wacht zelf op een buurklus, maar de winkel
        // moet altijd kunnen handelen (Daimy 06-08)
        let nood = kiesAanbod(beste, 3, { wachtDagen: 999 });
        if (nood.length < 3) nood = await zorgVoorDrieOpties(lead, duur, agenda, nood);
        // De absoluut vroegste plek (omrij-grens genegeerd) hoort op de kaart als hij
        // fors eerder is — de winkel moet "klant wil eerder" direct kunnen bedienen
        // (geval Rene 07-08: die plek was onzichtbaar geworden door de datumregel).
        const vroegste = kiesAanbod(beste, 1, { negeerGrens: true })[0];
        if (vroegste && nood[0] && +vroegste.aankomst < +nood[0].aankomst - 7 * 86400000) {
          nood = [vroegste, ...nood].slice(0, 4);
        }
        // ONTDUBBELEN op tijd+inmeter (Daimy 09-08: "ik zie 2 of 4 keuzes"). Filteren
        // op objectidentiteit werkte niet: zorgVoorDrieOpties haalt slots opnieuw op,
        // dus hetzelfde moment kwam als een ANDER object terug en stond dan twee keer
        // op de kaart — wat er als één keuze minder uitziet.
        nood = ontdubbelSlots(nood);
        // Door het ontdubbelen (en doordat eerdere klanten hun tijden al gereserveerd
        // hebben) kan de kaart onder de drie zakken. Daimy wil drie ECHTE keuzes, dus
        // vullen we aan met een verse zoekronde over de dubbele horizon; wat er dan
        // nog steeds niet is, bestaat gewoon niet.
        if (nood.length < 3) {
          const extra = await zorgVoorDrieOpties(lead, duur, agenda, nood);
          nood = ontdubbelSlots([...nood, ...extra]);
        }
        nood = nood.slice(0, 3);
        dash.leads.push({
          rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, telefoon: lead.telefoon, adres: lead.volledigAdres, duurMin: duur, wachtDagen,
          status: 'wachtend', reden: reden + (sunnyWachtTekst ? ` · Sunny: ${sunnyWachtTekst}` : ''),
          producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
          top: nood.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin, label: x.label || undefined, dagOpener: x.dagOpener || undefined })),
        });
        // Wat we op de kaart tonen is voor DEZE klant bedoeld: binnen deze ronde
        // reserveren, anders krijgen twee klanten hetzelfde moment aangeboden en
        // botst het zodra de winkel ze allebei boekt (Daimy 09-08: "ik zie mensen
        // met dezelfde tijden en datum").
        for (const x of nood) {
          agenda[x.inmeter].push({ start: x.aankomst.toISOString(), eind: x.vertrek.toISOString(), adres: lead.volledigAdres, klant: `kaart ${lead.naam}` });
        }
      }
      continue;
    }
    for (const s of aanbod) {
      console.log(`    ${s.inmeter}: ${s.datum} ${venster(s)}  +${s.extraRijtijdMin} min rijtijd (na ${s.naVorige.slice(0, 24)})`);
    }
    regels.push(`${lead.naam} (${lead.plaats}, ${duur} min): ${aanbod.map((s) => `${s.inmeter} ${s.datum.slice(5)} ${venster(s)} +${s.extraRijtijdMin}min`).join(' | ')}`);
    const kaartOpties = aanbod;
    const kaart = {
      rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, telefoon: lead.telefoon, adres: lead.volledigAdres, duurMin: duur, wachtDagen,
      status: LIVE ? 'aanbod-verstuurd' : 'aanbod-mogelijk',
      producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
      top: kaartOpties.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin, label: x.label || undefined, dagOpener: x.dagOpener || undefined })),
    };
    dash.leads.push(kaart);

    if (LIVE) {
      try {
        // Geen beperking meegeven: dit is het EERSTE aanbod, er is nog geen klantwens.
        // (10-08 sloop hier per ongeluk `m` in — dat bestaat alleen in het antwoord-pad —
        // waardoor elk vers aanbod sindsdien stil crashte op "m is not defined".)
        const url = await maakEnVerstuurAanbod(lead, item, aanbod, duur, agenda, null);
        console.log(`    AANBOD VERSTUURD: ${url}`);
        regels.push(`  → aanbod verstuurd (24u geldig)`);
        state.aangeboden[item.id] = { naam: lead.naam, op: new Date().toISOString(), aanbod: aanbod.length };
      } catch (e) {
        console.log(`    FOUT bij aanbod versturen: ${e.message}`);
        if (process.env.POORT_OVERRIDE === '1') console.log(e.stack);
        regels.push(`  → aanbod versturen MISLUKT: ${e.message}`);
        continue;
      }
    }
    // SUNNY PLANT ZELF (Daimy 28-08): zonder --live stuurt Sunny het eerste voorstel
    // automatisch, door dezelfde poorten (lopend aanbod, bestaande boeking, verzendpoort
    // met stil-lijst/mens-actief/weeklimiet/24u-regel, verzendvenster). Aan-knop:
    // scripts/ai-ks/.sunny-start-live; inhoud "alleen:<naam>" = proefstand voor één klant
    // (eerst 1, dan de rest). Wat niet verstuurd wordt, staat mét reden op de kaart.
    if (!LIVE && sunnyStart.aan()) {
      const beperkTot = sunnyStart.alleenNaam();
      const gate = sunnyStart.magStarten({ lead: { ...lead, rpItemId: item.id }, slots: aanbod, lopend: false, geboekt: false, state, gezienOp: state.gezien?.[item.id] || null });
      if (beperkTot && !`${lead.naam} ${item.id}`.toLowerCase().includes(beperkTot)) {
        kaart.reden = `Sunny wacht: proefstand, alleen "${beperkTot}"`;
      } else if (!gate.ok && /voorstellen gestuurd zonder boeking/.test(gate.reden)) {
        // NA 2 VOORSTELLEN ZONDER REACTIE (Daimy 28-08): geen derde template, maar één persoonlijk
        // navraag-berichtje van Sunny (WA als het venster open is, anders mail); daarna pas bellen.
        const eerder = sunnyStart.aantalEerdereVoorstellen(state, { ...lead, rpItemId: item.id });
        const besluit = sunnyStart.navraagBesluit({ lead: { ...lead, rpItemId: item.id }, state, eerder });
        if (besluit.actie === 'navragen') {
          try {
            const { taalVan, stuurVrijBericht } = require('./lib/aanbod-versturen');
            const taalN = taalVan({ telefoon: lead.telefoon, email: lead.email, rpItemId: item.id });
            const tekst = sunnyStart.navraagTekst({ voornaam: (lead.naam || 'daar').split(' ')[0], taal: taalN });
            const poort = await require('./lib/verzend-poort.js').magSturen({ telefoon: lead.telefoon, email: lead.email, ticketId: null, soort: 'navraag' });
            if (!poort.ok) throw new Error('verzendpoort: ' + poort.reden);
            const uit = await stuurVrijBericht({ telefoon: lead.telefoon, email: lead.email, naam: lead.naam, tekst, onderwerp: taalN === 'en' ? 'Your measuring appointment at Sonty' : 'Je inmeetafspraak bij Sonty', afzender: 'Sunny' });
            if (!uit.ok) throw new Error(uit.reden);
            state.sunnyNavraag = { ...(state.sunnyNavraag || {}), [item.id]: { op: new Date().toISOString(), via: uit.via, naVoorstellen: eerder } };
            if (uit.via === 'wa' && uit.ticket) { try { require('./lib/gesprek-claims.js').claim(uit.ticket, 'sunny-voorstel'); sunnyStart.registreerActiefTicket(uit.ticket, lead.naam); } catch { /* vangnet */ } }
            kaart.reden = `Sunny vroeg persoonlijk na (${uit.via}, na ${eerder} voorstellen zonder reactie)`;
            regels.push(`${lead.naam}: Sunny vroeg na via ${uit.via}`);
            console.log(`    SUNNY VROEG NA via ${uit.via} (na ${eerder} voorstellen)`);
          } catch (e) {
            kaart.reden = `Sunny wacht: navragen mislukt — ${String(e.message).slice(0, 80)}`;
            console.log(`    Sunny navragen mislukt: ${e.message}`);
          }
        } else if (besluit.actie === 'bellen') {
          kaart.reden = 'Mens nodig (bellen): ' + besluit.reden;
          regels.push(`${lead.naam}: ${besluit.reden}`);
          state.belMelding = state.belMelding || {};
          if (!state.belMelding[item.id]) {
            state.belMelding[item.id] = new Date().toISOString();
            await telegram(`📞 ${lead.naam} (${lead.plaats || ''}): ${besluit.reden}. Tel ${lead.telefoon || '-'}.`, { boeking: true });
          }
        } else {
          kaart.reden = 'Sunny wacht: ' + besluit.reden;
        }
      } else if (!gate.ok) {
        kaart.reden = 'Sunny wacht: ' + gate.reden;
        if (gate.mensNodig) regels.push(`${lead.naam}: ${gate.reden}`);
        console.log(`    Sunny stuurt niet: ${gate.reden}`);
      } else if (sunnyVerstuurd >= SUNNY_MAX_PER_RUN) {
        kaart.reden = `Sunny wacht: max ${SUNNY_MAX_PER_RUN} voorstellen per ronde, volgende ronde`;
        console.log(`    Sunny: rondeplafond bereikt, ${lead.naam} volgende ronde`);
      } else {
        try {
          const url = await maakEnVerstuurAanbod(lead, item, aanbod, duur, agenda, null, { bron: 'sunny', stijl: 'sunny' });
          sunnyVerstuurd++;
          kaart.status = 'aanbod-verstuurd';
          kaart.reden = `Sunny stuurde voorstel: ${sunnyStart.slotZin(aanbod[0])}`;
          console.log(`    SUNNY-VOORSTEL VERSTUURD: ${url}`);
          regels.push(`  → Sunny stuurde het voorstel (${sunnyStart.slotZin(aanbod[0])})`);
          state.aangeboden[item.id] = { naam: lead.naam, op: new Date().toISOString(), aanbod: aanbod.length, bron: 'sunny' };
        } catch (e) {
          kaart.reden = 'Sunny: niet verstuurd — ' + String(e.message).slice(0, 90);
          console.log(`    Sunny: voorstel NIET verstuurd: ${e.message}`);
          regels.push(`  → Sunny-voorstel MISLUKT: ${e.message}`);
          continue;
        }
      }
    }
    // binnen deze run: aangeboden slots zijn bezet voor de volgende leads
    for (const s of aanbod) {
      agenda[s.inmeter].push({ start: s.aankomst.toISOString(), eind: s.vertrek.toISOString(), adres: lead.volledigAdres, klant: `aanbod ${lead.naam}` });
    }
  }

  // COMBI-PAS (Daimy 06-08 "kijk of je in de te plannen lijst combi's kan maken"):
  // wachtende klanten die dicht bij elkaar wonen worden als groep beoordeeld — de
  // omrij-kosten delen ze, dus een rit die voor één klant te duur is kan voor twee
  // of drie samen wél uit. De oudste krijgt eerst aanbod; zijn slots worden ankers
  // waardoor de rest er in dezelfde run omheen valt.
  await combiPas(wachtenden, agenda, regels, dash);

  // ACTUELE WACHTTIJD voor de klantenservice (Daimy 09-08, geval Rita van Schagen):
  // de bot beloofde standaard "2 tot 3 weken" terwijl de eerste plek zes weken verder
  // lag. Hier schrijven we de eerstvolgende plek weg die we vandaag zouden aanbieden,
  // zodat de bot de waarheid vertelt in plaats van een vast getal.
  try {
    const vroegsteAankomsten = dash.leads
      .flatMap((l) => (l.top || []).map((t) => t.aankomst))
      .filter(Boolean)
      .sort();
    if (vroegsteAankomsten.length) {
      fs.writeFileSync(path.join(__dirname, '..', 'data', 'actuele-wachttijd.json'), JSON.stringify({
        vroegsteDatum: vroegsteAankomsten[0],
        bijgewerkt: new Date().toISOString(),
        bron: 'inmeet-planner: vroegste tijd die vandaag aan een wachtende klant getoond wordt',
      }, null, 1));
    }
  } catch (e) { console.log('wachttijd wegschrijven mislukt: ' + e.message); }

  // dashboard vullen: komende boekingen + overzicht naar de site
  try {
    const { laadBoekingen } = require('./lib/inmeet-mutatie.js');
    dash.boekingen = Object.entries(laadBoekingen())
      .filter(([, b]) => b.status === 'geboekt' && Date.parse(b.aankomst) > Date.now())
      .map(([id, b]) => ({ rpItemId: id, naam: b.naam, aankomst: b.aankomst, inmeter: b.inmeter, duurMin: b.duurMin, grippNr: b.grippNr || null, telefoon: b.telefoon || null }))
      .sort((a, b) => a.aankomst.localeCompare(b.aankomst));
    await fetch('https://sonty-website.vercel.app/api/inmeet-dashboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
      // bijgewerkt-stempel op het POST-moment: de run zelf duurt minuten, en met de
      // startstempel leek een verse publicatie oud én verloor hij de race met een
      // boeking die tijdens de run binnenkwam (Monique 13-08)
      body: JSON.stringify({ ...dash, boekingen: (() => { try { return Object.entries(laadBoekingen()).filter(([, b2]) => b2.status === 'geboekt' && b2.aankomst && new Date(b2.aankomst) > new Date()).map(([rpItemId, b2]) => ({ rpItemId, naam: b2.naam, aankomst: b2.aankomst, inmeter: b2.inmeter, duurMin: b2.duurMin, grippNr: b2.grippNr, telefoon: b2.telefoon })); } catch { return dash.boekingen; } })(), bijgewerkt: new Date().toISOString() }),
    });
  } catch (e) { console.log('dashboard publiceren mislukt: ' + e.message); }

  // Telegram-beleid (Daimy 06-08 "niet steeds dezelfde mensen"): de schaduwronde
  // meldt alleen NIEUWE klanten op de planlijst en 🚨-escalaties. Al het andere
  // staat gewoon op het dashboard.
  state.gemeld = state.gemeld || {};
  const nieuweLeads = dash.leads.filter((l) => !state.gemeld[l.rpItemId]);
  for (const l of nieuweLeads) state.gemeld[l.rpItemId] = new Date().toISOString();
  const escalaties = regels.filter((r) => r.includes('🚨'));
  bewaarState(state);
  if (nieuweLeads.length || escalaties.length) {
    const stukken = [];
    if (nieuweLeads.length) stukken.push(`${nieuweLeads.length} nieuwe klant(en) op de planlijst: ${nieuweLeads.map((l) => l.naam).join(', ')} — zie het dashboard.`);
    if (escalaties.length) stukken.push(escalaties.join('\n'));
    await telegram(`Inmeet-planner (${LIVE ? 'LIVE' : 'schaduw'}): ` + stukken.join('\n'));
  }
}

/** Zelfde moment bij dezelfde inmeter = één keuze, ook als het uit twee losse
 * zoekrondes komt (objecten verschillen dan, de tijd niet). */
function ontdubbelSlots(slots) {
  const gezien = new Set();
  return slots.filter((s) => {
    const sleutel = `${s.inmeter}|${+s.aankomst}`;
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
}

const MAX_COMBI_RIJTIJD_MIN = 20; // klanten die hooguit dit uit elkaar wonen vormen een combi

async function combiPas(wachtenden, agenda, regels, dash = null) {
  if (wachtenden.length < 2) return;
  const { reistijd } = require('./lib/reistijd');
  const { MAX_EXTRA_RIJTIJD_MIN } = require('./lib/slotzoeker.js');
  const { zoekCombiDag } = require('./lib/combi-dag.js');

  // groepen bouwen op onderlinge rijtijd (klein aantal, dus paarsgewijs is prima)
  const groep = wachtenden.map((_, i) => i);
  for (let a = 0; a < wachtenden.length; a++) {
    for (let b = a + 1; b < wachtenden.length; b++) {
      try {
        const r = await reistijd(wachtenden[a].lead.volledigAdres, wachtenden[b].lead.volledigAdres, new Date());
        if (r.minuten <= MAX_COMBI_RIJTIJD_MIN) {
          const doel = groep[a];
          for (let k = 0; k < groep.length; k++) if (groep[k] === groep[b]) groep[k] = doel;
        }
      } catch { /* adres niet routeerbaar: geen combi */ }
    }
  }
  const groepen = {};
  groep.forEach((g, i) => { (groepen[g] = groepen[g] || []).push(wachtenden[i]); });

  for (const leden of Object.values(groepen)) {
    if (leden.length < 2) continue;
    leden.sort((a, b) => b.wachtDagen - a.wachtDagen); // oudste eerst
    console.log(`\n  COMBI-KANS: ${leden.map((l) => l.lead.naam + ' (' + l.lead.plaats + ')').join(' + ')}`);

    // COMBI-DAG (Daimy 06-08 akkoord): zoek over de verlengde horizon de vroegste
    // dag waarop de hele groep achter elkaar past. Alle tijden op die ene dag, dus
    // wat de klanten ook kiezen: ze landen samen en delen de lange rit.
    const combi = await zoekCombiDag({
      leden: leden.map((w) => ({ naam: w.lead.naam, adres: w.lead.volledigAdres, duurMin: w.duur, w })),
      inmeters: INMETERS.map((inm) => ({
        naam: inm.naam, agenda: agenda[inm.naam], werkdagen: werkdagenVoor(inm.naam, 30),
        startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
        eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
      })),
    });
    if (combi) {
      console.log(`    COMBI-DAG ${combi.datum} bij ${combi.inmeter}: samen +${combi.totaalExtraMin} min`);
      regels.push(`COMBI-DAG ${combi.datum} (${combi.inmeter}): ${leden.map((l) => l.lead.naam + ' (' + l.lead.plaats + ')').join(' + ')} — samen +${combi.totaalExtraMin} min`);
      for (const { lid, aanbod } of combi.perLid) {
        const w = lid.w;
        const metInmeter = aanbod.map((x) => ({ ...x, inmeter: combi.inmeter }));
        console.log(`    ${w.lead.naam}: ${metInmeter.map((x) => `${venster(x)} +${x.extraRijtijdMin}min`).join(' | ')}`);
        regels.push(`  ${w.lead.naam}: ${metInmeter.map((x) => `${x.datum.slice(5)} ${venster(x)} +${x.extraRijtijdMin}min`).join(' | ')}`);
        if (LIVE) {
          try {
            await maakEnVerstuurAanbod(w.lead, w.item, metInmeter, w.duur, agenda);
            regels.push('  → combi-dag-aanbod verstuurd');
          } catch (e) { regels.push(`  → combi-dag-aanbod versturen MISLUKT: ${e.message}`); continue; }
        }
        for (const x of metInmeter) {
          agenda[x.inmeter].push({ start: x.aankomst.toISOString(), eind: x.vertrek.toISOString(), adres: w.lead.volledigAdres, klant: `aanbod ${w.lead.naam}` });
        }
        // dashboard-kaart bijwerken: de winkel ziet de combi-dag en kan klikken
        const kaart = dash?.leads?.find((l) => l.rpItemId === w.item.id);
        if (kaart) {
          kaart.status = LIVE ? 'aanbod-verstuurd' : 'combi-dag';
          kaart.reden = `combi-dag ${combi.datum} met ${leden.filter((o) => o !== w).map((o) => o.lead.naam).join(' + ')}`;
          kaart.top = metInmeter.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin }));
        }
      }
      continue; // groep bediend: de losse per-lid-mechaniek hieronder is niet meer nodig
    }
    console.log('    geen combi-dag haalbaar binnen de verlengde horizon — losse combi-mechaniek als vangnet');

    for (let volg = 0; volg < leden.length; volg++) {
      const w = leden[volg];
      let beste = [];
      for (const inm of inmetersVoor(lead)) {
        try {
          const sl = await zoekSlots({
            agenda: agenda[inm.naam], adres: w.lead.volledigAdres, duurMin: w.duur,
            werkdagen: werkdagenVoor(inm.naam),
            startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
            eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
          });
          beste.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
        } catch { /* geen slots bij deze inmeter */ }
      }
      // gedeelde kosten: de rit telt per klant in de groep
      const grens = MAX_EXTRA_RIJTIJD_MIN * leden.length;
      beste = beste.filter((x) => x.extraRijtijdMin <= grens)
        .sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
      const aanbod = kiesAanbod(beste, 3, { wachtDagen: 999 }); // filter al gedaan, op groepsniveau
      if (!aanbod.length) { console.log(`    ${w.lead.naam}: ook als combi geen gat`); continue; }

      console.log(`    ${w.lead.naam}: combi-aanbod ${aanbod.map((x) => `${x.inmeter} ${x.datum.slice(5)} ${venster(x)} +${x.extraRijtijdMin}min`).join(' | ')}`);
      regels.push(`COMBI ${w.lead.naam} (${w.lead.plaats}): ${aanbod.map((x) => `${x.inmeter} ${x.datum.slice(5)} ${venster(x)} +${x.extraRijtijdMin}min`).join(' | ')}`);
      if (LIVE) {
        try {
          await maakEnVerstuurAanbod(w.lead, w.item, aanbod, w.duur, agenda);
          regels.push('  → combi-aanbod verstuurd');
        } catch (e) { regels.push(`  → combi-aanbod versturen MISLUKT: ${e.message}`); continue; }
      }
      // slots reserveren zodat de rest van de groep ernaast valt
      for (const x of aanbod) {
        agenda[x.inmeter].push({ start: x.aankomst.toISOString(), eind: x.vertrek.toISOString(), adres: w.lead.volledigAdres, klant: `aanbod ${w.lead.naam}` });
      }
    }
  }
}

/** Minimaal 3 tijden garanderen (Daimy 06-08: "stuur je dan ook altijd 3 opties?" —
 * het knoppen-template heeft er altijd 3 nodig). Te weinig? Dan verder vooruit
 * kijken (dubbele horizon). Lukt ook dat niet, dan wordt er NIET verstuurd. */
// Welke inmeters mogen deze lead doen? Engelstalig = alleen Sjoerd (Daimy 13-08).
function inmetersVoor(lead) {
  return lead?.engels ? INMETERS.filter((i) => i.naam === 'Sjoerd') : INMETERS;
}

async function zorgVoorDrieOpties(lead, duur, agenda, huidigAanbod) {
  if (huidigAanbod.length >= 3) return huidigAanbod;
  // Getrapte horizon (09-08): eerst 30 roosterdagen, en pas als het er dán nog geen
  // drie zijn verder vooruit. De agenda's zitten nu tot half oktober vol en sinds we
  // getoonde tijden per klant reserveren, houdt de laatste klant in de rij anders
  // maar één keuze over — terwijl er verderop wel plek is.
  for (const horizon of [30, 60]) {
    let beste = [];
    for (const inm of inmetersVoor(lead)) {
      try {
        const sl = await zoekSlots({
          agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur,
          werkdagen: werkdagenVoor(inm.naam, horizon),
          startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
          eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
        });
        beste.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
      } catch { /* inmeter zonder slots */ }
    }
    beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
    let gevonden = kiesAanbod(beste, 3, { wachtDagen: 999 });
    // Laatste redmiddel voor de dashboard-kaart: zitten de agenda's zo vol dat er
    // binnen de omrij-grens maar één plek is (Rita van Schagen in Ter Aar, 09-08),
    // vul dan aan met duurdere plekken. De winkel ziet de omrij-minuten op de knop
    // staan en kan zelf beslissen; één keuze tonen terwijl er plek is, helpt niemand.
    if (gevonden.length < 3) {
      const ruim = kiesAanbod(beste, 3, { negeerGrens: true });
      gevonden = ontdubbelSlots([...gevonden, ...ruim]).slice(0, 3);
    }
    if (gevonden.length >= 3 || horizon === 60) return gevonden;
  }
  return huidigAanbod;
}

/** Vlak vóór verzending nog één keer checken of de tijden echt vrij zijn.
 * Tussen het ophalen van de agenda (duurt minuten door de rate limits) en het
 * daadwerkelijk versturen kan een ander verzoek dezelfde plek pakken. Zo kregen
 * Rick van Nieuwkerk (15:15) en Katuscha Tellegen (15:20) op 09-08 allebei
 * maandagmiddag bij Joey aangeboden, terwijl één inmeting 20 minuten duurt.
 * Deze check kost één API-call en voorkomt dat twee klanten om dezelfde plek
 * strijden gedurende het 24-uursvenster. */
async function nogSteedsVrij(aanbod, duurMin, naam) {
  const vers = {};
  for (const inm of INMETERS) vers[inm.naam] = [];
  try { await voegAanbiedingenToe(vers); } catch { return aanbod; } // register onbereikbaar: niet blokkeren
  return aanbod.filter((s) => {
    const van = +s.aankomst;
    const tot = van + duurMin * 60000;
    const botst = (vers[s.inmeter] || []).some((a) =>
      !String(a.klant || '').includes(naam) && Date.parse(a.start) < tot && Date.parse(a.eind) > van);
    if (botst) console.log(`  (slot ${s.datum} ${venster(s)} bij ${s.inmeter} is net vergeven aan een andere klant — valt af)`);
    return !botst;
  });
}

/** Aanbod vastleggen in het register en direct naar de klant sturen (mail + WhatsApp). */
async function maakEnVerstuurAanbod(lead, item, aanbod, duurMin, agenda = null, beperking = null, opties = {}) {
  // HARDE STOP (Daimy 10-08): een klant met een LOPENDE afspraak krijgt NOOIT een nieuw
  // voorstel. Op 10-08 kreeg Eric van der Meer een tweede voorstel terwijl hij al op
  // 18 augustus stond — puur omdat er een verkeerd RP-id werd meegegeven. Dat is
  // verwarrend voor een echt mens en volstrekt vermijdbaar: de boeking staat gewoon
  // in ons eigen bestand. Wie zijn afspraak wil wijzigen gaat via verzetten, niet via
  // een nieuw aanbod.
  try {
    const { laadBoekingen } = require('./lib/inmeet-mutatie.js');
    const rpId = item?.id || lead?.rpItemId;
    const bestaande = rpId ? laadBoekingen()[rpId] : null;
    if (bestaande?.status === 'geboekt' && Date.parse(bestaande.aankomst) > Date.now()) {
      const wanneer = new Date(bestaande.aankomst).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
      await telegram(`🛑 GEEN aanbod verstuurd naar ${lead.naam}: hij heeft al een afspraak op ${wanneer} bij ${bestaande.inmeter}. Wil hij verzetten, doe dat via "afspraak verzetten".`);
      throw new Error(`klant heeft al een afspraak (${wanneer}) — geen tweede voorstel gestuurd`);
    }
  } catch (e) {
    if (/al een afspraak/.test(e.message)) throw e; // bewuste stop
    // boekingenbestand onleesbaar: dan niet blokkeren, wel loggen
    console.log('  (boekingscheck overgeslagen: ' + e.message.slice(0, 60) + ')');
  }
  // Aantal aan te bieden tijden is instelbaar (Daimy 07-08: "gewoon 1 moment
  // aanbieden, in de winkel maken mensen ook bijna altijd tijd"). Bij 1 sturen we
  // het beste (goedkoopste) moment; de verzender valt zelf terug op 3 zolang de
  // 1-moment-templates nog niet door Meta zijn goedgekeurd.
  const aantalGewenst = (await require('./lib/instellingen.js').haalInstellingen()).aantalTijden === 1 ? 1 : 3;
  if (aantalGewenst === 1 && !heeftMomentTemplate()) {
    console.log('  (aantalTijden=1 maar 1-moment-template ontbreekt nog — val terug op 3)');
  }
  // Sunny-stijl: altijd precies één beste tijd (Daimy 28-08), template of niet.
  const aantal = opties.stijl === 'sunny' ? 1 : (aantalGewenst === 1 && heeftMomentTemplate() ? 1 : 3);
  // laatste botsingscontrole vlak vóór verzending (zie nogSteedsVrij)
  aanbod = await nogSteedsVrij(aanbod, duurMin, lead.naam);
  if (!aanbod.length) throw new Error('alle tijden zijn net aan een andere klant aangeboden — opnieuw laten rekenen');
  if (aanbod.length < aantal && agenda) aanbod = await zorgVoorDrieOpties(lead, duurMin, agenda, aanbod);
  // De aanvuller kent de wensen van de klant niet en kan er dus tijden bij leggen die
  // hij net heeft uitgesloten (Taico 10-08: "vanaf 24 augustus" en tóch 17 aug erbij).
  // Daarom hier, ná al het aanvullen, de harde grens nogmaals afdwingen.
  if (beperking?.vanaf) aanbod = aanbod.filter((s) => +s.aankomst >= +new Date(beperking.vanaf + 'T00:00:00+02:00'));
  if (beperking?.nietDeze?.length) {
    const afgewezen = new Set(beperking.nietDeze.map((x) => +new Date(x)));
    aanbod = aanbod.filter((s) => !afgewezen.has(+s.aankomst));
  }
  // Hele dagen die de klant uitsloot ("elke dag behalve 28 sept"): ook geen ander
  // tijdstip op die dag (Theo Hoffman 26-08 kreeg 28 sept 12:30 nadat hij 28 sept
  // 10:50 had afgewezen met "elke dag is goed behalve 28 sept").
  if (beperking?.nietDagen?.length) {
    const dagenUit = new Set(beperking.nietDagen);
    aanbod = aanbod.filter((s) => !dagenUit.has(dagSleutel(s.aankomst)));
  }
  if (beperking?.vanaf && !aanbod.length) throw new Error(`geen plek vanaf ${beperking.vanaf} — niets verstuurd, mens nodig`);
  if (aanbod.length < aantal) throw new Error(`maar ${aanbod.length} tijd(en) beschikbaar — er zijn er ${aantal} nodig, niet verstuurd (handmatig of wachten op ruimte)`);
  aanbod = aanbod.slice(0, aantal);
  // "ver weg"? — eerlijk benoemen in het bericht (Daimy 06-08). Meetlat: enkele reis
  // vanaf het magazijn is meer dan de omrij-grens uit de instellingen.
  let ver = false;
  try {
    const { reistijd, MAGAZIJN } = require('./lib/reistijd');
    const inst3 = await require('./lib/instellingen.js').haalInstellingen();
    const r = await reistijd(MAGAZIJN, lead.volledigAdres, new Date());
    ver = r.minuten > inst3.maxOmrijdenMin;
  } catch { /* niet te bepalen: gewone tekst */ }
  const res = await fetch(AANBOD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
    body: JSON.stringify({
      lead: {
        rpItemId: item.id, naam: lead.naam, telefoon: lead.telefoon, email: lead.email,
        volledigAdres: lead.volledigAdres, plaats: lead.plaats, rpNummers: lead.rpNummers || [], rpDatums: lead.rpDatums || [],
        producten: lead.producten.map((p) => ({ naam: p.naam, aantal: p.aantal })),
      },
      duurMin,
      geldigUren: (await require('./lib/instellingen.js').haalInstellingen()).aanbodGeldigUren,
      slots: aanbod.map((sl) => ({ datum: sl.datum, aankomst: sl.aankomst.toISOString(), vertrek: sl.vertrek.toISOString(), inmeter: sl.inmeter })),
    }),
  });
  if (!res.ok) throw new Error(`aanbod aanmaken: HTTP ${res.status}`);
  const { url, token } = await res.json();
  // write-ahead (review 28-08): stijl/bron/ver van dit voorstel vastleggen vóór het versturen, zodat een
  // herbezorging na een crash dezelfde stem en tekst gebruikt
  try { const stW = laadState(); stW.voorstelIntent = { ...(stW.voorstelIntent || {}), [token]: { stijl: opties.stijl || null, bron: opties.bron || 'planner', ver, op: new Date().toISOString() } }; bewaarState(stW); } catch { /* best effort */ }
  const { verstuurAanbod } = require('./lib/aanbod-versturen');
  const verzonden = await verstuurAanbod({ lead: { naam: lead.naam, telefoon: lead.telefoon, email: lead.email, rpItemId: item.id }, duurMin, ver, slots: aanbod, geldigUren: (await require('./lib/instellingen.js').haalInstellingen()).aanbodGeldigUren, stijl: opties.stijl || null, bron: opties.bron || null, herhaling: !!opties.herhaling, klantReply: opties.klantReply || null, wens: beperking || null }, url);
  if (!verzonden.wa.ok && !verzonden.mail.ok) {
    // NIET BEZORGD = GEEN AANBOD. Het record stond al "open" in het register terwijl de
    // klant niets had gekregen (Fatih/Marius 20-08: spook-aanbiedingen die elke ochtend
    // opnieuw "verliepen" en een nieuwe ronde startten). Meteen sluiten, en het kantoor
    // krijgt een alarm mét de tijden zodat iemand het zelf kan sturen.
    try { await aanbodApi('/' + token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: `niet bezorgd: wa ${verzonden.wa.reden}; mail ${verzonden.mail.reden}` }) }); } catch { /* register onbereikbaar */ }
    // ALARM MAX 1x PER 24 UUR PER KLANT (Daimy 21-08: "ik heb echt 35 dezelfde
    // berichten"): elke planner-run probeerde het opnieuw en stuurde wéér hetzelfde
    // alarm. De poging zelf mag blijven (zodra de blokkade wegvalt gaat het aanbod
    // alsnog vanzelf), maar het alarm niet. Zonder keuzelink: die is hierboven net
    // op "verlopen" gezet en dus altijd dood (Daimy: "die link klopt niet").
    // MAX 1 MELDING PER KLANT OOIT + BUNDELING (Daimy 22-08: "1x is genoeg om me
    // dit te sturen" — hij kreeg 3 losse alarmen op één middag). Elke klant komt
    // maar één keer in het alarm (opschoning na 30 dagen), en meerdere klanten
    // binnen 6 uur gaan als één gebundeld bericht.
    const stAl = laadState();
    stAl.nietBezorgdAlarm = stAl.nietBezorgdAlarm || {};
    for (const [id, iso] of Object.entries(stAl.nietBezorgdAlarm)) if (Date.now() - Date.parse(iso) > 30 * 86400000) delete stAl.nietBezorgdAlarm[id];
    if (!stAl.nietBezorgdAlarm[item.id]) {
      stAl.nietBezorgdAlarm[item.id] = new Date().toISOString();
      const tijden = aanbod.map((sl) => `${sl.datum} ${sl.aankomst.toISOString().slice(11, 16)}Z ${sl.inmeter}`).join(', ');
      stAl.alarmWachtrij = stAl.alarmWachtrij || [];
      stAl.alarmWachtrij.push(`• ${lead.naam} (wa: ${verzonden.wa.reden.split(' (')[0]}; mail: ${verzonden.mail.reden.split(' (')[0]}) — tijden: ${tijden}`);
    }
    if (stAl.alarmWachtrij?.length && (!stAl.alarmDigestOp || Date.now() - Date.parse(stAl.alarmDigestOp) > 6 * 3600000)) {
      await telegram(`🚨 Aanbod niet verstuurd bij ${stAl.alarmWachtrij.length} klant(en) — stuur de tijden zelf in het gesprek of zet de klant op stil:\n${stAl.alarmWachtrij.join('\n')}\n(Per klant hoor je dit maar 1x; nieuwe gevallen worden gebundeld, max 1 bericht per 6 uur.)`);
      stAl.alarmDigestOp = new Date().toISOString();
      stAl.alarmWachtrij = [];
    }
    bewaarState(stAl);
    throw new Error(`niet bezorgd (wa: ${verzonden.wa.reden}, mail: ${verzonden.mail.reden})`);
  }
  // ticket-ids bewaren zodat de reply-monitor ELK antwoord kan uitlezen (Daimy 06-08:
  // "lees jij dan 100% uit wat ze antwoorden en rapporteer je dat?")
  try {
    const st2 = laadState();
    st2.aanbodTickets = { ...(st2.aanbodTickets || {}), [token]: {
      naam: lead.naam, telefoon: lead.telefoon || null,
      // e-mail erbij zodat de AI-guard ook mail-tickets herkent (audit 06-08)
      email: lead.email || null,
      waTicket: verzonden.wa.ticket || null, mailTicket: verzonden.mail.ticket || null,
      verstuurdOp: new Date().toISOString(),
      // 28-08: rpItemId + bron erbij (24u-regel per klant, Sunny als eigenaar van zijn eigen voorstel)
      rpItemId: item.id, bron: opties.bron || 'planner', stijl: opties.stijl || null,
      herhaling: !!opties.herhaling, opVerzoek: !!(opties.klantReply || beperking),
    } };
    bewaarState(st2);
  } catch (eReg) { await telegram(`⚠️ Verzendadministratie niet bijgewerkt voor ${lead.naam} (${String(eReg.message).slice(0, 60)}) — aanbod is WEL verstuurd; let op dubbel bij de volgende ronde.`); }
  if (opties.bron === 'sunny' && verzonden.wa.ok && verzonden.wa.ticket) {
    // Sunny is eigenaar van zijn eigen voorstel: gesprek claimen (reply-route blijft van
    // vragen/ander-moment af) en als actief gesprek registreren zodat de actief-sweep het
    // antwoord van de klant ziet, ook buiten de kandidaat-lijst.
    try { require('./lib/gesprek-claims.js').claim(verzonden.wa.ticket, 'sunny-voorstel'); } catch { /* vangnet */ }
    try { sunnyStart.registreerActiefTicket(verzonden.wa.ticket, lead.naam); } catch { /* vangnet */ }
  }
  // opties zichtbaar maken voor het kantoor (Outlook), zodat niemand erdoorheen plant
  try {
    const { maakOpties } = require('./lib/outlook-opties.js');
    const geldigUren = (await require('./lib/instellingen.js').haalInstellingen()).aanbodGeldigUren;
    const ids = await maakOpties({ slots: aanbod, naam: lead.naam, verlooptOp: Date.now() + geldigUren * 3600000 });
    const st = laadState();
    st.opties = { ...(st.opties || {}), [token]: ids };
    bewaarState(st);
  } catch (e) {
    await telegram(`⚠️ Outlook-opties zetten mislukt voor ${lead.naam}: ${e.message.slice(0, 100)} — aanbod is WEL verstuurd; kantoor ziet de opties alleen niet in de agenda.`);
  }
  return url;
}

// ── aanbod-verwerker ────────────────────────────────────────────────────────
// De klant heeft via de keuzepagina een slot gekozen; hier wordt het echt:
// Planado-opdracht bij de juiste inmeter, RP door naar "grip invullen",
// Gripp-offerte via het bestaande script, meetbon klaargezet. Daarna pas
// markeren we het aanbod als verwerkt — mislukt er iets, dan blijft het staan
// en wordt het de volgende run opnieuw geprobeerd.
const AANBOD_API = 'https://sonty-website.vercel.app/api/inmeet-aanbod';
const MEET_CODE = process.env.MEETBON_CODE || '2288';

async function aanbodApi(pad, opties = {}) {
  const r = await fetch(AANBOD_API + pad, {
    ...opties,
    headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE, ...(opties.headers || {}) },
  });
  if (!r.ok) throw new Error(`aanbod-api ${pad}: HTTP ${r.status}`);
  return r.json();
}

/** Mag de aanbod-reminder NU? Pure functie (lab-testbaar). rest = ms tot verloop,
 *  uurNu = uur in Amsterdam. Nooit 's nachts (Fatih 20-08, 03:49); kort vóór verloop
 *  overdag, of 's avonds als het aanbod de volgende ochtend vroeg verloopt. */
function reminderNu(rest, uurNu) {
  if (!(rest > 0)) return false;
  const overdag = uurNu >= 8 && uurNu < 21;
  if (!overdag) return false;
  const kortVoorVerloop = rest < 4 * 3600000;
  const avondVoorOchtendverloop = rest < 14 * 3600000 && uurNu >= 18;
  return kortVoorVerloop || avondVoorOchtendverloop;
}

/** Reminder-tekst in de taal van de klant. */
function reminderTekst(lead, slot, afzender = 'Nanny') {
  const { taalVan } = require('./lib/aanbod-versturen');
  const GROET = { nl: `Groetjes, ${afzender} van Sonty`, en: `Kind regards, ${afzender} from Sonty` };
  const taalR = taalVan(lead);
  const voornaamR = String(lead?.naam || 'daar').split(' ')[0];
  const wanneer = new Date(slot.aankomst).toLocaleString(taalR === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  return taalR === 'en'
    ? `Hi ${voornaamR}, a quick reminder: ${wanneer} is still held for you. One message and I'll lock it in! Doesn't suit after all? No problem, then I'll keep looking for you.\n\n${GROET.en}`
    : `Hoi ${voornaamR}, kleine reminder: ${wanneer} staat nog voor je klaar. Eén berichtje en ik zet hem vast! Past het toch niet, ook prima, dan kijk ik gewoon verder voor je.\n\n${GROET.nl}`;
}

async function verwerkAanbiedingen() {
  // VAKANTIES OOK HIER (Debby 13-08): dit pad draaide ZONDER laadVakanties. Toen haar
  // keuze afketste stuurde de botsings-route direct nieuwe tijden, en die rekende
  // Sjoerds vakantie niet mee — ze werd geboekt op ma 24 aug, Sjoerds eerste
  // vakantiedag. Kunnen de vakanties niet geladen worden, dan stopt deze run: boeken
  // zonder vakantie-kennis is bewezen gevaarlijk.
  await laadVakanties();
  const state = laadState();

  // mutatie/boek-verzoeken worden door de SNELLE daemon verwerkt (inmeet-verzoek-daemon.js)
  // 1. verlopen aanbiedingen opruimen + melden (de 24-uursklok)
  const { aanbiedingen: open } = await aanbodApi('?status=open');
  state.opvolging = state.opvolging || {}; // per rpItemId: hoe vaak al een aanbod gestuurd
  for (const a of open) {
    const rest = Date.parse(a.verlooptOp) - Date.now();

    // HERINNERING (Daimy 10-08: "wat doen we met mensen die niet reageren?").
    // Vier uur voor het verlopen één vriendelijk duwtje in hetzelfde gesprek. Eén
    // keer, nooit vaker: dit is een reminder, geen achtervolging.
    // NOOIT 'S NACHTS (Fatih 20-08: reminder om 03:49). Alleen tussen 08:00 en 21:00.
    // Verloopt het aanbod in de vroege ochtend (aanbod om 07:49 gestuurd → verloopt
    // 07:49), dan gaat de herinnering de avond ervoor (vanaf 18:00) in plaats van nooit.
    const uurNu = Number(new Date().toLocaleString('nl-NL', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }));
    if (reminderNu(rest, uurNu) && !state.opvolging[a.token + ':herinnerd']) {
      state.opvolging[a.token + ':herinnerd'] = new Date().toISOString();
      bewaarState(state);
      try {
        const tk = laadState().aanbodTickets?.[a.token]?.waTicket;
        if (tk) {
          // verzendpoort: mens in het gesprek → geen automatische reminder
          const poortH = await require('./lib/verzend-poort.js').magSturen({ telefoon: a.lead.telefoon, ticketId: tk, soort: 'herinnering' }).catch(() => ({ ok: true }));
          if (!poortH.ok) { console.log(`  reminder ${a.lead.naam} overgeslagen (${poortH.reden})`); }
          else {
            const TT4 = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
            const afzR = (laadState().aanbodTickets?.[a.token]?.bron === 'sunny') ? 'Sunny' : 'Nanny';
            const tekstR = reminderTekst(a.lead, a.slots[0], afzR);
            await fetch(`https://app.trengo.com/api/v2/tickets/${tk}/messages`, {
              method: 'POST', headers: { Authorization: 'Bearer ' + TT4, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: tekstR, type: 'OUTBOUND' }),
            });
          }
        }
      } catch { /* herinnering is extra, geen blokkade */ }
    }

    if (Date.now() > Date.parse(a.verlooptOp)) {
      await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: 'klant heeft binnen 24 uur niet gekozen' }) });
      const { verwijderOpties } = require('./lib/outlook-opties.js');
      await verwijderOpties(state.opties?.[a.token]).catch(() => {});
      delete state.opties?.[a.token];

      // NA HET VERLOPEN NIET STIL BLIJVEN. Ronde 1 zonder reactie: verse tijden
      // sturen (de vorige stonden misschien gewoon niet goed). Ook ronde 2 zonder
      // reactie: stoppen met sturen en het aan een mens geven om te bellen — dat is
      // geen automatiseerbaar gesprek meer.
      const rpId = a.lead.rpItemId;
      // AL GEBOEKT? Dan is opvolging klaar (19-08, Hans: zijn oude aanbod verliep
      // terwijl hij allang een afspraak had; de opvolging vroeg een nieuw aanbod aan
      // en dat verzoek bleef eindeloos hangen op "klant heeft al een afspraak").
      try {
        const bo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
        if (rpId && bo[rpId]?.status === 'geboekt') {
          console.log(`  opvolging overgeslagen: ${a.lead.naam} is al geboekt`);
          continue;
        }
      } catch { /* administratie onleesbaar: gewone route */ }
      const rondes = (state.opvolging[rpId] || 1);
      if (rpId && rondes < 2) {
        state.opvolging[rpId] = rondes + 1;
        bewaarState(state);
        const r = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
          // herhaling: zelfde tijden mogen, maar dan als "even een berichtje van de
          // planning", niet nog eens letterlijk "goed nieuws" (Mirjam 19/20-08)
          body: JSON.stringify({ type: 'stuur-aanbod', rpItemId: rpId, naam: a.lead.naam, bron: 'opvolging', herhaling: true }),
        }).catch(() => null);
        await telegram(`⏰ ${a.lead.naam} reageerde niet binnen 24 uur. ${r?.ok ? 'Herhaald voorstel wordt nu gestuurd (ronde 2).' : 'Nieuw aanbod aanvragen MISLUKT — handmatig oppakken.'}`);
      } else {
        await telegram(`📞 ${a.lead.naam} heeft nu 2x niet gereageerd op een voorstel. Geen derde voorstel; Sunny vraagt nog één keer persoonlijk na (dag 3) en na 5 dagen stilte komt hij op het belscherm.`);
      }
    }
  }
  bewaarState(state);

  // 2. gekozen aanbiedingen boeken
  const { aanbiedingen: gekozen } = await aanbodApi('?status=gekozen');
  console.log(`${gekozen.length} gekozen aanbod(en) te verwerken`);
  for (const a of gekozen) {
    const slot = a.slots[a.gekozenIndex];
    // Kapot record (bijv. status "gekozen" zonder index) mag nooit de hele wachtrij
    // platleggen — op 06-08 crashte de verwerker hierop en bleef alles liggen.
    if (!slot) {
      state.conflictGemeld = state.conflictGemeld || {};
      const sleutel = `kapotte-keuze:${a.token}`;
      if (!state.conflictGemeld[sleutel]) {
        state.conflictGemeld[sleutel] = new Date().toISOString();
        bewaarState(state);
        await telegram(`🚨 Aanbod van ${a.lead.naam} staat op "gekozen" maar zonder geldig gekozen slot (index ${a.gekozenIndex}). Niet geboekt; dit record moet hersteld worden.`);
      }
      console.log(`  ✗ ${a.lead.naam}: gekozen zonder geldige slot-index — overgeslagen`);
      continue;
    }
    const lead = {
      id: a.lead.rpItemId,
      naam: a.lead.naam,
      rpNummers: a.lead.rpNummers || [],
      rpDatums: a.lead.rpDatums || [],
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
    // HET LAATSTE WOORD VAN DE KLANT TELT (Daimy 10-08, Connie Biermann).
    // Zij schreef "Dat past", en vijf minuten later "in Breda kan het inmeten alleen op
    // dinsdag, donderdag of vrijdag". Zeven seconden ná dat bericht ging onze bevestiging
    // eruit: de verwerker had alleen de keuze gelezen en niets wat daarna nog binnenkwam.
    // Ze kreeg een woensdag bevestigd die ze net had afgezegd, op een adres dat ze net
    // had gecorrigeerd.
    //
    // Daarom nu vlak vóór het boeken: wat is het LAATSTE dat de klant heeft geschreven?
    // Is dat geen kale instemming, dan boeken we niet. Een afspraak vastzetten die de
    // klant zojuist heeft ingetrokken is erger dan een ronde later boeken.
    try {
      const tkC = laadState().aanbodTickets?.[a.token]?.waTicket;
      if (tkC) {
        const TTC = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
        const rC = await fetch(`https://app.trengo.com/api/v2/tickets/${tkC}/messages?per_page=15`, { headers: { Authorization: 'Bearer ' + TTC } });
        // Trengo druk (429) of stuk: dan weten we het niet en boeken we gewoon door.
        // Niet boeken op basis van onwetendheid zou elke klant laten wachten zodra
        // Trengo hikt.
        if (rC.ok) {
          const dC = await rC.json();
          const inbound = (dC.data || [])
            .filter((m) => (m.message_type || m.type) === 'INBOUND')
            .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
          // Alleen berichten van NA dit aanbod tellen (Hensing 26-08: keuzelink-keuze
          // is geen appje, dus het oude "Ander moment" over het vórige voorstel stond
          // nog als laatste bericht en werd als afwijzing van de nieuwe keuze gelezen).
          const { laatsteWoordNa } = require('./lib/boek-poort.js');
          const verstuurdOpA = laadState().aanbodTickets?.[a.token]?.verstuurdOp;
          const laatsteKlant = laatsteWoordNa(inbound, verstuurdOpA);
          const tekstK = String(laatsteKlant?.message || laatsteKlant?.body || '').replace(/<[^>]+>/g, ' ').trim();
          // Fase 3 (26-08): Sunny heeft dit gesprek geclaimd (hij overlegt zelf en
          // boekt straks; de oude keuze wordt dan automatisch ingetrokken). Deze ronde
          // niets doen; verloopt de claim, dan loopt de normale route gewoon weer.
          if (require('./lib/gesprek-claims.js').geclaimd(tkC, 30)) {
            console.log(`  ⏸ ${a.lead.naam}: gesprek geclaimd door Sunny — verwerker blijft eraf`);
            continue;
          }
          if (tekstK) {
            const { leesReactie } = require('./lib/planning-antwoord.js');
            const duiding = await leesReactie(tekstK, a.slots);
            // De regel zelf staat in lib/boek-poort.js, zodat het scenario-lab exact
            // dezelfde beslissing test als die hier valt (onderdeel herplan-na-keuze).
            const { naKeuzeBesluit } = require('./lib/boek-poort.js');
            const vandaagStr = new Date().toISOString().slice(0, 10);
            const teller = (state.herplanTeller || {})[a.lead.rpItemId];
            const herplansVandaag = teller?.datum === vandaagStr ? teller.n : 0;
            const besluit = naKeuzeBesluit(duiding, tekstK, a.lead.volledigAdres, { herplansVandaag });

            if (besluit.actie === 'herplan') {
              // HERPLAN-LUS (Daimy 26-08: "waarom handelt de bot dit niet zelf af tot er
              // wél een datum wordt gekozen?"). De klant vertelt wanneer het wel kan —
              // dan sturen we zelf nieuwe tijden met die beperking, via de bestaande
              // stuur-aanbod-route (die filtert op voorkeur en weigert afgewezen tijden).
              console.log(`  🔁 ${a.lead.naam}: ander moment — automatisch herplannen (${duiding.samenvatting})`);
              await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: 'klant wil een ander moment — automatisch nieuw voorstel' }) });
              const { verwijderOpties } = require('./lib/outlook-opties.js');
              await verwijderOpties(state.opties?.[a.token]).catch(() => {});
              delete state.opties?.[a.token];
              delete state.aangeboden?.[a.lead.rpItemId];
              state.herplanTeller = state.herplanTeller || {};
              state.herplanTeller[a.lead.rpItemId] = { datum: vandaagStr, n: herplansVandaag + 1 };
              bewaarState(state);
              const { taalVan } = require('./lib/aanbod-versturen');
              const engelsH = taalVan(a.lead) === 'en';
              await fetch(`https://app.trengo.com/api/v2/tickets/${tkC}/messages`, {
                method: 'POST', headers: { Authorization: 'Bearer ' + TTC, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: engelsH
                  ? `Hi ${String(a.lead.naam).split(' ')[0]}, thanks for letting me know! I won't lock in that time — I'm looking for a moment that does work for you and will send you a few new options shortly.\n\nBest, Nanny from Sonty`
                  : `Hoi ${String(a.lead.naam).split(' ')[0]}, dank je wel voor het laten weten! Dat moment zet ik niet vast — ik zoek een tijd die wél past en stuur je zo een paar nieuwe opties.\n\nGroetjes, Nanny van Sonty`, type: 'OUTBOUND' }),
              }).catch(() => {});
              const rH = await fetch('https://sonty-website.vercel.app/api/inmeet-mutatie', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
                body: JSON.stringify({
                  type: 'stuur-aanbod', rpItemId: a.lead.rpItemId, naam: a.lead.naam, bron: 'klant-reply',
                  voorkeurDagen: besluit.voorkeur.dagen, voorkeurDagdeel: besluit.voorkeur.dagdeel,
                  vanaf: besluit.voorkeur.vanaf || undefined,
                  nietDeze: (a.slots || []).map((sl) => sl.aankomst),
                }),
              }).catch(() => null);
              await telegram(`🔁 ${a.lead.naam} koos een tijd maar wil toch anders: ${duiding.samenvatting} Nieuw aanbod met zijn voorkeur ${rH?.ok ? 'staat in de rij' : 'AANVRAGEN MISLUKT — handmatig via het dashboard'}.`);
              continue;
            }

            if (besluit.actie === 'mens') {
              console.log(`  ✋ ${a.lead.naam}: ${besluit.reden} — NIET boeken (${duiding.samenvatting})`);
              await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: 'klant kwam na zijn keuze terug op het bericht, mens kijkt mee' }) });
              const { verwijderOpties } = require('./lib/outlook-opties.js');
              await verwijderOpties(state.opties?.[a.token]).catch(() => {});
              delete state.opties?.[a.token];
              delete state.aangeboden?.[a.lead.rpItemId];
              bewaarState(state);
              await fetch(`https://app.trengo.com/api/v2/tickets/${tkC}/messages`, {
                method: 'POST', headers: { Authorization: 'Bearer ' + TTC, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Hoi ${String(a.lead.naam).split(' ')[0]}, dank je wel, ik heb je bericht gezien. Ik zoek dit even goed uit en kom er vandaag nog bij je op terug.\n\nGroetjes, Nanny van Sonty`, type: 'OUTBOUND' }),
              }).catch(() => {});
              await telegram(`✋ ${a.lead.naam} NIET geboekt: na zijn keuze kwam er nog een bericht — "${tekstK.slice(0, 110)}" (${besluit.reden}: ${duiding.samenvatting}). Aanbod ingetrokken, klant heeft bericht gehad. Actie nodig.`);
              continue;
            }
          }
        }
      }
    } catch (e) { console.log('  laatste-woord-check overgeslagen: ' + e.message.slice(0, 60)); }

    // HERCONTROLE dubbelboeking (Daimy 06-08 "hoe weet je zeker dat alles goed gaat"):
    // tussen aanbod en keuze kan het gat vergeven zijn. Verse agenda checken; overlap
    // = NIET boeken maar melden. Planado zelf weigert overlappende opdrachten niet.
    try {
      const van = Date.parse(slot.aankomst);
      const tot = van + a.duurMin * 60000;
      const agendaNu = await haalAgenda();
      const botst = (agendaNu[slot.inmeter] || []).some((afspraak) => {
        if (String(afspraak.klant || '').includes(a.lead.naam)) return false; // eigen aanbod-anker
        return Date.parse(afspraak.start) < tot && Date.parse(afspraak.eind) > van;
      });
      if (botst) {
        // het kantoor (spoedje/winkelklant) wint altijd van een optie: NIET boeken,
        // aanbod afsluiten, en de lead komt vanzelf terug in de eerstvolgende
        // planner-run voor een VERS aanbod (wachttijd telt gewoon door).
        // Status 'verlopen', NIET 'verwerkt': verwerkt betekent "geboekt", en dat was
        // het niet. Op het dashboard stond daardoor groen "klant koos optie 1" bij
        // Natalie Bavinck terwijl er niets geboekt was (Daimy 10-08).
        await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: 'gekozen tijd was net vergeven, nieuw voorstel volgt' }) });
        const { verwijderOpties } = require('./lib/outlook-opties.js');
        await verwijderOpties(state.opties?.[a.token]).catch(() => {});
        delete state.opties?.[a.token];
        delete state.aangeboden?.[a.lead.rpItemId];
        // klant eerlijk laten weten dat zijn keuze net vergeven is — anders blijft
        // hij denken dat het geregeld is (Hendrik-Jan 07-08 hoorde niets)
        try {
          const stB = laadState();
          const tk = stB.aanbodTickets?.[a.token]?.waTicket;
          if (tk) {
            const TT3 = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
            await fetch(`https://app.trengo.com/api/v2/tickets/${tk}/messages`, {
              method: 'POST', headers: { Authorization: 'Bearer ' + TT3, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: `Balen, die tijd is je nét voor de neus weggekaapt door een andere afspraak, sorry! Ik stuur je meteen een nieuw voorstel, dus je hoeft zelf niks te doen. Groetjes, Nanny van Sonty`, type: 'OUTBOUND' }),
            });
          }
        } catch { /* melding hieronder dekt het */ }
        // BELOFTE NAKOMEN (Daimy 09-08, geval Natalie Bavinck): we zeggen tegen de
        // klant "we sturen je zo een paar nieuwe tijden", maar dat gebeurde alleen als
        // iemand daarna handmatig op het dashboard klikte. Natalie wachtte daardoor
        // een etmaal op tijden die nooit kwamen. Nu sturen we ze meteen zelf.
        let nieuwGestuurd = false;
        try {
          const verseAgenda = await haalAgenda();
          await voegAanbiedingenToe(verseAgenda);
          let opnieuw = [];
          for (const inm of INMETERS) {
            const sl = await zoekSlots({
              agenda: verseAgenda[inm.naam], adres: a.lead.volledigAdres, duurMin: a.duurMin,
              werkdagen: werkdagenVoor(inm.naam),
              startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
              eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
            }).catch(() => []);
            opnieuw.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
          }
          opnieuw.sort((x, y) => x.extraRijtijdMin - y.extraRijtijdMin || x.aankomst - y.aankomst);
          const keuze = kiesAanbod(opnieuw, 3, { wachtDagen: 999 });
          if (keuze.length) {
            const rpItem = { id: a.lead.rpItemId, summary: a.lead.naam, item_subject: null };
            await maakEnVerstuurAanbod({ ...a.lead }, rpItem, keuze, a.duurMin, verseAgenda);
            nieuwGestuurd = true;
          }
        } catch (e) { console.log(`  nieuw aanbod na botsing mislukt: ${e.message}`); }
        await telegram(`↩️ ${a.lead.naam} koos ${slot.datum} bij ${slot.inmeter}, maar dat gat was net bezet. `
          + (nieuwGestuurd
            ? 'De klant heeft excuus én meteen nieuwe tijden gekregen.'
            : 'De klant heeft excuus gehad, maar NIEUWE TIJDEN LUKTEN NIET — die moeten van het dashboard komen.'));
        console.log(`  ↩ ${a.lead.naam}: gekozen slot bezet — ${nieuwGestuurd ? 'nieuw aanbod verstuurd' : 'kaart terug naar dashboard'}`);
        continue;
      }
      const uitkomst = await verwerkLead(lead, null, gekozenSlot, a.duurMin);
      // gekozen optie wordt de echte Outlook-afspraak; de andere opties verdwijnen
      let outlookEventId = null, agendaRes = null, agendaVia = null;
      try {
        const { maakDefinitief, verwijderOpties } = require('./lib/outlook-opties.js');
        await verwijderOpties(state.opties?.[a.token]);
        delete state.opties?.[a.token];
        // Via Bookings (13-08): medewerker-koppeling + automatische bevestigingsmail.
        const { boekInmeetAfspraak } = require('./lib/inmeet-boeken.js');
        agendaRes = await boekInmeetAfspraak({ slot: gekozenSlot, naam: a.lead.naam, telefoon: a.lead.telefoon, adres: a.lead.volledigAdres, duurMin: a.duurMin, email: a.lead.email }); outlookEventId = agendaRes.id; agendaVia = agendaRes.via;
      } catch (e) {
        await telegram(`⚠️ Outlook-afspraak na boeking mislukt voor ${a.lead.naam}: ${e.message.slice(0, 100)} — Planado is WEL geboekt; agenda handmatig aanvullen.`);
      }
      // ALLE rollback-sleutels vastleggen — zonder dit kan niemand netjes annuleren/verzetten
      try {
        const { registreerBoeking } = require('./lib/inmeet-mutatie.js');
        registreerBoeking({
          rpItemId: a.lead.rpItemId, naam: a.lead.naam, telefoon: a.lead.telefoon, email: a.lead.email,
          planadoJobUuid: uitkomst.planadoJobUuid, outlookEventId, agendaVia, grippNr: uitkomst.grippNr,
          sheet: uitkomst.sheetLocatie, slot: { aankomst: slot.aankomst, inmeter: slot.inmeter },
          duurMin: a.duurMin, aanbodToken: a.token,
        });
      } catch (e) {
        await telegram(`⚠️ Boekingsrecord niet opgeslagen voor ${a.lead.naam}: ${e.message.slice(0, 100)} — annuleren/verzetten wordt dan handwerk.`);
      }
      await verwijderRekenKaart(a.lead.rpItemId);
      await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verwerkt' }) });
      // BEVESTIGING PAS NÁ DE BOEKING (Daimy 08-08: "pas een bericht als het echt
      // ingeboekt is"). Op 07-08 kreeg Hendrik-Jan bij zijn keuze direct een
      // bevestiging terwijl de boeking daarna op een botsing afketste. De WhatsApp
      // gaat naar het ticket dat de reply-monitor al volgt; falen = melding mét tekst.
      try {
        // STIL-POORT (Charles 14-08): stond de klant op de stil-lijst, dan ging er
        // TOCH een bevestiging uit omdat alleen de reply-monitor de lijst kende.
        // Nu checkt elk klant-verzendpad hem.
        if (require('./lib/klant-stil.js').klantStil(a.lead.telefoon)) { console.log('  stil-lijst: geen bevestiging naar ' + a.lead.naam); throw { stil: true }; }
        const stT = laadState();
        const ticketInfo = stT.aanbodTickets?.[a.token];
        const { bevestigingsTekst } = require('./cron-aanbod-replies.js');
        const { taalVan } = require('./lib/aanbod-versturen');
        const tekst = bevestigingsTekst({ aankomst: slot.aankomst, inmeter: slot.inmeter }, taalVan({ telefoon: a.lead.telefoon, email: a.lead.email, rpItemId: a.lead.rpItemId }));
        let bevestigd = false;
        if (ticketInfo?.waTicket) {
          const TT2 = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
          for (let i = 0; i < 4 && !bevestigd; i++) {
            const rB = await fetch(`https://app.trengo.com/api/v2/tickets/${ticketInfo.waTicket}/messages`, {
              method: 'POST', headers: { Authorization: 'Bearer ' + TT2, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: tekst, type: 'OUTBOUND' }),
            });
            if (rB.ok) bevestigd = true;
            else if (rB.status === 429) await wacht(20000 + i * 15000);
            else break;
          }
        }
        try { require('./lib/inmeet-mutatie.js').noteerBevestiging(a.lead.rpItemId, { wa: { ok: bevestigd }, mail: { ok: false } }); } catch { /* register is extra */ }
        if (!bevestigd) await telegram(`⚠️ ${a.lead.naam} is geboekt maar de bevestiging kon niet via WhatsApp — even handmatig sturen: ${tekst}`);
        else await telegram(`📤 Bevestiging naar ${a.lead.naam} (ná geslaagde boeking): ${tekst}`);
      } catch (e) {
        if (!e?.stil) await telegram(`⚠️ Bevestiging na boeking mislukt voor ${a.lead.naam}: ${(e.message || '').slice(0, 80)}`);
      }
      console.log(`  ✓ ${a.lead.naam}: ${uitkomst.samenvatting}`);
      if (magBoekingMelden(`${a.lead.naam}|${new Date(slot.aankomst).toISOString()}`)) {
        await telegram(boekingsMelding({
          naam: a.lead.naam, aankomst: slot.aankomst, inmeter: slot.inmeter,
          plaats: a.lead.plaats, adres: a.lead.volledigAdres, duurMin: a.duurMin,
          samenvatting: uitkomst.samenvatting, via: 'klant koos zelf een tijd', automatisch: true,
        }), { boeking: true });
      }
    } catch (e) {
      console.log(`  ✗ ${a.lead.naam}: ${e.message}`);
      await telegram(`⚠️ Boeken na klantkeuze MISLUKT voor ${a.lead.naam}: ${e.message.slice(0, 160)}\nAanbod blijft op "gekozen" staan; volgende run opnieuw.`);
    }
  }
  bewaarState(state);
}

/** Openstaande en gekozen aanbiedingen als bezette blokken aan de agenda toevoegen.
 * Cruciaal voor ELKE route die tijden uitrekent of boekt: zonder dit kunnen twee
 * klanten dezelfde tijd aangeboden krijgen (Daimy 06-08: "als ik nu iedereen
 * tegelijk dat bericht stuur, kloppen die tijden dan nog?"). */
/** O15 (Daimy 28-08): crash tussen aanmaken en versturen = record open, klant kreeg niets
 *  ("spook-aanbod"). Zo'n record wordt hier ÉÉN keer alsnog bezorgd (zelfde token, zelfde
 *  tijden); lukt dat niet, dan gaat het dicht met een melding. Nooit 0x, nooit 2x. */
async function herbezorgSpookAanbiedingen(state) {
  try {
    const r = await fetch(`${AANBOD_API}?status=open`, { headers: { 'x-meet-code': MEET_CODE } });
    if (!r.ok) return;
    const { aanbiedingen } = await r.json();
    for (const a of aanbiedingen || []) {
      const leeftijd = Date.now() - Date.parse(a.aangemaakt || 0);
      const vers = laadState(); // verse stand: een parallel proces kan net geregistreerd hebben
      if (vers.aanbodTickets?.[a.token] || !(leeftijd > 3 * 60000) || leeftijd > 24 * 3600000) continue;
      const intent = vers.voorstelIntent?.[a.token] || {};
      if (state.spookGeprobeerd?.[a.token]) continue;
      state.spookGeprobeerd = { ...(state.spookGeprobeerd || {}), [a.token]: new Date().toISOString() };
      bewaarState(state);
      const { verstuurAanbod } = require('./lib/aanbod-versturen');
      const uit = await verstuurAanbod({ ...a, stijl: intent.stijl || null, bron: intent.bron || null, ver: intent.ver === true }, `https://sonty-website.vercel.app/inmeten/${a.token}`);
      console.log(`  spook-aanbod ${String(a.token).slice(0, 8)} (${a.lead?.naam}) alsnog bezorgd: wa ${uit.wa.ok ? 'ok' : uit.wa.reden}, mail ${uit.mail.ok ? 'ok' : uit.mail.reden}`);
      if (uit.ergensGelukt) {
        const st2 = laadState();
        st2.aanbodTickets = { ...(st2.aanbodTickets || {}), [a.token]: {
          rpItemId: a.lead?.rpItemId, naam: a.lead?.naam, telefoon: a.lead?.telefoon || null, email: a.lead?.email || null,
          waTicket: uit.wa.ticket || null, mailTicket: uit.mail.ticket || null, verstuurdOp: new Date().toISOString(),
          bron: intent.bron || 'planner', stijl: intent.stijl || null, herbezorgd: true,
        } };
        bewaarState(st2);
      } else {
        await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: 'spook-aanbod niet bezorgd: ' + uit.wa.reden }) }).catch(() => {});
        await telegram(`⚠️ Aanbod voor ${a.lead?.naam} was aangemaakt maar nooit bezorgd (crash?); alsnog bezorgen lukte ook niet (wa: ${uit.wa.reden}; mail: ${uit.mail.reden}) — record gesloten, volgende ronde nieuw voorstel.`);
      }
    }
  } catch (e) { console.log('  spook-controle overgeslagen: ' + String(e.message).slice(0, 60)); }
}

async function voegAanbiedingenToe(agenda) {
  const lopendeLeads = new Set();
  for (const status of ['open', 'gekozen']) {
    const rAanbod = await fetch(`${AANBOD_API}?status=${status}`, { headers: { 'x-meet-code': MEET_CODE } });
    if (!rAanbod.ok) throw new Error(`aanbod-register HTTP ${rAanbod.status} — een 401 was eerder een STILLE nul`);
    const { aanbiedingen } = await rAanbod.json();
    for (const a of aanbiedingen || []) {
      lopendeLeads.add(a.lead.rpItemId);
      const slots = status === 'gekozen' ? [a.slots[a.gekozenIndex]] : a.slots;
      for (const sl of slots) {
        (agenda[sl.inmeter] || []).push({
          start: sl.aankomst, eind: sl.vertrek,
          adres: a.lead.volledigAdres, klant: `aanbod ${a.lead.naam}`,
        });
      }
    }
  }
  return lopendeLeads;
}

/** Reken-kaart van het dashboard halen zodra een lead geboekt is (bleef anders 45 min hangen). */
async function verwijderRekenKaart(rpItemId) {
  await fetch('https://sonty-website.vercel.app/api/inmeet-dashboard', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
    body: JSON.stringify({ rpItemId }),
  }).catch(() => {});
}

/** DE KLANT MAG NOOIT STIL BLIJVEN STAAN ALS DE MOTOR NIETS VINDT (Fatih 19-08 vroeg
 *  "faster?", Marius "dinsdag?": de motor kon niets (of niets bezorgen) en de klant hoorde
 *  niets meer). Reageerde de klant zelf (bron klant-reply) en kan de motor geen
 *  alternatief bieden, dan krijgt hij een eerlijk bericht: wat wél kan en dat het oude
 *  voorstel blijft staan. Storingen (429, register onbereikbaar) krijgen dit niet: die
 *  worden opnieuw geprobeerd. */
async function meldGeenAlternatiefBijFout(lead, m, e) {
  try {
    const msg = String(e?.message || '');
    const definitief = /geen enkel gat|geen 3 tijden|geen plek vanaf|NIET eerder dan|geen enkele plek|maar \d+ tijd\(en\) beschikbaar|ligt vóór de datum/i.test(msg);
    if (!definitief || m.bron !== 'klant-reply') return;
    const { geenAlternatiefTekst, taalVan, zoekWaTicket } = require('./lib/aanbod-versturen');
    const taal = taalVan({ telefoon: lead.telefoon, email: lead.email, rpItemId: m.rpItemId });
    const slots = (m.nietDeze || []).length ? [] : []; // het afgewezen voorstel noemen we niet opnieuw als "nog beschikbaar"
    const tekst = geenAlternatiefTekst(String(lead.naam || 'daar').split(' ')[0], { slots, wilEerder: !!m.wilEerder, dagen: m.voorkeurDagen || [], taal });
    const ticket = lead.telefoon ? await zoekWaTicket(lead.telefoon).catch(() => null) : null;
    if (!ticket) return;
    const poort = await require('./lib/verzend-poort.js').magSturen({ telefoon: lead.telefoon, ticketId: ticket.id, soort: 'ontvangst' }).catch(() => ({ ok: true }));
    if (!poort.ok) return;
    const TTg = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
    await fetch(`https://app.trengo.com/api/v2/tickets/${ticket.id}/messages`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + TTg, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: tekst, type: 'OUTBOUND' }),
    });
    await telegram(`🚨 ${lead.naam}: geen alternatief te vinden (${msg.slice(0, 100)}). Klant heeft een eerlijk bericht gekregen; mens nodig om handmatig een moment te zoeken.`);
  } catch { /* melding is extra */ }
}

/** Dashboard-verzoek: 'boek' = direct boeken op het gekozen slot (klant zit bv. aan
 * de telefoon in de winkel); 'stuur-aanbod' = verse tijden berekenen en de keuzelink
 * naar de klant sturen. Zelfde veiligheid als de klantkeuze-route: verse agenda,
 * botsingscontrole, alles geregistreerd. */
async function verwerkDashboardVerzoek(m) {
  // NOOIT DUBBEL BOEKEN (Daimy 26-08: Kranenburg kreeg twee opdrachten en twee
  // meldingen doordat twee herstel-verzoeken allebei doorliepen). Staat er al een
  // geboekte afspraak voor deze lead, dan kaatst een tweede boek-verzoek hier af —
  // "heeft al een afspraak" is een definitieve uitkomst voor de wachtrij.
  if (m.type === 'boek') {
    const al = require('./lib/inmeet-mutatie.js').heeftGeboekteAfspraak(m.rpItemId);
    // een HALVE boeking op precies dit slot mag door: verwerkLead hergebruikt dan de bestaande Planado-opdracht
    const zelfdeHalve = al?.halveBoeking && al.inmeter === m.slot?.inmeter && Math.abs(Date.parse(al.aankomst) - Date.parse(m.slot?.aankomst)) < 60000;
    if (al && !zelfdeHalve) {
      const wanneer = new Date(al.aankomst).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
      throw new Error(`deze klant heeft al een afspraak (${wanneer} bij ${al.inmeter}) — niets dubbel geboekt`);
    }
  }
  const item = require('./lib/eigen-crm.js').isEigen(m.rpItemId) ? await require('./lib/eigen-crm.js').haalItem(m.rpItemId) : await rpGet(`/contact-service/${PID}/backlogs/${BACKLOG_ID}/items/${m.rpItemId}`).then((d) => d.item || d);
  if (!item?.id) throw new Error('RP-lead niet gevonden');
  const lead = await leesLeadCompleet(item);
  if (lead.ambigu) throw new Error(`${lead.aantalDocs} offerteversies, geen getekend — klant moet eerst tekenen`);
  const duur = schatDuur(lead.producten);
  const agenda = await haalAgenda();
  // Vakantievenster meerekken tot voorbij de datum die de klant noemt, anders kan
  // een voorstel in een niet-geladen vakantieweek vallen.
  const extraDagen = m.vanaf ? Math.max(0, Math.ceil((Date.parse(m.vanaf) - Date.now()) / 86400000)) : 0;
  await laadVakanties(70 + extraDagen);
  const lopende = await voegAanbiedingenToe(agenda); // andermans aangeboden tijden zijn bezet
  if (m.type === 'stuur-aanbod' && lopende.has(item.id)) throw new Error('deze klant heeft al een lopend aanbod — geen tweede sturen');

  if (m.type === 'stuur-aanbod') {
   try {
    let aanbod = [];
    // Dashboard kan de al berekende tijden meegeven (combi-dag!): dan sturen we
    // precies die, na verse botsingscontrole — opnieuw rekenen zou de combi-dag
    // weggooien en de klant alsnog een losse dure route geven.
    if (Array.isArray(m.slots) && m.slots.length) {
      for (const s of m.slots) {
        const van = Date.parse(s.aankomst);
        const tot = van + duur * 60000;
        const botst = (agenda[s.inmeter] || []).some((a) =>
          !String(a.klant || '').includes(lead.naam) && Date.parse(a.start) < tot && Date.parse(a.eind) > van);
        if (botst) continue; // deze tijd is inmiddels bezet: stilletjes overslaan, rest blijft
        const aankomst = new Date(van);
        aanbod.push({
          inmeter: s.inmeter, datum: aankomst.toISOString().slice(0, 10), aankomst,
          vertrek: new Date(tot), extraRijtijdMin: 0, kostenBetrouwbaar: true, naVorige: 'dashboard',
        });
      }
      if (!aanbod.length) throw new Error('alle voorgestelde tijden zijn inmiddels bezet — ververs het dashboard');
    } else {
      let beste = [];
      for (const inm of inmetersVoor(lead)) {
        const sl = await zoekSlots({
          agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur,
          werkdagen: werkdagenVoor(inm.naam, m.wilEerder ? 30 : undefined, m.vanaf),
          startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
          eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
        }).catch(() => []);
        beste.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
      }
      beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
      // VOORKEUR VAN DE KLANT (Daimy 10-08, geval Rick: "woensdag en donderdag zijn
      // wel opties"). Noemt hij zelf dagen of een dagdeel, dan zoeken we dáár; levert
      // dat niets op, dan vallen we terug op de beste tijden — een klant zonder
      // opties laten zitten is erger dan een andere dag voorstellen.
      // NOOIT een tijd terugsturen die de klant net heeft afgewezen (Taico 10-08: hij
      // drukte "Ander moment" en kreeg binnen een minuut exact hetzelfde voorstel).
      if (m.nietDeze?.length) {
        const afgewezen = new Set(m.nietDeze.map((x) => +new Date(x)));
        beste = beste.filter((s) => !afgewezen.has(+new Date(s.aankomst)));
      }
      if (m.nietDagen?.length) {
        const dagenUit = new Set(m.nietDagen);
        beste = beste.filter((s) => !dagenUit.has(dagSleutel(s.aankomst)));
      }
      if (m.voorkeurDagen?.length || m.voorkeurDagdeel || m.vanaf) {
        const { pasBijVoorkeur } = require('./lib/planning-antwoord.js');
        // HORIZON UITBREIDEN VOOR EEN DAGVOORKEUR (Daimy 29-08, Christian Keus: "maandag" → geen maandag in de
        // standaardhorizon → stil teruggevallen op di/do). Eerst strikt kijken; niets? Dan tot ~3 maanden vooruit.
        const strikt = (lijst) => lijst
          .filter((x) => !(m.voorkeurDagen?.length) || m.voorkeurDagen.includes(new Date(x.aankomst).getDay()))
          .filter((x) => !m.voorkeurDagdeel || (new Date(x.aankomst).getHours() < 12 ? 'ochtend' : 'middag') === m.voorkeurDagdeel)
          .filter((x) => !m.vanaf || +x.aankomst >= +new Date(m.vanaf + 'T00:00:00+02:00'));
        if (!strikt(beste).length) {
          console.log('  (geen plek op de voorkeur in de standaardhorizon — verder vooruit kijken)');
          for (const inm of inmetersVoor(lead)) {
            const sl = await zoekSlots({
              agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur,
              werkdagen: werkdagenVoor(inm.naam, 60, m.vanaf),
              startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
              eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
            }).catch(() => []);
            beste.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
          }
          const gezienS = new Set();
          beste = beste.filter((x) => { const k = `${x.inmeter}|${+x.aankomst}`; if (gezienS.has(k)) return false; gezienS.add(k); return true; });
          beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
        }
        const passend = pasBijVoorkeur(beste, { dagen: m.voorkeurDagen || [], dagdeel: m.voorkeurDagdeel || null, vanaf: m.vanaf || null });
        if (passend.length) beste = passend;
        else if (m.vanaf) throw new Error(`geen enkele plek vanaf ${m.vanaf} — niets verstuurd, mens nodig`);
        else console.log('  (geen plek op de dagen die de klant noemde — beste tijden gebruikt)');
      }
      // wilEerder (geval Rene 07-08): omrij-grens telt niet, puur vroegste eerst
      aanbod = kiesAanbod(beste, 3, { wachtDagen: 999, negeerGrens: !!m.wilEerder });
      if (!aanbod.length) throw new Error('geen enkel gat beschikbaar');
    }
    // POORT vanaf-datum (Taico 10-08): wat de klant heeft uitgesloten mag er nooit
    // doorheen glippen, ook niet via een ander codepad dan het filter hierboven.
    if (m.vanaf && aanbod.length && +aanbod[0].aankomst < +new Date(m.vanaf + 'T00:00:00+02:00')) {
      throw new Error(`voorstel ${aanbod[0].datum} ligt vóór de datum die de klant zelf noemde (${m.vanaf}) — niets verstuurd`);
    }
    // POORT (geval Rene 07-08: klant vroeg eerder en kreeg dezelfde dag terug):
    // een eerder-verzoek gaat alleen de deur uit als het ook ECHT eerder is.
    if (m.wilEerder && m.eerderDan) {
      const grens = Date.parse(m.eerderDan);
      if (!(+aanbod[0].aankomst < grens - 3600000)) {
        throw new Error(`vroegst haalbare is ${aanbod[0].datum} — NIET eerder dan wat de klant al had (${m.eerderDan.slice(0, 10)}); niets verstuurd, mens nodig`);
      }
    }
    const wensM = (m.voorkeurDagen?.length || m.voorkeurDagdeel || m.vanaf || m.nietDeze?.length || m.nietDagen?.length) ? { dagen: m.voorkeurDagen || [], dagdeel: m.voorkeurDagdeel || null, vanaf: m.vanaf || null, nietDeze: m.nietDeze || [], nietDagen: m.nietDagen || [] } : null;
    const url = await maakEnVerstuurAanbod(lead, item, aanbod, duur, agenda, wensM, { bron: m.bron || null, stijl: m.stijl || (m.bron === 'sunny' ? 'sunny' : null), herhaling: !!m.herhaling, klantReply: m.bron === 'klant-reply' ? { dagen: m.voorkeurDagen || [] } : null });
    // Werkelijk verstuurde aantal rapporteren: bij aantalTijden=1 krijgt de klant één
    // moment, ook al lagen er hier 3 kandidaten (het oude "(3 tijd(en))" zette ons
    // 26-08 op het verkeerde been bij het uitzoeken van de Hensing-zaak).
    const aantalIns = (await require('./lib/instellingen.js').haalInstellingen()).aantalTijden === 1 ? 1 : Math.min(3, aanbod.length);
    return `keuzelink verstuurd (${aantalIns} moment(en)): ${url}`;
   } catch (e) { await meldGeenAlternatiefBijFout(lead, m, e); throw e; }
  }

  // DIRECTE BOEKING VERVANGT EEN LOPEND AANBOD (Sunny-fase 26-08): boekt de winkel of
  // Sunny terwijl er nog een keuzelink open/gekozen staat, dan moet die keuzelink dicht —
  // anders kan de oude keuze later alsnog geboekt worden en staat de klant dubbel.
  if (lopende.has(item.id)) {
    try {
      for (const statusA of ['open', 'gekozen']) {
        const rA = await fetch(`${AANBOD_API}?status=${statusA}`, { headers: { 'x-meet-code': MEET_CODE } });
        const { aanbiedingen } = rA.ok ? await rA.json() : { aanbiedingen: [] };
        for (const a of aanbiedingen || []) {
          if (a.lead?.rpItemId !== item.id) continue;
          await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen', reden: 'vervangen door directe boeking (' + (m.bron || 'dashboard') + ')' }) }).catch(() => {});
          const stX = laadState();
          const { verwijderOpties } = require('./lib/outlook-opties.js');
          await verwijderOpties(stX.opties?.[a.token]).catch(() => {});
          delete stX.opties?.[a.token];
          delete stX.aangeboden?.[item.id];
          bewaarState(stX);
        }
      }
    } catch (e) { console.log('  lopend aanbod intrekken bij directe boeking mislukt: ' + e.message.slice(0, 60)); }
  }

  // boeken op het gekozen slot — eerst verse botsingscontrole
  const van = Date.parse(m.slot.aankomst);
  const tot = van + duur * 60000;
  const botst = (agenda[m.slot.inmeter] || []).some((a) =>
    !String(a.klant || '').includes(lead.naam) && Date.parse(a.start) < tot && Date.parse(a.eind) > van);
  if (botst) throw new Error('gekozen tijd is inmiddels bezet — kies een andere');

  const gekozenSlot = { inmeter: m.slot.inmeter, aankomst: new Date(m.slot.aankomst), extraRijtijdMin: 0 };
  const uitkomst = await verwerkLead(lead, item, gekozenSlot, duur);
  let outlookEventId = null, agendaRes = null, agendaVia = null;
  try {
    const { maakDefinitief } = require('./lib/outlook-opties.js');
    const { boekInmeetAfspraak } = require('./lib/inmeet-boeken.js');
    agendaRes = await boekInmeetAfspraak({ slot: { aankomst: m.slot.aankomst, inmeter: m.slot.inmeter }, naam: lead.naam, telefoon: lead.telefoon, adres: lead.volledigAdres, duurMin: duur, email: lead.email }); outlookEventId = agendaRes.id; agendaVia = agendaRes.via;
  } catch (e) {
    await telegram(`⚠️ Outlook-afspraak bij winkel-boeking mislukt voor ${lead.naam}: ${e.message.slice(0, 100)}`);
  }
  try {
    const { registreerBoeking } = require('./lib/inmeet-mutatie.js');
    registreerBoeking({
      rpItemId: item.id, naam: lead.naam, telefoon: lead.telefoon, email: lead.email,
      planadoJobUuid: uitkomst.planadoJobUuid, outlookEventId, agendaVia, grippNr: uitkomst.grippNr,
      sheet: uitkomst.sheetLocatie, slot: { aankomst: m.slot.aankomst, inmeter: m.slot.inmeter }, duurMin: duur,
      bron: m.bron || null,
    });
  } catch (e) {
    await telegram(`⚠️ Boekingsrecord (winkel-boeking) niet opgeslagen voor ${lead.naam}: ${e.message.slice(0, 100)}`);
  }
  await verwijderRekenKaart(item.id);
  try {
    const inst2 = await require('./lib/instellingen.js').haalInstellingen();
    // Bot-boekingen (sunny/klant-reply/herstel) bevestigen ALTIJD direct — de klant
    // staat niet aan de balie en stilte na een boeking is de foute uitkomst. De
    // instelling bevestigingSturen blijft alleen de winkel-kliks besturen (26-08:
    // daimy's boeking kreeg pas 20 min later via de nacontrole een bevestiging).
    if (inst2.bevestigingSturen || ['sunny', 'klant-reply', 'herstel-keuze'].includes(m.bron)) {
      const { verstuurBevestiging } = require('./lib/aanbod-versturen');
      // ÉÉN WHATSAPP-BEVESTIGING (Daimy 28-08: "ik krijg 2 bevestigingsberichten, 1 is genoeg"):
      // bij een Sunny-boeking is Sunny's eigen antwoord in het gesprek ("dan zet ik ... vast")
      // de WhatsApp-bevestiging; de keten stuurt dan alleen nog de mail met alle details.
      // Sunny's eigen antwoord telt alleen als WA-bevestiging als hij AANTOONBAAR net iets verstuurde
      // in dit gesprek (review 28-08); anders gaat de formele WA-bevestiging gewoon mee.
      const stB = laadState();
      const waTicketB = Object.values(stB.aanbodTickets || {}).filter((a) => String(a.rpItemId) === String(item.id) && a.waTicket).sort((x, y) => String(y.verstuurdOp).localeCompare(String(x.verstuurdOp)))[0]?.waTicket || null;
      const sunnyBoekt = m.bron === 'sunny' && !!(m.ticketId || waTicketB) && sunnyStart.sunnyStuurdeNet(m.ticketId || waTicketB, 30);
      const bevRes = await verstuurBevestiging({ lead: { naam: lead.naam, telefoon: lead.telefoon, email: lead.email, adres: lead.volledigAdres || null }, duurMin: duur, bron: m.bron }, { aankomst: m.slot.aankomst, inmeter: m.slot.inmeter }, { alleenMail: sunnyBoekt });
      try { require('./lib/inmeet-mutatie.js').noteerBevestiging(item.id, sunnyBoekt ? { wa: { ok: true, via: 'sunny-gesprek' }, mail: bevRes.mail } : bevRes); } catch { /* register is extra */ }
      if (!sunnyBoekt && !bevRes.wa?.ok && !bevRes.mail?.ok) await telegram(`🚨 ${lead.naam} is geboekt maar kreeg GEEN bevestiging (wa: ${bevRes.wa?.reden}; mail: ${bevRes.mail?.reden}) — even zelf sturen.`);
    }
  } catch { /* bevestiging is nice-to-have; kantoor boekt met klant aan de lijn */ }
  if (magBoekingMelden(`${lead.naam}|${new Date(m.slot.aankomst).toISOString()}`)) {
    // sunny/klant-reply/herstel = de bot deed het hele traject zelf; een klik in het
    // dashboard is mensenwerk en krijgt de bot-regel dus niet.
    const bronNaam = { sunny: 'Sunny (in het gesprek)', 'klant-reply': 'klantreactie', 'herstel-keuze': 'herstel door de bot' }[m.bron] || `winkel (${m.bron})`;
    await telegram(boekingsMelding({
      naam: lead.naam, aankomst: m.slot.aankomst, inmeter: m.slot.inmeter,
      plaats: lead.plaats, adres: lead.volledigAdres, duurMin: duur,
      samenvatting: uitkomst.samenvatting, via: bronNaam,
      automatisch: ['sunny', 'klant-reply', 'herstel-keuze'].includes(m.bron),
    }), { boeking: true });
  }
  return `geboekt: ${uitkomst.samenvatting}`;
}

/** Eén verzoek uit de wachtrij uitvoeren (daemon-ingang). */
async function verwerkVerzoek(m) {
  if (m.type === 'boek' || m.type === 'stuur-aanbod') return { afgewezen: false, uitkomst: await verwerkDashboardVerzoek(m) };
  const { vindBoeking, muteerBoeking } = require('./lib/inmeet-mutatie.js');
  const boeking = vindBoeking({ telefoon: m.telefoon, email: m.email, naam: m.naam });
  if (!boeking) {
    // KANTOOR-AFSPRAAK (Daimy 03-09, Lotte Vos): staat de afspraak alleen in Outlook/Planado (door kantoor gemaakt), dan
    // annuleren we die óók zelf, i.p.v. "handmatig nakijken" terwijl de inmeter al onderweg is.
    if (m.type === 'annuleer' && (m.telefoon || m.planadoJobUuid)) {
      const { annuleerKantoorAfspraak, annuleerKantoorAfspraakOpUuid } = require('./lib/kantoor-afspraak.js');
      // uit de zoeklijst van /admin/inmeet-mutatie (03-09) komt de Planado-id mee: dan hoeft er niet op telefoon gezocht te worden
      const k = await (m.planadoJobUuid
        ? annuleerKantoorAfspraakOpUuid(m.planadoJobUuid, { reden: m.reden || '', bron: m.bron })
        : annuleerKantoorAfspraak({ telefoon: m.telefoon, naam: m.naam, reden: m.reden || '', bron: m.bron })
      ).catch((e) => ({ gevonden: false, gelukt: false, stappen: [{ stap: 'kantoor', ok: false, detail: e.message.slice(0, 80) }] }));
      if (k.gevonden) {
        const vn = (k.afspraak.klant || m.naam || 'daar').split(' ')[0];
        const tekst = k.gelukt
          ? `Hoi ${vn}, we hebben de inmeetafspraak geannuleerd. Mocht het later toch weer spelen, dan ben je altijd welkom.\n\nGroetjes, Nanny van Sonty`
          : `Hoi ${vn}, we zijn je inmeetafspraak aan het annuleren; een collega rondt het vandaag af en je hoort het zodra het rond is.\n\nGroetjes, Nanny van Sonty`;
        const uit = await require('./lib/aanbod-versturen').stuurVrijBericht({ telefoon: m.telefoon || k.afspraak.telefoon, email: m.email, naam: k.afspraak.klant || m.naam, tekst, onderwerp: 'Je inmeetafspraak is geannuleerd', afzender: 'Nanny' }).catch((e) => ({ ok: false, reden: e.message }));
        if (!uit.ok) await telegram(`🚨 ${k.afspraak.klant || m.naam}: kantoor-afspraak geannuleerd maar de klant kon NIET bereikt worden (${uit.reden}) — even zelf laten weten.`);
        return { afgewezen: false, uitkomst: k.gelukt ? 'kantoor-afspraak: alle systemen bijgewerkt' : 'kantoor-afspraak deels: ' + k.stappen.filter((x) => !x.ok).map((x) => x.stap + ' ' + x.detail).join(',') };
      }
    }
    await telegram(`⚠️ Mutatie-verzoek (${m.bron}, ${m.type}) voor ${m.naam || m.telefoon || m.email}: geen actieve boeking gevonden (ook niet in Outlook/Planado) — handmatig nakijken.`);
    return { afgewezen: true, uitkomst: 'geen actieve boeking gevonden' };
  }
  const res = await muteerBoeking(boeking.rpItemId, m.type, { reden: m.reden || '', bron: m.bron });
  if (m.type === 'annuleer') {
    // KLANT HOORT ALTIJD IETS (review 28-08): WhatsApp als er een gesprek is, anders mail; lukt
    // geen van beide, dan alarm. En alleen "geannuleerd" zeggen als het écht overal is gelukt.
    const afz = boeking.bron === 'sunny' ? 'Sunny' : 'Nanny';
    const vn = (boeking.naam || 'daar').split(' ')[0];
    const tekst = res.gelukt
      ? `Hoi ${vn}, we hebben de inmeetafspraak geannuleerd. Mocht het later toch weer spelen, dan ben je altijd welkom.\n\nGroetjes, ${afz} van Sonty`
      : `Hoi ${vn}, we zijn je inmeetafspraak aan het annuleren; een collega rondt het vandaag af en je hoort het zodra het rond is.\n\nGroetjes, ${afz} van Sonty`;
    const uit = await require('./lib/aanbod-versturen').stuurVrijBericht({ telefoon: boeking.telefoon, email: boeking.email, naam: boeking.naam, tekst, onderwerp: 'Je inmeetafspraak is geannuleerd', afzender: afz }).catch((e) => ({ ok: false, reden: e.message }));
    if (!uit.ok) await telegram(`🚨 ${boeking.naam}: afspraak geannuleerd maar de klant kon NIET bereikt worden (${uit.reden}) — even zelf laten weten.`);
  }
  return { afgewezen: false, uitkomst: res.gelukt ? 'alle systemen bijgewerkt' : 'deels: ' + res.stappen.filter((x) => !x.ok).map((x) => x.stap).join(',') };
}

module.exports = { eigenAgendaBlokken, laadEigenAgendas, rpGet, PID, BACKLOG_ID, grippCall, verwerkVerzoek, ontdubbelSlots, verversRonde: main, maakEnVerstuurAanbod, haalAgenda, leesLeadCompleet, werkdagenVoor, laadVakanties, voegAanbiedingenToe, ROOSTER, MEET_CODE_EXPORT: MEET_CODE, telegram, reminderNu, reminderTekst };

if (require.main === module) {
  if (process.argv.includes('--verwerk-aanbod')) {
    verwerkAanbiedingen().catch((e) => { console.error(e); process.exit(1); });
  } else {
    main().catch((e) => { console.error(e); process.exit(1); });
  }
}
