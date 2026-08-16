#!/usr/bin/env node
// MEENEEM-MELDING VOOR DE INMETER (Daimy 16-08: "als er opmerkingen in de offerte staan
// of het is bijvoorbeeld binnen raamdeco wat gemeten moet worden, dat de inmeter de dag
// ervoor aan het eind van de dag een melding in zijn agenda krijgt dat die dat mee moet
// nemen").
//
// Wat er misgaat zonder dit: de inmeter staat voor de deur zonder stalenboek, of hij
// weet niet dat de klant het oude scherm gedemonteerd wil hebben. De opmerking staat
// in de RP-lead en de productsoort in de offerte, maar allebei ziet hij pas ter plekke.
//
// Twee keuzes die niet vanzelf spreken:
//  1. "De dag ervoor" bestaat niet altijd. Joey werkt geen woensdag en vrijdag, dus een
//     melding op woensdag ziet hij niet. Daarom: zijn LAATSTE WERKDAG vóór de afspraak,
//     15 minuten voor het einde van zijn rooster (nu 14:45, want ze werken tot 15:00).
//  2. Het blok krijgt GEEN deelnemers en staat op Vrij. Een agenda-item mét deelnemer
//     wordt door cron-outlook-planado-sync.js als klus gezien en zou een spook-opdracht
//     in Planado maken; een blok op Bezet zou een plangat opvreten.
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

// ── tijd in Nederland ───────────────────────────────────────────────────────
// Outlook krijgt alles in UTC aangeleverd (zo doet de rest van de keten het ook), maar
// het rooster staat in Nederlandse klokstand. Zomertijd zit daar twee uur tussen.
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
/** Date → 'YYYY-MM-DD' zoals de dag in Nederland heet. */
const nlDatum = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const nlTijd = (d) => new Date(d).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
const nlDagNaam = (datum) => new Date(datum + 'T12:00:00Z').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
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
    const eind = u * 60 + m;
    const start = eind - REGELS.meldingMinutenVoorEind;
    const hhmm = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
    return { datum, van: hhmm(start), tot: hhmm(start + REGELS.duurMin), dagErvoor: i === 0 };
  }
  return null;
}

// ── wat moet er mee? ────────────────────────────────────────────────────────
function bepaalMeenemen(producten) {
  const tekst = producten.join(' | ').toLowerCase();
  const geraakt = [];
  for (const cat of REGELS.categorieen) {
    const woord = cat.trefwoorden.find((t) => tekst.includes(t.toLowerCase()));
    if (woord) geraakt.push({ categorie: cat.naam, trefwoord: woord, meenemen: cat.meenemen });
  }
  return geraakt;
}

/**
 * Onderwerp en tekst van het agendablok. Apart gehouden zodat de test hem los kan
 * draaien op echte leads zonder Planado en Outlook aan te raken.
 */
