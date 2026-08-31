// Scenario-lab: TELEGRAM-ROUTERING (31-08). Orakel: O1 boeking → alleen planning-groep; O2 elk ander bericht
// bereikt ALTIJD de data-bot (nooit meer stil onderdrukt); O3 vraag (V-nummer)/alarm/urgent/rapport → ook hoofdchat;
// O4 kale procesmelding → alleen data-bot (hoofdchat blijft stil, dat was Daimy's 11-08-wens).
const { combinaties } = require('../matrix.js');
const { routeer } = require('../../scripts/lib/telegram-filter.js');
const T = {
  boeking: ['GEBOEKT: Jan Jansen ma 12 okt 09:00 (Joey)', { boeking: true }],
  vraag: ['VRAAG V9: mag ik dit zo doen?', {}],
  alarm: ['48 klant(en) wachten al langer op ons antwoord: ...', {}],
  urgent: ['🚨 3 escalatie(s) zonder reactie van een collega', {}],
  rapport: ['📊 dagrapport: 12 gesprekken', {}],
  proces: ['Inmeet-planner (schaduw): 1 nieuwe klant op de planlijst', {}],
  annulering: ['Inmeten Elvis vr 4 sept geannuleerd: nieuwe pui komt later', {}],
};
const dims = [{ naam: 'soort', waarden: Object.keys(T).map((k) => ({ label: k })) }];
function scenarios() { return combinaties(dims); }
function orakel(s) {
  const k = s.soort.label;
  if (k === 'boeking') return { wil: 'ok', best: 'planning-groep' };
  const hoofd = ['vraag', 'alarm', 'urgent', 'rapport', 'annulering'].includes(k);
  return { wil: 'ok', best: hoofd ? 'data-bot+hoofdchat' : 'data-bot' };
}
function voerUit(s) {
  const [tekst, opties] = T[s.soort.label];
  const r = routeer(tekst, opties);
  return { best: r.bestemmingen.join('+'), melding: false };
}
function vergelijk(w, e) { return w.best === e.best; }
module.exports = { naam: 'telegram-route (data-bot verhongert nooit meer; alarmen/vragen ook naar hoofdchat; boekingen alleen planning-groep)', scenarios, orakel, voerUit, vergelijk };
