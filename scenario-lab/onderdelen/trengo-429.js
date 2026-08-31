// Scenario-lab: 429-ALARMREGEL (opdracht Isa 31-08; drempel omhoog 31-08 avond, Daimy wil minder berichten).
// Orakel: O1 alarm alléén bij >= 60 429's binnen 15 min; O2 daarna hoogstens 1 alarm per 6 uur; O3 oude fouten (>15 min) tellen niet mee.
const { combinaties } = require('../matrix.js');
const { moetAlarmeren } = require('../../scripts/lib/trengo-fetch.js');
const NU = 1000 * 60 * 60 * 24 * 400; // vast "nu" (geen Date.now in het lab)
const dims = [
  { naam: 'aantal', waarden: [{ label: '0', n: 0 }, { label: '59', n: 59 }, { label: '60', n: 60 }, { label: '90', n: 90 }] },
  { naam: 'leeftijd', waarden: [{ label: 'vers', ms: 60000 }, { label: 'oud', ms: 20 * 60000 }] },
  { naam: 'laatsteAlarm', waarden: [{ label: 'nooit', t: 0 }, { label: '2-uur-terug', t: NU - 2 * 3600000 }, { label: '7-uur-terug', t: NU - 7 * 3600000 }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const meetellend = s.leeftijd.label === 'vers' ? s.aantal.n : 0;
  const genoeg = meetellend >= 60;
  const magWeer = s.laatsteAlarm.label !== '2-uur-terug';
  return { wil: genoeg && magWeer ? 'ok' : 'blokkeer', alarm: genoeg && magWeer };
}
function voerUit(s) {
  const tijden = Array.from({ length: s.aantal.n }, () => NU - s.leeftijd.ms);
  return { alarm: moetAlarmeren(tijden, NU, s.laatsteAlarm.t || 0), melding: false };
}
function vergelijk(w, e) { return w.alarm === e.alarm; }
module.exports = { naam: 'trengo-429 (alarmdrempel 60/kwartier, max 1 alarm per 6 uur, oude fouten vervallen)', scenarios, orakel, voerUit, vergelijk };
