// Onderdeel: welke RP-offerteversie geldt? (leesOfferte uit inmeten-planner-lees.js)
// Orakel-regels (Daimy 05/06-08):
//  - is er een GETEKENDE (ACCEPTED)? die geldt, nieuwste eerst
//  - precies 1 versie, ook ongetekend? gewoon die ("dat is prima")
//  - meerdere versies, geen enkele getekend? BLOKKEER — klant moet er zelf één tekenen
//  - geen document of geen lead-id? leeg resultaat, geen crash
const { combinaties } = require('../matrix.js');
const { leesOfferte } = require('../../scripts/inmeten-planner-lees.js');

const DOC = (status, ts, id) => ({
  documentId: id, quotationStatus: status, documentStatus: status,
  quotationCreationTimestamp: ts, pricing: { total: 1000 },
});
const REGEL = (naam) => ({ description: `**${naam}**\nBreedte: 1000 mm\nHoogte: 2000 mm\nKleur: RAL 9010\nBediening: Somfy IO`, units: 1, pricePerUnit: 1210 });

const dimensies = [
  {
    naam: 'docs',
    waarden: [
      { label: 'geen', docs: [] },
      { label: '1xSENT', docs: [DOC('SENT', 10, 'a')] },
      { label: '1xACCEPTED', docs: [DOC('ACCEPTED', 10, 'a')] },
      { label: '1xCONCEPT', docs: [DOC('DRAFT', 10, 'a')] },
      { label: '2xSENT', docs: [DOC('SENT', 10, 'a'), DOC('SENT', 20, 'b')] },
      { label: 'SENT+ACCEPTED', docs: [DOC('SENT', 10, 'a'), DOC('ACCEPTED', 20, 'b')] },
      { label: 'SENT+ACCEPTED-zelfde-tijd', docs: [DOC('SENT', 10, 'a'), DOC('ACCEPTED', 10, 'b')] },
      { label: 'ACCEPTED-nieuw+oud', docs: [DOC('ACCEPTED', 10, 'a'), DOC('ACCEPTED', 20, 'b')] },
      { label: '3-mix-geen-getekend', docs: [DOC('SENT', 10, 'a'), DOC('DRAFT', 20, 'b'), DOC('SENT', 30, 'c')] },
      { label: '4-mix-1-getekend', docs: [DOC('SENT', 10, 'a'), DOC('ACCEPTED', 20, 'b'), DOC('SENT', 30, 'c'), DOC('DRAFT', 40, 'd')] },
    ],
  },
  {
    naam: 'lead',
    waarden: [
      { label: 'normaal', item: { item_subject: { id: 'lc-1' } } },
      { label: 'zonder-subject', item: {} },
    ],
  },
  {
    naam: 'inhoud',
    waarden: [
      { label: '1-product', regels: [REGEL('Rolluik ROMA')] },
      { label: '3-producten', regels: [REGEL('Rolluik ROMA'), REGEL('Zip Design'), REGEL('SunEye XL')] },
      { label: 'alleen-montage', regels: [REGEL('Montage rolluik')] },
      { label: 'leeg-document', regels: [] },
    ],
  },
];

function orakel(s) {
  if (s.lead.label === 'zonder-subject' || s.docs.label === 'geen') return { wil: 'leeg' };
  const accepted = s.docs.docs.filter((d) => d.quotationStatus === 'ACCEPTED');
  if (!accepted.length && s.docs.docs.length > 1) return { wil: 'blokkeer' };
  const echteProducten = s.inhoud.regels.filter((r) => !/^\*\*(Montage|Inmeten)/i.test(r.description)).length;
  return { wil: 'producten', aantal: echteProducten, status: accepted.length ? 'ACCEPTED' : s.docs.docs[0].quotationStatus };
}

function voerUit(s) {
  // nep-RP: leesOfferte praat tegen fetch — die vangen we af met scenario-data
  const echteFetch = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/quotations?')) return { ok: true, json: async () => ({ quotationDatas: s.docs.docs }) };
    if (u.includes('/quotations/')) {
      return {
        ok: true,
        json: async () => ({ quotationData: { quotationStatus: 'x', segments: { g: { type: 'priceLineGroup', data: { lines: s.inhoud.regels } } } } }),
      };
    }
    return { ok: false, status: 500 };
  };
  return leesOfferte(s.lead.item).finally(() => { global.fetch = echteFetch; });
}

function vergelijk(wil, echt) {
  if (wil.wil === 'leeg') return !echt.ambigu && echt.producten.length === 0;
  if (wil.wil === 'blokkeer') return echt.ambigu === true && echt.producten.length === 0;
  return !echt.ambigu && echt.producten.length === wil.aantal;
}

module.exports = {
  naam: 'offerte-keuze (getekende versie wint)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit: async (s) => {
    const r = await voerUit(s);
    // ambigu is een zichtbare stop (planner meldt "klant moet tekenen")
    return { ...r, melding: r.ambigu === true };
  },
  vergelijk,
};
