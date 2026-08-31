// Scenario-lab: 429-ALARMREGEL (opdracht Isa 31-08). Orakel: O1 alarm alléén bij >= 12 429's binnen 15 min;
// O2 daarna hoogstens 1 alarm per uur; O3 oude fouten (>15 min) tellen niet mee.
const { combinaties } = require('../matrix.js');
const { moetAlarmeren } = require('../../scripts/lib/trengo-fetch.js');
const NU = 1000 * 60 * 60 * 24 * 400; // vast "nu" (geen Date.now in het lab)
const dims = [
  { naam: 'aantal', waarden: [{ label: '0', n: 0 }, { label: '11', n: 11 }, { label: '12', n: 12 }, { label: '40', n: 40 }] },
  { naam: 'leeftijd', waarden: [{ label: 'vers', ms: 60000 }, { label: 'oud', ms: 20 * 60000 }] },
  { naam: 'laatsteAlarm', waarden: [{ label: 'nooit', t: 0 }, { label: 'kwartier-terug', t: NU - 15 * 60000 }, { label: '2-uur-terug', t: NU - 2 * 3600000 }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const meetellend = s.leeftijd.label === 'vers' ? s.aantal.n : 0;
  const genoeg = meetellend >= 12;
  const magWeer = s.laatsteAlarm.label !== 'kwartier-terug';
  return { wil: genoeg && magWeer ? 'ok' : 'blokkeer', alarm: genoeg && magWeer };
}
function voerUit(s) {
  const tijden = Array.from({ length: s.aantal.n }, () => NU - s.leeftijd.ms);
  return { alarm: moetAlarmeren(tijden, NU, s.laatsteAlarm.t || 0), melding: false };
}
function vergelijk(w, e) { return w.alarm === e.alarm; }
module.exports = { naam: 'trengo-429 (alarmdrempel 12/kwartier, max 1 alarm/uur, oude fouten vervallen)', scenarios, orakel, voerUit, vergelijk };
