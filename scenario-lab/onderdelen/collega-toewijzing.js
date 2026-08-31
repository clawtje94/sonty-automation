// Scenario-lab: COLLEGA-TOEWIJZING (Daimy 31-08: handmatige toewijzing aan Nanny werd stil
// teruggezet naar Jorren). Orakel: O1 toewijzen aan de laatste collega mag ALLEEN als het
// gesprek nu van de bot of van niemand is; O2 nooit als Daimy de laatste zender is; O3 nooit
// zonder collega-zender. Een mens die toegewezen staat (Nanny, Jorren, wie dan ook) = afblijven.
const { combinaties } = require('../matrix.js');
const { magCollegaToewijzing } = require('../../scripts/lib/collega-toewijzing.js');
const BOT = 747786;
const dims = [
  { naam: 'huidige', waarden: [{ label: 'niemand', id: 0 }, { label: 'bot', id: BOT }, { label: 'nanny', id: 736329 }, { label: 'jorren', id: 745487 }] },
  { naam: 'laatste', waarden: [{ label: 'geen', id: 0 }, { label: 'bot', id: BOT }, { label: 'daimy', id: 736327 }, { label: 'jorren', id: 745487 }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const collegaStuurde = s.laatste.label === 'jorren';
  const botOfNiemand = s.huidige.label === 'niemand' || s.huidige.label === 'bot';
  const mag = collegaStuurde && botOfNiemand;
  return { wil: mag ? 'ok' : 'blokkeer', toewijzen: mag };
}
function voerUit(s) {
  return { toewijzen: magCollegaToewijzing({ huidigeUserId: s.huidige.id, laatsteUitUserId: s.laatste.id, botUserId: BOT }), melding: false };
}
function vergelijk(w, e) { return w.toewijzen === e.toewijzen; }
module.exports = { naam: 'collega-toewijzing (handmatige toewijzing is heilig, alleen bot/niemand → collega)', scenarios, orakel, voerUit, vergelijk };
