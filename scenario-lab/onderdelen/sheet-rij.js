// Onderdeel: de juiste rij in de offerte-sheet vinden (vindRijEnKolommen).
// Orakel (sheet-regels uit de memory):
//  - Gripp-nummer in kolom "Nummer" is de eerste sleutel, telefoon (laatste 9) de tweede
//  - NOOIT op naam koppelen
//  - kolomindexen verschillen per tab → headerrij (rij 3) is leidend
//  - niets gevonden → null (caller maakt dan een nieuwe rij + melding)
const { combinaties } = require('../matrix.js');
const { vindRijEnKolommen } = require('../../scripts/lib/sheet-inplannen.js');

function maakTab(titel, verschuif, klantRij) {
  const kop = Array(30).fill('');
  kop[2] = 'Naam klant';
  kop[10 + verschuif] = 'Telefoon';
  kop[19 + verschuif] = 'Nummer';
  kop[22 + verschuif] = 'inkooop incl btw';
  const leeg = Array(30).fill('');
  const rijen = [Array(30).fill(''), Array(30).fill(''), kop, leeg.slice()];
  if (klantRij) {
    const r = Array(30).fill('');
    r[2] = klantRij.naam || '';
    r[10 + verschuif] = klantRij.telefoon || '';
    r[19 + verschuif] = klantRij.nummer || '';
    rijen.push(r);
  }
  return { titel, rijen };
}

const dimensies = [
  {
    naam: 'klant-in-sheet',
    waarden: [
      { label: 'op-grippnr', rij: { naam: 'jan test', nummer: '6392', telefoon: 'Zie gripp' }, zoek: { grippNr: 6392, telefoon: '+31612345678' }, wil: 'gevonden' },
      { label: 'grippnr-met-haakjes', rij: { naam: 'jan test', nummer: '(6392)', telefoon: '' }, zoek: { grippNr: 6392, telefoon: null }, wil: 'gevonden' },
      { label: 'op-telefoon', rij: { naam: 'andere spelling', nummer: '', telefoon: '06 1234 5678' }, zoek: { grippNr: 7777, telefoon: '+31612345678' }, wil: 'gevonden' },
      { label: 'zelfde-naam-ander-nummer', rij: { naam: 'jan test', nummer: '5555', telefoon: '0699999999' }, zoek: { grippNr: 6392, telefoon: '+31612345678' }, wil: 'niks' },
      { label: 'staat-er-niet', rij: null, zoek: { grippNr: 6392, telefoon: '+31612345678' }, wil: 'niks' },
      { label: 'leeg-telefoonveld-geen-vals-match', rij: { naam: 'x', nummer: '', telefoon: '' }, zoek: { grippNr: null, telefoon: '+31612345678' }, wil: 'niks' },
    ],
  },
  {
    naam: 'tab',
    waarden: [
      { label: 'normale-kolommen', verschuif: 0, titel: 'Aug 2026' },
      { label: 'verschoven-kolommen', verschuif: 1, titel: 'Juli 2026' },
      { label: 'trailing-spatie-titel', verschuif: 0, titel: 'Juni 2026 ' },
    ],
  },
];

module.exports = {
  naam: 'sheet-rij (offerte-sheet: rij vinden zonder naam-koppeling)',
  scenarios: () => combinaties(dimensies),
  orakel: (s) => ({ wil: s['klant-in-sheet'].wil }),
  voerUit: async (s) => {
    const tab = maakTab(s.tab.titel, s.tab.verschuif, s['klant-in-sheet'].rij);
    const plek = vindRijEnKolommen([tab], s['klant-in-sheet'].zoek);
    // niet gevonden is zichtbaar: de schrijver maakt dan een nieuwe rij én meldt het
    return { plek, melding: plek === null };
  },
  vergelijk: (wil, echt) => (wil.wil === 'gevonden' ? echt.plek !== null : echt.plek === null),
};
