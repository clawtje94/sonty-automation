// Scenario-lab: TAALPOORT (31-08). Orakel: O1 Engels klantbericht + Nederlands antwoord (of andersom) → blokkeren;
// O2 zelfde taal → door; O3 twijfel (kort/mix/onbekend) → door (poort mag geen goede antwoorden tegenhouden).
const { combinaties } = require('../matrix.js');
const { taalMismatch } = require('../../scripts/lib/taal-check.js');
const K = {
  'en-lang': "Hi, I don't agree with the offer, the price is high and I would like you to come and see the location first. Kind regards",
  'en-kort': "Can you come on Monday please?",
  'nl-lang': "Hoi, wij kunnen alleen op maandag want we werken in het onderwijs. Kunnen jullie dan komen? Alvast bedankt, groetjes",
  'nl-kort': "Kan het op maandag?",
  'overwegend-en': "Hi, bedankt! Monday is fine, can you come please?", 'echte-mix': "Ja hi, monday is goed, en bedankt thanks", 'leeg': "Ok",
};
const A = {
  'nl': "Hoi, wat fijn dat je vertrouwen in ons hebt. Zodra je akkoord geeft, neemt de planning contact met je op om de afspraak in te plannen. Groetjes, Sunny",
  'en': "Hi, thank you for your message. Our planning colleague will contact you to schedule the appointment. Kind regards, Sunny",
};
const dims = [
  { naam: 'klant', waarden: Object.keys(K).map((k) => ({ label: k })) },
  { naam: 'antwoord', waarden: Object.keys(A).map((k) => ({ label: k })) },
];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  // overwegend Engels telt als Engels (dat is juist het Judith-geval); echte 50/50-mix en te kort = twijfel → door
  const kt = s.klant.label.startsWith('en') || s.klant.label === 'overwegend-en' ? 'en' : s.klant.label.startsWith('nl') ? 'nl' : 'twijfel';
  const blok = kt !== 'twijfel' && kt !== s.antwoord.label;
  return { wil: blok ? 'blokkeer' : 'ok', blok };
}
function voerUit(s) { return { blok: taalMismatch(K[s.klant.label], A[s.antwoord.label]), melding: false }; }
function vergelijk(w, e) { return w.blok === e.blok; }
module.exports = { naam: 'taal-poort (Engels klantbericht krijgt nooit een Nederlands antwoord en andersom)', scenarios, orakel, voerUit, vergelijk };
