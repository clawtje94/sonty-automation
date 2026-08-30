// Scenario-lab: OFFERTE-RIJ VOOR EIGEN OFFERTES in het register (blok 1/4 RP-uitzetten, 30-08-2026).
// Orakel: R1 nooit dubbel per offertenummer · R2 testkaart nooit · R3 tab van verzendmaand ontbreekt → niet schrijven, zichtbaar
//         R4 kolommen uit kopregel (ook als de volgorde per tab anders is) · R5 alleen de eerste lege rij ná de laatste gevulde rij.
const { combinaties } = require('../matrix.js');
const { schrijfOfferteRij } = require('../../scripts/lib/sheet-eigen-offerte.js');

const KOP_A = ['Datum of', 'Voornaam', 'Achternaam', 'Woonplaats', 'Telefoon nummer', 'incl btw', 'RP offerte', '2', 'Online', 'Afkomst offerte', 'Wat voor klant', 'Product cat', 'Akkoord', 'Na offerte ', 'Gebeld?', 'Whatsapp'];
// zelfde kolommen, andere volgorde (R4)
const KOP_B = ['Datum of', 'Voornaam', 'Achternaam', 'Telefoon nummer', 'Woonplaats', 'RP offerte', 'incl btw', 'Online', 'Afkomst offerte', 'Product cat', 'Wat voor klant', 'Akkoord', 'Whatsapp'];

function nepClient({ tabs, kop, bestaandeRijen }) {
  const geschreven = [];
  const rijen = [['kop1'], ['kop2'], kop, ...bestaandeRijen];
  return { client: { async tabs() { return tabs; }, async lees() { return rijen; }, async schrijf(tab, bereik, waarden) { geschreven.push({ tab, bereik, waarden }); } }, geschreven };
}

const dims = [
  { naam: 'tab', waarden: [{ label: 'aanwezig', tabs: ['Juli 2026 ', 'Aug 2026', 'Sep 2026'] }, { label: 'ontbreekt', tabs: ['Juli 2026 ', 'Aug 2026'] }] },
  { naam: 'kop', waarden: [{ label: 'standaard', kop: KOP_A }, { label: 'andere-volgorde', kop: KOP_B }] },
  { naam: 'bestaand', waarden: [{ label: 'leeg' }, { label: 'ander-nummer' }, { label: 'zelfde-nummer' }, { label: 'gat-in-midden' }] },
  { naam: 'naam', waarden: [{ label: 'gewoon', vn: 'Kim', an: 'Jansen' }, { label: 'testkaart', vn: 'Kim', an: 'TEST' }] },
  { naam: 'bedrag', waarden: [{ label: '2450', v: 2450 }, { label: 'onbekend', v: null }] },
];

function rijMet(kop, nummer, naam = 'Piet') {
  const r = new Array(kop.length).fill(''); r[kop.indexOf('Datum of')] = '3-9-26'; r[kop.indexOf('Voornaam')] = naam; r[kop.indexOf('RP offerte')] = nummer; return r;
}
function bestaandeRijen(s) {
  const kop = s.kop.kop;
  if (s.bestaand.label === 'leeg') return [];
  if (s.bestaand.label === 'ander-nummer') return [rijMet(kop, '202611234')];
  if (s.bestaand.label === 'zelfde-nummer') return [rijMet(kop, '202611234'), rijMet(kop, 'S26-1042')];
  return [rijMet(kop, '202611234'), new Array(kop.length).fill(''), rijMet(kop, '202611235')]; // gat in het midden: schrijven ná de laatste gevulde rij
}

function scenarios() { return combinaties(dims); }

function orakel(s) {
  if (s.naam.label === 'testkaart') return { wil: 'blokkeer', status: 'testkaart', geschreven: 0 };
  if (s.tab.label === 'ontbreekt') return { wil: 'blokkeer', status: 'geen-tab', geschreven: 0, melding: true };
  if (s.bestaand.label === 'zelfde-nummer') return { wil: 'blokkeer', status: 'bestaat', geschreven: 0 };
  const laatste = { leeg: 0, 'ander-nummer': 1, 'gat-in-midden': 3 }[s.bestaand.label];
  return { wil: 'ok', status: 'geschreven', geschreven: 1, sheetRij: 3 + laatste + 1, nummer: 'S26-1042', bedrag: s.bedrag.v == null ? '' : 2450, kanaal: 'Online' };
}

async function voerUit(s) {
  const { client, geschreven } = nepClient({ tabs: s.tab.tabs, kop: s.kop.kop, bestaandeRijen: bestaandeRijen(s) });
  const res = await schrijfOfferteRij({ nummer: 'S26-1042', datum: '2026-09-03T10:00:00.000Z', voornaam: s.naam.vn, achternaam: s.naam.an, plaats: 'Rijswijk', telefoon: '+31611111111', bedrag: s.bedrag.v, kanaal: 'Online', afkomst: 'Google', klant: 'Prive', product: 'Screens' }, { client });
  const kop = s.kop.kop; const w = geschreven[0] ? geschreven[0].waarden : [];
  return { status: res.status, geschreven: geschreven.length, sheetRij: res.rij, nummer: w[kop.indexOf('RP offerte')], bedrag: w[kop.indexOf('incl btw')], kanaal: w[kop.indexOf('Online')], melding: !!res.melding };
}

function vergelijk(w, e) {
  if (w.status !== e.status || w.geschreven !== e.geschreven) return false;
  if (w.wil !== 'ok') return true;
  return w.sheetRij === e.sheetRij && w.nummer === e.nummer && w.bedrag === e.bedrag && w.kanaal === e.kanaal;
}

module.exports = { naam: 'sheet-eigen-offerte (offerte-rij in het register voor eigen offertes: dubbel, testkaart, tab, kolomvolgorde, lege rij)', scenarios, orakel, voerUit, vergelijk };
