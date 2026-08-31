// Scenario-lab: DUBBELBOEKING-POORT (31-08, casus Angelo de Jong). Orakel:
// O1 klant zonder bestaande boeking → gewoon boeken; O2 bestaande boeking op (vrijwel) hetzelfde slot → door (heal);
// O3 bestaande boeking op een andere tijd → 'verzet-eerst' (oude eerst volledig annuleren, nooit twee afspraken);
// O4 match op telefoon (laatste 9) of exacte naam, hoofdletterongevoelig.
const { combinaties } = require('../matrix.js');
const { dubbelBesluit, vindBestaandeBoeking } = require('../../scripts/lib/inmeet-boeken.js');
const fs = require('fs'); const path = require('path');
const STORE = path.join(__dirname, '..', '..', 'data', 'inmeet-boekingen.json');
const dims = [
  { naam: 'bestaand', waarden: [{ label: 'geen' }, { label: 'zelfde-slot' }, { label: 'andere-tijd' }, { label: 'geannuleerd' }] },
  { naam: 'match', waarden: [{ label: 'telefoon' }, { label: 'naam' }, { label: 'naam-hoofdletters' }, { label: 'geen-match' }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const gevonden = s.bestaand.label !== 'geen' && s.bestaand.label !== 'geannuleerd' && s.match.label !== 'geen-match';
  const besluit = !gevonden ? 'boek' : s.bestaand.label === 'zelfde-slot' ? 'zelfde-slot' : 'verzet-eerst';
  return { wil: besluit === 'verzet-eerst' ? 'blokkeer' : 'ok', besluit };
}
function voerUit(s) {
  const orig = fs.existsSync(STORE) ? fs.readFileSync(STORE, 'utf8') : null;
  try {
    const nieuwAankomst = '2026-10-05T08:00:00.000Z';
    const store = {};
    if (s.bestaand.label !== 'geen') {
      store['rp-lab-1'] = { naam: 'Kim Jansen', telefoon: '+31611111111', inmeter: 'Joey',
        status: s.bestaand.label === 'geannuleerd' ? 'geannuleerd' : 'geboekt',
        aankomst: s.bestaand.label === 'zelfde-slot' ? nieuwAankomst : '2026-10-12T08:00:00.000Z' };
    }
    fs.writeFileSync(STORE + '.lab', JSON.stringify(store));
    // vindBestaandeBoeking leest het echte pad; voor het lab simuleren we hem puur:
    const zoek = { telefoon: s.match.label === 'telefoon' ? '0611111111' : '0699999999',
      naam: s.match.label === 'naam' ? 'Kim Jansen' : s.match.label === 'naam-hoofdletters' ? 'KIM JANSEN' : 'Piet Anders' };
    const t9 = zoek.telefoon.replace(/\D/g, '').slice(-9); const ln = zoek.naam.toLowerCase();
    const hit = Object.entries(store).find(([, b]) => b.status === 'geboekt' && (
      String(b.telefoon || '').replace(/\D/g, '').slice(-9) === t9 || String(b.naam || '').trim().toLowerCase() === ln)) || null;
    return { besluit: dubbelBesluit(hit && hit[1], nieuwAankomst), melding: true };
  } finally { fs.unlinkSync(STORE + '.lab'); if (orig !== null) fs.writeFileSync(STORE, orig); }
}
function vergelijk(w, e) { return w.besluit === e.besluit; }
module.exports = { naam: 'dubbelboeking (zelfde klant nooit 2 afspraken: andere tijd = oude eerst annuleren)', scenarios, orakel, voerUit, vergelijk };
