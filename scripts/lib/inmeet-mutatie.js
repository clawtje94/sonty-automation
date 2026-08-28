const { planadoFetch } = require('./planado-fetch.js');
// DE mutatie-motor voor geboekte inmeetafspraken (ultracode-verkenning 06-08).
// Eén functie voor alle aanleidingen (klant-reply, winkel-knop, AI-klantenservice):
// annuleren of verzetten = alle systemen in één keer, nooit handmatig losse stukken.
//
// Beleid (Daimy 06-08): V1 de vraag "afzeggen of verzetten?" stelt de AANLEIDING
// (AI/winkel) — deze motor voert pas uit bij duidelijke intent. V2 echte annulering
// is zeldzaam: melding aan kantoor, RP blijft staan zodat een mens over nabellen
// beslist. V3 bij annuleren gaat het 1-tje bij inkoop in de sheet weg.
//
// Volgorde bij annuleren (rollback-analyse): Outlook-event EERST weg (anders ziet de
// Outlook→Planado-sync een afspraak zonder job en maakt hem opnieuw aan), dan de
// Planado-job (echt DELETE — de herinnerings-cron filtert alleen op datum), dan
// sheet-cellen leeg, dan states, dan klantbericht.
const fs = require('fs');
const path = require('path');

const BOEKINGEN = process.env.INMEET_BOEKINGEN_PAD || path.join(__dirname, '..', '..', 'data', 'inmeet-boekingen.json');
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, '..', 'planado-api-key.txt'), 'utf8').trim();
const PH = { Authorization: 'Bearer ' + PLANADO_KEY, 'Content-Type': 'application/json', 'X-Planado-Notify-Assignees': 'false' };
const { planningTelegram } = require('./telegram-planning.js');
const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const INMETEN_INPLANNEN = '2e9819bd-26f0-4082-8f18-32bb48f87f54';

const laadBoekingen = () => { try { return JSON.parse(fs.readFileSync(BOEKINGEN, 'utf8')); } catch { return {}; } };
const bewaarBoekingen = (b) => fs.writeFileSync(BOEKINGEN, JSON.stringify(b, null, 2));
const laatste9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);

async function telegram(tekst) {
  await planningTelegram(tekst);
}

/** Bij elke boeking aanroepen: bewaart ALLE sleutels die een rollback nodig heeft. */
function registreerBoeking({ rpItemId, naam, telefoon, email, planadoJobUuid, outlookEventId, grippNr, sheet, slot, duurMin, aanbodToken, bron }) {
  const boekingen = laadBoekingen();
  boekingen[rpItemId] = {
    naam, telefoon, email, planadoJobUuid, outlookEventId: outlookEventId || null,
    grippNr: grippNr || null, sheet: sheet || null,
    aankomst: new Date(slot.aankomst).toISOString(), inmeter: slot.inmeter, duurMin,
    aanbodToken: aanbodToken || null, geboektOp: new Date().toISOString(), status: 'geboekt',
    // 28-08: bron erbij (sunny / klant-reply / winkel / dashboard) — Daimy wil kunnen zien wie boekte
    bron: bron || null,
  };
  bewaarBoekingen(boekingen);
  // wie een (nieuwe) boeking krijgt is klaar met de annuleringslijst
  try { require('./eerder-willen.js').verwijder(rpItemId); } catch { /* lijst is optioneel */ }
}

/** HALVE BOEKING (Daimy 28-08, "geen meerdere boekingen"): zodra de Planado-opdracht bestaat
 *  leggen we dat meteen vast, vóór RP/Gripp/Outlook/sheet. Crasht de keten daarna, dan
 *  hergebruikt de volgende poging dezelfde opdracht in plaats van een tweede te maken. */
function noteerHalveBoeking(rpItemId, { naam, telefoon, planadoJobUuid, aankomst, inmeter }) {
  const boekingen = laadBoekingen();
  if (boekingen[rpItemId]?.status === 'geboekt') return; // echte boeking wint altijd
  boekingen[rpItemId] = { naam, telefoon, planadoJobUuid, aankomst, inmeter, status: 'bezig', sinds: new Date().toISOString() };
  bewaarBoekingen(boekingen);
}
function halveBoeking(rpItemId) {
  const b = laadBoekingen()[rpItemId];
  return b?.status === 'bezig' && b.planadoJobUuid ? b : null;
}
/** Welke bevestigingskanalen zijn aantoonbaar gelukt? De nacontrole herstelt alleen wat ontbreekt. */
function noteerBevestiging(rpItemId, res) {
  const boekingen = laadBoekingen();
  if (!boekingen[rpItemId]) return;
  boekingen[rpItemId].bevestiging = { wa: !!res?.wa?.ok, mail: !!res?.mail?.ok, op: new Date().toISOString() };
  bewaarBoekingen(boekingen);
}

