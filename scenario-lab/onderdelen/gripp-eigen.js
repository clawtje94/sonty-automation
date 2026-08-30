// Scenario-lab: GRIPP INVULLEN VANUIT EEN EIGEN OFFERTE (blok 3 RP-uitzetten, 30-08-2026).
// Orakel: O1 elke positieve productregel wordt één Gripp-regel met prijs per stuk (incl. btw, zoals RP-lines) en aantal;
//         O2 negatieve kortingregels uit de offerte-view tellen niet mee als regel; korting komt als groupDiscount (pct+naam);
//         O3 offerte-tool-regels (toolLines) winnen van de view-regels; O4 status en S-nummer gaan 1-op-1 mee;
//         O5 lege offerte → geen regels (de cron slaat hem zichtbaar over: "geen productregels").
const { combinaties } = require('../matrix.js');
const { eigenDocs } = require('../../scripts/cron-gripp-invullen.js');

const dims = [
  { naam: 'bron', waarden: [{ label: 'toolLines' }, { label: 'regels' }, { label: 'leeg' }] },
  { naam: 'korting', waarden: [{ label: 'geen', pct: 0 }, { label: '15', pct: 15 }] },
  { naam: 'kortingregel', waarden: [{ label: 'nee' }, { label: 'ja' }] },
  { naam: 'status', waarden: [{ label: 'ACCEPTED' }, { label: 'SENT' }] },
  { naam: 'aantal', waarden: [{ label: '1', n: 1 }, { label: '2', n: 2 }] },
];

function maakItem(s) {
  const o = { nummers: ['S26-2001'], datums: ['2026-09-01T09:00:00.000Z'], status: s.status.label, korting: s.korting.pct ? { pct: s.korting.pct, naam: s.korting.pct + '% tijdelijke actie' } : null };
  if (s.bron.label === 'toolLines') o.toolLines = [{ description: '**Rolluik S-42**\nBreedte 2000 mm\nMotor', pricePerUnit: 1250, units: s.aantal.n }, { description: 'Montage', pricePerUnit: 250, units: 1 }];
  if (s.bron.label !== 'toolLines') {
    o.regels = s.bron.label === 'leeg' ? [] : [
      { omschrijving: (s.aantal.n > 1 ? s.aantal.n + '× ' : '') + 'Rolluik S-42', beschrijving: '- Breedte 2000 mm\n- Motor', aantal: s.aantal.n, subtotaal: 1250 * s.aantal.n },
      { omschrijving: 'Montage', details: '', aantal: 1, subtotaal: 250 },
    ];
    if (s.kortingregel.label === 'ja' && o.regels.length) o.regels.push({ omschrijving: '15% tijdelijke actie (−15%)', details: '', aantal: 1, subtotaal: -225 });
  }
  return { id: 'LEAD-LAB-GRIPP', eigen: true, summary: 'Kim Jansen', offerte: o };
}

function scenarios() { return combinaties(dims); }
function orakel(s) {
  const leeg = s.bron.label === 'leeg';
  return { wil: 'ok', regels: leeg ? 0 : 2, eersteAantal: leeg ? null : s.aantal.n, eerstePrijs: leeg ? null : 1250, pct: s.korting.pct || null, status: s.status.label, nummer: 'S26-2001' };
}
function voerUit(s) {
  const d = eigenDocs(maakItem(s))[0];
  const lines = d.full.quotationData.segments.defaultTemplatePriceLineGroup.data.lines;
  const gd = d.full.quotationData.segments.defaultTemplatePriceLineGroup.data.groupDiscount;
  return { regels: lines.length, eersteAantal: lines[0] ? lines[0].units : null, eerstePrijs: lines[0] ? lines[0].pricePerUnit : null, pct: gd ? gd.amount : null, status: d.status, nummer: d.info.quotationNumber, melding: false };
}
function vergelijk(w, e) { return w.regels === e.regels && w.eersteAantal === e.eersteAantal && w.eerstePrijs === e.eerstePrijs && w.pct === e.pct && w.status === e.status && w.nummer === e.nummer; }

module.exports = { naam: 'gripp-eigen (eigen offerte → Gripp-documentvorm: regels, korting, status, nummer)', scenarios, orakel, voerUit, vergelijk };
