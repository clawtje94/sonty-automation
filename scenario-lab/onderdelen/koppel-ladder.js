// Onderdeel: klant koppelen aan Gripp (zoekKlant-ladder: postcode → straat → telefoon → naam).
// Orakel:
//  - er is ondubbelzinnig bewijs (adres klopt, of telefoon klopt, of naam is uniek) én
//    de kaart heeft een offerte → KOPPEL aan die kaart
//  - geen bewijs, dubbelzinnige naam, of kaart zonder offerte → NIET koppelen (blokkeer =
//    liever een eerlijk gat dan een verkeerde koppeling)
const { combinaties } = require('../matrix.js');
const { zoekKlant } = require('../../scripts/planado-gripp-verrijken.js');

const KAART = (id, naam, pc, nr, straat, tel) => ({
  id, searchname: naam,
  visitingaddress_zipcode: pc, visitingaddress_streetnumber: nr, visitingaddress_street: straat,
  phone: tel, mobile: tel,
});

const dimensies = [
  {
    naam: 'adres',
    waarden: [
      { label: 'met-postcode', adres: 'Teststraat 12, 2288 EZ Rijswijk' },
      { label: 'zonder-postcode', adres: 'Teststraat 12 Rijswijk, Nederland' },
      { label: 'huisletter', adres: 'Teststraat 12a Rijswijk' },
      { label: 'leeg', adres: '' },
    ],
  },
  {
    naam: 'telefoon',
    waarden: [
      { label: 'geldig', tel: '+31612345678' },
      { label: 'kapot-11-cijfers', tel: '10612345678' },
      { label: 'leeg', tel: null },
    ],
  },
  {
    naam: 'naam',
    waarden: [
      { label: 'exact', naam: 'Jan Testman' },
      { label: 'typefout', naam: 'Jan Testmen' },
      { label: 'met-adres-erin', naam: 'Jan Testman, Wittgensteinlaan' },
      { label: 'winkeldienst', naam: 'JOEY WINKEL' },
      { label: 'leeg', naam: '' },
    ],
  },
  {
    naam: 'gripp',
    waarden: [
      { label: 'kaart-adres-klopt', kaarten: [KAART(1, 'Jan Testman', '2288EZ', '12', 'Teststraat 12 Rijswijk', '+31612345678')], offertes: { 1: { id: 90, number: 6001 } } },
      { label: 'kaart-ander-adres', kaarten: [KAART(1, 'Jan Testman', '9999ZZ', '99', 'Verweglaan 99 Groningen', '+31612345678')], offertes: { 1: { id: 90, number: 6001 } } },
      { label: 'kaart-zonder-offerte', kaarten: [KAART(1, 'Jan Testman', '2288EZ', '12', 'Teststraat 12 Rijswijk', '+31612345678')], offertes: {} },
      { label: 'twee-kaarten-zelfde-adres', kaarten: [KAART(1, 'Jan Testman', '2288EZ', '12', 'Teststraat 12 Rijswijk', '+31612345678'), KAART(2, 'Testman BV', '2288EZ', '12', 'Teststraat 12 Rijswijk', null)], offertes: { 1: { id: 90, number: 6001 }, 2: { id: 95, number: 6005 } } },
      { label: 'twee-jannen', kaarten: [KAART(1, 'Jan Testman', '1111AA', '1', 'Elders 1', null), KAART(2, 'Jan Testmans', '2222BB', '2', 'Anders 2', null)], offertes: { 1: { id: 90, number: 6001 }, 2: { id: 91, number: 6002 } } },
      { label: 'geen-kaart', kaarten: [], offertes: {} },
    ],
  },
];

