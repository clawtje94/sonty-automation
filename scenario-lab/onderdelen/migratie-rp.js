// Scenario-lab: MIGRATIE RP-ITEM → EIGEN LEAD (blok 4 RP-uitzetten, 30-08-2026), zuivere omzetting rpItemNaarLead().
// Orakel: O1 id = LEAD-RP-<rp-item-id>, kolom = RP-status_id, gearchiveerd-vlag klopt;
//         O2 contact komt uit de omschrijving-labels, anders uit item.fields (e-mail/telefoon/adres gesplitst);
//         O3 offerte: ACCEPTED (nieuwste) wint van SENT, SENT van DRAFT; geen offertes → geen offerte-blok; totaal uit pricing.total;
//         O4 kanaal winkel (afkomst "Winkel") → type offerte, anders configurator; producten uit "Nx …:"-regels.
//         O5 sync: nooit gezien → mee; gezien en daarna in RP gewijzigd → mee; gezien en ongewijzigd → niet (oude ISO-stand én nieuwe {op,upd}-stand).
const { combinaties } = require('../matrix.js');
const { rpItemNaarLead, moetSync } = require('../../scripts/migreer-rp-naar-eigen.js');

const dims = [
  { naam: 'omschrijving', waarden: [{ label: 'labels' }, { label: 'alleen-fields' }, { label: 'leeg' }] },
  { naam: 'offertes', waarden: [{ label: 'geen', q: [] }, { label: 'draft', q: [['DRAFT', 1000, '20261', 900]] }, { label: 'sent+accepted', q: [['SENT', 3000, '20262', 1200], ['ACCEPTED', 2000, '20263', 1100]] }, { label: '2x-accepted', q: [['ACCEPTED', 1000, '20264', 1500], ['ACCEPTED', 4000, '20265', 1600]] }] },
  { naam: 'archief', waarden: [{ label: 'nee' }, { label: 'ja' }] },
  { naam: 'afkomst', waarden: [{ label: 'google', v: 'Google' }, { label: 'winkel', v: 'Winkel' }, { label: 'geen', v: '' }] },
  { naam: 'stand', waarden: [{ label: 'nooit', e: null, wil: true }, { label: 'oud-ongewijzigd', e: '2026-08-30T14:00:00.000Z', wil: false }, { label: 'oud-gewijzigd', e: '2026-05-01T00:00:00.000Z', wil: true }, { label: 'nieuw-ongewijzigd', e: { op: 'x', upd: 1780000500000 }, wil: false }, { label: 'nieuw-gewijzigd', e: { op: 'x', upd: 1780000000000 }, wil: true }] },
];

function maakItem(s) {
  const desc = s.omschrijving.label === 'labels'
    ? ['Voornaam: Kim', 'Achternaam: van der Berg', 'E-mailadres: Kim@Example.com', 'Telefoonnummer: +31611111111', 'Straatnaam: Frijdastraat', 'Huisnummer: 8F', 'Postcode: 2288 EX', 'Plaats: Rijswijk', s.afkomst.v ? 'Hoe komt u bij ons terecht?: ' + s.afkomst.v : '', 'Opmerking: graag snel', '', '2x Screens:', '1x Rolluik S-42:'].filter((x) => x !== '').join('\n')
    : s.omschrijving.label === 'alleen-fields' ? (s.afkomst.v ? 'Hoe komt u bij ons terecht?: ' + s.afkomst.v + '\n' : '') + '1x Screens:' : '';
  return {
    id: 'rp-item-1', summary: 'Kim van der Berg', description: desc, status_id: 'kolom-x', status_label: 'Offerte verstuurd',
    fields: { email: 'fields@example.com', phone: '+31622222222', address: 'Laan 12, 2288AB Rijswijk, Nederland', cf_lead_value: { amount: '999' } },
    technical_labels: s.archief.label === 'ja' ? [{ type: 'ITEM_ARCHIVED' }] : [], timestamp_created: 1780000000000, timestamp_updated: 1780000500000, item_subject: { id: 'lc-1' },
  };
}
const quotations = (s) => s.offertes.q.map(([st, ts, nr, tot]) => ({ documentId: 'doc-' + nr, quotationStatus: st, quotationCreationTimestamp: ts, quotationNumber: nr, pricing: { total: tot } }));

function scenarios() { return combinaties(dims); }
function orakel(s) {
  const labels = s.omschrijving.label === 'labels';
  const q = s.offertes.q;
  let beste = null;
  if (q.length) { const acc = q.filter((x) => x[0] === 'ACCEPTED').sort((a, b) => b[1] - a[1]); const sent = q.filter((x) => x[0] === 'SENT').sort((a, b) => b[1] - a[1]); beste = acc[0] || sent[0] || [...q].sort((a, b) => b[1] - a[1])[0]; }
  return {
    wil: 'ok', id: 'LEAD-RP-rp-item-1', kolom: 'kolom-x', gearchiveerd: s.archief.label === 'ja',
    email: labels ? 'kim@example.com' : 'fields@example.com', telefoon: labels ? '+31611111111' : '+31622222222', postcode: labels ? '2288EX' : '2288AB', plaats: 'Rijswijk',
    rpNummer: beste ? beste[2] : null, offerteStatus: beste ? beste[0] : null, totaal: beste ? beste[3] : null,
    type: s.afkomst.label === 'winkel' && s.omschrijving.label !== 'leeg' ? 'offerte' : 'configurator', producten: labels ? 2 : s.omschrijving.label === 'alleen-fields' ? 1 : 0,
    sync: s.stand.wil,
  };
}
function voerUit(s) {
  const item = maakItem(s);
  const l = rpItemNaarLead(item, quotations(s));
  return { sync: moetSync(item, s.stand.e), id: l.id, kolom: l.rpKolom, gearchiveerd: !!l.gearchiveerd, email: l.contact.email, telefoon: l.contact.telefoon, postcode: l.contact.postcode, plaats: l.contact.plaats,
    rpNummer: l.offerte ? l.offerte.rpNummer : null, offerteStatus: l.offerte ? l.offerte.status : null, totaal: l.offerte ? l.offerte.totaalInclBTW : null, type: l.type, producten: (l.products || []).length, melding: false };
}
function vergelijk(w, e) { return ['id', 'kolom', 'gearchiveerd', 'email', 'telefoon', 'postcode', 'plaats', 'rpNummer', 'offerteStatus', 'totaal', 'type', 'producten', 'sync'].every((k) => w[k] === e[k]); }

module.exports = { naam: 'migratie-rp (RP-item → eigen lead: contact, offertekeuze, archief, kanaal, producten)', scenarios, orakel, voerUit, vergelijk };
