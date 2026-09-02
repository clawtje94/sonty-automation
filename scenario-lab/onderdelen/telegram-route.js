// Scenario-lab: TELEGRAM-ROUTERING (31-08, aangescherpt 01-09: "9/10 berichten niet nodig").
// Orakel: O1 boeking → alleen planning-groep; O2 vraag/alarm/urgent/rapport → data-bot + hoofdchat;
// O3 kale procesmelding → GEEN chat, alleen de onderdrukt-log; O4 herhaald alarm (<6u) → ook alleen de log;
// O5 annuleringen/storingen zitten in de ALARM-regex en komen dus altijd minstens 1x per 6u door.
const { combinaties } = require('../matrix.js');
const fs = require('fs');
const path = require('path');
process.env.TELEGRAM_DEDUP_PAD = path.join(require('os').tmpdir(), 'lab-telegram-dedup.json');
const { routeer } = require('../../scripts/lib/telegram-filter.js');
const T = {
  boeking: ['GEBOEKT: Jan Jansen ma 12 okt 09:00 (Joey)', { boeking: true }],
  vraag: ['VRAAG V9: mag ik dit zo doen?', {}],
  alarm: ['48 klant(en) wachten al langer op ons antwoord: ...', {}],
  alarmHerhaald: ['13 klant(en) wachten al langer op ons antwoord: ...', {}],
  urgent: ['🚨 3 escalatie(s) zonder reactie van een collega', {}],
  rapport: ['📊 dagrapport: 12 gesprekken', {}],
  proces: ['Inmeet-planner (schaduw): 1 nieuwe klant op de planlijst', {}],
  procesVerstuurd: ['📤 Verstuurd naar Jan (mail: ok). Dit kreeg de klant: ...', {}],
  annulering: ['Inmeten Elvis vr 4 sept geannuleerd: nieuwe pui komt later', {}],
  annuleringUitvoering: ['🛑 Annulering van Angelo (klant ziet af) wordt nu automatisch uitgevoerd', {}],
  plekVrij: ['Plek vrijgekomen: di 22 sep 15:30 bij Joey. Kandidaten: ...', {}],
  klantBelofte: ['Judith (Engelstalig): klant is beloofd dat planning morgen belt', {}],
  werkbonnen: ['📋 WERKBONNEN NIET AFGEROND: 7 open van gisteren', {}],
  nacontroleOk: ['📋 Boeking-nacontrole (24u): 2 gecontroleerd — 2 in orde, 0 met open fouten.', {}],
  // 02-09 ("ja 17 berichten gaat het ff")
  testklantAlarm: ['✋ Mirjam Test: automatiek gestopt (max-voorstellen). Mens nodig — pak het gesprek handmatig op', {}],
  mensNodigDigest: ['✋ MENS NODIG — 3 klant(en) wachten op handmatige opvolging: Jacqueline …', {}],
  bundelaar: ['Trengo-bundelaar: 1 dubbele tickets samengevoegd. tel:621638532', {}],
  grippMislukt: ['Gripp invullen: 0 offerte(s) verwerkt, 1 mislukt', {}],
  urgentHerhaald: ['🚨 2 escalatie(s) zonder reactie van een collega', {}],
  vraagOverTest: ['VRAAG V3: mag Mirjam Test uit de testbank?', {}],
};
const dims = [{ naam: 'soort', waarden: Object.keys(T).map((k) => ({ label: k })) }];
function scenarios() { return combinaties(dims); }
// Orakel 02-09: boeking → planning-groep; vraag/urgent → alleen hoofdchat; alarm/rapport → digest (gebundeld);
// testklant, proces en herhaling (alarm <6u, urgent <6u) → geen chat, alleen log.
function orakel(s) {
  const k = s.soort.label;
  if (k === 'boeking') return { wil: 'ok', best: 'planning-groep' };
  if (['alarmHerhaald', 'urgentHerhaald', 'testklantAlarm', 'proces', 'procesVerstuurd', 'nacontroleOk'].includes(k)) return { wil: 'blokkeer', best: 'geen' };
  if (['vraag', 'vraagOverTest', 'urgent'].includes(k)) return { wil: 'ok', best: 'hoofdchat' };
  return { wil: 'ok', best: 'digest' };
}
function voerUit(s) {
  if (['alarm', 'urgent'].includes(s.soort.label)) { try { fs.rmSync(process.env.TELEGRAM_DEDUP_PAD, { force: true }); } catch {} }
  const [tekst, opties] = T[s.soort.label];
  if (['alarmHerhaald', 'urgentHerhaald'].includes(s.soort.label)) routeer(tekst, opties); // eerste keer telt als eerder alarm
  const r = routeer(tekst, opties);
  return { best: r.bestemmingen.join('+') || 'geen', melding: false };
}
function vergelijk(w, e) { return w.best === e.best; }
module.exports = { naam: 'telegram-route (proces en herhaling stil naar log; vraag/alarm/urgent/rapport door; boeking naar groep)', scenarios, orakel, voerUit, vergelijk };
