#!/usr/bin/env node
// Zonradar proof-of-concept: bepaal per adres de tuinrichting (achtertuin-oriëntatie)
// uit open data: BAG (pand + adres, PDOK OGC API) + Kadastrale kaart (perceel, PDOK WFS).
// Methode: vector van pand-zwaartepunt naar perceel-zwaartepunt wijst richting de tuin.
// Gebruik: node scripts/zonradar-poc.js [lon] [lat] [±graden]
const LON = parseFloat(process.argv[2] || '4.5245');
const LAT = parseFloat(process.argv[3] || '51.8485');
const D = parseFloat(process.argv[4] || '0.0022');
const bbox = [LON - D, LAT - D, LON + D, LAT + D].join(',');

const centroid = (ring) => {
  // gewogen polygoon-zwaartepunt (shoelace)
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    a += f; cx += (ring[i][0] + ring[i + 1][0]) * f; cy += (ring[i][1] + ring[i + 1][1]) * f;
  }
  a *= 0.5;
  return a ? [cx / (6 * a), cy / (6 * a)] : ring[0];
};
const inPoly = (pt, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const RICHTING = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
const azimut = (dx, dy) => {
  // dx,dy in meters; 0° = noord, klokmee
  const deg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return { deg, windr: RICHTING[Math.round(deg / 45) % 8] };
};

(async () => {
  const gj = async (url) => (await fetch(url, { headers: { Accept: 'application/json' } })).json();

  // 1) BAG adressen + panden in het gebied
  const adressen = await gj(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/adres/items?bbox=${bbox}&f=json&limit=300`);
  const panden = await gj(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${bbox}&f=json&limit=300`);
  // 2) kadastrale percelen (WFS)
  const percelen = await gj(`https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=kadastralekaart:Perceel&bbox=${LAT - D},${LON - D},${LAT + D},${LON + D},urn:ogc:def:crs:EPSG::4326&outputFormat=application/json&count=500&srsName=EPSG:4326`);

  console.log('adressen:', (adressen.features || []).length, '| panden:', (panden.features || []).length, '| percelen:', (percelen.features || []).length);

  const mLat = 111320, mLon = 111320 * Math.cos((LAT * Math.PI) / 180);
  const rows = [];
  for (const a of adressen.features || []) {
    const p = a.properties || {};
    const apt = a.geometry?.type === 'Point' ? a.geometry.coordinates : null;
    if (!apt) continue;
    // pand waar het adres in ligt (alleen woningen)
    const pand = (panden.features || []).find((f) => f.geometry?.type === 'Polygon' && inPoly(apt, f.geometry.coordinates[0]));
    if (pand && !/woonfunctie/i.test(String(pand.properties?.gebruiksdoel || ''))) continue;
    // perceel waar het adres in ligt
    const perceel = (percelen.features || []).find((f) => {
      const g = f.geometry; if (!g) return false;
      const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((c) => c[0]) : [];
      return rings.some((r) => inPoly(apt, r));
    });
    if (!pand || !perceel) continue;
    const pc = centroid(pand.geometry.coordinates[0]);
    const ring = perceel.geometry.type === 'Polygon' ? perceel.geometry.coordinates[0] : perceel.geometry.coordinates[0][0];
    const kc = centroid(ring);
    const dx = (kc[0] - pc[0]) * mLon, dy = (kc[1] - pc[1]) * mLat;
    const afstand = Math.hypot(dx, dy);
    if (afstand < 1) continue; // pand vult perceel (appartement) → geen tuin
    const { deg, windr } = azimut(dx, dy);
    const zonTuin = deg >= 112 && deg <= 248; // ZO t/m ZW = zon-achtertuin
    rows.push({
      adres: `${p.openbare_ruimte_naam || p.openbareRuimteNaam || '?'} ${p.huisnummer || ''}${p.huisletter || ''}`,
      plaats: p.woonplaats_naam || p.woonplaatsNaam || '',
      bouwjaar: pand.properties?.oorspronkelijk_bouwjaar || pand.properties?.bouwjaar || '',
      tuinrichting: windr, graden: Math.round(deg), zonTuin,
    });
  }
  rows.sort((a, b) => a.adres.localeCompare(b.adres, 'nl', { numeric: true }));
  rows.forEach((r) => console.log(`${r.adres.padEnd(30)} ${String(r.plaats).slice(0, 14).padEnd(15)} bj ${String(r.bouwjaar).padEnd(5)} tuin: ${r.tuinrichting.padEnd(2)} (${r.graden}°) ${r.zonTuin ? '☀️ ZONTUIN' : ''}`));
  const z = rows.filter((r) => r.zonTuin).length;
  console.log(`\n${rows.length} woningen geanalyseerd, ${z} met zon-achtertuin (ZO-ZW) = ${Math.round((100 * z) / (rows.length || 1))}%`);
})();