function orakel(s) {
  const g = s.gripp;
  if (!g.kaarten.length) return { wil: 'blokkeer' };
  const l9 = (x) => String(x || '').replace(/\D/g, '').slice(-9);

  // Het bewijs wijst een SPECIFIEKE kaart aan, in ladder-volgorde:
  // 1. adres (fixtures met job-adres: kaart-adres-klopt, kaart-zonder-offerte, twee-kaarten)
  const adresKandidaten = (s.adres.label !== 'leeg' && !['kaart-ander-adres', 'twee-jannen', 'geen-kaart'].includes(g.label))
    ? g.kaarten : [];
  // 2. telefoon (laatste 9 cijfers — tikfout-prefix telt gewoon mee)
  const telKaart = (s.telefoon.tel && l9(s.telefoon.tel).length === 9)
    ? g.kaarten.find((k) => l9(k.phone) === l9(s.telefoon.tel)) : null;
  // 3. unieke exacte naam, maar nooit tegen een afwijkend kaart-adres in
  let naamKaart = null;
  if (['exact', 'met-adres-erin'].includes(s.naam.label)) {
    const exact = g.kaarten.filter((k) => k.searchname === 'Jan Testman');
    const tegenspraak = s.adres.label !== 'leeg' && ['kaart-ander-adres', 'twee-jannen'].includes(g.label);
    if (exact.length === 1 && !tegenspraak) naamKaart = exact[0];
  }

  let doel = null;
  if (adresKandidaten.length) {
    const metOff = adresKandidaten.filter((k) => g.offertes[k.id]);
    if (!metOff.length) return { wil: 'blokkeer' }; // kaart(en) zonder offerte = melden
    doel = metOff.sort((a, b) => g.offertes[b.id].id - g.offertes[a.id].id)[0];
  } else if (telKaart) {
    doel = g.offertes[telKaart.id] ? telKaart : null;
    if (!doel) return { wil: 'blokkeer' };
  } else if (naamKaart) {
    doel = g.offertes[naamKaart.id] ? naamKaart : null;
    if (!doel) return { wil: 'blokkeer' };
  } else return { wil: 'blokkeer' };
  return { wil: 'koppel', nummer: g.offertes[doel.id].number };
}

function voerUit(s) {
  const g = s.gripp;
  const echteFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (!String(url).includes('gripp.com')) return { ok: false, status: 500 };
    const [call] = JSON.parse(opts.body);
    const filters = call.params[0] || [];
    const veld = (f) => filters.find((x) => x.field === f)?.value;
    let rows = [];
    if (call.method === 'company.get') {
      const zip = veld('company.visitingaddress_zipcode');
      const straat = veld('company.visitingaddress_street');
      const tel = veld('company.phone') || veld('company.mobile');
      const naam = veld('company.searchname');
      const kaal = (x) => String(x || '').replace(/%/g, '').toLowerCase().replace(/\s/g, '');
      rows = g.kaarten.filter((k) => {
        if (zip) return kaal(k.visitingaddress_zipcode).includes(kaal(zip).slice(0, 4)) && String(k.visitingaddress_streetnumber).startsWith(String(veld('company.visitingaddress_streetnumber') || '').replace('%', ''));
        if (straat) return kaal(k.visitingaddress_street).includes(kaal(straat)) && String(k.visitingaddress_streetnumber || '').startsWith(String(veld('company.visitingaddress_streetnumber') || '').replace('%', ''));
        if (tel) return kaal(k.phone).includes(kaal(tel));
        if (naam) return kaal(k.searchname).includes(kaal(naam));
        return false;
      });
    } else if (call.method === 'offer.get') {
      const cid = veld('offer.company');
      const off = g.offertes[cid];
      rows = off ? [off] : [];
    }
    return { ok: true, json: async () => [{ id: 1, result: { rows } }] };
  };
  const klantnaam = /joey\s*winkel|^winkel/i.test(s.naam.naam) ? null : (s.naam.naam || null);
  return zoekKlant(s.adres.adres || null, s.telefoon.tel, klantnaam).finally(() => { global.fetch = echteFetch; });
}

function vergelijk(wil, echt) {
  if (wil.wil === 'blokkeer') return echt.match === null;
  return echt.match !== null && echt.match.offerte.number === wil.nummer;
}

module.exports = {
  naam: 'koppel-ladder (klant → Gripp)',
  scenarios: () => combinaties(dimensies),
  orakel,
  voerUit: async (s) => {
    const match = await voerUit(s);
    // niet koppelen is zichtbaar: de verrijker meldt elke niet-gekoppelde in zijn rapport
    return { match, melding: match === null };
  },
  vergelijk,
};
