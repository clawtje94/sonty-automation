#!/usr/bin/env node
// MEENEEM-MELDING VOOR DE INMETER (Daimy 16-08).
//
// "Als er opmerkingen in de offerte staan, of het is bijvoorbeeld binnen raamdeco wat
// gemeten moet worden, dan moet de inmeter de dag ervoor aan het eind van de dag een
// melding in zijn agenda krijgen dat hij dat mee moet nemen." En daarna scherper:
// "als het los van buiten zonwering is, moet hij in ÉÉN opmerking in zijn agenda weten
// wat er de dag erna ingemeten moet worden, zodat hij dat op de zaak kan halen."
//
// De melding staat in PLANADO, niet in Outlook (Daimy 16-08: "het moet in Planado hè,
// niet in mijn agenda"). Planado is de agenda waar de inmeter zelf in werkt.
//
// Drie keuzes die niet vanzelf spreken:
//  1. Eén melding per dag, niet per klant. Hij haalt in één keer alles op bij de zaak.
//  2. De regel is omgekeerd: we herkennen BUITENzonwering en melden al het andere.
//     Een lijst met binnen-producten verzinnen loopt altijd achter (de eerste versie
//     miste "Raamdecoratie", precies het hoofdgeval). Onbekend product = wel melden.
//  3. "De dag ervoor" bestaat niet altijd: Joey werkt geen woensdag en vrijdag. Dus
//     zijn LAATSTE WERKDAG vóór de afspraak, 15 min voor het einde van zijn rooster.
//
// Standaard DRY-RUN. --execute schrijft echt.
const fs = require('fs');
const path = require('path');

const EXECUTE = process.argv.includes('--execute');
const WORTEL = path.join(__dirname, '..');
const REGELS = JSON.parse(fs.readFileSync(path.join(WORTEL, 'data', 'meeneem-regels.json'), 'utf8'));
const ROOSTER = require('../data/inmeters-rooster.json').inmeters;
const STATE = path.join(WORTEL, 'data', 'meeneem-meldingen-state.json');

const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY };
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const SALES_BACKLOG = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const DAGKORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const BUITEN = new RegExp(REGELS.buitenzonwering.join('|'), 'i');
const GEEN_PRODUCT = new RegExp(REGELS.geenProduct.join('|'), 'i');
// Horren vallen er bewust buiten (Daimy 16-08: "horren hoeven er niet bij").
const GEEN_MEENEEM = new RegExp((REGELS.geenMeeneem || ['\\bnooit\\b']).join('|'), 'i');

// ── tijd in Nederland ───────────────────────────────────────────────────────
// Outlook krijgt alles in UTC (zoals de rest van de keten), het rooster staat in
// Nederlandse klokstand. Daar zit in de zomer twee uur tussen en in de winter één.
function nlOffsetMin(d) {
  const naam = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', timeZoneName: 'longOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName').value;
  const m = naam.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
}
/** 'YYYY-MM-DD' + 'HH:MM' Nederlandse tijd → Date in UTC. */
function nlNaarUtc(datum, hhmm) {
  const gok = new Date(`${datum}T${hhmm}:00Z`);
  return new Date(gok.getTime() - nlOffsetMin(gok) * 60000);
}
const nlDatum = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const nlTijd = (d) => new Date(d).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
const nlDagNaam = (datum) => new Date(datum + 'T12:00:00Z').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const dagKort = (datum) => DAGKORT[new Date(datum + 'T12:00:00Z').getUTCDay()];

/**
 * Het meldmoment: altijd de dag vóór de afspraak, op de vaste tijd uit de regels
 * (Daimy 16-08: "wil je het altijd dus de dag ervoor zetten en dan om 18:00").
 *
 * Eerder rekende dit de laatste WERKDAG uit, omdat Joey geen woensdag en vrijdag werkt.
 * Dat is bewust losgelaten: de melding komt nu op zijn telefoon buiten werktijd, dus een
 * vrije dag is geen probleem meer. Gevolg om te weten: valt de dag ervoor in zijn vrije
 * dag, dan leest hij het op een dag dat hij niet werkt.
 */
