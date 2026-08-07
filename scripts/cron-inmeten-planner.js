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
  } catch { /* eerste keer: geen disk-versie */ }
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
};
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
  const offerte = await leesOfferte(item); // ook voor de RP-nummers (sheet-sleutel)
  lead.rpNummers = offerte.nummers || [];
  lead.rpDatums = offerte.datums || [];
  // "1x Winkel offerte" is geen product maar een placeholder.
  const bruikbaar = lead.producten.filter((p) => !/winkel offerte|offerte$/i.test(p.naam));
  if (bruikbaar.length) return { ...lead, producten: bruikbaar, aantalProducten: bruikbaar.reduce((a, p) => a + p.aantal, 0), bron: 'leadtekst' };
  // Meerdere offertedocumenten zonder één getekende: NIET automatisch verder.
  // De klant moet er echt zelf één tekenen (Daimy 05-08).
  if (offerte.ambigu) return { ...lead, bron: 'AMBIGU', ambigu: true, aantalDocs: offerte.aantalDocs };
  if (!offerte.producten.length) return { ...lead, bron: 'leadtekst (leeg)' };
  return { ...lead, producten: offerte.producten, aantalProducten: offerte.producten.reduce((a, p) => a + p.aantal, 0), bron: 'RP-offerte (' + (offerte.status || '?') + ')' };
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
    // GEEN adres (winkeldienst, intern overleg): telt WEL als bezette tijd — anders
    // plant de bot dwars door een winkeldienst heen. Als anker-adres nemen we de
    // winkel (Rijswijk) voor winkeldiensten en het magazijn voor de rest.
    if (!adres) {
      const soort = /winkel|showroom/i.test(omschrijving) ? 'Frijdastraat 8F, 2288 EZ Rijswijk' : null;
      adres = soort || require('./lib/reistijd').MAGAZIJN;
    }
    perInmeter[inm.naam].push({
      start: j.scheduled_at,
      eind: new Date(+new Date(j.scheduled_at) + ((j.scheduled_duration?.minutes) || 60) * 60000).toISOString(),
      adres,
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
  return perInmeter;
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
async function laadVakanties() {
  try {
    const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
    const OH = { Authorization: 'Bearer ' + token };
    const cal = (((await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value) || [])
      .find((c) => c.Name === 'Sonty Montage');
    const van = new Date();
    const tot = new Date(); tot.setDate(tot.getDate() + 70);
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
function werkdagenVoor(inmeterNaam, aantal = 15) {
  // 15 roosterdagen (was 10): de agenda's zitten momenteel ~3 weken vol, waardoor
  // 10 dagen horizon "geen enkel gat" gaf terwijl er eind augustus wél plek is.
  const vast = ROOSTER[inmeterNaam]?.dagen;
  const startDatum = ROOSTER[inmeterNaam]?.startDatum;
  const dagen = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
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
    // Planado wil template/job_type als OBJECT ({uuid}/{code}); de platte *_uuid-velden
    // worden stil genegeerd en dan toont de app "Opdracht" i.p.v. "Inmeet afspraak"
    // (Daimy 2026-08-05 én 2026-08-06 — geverifieerd tegen de API-docs en een testjob).
    template: { uuid: '1f11c802-65cd-6aa0-9d06-7e73cee772e4' },
    job_type: { code: 'Inmeet afspraak' },
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
  const grippNr = await zoekGrippNummer(lead.naam, lead.id);
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
    await telegram(`⚠️ Sheet bijwerken mislukt voor ${lead.naam} (inkoop-1/datum/inmeter): ${e.message.slice(0, 120)} — handmatig zetten.`);
  }

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
  bewaarState(state);
  const TESTKAART = /\btest\b|reuzenpanda|^[\s/|-]+$/i;
  const testkaarten = items.filter((i) => TESTKAART.test(i.summary || ''));
  for (const t of testkaarten) items.splice(items.indexOf(t), 1);
  console.log(`${items.length} lead(s) op "Inmeten inplannen" (${testkaarten.length} testkaart(en) overgeslagen)`);
  if (LIVE && !ALLEEN) {
    console.log('GEWEIGERD: --live zonder --alleen=<naam> zou alle leads aanschrijven, ook echte klanten.');
    return;
  }
  if (!items.length) return;

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

  for (const item of items) {
    if (lopendeLeads.has(item.id)) { dash.leads.push({ rpItemId: item.id, naam: item.summary, status: 'aanbod-loopt' }); continue; }
    const lead = await leesLeadCompleet(item);
    if (ALLEEN && !`${lead.naam} ${item.id}`.toLowerCase().includes(ALLEEN.toLowerCase())) continue;
    if (lead.ambigu) {
      console.log(`  ! ${lead.naam}: ${lead.aantalDocs} offerteversies, geen enkele getekend — klant moet eerst tekenen`);
      regels.push(`${lead.naam}: ${lead.aantalDocs} offerteversies, GEEN getekend — klant moet tekenen (Mens nodig)`);
      dash.leads.push({ rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, status: 'klant-moet-tekenen' });
      continue;
    }
    if (!lead.volledigAdres || !lead.plaats) {
      console.log(`  ! ${lead.naam}: geen bruikbaar adres, overslaan`);
      regels.push(`${lead.naam}: GEEN ADRES — handmatig`);
      dash.leads.push({ rpItemId: item.id, naam: lead.naam, status: 'geen-adres' });
      continue;
    }
    const duur = schatDuur(lead.producten);

    // Beste slot over beide inmeters heen: wie het goedkoopst kan, krijgt hem.
    let beste = [];
    for (const inm of INMETERS) {
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
    if (aanbod.length && aanbod.length < 3) aanbod = await zorgVoorDrieOpties(lead, duur, agenda, aanbod);

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
        // óók wachtende klanten krijgen hun best beschikbare 3 tijden op de kaart
        // (mét omrij-minuten): de bot wacht zelf op een buurklus, maar de winkel
        // moet altijd kunnen handelen (Daimy 06-08)
        let nood = kiesAanbod(beste, 3, { wachtDagen: 999 });
        if (nood.length < 3) nood = await zorgVoorDrieOpties(lead, duur, agenda, nood);
        dash.leads.push({
          rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, duurMin: duur, wachtDagen,
          status: 'wachtend', reden,
          producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
          top: nood.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin })),
        });
      }
      continue;
    }
    for (const s of aanbod) {
      console.log(`    ${s.inmeter}: ${s.datum} ${venster(s)}  +${s.extraRijtijdMin} min rijtijd (na ${s.naVorige.slice(0, 24)})`);
    }
    regels.push(`${lead.naam} (${lead.plaats}, ${duur} min): ${aanbod.map((s) => `${s.inmeter} ${s.datum.slice(5)} ${venster(s)} +${s.extraRijtijdMin}min`).join(' | ')}`);
    dash.leads.push({
      rpItemId: item.id, naam: lead.naam, plaats: lead.plaats, duurMin: duur, wachtDagen,
      status: LIVE ? 'aanbod-verstuurd' : 'aanbod-mogelijk',
      producten: lead.producten.map((p) => `${p.aantal}x ${p.naam}`).join(', ').slice(0, 90),
      top: aanbod.map((x) => ({ inmeter: x.inmeter, datum: x.datum, venster: venster(x), aankomst: x.aankomst.toISOString(), vertrek: x.vertrek.toISOString(), extra: x.extraRijtijdMin })),
    });

    if (LIVE) {
      try {
        const url = await maakEnVerstuurAanbod(lead, item, aanbod, duur, agenda);
        console.log(`    AANBOD VERSTUURD: ${url}`);
        regels.push(`  → aanbod verstuurd (24u geldig)`);
        state.aangeboden[item.id] = { naam: lead.naam, op: new Date().toISOString(), aanbod: aanbod.length };
      } catch (e) {
        console.log(`    FOUT bij aanbod versturen: ${e.message}`);
        regels.push(`  → aanbod versturen MISLUKT: ${e.message}`);
        continue;
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
  await combiPas(wachtenden, agenda, regels);

  // dashboard vullen: komende boekingen + overzicht naar de site
  try {
    const { laadBoekingen } = require('./lib/inmeet-mutatie.js');
    dash.boekingen = Object.entries(laadBoekingen())
      .filter(([, b]) => b.status === 'geboekt' && Date.parse(b.aankomst) > Date.now())
      .map(([id, b]) => ({ rpItemId: id, naam: b.naam, aankomst: b.aankomst, inmeter: b.inmeter, duurMin: b.duurMin }))
      .sort((a, b) => a.aankomst.localeCompare(b.aankomst));
    await fetch('https://sonty-website.vercel.app/api/inmeet-dashboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meet-code': MEET_CODE },
      body: JSON.stringify(dash),
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

const MAX_COMBI_RIJTIJD_MIN = 20; // klanten die hooguit dit uit elkaar wonen vormen een combi

async function combiPas(wachtenden, agenda, regels) {
  if (wachtenden.length < 2) return;
  const { reistijd } = require('./lib/reistijd');
  const { MAX_EXTRA_RIJTIJD_MIN } = require('./lib/slotzoeker.js');

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

    for (let volg = 0; volg < leden.length; volg++) {
      const w = leden[volg];
      let beste = [];
      for (const inm of INMETERS) {
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
async function zorgVoorDrieOpties(lead, duur, agenda, huidigAanbod) {
  if (huidigAanbod.length >= 3) return huidigAanbod;
  let beste = [];
  for (const inm of INMETERS) {
    try {
      const sl = await zoekSlots({
        agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur,
        werkdagen: werkdagenVoor(inm.naam, 30),
        startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
        eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
      });
      beste.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
    } catch { /* inmeter zonder slots */ }
  }
  beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
  return kiesAanbod(beste, 3, { wachtDagen: 999 });
}

/** Aanbod vastleggen in het register en direct naar de klant sturen (mail + WhatsApp). */
async function maakEnVerstuurAanbod(lead, item, aanbod, duurMin, agenda = null) {
  if (aanbod.length < 3 && agenda) aanbod = await zorgVoorDrieOpties(lead, duurMin, agenda, aanbod);
  if (aanbod.length < 3) throw new Error(`maar ${aanbod.length} tijd(en) beschikbaar — template heeft er 3 nodig, niet verstuurd (handmatig of wachten op ruimte)`);
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
  const { verstuurAanbod } = require('./lib/aanbod-versturen');
  const verzonden = await verstuurAanbod({ lead: { naam: lead.naam, telefoon: lead.telefoon, email: lead.email }, duurMin, ver, slots: aanbod, geldigUren: (await require('./lib/instellingen.js').haalInstellingen()).aanbodGeldigUren }, url);
  if (!verzonden.wa.ok && !verzonden.mail.ok) throw new Error(`niet bezorgd (wa: ${verzonden.wa.reden}, mail: ${verzonden.mail.reden})`);
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
    } };
    bewaarState(st2);
  } catch { /* monitor valt dan terug op telefoon-zoeken */ }
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

async function verwerkAanbiedingen() {
  const state = laadState();

  // mutatie/boek-verzoeken worden door de SNELLE daemon verwerkt (inmeet-verzoek-daemon.js)
  // 1. verlopen aanbiedingen opruimen + melden (de 24-uursklok)
  const { aanbiedingen: open } = await aanbodApi('?status=open');
  for (const a of open) {
    if (Date.now() > Date.parse(a.verlooptOp)) {
      await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verlopen' }) });
      const { verwijderOpties } = require('./lib/outlook-opties.js');
      await verwijderOpties(state.opties?.[a.token]).catch(() => {});
      delete state.opties?.[a.token];
      await telegram(`⏰ Inmeet-aanbod voor ${a.lead.naam} is na 24 uur verlopen zonder keuze. Volgende stap: nieuw aanbod of bellen (belscherm).`);
    }
  }

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
        await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verwerkt' }) });
        const { verwijderOpties } = require('./lib/outlook-opties.js');
        await verwijderOpties(state.opties?.[a.token]).catch(() => {});
        delete state.opties?.[a.token];
        delete state.aangeboden?.[a.lead.rpItemId];
        await telegram(`↩️ ${a.lead.naam} koos ${slot.datum} bij ${slot.inmeter}, maar dat gat is inmiddels door het kantoor gevuld. De klant krijgt bij de volgende planner-run automatisch een nieuw aanbod.`);
        console.log(`  ↩ ${a.lead.naam}: gekozen slot bezet — nieuw aanbod volgt automatisch`);
        continue;
      }
      const uitkomst = await verwerkLead(lead, null, gekozenSlot, a.duurMin);
      // bevestiging alleen als de schakelaar aan staat (Daimy 06-08: zolang de
      // afspraak via Outlook wordt gezet is die uitnodiging al de bevestiging)
      try {
        const inst2 = await require('./lib/instellingen.js').haalInstellingen();
        if (inst2.bevestigingSturen) {
          const { verstuurBevestiging } = require('./lib/aanbod-versturen');
          const b = await verstuurBevestiging(a, { aankomst: slot.aankomst, inmeter: slot.inmeter });
          if (!b.ergensGelukt) await telegram(`⚠️ Bevestiging naar ${a.lead.naam} niet bezorgd (wa: ${b.wa.reden}, mail: ${b.mail.reden}) — even handmatig bevestigen.`);
        }
      } catch (e) {
        await telegram(`⚠️ Bevestiging naar ${a.lead.naam} mislukt: ${e.message.slice(0, 100)}`);
      }
      // gekozen optie wordt de echte Outlook-afspraak; de andere opties verdwijnen
      let outlookEventId = null;
      try {
        const { maakDefinitief, verwijderOpties } = require('./lib/outlook-opties.js');
        await verwijderOpties(state.opties?.[a.token]);
        delete state.opties?.[a.token];
        outlookEventId = await maakDefinitief({ slot: gekozenSlot, naam: a.lead.naam, telefoon: a.lead.telefoon, adres: a.lead.volledigAdres, duurMin: a.duurMin });
      } catch (e) {
        await telegram(`⚠️ Outlook-afspraak na boeking mislukt voor ${a.lead.naam}: ${e.message.slice(0, 100)} — Planado is WEL geboekt; agenda handmatig aanvullen.`);
      }
      // ALLE rollback-sleutels vastleggen — zonder dit kan niemand netjes annuleren/verzetten
      try {
        const { registreerBoeking } = require('./lib/inmeet-mutatie.js');
        registreerBoeking({
          rpItemId: a.lead.rpItemId, naam: a.lead.naam, telefoon: a.lead.telefoon, email: a.lead.email,
          planadoJobUuid: uitkomst.planadoJobUuid, outlookEventId, grippNr: uitkomst.grippNr,
          sheet: uitkomst.sheetLocatie, slot: { aankomst: slot.aankomst, inmeter: slot.inmeter },
          duurMin: a.duurMin, aanbodToken: a.token,
        });
      } catch (e) {
        await telegram(`⚠️ Boekingsrecord niet opgeslagen voor ${a.lead.naam}: ${e.message.slice(0, 100)} — annuleren/verzetten wordt dan handwerk.`);
      }
      await verwijderRekenKaart(a.lead.rpItemId);
      await aanbodApi('/' + a.token, { method: 'PATCH', body: JSON.stringify({ status: 'verwerkt' }) });
      console.log(`  ✓ ${a.lead.naam}: ${uitkomst.samenvatting}`);
      await telegram(`✅ Inmeetafspraak GEBOEKT na klantkeuze:\n${a.lead.naam} — ${slot.datum}, ${slot.inmeter}\n${uitkomst.samenvatting}`);
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

/** Dashboard-verzoek: 'boek' = direct boeken op het gekozen slot (klant zit bv. aan
 * de telefoon in de winkel); 'stuur-aanbod' = verse tijden berekenen en de keuzelink
 * naar de klant sturen. Zelfde veiligheid als de klantkeuze-route: verse agenda,
 * botsingscontrole, alles geregistreerd. */
async function verwerkDashboardVerzoek(m) {
  const item = await rpGet(`/contact-service/${PID}/backlogs/${BACKLOG_ID}/items/${m.rpItemId}`).then((d) => d.item || d);
  if (!item?.id) throw new Error('RP-lead niet gevonden');
  const lead = await leesLeadCompleet(item);
  if (lead.ambigu) throw new Error(`${lead.aantalDocs} offerteversies, geen getekend — klant moet eerst tekenen`);
  const duur = schatDuur(lead.producten);
  const agenda = await haalAgenda();
  await laadVakanties();
  const lopende = await voegAanbiedingenToe(agenda); // andermans aangeboden tijden zijn bezet
  if (m.type === 'stuur-aanbod' && lopende.has(item.id)) throw new Error('deze klant heeft al een lopend aanbod — geen tweede sturen');

  if (m.type === 'stuur-aanbod') {
    let beste = [];
    for (const inm of INMETERS) {
      const sl = await zoekSlots({
        agenda: agenda[inm.naam], adres: lead.volledigAdres, duurMin: duur,
        werkdagen: werkdagenVoor(inm.naam),
        startAdres: ROOSTER[inm.naam]?.startAdres || undefined,
        eindAdres: ROOSTER[inm.naam]?.eindAdres || undefined,
      }).catch(() => []);
      beste.push(...sl.map((x) => ({ ...x, inmeter: inm.naam })));
    }
    beste.sort((a, b) => a.extraRijtijdMin - b.extraRijtijdMin || a.aankomst - b.aankomst);
    const aanbod = kiesAanbod(beste, 3, { wachtDagen: 999 }); // winkel vroeg erom: altijd tijden geven
    if (!aanbod.length) throw new Error('geen enkel gat beschikbaar');
    const url = await maakEnVerstuurAanbod(lead, item, aanbod, duur, agenda);
    return `keuzelink verstuurd (3 tijden): ${url}`;
  }

  // boeken op het gekozen slot — eerst verse botsingscontrole
  const van = Date.parse(m.slot.aankomst);
  const tot = van + duur * 60000;
  const botst = (agenda[m.slot.inmeter] || []).some((a) =>
    !String(a.klant || '').includes(lead.naam) && Date.parse(a.start) < tot && Date.parse(a.eind) > van);
  if (botst) throw new Error('gekozen tijd is inmiddels bezet — kies een andere');

  const gekozenSlot = { inmeter: m.slot.inmeter, aankomst: new Date(m.slot.aankomst), extraRijtijdMin: 0 };
  const uitkomst = await verwerkLead(lead, item, gekozenSlot, duur);
  let outlookEventId = null;
  try {
    const { maakDefinitief } = require('./lib/outlook-opties.js');
    outlookEventId = await maakDefinitief({ slot: { aankomst: m.slot.aankomst, inmeter: m.slot.inmeter }, naam: lead.naam, telefoon: lead.telefoon, adres: lead.volledigAdres, duurMin: duur });
  } catch (e) {
    await telegram(`⚠️ Outlook-afspraak bij winkel-boeking mislukt voor ${lead.naam}: ${e.message.slice(0, 100)}`);
  }
  try {
    const { registreerBoeking } = require('./lib/inmeet-mutatie.js');
    registreerBoeking({
      rpItemId: item.id, naam: lead.naam, telefoon: lead.telefoon, email: lead.email,
      planadoJobUuid: uitkomst.planadoJobUuid, outlookEventId, grippNr: uitkomst.grippNr,
      sheet: uitkomst.sheetLocatie, slot: { aankomst: m.slot.aankomst, inmeter: m.slot.inmeter }, duurMin: duur,
    });
  } catch (e) {
    await telegram(`⚠️ Boekingsrecord (winkel-boeking) niet opgeslagen voor ${lead.naam}: ${e.message.slice(0, 100)}`);
  }
  await verwijderRekenKaart(item.id);
  try {
    const inst2 = await require('./lib/instellingen.js').haalInstellingen();
    if (inst2.bevestigingSturen) {
      const { verstuurBevestiging } = require('./lib/aanbod-versturen');
      await verstuurBevestiging({ lead: { naam: lead.naam, telefoon: lead.telefoon, email: lead.email }, duurMin: duur }, { aankomst: m.slot.aankomst, inmeter: m.slot.inmeter });
    }
  } catch { /* bevestiging is nice-to-have; kantoor boekt met klant aan de lijn */ }
  await telegram(`✅ Inmeetafspraak GEBOEKT via dashboard (${m.bron}): ${lead.naam} — ${new Date(m.slot.aankomst).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })} bij ${m.slot.inmeter}.\n${uitkomst.samenvatting}`);
  return `geboekt: ${uitkomst.samenvatting}`;
}

/** Eén verzoek uit de wachtrij uitvoeren (daemon-ingang). */
async function verwerkVerzoek(m) {
  if (m.type === 'boek' || m.type === 'stuur-aanbod') return { afgewezen: false, uitkomst: await verwerkDashboardVerzoek(m) };
  const { vindBoeking, muteerBoeking } = require('./lib/inmeet-mutatie.js');
  const boeking = vindBoeking({ telefoon: m.telefoon, email: m.email, naam: m.naam });
  if (!boeking) {
    await telegram(`⚠️ Mutatie-verzoek (${m.bron}, ${m.type}) voor ${m.naam || m.telefoon || m.email}: geen actieve boeking gevonden — handmatig nakijken.`);
    return { afgewezen: true, uitkomst: 'geen actieve boeking gevonden' };
  }
  const res = await muteerBoeking(boeking.rpItemId, m.type, { reden: m.reden || '', bron: m.bron });
  if (m.type === 'annuleer' && boeking.telefoon) {
    try {
      const { zoekWaTicket } = require('./lib/aanbod-versturen');
      const ticket = await zoekWaTicket(boeking.telefoon).catch(() => null);
      if (ticket) {
        const TT = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
        await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages', {
          method: 'POST', headers: { Authorization: 'Bearer ' + TT, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Hoi ${(boeking.naam || 'daar').split(' ')[0]}, we hebben de inmeetafspraak geannuleerd. Mocht het later toch weer spelen, dan ben je altijd welkom. Groetjes, Nanny van Sonty`, type: 'OUTBOUND' }),
        });
      }
    } catch { /* melding naar kantoor is al gedaan */ }
  }
  return { afgewezen: false, uitkomst: res.gelukt ? 'alle systemen bijgewerkt' : 'deels: ' + res.stappen.filter((x) => !x.ok).map((x) => x.stap).join(',') };
}

module.exports = { verwerkVerzoek, verversRonde: main, haalAgenda, leesLeadCompleet, werkdagenVoor, laadVakanties, ROOSTER, MEET_CODE_EXPORT: MEET_CODE, telegram };

if (require.main === module) {
  if (process.argv.includes('--verwerk-aanbod')) {
    verwerkAanbiedingen().catch((e) => { console.error(e); process.exit(1); });
  } else {
    main().catch((e) => { console.error(e); process.exit(1); });
  }
}
