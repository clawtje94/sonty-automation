/**
 * RASTER — dekking die niet afhangt van wat we toevallig verkocht hebben.
 *
 * De historie (3.596 prijsvragen uit echte offertes) dekt alleen wat klanten besteld
 * hebben. Gemeten: 1 product uit het boek is in heel 2026 nooit geoffreerd, en 45 van de
 * 90 combinaties product × bediening komen niet in de historie voor. Precies die
 * ongebruikte hoeken zijn waar een verbouwing ongemerkt iets kan slopen.
 *
 * Dit bestand loopt daarom het prijsboek zelf af: elke maatstaffel die in een tabel
 * staat, gekruist met elke bediening. Plus de randen: net onder en net boven een staffel,
 * want daar zit de "eerstvolgende maat omhoog"-logica.
 *
 * Alleen-lezen, net als de rest.
 */
const fs = require('fs');
const path = require('path');

const BEDS = ['io', 'afstandsbediening', 'draaischakelaar', 'solar', 'solarBrel', 'handbediend'];

/** Haalt alle maatcombinaties uit de tabellen van één product.
 *  Twee vormen komen voor: product.table (breedte → hoogte → prijs) en
 *  product.tables (doek/uitval → breedte → prijs). Beide generiek aflopen. */
function maatenUitProduct(prod) {
  const uit = [];
  const num = (o) => Object.keys(o || {}).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);

  // zipDesign110 heeft geen `table` maar tableSmall/tableLarge; zonder deze regel viel dat
  // product volledig buiten het raster (gemeten: 0 vragen).
  for (const naam of ['table', 'tableSmall', 'tableLarge']) {
    const t = prod[naam];
    if (!t) continue;
    for (const b of num(t)) {
      const binnen = t[b];
      if (binnen && typeof binnen === 'object') for (const h of num(binnen)) uit.push({ breedte: b, hoogte: h, uitval: null });
      else uit.push({ breedte: b, hoogte: null, uitval: null });
    }
  }
  if (prod.tables) {
    for (const sleutel of Object.keys(prod.tables)) {
      const t = prod.tables[sleutel];
      if (!t || typeof t !== 'object') continue;
      const s = Number(sleutel);
      for (const b of num(t)) {
        const cel = t[b];
        // Bij knikarm/uitval is de buitenste sleutel de uitval of het doek; bij een
        // geneste tabel is de binnenste de hoogte. Beide varianten meenemen.
        if (cel && typeof cel === 'object') for (const h of num(cel)) uit.push({ breedte: b, hoogte: h, uitval: Number.isNaN(s) ? null : s });
        else uit.push({ breedte: b, hoogte: null, uitval: Number.isNaN(s) ? null : s });
      }
    }
  }
  return uit;
}

/** Bouwt het volledige raster. randen=true voegt per maat ook maat-1 en maat+1 toe,
 *  zodat de staffelgrenzen zelf getest worden en niet alleen de nette waarden. */
function bouwRaster({ randen = true } = {}) {
  const P = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'sunmaster-prices-2026.json'), 'utf8'));
  const producten = Object.keys(P).filter((k) => !k.startsWith('_') && P[k] && P[k].category);

  const vragen = [];
  const perProduct = {};
  for (const pk of producten) {
    const maten = maatenUitProduct(P[pk]);
    const uitgebreid = [];
    for (const m of maten) {
      uitgebreid.push(m);
      if (randen && m.breedte) {
        uitgebreid.push({ ...m, breedte: m.breedte - 1 });
        uitgebreid.push({ ...m, breedte: m.breedte + 1 });
      }
    }
    perProduct[pk] = uitgebreid.length * BEDS.length;
    for (const m of uitgebreid) for (const bed of BEDS) {
      vragen.push({ soort: 'sunmaster', productKey: pk, breedte: m.breedte, hoogte: m.hoogte, uitval: m.uitval, bedType: bed, _kop: pk });
    }
  }
  return { producten, vragen, perProduct };
}

module.exports = { bouwRaster, maatenUitProduct, BEDS };