function bouwMelding({ naam, inmeter, adres, aankomst, afspraakDatum, moment, geraakt, opmerking, klantOpmerkingen }) {
  const redenen = [
    ...geraakt.map((g) => `${g.categorie} (${g.trefwoord})`),
    ...(opmerking ? ['opmerking bij de offerte'] : []),
    ...(klantOpmerkingen.length ? ['opmerking doorgegeven door de klant'] : []),
  ];
  const spullen = [...new Set([...(REGELS.altijdMee || []), ...geraakt.flatMap((g) => g.meenemen)])];
  const wanneer = moment.dagErvoor ? 'morgen' : nlDagNaam(afspraakDatum);
  const onderwerp = `MEENEMEN ${moment.dagErvoor ? 'morgen' : 'op ' + nlDagNaam(afspraakDatum)} — ${naam} (${inmeter})`;
  const tekst = [
    `Inmeten ${wanneer} ${nlTijd(aankomst)} bij ${naam}`,
    adres ? adres + '\n' : '',
    'Waarom deze melding: ' + redenen.join(', '),
    spullen.length ? '\nMeenemen:\n' + spullen.map((s) => '- ' + s).join('\n') : '',
    opmerking ? `\nOpmerking bij de offerte:\n${opmerking}` : '',
    klantOpmerkingen.length ? '\nDoorgegeven door de klant:\n' + klantOpmerkingen.map((s) => '- ' + s).join('\n') : '',
    '\n(automatisch gezet door de meeneem-melding; blok staat op Vrij en blokkeert geen planning)',
  ].filter((r) => r !== '').join('\n');
  return { onderwerp, tekst, redenen, spullen };
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

async function rpLead(itemId) {
  try {
    const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${SALES_BACKLOG}/items/${itemId}`, {
      headers: { Authorization: 'Bearer ' + RP_API_KEY },
    });
    if (!r.ok) return null;
    const item = (await r.json()).item;
    const d = item?.description || '';
    const opmerking = (d.match(/^Opmerking:\s*(.+)$/im) || [])[1]?.trim() || '';
    const producten = [...d.matchAll(/^(\d+)x\s+(.+?):?\s*$/gim)].map((m) => `${m[1]}x ${m[2].trim()}`);
    return { opmerking, producten };
  } catch {
    return null;
  }
}

/** De producten zoals de planner ze in de opdracht heeft gezet. */
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
async function zetBlok(OH, calId, { onderwerp, start, eind, tekst }) {
  const owaTijd = (d) => ({ DateTime: new Date(d).toISOString().slice(0, 19), TimeZone: 'UTC' });
  const r = await fetch(`https://outlook.office.com/api/v2.0/me/calendars/${calId}/events`, {
    method: 'POST', headers: OH,
    body: JSON.stringify({
      Subject: onderwerp,
      Start: owaTijd(start), End: owaTijd(eind),
      Body: { ContentType: 'Text', Content: tekst },
      // GEEN Attendees: anders maakt de Outlook→Planado-sync er een opdracht van.
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
  try { await fetch('https://outlook.office.com/api/v2.0/me/events/' + id, { method: 'DELETE', headers: owaHeaders() }); } catch { /* al weg */ }
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

  const nieuw = [];
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

    // Producten en opmerking: liefst uit de RP-lead (daar staat het veld "Opmerking",
    // dat nergens anders terechtkomt), anders uit de opdracht-omschrijving.
    const lead = rpItemId ? await rpLead(rpItemId) : null;
    const producten = (lead?.producten?.length ? lead.producten : productenUitOmschrijving(omschrijving));
    const opmerking = lead?.opmerking
      || (omschrijving.match(/OPMERKING BIJ DE OFFERTE:\n(.+)/) || [])[1]?.trim()
      || '';
    // Wat de klant onderweg heeft doorgegeven staat al als LET OP-blok in de opdracht.
    const klantOpmerkingen = (omschrijving.match(/LET OP \(doorgegeven door de klant\):\n([\s\S]*)$/) || [])[1]
      ?.split('\n').filter((r) => r.trim().startsWith('-')).map((r) => r.replace(/^-\s*/, '').trim()) || [];

    const geraakt = bepaalMeenemen(producten);
    if (!geraakt.length && !opmerking && !klantOpmerkingen.length) continue;

    const moment = meldMoment(inmeter, afspraakDatum);
    if (!moment) { console.log(`  ! ${naam}: geen werkdag van ${inmeter} vóór ${afspraakDatum} gevonden`); continue; }
    if (moment.datum < vandaag) {
      console.log(`  ! ${naam} (${afspraakDatum}): meldmoment ${moment.datum} is al voorbij — te laat om nog in de agenda te zetten`);
      continue;
    }

    const { onderwerp, tekst, redenen, spullen } = bouwMelding({
      naam, inmeter, adres, aankomst: job.scheduled_at, afspraakDatum, moment, geraakt, opmerking, klantOpmerkingen,
    });

    const start = nlNaarUtc(moment.datum, moment.van);
    const eind = nlNaarUtc(moment.datum, moment.tot);
    const vinger = JSON.stringify({ afspraakDatum, start: +start, onderwerp, tekst });
    const bestaand = state.blokken[j.uuid];
    if (bestaand && bestaand.vinger === vinger) { continue; }

    console.log(`  ${bestaand ? '~' : '+'} ${moment.datum} ${moment.van} → ${naam} (${inmeter}, afspraak ${afspraakDatum}): ${redenen.join(', ')}`);
    if (!EXECUTE) { nieuw.push({ naam, inmeter, moment, redenen, spullen }); continue; }

    const OH = owaHeaders();
    const calId = await kalenderId(OH);
    if (bestaand?.eventId) await verwijderBlok(OH, bestaand.eventId);
    const eventId = await zetBlok(OH, calId, { onderwerp, start, eind, tekst });
    state.blokken[j.uuid] = { eventId, vinger, melddag: moment.datum, afspraakDatum, inmeter, naam, gezetOp: new Date().toISOString() };
    nieuw.push({ naam, inmeter, moment, redenen, spullen });
  }

  // Afspraak weg? Dan hoort het meeneem-blok ook weg.
  const levendeUuids = new Set(jobs.map((j) => j.uuid));
  for (const [uuid, b] of Object.entries(state.blokken)) {
    if (levendeUuids.has(uuid) || b.afspraakDatum <= vandaag) continue;
    console.log(`  - blok weg voor ${b.naam} (afspraak ${b.afspraakDatum} bestaat niet meer)`);
    if (!EXECUTE) continue;
    await verwijderBlok(owaHeaders(), b.eventId);
    delete state.blokken[uuid];
  }

  if (EXECUTE) fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`\n${nieuw.length} meeneem-melding(en) ${EXECUTE ? 'gezet' : 'zou ik zetten'}`);

  if (EXECUTE && nieuw.length && REGELS.ookNaarTelegram) {
    const { planningTelegram } = require('./lib/telegram-planning.js');
    const regels = nieuw.map((n) => `- ${n.moment.datum} ${n.moment.van}: ${n.naam} (${n.inmeter}) — ${n.redenen.join(', ')}`);
    await planningTelegram(`🧰 Meeneem-melding in de agenda gezet:\n${regels.join('\n')}`);
  }
}

// Alleen draaien als hij zelf wordt aangeroepen; de test laadt dit bestand als module.
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });

module.exports = { meldMoment, bepaalMeenemen, bouwMelding, nlNaarUtc, nlDatum, nlDagNaam, productenUitOmschrijving };