function meldMoment(inmeter, afspraakDatum) {
  if (!ROOSTER[inmeter]) return null;
  const d = new Date(afspraakDatum + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const datum = d.toISOString().slice(0, 10);
  const [u, m] = REGELS.meldTijd.split(':').map(Number);
  const eind = u * 60 + m + REGELS.duurMin;
  const hhmm = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  return { datum, van: REGELS.meldTijd, tot: hhmm(eind), dagErvoor: true };
}

/**
 * Splitst de producten in "buitenzonwering" en "moet van de zaak mee".
 *
 * Twee dingen die eerder fout gingen en nu vastliggen:
 *  - Er wordt op de NAAM getoetst, niet op de hele regel. Een offerteregel als
 *    "3x Plissé 1200×1400 — wit — koordbediening" bevat "bediening" en zou anders als
 *    bijregel wegvallen; juist die moet gemeld worden.
 *  - Buitenzonwering wordt eerst herkend, daarna pas de bijregels. Anders valt
 *    "Voorraad scherm - 20% korting" op het woord korting.
 *
 * @param {Array<string|{naam:string, regel?:string}>} producten
 */
function splitsProducten(producten) {
  const vanDeZaak = [];
  const buiten = [];
  for (const p of producten) {
    const naam = String((typeof p === 'string' ? p : p?.naam) || '').trim();
    const regel = (typeof p === 'string' ? p : p?.regel || p?.naam) || '';
    if (!naam) continue;
    if (GEEN_MEENEEM.test(naam) || BUITEN.test(naam)) { buiten.push(regel); continue; }
    if (GEEN_PRODUCT.test(naam)) continue;
    vanDeZaak.push(regel);
  }
  return { vanDeZaak, buiten };
}

/** Onderwerp en tekst van het dagblok. Los gehouden zodat de test hem kan draaien. */
function bouwDagMelding({ inmeter, afspraakDatum, moment, afspraken }) {
  const wanneer = moment.dagErvoor ? 'morgen' : nlDagNaam(afspraakDatum);
  const kop = `MEENEMEN VAN DE ZAAK — ${wanneer} (${inmeter}): ${afspraken.length} adres${afspraken.length > 1 ? 'sen' : ''}`;

  const blokken = afspraken.map((a) => {
    const regels = [`${nlTijd(a.aankomst)}  ${a.naam} — ${a.adres || 'adres onbekend'}`];
    regels.push('   MEENEMEN: ' + a.vanDeZaak.join(', '));
    // De opmerking is geen aanleiding meer (Daimy 16-08: "niet de rest, want dat nemen
    // we al allemaal mee"), maar als de melding er tóch staat is het handig hem te lezen.
    if (a.opmerking) regels.push('   opmerking bij de offerte: ' + a.opmerking);
    for (const k of a.klantOpmerkingen) regels.push('   doorgegeven door de klant: ' + k);
    return regels.join('\n');
  });

  const tekst = [
    `Ophalen op de zaak, nodig voor ${wanneer}:`,
    '',
    blokken.join('\n\n'),
  ].join('\n');

  return { onderwerp: kop, tekst };
}

// ── bronnen ─────────────────────────────────────────────────────────────────
async function planadoJobs() {
  const jobs = [];
  let after = null;
  for (let i = 0; i < 40; i++) {
    const d = await (await fetch('https://api.planadoapp.com/v2/jobs' + (after ? '?after=' + after : ''), { headers: PH })).json();
    const l = d.jobs || [];
    if (!l.length) break;
    jobs.push(...l);
    after = l[l.length - 1].uuid;
    await wacht(2600);
  }
  return jobs;
}

/**
 * De RP-lead plus, als die er is, de productregels uit het offertedocument. Daar staat
 * wat er echt gemeten moet worden ("Plissé", "Blend"); de lead zelf zegt vaak alleen
 * "Raamdecoratie" (Daimy 16-08). leesOfferte cachet 6 uur, dus dit is RP-zuinig.
 */
async function rpLead(itemId) {
  try {
    const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES_BACKLOG}/items/${itemId}`, {
      headers: { Authorization: 'Bearer ' + RP_API_KEY },
    });
    if (!r.ok) return null;
    return await leesUitItem((await r.json()).item);
  } catch {
    return null;
  }
}

async function leesUitItem(item) {
  try {
    const d = item?.description || '';
    const opmerking = (d.match(/^Opmerking:\s*(.+)$/im) || [])[1]?.trim() || '';
    // ALLEEN de offerte telt (Daimy 16-08: "natuurlijk wel alleen erin zetten als we daar
    // ook gaan inmeten hè?"). De leadtekst is de wenslijst uit het aanvraagformulier en
    // zegt niets over wat we gaan meten: van de 8 leads die op hun leadtekst "raamdeco"
    // riepen, had GEEN ENKELE raamdeco in de offerte staan (Helene Beek: lead zegt
    // raamdecoratie, offerte is een rolluik). Geen leesbare offerte = geen melding.
    let producten = [];
    let status = null;
    try {
      const { leesOfferte, productRegel } = require('./inmeten-planner-lees.js');
      const off = await leesOfferte(item);
      status = off.ambigu ? 'ambigu' : (off.status || 'geen offerte');
      if (!off.ambigu) producten = (off.producten || []).map((p) => ({ naam: p.naam, regel: productRegel(p) }));
    } catch { status = 'offerte niet te lezen'; }
    return { opmerking, producten, status };
  } catch {
    return null;
  }
}

/**
 * Afspraken die niet door de bot zijn geboekt (uit Outlook gesynct of met de hand in
 * Planado gezet) hebben geen external_id "rp-…". Dat is 73% van de agenda, dus zonder
 * deze terugval zou de melding voor het grootste deel van de inmetingen nooit afgaan.
 * Daarom: de lead opzoeken op klantnaam, en ALLEEN als er precies één past.
 */
let leadIndexCache = null;
async function leadIndex() {
  if (leadIndexCache) return leadIndexCache;
  const alles = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES_BACKLOG}/items?limit=1000&offset=${offset}`, {
      headers: { Authorization: 'Bearer ' + RP_API_KEY },
    });
    if (!r.ok) break;
    const d = await r.json();
    alles.push(...(d.items || []));
    if (!d.has_more) break;
  }
  leadIndexCache = alles;
  return alles;
}