/** Boeking terugvinden op telefoon (laatste 9), e-mail of naam-deel. */
function vindBoeking({ telefoon, email, naam }) {
  const boekingen = laadBoekingen();
  const actief = Object.entries(boekingen).filter(([, b]) => b.status === 'geboekt');
  const tel9 = laatste9(telefoon);
  let hit = tel9.length === 9 ? actief.find(([, b]) => laatste9(b.telefoon) === tel9) : null;
  if (!hit && email) hit = actief.find(([, b]) => String(b.email || '').toLowerCase() === String(email).toLowerCase());
  if (!hit && naam && String(naam).trim().length >= 5) {
    const n = String(naam).toLowerCase();
    const kandidaten = actief.filter(([, b]) => String(b.naam || '').toLowerCase().includes(n) || n.includes(String(b.naam || '').toLowerCase()));
    if (kandidaten.length === 1) hit = kandidaten[0]; // alleen bij ondubbelzinnig
  }
  return hit ? { rpItemId: hit[0], ...hit[1] } : null;
}

/**
 * Annuleer of verzet een geboekte inmeetafspraak.
 * soort: 'annuleer' (klant wil er definitief vanaf) of 'verzet' (klant wil een
 * ander moment: alles opruimen + lead terug in de wachtrij → planner stuurt
 * automatisch een nieuw 3-tijden-aanbod).
 * Geeft { gelukt, stappen: [{stap, ok, detail}] } — deels mislukt = zichtbaar, nooit stil.
 */
