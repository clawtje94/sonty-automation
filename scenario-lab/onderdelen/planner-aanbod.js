// Onderdeel: krijgt elke klant (op tijd) een aanbod? — kiesAanbod + de verre-klant-regel.
// Orakel (beleid, Daimy 06-08 "hoelang wacht je voor je hem toch inplant?"):
//  - dichtbij (≤30 min omrijden): altijd direct aanbod, gespreid over dagen/dagdelen
//  - ver weg + betrouwbare kosten: wachten op een buur mag, maar uiterlijk dag 4
//    (belofte: "planning neemt binnen 5 dagen contact op") gewoon de goedkoopste
//    plekken aanbieden — nooit stil blijven liggen
//  - vuile agenda (kosten onbetrouwbaar): nooit op kosten weigeren
//  - geen gaten in de agenda: geen aanbod, maar mét uitleg (zichtbaar)
const { combinaties } = require('../matrix.js');
const { kiesAanbod, waaromGeenAanbod, MAX_WACHT_DAGEN } = require('../../scripts/lib/slotzoeker.js');

const SLOT = (dag, uur, extra, betrouwbaar = true) => ({
  datum: `2026-09-${String(dag).padStart(2, '0')}`,
  aankomst: new Date(2026, 8, dag, uur, 0),
  extraRijtijdMin: extra,
  kostenBetrouwbaar: betrouwbaar,
});

const dimensies = [
  {
    naam: 'ligging',
    waarden: [
      { label: 'dichtbij', slots: (b) => [SLOT(7, 9, 5, b), SLOT(7, 13, 8, b), SLOT(8, 9, 12, b), SLOT(9, 10, 6, b)] },
      { label: 'randgeval-30min', slots: (b) => [SLOT(7, 9, 30, b), SLOT(8, 9, 30, b), SLOT(9, 9, 31, b)] },
      { label: 'ver-weg', slots: (b) => [SLOT(7, 9, 55, b), SLOT(8, 9, 48, b), SLOT(9, 9, 60, b), SLOT(10, 9, 52, b)] },
      { label: 'geen-gaten', slots: () => [] },
    ],
  },
  {
    naam: 'agenda',
    waarden: [
      { label: 'betrouwbaar', betrouwbaar: true },
      { label: 'vuil', betrouwbaar: false },
    ],
  },
  {
    naam: 'wacht',
    waarden: [
      { label: 'nieuw', dagen: 0 },
      { label: '3-dagen', dagen: 3 },
      { label: '4-dagen-deadline', dagen: 4 },
      { label: '10-dagen', dagen: 10 },
    ],
  },
];

function orakel(s) {
  if (s.ligging.label === 'geen-gaten') return { wil: 'blokkeer', reden: 'agenda vol, uitleg verplicht' };
  const ver = s.ligging.label === 'ver-weg' || s.ligging.label === 'randgeval-30min';
  if (s.ligging.label === 'ver-weg' && s.agenda.betrouwbaar && s.wacht.dagen < MAX_WACHT_DAGEN) {
    return { wil: 'blokkeer', reden: 'bewust wachten op buur, met uitleg' };
  }
  // randgeval: 30 is ≤ grens, dus 2 slots blijven over → aanbod
  return { wil: 'aanbod', minSlots: 1 };
}

function voerUit(s) {
  const slots = s.ligging.slots(s.agenda.betrouwbaar);
  const aanbod = kiesAanbod(slots, 3, { wachtDagen: s.wacht.dagen });
  const uitleg = aanbod.length ? null : waaromGeenAanbod(slots);
  return {
    aantal: aanbod.length,
    // spreiding-invariant: nooit 2x hetzelfde dagdeel als er alternatieven waren
    gespreid: new Set(aanbod.map((a) => a.datum + (a.aankomst.getHours() < 12 ? 'o' : 'm'))).size === Math.min(aanbod.length, 3),
    uitleg,
    melding: aanbod.length === 0 && !!uitleg, // geen aanbod is alleen oké MET uitleg
  };
}

function vergelijk(wil, echt) {
  if (wil.wil === 'blokkeer') return echt.aantal === 0 && !!echt.uitleg;
  return echt.aantal >= wil.minSlots && echt.gespreid;
}

module.exports = {
  naam: 'planner-aanbod (verre klant, volle agenda, wachtgrens)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit: async (s) => voerUit(s),
  vergelijk,
};