const sleutelNaam = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

async function leadOpNaam(naam) {
  const n = sleutelNaam(naam);
  if (n.length < 4) return null;
  const items = await leadIndex();
  const treffers = items.filter((it) => {
    const s = sleutelNaam(it.summary);
    return s === n || (s.length >= 4 && n.length >= 4 && (s.includes(n) || n.includes(s)));
  });
  // Twee leads met dezelfde naam: dan weten we het niet, en gokken is erger dan zwijgen.
  return treffers.length === 1 ? treffers[0] : null;
}

/** De producten zoals de planner ze in de Planado-opdracht heeft gezet. */
function productenUitOmschrijving(omschrijving) {
  const r = (omschrijving || '').match(/^\d+ product\(en\):\s*(.+)$/im);
  return r ? r[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/**
 * De Gripp-regels die de Outlook→Planado-sync al in de opdracht heeft gezet:
 *
 *   Gripp: 6463
 *   IN TE METEN:
 *   - 1x Roma Zipscreen — Onderlat: Design — Somfy IO motor
 *
 * Daimy 16-08: "je kunt toch in Gripp kijken, iedereen heeft een Gripp-nummer of
 * offertenummer, want anders gaan we er niet meten." Klopt, en het staat er al in — dus
 * geen enkele extra Gripp-call nodig. Dit is de bron voor de 7 op 14 afspraken van
 * morgen die uit Outlook komen en geen RP-koppeling hebben.
 */
function productenUitGripp(omschrijving) {
  const blok = (omschrijving || '').split(/^IN TE METEN:$/im)[1];
  if (!blok) return [];
  return blok.split('\n')
    .map((r) => r.trim())
    .filter((r) => r.startsWith('-'))
    .map((r) => r.replace(/^-\s*/, ''))
    .filter(Boolean)
    .map((regel) => ({ naam: regel.split('—')[0].replace(/^\d+x\s*/, '').trim(), regel }));
}

/** Het Gripp-nummer uit de opdracht, puur om in de log te kunnen zien waar het vandaan komt. */
const grippNummer = (omschrijving) => ((omschrijving || '').match(/^Gripp:\s*(\d+)/im) || [])[1] || null;

// ── Planado ─────────────────────────────────────────────────────────────────
// De melding hoort in Planado, niet in Outlook (Daimy 16-08: "het moet in Planado hè,
// niet in mijn agenda"). Planado is de agenda waar de inmeter in werkt.
//
// Het is een opdracht van 15 min zonder werkbon-sjabloon, met het type "default" zodat
// hij niet meetelt als inmeet- of montageafspraak. external_id "meeneem-<wie>-<dag>"
// maakt hem herkenbaar: cron-outlook-planado-sync.js slaat hem daarop over, anders zou
// die er een Bookings-afspraak van maken met bevestigingsmail naar een niet-bestaande klant.
const JOBTYPE_DEFAULT = '1f11c802-6337-6970-9d06-7e73cee772e4';
const ZAAK_ADRES = 'Frijdastraat 8F, 2288 EX Rijswijk';
// Melden aan de inmeter mag hier juist wél: dit ís de melding.
const PH_SCHRIJF = { ...PH, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'true' };

const extIdVoor = (inmeter, afspraakDatum) => `meeneem-${inmeter.toLowerCase()}-${afspraakDatum}`;

async function planadoSchrijf(ep, body, methode = 'POST') {
  const r = await fetch('https://api.planadoapp.com/v2' + ep, {
    method: methode, headers: PH_SCHRIJF, body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Planado ${methode} ${r.status}: ${(await r.text()).slice(0, 140)}`);
  return r.status === 204 ? {} : r.json();
}

function meldingBody({ inmeter, workerUuid, start, onderwerp, tekst }) {
  return {
    job_type: { uuid: JOBTYPE_DEFAULT },
    // De lijst staat ONDER HET ADRES, niet als opmerking in de opdracht (Daimy 16-08).
    // De omschrijving blijft één regel, dat is wat hij in het overzicht ziet staan.
    description: onderwerp,
    address: { formatted: ZAAK_ADRES, description: tekst },
    scheduled_at: new Date(start).toISOString(),
    scheduled_duration: { minutes: REGELS.duurMin },
    assignee: { worker: { uuid: workerUuid } },
  };
}

// ── hoofdlus ────────────────────────────────────────────────────────────────
async function main() {
  console.log(EXECUTE ? '=== MEENEEM-MELDINGEN (schrijft echt) ===' : '=== DRY-RUN (--execute om echt te schrijven) ===');
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { blokken: {} }; } })();
  state.blokken = state.blokken || {};

  const uuidNaarNaam = {};
  for (const [naam, r] of Object.entries(ROOSTER)) if (r.uuidPlanado) uuidNaarNaam[r.uuidPlanado] = naam;

  const vandaag = nlDatum(new Date());
  const grens = nlDatum(new Date(Date.now() + REGELS.dagenVooruit * 86400000));
  const alleJobs = await planadoJobs();
  // Meldingen die er al staan, zodat we ze bijwerken in plaats van dubbel zetten.
  const bestaand = {};
  for (const j of alleJobs) if ((j.external_id || '').startsWith('meeneem-')) bestaand[j.external_id] = j;
  const jobs = alleJobs.filter((j) => {
    if (!j.scheduled_at || !uuidNaarNaam[j.assignee?.worker_uuid]) return false;
    if ((j.external_id || '').startsWith('meeneem-')) return false;
    const d = nlDatum(j.scheduled_at);
    return d > vandaag && d <= grens;
  });
  console.log(`${jobs.length} opdracht(en) van inmeters in de komende ${REGELS.dagenVooruit} dagen`
    + `, ${Object.keys(bestaand).length} meeneem-melding(en) staan er al`);

  // 1. per afspraak uitzoeken wat er speelt
  const perDag = {}; // "inmeter|datum" → afspraken
  const onbekend = []; // afspraken zonder leesbare offerte: daar kunnen we niets over zeggen
  for (const j of jobs) {
    const det = await (await fetch('https://api.planadoapp.com/v2/jobs/' + j.uuid, { headers: PH })).json();
    const job = det.job || det;
    await wacht(2600);
    const omschrijving = job.description || '';
    if (!/inmeet|inmeten/i.test(omschrijving.split('\n')[0])) continue;

    const inmeter = uuidNaarNaam[j.assignee.worker_uuid];
    const afspraakDatum = nlDatum(job.scheduled_at);
    const naam = (job.contacts || []).find((c) => c.type === 'phone')?.name
      || omschrijving.split('\n')[0].replace(/^.*?(—|-)\s*/, '').trim();
    const adres = job.address?.formatted || omschrijving.split('\n')[1] || '';
    const rpItemId = (job.external_id || '').startsWith('rp-') ? job.external_id.slice(3) : null;

    // Volgorde van bronnen, allemaal "wat gaan we daar meten":
    //  1. de Gripp-regels die al in de opdracht staan (afspraken uit Outlook),
    //  2. de RP-offerte via de rp-koppeling (afspraken die de bot zelf boekte),
    //  3. de RP-offerte via de klantnaam.
    // Nooit de leadtekst: dat is de wenslijst van de klant, niet wat we gaan meten.
    let producten = productenUitGripp(omschrijving);
    let bron = producten.length ? 'gripp ' + (grippNummer(omschrijving) || '?') : null;
    let lead = null;
    if (!producten.length) {
      lead = rpItemId ? await rpLead(rpItemId) : null;
      if (!lead) {
        const opNaam = await leadOpNaam(naam);
        if (opNaam) lead = await leesUitItem(opNaam);
      }
      producten = lead?.producten || [];
      if (producten.length) bron = 'rp-offerte';
    }
    if (!producten.length) {
      // Zichtbaar houden: hier weten we niet wát er gemeten wordt, dus geen melding.
      // Stil overslaan zou betekenen dat een raamdeco-inmeting ongemerkt wegvalt.
      onbekend.push(`${nlDatum(job.scheduled_at)} ${uuidNaarNaam[j.assignee.worker_uuid]}: ${naam} `
        + `(geen Gripp-regels in de opdracht en ${!lead ? 'geen lead gevonden' : lead.status || 'geen offerte'})`);
      continue;
    }
    const opmerking = lead?.opmerking
      || (omschrijving.match(/OPMERKING BIJ DE OFFERTE:\n(.+)/) || [])[1]?.trim()
      || '';
    const klantOpmerkingen = (omschrijving.match(/LET OP \(doorgegeven door de klant\):\n([\s\S]*)$/) || [])[1]
      ?.split('\n').filter((r) => r.trim().startsWith('-')).map((r) => r.replace(/^-\s*/, '').trim()) || [];

    // ALLEEN spullen die op de zaak liggen (Daimy 16-08: "echt alleen binnen
    // raamdecoratie of behang, dat soort dingen, niet de rest want dat nemen we al
    // allemaal mee"). Een opmerking is dus géén aanleiding meer, hij rijdt met waaier,
    // gereedschap en boormateriaal al rond.
    const { vanDeZaak, buiten } = splitsProducten(producten);
    if (!vanDeZaak.length) continue;

    const sleutel = `${inmeter}|${afspraakDatum}`;
    (perDag[sleutel] = perDag[sleutel] || []).push({
      naam, adres, aankomst: job.scheduled_at, vanDeZaak, buiten, opmerking, klantOpmerkingen, jobUuid: j.uuid, bron,
    });
  }

  // 2. per inmeter per dag één blok
  const gezet = [];
  const gebruikteExtIds = new Set();
  for (const [sleutel, afspraken] of Object.entries(perDag)) {
    const [inmeter, afspraakDatum] = sleutel.split('|');
    afspraken.sort((a, b) => new Date(a.aankomst) - new Date(b.aankomst));
    const moment = meldMoment(inmeter, afspraakDatum);
    if (!moment) { console.log(`  ! geen werkdag van ${inmeter} vóór ${afspraakDatum}`); continue; }
    if (moment.datum < vandaag) {
      console.log(`  ! ${inmeter} ${afspraakDatum}: meldmoment ${moment.datum} is al voorbij`);
      continue;
    }

    const { onderwerp, tekst } = bouwDagMelding({ inmeter, afspraakDatum, moment, afspraken });
    const start = nlNaarUtc(moment.datum, moment.van);
    const extId = extIdVoor(inmeter, afspraakDatum);
    gebruikteExtIds.add(extId);
    const vinger = JSON.stringify({ start: +start, onderwerp, tekst });
    const alGezet = state.blokken[sleutel];
    const staatErAl = bestaand[extId];
    if (alGezet && alGezet.vinger === vinger && staatErAl) continue;

    console.log(`  ${staatErAl ? '~' : '+'} ${moment.datum} ${moment.van} → ${onderwerp}`);
    for (const a of afspraken) console.log(`      ${nlTijd(a.aankomst)} ${a.naam} [${a.bron}]: ${a.vanDeZaak.join(', ')}`);
    if (!EXECUTE) { gezet.push({ inmeter, moment, onderwerp }); continue; }

    const body = meldingBody({ inmeter, workerUuid: ROOSTER[inmeter].uuidPlanado, start, onderwerp, tekst });
    let jobUuid;
    if (staatErAl) {
      jobUuid = staatErAl.job_uuid || staatErAl.uuid;
      await planadoSchrijf('/jobs/' + jobUuid, body, 'PATCH');
    } else {
      const job = await planadoSchrijf('/jobs', { ...body, external_id: extId });
      jobUuid = job.job_uuid || job.uuid;
    }
    await wacht(2600);
    state.blokken[sleutel] = { jobUuid, extId, vinger, melddag: moment.datum, afspraakDatum, inmeter, gezetOp: new Date().toISOString() };
    gezet.push({ inmeter, moment, onderwerp });
  }

  // 3. afspraak verzet of afgezegd? Dan hoort de melding ook weg. Bron is Planado zelf,
  //    niet het state-bestand: een melding die met de hand is aangemaakt of waarvan de
  //    state kwijt is, wordt zo alsnog opgeruimd.
  for (const [extId, j] of Object.entries(bestaand)) {
    // meeneem-voorbeeld-* zijn met de hand gezette demo's, die ruimt de eigenaar zelf op.
    if (extId.startsWith('meeneem-voorbeeld')) continue;
    if (gebruikteExtIds.has(extId) || !j.scheduled_at || nlDatum(j.scheduled_at) < vandaag) continue;
    console.log(`  - melding weg: ${extId} (geen afspraken meer die dag)`);
    if (!EXECUTE) continue;
    await planadoSchrijf('/jobs/' + (j.job_uuid || j.uuid), null, 'DELETE').catch((e) => console.log('    ! ' + e.message));
    await wacht(2600);
    for (const [s, b] of Object.entries(state.blokken)) if (b.extId === extId) delete state.blokken[s];
  }

  if (EXECUTE) fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`\n${gezet.length} meeneem-melding(en) ${EXECUTE ? 'in Planado gezet' : 'zou ik in Planado zetten'}`);
  if (onbekend.length) {
    console.log(`\n${onbekend.length} afspraak(en) zonder leesbare offerte — daar kan ik niet zien wat er gemeten wordt:`);
    for (const r of onbekend.slice(0, 15)) console.log('  ? ' + r);
    if (onbekend.length > 15) console.log(`  ... en nog ${onbekend.length - 15}`);
  }

  if (EXECUTE && gezet.length && REGELS.ookNaarTelegram) {
    const { planningTelegram } = require('./lib/telegram-planning.js');
    await planningTelegram('🧰 Meeneem-melding in Planado gezet:\n'
      + gezet.map((g) => `- ${g.moment.datum} ${g.moment.van}: ${g.onderwerp}`).join('\n'));
  }
}

// Alleen draaien als hij zelf wordt aangeroepen; de test laadt dit bestand als module.
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });

module.exports = {
  meldMoment, splitsProducten, bouwDagMelding, nlNaarUtc, nlDatum, nlDagNaam,
  productenUitOmschrijving, productenUitGripp, grippNummer, meldingBody, extIdVoor, nlTijd,
};
