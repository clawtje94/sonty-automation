#!/usr/bin/env node
// MEENEEM-MELDING VOOR DE INMETER (Daimy 16-08).
//
// "Als er opmerkingen in de offerte staan, of het is bijvoorbeeld binnen raamdeco wat
// gemeten moet worden, dan moet de inmeter de dag ervoor aan het eind van de dag een
// melding in zijn agenda krijgen dat hij dat mee moet nemen." En daarna scherper:
// "als het los van buiten zonwering is, moet hij in ÉÉN opmerking in zijn agenda weten
// wat er de dag erna ingemeten moet worden, zodat hij dat op de zaak kan halen."
//
// Drie keuzes die niet vanzelf spreken:
//  1. Eén blok per dag, niet per klant. Hij haalt in één keer alles op bij de zaak.
//  2. De regel is omgekeerd: we herkennen BUITENzonwering en melden al het andere.
//     Een lijst met binnen-producten verzinnen loopt altijd achter (de eerste versie
//     miste "Raamdecoratie", precies het hoofdgeval). Onbekend product = wel melden.
//  3. "De dag ervoor" bestaat niet altijd: Joey werkt geen woensdag en vrijdag. Dus
//     zijn LAATSTE WERKDAG vóór de afspraak, 15 min voor het einde van zijn rooster.
//
// Het blok krijgt GEEN deelnemers en staat op Vrij: met deelnemer maakt
// cron-outlook-planado-sync.js er een spook-opdracht van, en op Bezet zou het een
// plangat opvreten.
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
// De inmeter komt als genodigde op het blok, precies zoals bij een gewone afspraak
// (outlook-opties.js maakDefinitief). Dan staat het in ZIJN agenda met ZIJN eigen
// standaardherinnering; de OWA-API laat IsReminderOn niet zetten (geprobeerd 16-08,
// blijft false bij zowel Vrij als Bezet), dus dit is de manier om het echt te laten
// piepen. De sync slaat het blok over op het onderwerp (NIET_KLUS).
const INMETER_MAIL = { Joey: 'joey@sonty.nl', Sjoerd: 'sjoerd@sonty.nl' };
const BUITEN = new RegExp(REGELS.buitenzonwering.join('|'), 'i');
const GEEN_PRODUCT = new RegExp(REGELS.geenProduct.join('|'), 'i');

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
 * De laatste werkdag van deze inmeter vóór de afspraakdatum, plus het meldmoment.
 * Geeft null als er binnen 10 dagen geen werkdag vóór de afspraak ligt.
 */
function meldMoment(inmeter, afspraakDatum) {
  const dagen = ROOSTER[inmeter]?.dagen;
  if (!dagen) return null;
  const d = new Date(afspraakDatum + 'T12:00:00Z');
  for (let i = 0; i < 10; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const datum = d.toISOString().slice(0, 10);
    const blok = dagen[dagKort(datum)];
    if (!blok) continue;
    const [u, m] = blok.tot.split(':').map(Number);
    const start = u * 60 + m - REGELS.meldingMinutenVoorEind;
    const hhmm = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
    return { datum, van: hhmm(start), tot: hhmm(start + REGELS.duurMin), dagErvoor: i === 0 };
  }
  return null;
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
    if (BUITEN.test(naam)) { buiten.push(regel); continue; }
    if (GEEN_PRODUCT.test(naam)) continue;
    vanDeZaak.push(regel);
  }
  return { vanDeZaak, buiten };
}

