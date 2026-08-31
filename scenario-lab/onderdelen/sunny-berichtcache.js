// Scenario-lab: BERICHTEN-CACHE SUNNY-RONDE (31-08). Orakel: O1 cache alleen binnen 75s; O2 nieuwer
// latest_message in de lijst → cache ongeldig; O3 lege cache of ontbrekende msgs → nooit cache;
// O4 ticket zonder latest-veld → binnen TTL wel cache (notitie-sweep en TTL vangen de rest).
const { combinaties } = require('../matrix.js');
const { magBerichtCache } = require('../../scripts/ai-ks/daemon.js');
const NU = 1700000000000;
const dims = [
  { naam: 'entry', waarden: [{ label: 'geen', e: null }, { label: 'zonder-msgs', e: { op: NU - 1000, latest: 'a', msgs: null } }, { label: 'vers', e: { op: NU - 30000, latest: 'a', msgs: { data: [1] } } }, { label: 'oud', e: { op: NU - 80000, latest: 'a', msgs: { data: [1] } } }] },
  { naam: 'lijst', waarden: [{ label: 'zelfde', t: { latest_message: 'a' } }, { label: 'nieuwer', t: { latest_message: 'b' } }, { label: 'geen-veld', t: {} }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const geldig = s.entry.label === 'vers' && (s.lijst.label === 'zelfde' || s.lijst.label === 'geen-veld');
  return { wil: geldig ? 'ok' : 'blokkeer', cache: geldig };
}
function voerUit(s) { return { cache: magBerichtCache(s.entry.e, s.lijst.t, NU), melding: false }; }
function vergelijk(w, e) { return w.cache === e.cache; }
module.exports = { naam: 'sunny-berichtcache (75s TTL, ongeldig bij nieuwer bericht, nooit zonder msgs)', scenarios, orakel, voerUit, vergelijk };
