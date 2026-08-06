// Onderdeel: de juiste rij in de offerte-sheet vinden (vindRijEnKolommen).
// Orakel (sheet-regels + KETEN-MOMENT-LES van Daimy 06-08: "Gripp wordt daarna pas
// ingevuld" — de dimensie 'welke data bestaat op dit punt in de keten al?' hoort in
// elke test):
//  - RP-offertenummer (kolom "RP offerte") is de EERSTE sleutel — die bestaat altijd
//  - telefoon (laatste 9) tweede, Gripp-nummer derde (bestaat pas na "Gripp invullen")
//  - NOOIT op naam koppelen; kolommen altijd via de headerrij; niets = null + melding
const { combinaties } = require('../matrix.js');
const { vindRijEnKolommen } = require('../../scripts/lib/sheet-inplannen.js');

function maakTab(titel, verschuif, klantRij, zonderRpKolom) {
  const kop = Array(30).fill('');
  kop[2] = 'Naam klant';
  kop[6 + verschuif] = zonderRpKolom ? '€ 2,00' : 'RP offerte'; // Jan 2026 heeft een kapotte kop
  kop[10 + verschuif] = 'Telefoon nummer';
  kop[19 + verschuif] = 'Nummer';
  kop[22 + verschuif] = 'inkooop incl btw';
  const leeg = Array(30).fill('');
  const rijen = [Array(30).fill(''), Array(30).fill(''), kop, leeg.slice()];
  if (klantRij) {
    const r = Array(30).fill('');
    r[2] = klantRij.naam || '';
    r[6 + verschuif] = klantRij.rp || '';
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
      { label: 'VROEG-alleen-rp-nummer', rij: { naam: 'jan test', rp: '202610827', telefoon: '31612345678' }, zoek: { rpNummers: ['202610827'], grippNr: null, telefoon: '+31687654321' }, wil: 'gevonden' },
      { label: 'VROEG-rp-plus-titelnummer', rij: { naam: 'jan test', rp: '202626880', telefoon: '' }, zoek: { rpNummers: ['20268411', '202626880'], grippNr: null, telefoon: null }, wil: 'gevonden' },
      { label: 'op-telefoon-zonder-rp', rij: { naam: 'andere spelling', rp: '', telefoon: '06 1234 5678' }, zoek: { rpNummers: ['999999999'], grippNr: null, telefoon: '+31612345678' }, wil: 'gevonden' },
      { label: 'LAAT-op-grippnr', rij: { naam: 'jan test', nummer: '6392', telefoon: 'Zie gripp' }, zoek: { rpNummers: [], grippNr: 6392, telefoon: '+31612345678' }, wil: 'gevonden' },
      { label: 'zelfde-naam-alles-anders', rij: { naam: 'jan test', rp: '111111111', nummer: '5555', telefoon: '0699999999' }, zoek: { rpNummers: ['202610827'], grippNr: 6392, telefoon: '+31612345678' }, wil: 'niks' },
      { label: 'staat-er-niet', rij: null, zoek: { rpNummers: ['202610827'], grippNr: 6392, telefoon: '+31612345678' }, wil: 'niks' },
      { label: 'leeg-telefoonveld-geen-vals-match', rij: { naam: 'x', rp: '', nummer: '', telefoon: '' }, zoek: { rpNummers: [], grippNr: null, telefoon: '+31612345678' }, wil: 'niks' },
    ],
  },
  {
    naam: 'tab',
    waarden: [
      { label: 'normale-kolommen', verschuif: 0, titel: 'Aug 2026' },
      { label: 'verschoven-kolommen', verschuif: 1, titel: 'Juli 2026' },
      { label: 'trailing-spatie-titel', verschuif: 0, titel: 'Juni 2026 ' },
      { label: 'oude-tab-kapotte-rp-kop', verschuif: 0, titel: 'Jan 2026', zonderRp: true },
    ],
  },
];

module.exports = {
  naam: 'sheet-rij (offerte-sheet: rij vinden zonder naam-koppeling)',
  scenarios: () => combinaties(dimensies),
  orakel: (s) => {
    const k = s['klant-in-sheet'];
    if (s.tab.zonderRp && k.wil === 'gevonden') {
      // zonder RP-kolom telt alleen telefoon of Gripp-nummer als sleutel
      const telMatch = k.zoek.telefoon && k.rij?.telefoon
        && String(k.rij.telefoon).replace(/\D/g, '').slice(-9) === String(k.zoek.telefoon).replace(/\D/g, '').slice(-9);
      const grippMatch = k.zoek.grippNr && k.rij?.nummer && String(k.rij.nummer).replace(/\D/g, '') === String(k.zoek.grippNr);
      return { wil: telMatch || grippMatch ? 'gevonden' : 'niks' };
    }
    return { wil: k.wil };
  },
  voerUit: async (s) => {
    const tab = maakTab(s.tab.titel, s.tab.verschuif, s['klant-in-sheet'].rij, s.tab.zonderRp);
    const plek = vindRijEnKolommen([tab], s['klant-in-sheet'].zoek);
    // niet gevonden is zichtbaar: de schrijver maakt dan een nieuwe rij én meldt het
    return { plek, melding: plek === null };
  },
  vergelijk: (wil, echt) => (wil.wil === 'gevonden' ? echt.plek !== null : echt.plek === null),
};