/** Onderwerp en tekst van het dagblok. Los gehouden zodat de test hem kan draaien. */
function bouwDagMelding({ inmeter, afspraakDatum, moment, afspraken }) {
  const metZaak = afspraken.filter((a) => a.vanDeZaak.length);
  const wanneer = moment.dagErvoor ? 'morgen' : nlDagNaam(afspraakDatum);
  const kop = metZaak.length
    ? `MEENEMEN VAN DE ZAAK — ${wanneer} (${inmeter}): ${metZaak.length} adres${metZaak.length > 1 ? 'sen' : ''}`
    : `LET OP ${wanneer} (${inmeter}): opmerking bij ${afspraken.length} afspraak${afspraken.length > 1 ? 'en' : ''}`;

  const blokken = afspraken.map((a) => {
    const regels = [`${nlTijd(a.aankomst)}  ${a.naam} — ${a.adres || 'adres onbekend'}`];
    if (a.vanDeZaak.length) regels.push('   MEENEMEN: ' + a.vanDeZaak.join(', '));
    else if (a.buiten.length) regels.push('   buitenzonwering (' + a.buiten.join(', ') + ') — niets van de zaak nodig');
    if (a.opmerking) regels.push('   opmerking bij de offerte: ' + a.opmerking);
    for (const k of a.klantOpmerkingen) regels.push('   doorgegeven door de klant: ' + k);
    return regels.join('\n');
  });

  const tekst = [
    `Wat je ${wanneer} nodig hebt, ${metZaak.length ? 'vandaag nog ophalen op de zaak' : 'even lezen voor je gaat'}:`,
    '',
    blokken.join('\n\n'),
    '',
    '(automatisch gezet; dit blok staat op Vrij en blokkeert geen planning)',
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
    const item = (await r.json()).item;
    const d = item?.description || '';
    const opmerking = (d.match(/^Opmerking:\s*(.+)$/im) || [])[1]?.trim() || '';
    const uitLead = [...d.matchAll(/^(\d+)x\s+(.+?):?\s*$/gim)]
      .map((m) => ({ naam: m[2].trim(), regel: `${m[1]}x ${m[2].trim()}` }));
    let uitOfferte = [];
    try {
      const { leesOfferte, productRegel } = require('./inmeten-planner-lees.js');
      const off = await leesOfferte(item);
      if (!off.ambigu) uitOfferte = (off.producten || []).map((p) => ({ naam: p.naam, regel: productRegel(p) }));
    } catch { /* offerte is een bonus, de lead is het vangnet */ }
    return { opmerking, producten: uitOfferte.length ? uitOfferte : uitLead, bron: uitOfferte.length ? 'offerte' : 'lead' };
  } catch {
    return null;
  }
}

