// Scenario-lab: RAPPORTEN ZONDER RP (blok 4 RP-uitzetten, 30-08-2026) — scripts/lib/dossiers.js rpGetVervanger.
// Orakel: O1 een bord-/backlog-vraag geeft alle NIET-gearchiveerde dossiers; O2 de offertelijst per lead-configuratie geeft precies
//         de offerte van dat dossier (nummer, status, totaal, datum) of leeg zonder offerte; O3 een volledig document heeft de regels
//         (toolLines winnen van regels, negatieve regels eruit) en de korting; O4 onbekende id → lege lijst / null, nooit een crash.
const { combinaties } = require('../matrix.js');
const D = require('../../scripts/lib/dossiers.js');

const dims = [
  { naam: 'archief', waarden: [{ label: 'nee' }, { label: 'ja' }] },
  { naam: 'offerte', waarden: [{ label: 'geen' }, { label: 'sent', status: 'SENT', totaal: 1500 }, { label: 'accepted', status: 'ACCEPTED', totaal: 2500.5 }] },
  { naam: 'regels', waarden: [{ label: 'toolLines' }, { label: 'regels+korting' }, { label: 'leeg' }] },
  { naam: 'vraag', waarden: [{ label: 'bord' }, { label: 'offertelijst' }, { label: 'document' }, { label: 'onbekend' }] },
];

function maakItem(s) {
  const o = s.offerte.label === 'geen' ? { nummers: [] } : { nummers: ['S26-3001'], status: s.offerte.status, totaalInclBTW: s.offerte.totaal, datums: ['2026-09-02T10:00:00.000Z'], documentId: 'doc-3001' };
  if (s.regels.label === 'toolLines') o.toolLines = [{ description: 'Screen', pricePerUnit: 1000, units: 1 }, { description: 'Montage', pricePerUnit: 200, units: 1 }];
  if (s.regels.label === 'regels+korting') { o.regels = [{ omschrijving: 'Screen', subtotaal: 1000, aantal: 1 }, { omschrijving: 'Korting', subtotaal: -150, aantal: 1 }]; o.korting = { pct: 15, naam: '15% actie' }; }
  return { id: 'LEAD-RP-1', summary: 'Kim Jansen', timestamp_created: 1780000000000, gearchiveerd: s.archief.label === 'ja' || undefined, item_subject: { id: 'lc-1' }, offerte: o };
}

function scenarios() { return combinaties(dims); }
function orakel(s) {
  const heeft = s.offerte.label !== 'geen';
  if (s.vraag.label === 'bord') return { wil: 'ok', aantal: s.archief.label === 'ja' ? 0 : 1 };
  if (s.vraag.label === 'offertelijst') return { wil: 'ok', aantal: heeft ? 1 : 0, nummer: heeft ? 'S26-3001' : null, status: heeft ? s.offerte.status : null, totaal: heeft ? s.offerte.totaal : null };
  // zonder offerte bestaat er geen document → null (regels 0, geen korting); anders regels uit toolLines (2) of regels zonder negatieve (1)
  if (s.vraag.label === 'document') return { wil: 'ok', regels: !heeft || s.regels.label === 'leeg' ? 0 : s.regels.label === 'toolLines' ? 2 : 1, kortingPct: heeft && s.regels.label === 'regels+korting' ? 15 : null };
  return { wil: 'ok', leeg: true };
}
async function voerUit(s) {
  const item = maakItem(s);
  D._zetDossiers([item]);
  if (s.vraag.label === 'bord') { const r = await D.rpGetVervanger('/contact-service/p/backlogs/b/items'); return { aantal: r.items.length, melding: false }; }
  if (s.vraag.label === 'offertelijst') { const r = await D.rpGetVervanger('/document-service/v1/p/quotations?lead_configuration_id=lc-1'); const q = r.quotationDatas[0]; return { aantal: r.quotationDatas.length, nummer: q ? q.quotationNumber : null, status: q ? q.quotationStatus : null, totaal: q ? q.pricing.total : null, melding: false }; }
  if (s.vraag.label === 'document') { const r = await D.rpGetVervanger('/document-service/v1/p/quotations/doc-3001'); const d = r && r.quotationData.segments.defaultTemplatePriceLineGroup.data; return { regels: d ? d.lines.length : 0, kortingPct: d && d.groupDiscount ? d.groupDiscount.amount : null, melding: false }; }
  const a = await D.rpGetVervanger('/document-service/v1/p/quotations?lead_configuration_id=bestaat-niet'); const b = await D.rpGetVervanger('/document-service/v1/p/quotations/bestaat-niet');
  return { leeg: a.quotationDatas.length === 0 && b === null, melding: false };
}
function vergelijk(w, e) { return Object.keys(w).filter((k) => k !== 'wil').every((k) => w[k] === e[k]); }

module.exports = { naam: 'dossiers-rp-uit (rapporten lezen bord/offertes/documenten uit het eigen CRM zodra RP uit staat)', scenarios, orakel, voerUit, vergelijk };