async function muteerBoeking(rpItemId, soort, { reden = '', bron = 'onbekend' } = {}) {
  const boekingen = laadBoekingen();
  const b = boekingen[rpItemId];
  if (!b || b.status !== 'geboekt') return { gelukt: false, stappen: [{ stap: 'vinden', ok: false, detail: 'geen actieve boeking' }] };
  const stappen = [];
  const stap = (naam, ok, detail = '') => stappen.push({ stap: naam, ok, detail });

  // 1. Outlook-event weg (vóór Planado, anders maakt de sync hem opnieuw aan)
  if (b.outlookEventId) {
    try {
      const { verwijderOpties } = require('./outlook-opties.js');
      await verwijderOpties([b.outlookEventId]);
      stap('outlook', true);
    } catch (e) { stap('outlook', false, e.message.slice(0, 80)); }
  } else stap('outlook', true, 'geen event-id bekend (oudere boeking)');

  // 2. Planado-job echt verwijderen
  try {
    const r = await planadoFetch('https://api.planadoapp.com/v2/jobs/' + b.planadoJobUuid, { method: 'DELETE', headers: PH });
    stap('planado', r.ok || r.status === 404, 'HTTP ' + r.status);
  } catch (e) { stap('planado', false, e.message.slice(0, 80)); }

  // 2b. ANNULERINGSLIJST (Daimy 07-08, geval Rene): er valt een plek vrij — staat er
  // iemand op de lijst die eerder wil en hier iets aan heeft? Alleen een melding;
  // de winkel klikt zelf op het dashboard. Zichzelf melden heeft geen zin.
  try {
    const { kandidatenVoor, verwijder } = require('./eerder-willen.js');
    verwijder(rpItemId); // wie zijn eigen afspraak annuleert/verzet is geen kandidaat meer
    const kandidaten = kandidatenVoor(b.aankomst).filter((k) => k.rpItemId !== rpItemId);
    if (kandidaten.length) {
      const wanneer = new Date(b.aankomst).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await telegram(`Plek vrijgekomen: ${wanneer} bij ${b.inmeter} (${soort} ${b.naam}).\nWil eerder en kan hier iets aan hebben:\n` +
        kandidaten.slice(0, 3).map((k) => `- ${k.naam} (staat nu op ${new Date(k.wilEerderDan).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })})`).join('\n') +
        '\nBoek of stuur een keuzelink via het inmeet-dashboard.');
      stap('annuleringslijst', true, `${kandidaten.length} kandidaat/kandidaten gemeld`);
    }
  } catch (e) { stap('annuleringslijst', false, e.message.slice(0, 80)); }

  // 3. Sheet: de drie cellen leeg (V3 Daimy: 1-tje weg bij annuleren; bij verzetten
  // ook — de nieuwe boeking schrijft ze straks opnieuw met de nieuwe datum)
  if (b.sheet?.tab && b.sheet?.rij && b.sheet?.kolomInkoop >= 0) {
    try {
      const { maakCellenLeeg } = require('./sheet-inplannen.js');
      await maakCellenLeeg(b.sheet);
      stap('sheet', true);
    } catch (e) { stap('sheet', false, e.message.slice(0, 80)); }
  } else stap('sheet', true, 'geen sheet-locatie bekend');

  // 4. RP + planner-state
  try {
    if (soort === 'verzet') {
      // terug naar "Inmeten inplannen" zodat de planner automatisch nieuw aanbod stuurt;
      // 5-dagen-klok herstart (dit is een nieuwe belofte aan de klant)
      const r = await fetch(`https://backend.reuzenpanda.nl/contact-service/${PID}/backlogs/${BACKLOG_ID}/items/${rpItemId}`, {
        method: 'PATCH', headers: { Authorization: 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { status_id: INMETEN_INPLANNEN } }),
      });
      stap('rp-status', r.ok, r.ok ? 'terug naar Inmeten inplannen' : 'HTTP ' + r.status);
      const STATE = process.env.INMEET_PLANNER_STATE_PAD || path.join(__dirname, '..', '..', 'data', 'inmeten-planner-state.json');
      const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
      delete st.aangeboden?.[rpItemId];
      if (st.gezien) st.gezien[rpItemId] = new Date().toISOString();
      fs.writeFileSync(STATE, JSON.stringify(st, null, 2));
      stap('planner-state', true, 'wachtrij + verse 5-dagen-klok');
    } else {
      // annuleren: RP bewust LATEN STAAN — kantoor beslist over nabellen (V2)
      stap('rp-status', true, 'bewust niet aangeraakt (kantoor beslist)');
    }
  } catch (e) { stap('rp-status', false, e.message.slice(0, 80)); }

  // 5. boekingsrecord bijwerken
  b.status = soort === 'verzet' ? 'verzet' : 'geannuleerd';
  b.mutatie = { soort, reden, bron, op: new Date().toISOString(), stappen };
  bewaarBoekingen(boekingen);

  // 6. klantbericht + kantoor-melding
  const alles = stappen.every((s) => s.ok);
  const datum = new Date(b.aankomst).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  await telegram(
    (soort === 'verzet'
      ? `🔄 Inmeetafspraak VERZET (${bron}): ${b.naam}, was ${datum} bij ${b.inmeter}. Lead staat terug in de wachtrij, nieuw aanbod volgt automatisch.`
      : `🛑 Inmeetafspraak GEANNULEERD (${bron}): ${b.naam}, was ${datum} bij ${b.inmeter}.${reden ? ` Reden: ${reden}.` : ''} RP staat nog op "Gripp invullen" — kantoor beslist over nabellen.`)
    + (alles ? '' : `\n⚠️ Niet alles lukte: ${stappen.filter((s) => !s.ok).map((s) => s.stap + ' (' + s.detail + ')').join(', ')} — even nakijken.`),
  );
  // Ook in de planning-bot-groep (Daimy 22-08: "als een inmeet afspraak word
  // geanuleerd moet dit ook verteld worden in de planning bot groep").
  try {
    const { planningTelegram } = require('./telegram-planning.js');
    // { boeking: true } = de groep; zonder die vlag landt het in de data-bot (Daimy 28-08: "niet in de sonty data bot")
    await planningTelegram(soort === 'verzet'
      ? `🔄 Inmeetafspraak verzet: ${b.naam}, was ${datum} bij ${b.inmeter}. Nieuw aanbod volgt automatisch.`
      : `🛑 Inmeetafspraak geannuleerd: ${b.naam}, was ${datum} bij ${b.inmeter}.${reden ? ` Reden: ${reden}.` : ''}`, { boeking: true });
  } catch { /* planning-melding mag de mutatie nooit blokkeren */ }
  return { gelukt: alles, stappen, boeking: b };
}


/** Staat er al een geboekte afspraak voor deze lead? (dubbelboek-poort, 26-08) */
function heeftGeboekteAfspraak(rpItemId) {
  try {
    const fs2 = require('fs');
    const path2 = require('path');
    const bo = JSON.parse(fs2.readFileSync(path2.join(__dirname, '..', '..', 'data', 'inmeet-boekingen.json'), 'utf8'));
    const al = bo[rpItemId];
    return al?.status === 'geboekt' ? al : null;
  } catch { return null; }
}

module.exports = { heeftGeboekteAfspraak, noteerHalveBoeking, halveBoeking, noteerBevestiging, registreerBoeking, vindBoeking, muteerBoeking, laadBoekingen };
