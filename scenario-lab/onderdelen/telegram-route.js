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
};
const dims = [{ naam: 'soort', waarden: Object.keys(T).map((k) => ({ label: k })) }];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const k = s.soort.label;
  if (k === 'boeking') return { wil: 'ok', best: 'planning-groep' };
  if (k === 'alarmHerhaald') return { wil: 'blokkeer', best: 'geen' };
  const hoofd = ['vraag', 'alarm', 'urgent', 'rapport', 'annulering', 'annuleringUitvoering', 'plekVrij', 'klantBelofte', 'werkbonnen'].includes(k);
  return hoofd ? { wil: 'ok', best: 'data-bot+hoofdchat' } : { wil: 'blokkeer', best: 'geen' };
}
function voerUit(s) {
  if (s.soort.label === 'alarm') { try { fs.rmSync(process.env.TELEGRAM_DEDUP_PAD, { force: true }); } catch {} }
  const [tekst, opties] = T[s.soort.label];
  if (s.soort.label === 'alarmHerhaald') routeer(tekst, opties); // eerste keer telt als eerder alarm
  const r = routeer(tekst, opties);
  return { best: r.bestemmingen.join('+') || 'geen', melding: false };
}
function vergelijk(w, e) { return w.best === e.best; }
module.exports = { naam: 'telegram-route (proces en herhaling stil naar log; vraag/alarm/urgent/rapport door; boeking naar groep)', scenarios, orakel, voerUit, vergelijk };