/** De producten zoals de planner ze in de Planado-opdracht heeft gezet. */
function productenUitOmschrijving(omschrijving) {
  const r = (omschrijving || '').match(/^\d+ product\(en\):\s*(.+)$/im);
  return r ? r[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

// ── Outlook ─────────────────────────────────────────────────────────────────
function owaHeaders() {
  const token = fs.readFileSync(path.join(__dirname, '.owa-token.txt'), 'utf8').trim();
  return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
}
async function kalenderId(OH) {
  const cals = (await (await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: OH })).json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) throw new Error('kalender Sonty Montage niet gevonden');
  return cal.Id;
}
async function zetBlok(OH, calId, { onderwerp, start, eind, tekst, deelnemers = [] }) {
  const owaTijd = (d) => ({ DateTime: new Date(d).toISOString().slice(0, 19), TimeZone: 'UTC' });
  const r = await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${calId}/events`, {
    method: 'POST', headers: OH,
    body: JSON.stringify({
      Subject: onderwerp,
      Start: owaTijd(start), End: owaTijd(eind),
      Body: { ContentType: 'Text', Content: tekst },
      // Standaard GEEN deelnemers: anders maakt de Outlook→Planado-sync er een klus van.
      Attendees: deelnemers.map((d) => ({ EmailAddress: { Address: d.mail, Name: d.naam }, Type: 'Required' })),
      ShowAs: 'Free',
      IsReminderOn: true,
      ReminderMinutesBeforeStart: 0,
      Categories: ['Meenemen'],
    }),
  });
  if (!r.ok) throw new Error('Outlook-blok aanmaken: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return (await r.json()).Id;
}
async function verwijderBlok(OH, id) {
  try { await fetch('https://outlook.office.com/api/v2.0/me/events/' + id, { method: 'DELETE', headers: OH }); } catch { /* al weg */ }
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
  const jobs = (await planadoJobs()).filter((j) => {
    if (!j.scheduled_at || !uuidNaarNaam[j.assignee?.worker_uuid]) return false;
    const d = nlDatum(j.scheduled_at);
    return d > vandaag && d <= grens;
  });
  console.log(`${jobs.length} opdracht(en) van inmeters in de komende ${REGELS.dagenVooruit} dagen`);

  // 1. per afspraak uitzoeken wat er speelt
  const perDag = {}; // "inmeter|datum" → afspraken
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

    const lead = rpItemId ? await rpLead(rpItemId) : null;
    const producten = lead?.producten?.length ? lead.producten : productenUitOmschrijving(omschrijving);
    const opmerking = lead?.opmerking
      || (omschrijving.match(/OPMERKING BIJ DE OFFERTE:\n(.+)/) || [])[1]?.trim()
      || '';
    const klantOpmerkingen = (omschrijving.match(/LET OP \(doorgegeven door de klant\):\n([\s\S]*)$/) || [])[1]
      ?.split('\n').filter((r) => r.trim().startsWith('-')).map((r) => r.replace(/^-\s*/, '').trim()) || [];

    const { vanDeZaak, buiten } = splitsProducten(producten);
    if (!vanDeZaak.length && !opmerking && !klantOpmerkingen.length) continue;

    const sleutel = `${inmeter}|${afspraakDatum}`;
    (perDag[sleutel] = perDag[sleutel] || []).push({
      naam, adres, aankomst: job.scheduled_at, vanDeZaak, buiten, opmerking, klantOpmerkingen, jobUuid: j.uuid,
    });
  }

  // 2. per inmeter per dag één blok
  const gezet = [];
  const levendeSleutels = new Set(Object.keys(perDag));
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
    const eind = nlNaarUtc(moment.datum, moment.tot);
    const vinger = JSON.stringify({ start: +start, onderwerp, tekst });
    const bestaand = state.blokken[sleutel];
    if (bestaand && bestaand.vinger === vinger) continue;

    console.log(`  ${bestaand ? '~' : '+'} ${moment.datum} ${moment.van} → ${onderwerp}`);
    for (const a of afspraken) console.log(`      ${nlTijd(a.aankomst)} ${a.naam}: ${a.vanDeZaak.join(', ') || '(alleen opmerking)'}`);
    if (!EXECUTE) { gezet.push({ inmeter, moment, onderwerp }); continue; }

    const OH = owaHeaders();
    const calId = await kalenderId(OH);
    if (bestaand?.eventId) await verwijderBlok(OH, bestaand.eventId);
    const eventId = await zetBlok(OH, calId, {
      onderwerp, start, eind, tekst,
      deelnemers: INMETER_MAIL[inmeter] ? [{ mail: INMETER_MAIL[inmeter], naam: inmeter }] : [],
    });
    state.blokken[sleutel] = { eventId, vinger, melddag: moment.datum, afspraakDatum, inmeter, gezetOp: new Date().toISOString() };
    gezet.push({ inmeter, moment, onderwerp });
  }

  // 3. afspraak verzet of afgezegd? Dan hoort het blok ook weg.
  for (const [sleutel, b] of Object.entries(state.blokken)) {
    if (levendeSleutels.has(sleutel) || b.afspraakDatum <= vandaag) continue;
    console.log(`  - blok weg: ${sleutel} (geen afspraken meer die dag)`);
    if (!EXECUTE) continue;
    await verwijderBlok(owaHeaders(), b.eventId);
    delete state.blokken[sleutel];
  }

  if (EXECUTE) fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`\n${gezet.length} dagblok(ken) ${EXECUTE ? 'gezet' : 'zou ik zetten'}`);

  if (EXECUTE && gezet.length && REGELS.ookNaarTelegram) {
    const { planningTelegram } = require('./lib/telegram-planning.js');
    await planningTelegram('🧰 Meeneem-melding in de agenda gezet:\n'
      + gezet.map((g) => `- ${g.moment.datum} ${g.moment.van}: ${g.onderwerp}`).join('\n'));
  }
}

// Alleen draaien als hij zelf wordt aangeroepen; de test laadt dit bestand als module.
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });

module.exports = {
  meldMoment, splitsProducten, bouwDagMelding, nlNaarUtc, nlDatum, nlDagNaam,
  productenUitOmschrijving, owaHeaders, kalenderId, zetBlok,
};
