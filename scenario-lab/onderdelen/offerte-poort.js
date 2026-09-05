// Scenario-lab: OFFERTE-POORT (05-09). Orakel: O1 e-mail met productbedrag zonder offerte (niet gemaakt in
// deze beurt, en geen bestaande offerte die benoemd wordt) → blokkeren; O2 offerte in deze beurt gemaakt/
// aangepast → door; O3 bestaande offerte + het woord "offerte" in de mail → door (toelichting mag);
// O4 vaste beleidsbedragen (€75 inmeetregel, €25 Máxima) en bedragen < €100 zijn geen prijs → door;
// O5 WhatsApp valt buiten deze poort → altijd door.
const { combinaties } = require('../matrix.js');
const { beoordeel } = require('../../scripts/lib/offerte-poort.js');

const BEDRAGEN = [25, 75, 99, 100, 195, 360, 1414.8, 2403, 12500];
const FORMATEN = {
  'euro-teken': (n) => '€' + nl(n),
  'euro-spatie': (n) => '€ ' + nl(n),
  'woord-euro': (n) => nl(n) + ' euro',
  'eur-prefix': (n) => 'EUR ' + nl(n),
  'engels': (n) => '€' + n.toLocaleString('en-US', { minimumFractionDigits: 2 }),
};
function nl(n) { return n.toLocaleString('nl-NL', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }); }
const OMLIJSTING = {
  'kaal': (b) => 'Hoi Peter,\n\nVoor een screen van 300 x 250 cm kom je op ' + b + ' inclusief btw en montage.\n\nMet vriendelijke groet,\nSunny | Sonty',
  'met-offerte-woord': (b) => 'Hoi Peter,\n\nIn je offerte 202612048 staat het screen voor ' + b + ' inclusief btw en montage.\n\nMet vriendelijke groet,\nSunny | Sonty',
  'met-75-regel': (b) => 'Hoi Peter,\n\nDe prijs komt op ' + b + '. Ga je na het inmeten niet met ons verder, dan brengen we €75 in rekening.\n\nMet vriendelijke groet,\nSunny | Sonty',
};
const TEKSTEN = { 'geen-bedrag': { tekst: 'Hoi Peter,\n\nMag ik je adres en telefoonnummer? Dan maak ik de offerte meteen en stuur ik hem per mail.\n\nMet vriendelijke groet,\nSunny | Sonty', prijs: false, offerteWoord: true } };
for (const n of BEDRAGEN) for (const [f, fmt] of Object.entries(FORMATEN)) for (const [o, wrap] of Object.entries(OMLIJSTING)) {
  TEKSTEN[n + '|' + f + '|' + o] = { tekst: wrap(fmt(n)), prijs: n >= 100 && n !== 75 && n !== 25, offerteWoord: o === 'met-offerte-woord' };
}
const dims = [
  { naam: 'tekst', waarden: Object.keys(TEKSTEN).map((k) => ({ label: k })) },
  { naam: 'kanaal', waarden: [{ label: 'EMAIL' }, { label: 'WA' }] },
  { naam: 'gemaakt', waarden: [{ label: 'ja', v: true }, { label: 'nee', v: false }] },
  { naam: 'bekend', waarden: [{ label: 'ja', v: true }, { label: 'nee', v: false }] },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const t = TEKSTEN[s.tekst.label];
  const blok = s.kanaal.label === 'EMAIL' && t.prijs && !s.gemaakt.v && !(s.bekend.v && t.offerteWoord);
  return { wil: blok ? 'blokkeer' : 'ok', blok };
}
function voerUit(s) {
  const r = beoordeel({ tekst: TEKSTEN[s.tekst.label].tekst, kanaal: s.kanaal.label, offerteGemaakt: s.gemaakt.v, offerteBekend: s.bekend.v });
  return { blok: r.blok, reden: r.reden, melding: r.blok };
}
function vergelijk(w, e) { return w.blok === e.blok; }
module.exports = { naam: 'offerte-poort (per e-mail nooit alleen een prijs, altijd een offerte erbij)', scenarios, orakel, voerUit, vergelijk };
