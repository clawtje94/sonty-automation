// Scenario-lab: NA-VERZENDBESLUIT E-MAIL (05-09, casus Kortenbout). Orakel: O1 verzending mislukt → nooit
// sluiten, altijd Mens nodig + notitie + Telegram, ongeacht wat de sluitpoort zegt; O2 verstuurd en poort
// zegt sluiten → sluiten; O3 verstuurd, poort zegt niet sluiten: service → alleen open, anders Mens nodig + notitie.
const { combinaties } = require('../matrix.js');
const { naVerzending } = require('../../scripts/lib/mail-verzend-besluit.js');
const dims = [
  { naam: 'verstuurd', waarden: [{ label: 'ja', v: true }, { label: 'nee', v: false }] },
  { naam: 'poort', waarden: [
    { label: 'mag-sluiten', v: { mag: true } },
    { label: 'service', v: { mag: false, soort: 'service', reden: 'servicemelding' } },
    { label: 'belofte', v: { mag: false, soort: 'belofte', reden: 'belofte aan klant' } },
    { label: 'escalatie', v: { mag: false, soort: 'escalatie', reden: 'escalatie' } },
    { label: 'geen-poort', v: null },
  ] },
  { naam: 'antwoord', waarden: [{ label: 'kort' }, { label: 'lang' }, { label: 'met-offerte' }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  if (!s.verstuurd.v) return { wil: 'blokkeer', sluiten: false, mensNodig: true, notitie: true, telegram: true };
  const p = s.poort.v;
  if (p && !p.mag) return { wil: 'ok', sluiten: false, mensNodig: p.soort !== 'service', notitie: p.soort !== 'service', telegram: false };
  return { wil: 'ok', sluiten: true, mensNodig: false, notitie: false, telegram: false };
}
function voerUit(s) { const r = naVerzending({ verstuurd: s.verstuurd.v, poort: s.poort.v }); return { ...r, melding: r.telegram || r.notitie }; }
function vergelijk(w, e) { return ['sluiten', 'mensNodig', 'notitie', 'telegram'].every((k) => w[k] === e[k]); }
module.exports = { naam: 'verzend-mislukt (mislukte e-mail sluit nooit het ticket: open + Mens nodig + notitie + Telegram)', scenarios, orakel, voerUit, vergelijk };
